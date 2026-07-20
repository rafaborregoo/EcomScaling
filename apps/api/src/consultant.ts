import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";

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
  organization_id: string;
  consultant_user_id: string;
  is_primary: boolean;
};

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

  if (!organizationsResult.ok) {
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
 * Borra una tienda (conexion Shopify) de un cliente. Cascada de FK
 * (integration_connections -> shopify_stores -> resto de tablas Shopify)
 * limpia todos los datos asociados. Accion irreversible: solo platform admin.
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
    .select("id, organization_id, provider")
    .eq("id", connectionId)
    .maybeSingle();

  if (loadError) {
    return { ok: false as const, statusCode: 500, error: "connection_load_failed", detail: loadError.message };
  }

  if (!connection || connection.organization_id !== organizationId || connection.provider !== "shopify") {
    return { ok: false as const, statusCode: 404, error: "connection_not_found" };
  }

  const { error: deleteError } = await supabase.from("integration_connections").delete().eq("id", connectionId);

  if (deleteError) {
    return { ok: false as const, statusCode: 500, error: "connection_delete_failed", detail: deleteError.message };
  }

  return { ok: true as const, data: { deleted_connection_id: connectionId } };
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

  return { ok: true as const, data: { organization } };
}

/**
 * Borra un cliente (organizacion) entero. Cascada de FK limpia memberships,
 * suscripciones, integraciones, datos Shopify, tareas, alertas, agentes IA,
 * conocimiento privado, etc. -- ver ADR de esquema, `on delete cascade` en
 * cada tabla hija de organizations. Accion irreversible: solo platform admin.
 */
export async function deleteOrganization(env: ApiEnv, context: AuthContext, organizationId: string) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) {
    return access;
  }

  const supabase = createServiceClient(env);

  const { data: organization, error: loadError } = await supabase
    .from("organizations")
    .select("id, display_name")
    .eq("id", organizationId)
    .maybeSingle();

  if (loadError) {
    return { ok: false as const, statusCode: 500, error: "organization_load_failed", detail: loadError.message };
  }

  if (!organization) {
    return { ok: false as const, statusCode: 404, error: "organization_not_found" };
  }

  const { error: deleteError } = await supabase.from("organizations").delete().eq("id", organizationId);

  if (deleteError) {
    return { ok: false as const, statusCode: 500, error: "organization_delete_failed", detail: deleteError.message };
  }

  return { ok: true as const, data: { deleted_organization_id: organizationId, display_name: organization.display_name } };
}
