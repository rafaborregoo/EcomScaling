import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  requireOperationalOrganization,
  type AuthContext,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { firstNameOf, notify } from "./notify.js";
import { renderNotification, type NotificationData } from "@e-nora/contracts";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("campaign-review");

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

/**
 * Hilo de revision de una campaña del calendario.
 *
 * Un cliente puede crear su propia campaña aunque tenga consultor. Entonces
 * entra en revision: el consultor recibe un aviso, la lee, deja notas y
 * correcciones (a mano o con IA) y la marca como revisada o pide cambios al
 * cliente. Todo vive en un hilo por campaña; el hilo de cada pieza
 * (marketing_content_draft_notes) se lee junto con este.
 *
 * Esto es la frontera de permisos: quien escribe que, y a quien se avisa.
 */

export type ThreadActor = "consultant" | "client" | "platform";
export type NoteKind = "note" | "correction" | "ai_proposal" | "system";
export type NoteTarget =
  | "subject"
  | "preheader"
  | "body"
  | "cta"
  | "schedule"
  | "audience"
  | "creative"
  | "flow"
  | "other";

export const NOTE_TARGETS: readonly NoteTarget[] = [
  "subject",
  "preheader",
  "body",
  "cta",
  "schedule",
  "audience",
  "creative",
  "flow",
  "other",
];

export type ReviewStatus = "pending" | "changes_requested" | "reviewed";
export type CampaignOrigin = "staff" | "client" | "ai";

export const MAX_NOTE_LENGTH = 4000;

/** Rol del actor en el hilo. `null` = sin acceso al workspace. */
export function resolveThreadActor(
  context: {
    memberships: Array<{ organization_id: string; role: string }>;
    profile: { platform_role: string };
  },
  organizationId: string,
): ThreadActor | null {
  const membership = context.memberships.find(
    (item) => item.organization_id === organizationId,
  );
  if (!membership) return null;
  if (context.profile.platform_role === "platform_admin") return "platform";
  if (context.profile.platform_role === "consultant") return "consultant";
  if (["owner", "manager"].includes(membership.role)) return "client";
  return null;
}

export function isStaffActor(actor: ThreadActor): boolean {
  return actor === "consultant" || actor === "platform";
}

export type NoteInput = {
  kind: NoteKind;
  target: NoteTarget | null;
  visibleToClient: boolean;
};

/**
 * Que puede escribir cada uno. El cliente deja notas visibles; solo el staff
 * corrige un apartado concreto o deja una nota interna. Las propuestas de IA y
 * las lineas de sistema las crea el servidor, nunca llegan por este camino.
 */
export function noteWriteDecision(
  actor: ThreadActor,
  input: NoteInput,
): { ok: true } | { ok: false; error: string } {
  if (input.kind !== "note" && input.kind !== "correction") {
    return { ok: false, error: "note_kind_not_writable" };
  }
  if (input.kind === "correction" && !input.target) {
    return { ok: false, error: "correction_target_required" };
  }
  if (isStaffActor(actor)) return { ok: true };
  if (input.kind === "correction") {
    return { ok: false, error: "correction_staff_only" };
  }
  if (!input.visibleToClient) {
    return { ok: false, error: "internal_note_staff_only" };
  }
  return { ok: true };
}

/**
 * Estado de revision tras lo que hace el cliente. Una nota responde a quien
 * esperaba (cambios pedidos -> vuelve a pendiente); editar lo suyo obliga a
 * volver a revisar, aunque estuviera revisada.
 */
export function reviewStatusAfterClientActivity(
  current: ReviewStatus | null,
  activity: "note" | "edit",
): ReviewStatus | null {
  if (current === null) return null;
  if (activity === "edit") return "pending";
  return current === "changes_requested" ? "pending" : current;
}

export type CampaignEvent =
  | "scheduled"
  | "client_scheduled"
  | "client_created"
  | "client_edited"
  | "client_note"
  | "client_resolved"
  | "consultant_note"
  | "changes_requested"
  | "reviewed";

/** Quien recibe el aviso: el consultor si actua el cliente; el cliente si actua el consultor. */
export function notificationAudience(event: CampaignEvent): "consultants" | "client" {
  return event.startsWith("client_") ? "consultants" : "client";
}

export function buildCampaignNotification(input: {
  event: CampaignEvent;
  organizationId: string;
  organizationName: string | null;
  itemId: string;
  itemTitle: string;
  /** Texto del aviso cuando el motivo lo da quien actua (por ejemplo, cuando sale). */
  detail?: string | undefined;
  /** Nombre de pila del consultor que actua; sin el, «Tu consultor». */
  consultantName?: string | null;
}) {
  // El texto vive en la plantilla del catálogo (ADR-0028); esto solo la
  // presenta con la forma de fila que usan los tests.
  const rendered = renderNotification("campaign_review", campaignData(input), input.organizationId);
  return {
    organization_id: input.organizationId,
    type: "campaign_review" as const,
    title: rendered.title.slice(0, 255),
    message: rendered.message,
    action_url: rendered.url,
    entity_type: rendered.entityType,
    entity_id: rendered.entityId,
  };
}

function campaignData(input: {
  event: CampaignEvent;
  organizationName: string | null;
  itemId: string;
  itemTitle: string;
  detail?: string | undefined;
  consultantName?: string | null;
}): NotificationData["campaign_review"] {
  return {
    event: input.event,
    itemId: input.itemId,
    campaignTitle: input.itemTitle,
    store: input.organizationName,
    consultant: input.consultantName ?? null,
    detail: input.detail ?? null,
  };
}

/**
 * Avisa a quien corresponde. Best-effort: un aviso que falla no puede tumbar
 * la accion que lo origina. Nunca avisa a quien ha hecho la accion.
 */
export async function notifyCampaignEvent(
  supabase: SupabaseClient,
  input: {
    event: CampaignEvent;
    organizationId: string;
    itemId: string;
    itemTitle: string;
    actorUserId: string;
    detail?: string | undefined;
  },
): Promise<number> {
  try {
    const audience = notificationAudience(input.event);
    const recipients = new Set<string>();
    if (audience === "consultants") {
      const { data } = await supabase
        .from("consultant_assignments")
        .select("consultant_user_id")
        .eq("organization_id", input.organizationId)
        .eq("is_active", true);
      for (const row of data ?? []) recipients.add(row.consultant_user_id as string);
    } else {
      const { data } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", input.organizationId)
        .eq("is_active", true)
        .in("role", ["owner", "manager"]);
      for (const row of data ?? []) recipients.add(row.user_id as string);
    }
    recipients.delete(input.actorUserId);
    if (recipients.size === 0) return 0;

    const { data: organization } = await supabase
      .from("organizations")
      .select("display_name")
      .eq("id", input.organizationId)
      .maybeSingle();
    return await notify(supabase, {
      type: "campaign_review",
      organizationId: input.organizationId,
      recipients,
      actorUserId: input.actorUserId,
      data: campaignData({
        event: input.event,
        organizationName: (organization?.display_name as string | null) ?? null,
        itemId: input.itemId,
        itemTitle: input.itemTitle,
        detail: input.detail,
        consultantName: audience === "client" ? await firstNameOf(supabase, input.actorUserId, "Tu consultor") : null,
      }),
    });
  } catch (error) {
    logger.error("campaign_notification_threw", {
      organization_id: input.organizationId,
      event: input.event,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Hilo
// ---------------------------------------------------------------------------

type Failure = { ok: false; statusCode: number; error: string; message?: string; detail?: string };
type Result<T> = { ok: true; data: T } | Failure;

type ItemRow = {
  id: string;
  organization_id: string;
  title: string;
  origin: CampaignOrigin;
  review_status: ReviewStatus | null;
  review_requested_at: string | null;
  reviewed_at: string | null;
  marketing_draft_id: string | null;
  store_id: string | null;
  created_by: string | null;
  is_visible_to_client: boolean;
};

const ITEM_COLUMNS =
  "id, organization_id, title, origin, review_status, review_requested_at, reviewed_at, marketing_draft_id, store_id, created_by, is_visible_to_client";

async function loadItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  actor: ThreadActor,
): Promise<Result<ItemRow>> {
  const { data, error } = await supabase
    .from("campaign_calendar_items")
    .select(ITEM_COLUMNS)
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    return { ok: false, statusCode: 500, error: "campaign_item_load_failed", detail: error.message };
  }
  const item = data as ItemRow | null;
  if (!item || (!isStaffActor(actor) && !item.is_visible_to_client)) {
    return { ok: false, statusCode: 404, error: "campaign_item_not_found" };
  }
  return { ok: true, data: item };
}

export type ThreadNote = {
  id: string;
  source: "campaign" | "draft";
  kind: NoteKind;
  author_kind: string;
  author_user_id: string | null;
  author_name: string | null;
  target: NoteTarget | null;
  body: string;
  visible_to_client: boolean;
  payload: unknown;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
};

function accessFailure(context: AuthContext, organizationId: string): Failure | null {
  const access = requireOperationalOrganization(context, organizationId);
  return access.ok === false ? access : null;
}

export async function listCampaignThread(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
): Promise<
  Result<{
    item: Omit<ItemRow, "created_by" | "is_visible_to_client"> & { store_connection_id: string | null };
    notes: ThreadNote[];
    open_corrections: number;
  }>
> {
  const denied = accessFailure(context, organizationId);
  if (denied) return denied;
  const actor = resolveThreadActor(context, organizationId);
  if (!actor) return { ok: false, statusCode: 403, error: "campaign_thread_access_required" };
  const supabase = createServiceClient(env);
  const item = await loadItem(supabase, organizationId, itemId, actor);
  if (item.ok === false) return item;

  let notesQuery = supabase
    .from("campaign_item_notes")
    .select(
      "id, kind, author_kind, author_user_id, target, body, visible_to_client, payload, resolution, resolved_at, created_at",
    )
    .eq("item_id", itemId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (!isStaffActor(actor)) notesQuery = notesQuery.eq("visible_to_client", true);
  const [notesResult, draftNotesResult] = await Promise.all([
    notesQuery,
    item.data.marketing_draft_id
      ? supabase
          .from("marketing_content_draft_notes")
          .select("id, body, author_user_id, author_kind, created_at")
          .eq("draft_id", item.data.marketing_draft_id)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (notesResult.error) {
    return { ok: false, statusCode: 500, error: "campaign_thread_load_failed", detail: notesResult.error.message };
  }
  const rows = (notesResult.data ?? []) as Array<Record<string, unknown>>;
  const draftRows = (draftNotesResult.data ?? []) as Array<Record<string, unknown>>;

  const authorIds = [
    ...new Set(
      [...rows, ...draftRows]
        .map((row) => row.author_user_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const names = new Map<string, string | null>();
  if (authorIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
    for (const profile of profiles ?? []) names.set(profile.id as string, profile.full_name as string | null);
  }

  const notes: ThreadNote[] = [
    ...rows.map((row) => ({
      id: row.id as string,
      source: "campaign" as const,
      kind: row.kind as NoteKind,
      author_kind: row.author_kind as string,
      author_user_id: (row.author_user_id as string | null) ?? null,
      author_name: row.author_user_id ? (names.get(row.author_user_id as string) ?? null) : null,
      target: (row.target as NoteTarget | null) ?? null,
      body: row.body as string,
      visible_to_client: Boolean(row.visible_to_client),
      payload: row.payload ?? null,
      resolution: (row.resolution as string | null) ?? null,
      resolved_at: (row.resolved_at as string | null) ?? null,
      created_at: row.created_at as string,
    })),
    ...draftRows.map((row) => ({
      id: row.id as string,
      source: "draft" as const,
      kind: "note" as const,
      author_kind: (row.author_kind as string | null) ?? "consultant",
      author_user_id: (row.author_user_id as string | null) ?? null,
      author_name: row.author_user_id ? (names.get(row.author_user_id as string) ?? null) : null,
      target: null,
      body: row.body as string,
      visible_to_client: true,
      payload: null,
      resolution: null,
      resolved_at: null,
      created_at: row.created_at as string,
    })),
  ].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  // La pantalla filtra por la tienda elegida en el selector (una conexion): con el aviso de la
  // campana se llega a una campaña de otra tienda, y hay que saber a cual saltar.
  let storeConnectionId: string | null = null;
  if (item.data.store_id) {
    const { data: store } = await supabase
      .from("shopify_stores")
      .select("connection_id")
      .eq("id", item.data.store_id)
      .maybeSingle();
    storeConnectionId = (store?.connection_id as string | null | undefined) ?? null;
  }
  const { created_by: _createdBy, is_visible_to_client: _visible, ...publicItem } = item.data;
  return {
    ok: true,
    data: {
      item: { ...publicItem, store_connection_id: storeConnectionId },
      notes,
      open_corrections: notes.filter((note) => note.kind === "correction" && !note.resolution).length,
    },
  };
}

export async function addCampaignThreadNote(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
  body: { body?: unknown; kind?: unknown; target?: unknown; visibleToClient?: unknown; fromAi?: unknown },
): Promise<Result<{ note: Record<string, unknown> }>> {
  const denied = accessFailure(context, organizationId);
  if (denied) return denied;
  const actor = resolveThreadActor(context, organizationId);
  if (!actor) return { ok: false, statusCode: 403, error: "campaign_thread_access_required" };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return { ok: false, statusCode: 400, error: "note_body_required" };
  const kind = (body.kind ?? "note") as NoteKind;
  const target =
    typeof body.target === "string" && (NOTE_TARGETS as readonly string[]).includes(body.target)
      ? (body.target as NoteTarget)
      : null;
  if (body.target != null && body.target !== "" && !target) {
    return { ok: false, statusCode: 400, error: "invalid_note_target" };
  }
  const visibleToClient = body.visibleToClient !== false;
  const decision = noteWriteDecision(actor, { kind, target, visibleToClient });
  if (decision.ok === false) {
    return { ok: false, statusCode: kind === "note" || kind === "correction" ? 403 : 400, error: decision.error };
  }

  const supabase = createServiceClient(env);
  const item = await loadItem(supabase, organizationId, itemId, actor);
  if (item.ok === false) return item;

  // `fromAi`: una persona decide dejar en el hilo lo que respondio el asistente. Se
  // firma como 'ai' (el hilo se lee como cronologia y "esto lo dijo la IA" se
  // tiene que distinguir), pero la frontera sigue siendo la persona.
  const authorKind = body.fromAi === true ? "ai" : actor;
  const { data: note, error } = await supabase
    .from("campaign_item_notes")
    .insert({
      organization_id: organizationId,
      item_id: itemId,
      author_user_id: context.user.id,
      author_kind: authorKind,
      kind,
      target,
      body: text.slice(0, MAX_NOTE_LENGTH),
      visible_to_client: isStaffActor(actor) ? visibleToClient : true,
    })
    .select("id, kind, author_kind, target, body, visible_to_client, resolution, created_at")
    .single();
  if (error || !note) {
    return { ok: false, statusCode: 500, error: "campaign_note_save_failed", detail: error?.message };
  }

  if (!isStaffActor(actor)) {
    const next = reviewStatusAfterClientActivity(item.data.review_status, "note");
    if (next !== item.data.review_status) {
      await supabase
        .from("campaign_calendar_items")
        .update({ review_status: next, review_requested_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("organization_id", organizationId);
    }
    await notifyCampaignEvent(supabase, {
      event: "client_note",
      organizationId,
      itemId,
      itemTitle: item.data.title,
      actorUserId: context.user.id,
    });
  } else if (visibleToClient) {
    await notifyCampaignEvent(supabase, {
      event: "consultant_note",
      organizationId,
      itemId,
      itemTitle: item.data.title,
      actorUserId: context.user.id,
    });
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "campaign_note.added",
    entityType: "campaign_calendar_item",
    entityId: itemId,
    oldData: null,
    newData: { note_id: note.id, kind, target, author_kind: authorKind, visible_to_client: visibleToClient },
  });
  return { ok: true, data: { note } };
}

/** Marca una correccion como resuelta: la puede cerrar quien la hizo o quien la recibe. */
export async function resolveCampaignThreadNote(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
  noteId: string,
): Promise<Result<{ id: string; resolved_at: string }>> {
  const denied = accessFailure(context, organizationId);
  if (denied) return denied;
  const actor = resolveThreadActor(context, organizationId);
  if (!actor) return { ok: false, statusCode: 403, error: "campaign_thread_access_required" };
  const supabase = createServiceClient(env);
  const item = await loadItem(supabase, organizationId, itemId, actor);
  if (item.ok === false) return item;
  const { data: note, error } = await supabase
    .from("campaign_item_notes")
    .select("id, kind, visible_to_client, resolution")
    .eq("id", noteId)
    .eq("item_id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { ok: false, statusCode: 500, error: "campaign_note_load_failed", detail: error.message };
  if (!note || (!isStaffActor(actor) && !note.visible_to_client)) {
    return { ok: false, statusCode: 404, error: "campaign_note_not_found" };
  }
  if (note.kind !== "correction") return { ok: false, statusCode: 400, error: "only_corrections_resolve" };
  if (note.resolution) {
    return { ok: true, data: { id: noteId, resolved_at: new Date().toISOString() } };
  }
  const resolvedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("campaign_item_notes")
    .update({ resolution: "resolved", resolved_by: context.user.id, resolved_at: resolvedAt })
    .eq("id", noteId)
    .eq("organization_id", organizationId)
    .is("resolution", null);
  if (updateError) {
    return { ok: false, statusCode: 500, error: "campaign_note_resolve_failed", detail: updateError.message };
  }
  if (!isStaffActor(actor)) {
    await notifyCampaignEvent(supabase, {
      event: "client_resolved",
      organizationId,
      itemId,
      itemTitle: item.data.title,
      actorUserId: context.user.id,
    });
  }
  return { ok: true, data: { id: noteId, resolved_at: resolvedAt } };
}

async function insertSystemNote(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  actorUserId: string,
  body: string,
) {
  await supabase.from("campaign_item_notes").insert({
    organization_id: organizationId,
    item_id: itemId,
    author_user_id: actorUserId,
    author_kind: "system",
    kind: "system",
    body: body.slice(0, MAX_NOTE_LENGTH),
    visible_to_client: true,
  });
}

/** El consultor da por revisada la campaña o pide cambios al cliente. */
export async function setCampaignReviewStatus(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
  input: { status?: unknown; message?: unknown },
): Promise<Result<{ review_status: ReviewStatus }>> {
  const denied = accessFailure(context, organizationId);
  if (denied) return denied;
  const actor = resolveThreadActor(context, organizationId);
  if (!actor || !isStaffActor(actor)) {
    return { ok: false, statusCode: 403, error: "campaign_review_staff_only" };
  }
  if (input.status !== "reviewed" && input.status !== "changes_requested") {
    return { ok: false, statusCode: 400, error: "invalid_review_status" };
  }
  const status: ReviewStatus = input.status;
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const supabase = createServiceClient(env);
  const item = await loadItem(supabase, organizationId, itemId, actor);
  if (item.ok === false) return item;
  if (item.data.review_status === null && item.data.origin !== "client") {
    return { ok: false, statusCode: 409, error: "campaign_not_under_review" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("campaign_calendar_items")
    .update({ review_status: status, reviewed_by: context.user.id, reviewed_at: now })
    .eq("id", itemId)
    .eq("organization_id", organizationId);
  if (error) {
    return { ok: false, statusCode: 500, error: "campaign_review_save_failed", detail: error.message };
  }
  if (message) {
    await supabase.from("campaign_item_notes").insert({
      organization_id: organizationId,
      item_id: itemId,
      author_user_id: context.user.id,
      author_kind: actor,
      kind: "note",
      body: message.slice(0, MAX_NOTE_LENGTH),
      visible_to_client: true,
    });
  }
  await insertSystemNote(
    supabase,
    organizationId,
    itemId,
    context.user.id,
    status === "reviewed" ? "El consultor ha revisado la campaña." : "El consultor pide cambios al cliente.",
  );
  await notifyCampaignEvent(supabase, {
    event: status === "reviewed" ? "reviewed" : "changes_requested",
    organizationId,
    itemId,
    itemTitle: item.data.title,
    actorUserId: context.user.id,
  });
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "campaign_review.set",
    entityType: "campaign_calendar_item",
    entityId: itemId,
    oldData: { review_status: item.data.review_status },
    newData: { review_status: status },
  });
  return { ok: true, data: { review_status: status } };
}

/** El cliente devuelve la campaña a revision (ya ha hecho lo que se le pedia). */
export async function requestCampaignReview(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  itemId: string,
): Promise<Result<{ review_status: ReviewStatus }>> {
  const denied = accessFailure(context, organizationId);
  if (denied) return denied;
  const actor = resolveThreadActor(context, organizationId);
  if (!actor) return { ok: false, statusCode: 403, error: "campaign_thread_access_required" };
  const supabase = createServiceClient(env);
  const item = await loadItem(supabase, organizationId, itemId, actor);
  if (item.ok === false) return item;
  if (item.data.review_status === null) {
    return { ok: false, statusCode: 409, error: "campaign_not_under_review" };
  }
  if (item.data.review_status === "pending") {
    return { ok: true, data: { review_status: "pending" } };
  }
  const { error } = await supabase
    .from("campaign_calendar_items")
    .update({ review_status: "pending", review_requested_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("organization_id", organizationId);
  if (error) {
    return { ok: false, statusCode: 500, error: "campaign_review_request_failed", detail: error.message };
  }
  await insertSystemNote(supabase, organizationId, itemId, context.user.id, "La campaña vuelve a estar pendiente de revisión.");
  await notifyCampaignEvent(supabase, {
    event: "client_edited",
    organizationId,
    itemId,
    itemTitle: item.data.title,
    actorUserId: context.user.id,
  });
  return { ok: true, data: { review_status: "pending" } };
}
