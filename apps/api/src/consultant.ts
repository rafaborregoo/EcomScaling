import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { isErr } from "./result-guard.js";
import { createLogger } from "@ecomscaling/observability";

const logger = createLogger("consultant");

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

// R-008: periodo de gracia entre marcar una organizacion/tienda para borrado
// y su purga fisica real. Ver ADR-0009/Q-009 y migracion db-13.
const RETENTION_PERIOD_DAYS = 30;

function scheduledPurgeAt(): string {
  return new Date(Date.now() + RETENTION_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

type OrganizationRow = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  timezone: string;
  currency_code: string;
};

type SubscriptionRow = {
  organization_id: string;
  plan_code: string;
  status: string;
};

type AssignmentRow = {
  id?: string;
  organization_id: string;
  consultant_user_id: string;
  is_primary: boolean;
  is_active?: boolean;
};

const MEMBER_ROLES = ["owner", "manager", "member", "readonly"] as const;

type MemberRole = (typeof MEMBER_ROLES)[number];

async function loadOrganizations(supabase: SupabaseClient, organizationIds?: string[]) {
  let query = supabase
    .from("organizations")
    .select("id, display_name, slug, status, timezone, currency_code")
    .order("display_name", { ascending: true });

  if (organizationIds) {
    if (organizationIds.length === 0) {
      return { ok: true as const, data: [] as OrganizationRow[] };
    }

    query = query.in("id", organizationIds);
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, data: (data ?? []) as OrganizationRow[] };
}

export async function listConsultantOrganizations(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const role = context.profile.platform_role;

  if (role !== "platform_admin" && role !== "consultant") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_access_required",
      message: "El panel consultor requiere rol platform_admin o consultant.",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  let organizationIds: string[] | undefined;

  if (role === "consultant") {
    const { data, error } = await supabase
      .from("consultant_assignments")
      .select("organization_id")
      .eq("consultant_user_id", context.user.id)
      .eq("is_active", true);

    if (error) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "consultant_assignments_load_failed",
        detail: error.message,
      };
    }

    organizationIds = [...new Set((data ?? []).map((row) => row.organization_id as string))];
  }

  const organizationsResult = await loadOrganizations(supabase, organizationIds);

  if (isErr(organizationsResult)) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_organizations_load_failed",
      detail: organizationsResult.error,
    };
  }

  const organizations = organizationsResult.data;
  const ids = organizations.map((organization) => organization.id);

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("service_subscriptions")
    .select("organization_id, plan_code, status")
    .in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  if (subscriptionsError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_subscriptions_load_failed",
      detail: subscriptionsError.message,
    };
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("consultant_assignments")
    .select("organization_id, consultant_user_id, is_primary")
    .in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .eq("is_active", true);

  if (assignmentsError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_assignments_summary_failed",
      detail: assignmentsError.message,
    };
  }

  // Cuantas tiendas (paginas web) tiene cada cliente, para el CRUD de
  // consultoria (ver cobertura sin tener que entrar a cada cliente).
  const { data: connectionRows, error: connectionsError } = await supabase
    .from("integration_connections")
    .select("organization_id")
    .eq("provider", "shopify")
    .in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  if (connectionsError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_connections_summary_failed",
      detail: connectionsError.message,
    };
  }

  const subscriptionRows = (subscriptions ?? []) as SubscriptionRow[];
  const assignmentRows = (assignments ?? []) as AssignmentRow[];
  const storeCountByOrganization = new Map<string, number>();
  for (const row of connectionRows ?? []) {
    const orgId = row.organization_id as string;
    storeCountByOrganization.set(orgId, (storeCountByOrganization.get(orgId) ?? 0) + 1);
  }

  // FE-08: "que cliente necesita atencion hoy". Senal determinista con los
  // mismos datos del motor de reglas: alertas vivas ponderadas por severidad
  // y antiguedad + tareas vencidas. Nada de IA: es ordenable y explicable.
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

  const [{ data: alertRows }, { data: taskRows }] = await Promise.all([
    supabase
      .from("alerts")
      .select("organization_id, severity, first_detected_at")
      .in("organization_id", safeIds)
      .in("status", ["open", "acknowledged"]),
    supabase
      .from("tasks")
      .select("organization_id, due_at")
      .in("organization_id", safeIds)
      .in("status", ["pending", "in_progress"]),
  ]);

  const severityWeight: Record<string, number> = { critical: 10, high: 5, medium: 2, low: 1, info: 0 };
  const now = Date.now();

  const attentionByOrganization = new Map<
    string,
    {
      open_alerts: number;
      critical_alerts: number;
      high_alerts: number;
      oldest_alert_days: number;
      overdue_tasks: number;
      open_tasks: number;
      score: number;
    }
  >();

  for (const id of ids) {
    const orgAlerts = (alertRows ?? []).filter((row) => row.organization_id === id);
    const orgTasks = (taskRows ?? []).filter((row) => row.organization_id === id);

    const oldestAlertDays = orgAlerts.reduce((max, row) => {
      const detectedAt = row.first_detected_at ? Date.parse(row.first_detected_at as string) : now;
      return Math.max(max, Math.floor((now - detectedAt) / 86_400_000));
    }, 0);

    const overdueTasks = orgTasks.filter(
      (row) => row.due_at && Date.parse(row.due_at as string) < now,
    ).length;

    const severityScore = orgAlerts.reduce(
      (sum, row) => sum + (severityWeight[row.severity as string] ?? 1),
      0,
    );

    attentionByOrganization.set(id, {
      open_alerts: orgAlerts.length,
      critical_alerts: orgAlerts.filter((row) => row.severity === "critical").length,
      high_alerts: orgAlerts.filter((row) => row.severity === "high").length,
      oldest_alert_days: oldestAlertDays,
      overdue_tasks: overdueTasks,
      open_tasks: orgTasks.length,
      score: severityScore + Math.min(oldestAlertDays, 14) + overdueTasks * 3,
    });
  }

  const enriched = organizations.map((organization) => ({
    ...organization,
    subscription:
      subscriptionRows.find(
        (subscription) => subscription.organization_id === organization.id,
      ) ?? null,
    consultant_count: assignmentRows.filter(
      (assignment) => assignment.organization_id === organization.id,
    ).length,
    store_count: storeCountByOrganization.get(organization.id) ?? 0,
    attention: attentionByOrganization.get(organization.id) ?? {
      open_alerts: 0,
      critical_alerts: 0,
      high_alerts: 0,
      oldest_alert_days: 0,
      overdue_tasks: 0,
      open_tasks: 0,
      score: 0,
    },
  }));

  // Los clientes que mas atencion necesitan, primero.
  enriched.sort((a, b) => b.attention.score - a.attention.score);

  return {
    ok: true as const,
    data: {
      organizations: enriched,
    },
  };
}

/**
 * Acceso administrativo de un cliente. Solo devuelve perfiles existentes:
 * crear usuarios de auth/invitaciones pertenece a otro flujo y nunca debe
 * simularse insertando perfiles manualmente.
 */
export async function getOrganizationAccess(env: ApiEnv, context: AuthContext, organizationId: string) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) {
    return access;
  }

  const supabase = createServiceClient(env);
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, display_name")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    return { ok: false as const, statusCode: 500, error: "organization_access_load_failed", detail: organizationError.message };
  }
  if (!organization) {
    return { ok: false as const, statusCode: 404, error: "organization_not_found" };
  }

  const [{ data: members, error: membersError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("id, user_id, role, is_active, invited_at, joined_at, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      supabase
        .from("consultant_assignments")
        .select("id, consultant_user_id, is_primary, is_active, assigned_at, ended_at")
        .eq("organization_id", organizationId)
        .order("assigned_at", { ascending: true }),
    ]);

  if (membersError || assignmentsError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_access_load_failed",
      detail: membersError?.message ?? assignmentsError?.message,
    };
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, platform_role, is_active")
    .order("full_name", { ascending: true });

  if (profilesError) {
    return { ok: false as const, statusCode: 500, error: "profiles_load_failed", detail: profilesError.message };
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]));
  return {
    ok: true as const,
    data: {
      organization,
      members: (members ?? []).map((member) => ({ ...member, profile: profileById.get(member.user_id as string) ?? null })),
      assignments: (assignments ?? []).map((assignment) => ({
        ...assignment,
        profile: profileById.get(assignment.consultant_user_id as string) ?? null,
      })),
      available_profiles: (profiles ?? []).filter((profile) => profile.is_active),
    },
  };
}

async function loadExistingProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, platform_role, is_active")
    .eq("id", userId)
    .maybeSingle();
  return { data, error };
}

export async function upsertOrganizationMember(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: { user_id?: string; role?: string; is_active?: boolean },
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;
  const userId = body.user_id?.trim();
  if (!userId || !body.role || !MEMBER_ROLES.includes(body.role as MemberRole)) {
    return { ok: false as const, statusCode: 400, error: "invalid_member_payload" };
  }

  const supabase = createServiceClient(env);
  const { data: profile, error: profileError } = await loadExistingProfile(supabase, userId);
  if (profileError) return { ok: false as const, statusCode: 500, error: "profile_load_failed", detail: profileError.message };
  if (!profile) return { ok: false as const, statusCode: 404, error: "profile_not_found" };

  const { data: previous } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, is_active, invited_at, joined_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  const { data: member, error } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        role: body.role,
        is_active: body.is_active ?? true,
        invited_by: context.user.id,
        invited_at: previous?.invited_at ?? new Date().toISOString(),
        joined_at: previous?.joined_at ?? new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    )
    .select("id, organization_id, user_id, role, is_active, invited_at, joined_at")
    .single();

  if (error) return { ok: false as const, statusCode: 500, error: "organization_member_save_failed", detail: error.message };
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: previous ? "consultant.update_organization_member" : "consultant.add_organization_member",
    entityType: "organization_member",
    entityId: member.id,
    oldData: previous,
    newData: member,
  });
  return { ok: true as const, data: { member: { ...member, profile } } };
}

export async function upsertConsultantAssignment(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: { consultant_user_id?: string; is_primary?: boolean; is_active?: boolean },
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;
  const consultantUserId = body.consultant_user_id?.trim();
  if (!consultantUserId) return { ok: false as const, statusCode: 400, error: "consultant_user_id_required" };

  const supabase = createServiceClient(env);
  const { data: profile, error: profileError } = await loadExistingProfile(supabase, consultantUserId);
  if (profileError) return { ok: false as const, statusCode: 500, error: "profile_load_failed", detail: profileError.message };
  if (!profile) return { ok: false as const, statusCode: 404, error: "profile_not_found" };
  if (!["consultant", "platform_admin"].includes(profile.platform_role as string)) {
    return { ok: false as const, statusCode: 400, error: "profile_not_consultant" };
  }

  const { data: previous } = await supabase
    .from("consultant_assignments")
    .select("id, organization_id, consultant_user_id, is_primary, is_active, assigned_at, ended_at")
    .eq("organization_id", organizationId)
    .eq("consultant_user_id", consultantUserId)
    .maybeSingle();
  const isActive = body.is_active ?? Boolean(previous?.is_active ?? true);
  const isPrimary = body.is_primary ?? Boolean(previous?.is_primary);

  if (isPrimary && isActive) {
    const { error: clearPrimaryError } = await supabase
      .from("consultant_assignments")
      .update({ is_primary: false })
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_primary", true)
      .neq("consultant_user_id", consultantUserId);
    if (clearPrimaryError) {
      return { ok: false as const, statusCode: 500, error: "primary_assignment_update_failed", detail: clearPrimaryError.message };
    }
  }

  const { data: assignment, error } = await supabase
    .from("consultant_assignments")
    .upsert(
      {
        organization_id: organizationId,
        consultant_user_id: consultantUserId,
        is_primary: Boolean(isPrimary && isActive),
        is_active: isActive,
        assigned_by: context.user.id,
        ended_at: isActive ? null : new Date().toISOString(),
      },
      { onConflict: "organization_id,consultant_user_id" },
    )
    .select("id, organization_id, consultant_user_id, is_primary, is_active, assigned_at, ended_at")
    .single();

  if (error) return { ok: false as const, statusCode: 500, error: "consultant_assignment_save_failed", detail: error.message };
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: previous ? "consultant.update_assignment" : "consultant.create_assignment",
    entityType: "consultant_assignment",
    entityId: assignment.id,
    oldData: previous,
    newData: assignment,
  });
  return { ok: true as const, data: { assignment: { ...assignment, profile } } };
}

function requirePlatformAdmin(context: AuthContext) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
      message: "Solo un platform admin puede realizar esta accion.",
    };
  }
  return { ok: true as const };
}

/** Tiendas (paginas web) de un cliente, para el CRUD de consultoria. */
export async function listOrganizationStores(env: ApiEnv, authorization: string, context: AuthContext, organizationId: string) {
  if (!["platform_admin", "consultant"].includes(context.profile.platform_role)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_access_required",
      message: "El panel consultor requiere rol platform_admin o consultant.",
    };
  }

  // BE-01 (gap real encontrado 2026-07-28): antes solo se comprobaba el rol,
  // no que ESTE consultor este asignado a ESTA organizacion -- dependia
  // solo de RLS (private.can_access_org via is_assigned_consultant) como
  // unica linea de defensa. `context.memberships` ya incluye las
  // organizaciones virtuales de platform_admin/consultant (auth-context.ts),
  // asi que reusarlo aqui es la misma verificacion que el resto de servicios
  // (requireMembership), sin una query nueva.
  if (!context.memberships.some((membership) => membership.organization_id === organizationId)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("integration_connections")
    .select("id, provider_account_name, provider_account_id, status, connected_at, last_sync_at")
    .eq("organization_id", organizationId)
    .eq("provider", "shopify")
    .order("connected_at", { ascending: false });

  if (error) {
    return { ok: false as const, statusCode: 500, error: "organization_stores_load_failed", detail: error.message };
  }

  return { ok: true as const, data: { organization_id: organizationId, stores: data ?? [] } };
}

/**
 * Marca una tienda (conexion Shopify) de un cliente para borrado. No borra
 * nada todavia: pone status='pending_deletion' con un periodo de gracia
 * (RETENTION_PERIOD_DAYS). El borrado fisico real lo hace `purgeExpiredStores`
 * (job periodico) cuando pasa `scheduled_purge_at`, o se puede revertir antes
 * con `restoreOrganizationStore`. Ver R-008.
 */
export async function deleteOrganizationStore(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId: string,
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) {
    return access;
  }

  const supabase = createServiceClient(env);

  const { data: connection, error: loadError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, provider, status")
    .eq("id", connectionId)
    .maybeSingle();

  if (loadError) {
    return { ok: false as const, statusCode: 500, error: "connection_load_failed", detail: loadError.message };
  }

  if (!connection || connection.organization_id !== organizationId || connection.provider !== "shopify") {
    return { ok: false as const, statusCode: 404, error: "connection_not_found" };
  }

  if (connection.status === "pending_deletion") {
    return { ok: false as const, statusCode: 409, error: "connection_already_pending_deletion" };
  }

  const scheduledPurge = scheduledPurgeAt();

  const { error: updateError } = await supabase
    .from("integration_connections")
    .update({
      status: "pending_deletion",
      deletion_requested_at: new Date().toISOString(),
      deletion_requested_by: context.user.id,
      scheduled_purge_at: scheduledPurge,
    })
    .eq("id", connectionId);

  if (updateError) {
    return { ok: false as const, statusCode: 500, error: "connection_delete_failed", detail: updateError.message };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.request_organization_store_deletion",
    entityType: "integration_connection",
    entityId: connectionId,
    oldData: connection,
    newData: { status: "pending_deletion", scheduled_purge_at: scheduledPurge },
  });

  return { ok: true as const, data: { connection_id: connectionId, status: "pending_deletion", scheduled_purge_at: scheduledPurge } };
}

/**
 * Revierte una tienda marcada para borrado, siempre que aun no se haya
 * purgado. Vuelve a 'connected' -- si el token OAuth ya no es valido, el
 * proximo sync la movera a 'error' de forma normal.
 */
export async function restoreOrganizationStore(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId: string,
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) {
    return access;
  }

  const supabase = createServiceClient(env);

  const { data: connection, error: loadError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, status")
    .eq("id", connectionId)
    .maybeSingle();

  if (loadError) {
    return { ok: false as const, statusCode: 500, error: "connection_load_failed", detail: loadError.message };
  }

  if (!connection || connection.organization_id !== organizationId) {
    return { ok: false as const, statusCode: 404, error: "connection_not_found" };
  }

  if (connection.status !== "pending_deletion") {
    return { ok: false as const, statusCode: 409, error: "connection_not_pending_deletion" };
  }

  const { error: updateError } = await supabase
    .from("integration_connections")
    .update({
      status: "connected",
      deletion_requested_at: null,
      deletion_requested_by: null,
      scheduled_purge_at: null,
    })
    .eq("id", connectionId);

  if (updateError) {
    return { ok: false as const, statusCode: 500, error: "connection_restore_failed", detail: updateError.message };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.restore_organization_store",
    entityType: "integration_connection",
    entityId: connectionId,
    oldData: connection,
    newData: { status: "connected" },
  });

  return { ok: true as const, data: { connection_id: connectionId, status: "connected" } };
}

const ORGANIZATION_STATUSES = ["onboarding", "active", "suspended", "cancelled"] as const;

export async function updateOrganization(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: { display_name?: string; status?: string; timezone?: string; currency_code?: string },
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) {
    return access;
  }

  const patch: Record<string, string> = {};

  if (body.display_name !== undefined) {
    const trimmed = body.display_name.trim();
    if (trimmed.length === 0) {
      return { ok: false as const, statusCode: 400, error: "invalid_display_name" };
    }
    patch.display_name = trimmed;
  }

  if (body.status !== undefined) {
    if (!ORGANIZATION_STATUSES.includes(body.status as (typeof ORGANIZATION_STATUSES)[number])) {
      return { ok: false as const, statusCode: 400, error: "invalid_status" };
    }
    patch.status = body.status;
  }

  if (body.timezone !== undefined) {
    const trimmed = body.timezone.trim();
    if (trimmed.length === 0) {
      return { ok: false as const, statusCode: 400, error: "invalid_timezone" };
    }
    patch.timezone = trimmed;
  }

  if (body.currency_code !== undefined) {
    if (!/^[A-Z]{3}$/.test(body.currency_code)) {
      return { ok: false as const, statusCode: 400, error: "invalid_currency_code" };
    }
    patch.currency_code = body.currency_code;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false as const, statusCode: 400, error: "empty_update" };
  }

  const supabase = createServiceClient(env);

  const { data: previousOrganization } = await supabase
    .from("organizations")
    .select("display_name, status, timezone, currency_code")
    .eq("id", organizationId)
    .maybeSingle();

  const { data: organization, error: updateError } = await supabase
    .from("organizations")
    .update(patch)
    .eq("id", organizationId)
    .select("id, display_name, slug, status, timezone, currency_code")
    .maybeSingle();

  if (updateError) {
    return { ok: false as const, statusCode: 500, error: "organization_update_failed", detail: updateError.message };
  }

  if (!organization) {
    return { ok: false as const, statusCode: 404, error: "organization_not_found" };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.update_organization",
    entityType: "organization",
    entityId: organizationId,
    oldData: previousOrganization,
    newData: patch,
  });

  return { ok: true as const, data: { organization } };
}

/**
 * Marca un cliente (organizacion) para borrado. No borra nada todavia: pone
 * status='pending_deletion' con un periodo de gracia (RETENTION_PERIOD_DAYS,
 * ver R-008/Q-009). El borrado fisico real -- que sigue disparando la cascada
 * de FK sobre memberships, suscripciones, integraciones, datos Shopify,
 * tareas, alertas, agentes IA, conocimiento privado, etc. -- lo hace
 * `purgeExpiredOrganizations` (job periodico) cuando pasa `scheduled_purge_at`,
 * o se puede revertir antes con `restoreOrganization`. Solo platform admin.
 */
export async function deleteOrganization(env: ApiEnv, context: AuthContext, organizationId: string) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) {
    return access;
  }

  const supabase = createServiceClient(env);

  const { data: organization, error: loadError } = await supabase
    .from("organizations")
    .select("id, display_name, status")
    .eq("id", organizationId)
    .maybeSingle();

  if (loadError) {
    return { ok: false as const, statusCode: 500, error: "organization_load_failed", detail: loadError.message };
  }

  if (!organization) {
    return { ok: false as const, statusCode: 404, error: "organization_not_found" };
  }

  if (organization.status === "pending_deletion") {
    return { ok: false as const, statusCode: 409, error: "organization_already_pending_deletion" };
  }

  const scheduledPurge = scheduledPurgeAt();

  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      status: "pending_deletion",
      deletion_requested_at: new Date().toISOString(),
      deletion_requested_by: context.user.id,
      scheduled_purge_at: scheduledPurge,
    })
    .eq("id", organizationId);

  if (updateError) {
    return { ok: false as const, statusCode: 500, error: "organization_delete_failed", detail: updateError.message };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.request_organization_deletion",
    entityType: "organization",
    entityId: organizationId,
    oldData: organization,
    newData: { status: "pending_deletion", scheduled_purge_at: scheduledPurge },
  });

  return {
    ok: true as const,
    data: { organization_id: organizationId, display_name: organization.display_name, status: "pending_deletion", scheduled_purge_at: scheduledPurge },
  };
}

/**
 * Revierte una organizacion marcada para borrado, siempre que aun no se haya
 * purgado. No conocemos el status anterior exacto (onboarding/active/
 * suspended), asi que restaura a 'active' -- es el caso comun y evita
 * reintroducir un estado de onboarding a medio completar.
 */
export async function restoreOrganization(env: ApiEnv, context: AuthContext, organizationId: string) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) {
    return access;
  }

  const supabase = createServiceClient(env);

  const { data: organization, error: loadError } = await supabase
    .from("organizations")
    .select("id, display_name, status")
    .eq("id", organizationId)
    .maybeSingle();

  if (loadError) {
    return { ok: false as const, statusCode: 500, error: "organization_load_failed", detail: loadError.message };
  }

  if (!organization) {
    return { ok: false as const, statusCode: 404, error: "organization_not_found" };
  }

  if (organization.status !== "pending_deletion") {
    return { ok: false as const, statusCode: 409, error: "organization_not_pending_deletion" };
  }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ status: "active", deletion_requested_at: null, deletion_requested_by: null, scheduled_purge_at: null })
    .eq("id", organizationId);

  if (updateError) {
    return { ok: false as const, statusCode: 500, error: "organization_restore_failed", detail: updateError.message };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.restore_organization",
    entityType: "organization",
    entityId: organizationId,
    oldData: organization,
    newData: { status: "active" },
  });

  return { ok: true as const, data: { organization_id: organizationId, display_name: organization.display_name, status: "active" } };
}

/**
 * Purga fisica de organizaciones y tiendas cuyo periodo de gracia ya paso.
 * Pensado para correr como job periodico (worker + cron, no HTTP) con
 * service role -- no pasa por requirePlatformAdmin porque no hay un usuario
 * humano actuando, es el sistema cumpliendo el estado ya decidido. Ver R-008.
 */
export async function purgeExpiredDeletions(env: ApiEnv) {
  const supabase = createServiceClient(env);
  const nowIso = new Date().toISOString();

  const { data: organizations, error: orgLoadError } = await supabase
    .from("organizations")
    .select("id, display_name")
    .eq("status", "pending_deletion")
    .lte("scheduled_purge_at", nowIso);

  if (orgLoadError) {
    return { ok: false as const, statusCode: 500, error: "organizations_purge_lookup_failed", detail: orgLoadError.message };
  }

  let purgedOrganizations = 0;
  const failedOrganizationIds: string[] = [];
  for (const organization of organizations ?? []) {
    const { error: deleteError } = await supabase.from("organizations").delete().eq("id", organization.id);
    if (deleteError) {
      // R-008 (bug real encontrado 2026-07-22): antes este error se tragaba
      // en silencio -- una organizacion con datos que rompieran el borrado
      // en cascada (ver fix de log_financial_change) nunca se purgaba y
      // nadie se enteraba. Ahora queda en logs y en el resultado del cron.
      logger.error("Failed to purge organization", { organization_id: organization.id, error: deleteError.message });
      failedOrganizationIds.push(organization.id);
      continue;
    }
    purgedOrganizations += 1;
    await recordAuditLog(supabase, {
      organizationId: null,
      actorUserId: null,
      action: "consultant.purge_organization",
      entityType: "organization",
      entityId: organization.id,
      oldData: organization,
    });
  }

  const { data: connections, error: connLoadError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, provider")
    .eq("status", "pending_deletion")
    .lte("scheduled_purge_at", nowIso);

  if (connLoadError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "connections_purge_lookup_failed",
      detail: connLoadError.message,
      partial: { purgedOrganizations },
    };
  }

  let purgedConnections = 0;
  const failedConnectionIds: string[] = [];
  for (const connection of connections ?? []) {
    const { error: deleteError } = await supabase.from("integration_connections").delete().eq("id", connection.id);
    if (deleteError) {
      logger.error("Failed to purge integration connection", {
        connection_id: connection.id,
        organization_id: connection.organization_id,
        error: deleteError.message,
      });
      failedConnectionIds.push(connection.id);
      continue;
    }
    purgedConnections += 1;
    await recordAuditLog(supabase, {
      organizationId: connection.organization_id,
      actorUserId: null,
      action: "consultant.purge_organization_store",
      entityType: "integration_connection",
      entityId: connection.id,
      oldData: connection,
    });
  }

  return {
    ok: true as const,
    data: { purgedOrganizations, purgedConnections, failedOrganizationIds, failedConnectionIds },
  };
}
