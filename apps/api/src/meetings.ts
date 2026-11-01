import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { createLogger } from "@e-nora/observability";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  isAuthContextError,
  requireOperationalOrganization,
  resolveAuthContext,
  type AuthContext,
  type AuthContextError,
} from "./auth-context.js";
import { getAssignedConsultant } from "./client-autonomy.js";
import { notify } from "./notify.js";
import {
  buildIcs,
  computeSlots,
  dateKeyInZone,
  isValidTimezone,
  MAX_SLOT_RANGE_DAYS,
  type AvailabilityRule,
  type SlotRules,
} from "./meetings-core.js";

/**
 * Reuniones consultor ↔ cliente: disponibilidad, tipos, reservas y notas de la
 * llamada. Las escrituras van con service role y el chequeo de membership/rol es
 * manual (ADR-0006, regla 7); RLS solo deja leer lo propio.
 */

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const logger = createLogger("meetings");

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

const isStaff = (context: AuthContext) => ["platform_admin", "consultant"].includes(context.profile.platform_role);

type Failure = { ok: false; statusCode: number; error: string; message?: string; detail?: string };
// En un 5xx el tercer argumento es el error de Postgres: va a `detail`, que
// la API registra y no devuelve. En un 4xx es el texto para la persona.
const fail = (statusCode: number, error: string, message?: string): Failure => ({
  ok: false,
  statusCode,
  error,
  ...(message ? (statusCode >= 500 ? { detail: message } : { message }) : {}),
});
const ok = <T>(data: T) => ({ ok: true as const, data });

const DEFAULT_TIMEZONE = "Europe/Madrid";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const KINDS = ["video", "phone", "in_person"] as const;
const CALL_TYPES = ["monthly_review", "onboarding", "strategy", "ad_hoc"];

type SettingsRow = {
  consultant_user_id: string;
  timezone: string;
  slot_step_minutes: number;
  default_location_url: string | null;
};
type TypeRow = SlotRules & {
  id: string;
  consultant_user_id: string;
  name: string;
  description: string | null;
  kind: string;
  call_type: string;
  location_url: string | null;
  is_active: boolean;
  position: number;
};
type MeetingRow = {
  id: string;
  organization_id: string;
  consultant_user_id: string;
  booked_by: string | null;
  meeting_type_id: string | null;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  blocked_until: string;
  status: string;
  location_url: string | null;
  client_note: string | null;
  consultant_note: string | null;
  milestone_id: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  call_id: string | null;
  created_at: string;
};

const MEETING_COLUMNS =
  "id, organization_id, consultant_user_id, booked_by, meeting_type_id, title, kind, starts_at, ends_at, blocked_until, status, location_url, client_note, consultant_note, milestone_id, cancelled_at, cancel_reason, call_id, created_at";

/** Lo que ve el cliente: sin las notas internas del consultor. */
function clientView<T extends MeetingRow>(row: T) {
  const { consultant_note: _note, blocked_until: _blocked, ...visible } = row;
  return visible;
}

/**
 * Estado de la llamada de cada reunión (transcripción y resumen del agente A01).
 * Al cliente solo le dice que hay resumen cuando está PUBLICADO: un borrador
 * pendiente de aprobación del consultor no se anuncia.
 */
export type CallInfo = { id: string; status: string; has_transcript: boolean; summary: "none" | "draft" | "published" };

async function callInfoFor(supabase: SupabaseClient, rows: MeetingRow[], staff: boolean) {
  const ids = [...new Set(rows.map((row) => row.call_id).filter((id): id is string => Boolean(id)))];
  const info = new Map<string, CallInfo>();
  if (!ids.length) return info;
  const [calls, transcripts, summaries] = await Promise.all([
    supabase.from("consulting_calls").select("id, status").in("id", ids),
    supabase.from("call_transcripts").select("call_id").in("call_id", ids).eq("is_current", true),
    supabase.from("call_ai_summaries").select("call_id, status").in("call_id", ids),
  ]);
  const withTranscript = new Set((transcripts.data ?? []).map((row) => row.call_id as string));
  for (const call of calls.data ?? []) {
    const own = (summaries.data ?? []).filter((row) => row.call_id === call.id).map((row) => row.status as string);
    const summary = own.includes("published") ? "published" : own.some((status) => status !== "rejected") && staff ? "draft" : "none";
    info.set(call.id as string, {
      id: call.id as string,
      status: call.status as string,
      has_transcript: staff && withTranscript.has(call.id as string),
      summary,
    });
  }
  return info;
}

async function withCalls<T extends MeetingRow>(supabase: SupabaseClient, rows: T[], staff: boolean) {
  const info = await callInfoFor(supabase, rows, staff);
  return rows.map((row) => ({ ...row, call: (row.call_id && info.get(row.call_id)) || null }));
}

/** La reunión y su llamada van a la par: lo que cambia en una se refleja en la otra. */
async function syncCall(
  supabase: SupabaseClient,
  meeting: MeetingRow,
  change: { startsAt?: string; status?: MeetingRow["status"] },
) {
  if (!meeting.call_id) return;
  const patch: Record<string, unknown> = {};
  if (change.startsAt) patch.scheduled_at = change.startsAt;
  if (change.status === "completed") Object.assign(patch, { status: "held", held_at: meeting.starts_at });
  if (change.status === "cancelled" || change.status === "no_show") patch.status = "cancelled";
  if (change.status === "scheduled") patch.status = "scheduled";
  if (!Object.keys(patch).length) return;
  const { error } = await supabase.from("consulting_calls").update(patch).eq("id", meeting.call_id);
  if (error) logger.error("meeting_call_sync_failed", { meeting_id: meeting.id, error: error.message });
}

function viewFor<T extends MeetingRow>(context: AuthContext, row: T) {
  return isStaff(context) ? row : clientView(row);
}

async function loadSettings(supabase: SupabaseClient, consultantUserId: string): Promise<SettingsRow> {
  const { data } = await supabase
    .from("meeting_settings")
    .select("consultant_user_id, timezone, slot_step_minutes, default_location_url")
    .eq("consultant_user_id", consultantUserId)
    .maybeSingle();
  return (
    (data as SettingsRow | null) ?? {
      consultant_user_id: consultantUserId,
      timezone: DEFAULT_TIMEZONE,
      slot_step_minutes: 30,
      default_location_url: null,
    }
  );
}

// --- Configuración del consultor ---------------------------------------------

const DEFAULT_TYPES = [
  { name: "Revisión mensual", description: "Repaso de resultados y próximos pasos.", duration_minutes: 30, call_type: "monthly_review", position: 0 },
  { name: "Sesión de estrategia", description: "Trabajo a fondo sobre un tema concreto.", duration_minutes: 60, call_type: "strategy", position: 1 },
];

/** Primera vez de un consultor: horario laboral y dos tipos para que no vea la pantalla vacía. */
async function seedDefaults(supabase: SupabaseClient, consultantUserId: string) {
  await supabase.from("meeting_settings").upsert({ consultant_user_id: consultantUserId }, { onConflict: "consultant_user_id" });
  await supabase.from("meeting_availability_rules").insert(
    [1, 2, 3, 4, 5].map((weekday) => ({ consultant_user_id: consultantUserId, weekday, start_time: "09:00", end_time: "14:00" })),
  );
  await supabase.from("meeting_types").insert(DEFAULT_TYPES.map((type) => ({ ...type, consultant_user_id: consultantUserId })));
}

export async function getMeetingConfig(env: ApiEnv, context: AuthContext) {
  if (!isStaff(context)) return fail(403, "meetings_staff_only");
  const supabase = createServiceClient(env);
  const userId = context.user.id;
  const existing = await supabase.from("meeting_settings").select("consultant_user_id").eq("consultant_user_id", userId).maybeSingle();
  if (!existing.data) await seedDefaults(supabase, userId);

  const [settings, rules, blocks, types] = await Promise.all([
    loadSettings(supabase, userId),
    supabase.from("meeting_availability_rules").select("id, weekday, start_time, end_time").eq("consultant_user_id", userId).order("weekday").order("start_time"),
    supabase
      .from("meeting_availability_blocks")
      .select("id, starts_at, ends_at, reason")
      .eq("consultant_user_id", userId)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at"),
    supabase.from("meeting_types").select("*").eq("consultant_user_id", userId).order("position").order("created_at"),
  ]);
  const failed = [rules, blocks, types].find((result) => result.error);
  if (failed?.error) return fail(500, "meetings_config_load_failed", failed.error.message);
  return ok({ settings, rules: rules.data ?? [], blocks: blocks.data ?? [], types: types.data ?? [] });
}

export async function saveMeetingAvailability(
  env: ApiEnv,
  context: AuthContext,
  input: {
    timezone?: string;
    slotStepMinutes?: number;
    defaultLocationUrl?: string | null;
    rules?: Array<{ weekday: number; start: string; end: string }>;
  },
) {
  if (!isStaff(context)) return fail(403, "meetings_staff_only");
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  if (!isValidTimezone(timezone)) return fail(400, "invalid_timezone", "La zona horaria no es válida.");
  const step = input.slotStepMinutes ?? 30;
  if (![10, 15, 20, 30, 60].includes(step)) return fail(400, "invalid_slot_step");
  const rules = input.rules ?? [];
  for (const rule of rules) {
    if (!Number.isInteger(rule.weekday) || rule.weekday < 1 || rule.weekday > 7) return fail(400, "invalid_weekday");
    if (!TIME_RE.test(rule.start) || !TIME_RE.test(rule.end) || rule.end <= rule.start) {
      return fail(400, "invalid_availability_range", "Cada franja debe terminar después de empezar.");
    }
  }
  // Dos franjas del mismo día que se pisan darían huecos duplicados.
  for (const weekday of new Set(rules.map((rule) => rule.weekday))) {
    const day = rules.filter((rule) => rule.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start));
    for (let index = 1; index < day.length; index += 1) {
      if (day[index]!.start < day[index - 1]!.end) return fail(400, "overlapping_availability", "Hay franjas que se solapan el mismo día.");
    }
  }

  const supabase = createServiceClient(env);
  const userId = context.user.id;
  const saved = await supabase.from("meeting_settings").upsert(
    {
      consultant_user_id: userId,
      timezone,
      slot_step_minutes: step,
      default_location_url: input.defaultLocationUrl?.trim() || null,
    },
    { onConflict: "consultant_user_id" },
  );
  if (saved.error) return fail(500, "meetings_settings_save_failed", saved.error.message);
  const cleared = await supabase.from("meeting_availability_rules").delete().eq("consultant_user_id", userId);
  if (cleared.error) return fail(500, "meetings_rules_save_failed", cleared.error.message);
  if (rules.length) {
    const inserted = await supabase.from("meeting_availability_rules").insert(
      rules.map((rule) => ({ consultant_user_id: userId, weekday: rule.weekday, start_time: rule.start, end_time: rule.end })),
    );
    if (inserted.error) return fail(500, "meetings_rules_save_failed", inserted.error.message);
  }
  return getMeetingConfig(env, context);
}

export async function createAvailabilityBlock(
  env: ApiEnv,
  context: AuthContext,
  input: { startsAt?: string; endsAt?: string; reason?: string | null },
) {
  if (!isStaff(context)) return fail(403, "meetings_staff_only");
  const start = Date.parse(input.startsAt ?? "");
  const end = Date.parse(input.endsAt ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return fail(400, "invalid_block_range");
  const { data, error } = await createServiceClient(env)
    .from("meeting_availability_blocks")
    .insert({
      consultant_user_id: context.user.id,
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(end).toISOString(),
      reason: input.reason?.trim().slice(0, 255) || null,
    })
    .select("id, starts_at, ends_at, reason")
    .single();
  if (error) return fail(500, "meetings_block_save_failed", error.message);
  return ok(data);
}

export async function deleteAvailabilityBlock(env: ApiEnv, context: AuthContext, blockId: string) {
  if (!isStaff(context)) return fail(403, "meetings_staff_only");
  const { error } = await createServiceClient(env)
    .from("meeting_availability_blocks")
    .delete()
    .eq("id", blockId)
    .eq("consultant_user_id", context.user.id);
  if (error) return fail(500, "meetings_block_delete_failed", error.message);
  return ok({ deleted: true });
}

type TypeInput = Partial<{
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  maxPerDay: number | null;
  kind: string;
  callType: string;
  locationUrl: string | null;
  isActive: boolean;
}>;

function typeColumns(input: TypeInput) {
  const columns: Record<string, unknown> = {};
  const range = (value: number | undefined, min: number, max: number) =>
    value === undefined ? undefined : Number.isInteger(value) && value >= min && value <= max ? value : null;
  if (input.name !== undefined) columns.name = input.name.trim().slice(0, 120);
  if (input.description !== undefined) columns.description = input.description?.trim() || null;
  if (input.locationUrl !== undefined) columns.location_url = input.locationUrl?.trim() || null;
  if (input.isActive !== undefined) columns.is_active = input.isActive;
  if (input.kind !== undefined) columns.kind = input.kind;
  if (input.callType !== undefined) {
    if (!CALL_TYPES.includes(input.callType)) return { error: "invalid_call_type" };
    columns.call_type = input.callType;
  }
  const checks: Array<[string, number | null | undefined, number, number]> = [
    ["duration_minutes", input.durationMinutes, 10, 240],
    ["buffer_minutes", input.bufferMinutes, 0, 120],
    ["min_notice_hours", input.minNoticeHours, 0, 720],
    ["max_days_ahead", input.maxDaysAhead, 1, 365],
  ];
  for (const [column, value, min, max] of checks) {
    const checked = range(value ?? undefined, min, max);
    if (checked === null) return { error: `invalid_${column}` };
    if (checked !== undefined) columns[column] = checked;
  }
  if (input.maxPerDay !== undefined) {
    if (input.maxPerDay !== null && !(Number.isInteger(input.maxPerDay) && input.maxPerDay >= 1 && input.maxPerDay <= 20)) {
      return { error: "invalid_max_per_day" };
    }
    columns.max_per_day = input.maxPerDay;
  }
  if (columns.kind !== undefined && !(KINDS as readonly string[]).includes(columns.kind as string)) return { error: "invalid_kind" };
  if (columns.name !== undefined && !columns.name) return { error: "name_required" };
  return { columns };
}

export async function saveMeetingType(env: ApiEnv, context: AuthContext, typeId: string | null, input: TypeInput) {
  if (!isStaff(context)) return fail(403, "meetings_staff_only");
  const parsed = typeColumns(input);
  if (parsed.error) return fail(400, parsed.error);
  const supabase = createServiceClient(env);
  if (!typeId) {
    if (!input.name?.trim()) return fail(400, "name_required", "Ponle un nombre al tipo de reunión.");
    const { data, error } = await supabase
      .from("meeting_types")
      .insert({ ...parsed.columns, consultant_user_id: context.user.id })
      .select("*")
      .single();
    if (error) return fail(500, "meetings_type_save_failed", error.message);
    return ok(data);
  }
  const { data, error } = await supabase
    .from("meeting_types")
    .update(parsed.columns!)
    .eq("id", typeId)
    .eq("consultant_user_id", context.user.id)
    .select("*")
    .maybeSingle();
  if (error) return fail(500, "meetings_type_save_failed", error.message);
  if (!data) return fail(404, "meeting_type_not_found");
  return ok(data);
}

export async function deleteMeetingType(env: ApiEnv, context: AuthContext, typeId: string) {
  if (!isStaff(context)) return fail(403, "meetings_staff_only");
  // Las reservas ya hechas se conservan (meeting_type_id pasa a null).
  const { error } = await createServiceClient(env).from("meeting_types").delete().eq("id", typeId).eq("consultant_user_id", context.user.id);
  if (error) return fail(500, "meetings_type_delete_failed", error.message);
  return ok({ deleted: true });
}

// --- Reserva -----------------------------------------------------------------

/** Quién atiende esta organización: el consultor que la lleva (o quien reserva por ella). */
async function resolveConsultant(env: ApiEnv, context: AuthContext, organizationId: string) {
  const supabase = createServiceClient(env);
  if (context.profile.platform_role === "consultant") {
    return { userId: context.user.id, name: null as string | null };
  }
  const assigned = await getAssignedConsultant(supabase, organizationId);
  return assigned ? { userId: assigned.user_id, name: assigned.full_name } : null;
}

export async function getBookingContext(env: ApiEnv, context: AuthContext, organizationId: string) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const consultant = await resolveConsultant(env, context, organizationId);
  if (!consultant) return ok({ consultant: null, timezone: DEFAULT_TIMEZONE, types: [] });
  const supabase = createServiceClient(env);
  const [settings, types, profile] = await Promise.all([
    loadSettings(supabase, consultant.userId),
    supabase
      .from("meeting_types")
      .select("id, name, description, duration_minutes, buffer_minutes, kind, location_url")
      .eq("consultant_user_id", consultant.userId)
      .eq("is_active", true)
      .order("position")
      .order("created_at"),
    consultant.name
      ? Promise.resolve({ data: { full_name: consultant.name } })
      : supabase.from("profiles").select("full_name").eq("id", consultant.userId).maybeSingle(),
  ]);
  if (types.error) return fail(500, "meetings_types_load_failed", types.error.message);
  return ok({
    consultant: { user_id: consultant.userId, full_name: (profile.data?.full_name as string | null) ?? null },
    timezone: settings.timezone,
    types: types.data ?? [],
  });
}

async function availableSlots(
  supabase: SupabaseClient,
  consultantUserId: string,
  type: TypeRow,
  fromDate: string,
  toDate: string,
  excludeMeetingId?: string,
) {
  const settings = await loadSettings(supabase, consultantUserId);
  const windowStart = new Date(Date.parse(`${fromDate}T00:00:00Z`) - 86_400_000).toISOString();
  const windowEnd = new Date(Date.parse(`${toDate}T00:00:00Z`) + 2 * 86_400_000).toISOString();
  const [rules, meetings, blocks] = await Promise.all([
    supabase.from("meeting_availability_rules").select("weekday, start_time, end_time").eq("consultant_user_id", consultantUserId),
    supabase
      .from("meetings")
      .select("id, starts_at, blocked_until")
      .eq("consultant_user_id", consultantUserId)
      .eq("status", "scheduled")
      .gte("blocked_until", windowStart)
      .lte("starts_at", windowEnd),
    supabase
      .from("meeting_availability_blocks")
      .select("starts_at, ends_at")
      .eq("consultant_user_id", consultantUserId)
      .gte("ends_at", windowStart)
      .lte("starts_at", windowEnd),
  ]);
  const error = rules.error ?? meetings.error ?? blocks.error;
  if (error) return { error: error.message };
  const taken = (meetings.data ?? []).filter((meeting) => meeting.id !== excludeMeetingId);
  return {
    timezone: settings.timezone,
    slots: computeSlots({
      rules: (rules.data ?? []) as AvailabilityRule[],
      busy: [
        ...taken.map((meeting) => ({ starts_at: meeting.starts_at as string, ends_at: meeting.blocked_until as string })),
        ...(blocks.data ?? []).map((block) => ({ starts_at: block.starts_at as string, ends_at: block.ends_at as string })),
      ],
      scheduledStarts: taken.map((meeting) => meeting.starts_at as string),
      type,
      timezone: settings.timezone,
      stepMinutes: settings.slot_step_minutes,
      fromDate,
      toDate,
    }),
  };
}

async function loadActiveType(supabase: SupabaseClient, consultantUserId: string, typeId: string) {
  const { data } = await supabase
    .from("meeting_types")
    .select("*")
    .eq("id", typeId)
    .eq("consultant_user_id", consultantUserId)
    .eq("is_active", true)
    .maybeSingle();
  return data as TypeRow | null;
}

export async function listMeetingSlots(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  query: { typeId?: string; from?: string; to?: string; excludeMeetingId?: string },
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  if (!query.typeId || !DATE_RE.test(query.from ?? "") || !DATE_RE.test(query.to ?? "")) return fail(400, "invalid_slot_query");
  if (query.to! < query.from!) return fail(400, "invalid_slot_query");
  const consultant = await resolveConsultant(env, context, organizationId);
  if (!consultant) return fail(409, "no_consultant", "Esta tienda aún no tiene consultor asignado.");
  const supabase = createServiceClient(env);
  const type = await loadActiveType(supabase, consultant.userId, query.typeId);
  if (!type) return fail(404, "meeting_type_not_found");
  const result = await availableSlots(supabase, consultant.userId, type, query.from!, query.to!, query.excludeMeetingId);
  if ("error" in result) return fail(500, "meetings_slots_failed", result.error);
  return ok({ timezone: result.timezone, slots: result.slots, range_days_max: MAX_SLOT_RANGE_DAYS });
}

function formatWhen(startsAt: string, timezone: string) {
  const text = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(startsAt));
  // «Europe/Madrid» -> «hora de Madrid»; solo hace falta si no es la de España.
  const city = timezone.split("/").pop()?.replace(/_/g, " ");
  return timezone === "Europe/Madrid" || !city ? text : `${text} (hora de ${city})`;
}

async function firstName(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return (data?.full_name as string | null)?.trim().split(/\s+/)[0] || "Alguien";
}

/** Avisa a la otra parte: el consultor y los responsables de la tienda, menos quien actúa. */
async function notifyMeeting(
  supabase: SupabaseClient,
  type: "meeting_booked" | "meeting_rescheduled" | "meeting_cancelled",
  meeting: MeetingRow,
  actorUserId: string,
  reason?: string | null,
) {
  try {
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", meeting.organization_id)
      .eq("is_active", true)
      .in("role", ["owner", "manager"]);
    const settings = await loadSettings(supabase, meeting.consultant_user_id);
    await notify(supabase, {
      type,
      organizationId: meeting.organization_id,
      actorUserId,
      recipients: [meeting.consultant_user_id, ...(members ?? []).map((row) => row.user_id as string)],
      data: {
        meetingId: meeting.id,
        who: await firstName(supabase, actorUserId),
        title: meeting.title,
        when: formatWhen(meeting.starts_at, settings.timezone),
        reason: reason ?? null,
      },
    });
  } catch (error) {
    logger.error("meeting_notification_threw", { meeting_id: meeting.id, error: error instanceof Error ? error.message : "unknown_error" });
  }
}

function overlapFailure(error: { code?: string; message: string }) {
  return error.code === "23P01"
    ? fail(409, "slot_taken", "Ese hueco acaba de ocuparse. Elige otro.")
    : fail(500, "meetings_save_failed", error.message);
}

export async function bookMeeting(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: { typeId?: string; startsAt?: string; note?: string | null; milestoneId?: string | null },
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const start = Date.parse(input.startsAt ?? "");
  if (!input.typeId || !Number.isFinite(start)) return fail(400, "invalid_booking");
  const consultant = await resolveConsultant(env, context, organizationId);
  if (!consultant) return fail(409, "no_consultant", "Esta tienda aún no tiene consultor asignado.");
  const supabase = createServiceClient(env);
  const type = await loadActiveType(supabase, consultant.userId, input.typeId);
  if (!type) return fail(404, "meeting_type_not_found");

  // El hueco se recalcula aquí: lo que el navegador dice que está libre no se da por bueno.
  const iso = new Date(start).toISOString();
  const settings = await loadSettings(supabase, consultant.userId);
  const day = dateKeyInZone(new Date(start), settings.timezone);
  const offered = await availableSlots(supabase, consultant.userId, type, day, day);
  if ("error" in offered) return fail(500, "meetings_slots_failed", offered.error);
  if (!offered.slots.includes(iso)) return fail(409, "slot_unavailable", "Ese hueco ya no está disponible. Elige otro.");

  const end = start + type.duration_minutes * 60_000;
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      organization_id: organizationId,
      consultant_user_id: consultant.userId,
      booked_by: context.user.id,
      meeting_type_id: type.id,
      title: type.name,
      kind: type.kind,
      starts_at: iso,
      ends_at: new Date(end).toISOString(),
      blocked_until: new Date(end + type.buffer_minutes * 60_000).toISOString(),
      location_url: type.location_url ?? settings.default_location_url,
      client_note: input.note?.trim().slice(0, 2000) || null,
      milestone_id: input.milestoneId || null,
    })
    .select(MEETING_COLUMNS)
    .single();
  if (error) return overlapFailure(error);
  let meeting = data as unknown as MeetingRow;

  // Su llamada de consultoría: de ahí cuelgan la transcripción, el resumen del
  // agente A01 y las tareas. Si no se pudo crear la reunión sigue siendo válida.
  const call = await supabase
    .from("consulting_calls")
    .insert({
      organization_id: organizationId,
      consultant_user_id: consultant.userId,
      title: type.name,
      call_type: type.call_type,
      scheduled_at: iso,
      created_by: context.user.id,
    })
    .select("id")
    .single();
  if (call.data) {
    await supabase.from("meetings").update({ call_id: call.data.id }).eq("id", meeting.id);
    meeting = { ...meeting, call_id: call.data.id as string };
  } else {
    logger.error("meeting_call_create_failed", { meeting_id: meeting.id, error: call.error?.message });
  }

  await notifyMeeting(supabase, "meeting_booked", meeting, context.user.id);
  const [withCall] = await withCalls(supabase, [meeting], isStaff(context));
  return ok(viewFor(context, withCall!));
}

// --- Lectura y edición -------------------------------------------------------

export async function listMeetings(env: ApiEnv, context: AuthContext, organizationId: string) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const supabase = createServiceClient(env);
  let query = supabase
    .from("meetings")
    .select(MEETING_COLUMNS)
    .eq("organization_id", organizationId)
    .order("starts_at", { ascending: false })
    .limit(200);
  // Un consultor ve solo las suyas (otro consultor de la misma tienda no ve sus notas).
  if (context.profile.platform_role === "consultant") query = query.eq("consultant_user_id", context.user.id);
  const { data, error } = await query;
  if (error) return fail(500, "meetings_load_failed", error.message);
  const rows = await withCalls(supabase, (data ?? []) as unknown as MeetingRow[], isStaff(context));
  return ok({ meetings: rows.map((row) => viewFor(context, row)) });
}

/** Cartera del consultor: sus reuniones de todos los clientes, para ver la semana entera. */
export async function listConsultantMeetings(env: ApiEnv, context: AuthContext) {
  if (!isStaff(context)) return fail(403, "meetings_staff_only");
  const supabase = createServiceClient(env);
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  let query = supabase.from("meetings").select(MEETING_COLUMNS).gte("starts_at", since).order("starts_at").limit(500);
  if (context.profile.platform_role === "consultant") query = query.eq("consultant_user_id", context.user.id);
  const { data, error } = await query;
  if (error) return fail(500, "meetings_load_failed", error.message);
  const rows = (data ?? []) as unknown as MeetingRow[];
  const orgIds = [...new Set(rows.map((row) => row.organization_id))];
  const { data: orgs } = orgIds.length
    ? await supabase.from("organizations").select("id, display_name").in("id", orgIds)
    : { data: [] as Array<{ id: string; display_name: string | null }> };
  const names = new Map((orgs ?? []).map((org) => [org.id as string, org.display_name as string | null]));
  const withCall = await withCalls(supabase, rows, true);
  return ok({ meetings: withCall.map((row) => ({ ...row, organization_name: names.get(row.organization_id) ?? null })) });
}

async function loadMeeting(supabase: SupabaseClient, organizationId: string, meetingId: string) {
  const { data } = await supabase.from("meetings").select(MEETING_COLUMNS).eq("id", meetingId).eq("organization_id", organizationId).maybeSingle();
  return data as unknown as MeetingRow | null;
}

type MeetingPatch = {
  startsAt?: string;
  clientNote?: string | null;
  consultantNote?: string | null;
  status?: string;
  locationUrl?: string | null;
};

export async function updateMeeting(env: ApiEnv, context: AuthContext, organizationId: string, meetingId: string, patch: MeetingPatch) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const supabase = createServiceClient(env);
  const meeting = await loadMeeting(supabase, organizationId, meetingId);
  if (!meeting) return fail(404, "meeting_not_found");
  const staff = isStaff(context);
  if (staff && context.profile.platform_role === "consultant" && meeting.consultant_user_id !== context.user.id) {
    return fail(403, "meeting_not_yours");
  }

  const changes: Record<string, unknown> = {};
  if (patch.clientNote !== undefined) changes.client_note = patch.clientNote?.trim().slice(0, 2000) || null;

  // Notas internas, estado y enlace: solo el consultor. La transcripción y el
  // resumen viven en la llamada (consulting_calls), no aquí.
  const staffOnly = [patch.consultantNote, patch.status, patch.locationUrl];
  if (!staff && staffOnly.some((value) => value !== undefined)) return fail(403, "meetings_staff_only");
  if (patch.consultantNote !== undefined) changes.consultant_note = patch.consultantNote?.trim() || null;
  if (patch.locationUrl !== undefined) changes.location_url = patch.locationUrl?.trim() || null;
  if (patch.status !== undefined) {
    if (!["scheduled", "completed", "no_show"].includes(patch.status)) return fail(400, "invalid_status");
    changes.status = patch.status;
  }

  let rescheduled = false;
  if (patch.startsAt !== undefined) {
    if (meeting.status !== "scheduled") return fail(409, "meeting_not_scheduled", "Solo se pueden mover reuniones pendientes.");
    const start = Date.parse(patch.startsAt);
    if (!Number.isFinite(start)) return fail(400, "invalid_booking");
    const iso = new Date(start).toISOString();
    if (iso !== meeting.starts_at) {
      if (!meeting.meeting_type_id) return fail(409, "meeting_type_missing", "Esta reunión ya no tiene tipo; cancélala y crea otra.");
      const type = await loadActiveType(supabase, meeting.consultant_user_id, meeting.meeting_type_id);
      if (!type) return fail(409, "meeting_type_missing", "Este tipo de reunión ya no está disponible.");
      const settings = await loadSettings(supabase, meeting.consultant_user_id);
      const day = dateKeyInZone(new Date(start), settings.timezone);
      const offered = await availableSlots(supabase, meeting.consultant_user_id, type, day, day, meeting.id);
      if ("error" in offered) return fail(500, "meetings_slots_failed", offered.error);
      if (!offered.slots.includes(iso)) return fail(409, "slot_unavailable", "Ese hueco ya no está disponible. Elige otro.");
      const end = start + type.duration_minutes * 60_000;
      changes.starts_at = iso;
      changes.ends_at = new Date(end).toISOString();
      changes.blocked_until = new Date(end + type.buffer_minutes * 60_000).toISOString();
      rescheduled = true;
    }
  }
  const staffView = isStaff(context);
  if (Object.keys(changes).length === 0) {
    const [same] = await withCalls(supabase, [meeting], staffView);
    return ok(viewFor(context, same!));
  }

  const { data, error } = await supabase.from("meetings").update(changes).eq("id", meetingId).select(MEETING_COLUMNS).single();
  if (error) return overlapFailure(error);
  const updated = data as unknown as MeetingRow;
  await syncCall(supabase, updated, {
    ...(rescheduled ? { startsAt: updated.starts_at } : {}),
    ...(patch.status !== undefined ? { status: patch.status as MeetingRow["status"] } : {}),
  });
  if (rescheduled) await notifyMeeting(supabase, "meeting_rescheduled", updated, context.user.id);
  const [withCall] = await withCalls(supabase, [updated], staffView);
  return ok(viewFor(context, withCall!));
}

export async function cancelMeeting(env: ApiEnv, context: AuthContext, organizationId: string, meetingId: string, reason?: string | null) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const supabase = createServiceClient(env);
  const meeting = await loadMeeting(supabase, organizationId, meetingId);
  if (!meeting) return fail(404, "meeting_not_found");
  if (meeting.status !== "scheduled") return fail(409, "meeting_not_scheduled", "Esta reunión ya no está pendiente.");
  if (context.profile.platform_role === "consultant" && meeting.consultant_user_id !== context.user.id) return fail(403, "meeting_not_yours");
  const { data, error } = await supabase
    .from("meetings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: context.user.id,
      cancel_reason: reason?.trim().slice(0, 500) || null,
    })
    .eq("id", meetingId)
    .select(MEETING_COLUMNS)
    .single();
  if (error) return fail(500, "meetings_save_failed", error.message);
  const cancelled = data as unknown as MeetingRow;
  await syncCall(supabase, cancelled, { status: "cancelled" });
  await notifyMeeting(supabase, "meeting_cancelled", cancelled, context.user.id, cancelled.cancel_reason);
  const [withCall] = await withCalls(supabase, [cancelled], isStaff(context));
  return ok(viewFor(context, withCall!));
}

export async function meetingIcs(env: ApiEnv, context: AuthContext, organizationId: string, meetingId: string) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const meeting = await loadMeeting(createServiceClient(env), organizationId, meetingId);
  if (!meeting) return fail(404, "meeting_not_found");
  return ok(
    buildIcs({
      id: meeting.id,
      title: meeting.title,
      starts_at: meeting.starts_at,
      ends_at: meeting.ends_at,
      status: meeting.status,
      location_url: meeting.location_url,
      description: meeting.client_note,
    }),
  );
}

// --- Rutas -------------------------------------------------------------------

type Helpers = {
  sendAuthFailure: (reply: FastifyReply, error: AuthContextError) => unknown;
  sendServiceFailure: (reply: FastifyReply, result: unknown) => unknown;
};

export function registerMeetingRoutes(app: FastifyInstance, env: ApiEnv, helpers: Helpers) {
  const route =
    (run: (context: AuthContext, request: FastifyRequest) => Promise<{ ok: boolean; data?: unknown }>, status = 200) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return helpers.sendAuthFailure(reply, auth.error);
      const result = await run(auth.context, request);
      if (!result.ok) return helpers.sendServiceFailure(reply, result);
      return reply.code(status).send(result.data);
    };
  const params = (request: FastifyRequest) => request.params as Record<string, string>;
  const body = <T>(request: FastifyRequest) => (request.body ?? {}) as T;
  const query = (request: FastifyRequest) => request.query as Record<string, string | undefined>;
  const org = "/v1/organizations/:organizationId/meetings";

  // Consultor: su disponibilidad, bloqueos y tipos.
  app.get("/v1/consultant/meetings/config", route((context) => getMeetingConfig(env, context)));
  app.put("/v1/consultant/meetings/availability", route((context, request) => saveMeetingAvailability(env, context, body(request))));
  app.post("/v1/consultant/meetings/blocks", route((context, request) => createAvailabilityBlock(env, context, body(request)), 201));
  app.delete("/v1/consultant/meetings/blocks/:blockId", route((context, request) => deleteAvailabilityBlock(env, context, params(request).blockId ?? "")));
  app.post("/v1/consultant/meetings/types", route((context, request) => saveMeetingType(env, context, null, body(request)), 201));
  app.patch("/v1/consultant/meetings/types/:typeId", route((context, request) => saveMeetingType(env, context, params(request).typeId ?? "", body(request))));
  app.delete("/v1/consultant/meetings/types/:typeId", route((context, request) => deleteMeetingType(env, context, params(request).typeId ?? "")));
  app.get("/v1/consultant/meetings", route((context) => listConsultantMeetings(env, context)));

  // Por tienda: reservar, ver, mover, cancelar.
  app.get(`${org}/booking-context`, route((context, request) => getBookingContext(env, context, params(request).organizationId ?? "")));
  app.get(`${org}/slots`, route((context, request) => listMeetingSlots(env, context, params(request).organizationId ?? "", query(request))));
  app.get(org, route((context, request) => listMeetings(env, context, params(request).organizationId ?? "")));
  app.post(org, route((context, request) => bookMeeting(env, context, params(request).organizationId ?? "", body(request)), 201));
  app.patch(`${org}/:meetingId`, route((context, request) =>
    updateMeeting(env, context, params(request).organizationId ?? "", params(request).meetingId ?? "", body(request)),
  ));
  app.post(`${org}/:meetingId/cancel`, route((context, request) =>
    cancelMeeting(env, context, params(request).organizationId ?? "", params(request).meetingId ?? "", body<{ reason?: string }>(request).reason),
  ));
  app.get(`${org}/:meetingId/ics`, async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return helpers.sendAuthFailure(reply, auth.error);
    const result = await meetingIcs(env, auth.context, params(request).organizationId ?? "", params(request).meetingId ?? "");
    if (!result.ok) return helpers.sendServiceFailure(reply, result);
    return reply.header("content-type", "text/calendar; charset=utf-8").send(result.data);
  });
}
