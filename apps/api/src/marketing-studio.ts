import nodemailer from "nodemailer";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { sanitizeMarketingEmailHtml, reviewMarketingEmailHtml } from "./marketing-email-safety.js";
import {
  createUserScopedClient,
  requireOperationalOrganization,
  type AuthContext,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { buildMarketingTemplateProfile } from "./marketing-template-profile.js";

/**
 * Estudio de contenido (Marketing → Crear): guardar piezas mientras se
 * editan, mandar una prueba a tu correo y buscar productos para los bloques.
 *
 * Una pieza es un borrador de `marketing_content_drafts` como los demás: la
 * revisión, la aprobación y la subida a Klaviyo o a Meta siguen su camino de
 * siempre. Lo nuevo es que el diseño completo del estudio viaja en
 * `request.design` y que guardar no manda a revisión: eso lo decide la
 * persona con «Enviar a revisión».
 */

const CHANNELS = {
  email: { channel: "email_klaviyo", content_type: "campaign" },
  popup: { channel: "email_klaviyo", content_type: "popup" },
  meta: { channel: "meta_ads", content_type: "campaign" },
  ig: { channel: "instagram_organic", content_type: "campaign" },
} as const;

export type StudioChannel = keyof typeof CHANNELS;

const DRAFT_SELECT =
  "id, status, version, content_type, request, template_name, subject, preheader, from_name, reply_to, plain_text, html, blocks, personalization_tokens, created_at, updated_at";

export const studioPieceSchema = z
  .object({
    channel: z.enum(["email", "popup", "meta", "ig"]),
    name: z.string().trim().max(160).default(""),
    subject: z.string().trim().max(255).default(""),
    preheader: z.string().trim().max(255).default(""),
    from_name: z.string().trim().max(120).default(""),
    reply_to: z.string().trim().max(255).nullable().default(null),
    design: z.record(z.string(), z.unknown()),
    html: z.string().max(250_000),
    plain_text: z.string().max(100_000).default(""),
    blocks: z.array(z.unknown()).max(200).default([]),
    personalization_tokens: z.array(z.string().max(120)).max(100).default([]),
    store_id: z.string().uuid().nullable().optional(),
    expected_version: z.number().int().positive().optional(),
    operation_audit: z.object({
      request_id: z.string().uuid().nullable().optional(),
      source: z.enum(["ai", "manual", "undo", "redo"]).default("manual"),
      accepted_operations: z.array(z.record(z.string(), z.unknown())).max(12).default([]),
      rejected_operations: z.array(z.record(z.string(), z.unknown())).max(12).default([]),
    }).optional(),
  })
  .strict();

export type StudioPiece = z.infer<typeof studioPieceSchema>;

type Failure = { ok: false; statusCode: number; error: string; message?: string; detail?: string };

function serviceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function access(context: AuthContext, organizationId: string): Failure | null {
  const membership = requireOperationalOrganization(context, organizationId);
  if (membership.ok === false) return membership;
  const allowed =
    ["platform_admin", "consultant"].includes(context.profile.platform_role) ||
    ["owner", "manager"].includes(membership.membership.role);
  return allowed ? null : { ok: false, statusCode: 403, error: "marketing_access_required" };
}
export const studioAccess = access;

/**
 * Lo que se guarda en la fila. Pura para poder probarla: valida el reply-to,
 * limpia el HTML y decide canal y tipo a partir del canal del estudio.
 */
export function studioDraftFields(piece: StudioPiece): { ok: true; fields: Record<string, unknown> } | Failure {
  const designSize = JSON.stringify(piece.design).length;
  if (designSize > 400_000) {
    return { ok: false, statusCode: 413, error: "studio_design_too_large", message: "La pieza es demasiado grande para guardarla." };
  }
  if ((piece.design as { version?: unknown }).version !== 2) {
    return { ok: false, statusCode: 400, error: "studio_design_version_invalid" };
  }
  const replyTo = piece.reply_to?.trim() || null;
  if (replyTo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo)) {
    return { ok: false, statusCode: 400, error: "reply_to_invalido", message: "La dirección de respuesta no es un email válido." };
  }
  const html = sanitizeMarketingEmailHtml(piece.html);
  if (!html.trim()) {
    return { ok: false, statusCode: 400, error: "diseno_vacio", message: "La pieza todavía no tiene contenido." };
  }
  const target = CHANNELS[piece.channel];
  const name = piece.name || piece.subject || "Pieza sin nombre";
  const plainText = piece.plain_text.trim() || name;
  return {
    ok: true,
    fields: {
      content_type: target.content_type,
      template_name: name.slice(0, 160),
      subject: (piece.subject || name).slice(0, 255),
      preheader: piece.preheader,
      from_name: piece.from_name,
      reply_to: replyTo,
      html,
      plain_text: plainText,
      blocks: piece.blocks,
      personalization_tokens: [...new Set(piece.personalization_tokens.map((token) => token.trim()).filter(Boolean))],
      request_patch: {
        channel: target.channel,
        source: "content_studio",
        design: piece.design,
        template_profile:
          piece.channel === "email"
            ? buildMarketingTemplateProfile({ html, blocks: piece.blocks, plainText })
            : null,
      },
    },
  };
}

/**
 * La tienda de la pieza se guarda como id de conexión, igual que en los
 * borradores que genera la IA (request.store_id). Solo se acepta si la
 * conexión es de una tienda de esta organización.
 */
async function storeIdFor(env: LoadedApiEnv, organizationId: string, connectionId: string | null | undefined) {
  if (!connectionId) return { ok: true as const, storeId: null };
  const { data, error } = await serviceClient(env)
    .from("shopify_stores")
    .select("connection_id")
    .eq("organization_id", organizationId)
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) return { ok: false as const, statusCode: 503, error: "studio_store_resolution_failed" };
  if (!data?.connection_id) return { ok: false as const, statusCode: 409, error: "studio_store_invalid", message: "La tienda seleccionada ya no está disponible. Selecciona una tienda activa." };
  return { ok: true as const, storeId: data.connection_id };
}

export async function createStudioDraft(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  payload: unknown,
) {
  const denied = access(context, organizationId);
  if (denied) return denied;
  const parsed = studioPieceSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, statusCode: 400, error: "invalid_studio_piece", detail: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  }
  const built = studioDraftFields(parsed.data);
  if (!built.ok) return built;
  const { request_patch: requestPatch, ...fields } = built.fields as Record<string, unknown> & { request_patch: Record<string, unknown> };
  const resolvedStore = await storeIdFor(env, organizationId, parsed.data.store_id);
  if (!resolvedStore.ok) return resolvedStore;

  const supabase = serviceClient(env);
  const { data, error } = await supabase
    .from("marketing_content_drafts")
    .insert({
      ...fields,
      organization_id: organizationId,
      created_by: context.user.id,
      status: "draft",
      request: { ...requestPatch, ...(resolvedStore.storeId ? { store_id: resolvedStore.storeId } : {}) },
      brand_colors: {},
      verbatim_texts: [],
      summary: "Pieza creada en el estudio de contenido.",
      purpose: "Pieza creada en el estudio de contenido.",
      audience: "",
      locale: "es",
      tone: "brand",
      compliance_notes: [],
      sources: [],
      confidence: "high",
      warnings: [],
    })
    .select(DRAFT_SELECT)
    .single();
  if (error || !data) {
    return { ok: false as const, statusCode: 500, error: "marketing_draft_persist_failed", detail: error?.message };
  }
  let auditWarning: string | undefined;
  if (parsed.data.operation_audit && parsed.data.operation_audit.accepted_operations.length + parsed.data.operation_audit.rejected_operations.length > 0) {
    const { error: auditError } = await supabase.from("marketing_studio_operation_audits").insert({
      organization_id: organizationId, draft_id: data.id, actor_user_id: context.user.id,
      request_id: parsed.data.operation_audit.request_id ?? null,
      base_version: 1, final_version: Number(data.version ?? 1), source: parsed.data.operation_audit.source,
      accepted_operations: parsed.data.operation_audit.accepted_operations,
      rejected_operations: parsed.data.operation_audit.rejected_operations,
    });
    if (auditError) auditWarning = "marketing_draft_audit_unavailable";
  }
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "marketing.studio_create",
    entityType: "marketing_content_draft",
    entityId: data.id,
    newData: { channel: parsed.data.channel },
  });
  return { ok: true as const, data: { draft: data, ...(auditWarning ? { audit_warning: auditWarning } : {}) } };
}

/**
 * Autoguardado. Guardar no manda a revisión; pero si la pieza ya estaba en
 * revisión o aprobada, cambiarla la devuelve a borrador: lo aprobado era otra
 * cosa. Una pieza publicada no se toca: se duplica.
 */
export async function updateStudioDraft(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  draftId: string,
  payload: unknown,
) {
  const denied = access(context, organizationId);
  if (denied) return denied;
  const parsed = studioPieceSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, statusCode: 400, error: "invalid_studio_piece", detail: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  }
  const built = studioDraftFields(parsed.data);
  if (!built.ok) return built;

  const supabase = serviceClient(env);
  const { data: current, error: loadError } = await supabase
    .from("marketing_content_drafts")
    .select("id, status, version, request, agent_output_id")
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (loadError) return { ok: false as const, statusCode: 500, error: "marketing_draft_load_failed" };
  if (!current) return { ok: false as const, statusCode: 404, error: "marketing_draft_not_found" };
  if (current.status === "published") {
    return { ok: false as const, statusCode: 409, error: "marketing_draft_published", message: "Esta pieza ya se publicó. Duplícala para cambiarla." };
  }

  const { request_patch: requestPatch, ...fields } = built.fields as Record<string, unknown> & { request_patch: Record<string, unknown> };
  const requestBase = current.request && typeof current.request === "object" ? (current.request as Record<string, unknown>) : {};
  if (requestBase.channel && requestBase.channel !== requestPatch.channel) {
    return { ok: false as const, statusCode: 409, error: "studio_channel_mismatch", message: "Esta pieza es de otro canal." };
  }
  if (parsed.data.expected_version !== undefined && parsed.data.expected_version !== Number(current.version ?? 1)) {
    return { ok: false as const, statusCode: 409, error: "marketing_draft_update_conflict", message: "La pieza cambió en otra ventana. Recarga o copia tus cambios antes de guardar." };
  }
  const leavesReview = current.status !== "draft";
  const nextVersion = Number(current.version ?? 1) + 1;
  const resolvedStore = await storeIdFor(env, organizationId, parsed.data.store_id);
  if (!resolvedStore.ok) return resolvedStore;
  const effectiveStoreId = parsed.data.store_id === undefined ? (requestBase.store_id as string | undefined) : resolvedStore.storeId;
  const nextRequest = { ...requestBase, ...requestPatch, ...(effectiveStoreId ? { store_id: effectiveStoreId } : {}) };
  const { data: saved, error } = await supabase.rpc("save_a11_studio_draft", {
    p_organization_id: organizationId,
    p_draft_id: draftId,
    p_actor_user_id: context.user.id,
    p_expected_version: Number(current.version ?? 1),
    p_fields: fields,
    p_request: nextRequest,
  });
  if (error) {
    if (error.message.includes("A11_MARKETING_DRAFT_SAVE_STALE")) return { ok: false as const, statusCode: 409, error: "marketing_draft_update_conflict" };
    return { ok: false as const, statusCode: 500, error: "marketing_draft_update_failed", detail: error.message };
  }
  if (!saved || typeof saved !== "object") return { ok: false as const, statusCode: 409, error: "marketing_draft_update_conflict" };
  const data = saved as Record<string, unknown>;
  const operationAudit = parsed.data.operation_audit;
  if (operationAudit && operationAudit.accepted_operations.length + operationAudit.rejected_operations.length > 0) {
    const { error: auditError } = await supabase.from("marketing_studio_operation_audits").insert({
      organization_id: organizationId,
      draft_id: draftId,
      actor_user_id: context.user.id,
      request_id: operationAudit.request_id ?? null,
      base_version: Number(current.version ?? 1),
      final_version: Number(data.version ?? nextVersion),
      source: operationAudit.source,
      accepted_operations: operationAudit.accepted_operations,
      rejected_operations: operationAudit.rejected_operations,
    });
    if (auditError) {
      return { ok: true as const, data: { draft: data, returned_to_draft: leavesReview, audit_warning: "marketing_draft_audit_unavailable" } };
    }
  }

  if (leavesReview) {
    // Queda constancia de la versión que se había revisado antes de cambiarla.
    await recordAuditLog(supabase, {
      organizationId,
      actorUserId: context.user.id,
      action: "marketing.studio_edit_after_review",
      entityType: "marketing_content_draft",
      entityId: draftId,
      oldData: { status: current.status },
      newData: { status: "draft", version: nextVersion },
    });
  }
  return { ok: true as const, data: { draft: data, returned_to_draft: leavesReview } };
}

// ---------------------------------------------------------------------------
// Prueba a tu correo
// ---------------------------------------------------------------------------

const SAMPLE_VALUES: Record<string, string> = {
  first_name: "Lucía",
  last_name: "García",
  email: "lucia@example.com",
  "location.city": "Valencia",
};

/**
 * Klaviyo sustituye sus etiquetas al enviar; en una prueba por SMTP hay que
 * hacerlo aquí o llegarían literales. Los datos son de una persona inventada.
 */
export function fillKlaviyoTags(html: string, organizationName: string): string {
  return html
    .replace(/\{%\s*unsubscribe(?:\s+'([^']*)')?\s*%\}/g, (_match, label: string | undefined) => `<a href="#" style="color:inherit">${label ?? "Darse de baja"}</a>`)
    .replace(/\{%\s*manage_preferences(?:\s+'([^']*)')?\s*%\}/g, (_match, label: string | undefined) => `<a href="#" style="color:inherit">${label ?? "Preferencias"}</a>`)
    .replace(/\{%[^%]*%\}/g, "")
    .replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|\s*default\s*:\s*(?:"([^"]*)"|'([^']*)'))?[^}]*\}\}/g, (_match, key: string, dq?: string, sq?: string) => {
      if (key === "organization.name") return organizationName;
      if (key === "organization.full_address") return "Dirección de la tienda";
      return SAMPLE_VALUES[key] ?? dq ?? sq ?? "";
    });
}

export async function sendStudioTest(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  payload: unknown,
) {
  const denied = access(context, organizationId);
  if (denied) return denied;
  const parsed = z
    .object({ subject: z.string().trim().min(1).max(255), html: z.string().min(1).max(250_000) })
    .safeParse(payload);
  if (!parsed.success) return { ok: false as const, statusCode: 400, error: "invalid_studio_test" };
  const to = context.user.email;
  if (!to) return { ok: false as const, statusCode: 400, error: "studio_test_no_email", message: "Tu usuario no tiene email." };
  if (!env.SMTP_USER || !env.SMTP_BREVO) {
    return { ok: false as const, statusCode: 503, error: "smtp_not_configured", message: "El envío de correo no está configurado en el servidor." };
  }
  const organizationName =
    context.memberships.find((item) => item.organization_id === organizationId)?.organization?.display_name ?? "Tu tienda";
  const html = fillKlaviyoTags(sanitizeMarketingEmailHtml(parsed.data.html), organizationName);
  const subject = fillKlaviyoTags(parsed.data.subject, organizationName);
  const port = env.SMTP_PORT ?? 587;
  try {
    await nodemailer
      .createTransport({
        host: env.SMTP_HOST ?? "smtp-relay.brevo.com",
        port,
        secure: port === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_BREVO },
      })
      .sendMail({
        from: `"${(env.SMTP_FROM_NAME ?? "E-NORA").replaceAll('"', "")}" <${env.SMTP_FROM_EMAIL ?? env.SMTP_USER}>`,
        to,
        subject: `[Prueba] ${subject}`,
        html,
      });
  } catch (error) {
    return { ok: false as const, statusCode: 502, error: "studio_test_send_failed", message: "No se pudo enviar la prueba.", detail: error instanceof Error ? error.message : undefined };
  }
  return { ok: true as const, data: { sent_to: to } };
}

// ---------------------------------------------------------------------------
// Productos para los bloques
// ---------------------------------------------------------------------------

export async function listStudioProducts(
  env: LoadedApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  query: { source?: string; q?: string; connection_id?: string },
) {
  const denied = access(context, organizationId);
  if (denied) return denied;
  const source = ["best", "new", "search"].includes(query.source ?? "") ? query.source! : "best";
  const search = query.q?.trim().slice(0, 80).replace(/[%_\\]/g, (char) => `\\${char}`) || null;
  const client = createUserScopedClient(env, authorization.slice("Bearer ".length));
  let storeId: string | null = null;
  if (query.connection_id) {
    const { data: store } = await client
      .from("shopify_stores")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("connection_id", query.connection_id)
      .maybeSingle();
    if (!store) return { ok: false as const, statusCode: 409, error: "studio_store_invalid", message: "La tienda seleccionada ya no está disponible." };
    storeId = store?.id ?? null;
  } else {
    // Sin selección no se consulta la RPC con NULL: NULL significa todas las tiendas.
    return { ok: true as const, data: { products: [] } };
  }
  const { data, error } = await client.rpc("marketing_studio_products", {
    target_organization_id: organizationId,
    target_store_id: storeId,
    source,
    search,
    max_rows: source === "search" ? 24 : 12,
  });
  if (error) return { ok: false as const, statusCode: 500, error: "studio_products_failed", detail: error.message };
  return { ok: true as const, data: { products: data ?? [] } };
}
