import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  type AuthContext,
  type AuthContextError,
  isAuthContextError,
  resolveAuthContext,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { consultingOrganizationIdOf } from "./capacidad-cartera.js";
import { inviteClientMember, leavesClientWithoutOwner } from "./consultant.js";
import { AI_AGENT_GROUPS } from "./ai-agent-groups.js";
import { isReportAccentColor } from "./report-branding.js";
import {
  CONSULTANT_PERMISSION_KEYS,
  type ConsultantPermissions,
  DEFAULT_CONSULTANT_PERMISSIONS,
} from "./org-access-guard.js";

/**
 * Configuración v3, fases 4 y 5: la consultora gestiona a sus consultores, ve
 * y revoca sus códigos de vinculación, pone su marca y los ajustes de partida
 * de cada cliente nuevo; y cada organización decide qué análisis de la IA
 * corren solos (20261219130000).
 */

type ApiEnv = LoadedApiEnv;
type Failure = { ok: false; statusCode: number; error: string; message?: string; detail?: string };

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

const fail = (statusCode: number, error: string, message?: string): Failure => ({
  ok: false,
  statusCode,
  error,
  ...(message ? { message } : {}),
});

/** La consultora de quien pide y su rol en ella. */
function consultoraOf(context: AuthContext) {
  const organizationId = consultingOrganizationIdOf(context);
  if (!organizationId) return null;
  const role = context.memberships.find((item) => item.organization_id === organizationId)?.role ?? "member";
  return { organizationId, role, canManage: ["owner", "manager"].includes(role) };
}

const CONSULTORA_ROLES = ["owner", "manager", "member"] as const;

// --- Equipo -----------------------------------------------------------------

export async function getConsultoraTeam(env: ApiEnv, context: AuthContext) {
  const consultora = consultoraOf(context);
  if (!consultora) return fail(404, "consulting_organization_missing", "Tu cuenta no está en ninguna consultora.");
  const supabase = createServiceClient(env);
  const [members, invites] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role, is_active, joined_at, invited_at")
      .eq("organization_id", consultora.organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("client_invites")
      .select("id, email, expires_at, created_at")
      .eq("organization_id", consultora.organizationId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
  ]);
  if (members.error || invites.error) {
    return { ok: false as const, statusCode: 500, error: "consultora_team_load_failed", detail: members.error?.message ?? invites.error?.message };
  }
  const userIds = (members.data ?? []).map((row) => row.user_id as string);
  const [profiles, assignments] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
    userIds.length
      ? supabase.from("consultant_assignments").select("consultant_user_id").eq("is_active", true).in("consultant_user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ consultant_user_id: string }> }),
  ]);
  const nameById = new Map((profiles.data ?? []).map((row) => [row.id as string, row.full_name as string | null]));
  const clientCount = new Map<string, number>();
  for (const row of assignments.data ?? []) {
    const id = row.consultant_user_id as string;
    clientCount.set(id, (clientCount.get(id) ?? 0) + 1);
  }
  return {
    ok: true as const,
    data: {
      organization_id: consultora.organizationId,
      role: consultora.role,
      can_manage: consultora.canManage,
      members: (members.data ?? []).map((row) => ({
        user_id: row.user_id as string,
        role: row.role as string,
        is_active: Boolean(row.is_active),
        joined_at: row.joined_at as string | null,
        full_name: nameById.get(row.user_id as string) ?? null,
        client_count: clientCount.get(row.user_id as string) ?? 0,
      })),
      pending_invites: invites.data ?? [],
    },
  };
}

export async function inviteConsultoraMember(
  env: ApiEnv,
  context: AuthContext,
  body: { email?: string; full_name?: string; role?: string },
) {
  const consultora = consultoraOf(context);
  if (!consultora?.canManage) return fail(403, "consultora_manage_denied", "Solo el propietario o un gestor de la consultora invita consultores.");
  const role = body.role ?? "member";
  if (!(["manager", "member"] as string[]).includes(role)) return fail(400, "invalid_role");
  // Mismo circuito que invitar a alguien a un cliente: usuario de Auth,
  // membership inactiva y correo. Al aceptarla pasa a ser consultor
  // (private.is_consultant mira la membership de la consultora con plan).
  return inviteClientMember(env, context, consultora.organizationId, {
    ...(body.email ? { email: body.email } : {}),
    ...(body.full_name ? { full_name: body.full_name } : {}),
    role,
    access_scope: "organization",
  });
}

export async function updateConsultoraMember(
  env: ApiEnv,
  context: AuthContext,
  userId: string,
  body: { role?: unknown; is_active?: unknown },
) {
  const consultora = consultoraOf(context);
  if (!consultora?.canManage) return fail(403, "consultora_manage_denied");
  const patch: Record<string, unknown> = {};
  if (body.role !== undefined) {
    if (!(CONSULTORA_ROLES as readonly string[]).includes(body.role as string)) return fail(400, "invalid_role");
    patch.role = body.role;
  }
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
  if (Object.keys(patch).length === 0) return fail(400, "empty_update");

  const supabase = createServiceClient(env);
  const { data: owners } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", consultora.organizationId)
    .eq("role", "owner")
    .eq("is_active", true);
  const activeOwners = (owners ?? []).map((row) => row.user_id as string);
  if ((patch.role === "owner" || activeOwners.includes(userId)) && consultora.role !== "owner") {
    return fail(403, "owner_role_requires_owner", "Solo el propietario da o quita la propiedad de la consultora.");
  }
  if (leavesClientWithoutOwner(activeOwners, userId, patch)) {
    return fail(409, "last_owner", "Es el único propietario. Nombra a otro antes.");
  }
  const { data, error } = await supabase
    .from("organization_members")
    .update(patch)
    .eq("organization_id", consultora.organizationId)
    .eq("user_id", userId)
    .select("user_id, role, is_active")
    .maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "consultora_member_update_failed", detail: error.message };
  if (!data) return fail(404, "member_not_found");
  await recordAuditLog(supabase, {
    organizationId: consultora.organizationId,
    actorUserId: context.user.id,
    action: "consultora.update_member",
    entityType: "organization_member",
    entityId: userId,
    newData: patch,
  });
  return { ok: true as const, data };
}

// --- Códigos de vinculación -------------------------------------------------

export function inviteCodeState(row: { status: string; expires_at: string }, now = Date.now()) {
  if (row.status === "pending" && Date.parse(row.expires_at) <= now) return "expired";
  return row.status;
}

export async function listInviteCodes(env: ApiEnv, context: AuthContext) {
  const consultora = consultoraOf(context);
  if (!consultora) return fail(404, "consulting_organization_missing");
  const supabase = createServiceClient(env);
  let query = supabase
    .from("client_invites")
    .select("id, email, status, expires_at, created_at, redeemed_at, consultant_user_id, organization_id")
    .eq("consulting_organization_id", consultora.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);
  // Un consultor ve los suyos; propietario y gestores, los de toda la consultora.
  if (!consultora.canManage) query = query.eq("consultant_user_id", context.user.id);
  const { data, error } = await query;
  if (error) return { ok: false as const, statusCode: 500, error: "invite_codes_load_failed", detail: error.message };
  const rows = data ?? [];
  const consultantIds = [...new Set(rows.map((row) => row.consultant_user_id as string))];
  const orgIds = [...new Set(rows.map((row) => row.organization_id as string | null).filter(Boolean))] as string[];
  const [profiles, organizations] = await Promise.all([
    consultantIds.length ? supabase.from("profiles").select("id, full_name").in("id", consultantIds) : Promise.resolve({ data: [] }),
    orgIds.length ? supabase.from("organizations").select("id, display_name").in("id", orgIds) : Promise.resolve({ data: [] }),
  ]);
  const name = new Map(((profiles.data ?? []) as Array<{ id: string; full_name: string | null }>).map((row) => [row.id, row.full_name]));
  const org = new Map(((organizations.data ?? []) as Array<{ id: string; display_name: string }>).map((row) => [row.id, row.display_name]));
  return {
    ok: true as const,
    data: {
      can_manage: consultora.canManage,
      codes: rows.map((row) => ({
        id: row.id as string,
        email: (row.email as string | null) || null,
        state: inviteCodeState(row as { status: string; expires_at: string }),
        expires_at: row.expires_at as string,
        created_at: row.created_at as string,
        redeemed_at: row.redeemed_at as string | null,
        created_by: name.get(row.consultant_user_id as string) ?? null,
        mine: row.consultant_user_id === context.user.id,
        organization_name: row.organization_id ? (org.get(row.organization_id as string) ?? null) : null,
      })),
    },
  };
}

export async function revokeInviteCode(env: ApiEnv, context: AuthContext, inviteId: string) {
  const consultora = consultoraOf(context);
  if (!consultora) return fail(404, "consulting_organization_missing");
  const supabase = createServiceClient(env);
  let query = supabase
    .from("client_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("consulting_organization_id", consultora.organizationId)
    .eq("status", "pending");
  if (!consultora.canManage) query = query.eq("consultant_user_id", context.user.id);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "invite_revoke_failed", detail: error.message };
  if (!data) return fail(404, "invite_not_found", "El código ya no está pendiente o no es tuyo.");
  await recordAuditLog(supabase, {
    organizationId: consultora.organizationId,
    actorUserId: context.user.id,
    action: "consultora.revoke_invite_code",
    entityType: "client_invite",
    entityId: inviteId,
  });
  return { ok: true as const, data: { id: inviteId } };
}

// --- Marca y ajustes de partida -------------------------------------------

export type ClientDefaults = {
  payment_fee_pct?: number;
  payment_fee_fixed?: number;
  default_shipping_cost?: number;
  consultant_permissions?: Partial<ConsultantPermissions>;
};

export function sanitizeClientDefaults(input: unknown): ClientDefaults | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;
  const out: ClientDefaults = {};
  for (const key of ["payment_fee_pct", "payment_fee_fixed", "default_shipping_cost"] as const) {
    const value = source[key];
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || (key === "payment_fee_pct" && number > 100)) return null;
    out[key] = number;
  }
  if (source.consultant_permissions && typeof source.consultant_permissions === "object") {
    const permissions: Partial<ConsultantPermissions> = {};
    for (const key of CONSULTANT_PERMISSION_KEYS) {
      const value = (source.consultant_permissions as Record<string, unknown>)[key];
      if (typeof value === "boolean") permissions[key] = value;
    }
    out.consultant_permissions = permissions;
  }
  return out;
}

export async function getConsultoraBrand(env: ApiEnv, context: AuthContext) {
  const consultora = consultoraOf(context);
  if (!consultora) return fail(404, "consulting_organization_missing");
  const { data, error } = await createServiceClient(env)
    .from("organizations")
    .select("display_name, brand_name, brand_logo_url, brand_reply_to, brand_accent_color, client_defaults")
    .eq("id", consultora.organizationId)
    .maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "consultora_brand_load_failed", detail: error.message };
  return {
    ok: true as const,
    data: {
      can_edit: consultora.role === "owner",
      display_name: data?.display_name ?? null,
      brand_name: data?.brand_name ?? null,
      brand_logo_url: data?.brand_logo_url ?? null,
      brand_reply_to: data?.brand_reply_to ?? null,
      brand_accent_color: data?.brand_accent_color ?? null,
      client_defaults: (data?.client_defaults as ClientDefaults | null) ?? null,
    },
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function setConsultoraBrand(
  env: ApiEnv,
  context: AuthContext,
  body: { brand_name?: unknown; brand_logo_url?: unknown; brand_reply_to?: unknown; brand_accent_color?: unknown; client_defaults?: unknown },
) {
  const consultora = consultoraOf(context);
  if (!consultora || consultora.role !== "owner") return fail(403, "consultora_brand_denied", "La marca la cambia el propietario de la consultora.");
  const patch: Record<string, unknown> = {};
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null);
  if (body.brand_accent_color !== undefined) {
    if (body.brand_accent_color === null || body.brand_accent_color === "") patch.brand_accent_color = null;
    else if (!isReportAccentColor(body.brand_accent_color)) return fail(400, "invalid_brand_color", "Usa un color hexadecimal oscuro (#RRGGBB), con contraste suficiente sobre blanco.");
    else patch.brand_accent_color = body.brand_accent_color.toUpperCase();
  }
  if (body.brand_name !== undefined) patch.brand_name = text(body.brand_name);
  if (body.brand_logo_url !== undefined) {
    const url = text(body.brand_logo_url);
    if (url && !/^https:\/\//.test(url)) return fail(400, "invalid_logo_url");
    patch.brand_logo_url = url;
  }
  if (body.brand_reply_to !== undefined) {
    const email = text(body.brand_reply_to);
    if (email && !EMAIL_RE.test(email)) return fail(400, "invalid_reply_to");
    patch.brand_reply_to = email;
  }
  if (body.client_defaults !== undefined) {
    const defaults = body.client_defaults === null ? null : sanitizeClientDefaults(body.client_defaults);
    if (body.client_defaults !== null && !defaults) return fail(400, "invalid_client_defaults");
    patch.client_defaults = defaults;
  }
  if (Object.keys(patch).length === 0) return fail(400, "empty_update");
  const supabase = createServiceClient(env);
  const { error } = await supabase.from("organizations").update(patch).eq("id", consultora.organizationId);
  if (error) return { ok: false as const, statusCode: 500, error: "consultora_brand_save_failed", detail: error.message };
  await recordAuditLog(supabase, {
    organizationId: consultora.organizationId,
    actorUserId: context.user.id,
    action: "consultora.update_brand",
    entityType: "organization",
    entityId: consultora.organizationId,
    newData: patch,
  });
  return getConsultoraBrand(env, context);
}

/**
 * Copia los ajustes de partida de la consultora a un cliente recién
 * vinculado. No pisa nada que el cliente ya tenga. Best-effort.
 */
export async function applyClientDefaults(
  supabase: ReturnType<typeof createServiceClient>,
  consultingOrganizationId: string,
  organizationId: string,
) {
  const { data } = await supabase
    .from("organizations")
    .select("client_defaults")
    .eq("id", consultingOrganizationId)
    .maybeSingle();
  const defaults = sanitizeClientDefaults(data?.client_defaults);
  if (!defaults) return;
  const fees = {
    ...(defaults.payment_fee_pct !== undefined ? { payment_fee_pct: defaults.payment_fee_pct } : {}),
    ...(defaults.payment_fee_fixed !== undefined ? { payment_fee_fixed: defaults.payment_fee_fixed } : {}),
    ...(defaults.default_shipping_cost !== undefined ? { default_shipping_cost: defaults.default_shipping_cost } : {}),
  };
  if (Object.keys(fees).length > 0) {
    await supabase
      .from("organization_financial_settings")
      .upsert({ organization_id: organizationId, ...fees }, { onConflict: "organization_id", ignoreDuplicates: true });
  }
  if (defaults.consultant_permissions && Object.keys(defaults.consultant_permissions).length > 0) {
    await supabase
      .from("organization_consultant_permissions")
      .upsert(
        { organization_id: organizationId, ...DEFAULT_CONSULTANT_PERMISSIONS, ...defaults.consultant_permissions },
        { onConflict: "organization_id", ignoreDuplicates: true },
      );
  }
}

/** Marca de la consultora que lleva a un cliente, para su pantalla «Tu consultor». */
export async function getClientConsultora(env: ApiEnv, context: AuthContext, organizationId: string) {
  if (![...context.memberships, ...(context.storeMemberships ?? [])].some((item) => item.organization_id === organizationId)) {
    return fail(403, "organization_access_denied");
  }
  const supabase = createServiceClient(env);
  const { data: assignment } = await supabase
    .from("consultant_assignments")
    .select("consulting_organization_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .not("consulting_organization_id", "is", null)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!assignment?.consulting_organization_id) return { ok: true as const, data: { consultora: null } };
  const { data } = await supabase
    .from("organizations")
    .select("display_name, brand_name, brand_logo_url")
    .eq("id", assignment.consulting_organization_id)
    .maybeSingle();
  return {
    ok: true as const,
    data: {
      consultora: data
        ? { name: (data.brand_name as string | null) ?? (data.display_name as string), logo_url: data.brand_logo_url as string | null }
        : null,
    },
  };
}

// --- Copiloto IA: análisis automáticos -------------------------------------

function canEditAi(context: AuthContext, organizationId: string) {
  const membership = [...context.memberships, ...(context.storeMemberships ?? [])].find(
    (item) => item.organization_id === organizationId,
  );
  if (!membership) return null;
  return (
    ["platform_admin", "consultant"].includes(context.profile.platform_role) ||
    (membership.accessSource === "membership" && ["owner", "manager"].includes(membership.role))
  );
}

export async function getAiSettings(env: ApiEnv, context: AuthContext, organizationId: string) {
  const canEdit = canEditAi(context, organizationId);
  if (canEdit === null) return fail(403, "organization_access_denied");
  const { data } = await createServiceClient(env)
    .from("organization_ai_settings")
    .select("disabled_groups")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const disabled = new Set((data?.disabled_groups as string[] | null) ?? []);
  return {
    ok: true as const,
    data: {
      can_edit: canEdit,
      groups: Object.keys(AI_AGENT_GROUPS).map((group) => ({ group, enabled: !disabled.has(group) })),
    },
  };
}

export async function setAiSettings(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: { group?: unknown; enabled?: unknown },
) {
  if (!canEditAi(context, organizationId)) return fail(403, "ai_settings_denied", "Lo cambian el propietario, los gestores o el consultor.");
  if (typeof body.group !== "string" || !AI_AGENT_GROUPS[body.group] || typeof body.enabled !== "boolean") {
    return fail(400, "invalid_ai_setting");
  }
  const supabase = createServiceClient(env);
  const { data } = await supabase
    .from("organization_ai_settings")
    .select("disabled_groups")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const disabled = new Set((data?.disabled_groups as string[] | null) ?? []);
  if (body.enabled) disabled.delete(body.group);
  else disabled.add(body.group);
  const { error } = await supabase.from("organization_ai_settings").upsert(
    {
      organization_id: organizationId,
      disabled_groups: [...disabled],
      updated_by: context.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) return { ok: false as const, statusCode: 500, error: "ai_settings_save_failed", detail: error.message };
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "organization.ai_settings_updated",
    entityType: "organization",
    entityId: organizationId,
    newData: { group: body.group, enabled: body.enabled },
  });
  return getAiSettings(env, context, organizationId);
}

// --- Rutas ----------------------------------------------------------------

type Helpers = {
  sendAuthFailure: (reply: FastifyReply, error: AuthContextError) => unknown;
  sendServiceFailure: (reply: FastifyReply, result: unknown) => unknown;
};

export function registerConsultoraSettingsRoutes(app: FastifyInstance, env: ApiEnv, helpers: Helpers) {
  const route =
    (run: (context: AuthContext, request: FastifyRequest) => Promise<{ ok: boolean; data?: unknown }>) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return helpers.sendAuthFailure(reply, auth.error);
      const result = await run(auth.context, request);
      if (!result.ok) return helpers.sendServiceFailure(reply, result);
      return result.data;
    };
  const params = (request: FastifyRequest) => request.params as Record<string, string>;
  const body = <T>(request: FastifyRequest) => (request.body ?? {}) as T;

  app.get("/v1/consultant/consultora/team", route((context) => getConsultoraTeam(env, context)));
  app.post("/v1/consultant/consultora/team/invite", route((context, request) => inviteConsultoraMember(env, context, body(request))));
  app.patch("/v1/consultant/consultora/team/:userId", route((context, request) =>
    updateConsultoraMember(env, context, params(request).userId ?? "", body(request)),
  ));
  app.get("/v1/consultant/invite-codes", route((context) => listInviteCodes(env, context)));
  app.delete("/v1/consultant/invite-codes/:inviteId", route((context, request) =>
    revokeInviteCode(env, context, params(request).inviteId ?? ""),
  ));
  app.get("/v1/consultant/consultora/brand", route((context) => getConsultoraBrand(env, context)));
  app.put("/v1/consultant/consultora/brand", route((context, request) => setConsultoraBrand(env, context, body(request))));
  app.get("/v1/organizations/:organizationId/consultora", route((context, request) =>
    getClientConsultora(env, context, params(request).organizationId ?? ""),
  ));
  app.get("/v1/organizations/:organizationId/ai-settings", route((context, request) =>
    getAiSettings(env, context, params(request).organizationId ?? ""),
  ));
  app.put("/v1/organizations/:organizationId/ai-settings", route((context, request) =>
    setAiSettings(env, context, params(request).organizationId ?? "", body(request)),
  ));
}
