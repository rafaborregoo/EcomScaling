import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { requireOperationalOrganization, type AuthContext } from "./auth-context.js";
import { isStaffActor, resolveThreadActor } from "./campaign-review.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type Failure = { ok: false; statusCode: number; error: string; detail?: string };
type Result<T> = { ok: true; data: T } | Failure;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

/**
 * Acciones rápidas de Campañas (CRUD del consultor).
 *
 * Quién ve qué: `me` solo su dueño, en todos sus clientes; `client` el equipo
 * en esa organización; `shared` además el cliente, como atajo para pedir algo.
 * Escribe solo el staff; el cliente solo lee las compartidas. Usar una acción
 * no tiene endpoint propio: la pantalla crea la campaña con la ruta de siempre
 * (si la usa el cliente, entra en revisión y el consultor recibe el aviso).
 */
export const QUICK_ACTION_LIMITS = { name: 32, brief: 2000, bar: 8 } as const;

const VISIBILITIES = ["me", "client", "shared"] as const;
const KINDS = ["plan", "ia"] as const;
const CHANNELS = ["email", "meta"] as const;
const WHENS = ["dow", "off"] as const;
const ICONS = ["mail", "repeat", "cart", "bell", "tag", "mega", "spark"] as const;

export type QuickAction = {
  id: string;
  visibility: (typeof VISIBILITIES)[number];
  name: string;
  icon: (typeof ICONS)[number];
  kind: (typeof KINDS)[number];
  channel: (typeof CHANNELS)[number];
  audience: string;
  when_kind: (typeof WHENS)[number];
  dow: number;
  offset_days: number;
  brief: string;
  position: number;
  mine: boolean;
};

export type QuickActionInput = Partial<{
  visibility: string;
  name: string;
  icon: string;
  kind: string;
  channel: string;
  audience: string;
  whenKind: string;
  dow: number;
  offsetDays: number;
  brief: string;
}>;

const COLUMNS =
  "id, owner_id, organization_id, visibility, name, icon, kind, channel, audience, when_kind, dow, offset_days, brief, position";

type Row = Omit<QuickAction, "mine"> & { owner_id: string; organization_id: string | null };

const isOneOf = (options: readonly string[], value: unknown): value is string =>
  typeof value === "string" && options.includes(value);

/** Valida una entrada completa o parcial; devuelve solo los campos presentes, ya normalizados. */
export function parseQuickActionInput(input: QuickActionInput): Result<Record<string, unknown>> {
  const bad = (error: string): Failure => ({ ok: false, statusCode: 400, error });
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) return bad("quick_action_name_required");
    if (name.length > QUICK_ACTION_LIMITS.name) return bad("quick_action_name_too_long");
    out.name = name;
  }
  const enums: Array<[keyof QuickActionInput, string, readonly string[]]> = [
    ["visibility", "visibility", VISIBILITIES],
    ["icon", "icon", ICONS],
    ["kind", "kind", KINDS],
    ["channel", "channel", CHANNELS],
    ["whenKind", "when_kind", WHENS],
  ];
  for (const [key, column, options] of enums) {
    if (input[key] === undefined) continue;
    if (!isOneOf(options, input[key])) return bad(`quick_action_${column}_invalid`);
    out[column] = input[key];
  }
  if (input.audience !== undefined) {
    const audience = String(input.audience).trim();
    if (!audience || audience.length > 120) return bad("quick_action_audience_invalid");
    out.audience = audience;
  }
  if (input.dow !== undefined) {
    if (!Number.isInteger(input.dow) || input.dow < 0 || input.dow > 6) return bad("quick_action_dow_invalid");
    out.dow = input.dow;
  }
  if (input.offsetDays !== undefined) {
    if (!Number.isInteger(input.offsetDays) || input.offsetDays < 0 || input.offsetDays > 120) {
      return bad("quick_action_offset_invalid");
    }
    out.offset_days = input.offsetDays;
  }
  if (input.brief !== undefined) {
    const brief = String(input.brief).trim();
    if (brief.length > QUICK_ACTION_LIMITS.brief) return bad("quick_action_brief_too_long");
    out.brief = brief;
  }
  return { ok: true, data: out };
}

function toAction(row: Row, userId: string): QuickAction {
  const { owner_id, organization_id: _organization, ...rest } = row;
  return { ...rest, mine: owner_id === userId };
}

function staffContext(context: AuthContext, organizationId: string): Result<{ staff: boolean }> {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  const actor = resolveThreadActor(context, organizationId);
  if (!actor) return { ok: false, statusCode: 403, error: "quick_actions_access_required" };
  return { ok: true, data: { staff: isStaffActor(actor) } };
}

/** Solo escribe el staff: devuelve el fallo si el actor no lo es. */
function staffOnly(context: AuthContext, organizationId: string): Failure | null {
  const scope = staffContext(context, organizationId);
  if (scope.ok === false) return scope;
  return scope.data.staff ? null : { ok: false, statusCode: 403, error: "quick_actions_staff_only" };
}

/** Una acción que el actor puede editar: la suya, o una del cliente si es staff de él. */
async function loadEditable(
  supabase: SupabaseClient,
  context: AuthContext,
  organizationId: string,
  id: string,
): Promise<Result<Row>> {
  const { data, error } = await supabase.from("campaign_quick_actions").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return { ok: false, statusCode: 500, error: "quick_action_load_failed", detail: error.message };
  const row = data as Row | null;
  const visible =
    row && (row.visibility === "me" ? row.owner_id === context.user.id : row.organization_id === organizationId);
  if (!row || !visible) return { ok: false, statusCode: 404, error: "quick_action_not_found" };
  return { ok: true, data: row };
}

export async function listQuickActions(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
): Promise<Result<{ actions: QuickAction[] }>> {
  const scope = staffContext(context, organizationId);
  if (scope.ok === false) return scope;
  const supabase = createServiceClient(env);
  const visibleFilter = scope.data.staff
    ? `and(visibility.eq.me,owner_id.eq.${context.user.id}),and(visibility.in.(client,shared),organization_id.eq.${organizationId})`
    : `and(visibility.eq.shared,organization_id.eq.${organizationId})`;
  const { data, error } = await supabase
    .from("campaign_quick_actions")
    .select(COLUMNS)
    .or(visibleFilter)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { ok: false, statusCode: 500, error: "quick_actions_load_failed", detail: error.message };
  return { ok: true, data: { actions: ((data ?? []) as Row[]).map((row) => toAction(row, context.user.id)) } };
}

export async function createQuickAction(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: QuickActionInput,
): Promise<Result<QuickAction>> {
  const denied = staffOnly(context, organizationId);
  if (denied) return denied;
  const parsed = parseQuickActionInput({ visibility: "me", ...input });
  if (parsed.ok === false) return parsed;
  if (!parsed.data.name) return { ok: false, statusCode: 400, error: "quick_action_name_required" };
  const supabase = createServiceClient(env);
  const { data: last } = await supabase
    .from("campaign_quick_actions")
    .select("position")
    .eq("owner_id", context.user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("campaign_quick_actions")
    .insert({
      ...parsed.data,
      owner_id: context.user.id,
      organization_id: parsed.data.visibility === "me" ? null : organizationId,
      position: (last?.position ?? -1) + 1,
    })
    .select(COLUMNS)
    .single();
  if (error) return { ok: false, statusCode: 500, error: "quick_action_create_failed", detail: error.message };
  return { ok: true, data: toAction(data as Row, context.user.id) };
}

export async function updateQuickAction(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  id: string,
  input: QuickActionInput,
): Promise<Result<QuickAction>> {
  const denied = staffOnly(context, organizationId);
  if (denied) return denied;
  const parsed = parseQuickActionInput(input);
  if (parsed.ok === false) return parsed;
  const supabase = createServiceClient(env);
  const current = await loadEditable(supabase, context, organizationId, id);
  if (current.ok === false) return current;
  const visibility = (parsed.data.visibility as string | undefined) ?? current.data.visibility;
  const { data, error } = await supabase
    .from("campaign_quick_actions")
    .update({
      ...parsed.data,
      organization_id: visibility === "me" ? null : organizationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) return { ok: false, statusCode: 500, error: "quick_action_update_failed", detail: error.message };
  return { ok: true, data: toAction(data as Row, context.user.id) };
}

export async function deleteQuickAction(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  id: string,
): Promise<Result<{ id: string }>> {
  const denied = staffOnly(context, organizationId);
  if (denied) return denied;
  const supabase = createServiceClient(env);
  const current = await loadEditable(supabase, context, organizationId, id);
  if (current.ok === false) return current;
  const { error } = await supabase.from("campaign_quick_actions").delete().eq("id", id);
  if (error) return { ok: false, statusCode: 500, error: "quick_action_delete_failed", detail: error.message };
  return { ok: true, data: { id } };
}

/** Reordena: `ids` en el orden nuevo; solo cuentan las que el actor puede editar. */
export async function reorderQuickActions(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  ids: string[],
): Promise<Result<{ ids: string[] }>> {
  const denied = staffOnly(context, organizationId);
  if (denied) return denied;
  if (!Array.isArray(ids) || ids.length > 100) return { ok: false, statusCode: 400, error: "quick_actions_ids_invalid" };
  const listed = await listQuickActions(env, context, organizationId);
  if (listed.ok === false) return listed;
  const allowed = new Set(listed.data.actions.map((action) => action.id));
  const ordered = ids.filter((id) => allowed.has(id));
  const supabase = createServiceClient(env);
  for (const [position, id] of ordered.entries()) {
    const { error } = await supabase.from("campaign_quick_actions").update({ position }).eq("id", id);
    if (error) return { ok: false, statusCode: 500, error: "quick_actions_reorder_failed", detail: error.message };
  }
  return { ok: true, data: { ids: ordered } };
}
