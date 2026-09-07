// Canal de mensajería consultor <-> cliente: un hilo por organización.
//
// - Lectura: cliente user-scoped, la RLS
//   (is_platform_admin | is_assigned_consultant | current_member_role owner/manager)
//   limita las filas.
// - Escritura: service role + chequeo de rol aquí (ADR-0006 pto 7).
// - Adjuntos: bucket PRIVADO `consultant-messages`; se guarda solo el
//   `storage_path`, y cada lectura devuelve una URL firmada de 1 h.
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { sniffImageMime, MARKETING_ASSET_EXT } from "./ai-runtime.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const BUCKET = "consultant-messages";
const MESSAGE_COLUMNS =
  "id, organization_id, author_user_id, author_kind, body, attachments, created_at";
const ATTACH_MAX_BYTES = 15 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const SIGNED_URL_TTL = 3600;

// mime -> extensión para los adjuntos que no son imagen. Las imágenes usan
// MARKETING_ASSET_EXT (sniff por magic bytes).
const FILE_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

type ThreadAuthorKind = "consultant" | "client" | "platform";

/** Rol del actor en el hilo. `null` = sin acceso al workspace. */
function resolveThreadAuthorKind(
  context: AuthContext,
  organizationId: string,
): ThreadAuthorKind | null {
  const membership = context.memberships.find(
    (item) => item.organization_id === organizationId,
  );
  if (!membership) return null;
  if (context.profile.platform_role === "platform_admin") return "platform";
  if (context.profile.platform_role === "consultant") return "consultant";
  if (["owner", "manager"].includes(membership.role)) return "client";
  return null;
}

type StoredAttachment = {
  storage_path: string;
  filename: string;
  content_type: string;
  byte_size: number;
};

async function signAttachments(
  service: ReturnType<typeof createServiceClient>,
  attachments: unknown,
): Promise<Array<StoredAttachment & { signed_url: string | null }>> {
  const list = Array.isArray(attachments)
    ? (attachments as StoredAttachment[])
    : [];
  return Promise.all(
    list.map(async (item) => {
      let signedUrl: string | null = null;
      try {
        const { data } = await service.storage
          .from(BUCKET)
          .createSignedUrl(item.storage_path, SIGNED_URL_TTL);
        signedUrl = data?.signedUrl ?? null;
      } catch {
        signedUrl = null;
      }
      return {
        storage_path: item.storage_path,
        filename: item.filename,
        content_type: item.content_type,
        byte_size: item.byte_size,
        signed_url: signedUrl,
      };
    }),
  );
}

const nameByOrg = (context: AuthContext) => {
  const map = new Map<string, string>();
  for (const membership of context.memberships) {
    map.set(
      membership.organization_id,
      membership.organization?.display_name ?? membership.organization_id,
    );
  }
  return map;
};

// --------------------------------------------------------------------------
// Card de vista general: un hilo por cliente con el último mensaje y no leídos
// --------------------------------------------------------------------------

export async function listClientMessageThreads(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  // El canal es bidireccional: lo usan consultor/admin y también el cliente
  // (owner/manager de su workspace). Cada lado ve al otro como "contraparte".
  const role = context.profile.platform_role;
  const isConsultantSide = role === "platform_admin" || role === "consultant";

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const [{ data: messages, error: messagesError }, { data: reads, error: readsError }] =
    await Promise.all([
      supabase
        .from("consultant_client_messages")
        .select("organization_id, body, author_kind, attachments, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("consultant_client_message_reads")
        .select("organization_id, last_read_at")
        .eq("user_id", context.user.id),
    ]);

  if (messagesError || readsError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "message_threads_load_failed",
      detail: (messagesError ?? readsError)?.message,
    };
  }

  const lastReadByOrg = new Map<string, number>();
  for (const row of reads ?? []) {
    lastReadByOrg.set(
      row.organization_id as string,
      Date.parse(row.last_read_at as string),
    );
  }

  const orgNames = nameByOrg(context);
  type ThreadEntry = {
    organization_id: string;
    organization_name: string;
    // Va aparte del nombre porque "no hay nadie al otro lado" y "hay alguien
    // que no ha puesto su nombre" son estados distintos, y para un cliente sin
    // consultor asignado la pantalla es otra: le estariamos ofreciendo escribir
    // a un hilo que no lee nadie.
    counterpart_user_id: string | null;
    counterpart_name: string | null;
    counterpart_avatar_url: string | null;
    last_message: {
      body: string;
      author_kind: string;
      has_attachments: boolean;
      created_at: string;
    } | null;
    unread_count: number;
  };
  const threads = new Map<string, ThreadEntry>();
  const seed = (orgId: string) => {
    if (!threads.has(orgId)) {
      threads.set(orgId, {
        organization_id: orgId,
        organization_name: orgNames.get(orgId) ?? orgId,
        counterpart_user_id: null,
        counterpart_name: null,
        counterpart_avatar_url: null,
        last_message: null,
        unread_count: 0,
      });
    }
  };

  // Un hilo por cada cliente/consultoría, tenga mensajes o no -> se puede
  // empezar la conversación aunque no haya escrito nadie aún.
  if (isConsultantSide) {
    const { data: assignments } = await supabase
      .from("consultant_assignments")
      .select("organization_id")
      .eq("consultant_user_id", context.user.id)
      .eq("is_active", true);
    for (const row of assignments ?? []) seed(row.organization_id as string);
  } else {
    for (const membership of context.memberships) {
      if (membership.accessSource === "membership") {
        seed(membership.organization_id);
      }
    }
  }

  for (const row of messages ?? []) {
    const orgId = row.organization_id as string;
    const createdAt = row.created_at as string;
    seed(orgId);
    const thread = threads.get(orgId) as ThreadEntry;
    // messages viene ordenado desc -> el primero de cada org es el último.
    if (!thread.last_message) {
      thread.last_message = {
        body: (row.body as string) ?? "",
        author_kind: row.author_kind as string,
        has_attachments:
          Array.isArray(row.attachments) && row.attachments.length > 0,
        created_at: createdAt,
      };
    }
    const lastRead = lastReadByOrg.get(orgId) ?? 0;
    if (Date.parse(createdAt) > lastRead) thread.unread_count += 1;
  }

  // Contraparte del hilo: para el consultor, el contacto del cliente
  // (owner > manager); para el cliente, su consultor asignado (primario).
  const orgIds = [...threads.keys()];
  if (orgIds.length > 0) {
    const service = createServiceClient(env);
    const bestByOrg = new Map<
      string,
      { userId: string; full_name: string | null; avatar_url: string | null }
    >();

    if (isConsultantSide) {
      const { data: members } = await service
        .from("organization_members")
        .select("organization_id, user_id, role")
        .in("organization_id", orgIds)
        .eq("is_active", true)
        .in("role", ["owner", "manager"]);
      const rank = (r: string) => (r === "owner" ? 0 : 1);
      const pickByOrg = new Map<string, { userId: string; role: string }>();
      for (const row of members ?? []) {
        const orgId = row.organization_id as string;
        const current = pickByOrg.get(orgId);
        if (!current || rank(row.role as string) < rank(current.role)) {
          pickByOrg.set(orgId, {
            userId: row.user_id as string,
            role: row.role as string,
          });
        }
      }
      for (const [orgId, pick] of pickByOrg) {
        bestByOrg.set(orgId, {
          userId: pick.userId,
          full_name: null,
          avatar_url: null,
        });
      }
    } else {
      const { data: cas } = await service
        .from("consultant_assignments")
        .select("organization_id, consultant_user_id, is_primary")
        .in("organization_id", orgIds)
        .eq("is_active", true);
      for (const row of cas ?? []) {
        const orgId = row.organization_id as string;
        const current = bestByOrg.get(orgId);
        if (!current || row.is_primary === true) {
          bestByOrg.set(orgId, {
            userId: row.consultant_user_id as string,
            full_name: null,
            avatar_url: null,
          });
        }
      }
    }

    const userIds = [...new Set([...bestByOrg.values()].map((v) => v.userId))];
    if (userIds.length > 0) {
      const { data: profiles } = await service
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      const profileById = new Map(
        (profiles ?? []).map((p) => [
          p.id as string,
          {
            full_name: p.full_name as string | null,
            avatar_url: p.avatar_url as string | null,
          },
        ]),
      );
      for (const thread of threads.values()) {
        const best = bestByOrg.get(thread.organization_id);
        if (!best) continue;
        thread.counterpart_user_id = best.userId;

        const profile = profileById.get(best.userId);
        if (profile) {
          thread.counterpart_name = profile.full_name;
          thread.counterpart_avatar_url = profile.avatar_url;
        }
      }
    }
  }

  return {
    ok: true as const,
    data: {
      // Con mensajes primero (más reciente arriba); sin mensajes, por nombre.
      threads: [...threads.values()].sort((a, b) => {
        const at = a.last_message?.created_at ?? "";
        const bt = b.last_message?.created_at ?? "";
        if (at && bt) return bt.localeCompare(at);
        if (at) return -1;
        if (bt) return 1;
        return (a.counterpart_name ?? a.organization_name).localeCompare(
          b.counterpart_name ?? b.organization_name,
        );
      }),
    },
  };
}

// --------------------------------------------------------------------------
// Mensajes de un hilo (+ marca como leído para el caller)
// --------------------------------------------------------------------------

export async function listThreadMessages(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  params: { limit?: number | undefined },
) {
  if (
    !context.memberships.some(
      (membership) => membership.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 300);

  const { data, error } = await supabase
    .from("consultant_client_messages")
    .select(MESSAGE_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "thread_messages_load_failed",
      detail: error.message,
    };
  }

  const service = createServiceClient(env);

  const authorIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.author_user_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameById = new Map<string, string | null>();
  if (authorIds.length > 0) {
    const { data: profiles } = await service
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    for (const profile of profiles ?? []) {
      nameById.set(profile.id as string, profile.full_name as string | null);
    }
  }

  const messages = await Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id as string,
      organization_id: row.organization_id as string,
      author_user_id: row.author_user_id as string | null,
      author_kind: row.author_kind as string,
      author_name: row.author_user_id
        ? (nameById.get(row.author_user_id as string) ?? null)
        : null,
      body: (row.body as string) ?? "",
      attachments: await signAttachments(service, row.attachments),
      created_at: row.created_at as string,
    })),
  );

  // Marca el hilo como leído hasta ahora para el caller.
  await service
    .from("consultant_client_message_reads")
    .upsert(
      {
        organization_id: organizationId,
        user_id: context.user.id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    );

  return { ok: true as const, data: { messages } };
}

// --------------------------------------------------------------------------
// Subir un adjunto (base64) -> devuelve el descriptor para adjuntarlo al enviar
// --------------------------------------------------------------------------

export async function uploadThreadAttachment(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const authorKind = resolveThreadAuthorKind(context, organizationId);
  if (!authorKind) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_thread_access_required",
    };
  }

  const filename =
    typeof payload.filename === "string" && payload.filename.trim()
      ? payload.filename.trim().slice(0, 255)
      : "archivo";
  const declaredType =
    typeof payload.content_type === "string" ? payload.content_type : "";
  const raw =
    typeof payload.content_base64 === "string" ? payload.content_base64 : "";
  const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  if (!base64.trim()) {
    return { ok: false as const, statusCode: 400, error: "attachment_empty" };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return { ok: false as const, statusCode: 400, error: "attachment_invalid_base64" };
  }
  if (buffer.length === 0 || buffer.length > ATTACH_MAX_BYTES) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "attachment_too_large",
      message: "Cada archivo debe pesar menos de 15 MB.",
    };
  }

  // Imágenes: sniff por magic bytes. Resto: se confía en content_type contra la
  // allowlist (el bucket lo vuelve a validar en el servidor de storage).
  const imageMime = sniffImageMime(buffer);
  const mime = imageMime ?? declaredType;
  const ext = imageMime ? MARKETING_ASSET_EXT[imageMime] : FILE_EXT[mime];
  if (!mime || !ext) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "attachment_type_unsupported",
      message: "Formato no admitido (imágenes, PDF, Office, texto, CSV o ZIP).",
    };
  }

  const path = `${organizationId}/messages/${crypto.randomUUID()}.${ext}`;
  const supabase = createServiceClient(env);
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: false });
  if (upload.error) {
    return {
      ok: false as const,
      statusCode: 502,
      error: "attachment_upload_failed",
      detail: upload.error.message,
    };
  }

  return {
    ok: true as const,
    data: {
      attachment: {
        storage_path: path,
        filename,
        content_type: mime,
        byte_size: buffer.length,
      },
    },
  };
}

// --------------------------------------------------------------------------
// Enviar un mensaje (texto y/o adjuntos ya subidos)
// --------------------------------------------------------------------------

export async function postThreadMessage(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  payload: { body?: unknown; attachments?: unknown },
) {
  const authorKind = resolveThreadAuthorKind(context, organizationId);
  if (!authorKind) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_thread_access_required",
      message:
        "Necesitas ser miembro del workspace (cliente, consultor o plataforma) para escribir en el hilo.",
    };
  }

  const body =
    typeof payload.body === "string" ? payload.body.trim().slice(0, 8000) : "";

  const attachments: StoredAttachment[] = Array.isArray(payload.attachments)
    ? (payload.attachments as unknown[])
        .slice(0, MAX_ATTACHMENTS)
        .map((item) => {
          const record = (item ?? {}) as Record<string, unknown>;
          return {
            storage_path: String(record.storage_path ?? ""),
            filename: String(record.filename ?? "archivo").slice(0, 255),
            content_type: String(record.content_type ?? ""),
            byte_size: Number(record.byte_size ?? 0),
          };
        })
        // Solo adjuntos subidos a la carpeta de esta org.
        .filter((item) =>
          item.storage_path.startsWith(`${organizationId}/messages/`),
        )
    : [];

  if (!body && attachments.length === 0) {
    return { ok: false as const, statusCode: 400, error: "message_empty" };
  }

  const supabase = createServiceClient(env);
  const { data: inserted, error } = await supabase
    .from("consultant_client_messages")
    .insert({
      organization_id: organizationId,
      author_user_id: context.user.id,
      author_kind: authorKind,
      body,
      attachments,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error || !inserted) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "message_send_failed",
      detail: error?.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant_client_message.sent",
    entityType: "consultant_client_message",
    entityId: inserted.id as string,
    oldData: null,
    newData: { author_kind: authorKind, attachments: attachments.length },
  });

  await supabase
    .from("consultant_client_message_reads")
    .upsert(
      {
        organization_id: organizationId,
        user_id: context.user.id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    );

  return {
    ok: true as const,
    data: {
      message: {
        id: inserted.id as string,
        organization_id: inserted.organization_id as string,
        author_user_id: inserted.author_user_id as string | null,
        author_kind: inserted.author_kind as string,
        author_name: context.profile.full_name ?? null,
        body: (inserted.body as string) ?? "",
        attachments: await signAttachments(supabase, inserted.attachments),
        created_at: inserted.created_at as string,
      },
    },
  };
}
