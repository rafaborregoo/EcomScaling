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
 * Dashboard del consultor en estado "vista general" (sin cliente activo):
 * resumen de toda la cartera. Reutiliza listConsultantOrganizations para
 * clientes / tiendas / plan / cola de atencion, y consultant_business_rollup
 * (SQL) para los totales de negocio del periodo y el periodo anterior.
 */
export async function getConsultantOverview(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  days: number,
) {
  const orgsResult = await listConsultantOrganizations(
    env,
    authorization,
    context,
  );
  if (orgsResult.ok === false) {
    return orgsResult;
  }

  const organizations = orgsResult.data.organizations;
  const orgIds = organizations.map((organization) => organization.id);

  const windowDays = [7, 30, 90].includes(days) ? days : 30;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const periodStart = new Date(now - windowDays * dayMs).toISOString();
  const periodEnd = new Date(now).toISOString();
  const prevStart = new Date(now - 2 * windowDays * dayMs).toISOString();

  const supabase = createServiceClient(env);
  const safeIds = orgIds.length
    ? orgIds
    : ["00000000-0000-0000-0000-000000000000"];

  const [
    { data: current, error: currentError },
    { data: previous, error: previousError },
    { data: reauthRows },
    { data: financialRows },
    { data: taskRows },
  ] = await Promise.all([
    supabase.rpc("consultant_business_rollup", {
      org_ids: safeIds,
      period_start: periodStart,
      period_end: periodEnd,
    }),
    supabase.rpc("consultant_business_rollup", {
      org_ids: safeIds,
      period_start: prevStart,
      period_end: periodStart,
    }),
    supabase
      .from("integration_connections")
      .select("organization_id, status")
      .eq("provider", "shopify")
      .in("organization_id", safeIds)
      .in("status", ["reauthorization_required", "needs_reauth"]),
    supabase
      .from("organization_financial_settings")
      .select("organization_id")
      .in("organization_id", safeIds),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_at, organization_id")
      .in("organization_id", safeIds)
      .in("status", ["pending", "in_progress"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(150),
  ]);

  if (currentError || previousError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_overview_rollup_failed",
      detail: currentError?.message ?? previousError?.message,
    };
  }

  const currentRow = (current ?? [])[0] ?? {};
  const previousRow = (previous ?? [])[0] ?? {};
  const num = (value: unknown) => Number(value ?? 0);

  const planMix: Record<string, number> = {};
  for (const organization of organizations) {
    const key = organization.subscription?.status ?? "sin_plan";
    planMix[key] = (planMix[key] ?? 0) + 1;
  }

  const orgsNeedingReauth = new Set(
    (reauthRows ?? []).map((row) => row.organization_id as string),
  );
  const orgsWithFinancial = new Set(
    (financialRows ?? []).map((row) => row.organization_id as string),
  );
  const nameByOrg = new Map(
    organizations.map((organization) => [organization.id, organization.display_name]),
  );

  // Un unico array con TODOS los clientes: alimenta las pestañas "Hoy" (cola
  // de prioridad por tier) y "Salud" (semaforo + problemas de datos) del
  // Dashboard general. tier = mismos tramos que attentionBadge en el front.
  const portfolio = organizations.map((organization) => {
    const dataIssues: string[] = [];
    if (orgsNeedingReauth.has(organization.id)) {
      dataIssues.push("Shopify por reautorizar");
    }
    if (
      organization.store_count > 0 &&
      !orgsWithFinancial.has(organization.id)
    ) {
      dataIssues.push("Sin configuración financiera");
    }
    const score = organization.attention.score;
    return {
      organization_id: organization.id,
      display_name: organization.display_name,
      store_count: organization.store_count,
      plan_status: organization.subscription?.status ?? null,
      score,
      tier:
        score >= 15
          ? "urgente"
          : score >= 5
            ? "revisar"
            : score > 0
              ? "vigilar"
              : "al_dia",
      open_alerts: organization.attention.open_alerts,
      critical_alerts: organization.attention.critical_alerts,
      high_alerts: organization.attention.high_alerts,
      oldest_alert_days: organization.attention.oldest_alert_days,
      open_tasks: organization.attention.open_tasks,
      overdue_tasks: organization.attention.overdue_tasks,
      data_issues: dataIssues,
    };
  });

  const nowMs = Date.now();
  const tasks = (taskRows ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    status: row.status as string,
    priority: row.priority as string,
    due_at: (row.due_at as string | null) ?? null,
    is_overdue: Boolean(row.due_at && Date.parse(row.due_at as string) < nowMs),
    organization_id: row.organization_id as string,
    organization_name:
      nameByOrg.get(row.organization_id as string) ??
      (row.organization_id as string),
  }));

  return {
    ok: true as const,
    data: {
      window_days: windowDays,
      clients: organizations.length,
      stores: organizations.reduce((sum, org) => sum + org.store_count, 0),
      plan_mix: planMix,
      business: {
        net_sales: num(currentRow.net_sales),
        orders: num(currentRow.orders_count),
        meta_spend: num(currentRow.meta_spend),
        meta_purchase_value: num(currentRow.meta_purchase_value),
        roas: currentRow.roas == null ? null : num(currentRow.roas),
        prev_net_sales: num(previousRow.net_sales),
        prev_orders: num(previousRow.orders_count),
        prev_meta_spend: num(previousRow.meta_spend),
      },
      portfolio,
      tasks,
    },
  };
}

/**
 * Tareas y alertas de TODA la cartera del consultor (estado "vista general"
 * de /tareas). Mismas columnas que listOperations por-org, con
 * organization_id/organization_name para agrupar y filtrar en el front. Usa
 * cliente user-scoped: la RLS (can_access_org -> is_assigned_consultant) ya
 * limita las filas a las organizaciones asignadas.
 */
export async function listConsultantOperations(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const orgsResult = await listConsultantOrganizations(
    env,
    authorization,
    context,
  );
  if (orgsResult.ok === false) {
    return orgsResult;
  }

  const organizations = orgsResult.data.organizations;
  const nameByOrg = new Map(
    organizations.map((organization) => [
      organization.id,
      organization.display_name,
    ]),
  );
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length
    ? ids
    : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const [tasksResult, alertsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, alert_id, source, status, priority, categories, title, description, due_at, is_visible_to_client, created_at, updated_at, organization_id, task_comments(id, body, is_internal, author_user_id, created_at)",
      )
      .in("organization_id", safeIds)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("alerts")
      .select(
        "id, status, severity, title, message, metric_value, threshold_value, first_detected_at, last_detected_at, resolved_at, organization_id",
      )
      .in("organization_id", safeIds)
      .order("last_detected_at", { ascending: false })
      .limit(400),
  ]);

  if (tasksResult.error || alertsResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_operations_load_failed",
      detail: tasksResult.error?.message ?? alertsResult.error?.message,
    };
  }

  const withName = <T extends { organization_id: string }>(row: T) => ({
    ...row,
    organization_name:
      nameByOrg.get(row.organization_id) ?? row.organization_id,
  });

  return {
    ok: true as const,
    data: {
      organizations: organizations.map((organization) => ({
        id: organization.id,
        display_name: organization.display_name,
      })),
      tasks: (tasksResult.data ?? []).map(withName),
      alerts: (alertsResult.data ?? []).map(withName),
    },
  };
}

/**
 * Espejo de marketing del consultor (estado "vista general" de /marketing):
 * todos los borradores de contenido que crean sus clientes, con nº de
 * objeciones. Cliente user-scoped -> la RLS workspace ya lo limita.
 */
export async function listConsultantMarketing(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const orgsResult = await listConsultantOrganizations(
    env,
    authorization,
    context,
  );
  if (orgsResult.ok === false) {
    return orgsResult;
  }

  const organizations = orgsResult.data.organizations;
  const nameByOrg = new Map(
    organizations.map((organization) => [
      organization.id,
      organization.display_name,
    ]),
  );
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length
    ? ids
    : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const [draftsResult, notesResult] = await Promise.all([
    supabase
      .from("marketing_content_drafts")
      .select(
        "id, organization_id, content_type, status, template_name, subject, summary, purpose, audience, locale, tone, plain_text, html, confidence, version, created_at, updated_at, decision_reason, request",
      )
      .in("organization_id", safeIds)
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase
      .from("marketing_content_draft_notes")
      .select("draft_id")
      .in("organization_id", safeIds),
  ]);

  if (draftsResult.error || notesResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_marketing_load_failed",
      detail: draftsResult.error?.message ?? notesResult.error?.message,
    };
  }

  const noteCount = new Map<string, number>();
  for (const note of notesResult.data ?? []) {
    const draftId = note.draft_id as string;
    noteCount.set(draftId, (noteCount.get(draftId) ?? 0) + 1);
  }

  const drafts = (draftsResult.data ?? []).map((draft) => ({
    ...draft,
    organization_name:
      nameByOrg.get(draft.organization_id as string) ??
      (draft.organization_id as string),
    note_count: noteCount.get(draft.id as string) ?? 0,
  }));

  return {
    ok: true as const,
    data: {
      organizations: organizations.map((organization) => ({
        id: organization.id,
        display_name: organization.display_name,
      })),
      drafts,
    },
  };
}

/** Objeciones/observaciones de un borrador de marketing. Cualquier miembro que
 * ve el borrador ve las notas (RLS workspace). */
export async function listMarketingDraftNotes(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  draftId: string,
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

  const { data, error } = await supabase
    .from("marketing_content_draft_notes")
    .select("id, body, author_user_id, created_at")
    .eq("draft_id", draftId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "marketing_draft_notes_load_failed",
      detail: error.message,
    };
  }

  const authorIds = [
    ...new Set(
      (data ?? [])
        .map((note) => note.author_user_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameById = new Map<string, string | null>();
  if (authorIds.length > 0) {
    const service = createServiceClient(env);
    const { data: profiles } = await service
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    for (const profile of profiles ?? []) {
      nameById.set(profile.id as string, profile.full_name as string | null);
    }
  }

  return {
    ok: true as const,
    data: {
      notes: (data ?? []).map((note) => ({
        ...note,
        author_name: note.author_user_id
          ? (nameById.get(note.author_user_id as string) ?? null)
          : null,
      })),
    },
  };
}

/** Añade una objeción a un borrador de marketing. Solo consultor asignado o
 * platform_admin (misma frontera que aprobar/rechazar). */
export async function addMarketingDraftNote(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  draftId: string,
  body: { body?: string },
) {
  if (
    !["platform_admin", "consultant"].includes(context.profile.platform_role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_access_required",
      message: "Solo un consultor o platform_admin puede añadir objeciones.",
    };
  }
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
  const text = body.body?.trim();
  if (!text) {
    return { ok: false as const, statusCode: 400, error: "note_body_required" };
  }

  const supabase = createServiceClient(env);

  const { data: draft, error: draftError } = await supabase
    .from("marketing_content_drafts")
    .select("id, organization_id")
    .eq("id", draftId)
    .maybeSingle();
  if (draftError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "marketing_draft_load_failed",
      detail: draftError.message,
    };
  }
  if (!draft || draft.organization_id !== organizationId) {
    return { ok: false as const, statusCode: 404, error: "draft_not_found" };
  }

  const { data: note, error } = await supabase
    .from("marketing_content_draft_notes")
    .insert({
      draft_id: draftId,
      organization_id: organizationId,
      author_user_id: context.user.id,
      body: text,
    })
    .select("id, body, author_user_id, created_at")
    .single();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "marketing_draft_note_save_failed",
      detail: error.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.add_marketing_draft_note",
    entityType: "marketing_content_draft",
    entityId: draftId,
    oldData: null,
    newData: { note_id: note.id },
  });

  return { ok: true as const, data: { note } };
}

/**
 * Cobertura de la base de conocimiento por cliente (estado "vista general" de
 * /conocimiento): nº de documentos activos y ultima actualizacion, para
 * detectar clientes con conocimiento escaso o desactualizado (degrada la IA).
 */
export async function listConsultantKnowledge(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const orgsResult = await listConsultantOrganizations(
    env,
    authorization,
    context,
  );
  if (orgsResult.ok === false) {
    return orgsResult;
  }

  const organizations = orgsResult.data.organizations;
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length
    ? ids
    : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("organization_id, updated_at")
    .eq("visibility", "organization")
    .eq("status", "active")
    .in("organization_id", safeIds);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_knowledge_load_failed",
      detail: error.message,
    };
  }

  const portfolio = organizations.map((organization) => {
    const docs = (data ?? []).filter(
      (doc) => doc.organization_id === organization.id,
    );
    const lastUpdatedAt = docs.reduce<string | null>((latest, doc) => {
      const value = doc.updated_at as string | null;
      if (!value) return latest;
      return !latest || value > latest ? value : latest;
    }, null);
    return {
      organization_id: organization.id,
      display_name: organization.display_name,
      doc_count: docs.length,
      last_updated_at: lastUpdatedAt,
    };
  });

  return { ok: true as const, data: { portfolio } };
}

/**
 * Todas las tiendas Shopify de la cartera (estado "vista general" de
 * /shopify): estado de conexion y frescura de sincronizacion por tienda, para
 * detectar de un vistazo cuales estan paradas o en error.
 */
export async function listConsultantStores(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const orgsResult = await listConsultantOrganizations(
    env,
    authorization,
    context,
  );
  if (orgsResult.ok === false) {
    return orgsResult;
  }

  const organizations = orgsResult.data.organizations;
  const nameByOrg = new Map(
    organizations.map((organization) => [
      organization.id,
      organization.display_name,
    ]),
  );
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length
    ? ids
    : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("integration_connections")
    .select(
      "id, organization_id, provider_account_name, provider_account_id, status, connected_at, last_sync_at",
    )
    .eq("provider", "shopify")
    .in("organization_id", safeIds)
    .order("last_sync_at", { ascending: true, nullsFirst: true });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_stores_load_failed",
      detail: error.message,
    };
  }

  const stores = (data ?? []).map((store) => ({
    id: store.id as string,
    organization_id: store.organization_id as string,
    organization_name:
      nameByOrg.get(store.organization_id as string) ??
      (store.organization_id as string),
    name:
      (store.provider_account_id as string | null) ??
      (store.provider_account_name as string | null) ??
      (store.id as string),
    status: store.status as string,
    connected_at: (store.connected_at as string | null) ?? null,
    last_sync_at: (store.last_sync_at as string | null) ?? null,
  }));

  return {
    ok: true as const,
    data: {
      organizations: organizations.map((organization) => ({
        id: organization.id,
        display_name: organization.display_name,
      })),
      stores,
    },
  };
}

/**
 * Matriz de integraciones de toda la cartera (estado "vista general" de
 * /integraciones): por cliente, el estado de cada proveedor conectado.
 */
export async function listConsultantIntegrations(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const orgsResult = await listConsultantOrganizations(
    env,
    authorization,
    context,
  );
  if (orgsResult.ok === false) {
    return orgsResult;
  }

  const organizations = orgsResult.data.organizations;
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length
    ? ids
    : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("integration_connections")
    .select(
      "organization_id, provider, status, last_sync_at, last_error_message",
    )
    .in("organization_id", safeIds);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_integrations_load_failed",
      detail: error.message,
    };
  }

  type Cell = {
    status: string;
    last_sync_at: string | null;
    last_error_message: string | null;
  };
  const byOrg = new Map<string, Record<string, Cell>>();
  const providerSet = new Set<string>();
  // Peor estado gana si un cliente tiene varias conexiones del mismo proveedor.
  const statusRank: Record<string, number> = {
    reauthorization_required: 4,
    needs_reauth: 4,
    error: 3,
    pending_deletion: 2,
    connected: 1,
    disconnected: 0,
  };
  for (const row of data ?? []) {
    const orgId = row.organization_id as string;
    const provider = row.provider as string;
    providerSet.add(provider);
    const cells = byOrg.get(orgId) ?? {};
    const existing = cells[provider];
    const nextStatus = row.status as string;
    if (
      !existing ||
      (statusRank[nextStatus] ?? 0) > (statusRank[existing.status] ?? 0)
    ) {
      cells[provider] = {
        status: nextStatus,
        last_sync_at: (row.last_sync_at as string | null) ?? null,
        last_error_message: (row.last_error_message as string | null) ?? null,
      };
    }
    byOrg.set(orgId, cells);
  }

  return {
    ok: true as const,
    data: {
      providers: [...providerSet].sort(),
      portfolio: organizations.map((organization) => ({
        organization_id: organization.id,
        display_name: organization.display_name,
        providers: byOrg.get(organization.id) ?? {},
      })),
    },
  };
}

/**
 * Llamadas de toda la cartera del consultor (estado "vista general" de
 * /llamadas), con senal de si el resumen esta pendiente de aprobar -- que es
 * la accion del consultor. El detalle/aprobacion sigue en la vista por-cliente.
 */
export async function listConsultantCalls(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const orgsResult = await listConsultantOrganizations(
    env,
    authorization,
    context,
  );
  if (orgsResult.ok === false) {
    return orgsResult;
  }

  const organizations = orgsResult.data.organizations;
  const nameByOrg = new Map(
    organizations.map((organization) => [
      organization.id,
      organization.display_name,
    ]),
  );
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length
    ? ids
    : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("consulting_calls")
    .select(
      "id, title, call_type, status, held_at, created_at, organization_id, call_ai_summaries(id, status)",
    )
    .in("organization_id", safeIds)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_calls_load_failed",
      detail: error.message,
    };
  }

  const calls = (data ?? []).map((call) => {
    const summaries =
      (call.call_ai_summaries as Array<{ status: string }> | null) ?? [];
    return {
      id: call.id as string,
      title: call.title as string,
      call_type: call.call_type as string,
      status: call.status as string,
      held_at: (call.held_at as string | null) ?? null,
      created_at: call.created_at as string,
      organization_id: call.organization_id as string,
      organization_name:
        nameByOrg.get(call.organization_id as string) ??
        (call.organization_id as string),
      summary_pending: summaries.some(
        (summary) => summary.status === "pending_approval",
      ),
      has_published_summary: summaries.some(
        (summary) => summary.status === "published",
      ),
    };
  });

  return {
    ok: true as const,
    data: {
      organizations: organizations.map((organization) => ({
        id: organization.id,
        display_name: organization.display_name,
      })),
      calls,
    },
  };
}

/**
 * Estado del plan estrategico ("Mi Camino") de toda la cartera del consultor,
 * mas la salud de cada cliente (reusa listConsultantOrganizations). Para el
 * estado "vista general" de /camino: por donde va cada plan sin entrar uno a
 * uno. Cliente user-scoped -> la RLS ya limita a las org asignadas.
 */
export async function listConsultantPlans(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const orgsResult = await listConsultantOrganizations(
    env,
    authorization,
    context,
  );
  if (orgsResult.ok === false) {
    return orgsResult;
  }

  const organizations = orgsResult.data.organizations;
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length
    ? ids
    : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const [plansResult, phasesResult, milestonesResult] = await Promise.all([
    supabase
      .from("strategic_plans")
      .select("id, organization_id, name, status, version, starts_on")
      .in("organization_id", safeIds),
    supabase
      .from("strategic_plan_phases")
      .select("organization_id, plan_id, name, status, position")
      .in("organization_id", safeIds)
      .order("position", { ascending: true }),
    supabase
      .from("strategic_plan_milestones")
      .select("organization_id, status")
      .in("organization_id", safeIds),
  ]);

  if (plansResult.error || phasesResult.error || milestonesResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_plans_load_failed",
      detail:
        plansResult.error?.message ??
        phasesResult.error?.message ??
        milestonesResult.error?.message,
    };
  }

  const planRank: Record<string, number> = {
    active: 3,
    completed: 2,
    draft: 1,
    archived: 0,
  };
  // Plan "actual" por organizacion: mejor estado, y a igualdad, version mas alta.
  const currentPlanByOrg = new Map<string, Record<string, unknown>>();
  for (const plan of plansResult.data ?? []) {
    const orgId = plan.organization_id as string;
    const existing = currentPlanByOrg.get(orgId);
    if (
      !existing ||
      (planRank[plan.status as string] ?? -1) >
        (planRank[existing.status as string] ?? -1) ||
      ((planRank[plan.status as string] ?? -1) ===
        (planRank[existing.status as string] ?? -1) &&
        Number(plan.version) > Number(existing.version))
    ) {
      currentPlanByOrg.set(orgId, plan);
    }
  }

  const portfolio = organizations.map((organization) => {
    const plan = currentPlanByOrg.get(organization.id) ?? null;
    const planId = plan?.id as string | undefined;
    const phases = (phasesResult.data ?? []).filter(
      (phase) => phase.plan_id === planId,
    );
    const activePhase =
      phases.find((phase) => phase.status === "active") ??
      phases.find((phase) => phase.status === "pending") ??
      null;
    const milestones = (milestonesResult.data ?? []).filter(
      (milestone) => milestone.organization_id === organization.id,
    );
    const milestonesTotal = milestones.filter(
      (milestone) => milestone.status !== "skipped",
    ).length;
    const milestonesDone = milestones.filter(
      (milestone) => milestone.status === "completed",
    ).length;

    const score = organization.attention.score;
    return {
      organization_id: organization.id,
      display_name: organization.display_name,
      health_tier:
        score >= 15
          ? "urgente"
          : score >= 5
            ? "revisar"
            : score > 0
              ? "vigilar"
              : "al_dia",
      health_score: score,
      overdue_tasks: organization.attention.overdue_tasks,
      critical_alerts: organization.attention.critical_alerts,
      plan: plan
        ? {
            id: plan.id as string,
            name: plan.name as string,
            status: plan.status as string,
            version: Number(plan.version),
            phase_count: phases.length,
            active_phase: activePhase
              ? (activePhase.name as string)
              : null,
            milestones_total: milestonesTotal,
            milestones_done: milestonesDone,
            progress_pct:
              milestonesTotal > 0
                ? Math.round((milestonesDone / milestonesTotal) * 100)
                : 0,
          }
        : null,
    };
  });

  return { ok: true as const, data: { portfolio } };
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

// Ventana por defecto para las estadisticas de uso de IA del panel.
const AI_STATS_WINDOW_DAYS = 30;

type AgentUsage = { name: string; runs: number };
type AiStats = {
  cost_usd: number;
  run_count: number;
  top_agents: AgentUsage[];
};

const EMPTY_AI_STATS: AiStats = { cost_usd: 0, run_count: 0, top_agents: [] };

function normalizeTopAgents(value: unknown): AgentUsage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => ({
      name: String((entry as { name?: unknown }).name ?? ""),
      runs: Number((entry as { runs?: unknown }).runs ?? 0),
    }))
    .filter((entry) => entry.name.length > 0);
}

/**
 * Vista platform_admin: todos los consultores con sus clientes asignados, la
 * lista completa de organizaciones para el selector de asignacion, y las
 * estadisticas de uso de IA (coste, ejecuciones, agentes mas usados) por
 * consultor y por cliente en los ultimos AI_STATS_WINDOW_DAYS dias. Asignar/
 * quitar reusa PUT /v1/consultant/organizations/:id/assignments.
 */
export async function listConsultants(env: ApiEnv, context: AuthContext) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) {
    return access;
  }

  const supabase = createServiceClient(env);
  const since = new Date(
    Date.now() - AI_STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    { data: organizations, error: orgsError },
    { data: assignments, error: assignmentsError },
    { data: consultantStats, error: consultantStatsError },
    { data: orgStats, error: orgStatsError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, display_name, slug, status")
      .order("display_name", { ascending: true }),
    supabase
      .from("consultant_assignments")
      .select("organization_id, consultant_user_id, is_primary, is_active")
      .eq("is_active", true),
    supabase.rpc("admin_consultant_ai_stats", { since }),
    supabase.rpc("admin_organization_ai_stats", { since }),
  ]);

  if (orgsError || assignmentsError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultants_load_failed",
      detail: orgsError?.message ?? assignmentsError?.message,
    };
  }

  // La lista de consultores = perfiles con rol 'consultant' MAS cualquier
  // perfil que tenga al menos una asignacion de cliente activa (asi un
  // platform_admin que se atiende a si mismo aparece, pero solo cuando de
  // verdad tiene clientes -- no todos los platform_admin del sistema).
  const assignedConsultantIds = [
    ...new Set(
      (assignments ?? []).map(
        (assignment) => assignment.consultant_user_id as string,
      ),
    ),
  ];

  let profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, platform_role, is_active")
    .order("full_name", { ascending: true });
  profilesQuery =
    assignedConsultantIds.length > 0
      ? profilesQuery.or(
          `platform_role.eq.consultant,id.in.(${assignedConsultantIds.join(",")})`,
        )
      : profilesQuery.eq("platform_role", "consultant");

  const { data: profiles, error: profilesError } = await profilesQuery;

  if (profilesError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultants_load_failed",
      detail: profilesError.message,
    };
  }

  // Las estadisticas de IA son complementarias: si las funciones rpc fallan
  // (p. ej. migracion aun no aplicada) la lista de consultores sigue
  // sirviendose, con las metricas a cero.
  if (consultantStatsError || orgStatsError) {
    logger.info("admin_ai_stats_unavailable", {
      consultantStatsError: consultantStatsError?.message,
      orgStatsError: orgStatsError?.message,
    });
  }

  const orgById = new Map(
    (organizations ?? []).map((org) => [org.id as string, org]),
  );
  const byConsultant = new Map<
    string,
    Array<{ organization_id: string; display_name: string; is_primary: boolean }>
  >();
  for (const assignment of assignments ?? []) {
    const consultantId = assignment.consultant_user_id as string;
    const orgId = assignment.organization_id as string;
    const list = byConsultant.get(consultantId) ?? [];
    list.push({
      organization_id: orgId,
      display_name: orgById.get(orgId)?.display_name ?? orgId,
      is_primary: Boolean(assignment.is_primary),
    });
    byConsultant.set(consultantId, list);
  }

  const consultantStatsById = new Map<string, AiStats>(
    ((consultantStats ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.consultant_user_id),
      {
        cost_usd: Number(row.total_cost_usd ?? 0),
        run_count: Number(row.run_count ?? 0),
        top_agents: normalizeTopAgents(row.top_agents),
      },
    ]),
  );
  const organizationStats: Record<string, AiStats> = {};
  for (const row of (orgStats ?? []) as Array<Record<string, unknown>>) {
    organizationStats[String(row.organization_id)] = {
      cost_usd: Number(row.total_cost_usd ?? 0),
      run_count: Number(row.run_count ?? 0),
      top_agents: normalizeTopAgents(row.top_agents),
    };
  }

  return {
    ok: true as const,
    data: {
      window_days: AI_STATS_WINDOW_DAYS,
      consultants: (profiles ?? []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        is_active: profile.is_active,
        assignments: byConsultant.get(profile.id as string) ?? [],
        ai: consultantStatsById.get(profile.id as string) ?? EMPTY_AI_STATS,
      })),
      organizations: organizations ?? [],
      organization_stats: organizationStats,
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

// Borrar/restaurar una tienda (web Shopify) de un cliente lo puede hacer el
// consultor asignado, no solo platform_admin. Mismo criterio que
// listOrganizationStores: rol consultor/admin + membership (real o virtual)
// sobre ESA organizacion. Editar/borrar el cliente entero sigue en
// requirePlatformAdmin.
function requireStoreManager(context: AuthContext, organizationId: string) {
  if (
    !["platform_admin", "consultant"].includes(context.profile.platform_role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_access_required",
      message: "El panel consultor requiere rol platform_admin o consultant.",
    };
  }
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
  const access = requireStoreManager(context, organizationId);
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
  const access = requireStoreManager(context, organizationId);
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
