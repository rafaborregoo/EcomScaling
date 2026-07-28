// BE-05 (parte pendiente): workflow de llamadas de consultoria.
// Registro de llamada con enlace Loom/Fathom, transcripcion manual versionada
// (una sola actual), resumen con aprobacion obligatoria antes de publicar al
// cliente, notas internas solo-consultor y tareas derivadas de la llamada.
// Lecturas via RLS (el cliente no ve borradores ni notas internas); escrituras
// via service role + chequeo manual de rol (patron ADR-0006).
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { enqueueMemoryIngestion } from "./memory-ingestion.js";

type ApiEnv = LoadedApiEnv;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

// BE-01 (bug critico de seguridad encontrado y corregido 2026-07-28): la
// version anterior dejaba pasar a CUALQUIER consultant/platform_admin sin
// comprobar `membership` -- `!membership && !isPrivileged` es `false` en
// cuanto `isPrivileged` es true, saltandose el chequeo de organizacion por
// completo. Como los escritores de este archivo (createCall/updateCall/
// saveTranscript/createSummary/decideSummary/addInternalNote/
// createTaskFromCall) usan `createServiceClient` (service_role, sin RLS),
// cualquier consultor de la plataforma podia escribir llamadas/transcripciones
// /resumenes/tareas de una organizacion a la que NO estaba asignado, con solo
// conocer su `organizationId`. `context.memberships` ya incluye las
// organizaciones virtuales de platform_admin (todas) y consultant (solo las
// asignadas, ver auth-context.ts) -- comprobar solo `membership` es correcto
// y suficiente, `isPrivileged` como bypass nunca hacia falta.
function requireOrganizationAccess(context: AuthContext, organizationId: string) {
  const membership = context.memberships.find((item) => item.organization_id === organizationId);

  if (!membership) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  }

  return { ok: true as const, membership };
}

// Gestionar llamadas (crear, transcribir, resumir, publicar) es trabajo del
// consultor: cliente (owner/manager incluidos) solo consume.
function requireConsultant(context: AuthContext) {
  if (!["platform_admin", "consultant"].includes(context.profile.platform_role)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_role_required",
      message: "Solo un consultor o platform admin puede gestionar llamadas.",
    };
  }

  return { ok: true as const };
}

const CALL_TYPES = ["monthly_review", "onboarding", "strategy", "ad_hoc"];
const RECORDING_PROVIDERS = ["loom", "fathom", "meet", "zoom", "other"];

// La URL de grabacion se renderiza como <a href> en el portal: solo http(s),
// nunca javascript:/data: u otros esquemas.
function parseRecordingUrl(value: unknown): { ok: true; url: string | null } | { ok: false } {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: true, url: null };
  }

  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false };
  }
}

export async function listCalls(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireOrganizationAccess(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  // La RLS ya recorta para el cliente: llamadas visibles, resumenes published,
  // cero notas internas. El consultor lo ve todo.
  const { data, error } = await supabase
    .from("consulting_calls")
    .select(
      [
        "id, title, call_type, status, scheduled_at, held_at, duration_minutes",
        "recording_url, recording_provider, is_visible_to_client, created_at",
        "call_transcripts(id, version, source, is_current, content, created_at)",
        "call_ai_summaries(id, summary, key_points, agreed_actions, status, approved_at, published_at, rejection_reason, created_at)",
        "call_internal_notes(id, body, author_user_id, created_at)",
        "call_task_links(id, task_id, tasks(id, title, status, priority))",
      ].join(", "),
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return { ok: false as const, statusCode: 500, error: "calls_load_failed", detail: error.message };
  }

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

  const calls = rows.map((call) => ({
    ...call,
    call_transcripts: ((call.call_transcripts as Array<{ is_current: boolean }>) ?? []).filter(
      (transcript) => transcript.is_current,
    ),
  }));

  return { ok: true as const, data: { organization_id: organizationId, calls } };
}

export async function createCall(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const access = requireOrganizationAccess(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const role = requireConsultant(context);
  if (role.ok === false) {
    return role;
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";

  if (!title) {
    return { ok: false as const, statusCode: 400, error: "title_requerido" };
  }

  const callType = typeof payload.call_type === "string" ? payload.call_type : "monthly_review";

  if (!CALL_TYPES.includes(callType)) {
    return { ok: false as const, statusCode: 400, error: "call_type_invalido" };
  }

  const recordingProvider =
    typeof payload.recording_provider === "string" && payload.recording_provider
      ? payload.recording_provider
      : null;

  if (recordingProvider && !RECORDING_PROVIDERS.includes(recordingProvider)) {
    return { ok: false as const, statusCode: 400, error: "recording_provider_invalido" };
  }

  const recordingUrl = parseRecordingUrl(payload.recording_url);

  if (recordingUrl.ok === false) {
    return { ok: false as const, statusCode: 400, error: "recording_url_invalido" };
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("consulting_calls")
    .insert({
      organization_id: organizationId,
      consultant_user_id: context.user.id,
      title: title.slice(0, 255),
      call_type: callType,
      scheduled_at: typeof payload.scheduled_at === "string" ? payload.scheduled_at : null,
      recording_url: recordingUrl.url,
      recording_provider: recordingProvider,
      is_visible_to_client: payload.is_visible_to_client !== false,
      created_by: context.user.id,
    })
    .select("id, title, status")
    .single();

  if (error || !data) {
    return { ok: false as const, statusCode: 500, error: "call_create_failed", detail: error?.message };
  }

  return { ok: true as const, data };
}

export async function updateCall(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  callId: string,
  payload: Record<string, unknown>,
) {
  const access = requireOrganizationAccess(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const role = requireConsultant(context);
  if (role.ok === false) {
    return role;
  }

  const updates: Record<string, unknown> = {};

  if (typeof payload.status === "string" && ["scheduled", "held", "cancelled"].includes(payload.status)) {
    updates.status = payload.status;
    if (payload.status === "held" && !payload.held_at) {
      updates.held_at = new Date().toISOString();
    }
  }

  if (typeof payload.held_at === "string") {
    updates.held_at = payload.held_at;
  }

  if (typeof payload.duration_minutes === "number" && payload.duration_minutes > 0) {
    updates.duration_minutes = Math.round(payload.duration_minutes);
  }

  if (typeof payload.recording_url === "string") {
    const recordingUrl = parseRecordingUrl(payload.recording_url);

    if (recordingUrl.ok === false) {
      return { ok: false as const, statusCode: 400, error: "recording_url_invalido" };
    }

    updates.recording_url = recordingUrl.url;
  }

  if (
    typeof payload.recording_provider === "string" &&
    RECORDING_PROVIDERS.includes(payload.recording_provider)
  ) {
    updates.recording_provider = payload.recording_provider;
  }

  if (typeof payload.is_visible_to_client === "boolean") {
    updates.is_visible_to_client = payload.is_visible_to_client;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false as const, statusCode: 400, error: "sin_cambios" };
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("consulting_calls")
    .update(updates)
    .eq("id", callId)
    .eq("organization_id", organizationId)
    .select("id, status, held_at")
    .maybeSingle();

  if (error) {
    return { ok: false as const, statusCode: 500, error: "call_update_failed", detail: error.message };
  }

  if (!data) {
    return { ok: false as const, statusCode: 404, error: "call_not_found" };
  }

  return { ok: true as const, data };
}

/**
 * Guarda una transcripcion nueva: la anterior deja de ser actual y la nueva
 * entra como version max+1 (criterio DB-08: una sola transcripcion actual).
 */
export async function saveTranscript(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  callId: string,
  payload: Record<string, unknown>,
) {
  const access = requireOrganizationAccess(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const role = requireConsultant(context);
  if (role.ok === false) {
    return role;
  }

  const content = typeof payload.content === "string" ? payload.content.trim() : "";

  if (!content) {
    return { ok: false as const, statusCode: 400, error: "content_requerido" };
  }

  const source = typeof payload.source === "string" ? payload.source : "manual";

  if (!["manual", "loom", "fathom", "import"].includes(source)) {
    return { ok: false as const, statusCode: 400, error: "source_invalido" };
  }

  const supabase = createServiceClient(env);

  const { data: call } = await supabase
    .from("consulting_calls")
    .select("id")
    .eq("id", callId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!call) {
    return { ok: false as const, statusCode: 404, error: "call_not_found" };
  }

  const { data: latest } = await supabase
    .from("call_transcripts")
    .select("version")
    .eq("call_id", callId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("call_transcripts")
    .update({ is_current: false })
    .eq("call_id", callId)
    .eq("is_current", true);

  const { data, error } = await supabase
    .from("call_transcripts")
    .insert({
      call_id: callId,
      organization_id: organizationId,
      content,
      source,
      version: (latest?.version ?? 0) + 1,
      is_current: true,
      created_by: context.user.id,
    })
    .select("id, version")
    .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "transcript_save_failed",
      detail: error?.message,
    };
  }

  return { ok: true as const, data };
}

export async function createSummary(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  callId: string,
  payload: Record<string, unknown>,
) {
  const access = requireOrganizationAccess(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const role = requireConsultant(context);
  if (role.ok === false) {
    return role;
  }

  const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";

  if (!summary) {
    return { ok: false as const, statusCode: 400, error: "summary_requerido" };
  }

  const supabase = createServiceClient(env);

  const { data: call } = await supabase
    .from("consulting_calls")
    .select("id")
    .eq("id", callId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!call) {
    return { ok: false as const, statusCode: 404, error: "call_not_found" };
  }

  const { data, error } = await supabase
    .from("call_ai_summaries")
    .insert({
      call_id: callId,
      organization_id: organizationId,
      summary,
      key_points: Array.isArray(payload.key_points) ? payload.key_points : null,
      agreed_actions: Array.isArray(payload.agreed_actions) ? payload.agreed_actions : null,
      status: "pending_approval",
      authored_by: context.user.id,
    })
    .select("id, status")
    .single();

  if (error || !data) {
    return { ok: false as const, statusCode: 500, error: "summary_create_failed", detail: error?.message };
  }

  return { ok: true as const, data };
}

/**
 * Aprobar publica (criterio BE-05: nada llega al cliente sin aprobacion);
 * rechazar guarda el motivo y el resumen queda como historico no visible.
 */
export async function decideSummary(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  summaryId: string,
  decision: string | undefined,
  reason: string | undefined,
) {
  const access = requireOrganizationAccess(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const role = requireConsultant(context);
  if (role.ok === false) {
    return role;
  }

  if (!decision || !["approved", "rejected"].includes(decision)) {
    return { ok: false as const, statusCode: 400, error: "invalid_decision" };
  }

  const supabase = createServiceClient(env);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("call_ai_summaries")
    .update(
      decision === "approved"
        ? { status: "published", approved_by: context.user.id, approved_at: now, published_at: now }
        : { status: "rejected", approved_by: context.user.id, approved_at: now, rejection_reason: reason ?? null },
    )
    .eq("id", summaryId)
    .eq("organization_id", organizationId)
    .in("status", ["draft", "pending_approval"])
    .select("id, status, call_id, key_points, summary")
    .maybeSingle();

  if (error) {
    return { ok: false as const, statusCode: 500, error: "summary_decision_failed", detail: error.message };
  }

  if (!data) {
    // AI-01: el UPDATE no afecto ninguna fila, pero eso puede significar dos
    // cosas muy distintas -- el recurso no existe (404 real) o ya fue
    // decidido antes (approved/rejected, reintento o doble clic del
    // consultor). Antes ambos devolvian 404 `pending_summary_not_found`,
    // enganoso para el segundo caso. Una consulta adicional sin el filtro de
    // `status` distingue cual es.
    const { data: existing } = await supabase
      .from("call_ai_summaries")
      .select("status")
      .eq("id", summaryId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!existing) {
      return { ok: false as const, statusCode: 404, error: "pending_summary_not_found" };
    }

    return {
      ok: false as const,
      statusCode: 409,
      error: "summary_already_decided",
      current_status: existing.status,
    };
  }

  // Al aprobar un resumen de A01, sus proposed_tasks se materializan como tareas
  // reales enlazadas a la llamada (unica via por la que la IA escribe dominio,
  // criterio AI-00). Deduplicamos por titulo contra las tareas ya enlazadas.
  let tasksCreated = 0;

  if (decision === "approved") {
    const keyPoints = (data.key_points ?? null) as { proposed_tasks?: Array<Record<string, unknown>> } | null;
    const proposedTasks = Array.isArray(keyPoints?.proposed_tasks) ? keyPoints.proposed_tasks : [];

    if (proposedTasks.length > 0) {
      const { data: existingLinks } = await supabase
        .from("call_task_links")
        .select("tasks(title)")
        .eq("call_id", data.call_id);

      const existingTitles = new Set(
        ((existingLinks ?? []) as Array<{ tasks: { title?: string } | null }>)
          .map((link) => link.tasks?.title?.trim().toLowerCase())
          .filter((title): title is string => Boolean(title)),
      );

      for (const proposed of proposedTasks) {
        const title = typeof proposed.title === "string" ? proposed.title.trim() : "";

        if (!title || existingTitles.has(title.toLowerCase())) {
          continue;
        }

        const priority =
          typeof proposed.priority === "string" &&
          ["low", "medium", "high", "urgent"].includes(proposed.priority)
            ? proposed.priority
            : "medium";

        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({
            organization_id: organizationId,
            source: "consulting_call",
            priority,
            title: title.slice(0, 255),
            description: typeof proposed.description === "string" ? proposed.description : null,
            created_by: context.user.id,
            metadata: { call_summary_id: summaryId },
          })
          .select("id")
          .single();

        if (taskError || !task) {
          continue;
        }

        await supabase.from("call_task_links").insert({
          organization_id: organizationId,
          call_id: data.call_id,
          task_id: task.id,
          created_by: context.user.id,
        });

        existingTitles.add(title.toLowerCase());
        tasksCreated += 1;
      }
    }
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: decision === "approved" ? "calls.approve_summary" : "calls.reject_summary",
    entityType: "call_ai_summary",
    entityId: summaryId,
    newData: { status: data.status, reason: reason ?? null, tasks_created: tasksCreated },
  });

  // AI-07: solo un resumen PUBLICADO (aprobado y visible al cliente) entra a
  // la memoria del copiloto; uno rechazado no aporta conocimiento reutilizable.
  // Encolar nunca bloquea ni puede fallar esta respuesta (outbox asincrono).
  if (decision === "approved" && data.summary) {
    await enqueueMemoryIngestion(env, {
      organizationId,
      storeId: null,
      sourceType: "call_summary",
      sourceEntityType: "call_ai_summary",
      sourceEntityId: summaryId,
      sourceActorId: context.user.id,
      audience: "client_visible",
      origin: "human_approved_ai",
      authority: "contextual",
      title: `Resumen de llamada publicado (${data.call_id})`,
      content: data.summary,
    });
  }

  return { ok: true as const, data: { id: data.id, status: data.status, tasks_created: tasksCreated } };
}

export async function addInternalNote(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  callId: string,
  body: unknown,
) {
  const access = requireOrganizationAccess(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const role = requireConsultant(context);
  if (role.ok === false) {
    return role;
  }

  const noteBody = typeof body === "string" ? body.trim() : "";

  if (!noteBody) {
    return { ok: false as const, statusCode: 400, error: "body_requerido" };
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("call_internal_notes")
    .insert({
      organization_id: organizationId,
      call_id: callId,
      author_user_id: context.user.id,
      body: noteBody,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false as const, statusCode: 500, error: "note_create_failed", detail: error?.message };
  }

  return { ok: true as const, data };
}

/** Crea una tarea acordada en la llamada (source consulting_call) y la enlaza. */
export async function createTaskFromCall(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  callId: string,
  payload: Record<string, unknown>,
) {
  const access = requireOrganizationAccess(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const role = requireConsultant(context);
  if (role.ok === false) {
    return role;
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";

  if (!title) {
    return { ok: false as const, statusCode: 400, error: "title_requerido" };
  }

  const priority =
    typeof payload.priority === "string" && ["low", "medium", "high", "urgent"].includes(payload.priority)
      ? payload.priority
      : "medium";

  const supabase = createServiceClient(env);

  const { data: call } = await supabase
    .from("consulting_calls")
    .select("id")
    .eq("id", callId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!call) {
    return { ok: false as const, statusCode: 404, error: "call_not_found" };
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      source: "consulting_call",
      priority,
      title: title.slice(0, 255),
      description: typeof payload.description === "string" ? payload.description : null,
      due_at: typeof payload.due_at === "string" ? payload.due_at : null,
      created_by: context.user.id,
    })
    .select("id, title")
    .single();

  if (taskError || !task) {
    return { ok: false as const, statusCode: 500, error: "task_create_failed", detail: taskError?.message };
  }

  const { error: linkError } = await supabase.from("call_task_links").insert({
    organization_id: organizationId,
    call_id: callId,
    task_id: task.id,
    created_by: context.user.id,
  });

  if (linkError) {
    return { ok: false as const, statusCode: 500, error: "task_link_failed", detail: linkError.message };
  }

  return { ok: true as const, data: { task_id: task.id, title: task.title } };
}
