import { randomInt } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { assignPartnersToOrganization } from "./consultant-partners.js";
import { isErr } from "./result-guard.js";
import { rankStores, type AgentSignal } from "./store-triage.js";
import { rankMetaAccounts, type MetaSignalRow } from "./meta-triage.js";
import {
  rankKlaviyoAccounts,
  type KlaviyoSignalRow,
} from "./klaviyo-triage.js";
import { loadDraftThreadSummaries } from "./ai-runtime.js";
import { connectionSeverity } from "./integrations.js";
import {
  authorizationPurgeCutoff,
  classifyAuthorizationAttempt,
  isPurgeableAuthorizationAttempt,
  observeMaturity,
} from "@ecomscaling/contracts";
import { leerHechos } from "./maturity-engine.js";
import { createLogger } from "@ecomscaling/observability";
import { sendInviteMail } from "./invite-mailer.js";

const logger = createLogger("consultant");

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  // Base del frontend (Vercel en prod, localhost en local). El enlace de la
  // invitación de Supabase apunta aquí -> /onboarding. Ambas URLs deben estar
  // en Authentication > URL Configuration > Redirect URLs del proyecto.
  WEB_ORIGIN?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_BREVO?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
};

function onboardingRedirectTo(env: ApiEnv): string {
  return `${(env.WEB_ORIGIN ?? "http://localhost:3001").replace(/\/$/, "")}/onboarding`;
}

// R-008: periodo de gracia entre marcar una organizacion/tienda para borrado
// y su purga fisica real. Ver ADR-0009/Q-009 y migracion db-13.
const RETENTION_PERIOD_DAYS = 30;

function scheduledPurgeAt(): string {
  return new Date(
    Date.now() + RETENTION_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
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

async function loadOrganizations(
  supabase: SupabaseClient,
  organizationIds?: string[],
) {
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

    // Las tiendas propias del consultor (createOwnStore: membership real de
    // owner, sin consultant_assignment) tienen que entrar aqui. De esta lista
    // cuelgan integraciones, planificacion, agenda y el rollup del dashboard,
    // asi que dejandola solo en las asignaciones la tienda se creaba bien en la
    // base de datos y luego no aparecia en ningun sitio donde conectarla:
    // "Sin clientes" en /integraciones aunque la tienda existiera.
    const ownStoreIds = context.memberships
      .filter((membership) => membership.accessSource === "membership")
      .map((membership) => membership.organization_id);

    organizationIds = [
      ...new Set([
        ...(data ?? []).map((row) => row.organization_id as string),
        ...ownStoreIds,
      ]),
    ];
  }

  const organizationsResult = await loadOrganizations(
    supabase,
    organizationIds,
  );

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
    .in(
      "organization_id",
      ids.length ? ids : ["00000000-0000-0000-0000-000000000000"],
    );

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
    .in(
      "organization_id",
      ids.length ? ids : ["00000000-0000-0000-0000-000000000000"],
    )
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
    .in(
      "organization_id",
      ids.length ? ids : ["00000000-0000-0000-0000-000000000000"],
    );

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
    storeCountByOrganization.set(
      orgId,
      (storeCountByOrganization.get(orgId) ?? 0) + 1,
    );
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

  const severityWeight: Record<string, number> = {
    critical: 10,
    high: 5,
    medium: 2,
    low: 1,
    info: 0,
  };
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
    const orgAlerts = (alertRows ?? []).filter(
      (row) => row.organization_id === id,
    );
    const orgTasks = (taskRows ?? []).filter(
      (row) => row.organization_id === id,
    );

    const oldestAlertDays = orgAlerts.reduce((max, row) => {
      const detectedAt = row.first_detected_at
        ? Date.parse(row.first_detected_at as string)
        : now;
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
      critical_alerts: orgAlerts.filter((row) => row.severity === "critical")
        .length,
      high_alerts: orgAlerts.filter((row) => row.severity === "high").length,
      oldest_alert_days: oldestAlertDays,
      overdue_tasks: overdueTasks,
      open_tasks: orgTasks.length,
      score: severityScore + Math.min(oldestAlertDays, 14) + overdueTasks * 3,
    });
  }

  // Una tienda propia se opera igual que un cliente (integraciones, metricas,
  // tareas) pero no es cartera. Quien liste "Clientes" filtra por esto en vez
  // de adivinarlo cruzando memberships en el navegador.
  const ownStoreIdSet = new Set(
    context.memberships
      .filter((membership) => membership.accessSource === "membership")
      .map((membership) => membership.organization_id),
  );

  const enriched = organizations.map((organization) => ({
    ...organization,
    is_own_store: ownStoreIdSet.has(organization.id),
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

type OrdersByOrgRow = {
  organization_id: string;
  orders_count: number | string;
  net_sales: number | string;
};

// Filas del widget "Pedidos": pedidos + facturacion por cliente en un rango,
// ordenadas por facturacion desc. Clientes sin pedidos fuera. Sin numerar: el
// orden es la unica senal de ranking.
function rankOrdersByOrg(
  organizations: Array<{
    id: string;
    display_name: string;
    currency_code?: string | null;
  }>,
  rpcRows: OrdersByOrgRow[] | null,
) {
  const byOrg = new Map(
    (rpcRows ?? []).map((row) => [row.organization_id, row]),
  );
  const num = (value: unknown) => Number(value ?? 0);
  return organizations
    .map((organization) => {
      const row = byOrg.get(organization.id);
      return {
        organization_id: organization.id,
        display_name: organization.display_name,
        currency_code: organization.currency_code ?? "EUR",
        orders_count: num(row?.orders_count),
        net_sales: num(row?.net_sales),
      };
    })
    .filter((entry) => entry.orders_count > 0)
    .sort((a, b) => b.net_sales - a.net_sales);
}

type OrdersByStoreRow = {
  store_id: string;
  organization_id: string;
  shop_name: string | null;
  myshopify_domain: string | null;
  currency_code: string | null;
  orders_count: number | string;
  net_sales: number | string;
  units_sold: number | string;
};

// Ranking de TIENDAS por volumen de pedidos (no por facturacion, como el de
// clientes): un cliente puede tener varias tiendas y el agregado por cliente
// esconde que dentro de el una tira y otra esta parada. Se ordena por pedidos
// y se desempata por facturacion. Tiendas sin pedidos en el rango fuera.
export function rankOrdersByStore(
  organizations: Array<{ id: string; display_name: string }>,
  rpcRows: OrdersByStoreRow[] | null,
) {
  const nameByOrg = new Map(
    organizations.map((organization) => [
      organization.id,
      organization.display_name,
    ]),
  );
  const num = (value: unknown) => Number(value ?? 0);
  return (rpcRows ?? [])
    .map((row) => ({
      store_id: row.store_id,
      organization_id: row.organization_id,
      organization_name: nameByOrg.get(row.organization_id) ?? "—",
      shop_name: row.shop_name ?? row.myshopify_domain ?? "Tienda",
      myshopify_domain: row.myshopify_domain,
      currency_code: row.currency_code ?? "EUR",
      orders_count: num(row.orders_count),
      net_sales: num(row.net_sales),
      units_sold: num(row.units_sold),
      // AOV por tienda: el dato que hace comparable a dos tiendas con volumen
      // muy distinto, y que el consultor mira justo despues del ranking.
      aov:
        num(row.orders_count) > 0
          ? num(row.net_sales) / num(row.orders_count)
          : 0,
    }))
    .filter((entry) => entry.orders_count > 0)
    .sort(
      (a, b) => b.orders_count - a.orders_count || b.net_sales - a.net_sales,
    );
}

/**
 * Widget "Pedidos" del Dashboard del consultor con rango de fechas propio
 * (los botones 1d/3d/1sem/1mes/personalizado). Mismo desglose por cliente que
 * el `orders_last_24h` de getConsultantOverview, pero para el rango pedido.
 */
export async function listConsultantOrders(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  fromIso: string,
  toIso: string,
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
  const safeIds = organizations.length
    ? organizations.map((organization) => organization.id)
    : ["00000000-0000-0000-0000-000000000000"];

  const supabase = createServiceClient(env);
  const [totalsResult, dailyResult, storesResult] = await Promise.all([
    supabase.rpc("consultant_orders_by_org", {
      org_ids: safeIds,
      period_start: fromIso,
      period_end: toIso,
    }),
    supabase.rpc("consultant_orders_daily_by_org", {
      org_ids: safeIds,
      period_start: fromIso,
      period_end: toIso,
    }),
    supabase.rpc("consultant_orders_by_store", {
      org_ids: safeIds,
      period_start: fromIso,
      period_end: toIso,
    }),
  ]);

  if (totalsResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_orders_load_failed",
      detail: totalsResult.error.message,
    };
  }

  // El grafico de evolucion es secundario: si su funcion falla (p. ej.
  // migracion aun sin aplicar) el ranking sigue devolviendose y `daily` va
  // vacio -> el front muestra la lista sin la linea temporal.
  if (dailyResult.error) {
    logger.error(
      "consultant_orders_daily_by_org failed; returning ranking without chart series",
      dailyResult.error.message,
    );
  }

  // El ranking por tienda es igual de secundario que el grafico: si su funcion
  // aun no esta aplicada, el widget sigue mostrando el ranking por cliente.
  if (storesResult.error) {
    logger.error(
      "consultant_orders_by_store failed; returning ranking without store breakdown",
      storesResult.error.message,
    );
  }

  const daily = (
    (dailyResult.data ?? []) as Array<{
      bucket_date: string;
      organization_id: string;
      orders_count: number | string;
    }>
  ).map((row) => ({
    bucket_date: row.bucket_date,
    organization_id: row.organization_id,
    orders_count: Number(row.orders_count ?? 0),
  }));

  return {
    ok: true as const,
    data: {
      from: fromIso,
      to: toIso,
      rows: rankOrdersByOrg(
        organizations,
        totalsResult.data as OrdersByOrgRow[] | null,
      ),
      // Ranking por tienda, ordenado por numero de pedidos.
      stores: rankOrdersByStore(
        organizations,
        storesResult.data as OrdersByStoreRow[] | null,
      ),
      // Serie diaria por cliente para el grafico de evolucion. El frontend
      // rellena los dias sin pedidos con 0.
      daily,
    },
  };
}

// Widget "Tareas que propone la IA" (vista general del consultor): por cada
// cliente, las tareas que los agentes de operativa (Shopify a13, Meta a14,
// email a12) proponen implementar. Solo lectura de la ultima salida CACHEADA
// de cada agente (las regenera el orquestador); aqui no se aprueba nada.
type ProposedArea = "shopify" | "meta" | "klaviyo";

const OPERATIVA_AGENT_AREA: Record<string, ProposedArea> = {
  a13_operativa_shopify: "shopify",
  // Los tres especialistas proponen tarea de tienda igual que A13: sus
  // propuestas tienen que llegar al mismo sitio o el consultor no las ve.
  a20_retencion_clientes: "shopify",
  a21_adquisicion_shopify: "shopify",
  a22_postventa_shopify: "shopify",
  a14_operativa_meta: "meta",
  a12_analista_email: "klaviyo",
  // Los planes por horizonte (dia/semana/mes) proponen en los tres canales:
  // el area sale de `categories` de cada propuesta y esto es solo el fallback.
  a04_generador_tareas: "shopify",
  a17_plan_semanal: "shopify",
  a18_plan_mensual: "shopify",
};

/** Canal real de una propuesta: lo dice `categories`; si no, el del agente. */
function areaForWrite(
  write: Record<string, unknown>,
  fallback: ProposedArea,
): ProposedArea {
  const categories = Array.isArray(write.categories) ? write.categories : [];
  for (const category of categories) {
    if (
      category === "shopify" ||
      category === "meta" ||
      category === "klaviyo"
    ) {
      return category;
    }
  }
  return fallback;
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

type ProposedTask = {
  area: "shopify" | "meta" | "klaviyo";
  title: string;
  rationale: string;
  description: string;
  priority: string;
  phase: string | null;
  pending_approval: boolean;
  // Salida de la que viene la propuesta y su posicion dentro de
  // `proposed_writes`. Sin estas dos coordenadas la lista es solo de lectura:
  // son lo que necesita /tareas para aprobar o editar esta tarea concreta via
  // POST /ai/outputs/:outputId/decision.
  output_id: string;
  write_index: number;
  // Cifras en las que se apoya la propuesta (ver agentEvidenceItemSchema).
  evidence: Array<{
    label: string;
    value: string;
    period: string | null;
    source: string;
  }>;
};

export async function listConsultantProposedTasks(
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
  const safeIds = organizations.length
    ? organizations.map((organization) => organization.id)
    : ["00000000-0000-0000-0000-000000000000"];

  const supabase = createServiceClient(env);
  const { data: runs, error } = await supabase
    .from("agent_runs")
    .select(
      "organization_id, started_at, finished_at, agent_versions!inner(agent_definitions!inner(code)), agent_outputs(id, status, output)",
    )
    .in("organization_id", safeIds)
    .in(
      "agent_versions.agent_definitions.code",
      Object.keys(OPERATIVA_AGENT_AREA),
    )
    .eq("status", "succeeded")
    .is("store_id", null)
    .order("started_at", { ascending: false })
    .limit(300);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_proposed_tasks_load_failed",
      detail: error.message,
    };
  }

  const codeOf = (run: Record<string, unknown>): string | null => {
    const versions = run.agent_versions as
      | { agent_definitions?: { code?: string } }
      | { agent_definitions?: { code?: string } }[]
      | null;
    const version = Array.isArray(versions) ? versions[0] : versions;
    return version?.agent_definitions?.code ?? null;
  };
  const outputOf = (run: Record<string, unknown>) => {
    const raw = run.agent_outputs as
      | { id?: string; status?: string; output?: unknown }
      | { id?: string; status?: string; output?: unknown }[]
      | null;
    return Array.isArray(raw) ? raw[0] : raw;
  };

  // Solo la salida mas reciente por (cliente, agente).
  const seen = new Set<string>();
  const tasksByOrg = new Map<string, ProposedTask[]>();

  for (const run of (runs ?? []) as Array<Record<string, unknown>>) {
    const code = codeOf(run);
    const orgId = run.organization_id as string;
    if (!code) continue;
    const key = `${orgId}:${code}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const area = OPERATIVA_AGENT_AREA[code];
    if (!area) continue;
    const output = outputOf(run);
    const outputId = typeof output?.id === "string" ? output.id : null;
    if (!outputId) continue;
    const content = (output?.output ?? {}) as Record<string, unknown>;
    const pending = output?.status === "pending_approval";
    const rawWrites = Array.isArray(content.proposed_writes)
      ? content.proposed_writes
      : [];

    const list = tasksByOrg.get(orgId) ?? [];
    // `writeIndex` es la posicion en el `proposed_writes` original, no en la
    // lista filtrada: es la coordenada con la que /tareas edita esta entrada.
    let writeIndex = -1;
    for (const write of rawWrites as Array<Record<string, unknown>>) {
      writeIndex += 1;
      const title = typeof write.title === "string" ? write.title.trim() : "";
      if (!title) continue;
      const phaseRaw = write.phase;
      // La evidencia la escribe un LLM: se filtra a las entradas con forma
      // valida en vez de confiar en el array tal cual.
      const evidence = (
        Array.isArray(write.evidence) ? write.evidence : []
      ).flatMap((item: unknown) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const label = typeof row.label === "string" ? row.label.trim() : "";
        const value = typeof row.value === "string" ? row.value.trim() : "";
        if (!label || !value) return [];
        return [
          {
            label,
            value,
            period: typeof row.period === "string" ? row.period : null,
            source: typeof row.source === "string" ? row.source : "interno",
          },
        ];
      });

      list.push({
        output_id: outputId,
        write_index: writeIndex,
        evidence,
        area: areaForWrite(write, area),
        title,
        rationale:
          typeof write.rationale === "string" ? write.rationale.trim() : "",
        description:
          typeof write.description === "string" ? write.description.trim() : "",
        priority:
          typeof write.priority === "string" ? write.priority : "medium",
        phase:
          typeof phaseRaw === "string" && phaseRaw.trim().length > 0
            ? phaseRaw.trim()
            : null,
        pending_approval: pending,
      });
    }
    tasksByOrg.set(orgId, list);
  }

  // Cliente que peor va primero (misma senal que la cola de atencion); dentro
  // de cada cliente, la tarea mas prioritaria arriba.
  const clients = organizations
    .map((organization) => ({
      organization_id: organization.id,
      display_name: organization.display_name,
      attention_score: organization.attention.score,
      tasks: (tasksByOrg.get(organization.id) ?? []).sort(
        (a, b) =>
          (PRIORITY_RANK[b.priority] ?? 2) - (PRIORITY_RANK[a.priority] ?? 2),
      ),
    }))
    .filter((client) => client.tasks.length > 0)
    .sort((a, b) => b.attention_score - a.attention_score);

  return { ok: true as const, data: { clients } };
}

// Widget "Meta Ads · cartera": lista de clientes rankeada por "cuanto hay que
// revisar su cuenta de Meta". Score determinista (sin IA, explicable):
// ROAS bajo el break-even, ROAS < 1, ROAS cayendo vs. el periodo comparado,
// CAC por encima de la contribucion del primer pedido, dependencia alta de
// Meta con ROAS flojo, datos incompletos y gasto sin ventas.
type MetaByOrgRow = {
  organization_id: string;
  spend: number | string;
  impressions: number | string;
  clicks: number | string;
  purchases: number | string;
  purchase_value: number | string;
  roas: number | string | null;
  cac: number | string | null;
  days_with_data: number | string;
};

const META_COMPARE_MONTH = { window: 30, back: 30 } as const;
const META_COMPARE_OFFSET_DAYS: Record<
  string,
  { window: number; back: number }
> = {
  week: { window: 7, back: 7 },
  month: META_COMPARE_MONTH,
  year: { window: 30, back: 365 },
};

function pctChange(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export async function listConsultantMetaPortfolio(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  compare: string,
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
  const safeIds = organizations.length
    ? organizations.map((organization) => organization.id)
    : ["00000000-0000-0000-0000-000000000000"];

  const cmp = META_COMPARE_OFFSET_DAYS[compare] ?? META_COMPARE_MONTH;
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const iso = (ms: number) => new Date(ms).toISOString();

  const curStart = now - cmp.window * dayMs;
  const prevEnd = now - cmp.back * dayMs;
  const prevStart = prevEnd - cmp.window * dayMs;

  const supabase = createServiceClient(env);
  const [curRes, prevRes, financials, backfillConns] = await Promise.all([
    supabase.rpc("consultant_meta_by_org", {
      org_ids: safeIds,
      period_start: day(curStart),
      period_end: day(now),
    }),
    supabase.rpc("consultant_meta_by_org", {
      org_ids: safeIds,
      period_start: day(prevStart),
      period_end: day(prevEnd),
    }),
    Promise.all(
      organizations.map(async (organization) => {
        const { data } = await supabase.rpc("shopify_financial_summary", {
          target_organization_id: organization.id,
          period_start: iso(curStart),
          period_end: iso(now),
          target_store_id: null,
        });
        return [organization.id, (data ?? [])[0] ?? null] as const;
      }),
    ),
    supabase
      .from("integration_connections")
      .select("metadata")
      .eq("provider", "meta_ads")
      .in("organization_id", safeIds),
  ]);

  // Cuántas cuentas de la cartera están importando su histórico ahora mismo
  // (para el banner del widget).
  const backfillingAccounts = (backfillConns.data ?? []).filter((row) => {
    const state = (row.metadata as { backfill?: { status?: string } } | null)
      ?.backfill;
    return state?.status === "running";
  }).length;

  if (curRes.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_meta_portfolio_load_failed",
      detail: curRes.error.message,
    };
  }

  const num = (value: unknown): number => Number(value ?? 0);
  const numOrNull = (value: unknown): number | null =>
    value == null ? null : Number(value);
  const byId = <T extends { organization_id: string }>(rows: T[] | null) =>
    new Map((rows ?? []).map((row) => [row.organization_id, row]));

  const curById = byId((curRes.data ?? null) as MetaByOrgRow[] | null);
  const prevById = byId((prevRes.data ?? null) as MetaByOrgRow[] | null);
  const finById = new Map(financials);

  const clients = organizations
    .map((organization) => {
      const cur = curById.get(organization.id);
      const prev = prevById.get(organization.id);
      const fin = finById.get(organization.id) as
        | {
            net_sales?: unknown;
            gross_margin?: unknown;
            orders_count?: unknown;
            has_settings?: unknown;
          }
        | null
        | undefined;

      const spend = num(cur?.spend);
      const prevSpend = num(prev?.spend);
      const roas = numOrNull(cur?.roas);
      const prevRoas = numOrNull(prev?.roas);
      const cac = numOrNull(cur?.cac);
      const impressions = num(cur?.impressions);
      const clicks = num(cur?.clicks);
      const purchases = num(cur?.purchases);
      const purchaseValue = num(cur?.purchase_value);
      const daysWithData = num(cur?.days_with_data);

      const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
      const prevImpr = num(prev?.impressions);
      const prevCtr =
        prevImpr > 0 ? (num(prev?.clicks) / prevImpr) * 100 : null;
      const prevCpm = prevImpr > 0 ? (prevSpend / prevImpr) * 1000 : null;

      const hasSettings = fin?.has_settings === true;
      const netSales = num(fin?.net_sales);
      const grossMargin = num(fin?.gross_margin);
      const finOrders = num(fin?.orders_count);
      const breakEvenRoas =
        hasSettings && grossMargin > 0 ? netSales / grossMargin : null;
      const contributionPerOrder =
        grossMargin > 0 && finOrders > 0 ? grossMargin / finOrders : null;
      const dependencyPct =
        netSales > 0 ? (purchaseValue / netSales) * 100 : null;

      const roasDeltaPct = pctChange(roas ?? 0, prevRoas);

      let score = 0;
      if (roas != null && breakEvenRoas != null && roas < breakEvenRoas) {
        score += ((breakEvenRoas - roas) / breakEvenRoas) * 40;
      }
      if (roas != null && roas < 1) score += (1 - roas) * 20;
      if (roasDeltaPct != null && roasDeltaPct < 0) {
        score += Math.min(-roasDeltaPct, 100) * 0.3;
      }
      if (
        cac != null &&
        contributionPerOrder != null &&
        cac > contributionPerOrder
      ) {
        score += ((cac - contributionPerOrder) / contributionPerOrder) * 15;
      }
      if (
        dependencyPct != null &&
        dependencyPct > 40 &&
        roas != null &&
        (breakEvenRoas == null || roas < breakEvenRoas)
      ) {
        score += dependencyPct * 0.2;
      }
      if (spend > 0 && daysWithData < cmp.window * 0.5) score += 10;
      if (spend > 0 && purchases === 0) score += 25;

      return {
        organization_id: organization.id,
        display_name: organization.display_name,
        currency_code: organization.currency_code ?? "EUR",
        score: Math.round(score * 10) / 10,
        spend,
        impressions,
        clicks,
        purchases,
        purchase_value: purchaseValue,
        roas,
        cac,
        ctr,
        cpm,
        days_with_data: daysWithData,
        break_even_roas: breakEvenRoas,
        contribution_per_order: contributionPerOrder,
        dependency_pct: dependencyPct,
        delta: {
          spend_pct: pctChange(spend, prevSpend || null),
          roas_pct: roasDeltaPct,
          cac_pct: pctChange(cac ?? 0, numOrNull(prev?.cac)),
          purchases_pct: pctChange(purchases, num(prev?.purchases) || null),
          purchase_value_pct: pctChange(
            purchaseValue,
            num(prev?.purchase_value) || null,
          ),
          ctr_pct: pctChange(ctr ?? 0, prevCtr),
          cpm_pct: pctChange(cpm ?? 0, prevCpm),
        },
      };
    })
    .filter((client) => client.spend > 0)
    .sort((a, b) => b.score - a.score);

  return {
    ok: true as const,
    data: {
      compare: compare in META_COMPARE_OFFSET_DAYS ? compare : "month",
      window_days: cmp.window,
      backfilling_accounts: backfillingAccounts,
      clients,
    },
  };
}

// Widget "Email · campañas por cliente" (vista general): por cada cliente,
// cuantas campanas Klaviyo envio en la ventana + su rendimiento atribuido.
// Ranking = mas campanas primero. Enlaces por fila a /marketing (resultados) y
// /planificacion/tracking, cambiando el cliente activo.
const KLAVIYO_WINDOW_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

type KlaviyoByOrgRow = {
  organization_id: string;
  campaigns_sent: number | string;
  last_send_at: string | null;
  revenue: number | string;
  recipients: number | string;
  opens_unique: number | string;
  clicks_unique: number | string;
};

export async function listConsultantKlaviyoPortfolio(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  windowKey: string,
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
  const safeIds = organizations.length
    ? organizations.map((organization) => organization.id)
    : ["00000000-0000-0000-0000-000000000000"];

  const days =
    windowKey in KLAVIYO_WINDOW_DAYS ? KLAVIYO_WINDOW_DAYS[windowKey] : 30;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const periodStart =
    days == null
      ? "2000-01-01T00:00:00.000Z"
      : new Date(now - days * dayMs).toISOString();
  const periodEnd = new Date(now).toISOString();

  const supabase = createServiceClient(env);
  const { data, error } = await supabase.rpc("consultant_klaviyo_by_org", {
    org_ids: safeIds,
    period_start: periodStart,
    period_end: periodEnd,
  });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_klaviyo_load_failed",
      detail: error.message,
    };
  }

  const byOrg = new Map(
    ((data ?? []) as KlaviyoByOrgRow[]).map((row) => [
      row.organization_id,
      row,
    ]),
  );
  const num = (value: unknown) => Number(value ?? 0);

  const clients = organizations
    .map((organization) => {
      const row = byOrg.get(organization.id);
      const recipients = num(row?.recipients);
      return {
        organization_id: organization.id,
        display_name: organization.display_name,
        currency_code: organization.currency_code ?? "EUR",
        campaigns_sent: num(row?.campaigns_sent),
        last_send_at: row?.last_send_at ?? null,
        revenue: num(row?.revenue),
        recipients,
        open_rate: recipients > 0 ? num(row?.opens_unique) / recipients : null,
        click_rate:
          recipients > 0 ? num(row?.clicks_unique) / recipients : null,
      };
    })
    .filter((client) => client.campaigns_sent > 0)
    .sort(
      (a, b) => b.campaigns_sent - a.campaigns_sent || b.revenue - a.revenue,
    );

  return {
    ok: true as const,
    data: {
      window: windowKey in KLAVIYO_WINDOW_DAYS ? windowKey : "30d",
      clients,
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
  // El widget "Pedidos" es siempre 24h, independiente del periodo del resto.
  const last24hStart = new Date(now - dayMs).toISOString();

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
    { data: orders24hRows },
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
    supabase.rpc("consultant_orders_by_org", {
      org_ids: safeIds,
      period_start: last24hStart,
      period_end: periodEnd,
    }),
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
    organizations.map((organization) => [
      organization.id,
      organization.display_name,
    ]),
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

  // Widget "Pedidos": una fila por cliente con pedidos en el rango, ordenadas
  // por facturacion desc (el que mas factura, arriba). Sin numerar.
  const ordersLast24h = rankOrdersByOrg(
    organizations,
    orders24hRows as OrdersByOrgRow[] | null,
  );

  // Tiendas propias del consultor (membership real): no son "cartera", van en
  // su propio bloque del Dashboard. Si falla, no tumba la vista general.
  const ownStoresResult = await listOwnStoresOverview(env, context, windowDays);
  const ownStores = ownStoresResult.ok ? ownStoresResult.data.stores : [];

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
      orders_last_24h: ordersLast24h,
      own_stores: ownStores,
    },
  };
}

/**
 * Agenda del consultor (dashboard vista general + pagina /agenda). Reune, en una
 * ventana [from, to): tareas con due_at de la cartera, dias de planificacion de
 * campanas (campaign_calendar_items) e hitos de Mi Camino con target_date.
 * scope:
 *   - "own": tareas de las tiendas propias del consultor (membership real) +
 *     cualquier tarea assigned_to/created_by el consultor en el resto de la
 *     cartera. Planificacion e hitos: solo de las tiendas propias.
 *   - "all": toda la cartera asignada.
 *   - "<organizationId>": solo esa org (debe ser accesible).
 * Cliente user-scoped: la RLS limita las filas a las orgs accesibles.
 */
export async function listConsultantAgenda(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  params: {
    from?: string | undefined;
    to?: string | undefined;
    scope?: string | undefined;
  },
) {
  // La agenda la usan consultor/admin (cartera completa) y también el cliente
  // (solo su workspace: `context.memberships` ya lo limita, y la RLS remata).
  const fromMs = params.from ? Date.parse(params.from) : NaN;
  const toMs = params.to ? Date.parse(params.to) : NaN;
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs <= fromMs) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "agenda_range_invalid",
    };
  }
  if (toMs - fromMs > 62 * 86_400_000) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "agenda_range_too_large",
    };
  }
  const fromIso = new Date(fromMs).toISOString();
  const toIso = new Date(toMs).toISOString();
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);

  const scope = params.scope || "all";
  const nameByOrg = new Map<string, string>();
  for (const membership of context.memberships) {
    nameByOrg.set(
      membership.organization_id,
      membership.organization?.display_name ?? membership.organization_id,
    );
  }
  const allOrgIds = [...nameByOrg.keys()];
  const ownOrgIds = context.memberships
    .filter((membership) => membership.accessSource === "membership")
    .map((membership) => membership.organization_id);

  if (scope !== "own" && scope !== "all" && !nameByOrg.has(scope)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  // Orgs para planificacion e hitos (bloques ligados a una org concreta).
  const scopedOrgIds =
    scope === "all" ? allOrgIds : scope === "own" ? ownOrgIds : [scope];
  const sentinel = "00000000-0000-0000-0000-000000000000";
  const safe = (ids: string[]) => (ids.length ? ids : [sentinel]);

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  let tasksQuery = supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_at, organization_id, source, is_visible_to_client",
    )
    .not("due_at", "is", null)
    .gte("due_at", fromIso)
    .lt("due_at", toIso);

  if (scope === "own") {
    // Tiendas propias enteras + tareas del consultor en cualquier org accesible
    // (la RLS ya limita las filas del OR a orgs asignadas).
    tasksQuery = tasksQuery.or(
      [
        `organization_id.in.(${safe(ownOrgIds).join(",")})`,
        `assigned_to.eq.${context.user.id}`,
        `created_by.eq.${context.user.id}`,
      ].join(","),
    );
  } else if (scope === "all") {
    // ponytail: para platform_admin allOrgIds puede ser grande; mismo patron
    // que listConsultantOperations. Paginar/acotar si llega a doler.
    tasksQuery = tasksQuery.in("organization_id", safe(allOrgIds));
  } else {
    tasksQuery = tasksQuery.eq("organization_id", scope);
  }

  const [tasksResult, planningResult, milestonesResult] = await Promise.all([
    tasksQuery.order("due_at", { ascending: true }).limit(500),
    supabase
      .from("campaign_calendar_items")
      .select(
        "id, title, channel, item_type, starts_at, ends_at, status, organization_id, blocked_reason, marketing_draft_id",
      )
      .in("organization_id", safe(scopedOrgIds))
      .is("deleted_at", null)
      .gte("starts_at", fromIso)
      .lt("starts_at", toIso)
      .order("starts_at", { ascending: true })
      .limit(500),
    supabase
      .from("strategic_plan_milestones")
      .select(
        "id, name, target_date, status, organization_id, strategic_plan_phases(name)",
      )
      .in("organization_id", safe(scopedOrgIds))
      .not("target_date", "is", null)
      .gte("target_date", fromDate)
      .lte("target_date", toDate)
      .order("target_date", { ascending: true })
      .limit(500),
  ]);

  const firstError =
    tasksResult.error || planningResult.error || milestonesResult.error;
  if (firstError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "agenda_load_failed",
      detail: firstError.message,
    };
  }

  const orgName = (id: string) => nameByOrg.get(id) ?? id;
  const phaseName = (embedded: unknown): string | null => {
    if (Array.isArray(embedded)) {
      return (embedded[0] as { name?: string } | undefined)?.name ?? null;
    }
    return (embedded as { name?: string } | null)?.name ?? null;
  };

  return {
    ok: true as const,
    data: {
      from: fromIso,
      to: toIso,
      scope,
      tasks: (tasksResult.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        priority: row.priority as string,
        due_at: row.due_at as string,
        organization_id: row.organization_id as string,
        organization_name: orgName(row.organization_id as string),
        source: row.source as string,
        is_visible_to_client: row.is_visible_to_client as boolean,
      })),
      planning_items: (planningResult.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        channel: row.channel as string,
        item_type: row.item_type as string,
        starts_at: row.starts_at as string,
        ends_at: row.ends_at as string | null,
        status: row.status as string,
        organization_id: row.organization_id as string,
        organization_name: orgName(row.organization_id as string),
        // Las dos señales que convierten la agenda en triaje: por que esta
        // parada una accion, y si ya tiene la pieza escrita.
        blocked_reason: (row.blocked_reason as string | null) ?? null,
        marketing_draft_id: (row.marketing_draft_id as string | null) ?? null,
      })),
      milestones: (milestonesResult.data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        target_date: row.target_date as string,
        status: row.status as string,
        organization_id: row.organization_id as string,
        organization_name: orgName(row.organization_id as string),
        phase_name: phaseName(row.strategic_plan_phases),
      })),
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
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const [tasksResult, alertsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, alert_id, source, status, priority, categories, title, description, due_at, is_visible_to_client, created_at, updated_at, organization_id, task_comments(id, body, is_internal, author_user_id, created_at), milestone_task_links(strategic_plan_milestones(id, name, strategic_plan_phases(name)))",
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

  const firstOf = (value: unknown): Record<string, unknown> | undefined =>
    Array.isArray(value)
      ? (value[0] as Record<string, unknown> | undefined)
      : (value as Record<string, unknown> | undefined);

  const withMilestone = (row: Record<string, unknown>) => {
    const { milestone_task_links: rawLinks, ...rest } = row as Record<
      string,
      unknown
    > & { milestone_task_links?: unknown };
    const link = Array.isArray(rawLinks) ? rawLinks[0] : undefined;
    const ms = firstOf(
      (link as { strategic_plan_milestones?: unknown } | undefined)
        ?.strategic_plan_milestones,
    );
    const phase = firstOf(ms?.strategic_plan_phases);
    return {
      ...rest,
      milestone: ms
        ? {
            id: ms.id as string,
            name: ms.name as string,
            phase_name: (phase?.name as string | undefined) ?? null,
          }
        : null,
    };
  };

  return {
    ok: true as const,
    data: {
      organizations: organizations.map((organization) => ({
        id: organization.id,
        display_name: organization.display_name,
      })),
      tasks: (tasksResult.data ?? []).map((row) => {
        const named = withName(
          row as { organization_id: string } & Record<string, unknown>,
        );
        return withMilestone(named as Record<string, unknown>);
      }),
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
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const [draftsResult, threadByDraft] = await Promise.all([
    supabase
      .from("marketing_content_drafts")
      .select(
        "id, organization_id, content_type, status, template_name, subject, summary, purpose, audience, locale, tone, plain_text, html, confidence, version, created_at, updated_at, scheduled_for, decision_reason, request",
      )
      .in("organization_id", safeIds)
      .order("updated_at", { ascending: false })
      .limit(300),
    loadDraftThreadSummaries(supabase, safeIds),
  ]);

  if (draftsResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_marketing_load_failed",
      detail: draftsResult.error.message,
    };
  }

  const drafts = (draftsResult.data ?? []).map((draft) => {
    const thread = threadByDraft.get(draft.id as string) ?? {
      count: 0,
      last_at: null,
      last_author_kind: null,
    };
    return {
      ...draft,
      organization_name:
        nameByOrg.get(draft.organization_id as string) ??
        (draft.organization_id as string),
      // note_count se mantiene por compatibilidad con la vista; el detalle de
      // quien hablo el ultimo va en thread.
      note_count: thread.count,
      thread,
    };
  });

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
    .select("id, body, author_user_id, author_kind, created_at")
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

type DraftAuthorKind = "consultant" | "client" | "platform" | "ai";

/** Rol del actor en el hilo de un borrador. `null` = sin acceso al workspace. */
function resolveDraftAuthorKind(
  context: AuthContext,
  organizationId: string,
): DraftAuthorKind | null {
  const membership = context.memberships.find(
    (item) => item.organization_id === organizationId,
  );
  if (!membership) return null;
  if (context.profile.platform_role === "platform_admin") return "platform";
  if (context.profile.platform_role === "consultant") return "consultant";
  if (["owner", "manager"].includes(membership.role)) return "client";
  return null;
}

/** Mensaje en el hilo de un borrador de marketing. El hilo es una conversación
 * bidireccional consultor <-> cliente (y plataforma / IA): cualquier miembro
 * del workspace escribe. Las líneas de sistema (cambios de fecha) usan la
 * misma tabla. */
export async function addMarketingDraftNote(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  draftId: string,
  body: { body?: string; from_ai?: boolean },
) {
  const actorKind = resolveDraftAuthorKind(context, organizationId);
  // `from_ai` = el mensaje es una respuesta del Consultor IA que una persona
  // del workspace ha decidido dejar en el hilo. Se firma como 'ai' y no como
  // quien pulso el boton: el hilo se lee como timeline y "esto lo dijo la IA"
  // es justo lo que hay que poder distinguir despues. La frontera sigue siendo
  // la persona -- sin acceso al workspace no se escribe, venga de la IA o no.
  const authorKind = actorKind && body.from_ai === true ? "ai" : actorKind;
  if (!authorKind) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "marketing_thread_access_required",
      message:
        "Necesitas ser miembro del workspace (cliente, consultor o plataforma) para escribir en el hilo.",
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
      author_kind: authorKind,
      body: text.slice(0, 4000),
    })
    .select("id, body, author_user_id, author_kind, created_at")
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
    action: "marketing_draft_note.added",
    entityType: "marketing_content_draft",
    entityId: draftId,
    oldData: null,
    newData: {
      note_id: note.id,
      author_kind: authorKind,
      actor_kind: actorKind,
    },
  });

  return { ok: true as const, data: { note } };
}

const DRAFT_SCHEDULE_TZ = "Europe/Madrid";

function formatScheduleForThread(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: DRAFT_SCHEDULE_TZ,
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Programa (o desprograma) la publicación de un borrador y deja una línea de
 * sistema en el hilo. Normalmente la fija el cliente; el consultor también
 * puede proponer fecha y se discute en el mismo hilo. */
export async function setMarketingDraftSchedule(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  draftId: string,
  body: { scheduled_for?: string | null },
) {
  const authorKind = resolveDraftAuthorKind(context, organizationId);
  if (!authorKind) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "marketing_thread_access_required",
    };
  }

  let scheduledIso: string | null = null;
  if (body.scheduled_for != null && body.scheduled_for !== "") {
    const parsed = Date.parse(body.scheduled_for);
    if (!Number.isFinite(parsed)) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_scheduled_for",
      };
    }
    scheduledIso = new Date(parsed).toISOString();
  }

  const supabase = createServiceClient(env);

  const { data: draft, error: draftError } = await supabase
    .from("marketing_content_drafts")
    .select("id, organization_id, scheduled_for")
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

  const previousIso = (draft.scheduled_for as string | null) ?? null;
  if (previousIso === scheduledIso) {
    return { ok: true as const, data: { scheduled_for: scheduledIso } };
  }

  const { error: updateError } = await supabase
    .from("marketing_content_drafts")
    .update({ scheduled_for: scheduledIso })
    .eq("id", draftId)
    .eq("organization_id", organizationId);
  if (updateError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "marketing_draft_schedule_failed",
      detail: updateError.message,
    };
  }

  const systemBody = scheduledIso
    ? previousIso
      ? `📅 Publicación reprogramada para el ${formatScheduleForThread(scheduledIso)}.`
      : `📅 Publicación programada para el ${formatScheduleForThread(scheduledIso)}.`
    : "📅 Programación de la publicación retirada.";

  await supabase.from("marketing_content_draft_notes").insert({
    draft_id: draftId,
    organization_id: organizationId,
    author_user_id: context.user.id,
    author_kind: authorKind,
    body: systemBody,
  });

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "marketing_draft.scheduled",
    entityType: "marketing_content_draft",
    entityId: draftId,
    oldData: { scheduled_for: previousIso },
    newData: { scheduled_for: scheduledIso },
  });

  return { ok: true as const, data: { scheduled_for: scheduledIso } };
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
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

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
// Los cuatro agentes que leen una tienda entera. El nombre corto es el que
// aparece en el motivo del ranking, asi que se escribe una vez aqui.
const TRIAGE_AGENTS = new Map<string, string>([
  // A02 lee el negocio entero y es el unico con historial largo: sin el, el
  // ranking estaria vacio hasta la primera pasada del cron de los tres nuevos.
  ["a02_monitor_negocio", "Negocio"],
  ["a13_operativa_shopify", "Operativa"],
  ["a20_retencion_clientes", "Retención"],
  ["a21_adquisicion_shopify", "Adquisición"],
  ["a22_postventa_shopify", "Postventa"],
]);

type SignalRow = {
  organization_id: string;
  agent_code: string;
  ran_at: string;
  output: unknown;
};

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
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

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

  // --- Ranking por urgencia de revision -----------------------------------
  //
  // La lista de tiendas ordenada por nombre no dice a quien hay que llamar
  // hoy. Los agentes ya leyeron cada tienda entera; esto solo suma lo que
  // dijeron y ordena. El calculo es deterministico a proposito: el consultor
  // tiene que poder ver POR QUE una tienda esta la primera.
  const orgIdsForSignals = ids.length ? ids : [];
  const { data: signalRows } = orgIdsForSignals.length
    ? await supabase.rpc("consultant_store_signals", {
        target_organization_ids: orgIdsForSignals,
        agent_codes: [...TRIAGE_AGENTS.keys()],
      })
    : { data: [] };

  const signalsByOrg = new Map<string, AgentSignal[]>();
  for (const row of (signalRows ?? []) as SignalRow[]) {
    const label = TRIAGE_AGENTS.get(row.agent_code);
    if (!label) continue;
    const output = (row.output ?? {}) as {
      findings?: unknown;
      proposed_writes?: unknown;
      confidence?: unknown;
      warnings?: unknown;
    };

    signalsByOrg.set(row.organization_id, [
      ...(signalsByOrg.get(row.organization_id) ?? []),
      {
        agentCode: row.agent_code,
        agentLabel: label,
        ranAt: row.ran_at,
        findings: Array.isArray(output.findings)
          ? (output.findings as AgentSignal["findings"])
          : [],
        proposals: Array.isArray(output.proposed_writes)
          ? (output.proposed_writes as AgentSignal["proposals"])
          : [],
        confidence:
          output.confidence === "low" || output.confidence === "medium"
            ? output.confidence
            : "high",
        warnings: Array.isArray(output.warnings)
          ? (output.warnings as string[])
          : [],
      },
    ]);
  }

  const ranking = rankStores(
    stores.map((store) => ({
      connectionId: store.id,
      organizationId: store.organization_id,
      organizationName: store.organization_name,
      storeName: store.name,
      status: store.status,
      lastSyncAt: store.last_sync_at,
      signals: signalsByOrg.get(store.organization_id) ?? [],
    })),
    new Date(),
  );

  return {
    ok: true as const,
    data: {
      organizations: organizations.map((organization) => ({
        id: organization.id,
        display_name: organization.display_name,
      })),
      stores,
      ranking,
    },
  };
}

/**
 * Cartera de Meta ordenada por urgencia de revision, para la vista general de
 * /meta cuando el consultor no ha elegido cliente.
 *
 * Es hermana de listConsultantStores pero no pasa por los agentes: las
 * señales de una cuenta publicitaria rota son contables (ver meta-triage.ts).
 */
export async function listConsultantMetaAccounts(
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

  if (organizations.length === 0) {
    return {
      ok: true as const,
      data: { organizations: [], ranking: [] },
    };
  }

  const supabase = createServiceClient(env);
  const { data, error } = await supabase.rpc("consultant_meta_signals", {
    target_organization_ids: organizations.map(
      (organization) => organization.id,
    ),
  });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_meta_signals_failed",
      detail: error.message,
    };
  }

  const nameByOrg = new Map(
    organizations.map((organization) => [
      organization.id,
      organization.display_name,
    ]),
  );

  const ranking = rankMetaAccounts(
    ((data ?? []) as MetaSignalRow[]).map((row) => ({
      ...row,
      ad_accounts: Number(row.ad_accounts ?? 0),
      spend: Number(row.spend ?? 0),
      days_with_spend: Number(row.days_with_spend ?? 0),
      pixels: Number(row.pixels ?? 0),
      pixels_silent: Number(row.pixels_silent ?? 0),
      ads_with_issues: Number(row.ads_with_issues ?? 0),
      ad_sets_learning: Number(row.ad_sets_learning ?? 0),
      spend_below_average: Number(row.spend_below_average ?? 0),
      spend_with_verdict: Number(row.spend_with_verdict ?? 0),
      recent_changes: Number(row.recent_changes ?? 0),
      organization_name:
        nameByOrg.get(row.organization_id) ?? "Cliente sin nombre",
    })),
    new Date(),
  );

  return {
    ok: true as const,
    data: {
      organizations: organizations.map((organization) => ({
        id: organization.id,
        display_name: organization.display_name,
      })),
      ranking,
    },
  };
}

/**
 * Cartera de email ordenada por urgencia. Mismo contrato que
 * listConsultantMetaAccounts: las señales salen de una funcion SQL y el orden
 * se calcula en Node, sin agentes.
 */
export async function listConsultantKlaviyoAccounts(
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

  if (organizations.length === 0) {
    return {
      ok: true as const,
      data: { organizations: [], ranking: [] },
    };
  }

  const supabase = createServiceClient(env);
  const { data, error } = await supabase.rpc("consultant_klaviyo_signals", {
    target_organization_ids: organizations.map(
      (organization) => organization.id,
    ),
  });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_klaviyo_signals_failed",
      detail: error.message,
    };
  }

  const nameByOrg = new Map(
    organizations.map((organization) => [
      organization.id,
      organization.display_name,
    ]),
  );

  const ranking = rankKlaviyoAccounts(
    ((data ?? []) as KlaviyoSignalRow[]).map((row) => ({
      ...row,
      sync_incomplete: Boolean(row.sync_incomplete),
      emails_total: Number(row.emails_total ?? 0),
      emails_sin_utm: Number(row.emails_sin_utm ?? 0),
      emails_sin_cuerpo: Number(row.emails_sin_cuerpo ?? 0),
      flows_active: Number(row.flows_active ?? 0),
      campaigns_in_window: Number(row.campaigns_in_window ?? 0),
      lists: Number(row.lists ?? 0),
      segments: Number(row.segments ?? 0),
      organization_name:
        nameByOrg.get(row.organization_id) ?? "Cliente sin nombre",
    })),
    new Date(),
  );

  return {
    ok: true as const,
    data: {
      organizations: organizations.map((organization) => ({
        id: organization.id,
        display_name: organization.display_name,
      })),
      ranking,
    },
  };
}

/**
 * Tiendas propias del consultor (membership real, no cartera) con sus totales
 * de negocio del periodo, para la seccion "Mis tiendas" de /tiendas. La lista
 * sale de context.memberships (accessSource "membership"); los numeros del
 * mismo consultant_business_rollup que el Dashboard general, llamado por tienda
 * (N pequeño: son las tiendas propias del consultor).
 */
export async function listOwnStoresOverview(
  env: ApiEnv,
  context: AuthContext,
  days: number,
) {
  const ownMemberships = context.memberships.filter(
    (membership) => membership.accessSource === "membership",
  );

  const windowDays = [7, 30, 90].includes(days) ? days : 30;
  const dayMs = 24 * 60 * 60 * 1000;
  const periodEnd = new Date().toISOString();
  const periodStart = new Date(Date.now() - windowDays * dayMs).toISOString();

  const supabase = createServiceClient(env);

  const stores = await Promise.all(
    ownMemberships.map(async (membership) => {
      const { data, error } = await supabase.rpc("consultant_business_rollup", {
        org_ids: [membership.organization_id],
        period_start: periodStart,
        period_end: periodEnd,
      });
      if (error) {
        return { ok: false as const, detail: error.message };
      }
      const row = (data ?? [])[0] ?? {};
      const num = (value: unknown) => Number(value ?? 0);
      return {
        ok: true as const,
        store: {
          organization_id: membership.organization_id,
          display_name:
            membership.organization?.display_name ?? membership.organization_id,
          status: membership.organization?.status ?? "active",
          currency_code: membership.organization?.currency_code ?? "EUR",
          net_sales: num(row.net_sales),
          orders: num(row.orders_count),
          meta_spend: num(row.meta_spend),
          roas: row.roas == null ? null : num(row.roas),
        },
      };
    }),
  );

  const failed = stores.find((result) => result.ok === false);
  if (failed && failed.ok === false) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "own_stores_overview_failed",
      detail: failed.detail,
    };
  }

  return {
    ok: true as const,
    data: {
      window_days: windowDays,
      stores: stores
        .filter(
          (result): result is Extract<typeof result, { ok: true }> => result.ok,
        )
        .map((result) => result.store),
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
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

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
  // El orden lo pone connectionSeverity, el mismo que usa el detalle de un
  // cliente: si cada vista tuviera el suyo volveriamos a la contradiccion de
  // ver un cliente rojo en la lista y verde al entrar.
  for (const row of data ?? []) {
    const orgId = row.organization_id as string;
    const provider = row.provider as string;
    providerSet.add(provider);
    const cells = byOrg.get(orgId) ?? {};
    const existing = cells[provider];
    const nextStatus = row.status as string;
    if (
      !existing ||
      connectionSeverity(nextStatus) > connectionSeverity(existing.status)
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
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

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
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

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
            active_phase: activePhase ? (activePhase.name as string) : null,
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
export async function getOrganizationAccess(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
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
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_access_load_failed",
      detail: organizationError.message,
    };
  }
  if (!organization) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "organization_not_found",
    };
  }

  const [
    { data: members, error: membersError },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, user_id, role, is_active, invited_at, joined_at, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("consultant_assignments")
      .select(
        "id, consultant_user_id, is_primary, is_active, assigned_at, ended_at",
      )
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
    return {
      ok: false as const,
      statusCode: 500,
      error: "profiles_load_failed",
      detail: profilesError.message,
    };
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id as string, profile]),
  );
  return {
    ok: true as const,
    data: {
      organization,
      members: (members ?? []).map((member) => ({
        ...member,
        profile: profileById.get(member.user_id as string) ?? null,
      })),
      assignments: (assignments ?? []).map((assignment) => ({
        ...assignment,
        profile:
          profileById.get(assignment.consultant_user_id as string) ?? null,
      })),
      available_profiles: (profiles ?? []).filter(
        (profile) => profile.is_active,
      ),
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
  if (
    !userId ||
    !body.role ||
    !MEMBER_ROLES.includes(body.role as MemberRole)
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_member_payload",
    };
  }

  const supabase = createServiceClient(env);
  const { data: profile, error: profileError } = await loadExistingProfile(
    supabase,
    userId,
  );
  if (profileError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "profile_load_failed",
      detail: profileError.message,
    };
  if (!profile)
    return { ok: false as const, statusCode: 404, error: "profile_not_found" };

  const { data: previous } = await supabase
    .from("organization_members")
    .select(
      "id, organization_id, user_id, role, is_active, invited_at, joined_at",
    )
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
    .select(
      "id, organization_id, user_id, role, is_active, invited_at, joined_at",
    )
    .single();

  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_member_save_failed",
      detail: error.message,
    };
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: previous
      ? "consultant.update_organization_member"
      : "consultant.add_organization_member",
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
  body: {
    consultant_user_id?: string;
    is_primary?: boolean;
    is_active?: boolean;
  },
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;
  const consultantUserId = body.consultant_user_id?.trim();
  if (!consultantUserId)
    return {
      ok: false as const,
      statusCode: 400,
      error: "consultant_user_id_required",
    };

  const supabase = createServiceClient(env);
  const { data: profile, error: profileError } = await loadExistingProfile(
    supabase,
    consultantUserId,
  );
  if (profileError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "profile_load_failed",
      detail: profileError.message,
    };
  if (!profile)
    return { ok: false as const, statusCode: 404, error: "profile_not_found" };
  if (
    !["consultant", "platform_admin"].includes(profile.platform_role as string)
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "profile_not_consultant",
    };
  }

  const { data: previous } = await supabase
    .from("consultant_assignments")
    .select(
      "id, organization_id, consultant_user_id, is_primary, is_active, assigned_at, ended_at",
    )
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
      return {
        ok: false as const,
        statusCode: 500,
        error: "primary_assignment_update_failed",
        detail: clearPrimaryError.message,
      };
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
    .select(
      "id, organization_id, consultant_user_id, is_primary, is_active, assigned_at, ended_at",
    )
    .single();

  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_assignment_save_failed",
      detail: error.message,
    };
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: previous
      ? "consultant.update_assignment"
      : "consultant.create_assignment",
    entityType: "consultant_assignment",
    entityId: assignment.id,
    oldData: previous,
    newData: assignment,
  });
  return {
    ok: true as const,
    data: { assignment: { ...assignment, profile } },
  };
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
    Array<{
      organization_id: string;
      display_name: string;
      is_primary: boolean;
    }>
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

// Editar/borrar una organización: platform_admin siempre, o el propio dueño si
// es una tienda suya (membership real de owner, accessSource "membership" -- una
// asignación de consultor NO cuenta). Para tiendas propias del consultor.
function requirePlatformAdminOrStoreOwner(
  context: AuthContext,
  organizationId: string,
) {
  if (context.profile.platform_role === "platform_admin") {
    return { ok: true as const };
  }
  const isOwner = context.memberships.some(
    (membership) =>
      membership.organization_id === organizationId &&
      membership.role === "owner" &&
      membership.accessSource === "membership",
  );
  if (isOwner) {
    return { ok: true as const };
  }
  return {
    ok: false as const,
    statusCode: 403,
    error: "platform_admin_or_owner_required",
    message:
      "Solo un platform admin o el propietario de la tienda puede realizar esta accion.",
  };
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
export async function listOrganizationStores(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
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

  // BE-01 (gap real encontrado 2026-07-28): antes solo se comprobaba el rol,
  // no que ESTE consultor este asignado a ESTA organizacion -- dependia
  // solo de RLS (private.can_access_org via is_assigned_consultant) como
  // unica linea de defensa. `context.memberships` ya incluye las
  // organizaciones virtuales de platform_admin/consultant (auth-context.ts),
  // asi que reusarlo aqui es la misma verificacion que el resto de servicios
  // (requireMembership), sin una query nueva.
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
    .from("integration_connections")
    .select(
      "id, provider_account_name, provider_account_id, status, connected_at, last_sync_at",
    )
    .eq("organization_id", organizationId)
    .eq("provider", "shopify")
    .order("connected_at", { ascending: false });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_stores_load_failed",
      detail: error.message,
    };
  }

  return {
    ok: true as const,
    data: { organization_id: organizationId, stores: data ?? [] },
  };
}

/**
 * Marca una tienda (conexion Shopify) de un cliente para borrado. No borra
 * nada todavia: pone status='pending_deletion' con un periodo de gracia
 * (RETENTION_PERIOD_DAYS). El borrado fisico real lo hace `purgeExpiredStores`
 * (job periodico) cuando pasa `scheduled_purge_at`, o se puede revertir antes
 * con `restoreOrganizationStore`. Ver R-008.
 */
/**
 * Descartar un intento de autorizacion a medias no es borrar una tienda, y no
 * puede pedir la misma autoridad.
 *
 * Borrar una tienda de verdad es del consultor: hay historico detras y se hace
 * con periodo de gracia. Pero la fila `pending` que siembra el OAuth la crea el
 * propio owner al pulsar "Conectar" (shopify.ts exige owner/manager/admin), no
 * contiene nada, y ademas le esta comiendo cupo de tiendas de SU plan. Exigir
 * un consultor para tirar algo que el mismo acaba de crear por accidente deja
 * al cliente mirando un boton que le devuelve 403.
 */
function canDiscardAuthorizationAttempt(
  context: AuthContext,
  organizationId: string,
): boolean {
  if (context.profile.platform_role === "platform_admin") return true;
  const membership = context.memberships.find(
    (item) => item.organization_id === organizationId,
  );
  return Boolean(membership && ["owner", "manager"].includes(membership.role));
}

export async function deleteOrganizationStore(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId: string,
) {
  const access = requireStoreManager(context, organizationId);
  const puedeDescartar = canDiscardAuthorizationAttempt(
    context,
    organizationId,
  );
  // Sin ninguna de las dos autoridades no se mira siquiera la conexion: asi no
  // se puede sondear que ids existen a base de comparar respuestas.
  if (access.ok === false && !puedeDescartar) {
    return access;
  }

  const supabase = createServiceClient(env);

  const { data: connection, error: loadError } = await supabase
    .from("integration_connections")
    .select(
      "id, organization_id, provider, status, connected_at, created_at, updated_at",
    )
    .eq("id", connectionId)
    .maybeSingle();

  if (loadError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "connection_load_failed",
      detail: loadError.message,
    };
  }

  if (
    !connection ||
    connection.organization_id !== organizationId ||
    connection.provider !== "shopify"
  ) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "connection_not_found",
    };
  }

  if (connection.status === "pending_deletion") {
    return {
      ok: false as const,
      statusCode: 409,
      error: "connection_already_pending_deletion",
    };
  }

  // Descartar un intento de autorizacion a medias no es borrar una tienda: no
  // hay datos, ni credenciales, ni nada que recuperar dentro de 30 dias. El
  // borrado programado esta para poder deshacer una baja accidental de una
  // tienda con historico; aplicarselo a una fila que solo guarda el `state` de
  // un OAuth que nadie termino la dejaria ocupando cupo del plan un mes entero.
  if (classifyAuthorizationAttempt(connection) !== null) {
    if (!puedeDescartar) {
      return access.ok === false
        ? access
        : {
            ok: false as const,
            statusCode: 403,
            error: "organization_manage_denied",
            message:
              "Solo owner, manager o platform admin pueden descartar una conexión a medias.",
          };
    }

    const { error: discardError } = await supabase
      .from("integration_connections")
      .delete()
      .eq("id", connectionId)
      // Si el OAuth se completa entre la lectura y el borrado, ya es una tienda
      // de verdad y esta condicion la deja viva.
      .eq("status", "pending")
      .is("connected_at", null);

    if (discardError) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "authorization_attempt_discard_failed",
        detail: discardError.message,
      };
    }

    await recordAuditLog(supabase, {
      organizationId,
      actorUserId: context.user.id,
      action: "integrations.discard_authorization_attempt",
      entityType: "integration_connection",
      entityId: connectionId,
      oldData: connection,
    });

    return {
      ok: true as const,
      data: { discarded: true as const, connection_id: connectionId },
    };
  }

  // A partir de aqui ya no es un intento: es una tienda con datos, y eso sigue
  // siendo del consultor aunque el owner pueda descartar un OAuth a medias.
  if (access.ok === false) {
    return access;
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
    return {
      ok: false as const,
      statusCode: 500,
      error: "connection_delete_failed",
      detail: updateError.message,
    };
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

  return {
    ok: true as const,
    data: {
      connection_id: connectionId,
      status: "pending_deletion",
      scheduled_purge_at: scheduledPurge,
    },
  };
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
    return {
      ok: false as const,
      statusCode: 500,
      error: "connection_load_failed",
      detail: loadError.message,
    };
  }

  if (!connection || connection.organization_id !== organizationId) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "connection_not_found",
    };
  }

  if (connection.status !== "pending_deletion") {
    return {
      ok: false as const,
      statusCode: 409,
      error: "connection_not_pending_deletion",
    };
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
    return {
      ok: false as const,
      statusCode: 500,
      error: "connection_restore_failed",
      detail: updateError.message,
    };
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

  return {
    ok: true as const,
    data: { connection_id: connectionId, status: "connected" },
  };
}

const ORGANIZATION_STATUSES = [
  "onboarding",
  "active",
  "suspended",
  "cancelled",
] as const;

/**
 * Quien puede editar la identidad de una organizacion: su owner real, o quien
 * la opera desde fuera (consultor asignado / platform admin). Suma al gate
 * anterior en vez de sustituirlo -- el owner del cliente no pierde nada.
 *
 * La membresia del consultor es virtual y solo existe para sus
 * `consultant_assignments` activas, asi que comprobar que la organizacion esta
 * en `context.memberships` ya acota el alcance a su cartera.
 */
function requireOrganizationEditor(
  context: AuthContext,
  organizationId: string,
) {
  const membership = context.memberships.find(
    (item) => item.organization_id === organizationId,
  );

  if (!membership) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  if (
    ["platform_admin", "consultant"].includes(context.profile.platform_role) ||
    ["owner", "manager"].includes(membership.role)
  ) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    statusCode: 403,
    error: "organization_edit_denied",
    message:
      "Solo el propietario, un manager, el consultor asignado o un platform admin pueden editar los datos de la organizacion.",
  };
}

export async function updateOrganization(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: {
    display_name?: string;
    status?: string;
    timezone?: string;
    currency_code?: string;
  },
) {
  // El `status` es ciclo de vida de plataforma (suspender, cancelar): sigue
  // reservado a platform admin o al owner real. La identidad -- nombre, zona
  // horaria, moneda -- la lleva quien opera el cliente, y hasta ahora el
  // consultor tenia que pedirsela a Rafa para algo tan basico como corregir
  // la moneda de una tienda que no factura en euros.
  const access =
    body.status === undefined
      ? requireOrganizationEditor(context, organizationId)
      : requirePlatformAdminOrStoreOwner(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const patch: Record<string, string> = {};

  if (body.display_name !== undefined) {
    const trimmed = body.display_name.trim();
    if (trimmed.length === 0) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_display_name",
      };
    }
    patch.display_name = trimmed;
  }

  if (body.status !== undefined) {
    if (
      !ORGANIZATION_STATUSES.includes(
        body.status as (typeof ORGANIZATION_STATUSES)[number],
      )
    ) {
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
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_currency_code",
      };
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
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_update_failed",
      detail: updateError.message,
    };
  }

  if (!organization) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "organization_not_found",
    };
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
export async function deleteOrganization(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requirePlatformAdminOrStoreOwner(context, organizationId);
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
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_load_failed",
      detail: loadError.message,
    };
  }

  if (!organization) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "organization_not_found",
    };
  }

  if (organization.status === "pending_deletion") {
    return {
      ok: false as const,
      statusCode: 409,
      error: "organization_already_pending_deletion",
    };
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
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_delete_failed",
      detail: updateError.message,
    };
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
    data: {
      organization_id: organizationId,
      display_name: organization.display_name,
      status: "pending_deletion",
      scheduled_purge_at: scheduledPurge,
    },
  };
}

/**
 * Revierte una organizacion marcada para borrado, siempre que aun no se haya
 * purgado. No conocemos el status anterior exacto (onboarding/active/
 * suspended), asi que restaura a 'active' -- es el caso comun y evita
 * reintroducir un estado de onboarding a medio completar.
 */
export async function restoreOrganization(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
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
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_load_failed",
      detail: loadError.message,
    };
  }

  if (!organization) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "organization_not_found",
    };
  }

  if (organization.status !== "pending_deletion") {
    return {
      ok: false as const,
      statusCode: 409,
      error: "organization_not_pending_deletion",
    };
  }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      status: "active",
      deletion_requested_at: null,
      deletion_requested_by: null,
      scheduled_purge_at: null,
    })
    .eq("id", organizationId);

  if (updateError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_restore_failed",
      detail: updateError.message,
    };
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

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      display_name: organization.display_name,
      status: "active",
    },
  };
}

// ---------------------------------------------------------------------------
// Pausar / desvincular un cliente desde el panel del consultor. Ninguna de
// estas acciones toca la suscripcion ni el login del cliente ni dispara la
// purga de la org -- solo controlan si NOSOTROS (el consultor) seguimos
// trayendo sus datos. `status='suspended'` es la senal que hace que el worker
// deje de ingerir. Cuando exista el sistema de planes, un cliente que pague su
// cuota por su cuenta podra reactivar la org por otra via.
// ---------------------------------------------------------------------------

/** Pausa "hasta nuevo aviso": org -> suspended. La asignacion se mantiene, asi
 *  que el consultor lo sigue viendo en su cartera y puede reanudarlo el mismo. */
export async function pauseConsultantClient(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireStoreManager(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("id", organizationId)
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_load_failed",
      detail: error.message,
    };
  if (!org)
    return {
      ok: false as const,
      statusCode: 404,
      error: "organization_not_found",
    };
  if (org.status === "pending_deletion")
    return {
      ok: false as const,
      statusCode: 409,
      error: "organization_pending_deletion",
    };
  if (org.status === "suspended")
    return {
      ok: false as const,
      statusCode: 409,
      error: "organization_already_suspended",
    };

  const { error: upErr } = await supabase
    .from("organizations")
    .update({ status: "suspended" })
    .eq("id", organizationId);
  if (upErr)
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_pause_failed",
      detail: upErr.message,
    };

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.pause_client",
    entityType: "organization",
    entityId: organizationId,
    oldData: { status: org.status },
    newData: { status: "suspended" },
  });
  return {
    ok: true as const,
    data: { organization_id: organizationId, status: "suspended" },
  };
}

/** Reanuda un cliente pausado: suspended -> active. */
export async function resumeConsultantClient(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireStoreManager(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("id", organizationId)
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_load_failed",
      detail: error.message,
    };
  if (!org)
    return {
      ok: false as const,
      statusCode: 404,
      error: "organization_not_found",
    };
  if (org.status !== "suspended")
    return {
      ok: false as const,
      statusCode: 409,
      error: "organization_not_suspended",
    };

  const { error: upErr } = await supabase
    .from("organizations")
    .update({ status: "active" })
    .eq("id", organizationId);
  if (upErr)
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_resume_failed",
      detail: upErr.message,
    };

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.resume_client",
    entityType: "organization",
    entityId: organizationId,
    oldData: { status: "suspended" },
    newData: { status: "active" },
  });
  return {
    ok: true as const,
    data: { organization_id: organizationId, status: "active" },
  };
}

/** Desvincula al consultor del cliente: termina SU consultant_assignment y
 *  suspende la org. El cliente queda "sin consultor" pero conserva todo lo
 *  suyo; recuperarlo requiere reasignarlo desde el panel admin. */
export async function unlinkConsultantClient(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireStoreManager(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("id", organizationId)
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_load_failed",
      detail: error.message,
    };
  if (!org)
    return {
      ok: false as const,
      statusCode: 404,
      error: "organization_not_found",
    };

  const { error: assignErr } = await supabase
    .from("consultant_assignments")
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("consultant_user_id", context.user.id)
    .eq("is_active", true);
  if (assignErr)
    return {
      ok: false as const,
      statusCode: 500,
      error: "assignment_end_failed",
      detail: assignErr.message,
    };

  // Una org ya en borrado pendiente no se toca; en cualquier otro caso, quitar
  // el cliente de la cartera la suspende (dejamos de traer sus datos).
  const nextStatus =
    org.status === "pending_deletion" || org.status === "suspended"
      ? org.status
      : "suspended";
  if (nextStatus !== org.status) {
    const { error: upErr } = await supabase
      .from("organizations")
      .update({ status: nextStatus })
      .eq("id", organizationId);
    if (upErr)
      return {
        ok: false as const,
        statusCode: 500,
        error: "organization_pause_failed",
        detail: upErr.message,
      };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.unlink_client",
    entityType: "consultant_assignment",
    entityId: organizationId,
    oldData: { org_status: org.status },
    newData: { org_status: nextStatus, assignment_ended: true },
  });
  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      unlinked: true,
      status: nextStatus,
    },
  };
}

/** Borrado inmediato y definitivo de un cliente. Un solo `DELETE FROM
 *  organizations` dispara la cascada de FK de la base de datos (~85 tablas:
 *  datos Shopify/Meta/Klaviyo, tareas, planes, agentes, miembros,
 *  suscripción...). No hay periodo de gracia ni vuelta atrás; solo
 *  platform_admin. Para el borrado diferido usar `deleteOrganization`. */
export async function hardDeleteOrganization(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: org, error: loadError } = await supabase
    .from("organizations")
    .select("id, display_name, status")
    .eq("id", organizationId)
    .maybeSingle();
  if (loadError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_load_failed",
      detail: loadError.message,
    };
  if (!org)
    return {
      ok: false as const,
      statusCode: 404,
      error: "organization_not_found",
    };

  // El audit log va antes del delete: `audit_logs.organization_id` es SET NULL,
  // así que la fila sobrevive al borrado con el id ya nulo.
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "admin.hard_delete_organization",
    entityType: "organization",
    entityId: organizationId,
    oldData: org,
  });

  const { error: delError } = await supabase
    .from("organizations")
    .delete()
    .eq("id", organizationId);
  if (delError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_hard_delete_failed",
      detail: delError.message,
    };

  return {
    ok: true as const,
    data: { organization_id: organizationId, deleted: true },
  };
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
    return {
      ok: false as const,
      statusCode: 500,
      error: "organizations_purge_lookup_failed",
      detail: orgLoadError.message,
    };
  }

  let purgedOrganizations = 0;
  const failedOrganizationIds: string[] = [];
  for (const organization of organizations ?? []) {
    const { error: deleteError } = await supabase
      .from("organizations")
      .delete()
      .eq("id", organization.id);
    if (deleteError) {
      // R-008 (bug real encontrado 2026-07-22): antes este error se tragaba
      // en silencio -- una organizacion con datos que rompieran el borrado
      // en cascada (ver fix de log_financial_change) nunca se purgaba y
      // nadie se enteraba. Ahora queda en logs y en el resultado del cron.
      logger.error("Failed to purge organization", {
        organization_id: organization.id,
        error: deleteError.message,
      });
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
    const { error: deleteError } = await supabase
      .from("integration_connections")
      .delete()
      .eq("id", connection.id);
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

  // Intentos de autorizacion que nadie termino. No son un borrado programado
  // como los de arriba -- nunca hubo nada que borrar, solo una fila sembrada
  // para guardar el `state` del OAuth --, pero se purgan aqui porque es el
  // mismo cron diario y no merece uno propio. Sin esto, cada pestana cerrada a
  // medias dejaba una tienda fantasma ocupando cupo del plan para siempre.
  const { data: attempts, error: attemptsLoadError } = await supabase
    .from("integration_connections")
    .select(
      "id, organization_id, provider, provider_account_id, status, connected_at, created_at, updated_at",
    )
    .eq("status", "pending")
    .is("connected_at", null)
    .lt("updated_at", authorizationPurgeCutoff(new Date(nowIso)));

  if (attemptsLoadError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "authorization_attempts_purge_lookup_failed",
      detail: attemptsLoadError.message,
      partial: { purgedOrganizations, purgedConnections },
    };
  }

  // "StaleAttempts" y no "AuthorizationAttempts": el logger redacta cualquier
  // clave que contenga `authorization` (SENSITIVE_LOG_KEY, en observability), y
  // el contador salia como "[REDACTED]" en el log del cron -- un numero de
  // filas borradas censurado como si fuera una credencial.
  let purgedStaleAttempts = 0;
  const failedStaleAttemptIds: string[] = [];
  for (const attempt of attempts ?? []) {
    // La consulta ya filtra por fecha, pero quien decide es el contrato
    // compartido con la interfaz: si los dos criterios divergieran, la pantalla
    // diria "puedes retomarlo" de algo que este cron acaba de borrar.
    if (!isPurgeableAuthorizationAttempt(attempt, new Date(nowIso))) continue;

    const { error: deleteError } = await supabase
      .from("integration_connections")
      .delete()
      .eq("id", attempt.id)
      // Guarda contra la carrera: entre el select y el delete alguien puede
      // haber completado la autorizacion. Si eso pasa, ya no es pending y esta
      // condicion deja la fila viva.
      .eq("status", "pending")
      .is("connected_at", null);

    if (deleteError) {
      logger.error("Failed to purge abandoned authorization attempt", {
        connection_id: attempt.id,
        organization_id: attempt.organization_id,
        error: deleteError.message,
      });
      failedStaleAttemptIds.push(attempt.id);
      continue;
    }

    purgedStaleAttempts += 1;
    await recordAuditLog(supabase, {
      organizationId: attempt.organization_id,
      actorUserId: null,
      action: "integrations.purge_abandoned_authorization",
      entityType: "integration_connection",
      entityId: attempt.id,
      oldData: attempt,
    });
  }

  return {
    ok: true as const,
    data: {
      purgedOrganizations,
      purgedConnections,
      purgedStaleAttempts,
      failedOrganizationIds,
      failedConnectionIds,
      failedStaleAttemptIds,
    },
  };
}

// ---------------------------------------------------------------------------
// Alta y gestion desde platform_admin: consultores y clientes independientes
// (clientes SIN consultor asignado). El pago de la cuota lo resuelve el propio
// usuario al entrar en el software; aqui solo se controla QUIEN entra. Un
// consultor ya activo mete a sus propios clientes por el flujo consultor
// normal (upsertConsultantAssignment), no por aqui.
// ---------------------------------------------------------------------------

const CONSULTANT_ROLE = "consultant" as const;

function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "cliente"
  );
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isAuthEmailRateLimit(
  error: {
    message?: string | undefined;
    status?: number | undefined;
  } | null,
) {
  return (
    error?.status === 429 ||
    /email\s+rate\s+limit|rate\s+limit.*email/i.test(error?.message ?? "")
  );
}

/** Invita a un consultor, asigna su rol y envía el enlace seguro por el SMTP
 * propio. No depende del límite de correo del proveedor Auth. */
export async function inviteConsultant(
  env: ApiEnv,
  context: AuthContext,
  body: { email?: string; full_name?: string },
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const email = body.email?.trim().toLowerCase() ?? "";
  const fullName = body.full_name?.trim() || null;
  if (!isEmail(email)) {
    return { ok: false as const, statusCode: 400, error: "invalid_email" };
  }

  const supabase = createServiceClient(env);
  const inviteOptions = {
    redirectTo: onboardingRedirectTo(env),
    ...(fullName ? { data: { full_name: fullName } } : {}),
  };
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: inviteOptions,
    });
  const invitedUser = linkData?.user ?? null;
  const inviteUrl = linkData?.properties?.action_link ?? null;

  if (linkError || !invitedUser || !inviteUrl) {
    const already = /already|exist/i.test(linkError?.message ?? "");
    return {
      ok: false as const,
      statusCode: already ? 409 : 502,
      error: already ? "email_already_registered" : "invite_failed",
      detail: linkError?.message,
    };
  }

  const { error: roleError } = await supabase
    .from("profiles")
    .update({
      platform_role: CONSULTANT_ROLE,
      full_name: fullName,
      is_active: true,
    })
    .eq("id", invitedUser.id);
  if (roleError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "profile_role_update_failed",
      detail: roleError.message,
    };
  }

  const sent = await sendInviteMail(env, {
    to: email,
    recipientName: fullName,
    title: "Tu invitación a EcomScaling",
    intro:
      "Te han invitado como consultor. Crea tu contraseña y completa tu nombre y el de tu agencia.",
    actionLabel: "Aceptar invitación",
    actionUrl: inviteUrl,
  });
  const delivery: "email" | "manual_link" = sent.sent ? "email" : "manual_link";
  if (!sent.sent) {
    logger.info("consultant_invite_smtp_fallback", { reason: sent.reason });
  }

  await recordAuditLog(supabase, {
    organizationId: null,
    actorUserId: context.user.id,
    action: "admin.invite_consultant",
    entityType: "profile",
    entityId: invitedUser.id,
    newData: {
      email,
      full_name: fullName,
      platform_role: CONSULTANT_ROLE,
      delivery,
    },
  });
  return {
    ok: true as const,
    data: {
      user_id: invitedUser.id,
      email,
      full_name: fullName,
      delivery,
      invite_url: inviteUrl,
    },
  };
}

/** Renombra o activa/desactiva un consultor ya existente. Solo perfiles que ya
 *  son 'consultant' -- no se editan admins ni usuarios normales por aqui. */
export async function updateConsultant(
  env: ApiEnv,
  context: AuthContext,
  userId: string,
  body: { full_name?: string; is_active?: boolean },
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: profile, error: loadError } = await loadExistingProfile(
    supabase,
    userId,
  );
  if (loadError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "profile_load_failed",
      detail: loadError.message,
    };
  if (!profile)
    return { ok: false as const, statusCode: 404, error: "profile_not_found" };
  if (profile.platform_role !== CONSULTANT_ROLE) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "profile_not_consultant",
    };
  }

  const patch: Record<string, unknown> = {};
  if (body.full_name !== undefined) {
    const trimmed = body.full_name.trim();
    if (trimmed.length === 0)
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_full_name",
      };
    patch.full_name = trimmed;
  }
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
  if (Object.keys(patch).length === 0) {
    return { ok: false as const, statusCode: 400, error: "empty_update" };
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, full_name, platform_role, is_active")
    .single();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_update_failed",
      detail: error.message,
    };

  await recordAuditLog(supabase, {
    organizationId: null,
    actorUserId: context.user.id,
    action: "admin.update_consultant",
    entityType: "profile",
    entityId: userId,
    oldData: profile,
    newData: updated,
  });
  return { ok: true as const, data: { consultant: updated } };
}

/** Reenvía el acceso a un consultor que ya existe en Auth pero nunca activó su
 *  cuenta (o perdió el enlace). `inviteUserByEmail` falla con usuarios ya
 *  registrados, así que se manda un email de recuperación con redirect a
 *  /onboarding: al abrirlo tiene sesión y entra al flujo contraseña + perfil. */
export async function resendConsultantInvite(
  env: ApiEnv,
  context: AuthContext,
  userId: string,
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: profile, error: loadError } = await loadExistingProfile(
    supabase,
    userId,
  );
  if (loadError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "profile_load_failed",
      detail: loadError.message,
    };
  if (!profile)
    return { ok: false as const, statusCode: 404, error: "profile_not_found" };
  if (profile.platform_role !== CONSULTANT_ROLE) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "profile_not_consultant",
    };
  }

  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (userError || !email) {
    return {
      ok: false as const,
      statusCode: 502,
      error: "user_lookup_failed",
      detail: userError?.message,
    };
  }

  const { data: recovery, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: onboardingRedirectTo(env) },
    });
  const inviteUrl = recovery?.properties?.action_link;
  if (linkError || !inviteUrl) {
    return {
      ok: false as const,
      statusCode: 502,
      error: "resend_failed",
      detail: linkError?.message,
    };
  }

  const sent = await sendInviteMail(env, {
    to: email,
    recipientName: profile.full_name,
    title: "Tu acceso a EcomScaling",
    intro:
      "Aquí tienes un nuevo enlace para activar o recuperar tu acceso como consultor.",
    actionLabel: "Continuar onboarding",
    actionUrl: inviteUrl,
  });
  const delivery: "email" | "manual_link" = sent.sent ? "email" : "manual_link";

  await recordAuditLog(supabase, {
    organizationId: null,
    actorUserId: context.user.id,
    action: "admin.resend_consultant_invite",
    entityType: "profile",
    entityId: userId,
    newData: { email, delivery },
  });
  return {
    ok: true as const,
    data: {
      email,
      delivery,
      invite_url: delivery === "manual_link" ? inviteUrl : null,
    },
  };
}

/**
 * Crea un cliente independiente: organizacion + owner invitado por email, sin
 * consultant_assignment. Si la invitacion del owner falla tras crear la
 * organizacion, se revierte la organizacion.
 */
export async function createClientOrganization(
  env: ApiEnv,
  context: AuthContext,
  body: {
    display_name?: string;
    owner_email?: string;
    owner_full_name?: string;
    timezone?: string;
    currency_code?: string;
  },
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const displayName = body.display_name?.trim() ?? "";
  const ownerEmail = body.owner_email?.trim().toLowerCase() ?? "";
  const ownerFullName = body.owner_full_name?.trim() || null;
  const timezone = body.timezone?.trim() || "Europe/Madrid";
  const currencyCode = (body.currency_code?.trim() || "EUR").toUpperCase();

  if (displayName.length === 0)
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_display_name",
    };
  if (!isEmail(ownerEmail))
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_owner_email",
    };
  if (!/^[A-Z]{3}$/.test(currencyCode))
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_currency_code",
    };

  const supabase = createServiceClient(env);

  let slug = slugify(displayName);
  const { data: clash } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert({
      display_name: displayName,
      slug,
      timezone,
      currency_code: currencyCode,
      status: "onboarding",
      created_by: context.user.id,
    })
    .select("id, display_name, slug, status, timezone, currency_code")
    .single();
  if (orgError || !organization) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_create_failed",
      detail: orgError?.message,
    };
  }

  const { data: invite, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(ownerEmail, {
      redirectTo: onboardingRedirectTo(env),
      ...(ownerFullName ? { data: { full_name: ownerFullName } } : {}),
    });
  if (inviteError || !invite?.user) {
    await supabase.from("organizations").delete().eq("id", organization.id);
    const already = /already/i.test(inviteError?.message ?? "");
    return {
      ok: false as const,
      statusCode: already ? 409 : 502,
      error: already ? "owner_email_already_registered" : "owner_invite_failed",
      detail: inviteError?.message,
    };
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: invite.user.id,
      role: "owner",
      is_active: true,
      invited_by: context.user.id,
      invited_at: new Date().toISOString(),
    });
  if (memberError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "owner_member_create_failed",
      detail: memberError.message,
    };
  }

  // Sin una suscripción válida, `private.can_access_org` (RLS) deja fuera al
  // owner y `resolveAuthContext` responde 409 membership_missing -> no podría
  // ni entrar a completar el onboarding y pagar. Se crea en 'trial' abierto;
  // el cobro real la pasará a 'active' cuando exista la facturación.
  const { error: subError } = await supabase
    .from("service_subscriptions")
    .insert({
      organization_id: organization.id,
      plan_code: "trial",
      status: "trial",
      starts_at: new Date().toISOString(),
    });
  if (subError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "owner_subscription_create_failed",
      detail: subError.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId: organization.id,
    actorUserId: context.user.id,
    action: "admin.create_client_organization",
    entityType: "organization",
    entityId: organization.id,
    newData: { organization, owner_email: ownerEmail },
  });
  return {
    ok: true as const,
    data: {
      organization,
      owner: { user_id: invite.user.id, email: ownerEmail },
    },
  };
}

// --- Alta de cliente por un consultor (sin platform_admin) -----------------
// El consultor crea la organización del cliente, queda ligada a él por
// consultant_assignment, y se genera un código único y temporal que comparte
// con el cliente. El cliente lo canjea en /acceso -> sesión -> onboarding.

const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin O/0/I/1/L
const INVITE_TTL_DAYS = 7;

function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

function accessPath(env: ApiEnv, code: string): string {
  return `${(env.WEB_ORIGIN ?? "http://localhost:3001").replace(/\/$/, "")}/acceso?code=${code}`;
}

export async function createClientForConsultant(
  env: ApiEnv,
  context: AuthContext,
  body: {
    display_name?: string;
    owner_email?: string;
    owner_full_name?: string;
    timezone?: string;
    currency_code?: string;
  },
) {
  if (
    !["consultant", "platform_admin"].includes(context.profile.platform_role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_access_required",
      message: "Solo un consultor o platform admin puede dar de alta clientes.",
    };
  }

  const displayName = body.display_name?.trim() ?? "";
  const ownerEmail = body.owner_email?.trim().toLowerCase() ?? "";
  const ownerFullName = body.owner_full_name?.trim() || null;
  const timezone = body.timezone?.trim() || "Europe/Madrid";
  const currencyCode = (body.currency_code?.trim() || "EUR").toUpperCase();

  if (displayName.length === 0)
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_display_name",
    };
  if (!isEmail(ownerEmail))
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_owner_email",
    };
  if (!/^[A-Z]{3}$/.test(currencyCode))
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_currency_code",
    };

  const supabase = createServiceClient(env);

  let slug = slugify(displayName);
  const { data: clash } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert({
      display_name: displayName,
      slug,
      timezone,
      currency_code: currencyCode,
      status: "onboarding",
      created_by: context.user.id,
    })
    .select("id, display_name, slug, status, timezone, currency_code")
    .single();
  if (orgError || !organization) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_create_failed",
      detail: orgError?.message,
    };
  }

  // `generateLink` type 'invite' crea el usuario de Auth SIN enviar email: el
  // reparto lo hace el consultor con el código. Si ya existe, se aborta.
  const { data: link, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "invite",
      email: ownerEmail,
      options: {
        redirectTo: onboardingRedirectTo(env),
        ...(ownerFullName ? { data: { full_name: ownerFullName } } : {}),
      },
    });
  if (linkError || !link?.user) {
    await supabase.from("organizations").delete().eq("id", organization.id);
    const already = /already|exist/i.test(linkError?.message ?? "");
    return {
      ok: false as const,
      statusCode: already ? 409 : 502,
      error: already ? "owner_email_already_registered" : "owner_invite_failed",
      detail: linkError?.message,
    };
  }
  const ownerUserId = link.user.id;

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: ownerUserId,
      role: "owner",
      // La organizacion ya existe y esta asignada al consultor, pero el cliente
      // no recibe acceso hasta confirmar expresamente la invitacion en /acceso.
      is_active: false,
      invited_by: context.user.id,
      invited_at: new Date().toISOString(),
    });
  if (memberError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "owner_member_create_failed",
      detail: memberError.message,
    };
  }

  const { error: subError } = await supabase
    .from("service_subscriptions")
    .insert({
      organization_id: organization.id,
      plan_code: "trial",
      status: "trial",
      starts_at: new Date().toISOString(),
    });
  if (subError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "owner_subscription_create_failed",
      detail: subError.message,
    };
  }

  // La organización queda en la cartera del consultor que la crea.
  const { error: assignError } = await supabase
    .from("consultant_assignments")
    .insert({
      organization_id: organization.id,
      consultant_user_id: context.user.id,
      is_primary: true,
      is_active: true,
      assigned_by: context.user.id,
    });
  if (assignError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "assignment_create_failed",
      detail: assignError.message,
    };
  }

  // Si este consultor comparte cartera con alguien, la tienda nace ya
  // asignada a los dos. Sin esto habria que acordarse de añadir al socio en
  // cada alta, y el dia que se olvide deja de ver una tienda sin aviso.
  await assignPartnersToOrganization(
    supabase,
    context.user.id,
    organization.id,
  );

  const code = generateInviteCode();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 86400_000,
  ).toISOString();
  const { error: inviteError } = await supabase.from("client_invites").insert({
    organization_id: organization.id,
    invited_user_id: ownerUserId,
    consultant_user_id: context.user.id,
    email: ownerEmail,
    code,
    expires_at: expiresAt,
  });
  if (inviteError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "invite_create_failed",
      detail: inviteError.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId: organization.id,
    actorUserId: context.user.id,
    action: "consultant.create_client",
    entityType: "organization",
    entityId: organization.id,
    newData: { organization, owner_email: ownerEmail },
  });

  const clientAccessUrl = accessPath(env, code);
  const sent = await sendInviteMail(env, {
    to: ownerEmail,
    recipientName: ownerFullName,
    title: `Invitación a ${displayName} en EcomScaling`,
    intro: `Tu consultor ha creado la organización ${displayName}. Verifica el código y confirma que quieres unirte.`,
    actionLabel: "Revisar invitación",
    actionUrl: clientAccessUrl,
  });
  if (!sent.sent) {
    logger.info("client_invite_smtp_fallback", { reason: sent.reason });
  }

  return {
    ok: true as const,
    data: {
      organization,
      owner: { user_id: ownerUserId, email: ownerEmail },
      invite: {
        code,
        expires_at: expiresAt,
        access_url: clientAccessUrl,
        delivery: sent.sent ? "email" : "manual_link",
      },
    },
  };
}

/** Genera un código nuevo para un cliente cuyo código caducó o se perdió.
 *  Solo el consultor asignado (o platform_admin). */
export async function regenerateClientInvite(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireStoreManager(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: pending, error: loadError } = await supabase
    .from("client_invites")
    .select("id, email, invited_user_id, status")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (loadError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "invite_load_failed",
      detail: loadError.message,
    };
  if (!pending)
    return { ok: false as const, statusCode: 404, error: "invite_not_found" };
  if (pending.status === "redeemed")
    return {
      ok: false as const,
      statusCode: 409,
      error: "invite_already_redeemed",
    };

  const code = generateInviteCode();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 86400_000,
  ).toISOString();
  const { error: updateError } = await supabase
    .from("client_invites")
    .update({ code, expires_at: expiresAt, status: "pending" })
    .eq("id", pending.id);
  if (updateError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "invite_update_failed",
      detail: updateError.message,
    };

  return {
    ok: true as const,
    data: { code, expires_at: expiresAt, access_url: accessPath(env, code) },
  };
}

/** Canje público del código por parte del cliente: valida código + email y
 *  devuelve un enlace de sesión (magic link) que lleva a /onboarding. */
export async function redeemClientInvite(
  env: ApiEnv,
  body: { code?: string; email?: string },
) {
  const code = body.code?.trim().toUpperCase() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  if (code.length < 6 || !isEmail(email)) {
    return { ok: false as const, statusCode: 400, error: "invalid_input" };
  }

  const supabase = createServiceClient(env);
  const { data: invite, error } = await supabase
    .from("client_invites")
    .select("id, email, status, expires_at, organization_id, invited_user_id")
    .eq("code", code)
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "invite_load_failed",
      detail: error.message,
    };
  if (!invite)
    return { ok: false as const, statusCode: 404, error: "invite_not_found" };
  if (invite.status !== "pending")
    return {
      ok: false as const,
      statusCode: 409,
      error: "invite_already_used",
    };
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false as const, statusCode: 410, error: "invite_expired" };
  }
  if ((invite.email as string).toLowerCase() !== email) {
    return { ok: false as const, statusCode: 403, error: "email_mismatch" };
  }

  const { data: link, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: onboardingRedirectTo(env) },
    });
  const actionLink = link?.properties?.action_link;
  if (linkError || !actionLink) {
    return {
      ok: false as const,
      statusCode: 502,
      error: "link_generation_failed",
      detail: linkError?.message,
    };
  }

  const { data: claimedInvite, error: claimError } = await supabase.rpc(
    "accept_client_invite",
    {
      p_invite_id: invite.id,
      p_organization_id: invite.organization_id,
      p_user_id: invite.invited_user_id,
    },
  );

  if (claimError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "invite_claim_failed",
      detail: claimError.message,
    };
  }
  if (claimedInvite !== true) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "invite_already_used",
    };
  }

  return { ok: true as const, data: { url: actionLink } };
}

/** Vista previa publica. Exige codigo + email para no revelar organizaciones
 * por enumeracion, pero no consume la invitacion ni concede acceso. */
export async function previewClientInvite(
  env: ApiEnv,
  body: { code?: string; email?: string },
) {
  const code = body.code?.trim().toUpperCase() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  if (code.length < 6 || !isEmail(email)) {
    return { ok: false as const, statusCode: 400, error: "invalid_input" };
  }

  const supabase = createServiceClient(env);
  const { data: invite, error } = await supabase
    .from("client_invites")
    .select("id, email, status, expires_at, organization_id")
    .eq("code", code)
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "invite_load_failed",
      detail: error.message,
    };
  if (!invite)
    return { ok: false as const, statusCode: 404, error: "invite_not_found" };
  if (invite.status !== "pending")
    return {
      ok: false as const,
      statusCode: 409,
      error: "invite_already_used",
    };
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false as const, statusCode: 410, error: "invite_expired" };
  }
  if ((invite.email as string).toLowerCase() !== email) {
    return { ok: false as const, statusCode: 403, error: "email_mismatch" };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, display_name")
    .eq("id", invite.organization_id)
    .single();
  if (organizationError || !organization) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_load_failed",
      detail: organizationError?.message,
    };
  }

  return {
    ok: true as const,
    data: { organization, expires_at: invite.expires_at },
  };
}

/**
 * Alta manual de una tienda propia del consultor: organizacion + membership
 * real de owner para el propio consultor (accessSource "membership"), sin
 * consultant_assignment ni invitacion por email. Aparece en "Mis tiendas" de
 * /tiendas y en el selector de cliente activo. Para dar de alta un CLIENTE
 * (owner distinto, invitado por email) se usa createClientOrganization.
 */
export async function createOwnStore(
  env: ApiEnv,
  context: AuthContext,
  body: { display_name?: string; timezone?: string; currency_code?: string },
) {
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

  const displayName = body.display_name?.trim() ?? "";
  const timezone = body.timezone?.trim() || "Europe/Madrid";
  const currencyCode = (body.currency_code?.trim() || "EUR").toUpperCase();

  if (displayName.length === 0) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_display_name",
    };
  }
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_currency_code",
    };
  }

  const supabase = createServiceClient(env);

  let slug = slugify(displayName);
  const { data: clash } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert({
      display_name: displayName,
      slug,
      timezone,
      currency_code: currencyCode,
      status: "onboarding",
      created_by: context.user.id,
    })
    .select("id, display_name, slug, status, timezone, currency_code")
    .single();
  if (orgError || !organization) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_create_failed",
      detail: orgError?.message,
    };
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: context.user.id,
      role: "owner",
      is_active: true,
      invited_by: context.user.id,
      invited_at: new Date().toISOString(),
      joined_at: new Date().toISOString(),
    });
  if (memberError) {
    await supabase.from("organizations").delete().eq("id", organization.id);
    return {
      ok: false as const,
      statusCode: 500,
      error: "owner_member_create_failed",
      detail: memberError.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId: organization.id,
    actorUserId: context.user.id,
    action: "consultant.create_own_store",
    entityType: "organization",
    entityId: organization.id,
    newData: { organization },
  });

  return { ok: true as const, data: { organization } };
}

/** Vista platform_admin: todos los clientes (organizaciones) con su consultor
 *  asignado o "sin consultor". Editar/borrar reusa las rutas de organizacion. */
export async function listAdminClients(env: ApiEnv, context: AuthContext) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const [
    { data: organizations, error: orgsError },
    { data: assignments, error: assignmentsError },
    { data: members, error: membersError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, display_name, slug, status, timezone, currency_code, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("consultant_assignments")
      .select("organization_id, consultant_user_id, is_primary")
      .eq("is_active", true),
    supabase
      .from("organization_members")
      .select("organization_id, user_id, role")
      .eq("is_active", true),
  ]);

  if (orgsError || assignmentsError || membersError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "clients_load_failed",
      detail:
        orgsError?.message ??
        assignmentsError?.message ??
        membersError?.message,
    };
  }

  const consultantIds = [
    ...new Set((assignments ?? []).map((a) => a.consultant_user_id as string)),
  ];
  let consultantProfiles: Array<{ id: string; full_name: string | null }> = [];
  if (consultantIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", consultantIds);
    if (error) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "clients_load_failed",
        detail: error.message,
      };
    }
    consultantProfiles = (data ?? []) as Array<{
      id: string;
      full_name: string | null;
    }>;
  }
  const nameById = new Map(consultantProfiles.map((p) => [p.id, p.full_name]));

  const consultantsByOrg = new Map<
    string,
    Array<{ user_id: string; full_name: string | null; is_primary: boolean }>
  >();
  for (const a of assignments ?? []) {
    const orgId = a.organization_id as string;
    const list = consultantsByOrg.get(orgId) ?? [];
    list.push({
      user_id: a.consultant_user_id as string,
      full_name: nameById.get(a.consultant_user_id as string) ?? null,
      is_primary: Boolean(a.is_primary),
    });
    consultantsByOrg.set(orgId, list);
  }
  const memberCountByOrg = new Map<string, number>();
  for (const m of members ?? []) {
    const orgId = m.organization_id as string;
    memberCountByOrg.set(orgId, (memberCountByOrg.get(orgId) ?? 0) + 1);
  }

  return {
    ok: true as const,
    data: {
      clients: (organizations ?? []).map((org) => ({
        ...org,
        member_count: memberCountByOrg.get(org.id as string) ?? 0,
        consultants: consultantsByOrg.get(org.id as string) ?? [],
      })),
    },
  };
}

type ObservabilityRun = {
  id: string;
  agent_code: string;
  agent_name: string;
  status: string;
  execution_mode: string | null;
  trigger_type: string;
  objective: string;
  /** AI-30: null = modelo sin tarifa conocida. No es gratis; ver cost_basis. */
  cost_usd: number | null;
  cost_basis: string | null;
  /** Proveedor y modelo REALES del turno, no los configurados en agent_versions. */
  provider: string | null;
  model: string | null;
  /** Correlacion con la peticion HTTP o la pasada de cron que lo lanzo. */
  trace_id: string | null;
  latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  error_message: string | null;
  started_at: string;
  organization_id: string;
  organization_name: string;
  store_id: string | null;
  store_name: string | null;
  actor_name: string | null;
  consultant_id: string | null;
  consultant_name: string | null;
};

// Desenreda `agent_versions!inner(agent_definitions!inner(code, name))`, que
// supabase-js puede devolver como objeto o como array de un elemento.
function unwrapAgentDefinition(value: unknown): { code: string; name: string } {
  const av = Array.isArray(value) ? value[0] : value;
  const def = (av as { agent_definitions?: unknown } | null)?.agent_definitions;
  const one = Array.isArray(def) ? def[0] : def;
  const code = String((one as { code?: unknown } | null)?.code ?? "");
  const name = String((one as { name?: unknown } | null)?.name ?? code);
  return { code, name };
}

/** Vista platform_admin (/admin/observabilidad): salud del runtime de agentes
 *  IA en toda la plataforma. Agregados por agente (funcion SQL) + muestra de
 *  las ejecuciones mas recientes con cliente / tienda / consultor resueltos. */
export async function getAdminObservability(env: ApiEnv, context: AuthContext) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const since = new Date(
    Date.now() - AI_STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    { data: agentStats, error: agentStatsError },
    { data: orgStats, error: orgStatsError },
    { data: consultantStats, error: consultantStatsError },
    { data: runRows, error: runsError },
    { data: organizations, error: orgsError },
    { data: stores, error: storesError },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
    supabase.rpc("admin_agent_runtime_stats", { since }),
    supabase.rpc("admin_organization_ai_stats", { since }),
    supabase.rpc("admin_consultant_ai_stats", { since }),
    supabase
      .from("agent_runs")
      .select(
        "id, status, execution_mode, trigger_type, objective, estimated_cost_usd, cost_basis, provider, model, trace_id, latency_ms, input_tokens, output_tokens, error_message, started_at, organization_id, store_id, actor_user_id, agent_versions!inner(agent_definitions!inner(code, name))",
      )
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(120),
    supabase
      .from("organizations")
      .select("id, display_name")
      .order("display_name", { ascending: true }),
    supabase.from("shopify_stores").select("id, shop_name"),
    supabase
      .from("consultant_assignments")
      .select("organization_id, consultant_user_id, is_primary")
      .eq("is_active", true),
  ]);

  if (runsError || orgsError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "observability_load_failed",
      detail: runsError?.message ?? orgsError?.message,
    };
  }

  // Los agregados (por agente / cliente / consultor) y la resolucion de
  // tienda/consultor son complementarios: si una funcion rpc aun no esta
  // desplegada o falta una tabla, la vista sigue sirviendose con lo que haya.
  if (
    agentStatsError ||
    orgStatsError ||
    consultantStatsError ||
    storesError ||
    assignmentsError
  ) {
    logger.info("admin_observability_partial", {
      agentStatsError: agentStatsError?.message,
      orgStatsError: orgStatsError?.message,
      consultantStatsError: consultantStatsError?.message,
      storesError: storesError?.message,
      assignmentsError: assignmentsError?.message,
    });
  }

  const orgNameById = new Map(
    (organizations ?? []).map((org) => [
      org.id as string,
      org.display_name as string,
    ]),
  );
  const storeNameById = new Map(
    (stores ?? []).map((store) => [
      store.id as string,
      store.shop_name as string,
    ]),
  );

  // Consultor principal por organizacion (el marcado is_primary, o el primero
  // asignado si no hay principal).
  const primaryConsultantByOrg = new Map<string, string>();
  for (const assignment of assignments ?? []) {
    const orgId = assignment.organization_id as string;
    if (assignment.is_primary || !primaryConsultantByOrg.has(orgId)) {
      primaryConsultantByOrg.set(
        orgId,
        assignment.consultant_user_id as string,
      );
    }
  }

  const rows = (runRows ?? []) as Array<Record<string, unknown>>;
  const actorIds = rows
    .map((row) => row.actor_user_id)
    .filter((value): value is string => typeof value === "string");
  const consultantStatIds = (
    (consultantStats ?? []) as Array<Record<string, unknown>>
  )
    .map((row) => row.consultant_user_id)
    .filter((value): value is string => typeof value === "string");
  const profileIds = [
    ...new Set([
      ...actorIds,
      ...primaryConsultantByOrg.values(),
      ...consultantStatIds,
    ]),
  ];
  const nameById = new Map<string, string | null>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const profile of profiles ?? []) {
      nameById.set(
        profile.id as string,
        (profile.full_name as string | null) ?? null,
      );
    }
  }

  const runs: ObservabilityRun[] = rows.map((row) => {
    const agent = unwrapAgentDefinition(row.agent_versions);
    const orgId = row.organization_id as string;
    const storeId = row.store_id as string | null;
    const actorId = row.actor_user_id as string | null;
    const consultantId = primaryConsultantByOrg.get(orgId) ?? null;
    const latency = row.latency_ms;
    return {
      id: row.id as string,
      agent_code: agent.code,
      agent_name: agent.name,
      status: row.status as string,
      execution_mode: (row.execution_mode as string | null) ?? null,
      trigger_type: row.trigger_type as string,
      objective: String(row.objective ?? ""),
      // AI-30: null se propaga tal cual. Convertirlo en 0 aqui volveria a
      // pintar como gratis una ejecucion cuyo coste no sabemos calcular.
      cost_usd:
        row.estimated_cost_usd == null ? null : Number(row.estimated_cost_usd),
      cost_basis: (row.cost_basis as string | null) ?? null,
      provider: (row.provider as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      trace_id: (row.trace_id as string | null) ?? null,
      latency_ms: latency == null ? null : Number(latency),
      input_tokens: Number(row.input_tokens ?? 0),
      output_tokens: Number(row.output_tokens ?? 0),
      error_message: (row.error_message as string | null) ?? null,
      started_at: row.started_at as string,
      organization_id: orgId,
      organization_name: orgNameById.get(orgId) ?? orgId,
      store_id: storeId,
      store_name: storeId ? (storeNameById.get(storeId) ?? null) : null,
      actor_name: actorId ? (nameById.get(actorId) ?? null) : null,
      consultant_id: consultantId,
      consultant_name: consultantId
        ? (nameById.get(consultantId) ?? null)
        : null,
    };
  });

  const byAgent = ((agentStats ?? []) as Array<Record<string, unknown>>).map(
    (row) => ({
      agent_code: String(row.agent_code ?? ""),
      agent_name: String(row.agent_name ?? row.agent_code ?? ""),
      run_count: Number(row.run_count ?? 0),
      failed_count: Number(row.failed_count ?? 0),
      running_count: Number(row.running_count ?? 0),
      total_cost_usd: Number(row.total_cost_usd ?? 0),
      avg_latency_ms:
        row.avg_latency_ms == null ? null : Number(row.avg_latency_ms),
      p95_latency_ms:
        row.p95_latency_ms == null ? null : Number(row.p95_latency_ms),
    }),
  );

  const byClient = ((orgStats ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const orgId = String(row.organization_id ?? "");
      return {
        organization_id: orgId,
        name: orgNameById.get(orgId) ?? orgId,
        run_count: Number(row.run_count ?? 0),
        total_cost_usd: Number(row.total_cost_usd ?? 0),
        top_agents: normalizeTopAgents(row.top_agents),
      };
    })
    .sort((a, b) => b.run_count - a.run_count);

  const byConsultant = (
    (consultantStats ?? []) as Array<Record<string, unknown>>
  )
    .map((row) => {
      const consultantId = String(row.consultant_user_id ?? "");
      return {
        consultant_user_id: consultantId,
        name: nameById.get(consultantId) ?? consultantId,
        client_count: Number(row.client_count ?? 0),
        run_count: Number(row.run_count ?? 0),
        total_cost_usd: Number(row.total_cost_usd ?? 0),
        top_agents: normalizeTopAgents(row.top_agents),
      };
    })
    .sort((a, b) => b.run_count - a.run_count);

  const totals = byAgent.reduce(
    (acc, agent) => {
      acc.run_count += agent.run_count;
      acc.failed_count += agent.failed_count;
      acc.running_count += agent.running_count;
      acc.total_cost_usd += agent.total_cost_usd;
      acc.latency_weight += (agent.avg_latency_ms ?? 0) * agent.run_count;
      return acc;
    },
    {
      run_count: 0,
      failed_count: 0,
      running_count: 0,
      total_cost_usd: 0,
      latency_weight: 0,
    },
  );

  return {
    ok: true as const,
    data: {
      window_days: AI_STATS_WINDOW_DAYS,
      summary: {
        run_count: totals.run_count,
        failed_count: totals.failed_count,
        running_count: totals.running_count,
        total_cost_usd: Number(totals.total_cost_usd.toFixed(4)),
        avg_latency_ms:
          totals.run_count > 0
            ? Math.round(totals.latency_weight / totals.run_count)
            : null,
      },
      by_agent: byAgent,
      by_client: byClient,
      by_consultant: byConsultant,
      runs,
      organizations: (organizations ?? []).map((org) => ({
        id: org.id as string,
        display_name: org.display_name as string,
      })),
    },
  };
}

// --- "Mi trabajo": lo que le toca al consultor, no a sus clientes ----------
//
// Deliberadamente NO hay tabla nueva. Todo lo que hace falta ya existe:
// llamadas agendadas, notas internas de llamada (`call_internal_notes`, que
// son los apuntes de preparacion y ya nacen ancladas a la llamada donde se van
// a usar), tareas internas (`is_visible_to_client = false`, entre ellas las
// que A01 propone con owner "consultor") y los huecos de la ultima llamada.
// Lo que faltaba no era donde guardarlo: era una pantalla donde la proxima
// llamada y lo que debes para ella esten juntos, sin cambiar de cliente cuatro
// veces para preparar el lunes.

const WORK_HORIZON_DAYS = 14;
const WORK_PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  low: 0,
};

export type WorkOrganization = { id: string; display_name: string };

export type WorkCallRow = {
  id: string;
  title: string;
  call_type: string;
  status: string;
  scheduled_at: string | null;
  held_at: string | null;
  organization_id: string;
  internal_notes: Array<{ id: string; body: string; created_at: string }>;
  gaps: Array<{ topic: string; severity: string }>;
};

export type WorkTaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string;
  organization_id: string;
};

/**
 * Deriva la pantalla entera a partir de las dos consultas. Puro a proposito:
 * el reparto (que llamada es "proxima", que cliente esta descubierto, en que
 * orden van mis tareas) es la logica que importa y la que se rompe en silencio
 * si alguien toca un criterio.
 */
export function buildConsultantWork(input: {
  organizations: WorkOrganization[];
  calls: WorkCallRow[];
  tasks: WorkTaskRow[];
  nowMs: number;
}) {
  const { organizations, calls, tasks, nowMs } = input;
  const nameByOrg = new Map(
    organizations.map((organization) => [
      organization.id,
      organization.display_name,
    ]),
  );
  const horizonMs = nowMs + WORK_HORIZON_DAYS * 86_400_000;

  // Ultima llamada realizada por cliente: de ahi salen los huecos que el
  // agente senalo y que siguen sin tratarse.
  const lastHeldByOrg = new Map<string, WorkCallRow>();
  for (const call of calls) {
    if (call.status !== "held" || !call.held_at) continue;
    const current = lastHeldByOrg.get(call.organization_id);
    if (
      !current ||
      Date.parse(call.held_at) > Date.parse(current.held_at as string)
    ) {
      lastHeldByOrg.set(call.organization_id, call);
    }
  }

  const openTasks = tasks.filter((task) =>
    ["pending", "in_progress"].includes(task.status),
  );
  const myTaskCountByOrg = new Map<string, number>();
  for (const task of openTasks) {
    myTaskCountByOrg.set(
      task.organization_id,
      (myTaskCountByOrg.get(task.organization_id) ?? 0) + 1,
    );
  }

  const upcoming = calls
    .filter((call) => {
      if (call.status !== "scheduled" || !call.scheduled_at) return false;
      const at = Date.parse(call.scheduled_at);
      // Una llamada agendada que ya paso y nadie marco como realizada no es
      // "proxima", pero tampoco puede desaparecer: sigue arriba, marcada.
      return !Number.isNaN(at) && at <= horizonMs;
    })
    .sort(
      (a, b) =>
        Date.parse(a.scheduled_at as string) -
        Date.parse(b.scheduled_at as string),
    )
    .map((call) => {
      const lastHeld = lastHeldByOrg.get(call.organization_id) ?? null;
      return {
        ...call,
        organization_name:
          nameByOrg.get(call.organization_id) ?? call.organization_id,
        is_overdue: Date.parse(call.scheduled_at as string) < nowMs,
        my_open_tasks: myTaskCountByOrg.get(call.organization_id) ?? 0,
        last_call: lastHeld
          ? {
              id: lastHeld.id,
              title: lastHeld.title,
              held_at: lastHeld.held_at,
              gaps: lastHeld.gaps,
            }
          : null,
      };
    });

  const orgsWithUpcoming = new Set(
    upcoming.map((call) => call.organization_id),
  );

  // Clientes a los que no tienes nada agendado. Es la mitad del control que no
  // da ninguna otra pantalla: lo que no esta en el calendario no existe.
  const uncovered = organizations
    .filter((organization) => !orgsWithUpcoming.has(organization.id))
    .map((organization) => {
      const lastHeld = lastHeldByOrg.get(organization.id) ?? null;
      const heldAt = lastHeld?.held_at ?? null;
      return {
        id: organization.id,
        display_name: organization.display_name,
        last_call_at: heldAt,
        days_since_last_call: heldAt
          ? Math.floor((nowMs - Date.parse(heldAt)) / 86_400_000)
          : null,
        my_open_tasks: myTaskCountByOrg.get(organization.id) ?? 0,
      };
    })
    // Primero el silencio mas largo; los que nunca han tenido llamada, arriba.
    .sort(
      (a, b) =>
        (b.days_since_last_call ?? Number.MAX_SAFE_INTEGER) -
        (a.days_since_last_call ?? Number.MAX_SAFE_INTEGER),
    );

  const myTasks = openTasks
    .map((task) => ({
      ...task,
      organization_name:
        nameByOrg.get(task.organization_id) ?? task.organization_id,
      is_overdue:
        Boolean(task.due_at) && Date.parse(task.due_at as string) < nowMs,
    }))
    .sort(
      (a, b) =>
        Number(b.is_overdue) - Number(a.is_overdue) ||
        (WORK_PRIORITY_WEIGHT[b.priority] ?? 0) -
          (WORK_PRIORITY_WEIGHT[a.priority] ?? 0) ||
        Date.parse(a.due_at ?? a.created_at) -
          Date.parse(b.due_at ?? b.created_at),
    );

  return {
    upcoming_calls: upcoming,
    my_tasks: myTasks,
    uncovered_clients: uncovered,
  };
}

export async function listConsultantWork(
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

  const organizations = orgsResult.data.organizations as WorkOrganization[];
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const [callsResult, tasksResult] = await Promise.all([
    supabase
      .from("consulting_calls")
      .select(
        "id, title, call_type, status, scheduled_at, held_at, organization_id, call_internal_notes(id, body, created_at), call_ai_summaries(status, key_points)",
      )
      .in("organization_id", safeIds)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("tasks")
      .select(
        "id, title, status, priority, due_at, created_at, organization_id",
      )
      .in("organization_id", safeIds)
      .eq("is_visible_to_client", false)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (callsResult.error || tasksResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_work_load_failed",
      detail: callsResult.error?.message ?? tasksResult.error?.message,
    };
  }

  const calls: WorkCallRow[] = (
    (callsResult.data ?? []) as Array<Record<string, unknown>>
  ).map((call) => {
    // Huecos del resumen PUBLICADO: uno pendiente todavia no es una conclusion
    // sobre la que actuar, y ya aparece como tal en /llamadas.
    const summaries =
      (call.call_ai_summaries as Array<{
        status: string;
        key_points: unknown;
      }> | null) ?? [];
    const published = summaries.find(
      (summary) => summary.status === "published",
    );
    const keyPoints =
      published?.key_points &&
      typeof published.key_points === "object" &&
      !Array.isArray(published.key_points)
        ? (published.key_points as { consultant_gaps?: unknown })
        : null;
    const gaps = Array.isArray(keyPoints?.consultant_gaps)
      ? (keyPoints.consultant_gaps as Array<Record<string, unknown>>).map(
          (gap) => ({
            topic: String(gap.topic ?? ""),
            severity: String(gap.severity ?? "low"),
          }),
        )
      : [];

    return {
      id: call.id as string,
      title: call.title as string,
      call_type: call.call_type as string,
      status: call.status as string,
      scheduled_at: (call.scheduled_at as string | null) ?? null,
      held_at: (call.held_at as string | null) ?? null,
      organization_id: call.organization_id as string,
      internal_notes:
        (call.call_internal_notes as WorkCallRow["internal_notes"] | null) ??
        [],
      gaps,
    };
  });

  return {
    ok: true as const,
    data: {
      ...buildConsultantWork({
        organizations,
        calls,
        tasks: (tasksResult.data ?? []) as WorkTaskRow[],
        nowMs: Date.now(),
      }),
      organizations,
    },
  };
}

// ---------------------------------------------------------------------------
// Accesos de un cliente, desde la vista del consultor.
//
// `getOrganizationAccess` ya existia pero es platform_admin only, y devuelve
// `available_profiles` con TODOS los perfiles activos de la plataforma: abrir
// ese gate al consultor le habria entregado el directorio de usuarios de todos
// los tenants. Estas funciones son la version acotada a un solo cliente.
// ---------------------------------------------------------------------------

const CLIENT_MEMBER_ROLES = ["owner", "manager", "member", "readonly"] as const;

/**
 * ¿Este cambio deja al cliente sin ningun propietario activo?
 *
 * Un cliente sin owner no tiene a nadie que pueda aceptar condiciones ni
 * recuperar la cuenta, y arreglarlo exige entrar por platform admin. El fallo
 * no da error: el consultor degrada al unico owner "para ordenar roles" y el
 * cliente se queda huerfano sin que nada lo avise.
 */
export function leavesClientWithoutOwner(
  activeOwnerIds: string[],
  targetUserId: string,
  patch: { role?: unknown; is_active?: unknown },
): boolean {
  const isLastOwner =
    activeOwnerIds.length === 1 && activeOwnerIds[0] === targetUserId;
  if (!isLastOwner) return false;

  const losesAccess = patch.is_active === false;
  const losesOwnerRole = patch.role !== undefined && patch.role !== "owner";
  return losesAccess || losesOwnerRole;
}

/** Quien tiene acceso a este cliente: sus miembros y sus consultores. */
export async function getClientAccess(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireStoreManager(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);

  const [membersResult, assignmentsResult] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, user_id, role, is_active, invited_at, joined_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("consultant_assignments")
      .select("id, consultant_user_id, is_primary, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
  ]);

  if (membersResult.error || assignmentsResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "client_access_load_failed",
      detail: membersResult.error?.message ?? assignmentsResult.error?.message,
    };
  }

  // Solo los perfiles implicados en ESTE cliente, nunca el directorio entero.
  const userIds = [
    ...new Set([
      ...(membersResult.data ?? []).map((row) => row.user_id as string),
      ...(assignmentsResult.data ?? []).map(
        (row) => row.consultant_user_id as string,
      ),
    ]),
  ];

  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, platform_role, is_active")
        .in("id", userIds)
    : { data: [], error: null };

  if (profilesError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "client_access_load_failed",
      detail: profilesError.message,
    };
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id as string, profile]),
  );

  const { data: invites } = await supabase
    .from("client_invites")
    .select("id, email, status, expires_at, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      members: (membersResult.data ?? []).map((member) => ({
        ...member,
        profile: profileById.get(member.user_id as string) ?? null,
      })),
      consultants: (assignmentsResult.data ?? []).map((assignment) => ({
        ...assignment,
        profile:
          profileById.get(assignment.consultant_user_id as string) ?? null,
      })),
      pending_invites: invites ?? [],
    },
  };
}

/**
 * Invita a una persona mas a un cliente que ya existe.
 *
 * Hasta ahora solo se creaba una invitacion, en el alta del cliente, y
 * `regenerateClientInvite` solo sabia renovar esa (devuelve `invite_not_found`
 * si no hay ninguna pendiente): dar de alta a una segunda persona -- el de
 * marketing del cliente, un socio -- no se podia sin pasar por platform admin.
 *
 * Mismo mecanismo que el alta: `generateLink` crea el usuario de Auth sin
 * enviar correo y el consultor reparte el codigo.
 */
export async function inviteClientMember(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: { email?: string; full_name?: string; role?: string },
) {
  const access = requireStoreManager(context, organizationId);
  if (access.ok === false) return access;

  const email = body.email?.trim().toLowerCase() ?? "";
  const fullName = body.full_name?.trim() || null;
  const role = body.role?.trim() || "member";

  if (!isEmail(email)) {
    return { ok: false as const, statusCode: 400, error: "invalid_email" };
  }
  if (!(CLIENT_MEMBER_ROLES as readonly string[]).includes(role)) {
    return { ok: false as const, statusCode: 400, error: "invalid_role" };
  }

  const supabase = createServiceClient(env);
  const { data: inviteOrganization, error: inviteOrganizationError } =
    await supabase
      .from("organizations")
      .select("display_name")
      .eq("id", organizationId)
      .single();
  if (inviteOrganizationError || !inviteOrganization) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "organization_load_failed",
      detail: inviteOrganizationError?.message,
    };
  }

  const { data: link, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: onboardingRedirectTo(env),
        ...(fullName ? { data: { full_name: fullName } } : {}),
      },
    });

  if (linkError || !link?.user) {
    // ponytail: una cuenta que ya existe se deriva a platform admin. Enlazarla
    // aqui exige resolver el usuario por email con la Admin API y decidir que
    // pasa si ya pertenece a otro cliente; se hace cuando aparezca el caso.
    const already = /already|exist/i.test(linkError?.message ?? "");
    return {
      ok: false as const,
      statusCode: already ? 409 : 502,
      error: already ? "email_already_registered" : "invite_failed",
      message: already
        ? "Ese correo ya tiene cuenta en la plataforma. Pidele a un platform admin que lo asocie a este cliente."
        : undefined,
      detail: linkError?.message,
    };
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: link.user.id,
      role,
      is_active: false,
      invited_by: context.user.id,
      invited_at: new Date().toISOString(),
    });

  if (memberError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "member_create_failed",
      detail: memberError.message,
    };
  }

  const code = generateInviteCode();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 86400_000,
  ).toISOString();

  const { error: inviteError } = await supabase.from("client_invites").insert({
    organization_id: organizationId,
    invited_user_id: link.user.id,
    consultant_user_id: context.user.id,
    email,
    code,
    expires_at: expiresAt,
  });

  if (inviteError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "invite_create_failed",
      detail: inviteError.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.invite_client_member",
    entityType: "organization_member",
    entityId: link.user.id,
    newData: { email, role },
  });

  const memberAccessUrl = accessPath(env, code);
  const sent = await sendInviteMail(env, {
    to: email,
    recipientName: fullName,
    title: `Invitación a ${inviteOrganization.display_name} en EcomScaling`,
    intro: `Te han invitado a unirte a la organización ${inviteOrganization.display_name}. Revisa y confirma la invitación antes de obtener acceso.`,
    actionLabel: "Revisar invitación",
    actionUrl: memberAccessUrl,
  });
  if (!sent.sent) {
    logger.info("client_member_invite_smtp_fallback", { reason: sent.reason });
  }

  return {
    ok: true as const,
    data: {
      email,
      role,
      invite: {
        code,
        expires_at: expiresAt,
        access_url: memberAccessUrl,
        delivery: sent.sent ? "email" : "manual_link",
      },
    },
  };
}

/**
 * Cambia el rol de alguien que YA es miembro, o le retira el acceso.
 *
 * Actua sobre un miembro existente a proposito: la version de platform admin
 * (`upsertOrganizationMember`) pide un UUID de usuario tecleado a mano, que el
 * consultor no tiene forma de saber.
 */
export async function setClientMemberRole(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  userId: string,
  body: { role?: string; isActive?: unknown },
) {
  const access = requireStoreManager(context, organizationId);
  if (access.ok === false) return access;

  const patch: Record<string, unknown> = {};

  if (body.role !== undefined) {
    if (!(CLIENT_MEMBER_ROLES as readonly string[]).includes(body.role)) {
      return { ok: false as const, statusCode: 400, error: "invalid_role" };
    }
    patch.role = body.role;
  }
  if (body.isActive !== undefined) {
    patch.is_active = Boolean(body.isActive);
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false as const, statusCode: 400, error: "empty_update" };
  }

  const supabase = createServiceClient(env);

  // Un cliente sin ningun owner activo se queda sin nadie que pueda aceptar
  // condiciones ni recuperar la cuenta, y recuperarlo exige entrar por
  // platform admin. Se comprueba antes de degradar o desactivar al ultimo.
  const { data: owners } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .eq("is_active", true);

  const activeOwners = (owners ?? []).map((row) => row.user_id as string);

  if (leavesClientWithoutOwner(activeOwners, userId, patch)) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "last_owner",
      message:
        "Es el unico propietario activo del cliente. Nombra a otro antes de cambiarle el rol.",
    };
  }

  const { data, error } = await supabase
    .from("organization_members")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .select("id, user_id, role, is_active")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "member_update_failed",
      detail: error.message,
    };
  }
  if (!data) {
    return { ok: false as const, statusCode: 404, error: "member_not_found" };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "consultant.update_client_member",
    entityType: "organization_member",
    entityId: userId,
    newData: patch,
  });

  return { ok: true as const, data };
}

/**
 * FASE 3 / D01 — lo que el consultor ve de la calidad del dato.
 *
 * Es la primera pantalla de toda la fase 3: quince bloques de tablas llevaban
 * meses sin que nadie pudiera verlas. Se elige esta primera porque contesta la
 * pregunta que va antes que todas las demas -- "¿me puedo fiar de lo que estoy
 * mirando?" -- y porque es la unica que ya tiene motor escribiendo filas.
 *
 * El consultor lo ve todo (apartado 9 del plan maestro): las evaluaciones
 * enteras con sus motivos de degradacion y los issues abiertos, incluidos los
 * que no son accionables por el cliente. La vista de cliente es otra cosa y
 * vive en su panel: solo lo suyo y solo lo ya verificado (`isVisibleToClient`).
 *
 * Va con el cliente scoped al token del usuario, no con la service role: quien
 * decide que organizaciones se ven es la RLS, no este codigo.
 */
export async function listConsultantDataQuality(
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
  const nombrePorOrg = new Map(
    organizations.map((o) => [o.id, o.display_name]),
  );
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data: evaluaciones, error } = await supabase
    .from("data_quality_assessments")
    .select(
      "id, organization_id, store_id, source, dataset, phenomenon, scope, freshness, coverage, missingness, period_settlement, period_start, period_end, reliability, degradation_reasons, last_sync_at, expected_cadence_minutes, assessed_at",
    )
    .in("organization_id", safeIds)
    .order("assessed_at", { ascending: false })
    .limit(500);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_data_quality_load_failed",
      detail: error.message,
    };
  }

  const { data: issues } = await supabase
    .from("data_quality_issues")
    .select(
      "id, organization_id, store_id, source, dataset, phenomenon, scope, issue_type, description, severity, material, status, downstream_effect, client_actionable, detected_at",
    )
    .in("organization_id", safeIds)
    .in("status", ["open", "investigating"])
    .order("detected_at", { ascending: false })
    .limit(500);

  // Una evaluacion por fuente, tienda y organizacion: la mas reciente. Las
  // anteriores son el historial de calidad, y el historial no es esta pantalla.
  const vistas = new Map<string, (typeof evaluaciones)[number]>();
  for (const fila of evaluaciones ?? []) {
    const clave = `${fila.organization_id}|${fila.store_id ?? "-"}|${fila.source}|${fila.dataset}|${fila.scope}`;
    if (!vistas.has(clave)) vistas.set(clave, fila);
  }

  const issuesDe = (fila: (typeof evaluaciones)[number]) =>
    (issues ?? []).filter(
      (i) =>
        i.organization_id === fila.organization_id &&
        i.source === fila.source &&
        (i.store_id ?? null) === (fila.store_id ?? null),
    );

  const sources = [...vistas.values()].map((fila) => ({
    ...fila,
    organization_name: nombrePorOrg.get(fila.organization_id as string) ?? null,
    issues: issuesDe(fila),
  }));

  // Lo peor primero: una fuente inutilizable es lo unico que impide diagnosticar.
  const peso: Record<string, number> = {
    unusable: 0,
    low: 1,
    medium: 2,
    high: 3,
  };
  sources.sort(
    (a, b) =>
      (peso[a.reliability as string] ?? 9) -
        (peso[b.reliability as string] ?? 9) ||
      String(a.organization_name).localeCompare(String(b.organization_name)),
  );

  return {
    ok: true as const,
    data: {
      sources,
      summary: {
        evaluated: sources.length,
        blocked: sources.filter((s) =>
          s.issues.some((i) => i.downstream_effect === "blocked"),
        ).length,
        degraded: sources.filter(
          (s) =>
            !s.issues.some((i) => i.downstream_effect === "blocked") &&
            s.issues.some((i) => i.downstream_effect === "degraded"),
        ).length,
        client_actionable: (issues ?? []).filter((i) => i.client_actionable)
          .length,
      },
    },
  };
}

/**
 * FASE 3 / D02 — lo que el consultor ve de la contextualizacion.
 *
 * Solo consultor. El cliente no ve esto y no es un olvido: una lectura
 * contextual es razonamiento a medio hacer -- dice contra que se compara y si
 * la comparacion aguanta, no que pasa. Ensenarsela seria darle una conclusion
 * que todavia no existe.
 *
 * Lo que aporta en una linea: si el AOV cae y cada canal vende igual, no hay
 * nada que arreglar en el producto; cambio el peso de los canales. Sin la
 * descomposicion, los dos casos se leen igual.
 */
export async function listConsultantContextReadings(
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
  const nombrePorOrg = new Map(
    organizations.map((o) => [o.id, o.display_name]),
  );
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data: casos, error } = await supabase
    .from("diagnostic_cases")
    .select(
      "id, organization_id, store_id, target_metric, target_question, scope, status, analysis_period_start, analysis_period_end",
    )
    .in("organization_id", safeIds)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_context_load_failed",
      detail: error.message,
    };
  }

  const caseIds = (casos ?? []).map((c) => c.id as string);
  if (caseIds.length === 0) {
    return { ok: true as const, data: { readings: [] } };
  }

  const { data: lecturas } = await supabase
    .from("context_assessments")
    .select(
      "id, case_id, scope, baseline_type, baseline_period_start, baseline_period_end, baseline_rationale, comparability, comparability_reasons, aggregate_interpretation, context_sufficient, missing_context, critical_unknowns, primary_factors, uncertainty_notes, assessed_at",
    )
    .in("case_id", caseIds)
    .order("assessed_at", { ascending: false });

  const assessmentIds = (lecturas ?? []).map((a) => a.id as string);
  const { data: segmentos } = assessmentIds.length
    ? await supabase
        .from("context_mix_segments")
        .select(
          "assessment_id, dimension, segment, weight_before, weight_after, performance_before, performance_after",
        )
        .in("assessment_id", assessmentIds)
    : { data: [] };

  const casoPorId = new Map((casos ?? []).map((c) => [c.id as string, c]));

  const readings = (lecturas ?? []).map((lectura) => {
    const caso = casoPorId.get(lectura.case_id as string);
    return {
      ...lectura,
      target_metric: caso?.target_metric ?? null,
      target_question: caso?.target_question ?? null,
      case_scope: caso?.scope ?? null,
      analysis_period_start: caso?.analysis_period_start ?? null,
      analysis_period_end: caso?.analysis_period_end ?? null,
      organization_name:
        nombrePorOrg.get(caso?.organization_id as string) ?? null,
      mix: (segmentos ?? []).filter((s) => s.assessment_id === lectura.id),
    };
  });

  return { ok: true as const, data: { readings } };
}

/**
 * FASE 3 / D06 — el mapa de sintomas activos (apartado 20).
 *
 * Solo consultor, como D02 y por el mismo motivo llevado un paso mas alla: un
 * sintoma es un patron observable **sin causa**. Ensenarle al cliente "caida de
 * ventas netas, composicion coherente, confianza media" sin poder decirle por
 * que, le da un susto y ninguna salida. El cliente vera lo accionable cuando la
 * cadena llegue a producir algo accionable.
 *
 * Lo que aporta en una linea: D05 dice que las ventas caen un 18%; esto dice si
 * caen **porque caen los pedidos** --y entonces el sitio donde mirar es otro--
 * o si los pedidos aguantan y lo que se hundio es el ticket medio.
 */
export async function listConsultantSymptomMap(
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
  const nombrePorOrg = new Map(
    organizations.map((o) => [o.id, o.display_name]),
  );
  const ids = organizations.map((organization) => organization.id);
  const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data: sintomas, error } = await supabase
    .from("symptoms")
    .select(
      "id, organization_id, store_id, symptom_family, canonical_type, label, valence, capability, scope, scope_detail, diagnostic_depth, process_position, time_role, persistence, recurrence_count, same_time_window, compatible_scope, compatible_direction, known_relationship, sufficient_signal_quality, coherence_relationship, confidence, data_confidence, context_reviewed, parent_symptom_id, previous_symptom_id, first_seen_at, last_seen_at, status",
    )
    .in("organization_id", safeIds)
    .eq("status", "active")
    .order("last_seen_at", { ascending: false })
    .limit(200);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_symptoms_load_failed",
      detail: error.message,
    };
  }

  const symptomIds = (sintomas ?? []).map((s) => s.id as string);
  if (symptomIds.length === 0) {
    return { ok: true as const, data: { symptoms: [] } };
  }

  const { data: enlaces } = await supabase
    .from("symptom_signals")
    .select("symptom_id, signal_id, role")
    .in("symptom_id", symptomIds);

  const signalIds = [
    ...new Set((enlaces ?? []).map((l) => l.signal_id as string)),
  ];
  const { data: senales } = signalIds.length
    ? await supabase
        .from("signals")
        .select(
          "id, metric, direction, magnitude_relative, window_start, window_end",
        )
        .in("id", signalIds)
    : { data: [] };

  // Guardrail 13: la evidencia que contradice es la que mas falta hace en
  // pantalla. Ver solo lo que encaja es como se cierra un diagnostico falso.
  const { data: evidencias } = await supabase
    .from("symptom_evidence")
    .select(
      "symptom_id, source_kind, stance, observation, representativeness, sample_size",
    )
    .in("symptom_id", symptomIds);

  const { data: relaciones } = await supabase
    .from("symptom_relations")
    .select("from_symptom_id, to_symptom_id, relation, rationale")
    .in("from_symptom_id", symptomIds);

  const senalPorId = new Map((senales ?? []).map((s) => [s.id as string, s]));

  const symptoms = (sintomas ?? []).map((sintoma) => ({
    ...sintoma,
    organization_name:
      nombrePorOrg.get(sintoma.organization_id as string) ?? null,
    signals: (enlaces ?? [])
      .filter((l) => l.symptom_id === sintoma.id)
      .map((l) => ({
        role: l.role,
        ...(senalPorId.get(l.signal_id as string) ?? { id: l.signal_id }),
      })),
    evidence: (evidencias ?? []).filter((e) => e.symptom_id === sintoma.id),
    relations: (relaciones ?? []).filter(
      (r) => r.from_symptom_id === sintoma.id,
    ),
  }));

  return { ok: true as const, data: { symptoms } };
}

/**
 * FASE 3 / D03 — lo que el consultor ve de la madurez.
 *
 * Solo consultor. Decirle a un cliente "tu capacidad de retencion es ad_hoc"
 * sin contexto ni acompanamiento es un juicio, no una ayuda; asi lo dejo escrito
 * la RLS del contrato el 2026-09-15 y no cambia hasta que haya redaccion para
 * ensenarselo bien.
 *
 * Lo que aporta en una linea: convierte "no conozco a este cliente" en **"el
 * dato demuestra esto, no puede ver aquello, y este es el numero"** -- que es
 * lo que decide donde preguntar en la primera llamada.
 *
 * LA COMPLEJIDAD Y LOS HUECOS SE MIDEN EN VIVO, no se guardan. Son medidas, no
 * conclusiones: cuantos pedidos maneja el negocio hoy y que porcentaje de ellos
 * trae origen. Guardar una medida es quedarse con la de ayer. Lo que si se
 * guarda es el perfil, porque su valor esta en la historia: sin perfiles
 * anteriores no se puede distinguir "ha mejorado" de "ahora lo vemos mejor".
 */
export async function listConsultantMaturity(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  const orgsResult = await listConsultantOrganizations(env, authorization, context);
  if (orgsResult.ok === false) {
    return orgsResult;
  }

  const organizations = orgsResult.data.organizations;
  const nombrePorOrg = new Map(organizations.map((o) => [o.id, o.display_name]));
  const ids = organizations.map((organization) => organization.id);
  if (ids.length === 0) {
    return { ok: true as const, data: { profiles: [] } };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data: perfiles, error } = await supabase
    .from("maturity_profiles")
    .select(
      "id, organization_id, store_id, business_stage, change_type, change_summary, confidence, assessed_at",
    )
    .in("organization_id", ids)
    .is("superseded_at", null)
    .order("assessed_at", { ascending: false });

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_maturity_load_failed",
      detail: error.message,
    };
  }

  const profileIds = (perfiles ?? []).map((p) => p.id as string);
  const { data: capacidades } = profileIds.length
    ? await supabase
        .from("capability_maturity")
        .select(
          "id, profile_id, capability, current_level, required_level, expectation_band, finding, gap_interpretation, has_existence, has_consistency, has_repeatability, has_measurement, influences_decisions, confidence",
        )
        .in("profile_id", profileIds)
    : { data: [] };

  const capabilityIds = (capacidades ?? []).map((c) => c.id as string);
  const { data: evidencias } = capabilityIds.length
    ? await supabase
        .from("maturity_evidence")
        .select("capability_maturity_id, evidence_type, description, source, observed_at")
        .in("capability_maturity_id", capabilityIds)
    : { data: [] };

  // El grafo de capacidades: sin organizacion, lo lee cualquier autenticado.
  const { data: dependencias } = await supabase
    .from("capability_dependencies")
    .select("capability, depends_on, relation, rationale");

  const profiles = [];
  for (const perfil of perfiles ?? []) {
    const suyas = (capacidades ?? []).filter((c) => c.profile_id === perfil.id);

    // Lo que el dato no puede ver, medido ahora. Es la mitad util de esta
    // pantalla: un hueco con su numero le dice al consultor que preguntar.
    let unobserved: { capability: string; reason: string }[] = [];
    let complexity: { key: string; label: string; value: number; unit: string }[] = [];
    if (perfil.store_id) {
      const hechos = await leerHechos(
        supabase as never,
        perfil.organization_id as string,
        perfil.store_id as string,
      );
      if (hechos) {
        const observacion = observeMaturity(hechos);
        unobserved = observacion.unobserved;
        complexity = observacion.complexity;
      }
    }

    profiles.push({
      ...perfil,
      organization_name: nombrePorOrg.get(perfil.organization_id as string) ?? null,
      capabilities: suyas.map((c) => ({
        ...c,
        evidence: (evidencias ?? []).filter((e) => e.capability_maturity_id === c.id),
      })),
      unobserved,
      complexity,
      dependencies: dependencias ?? [],
    });
  }

  return { ok: true as const, data: { profiles } };
}
