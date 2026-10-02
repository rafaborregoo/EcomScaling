/**
 * `GET /v1/consultant/daily-workbench`: la lectura unica de la mesa diaria.
 *
 * Aqui solo se leen fuentes y se le pasan a `buildWorkbench` (puro). Dos reglas
 * que no son negociables y por eso estan en el codigo y no en un comentario de
 * la UI:
 *
 *  1. Abrir la mesa NO dispara agentes ni escribe nada. Las propuestas de IA
 *     se leen de la ultima salida cacheada, igual que /tareas.
 *  2. Si una fuente secundaria falla, el resto de la mesa sigue siendo util y
 *     lo declara (`sources`). Una cola vacia por un timeout de Meta seria peor
 *     que no tener cola: parece "todo al dia".
 *
 * El control de acceso es el de siempre: `listConsultantOrganizations` decide
 * que organizaciones existen para este usuario y todas las lecturas van con
 * cliente user-scoped, con la RLS como frontera final. El filtro por
 * `organizationId` se valida contra esa lista -> 403, nunca un filtro de
 * frontend.
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import {
  listConsultantOrganizations,
  listConsultantProposedTasks,
} from "./consultant.js";
import { listClientMessageThreads } from "./consultant-messages.js";
import { singleCurrency } from "./cross-channel-attribution.js";
import {
  UPCOMING_DAYS,
  buildWorkbench,
  resolveActivityCut,
  type WorkbenchAlertRow,
  type WorkbenchCallRow,
  type WorkbenchCampaignRow,
  type WorkbenchConnectionRow,
  type WorkbenchMilestoneRow,
  type WorkbenchOrganization,
  type WorkbenchProposalRow,
  type WorkbenchSourceKey,
  type WorkbenchSourceState,
  type WorkbenchTaskRow,
  type WorkbenchThreadRow,
} from "./consultant-workbench.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const SENTINEL = "00000000-0000-0000-0000-000000000000";
const DAY_MS = 86_400_000;
const ROW_LIMIT = 500;

/** Umbral de stock bajo de `shopify_stock_summary`; mismo default que el SQL. */
const LOW_STOCK_THRESHOLD = 5;

/** Longitud maxima de la nota de revision; la misma que el `check` de la tabla. */
const REVIEW_NOTE_MAX = 500;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

type Loaded<T> = { rows: T; state: WorkbenchSourceState };

/**
 * Cada bloque va por su cuenta: el que falle devuelve vacio + `error` y el
 * resto de la mesa se pinta igual. Sin esto, un `Promise.all` convierte
 * cualquier timeout en una pantalla en blanco.
 */
async function block<T>(
  fallback: T,
  load: () => PromiseLike<{ data: unknown; error: unknown }>,
  map: (rows: Array<Record<string, unknown>>) => T,
): Promise<Loaded<T>> {
  try {
    const result = await load();
    if (result.error) return { rows: fallback, state: "error" };
    return {
      rows: map((result.data ?? []) as Array<Record<string, unknown>>),
      state: "ok",
    };
  } catch {
    return { rows: fallback, state: "error" };
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function firstOf(value: unknown): Record<string, unknown> | undefined {
  return Array.isArray(value)
    ? (value[0] as Record<string, unknown> | undefined)
    : (value as Record<string, unknown> | undefined);
}

export async function getDailyWorkbench(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  params: { days?: number | undefined; organizationId?: string | undefined },
) {
  const orgsResult = await listConsultantOrganizations(
    env,
    authorization,
    context,
  );
  if (orgsResult.ok === false) {
    return orgsResult;
  }

  const allOrganizations = orgsResult.data.organizations;
  const windowDays: 7 | 30 | 90 = [7, 30, 90].includes(params.days ?? 30)
    ? (params.days as 7 | 30 | 90)
    : 30;

  // El filtro por cliente se valida contra la cartera autorizada; nunca se
  // recorta en el navegador.
  const focusId = params.organizationId?.trim() || null;
  if (focusId && !allOrganizations.some((org) => org.id === focusId)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
      message: "Esa organización no está en tu cartera.",
    };
  }

  const organizations: WorkbenchOrganization[] = (
    focusId
      ? allOrganizations.filter((org) => org.id === focusId)
      : allOrganizations
  ).map((org) => ({
    id: org.id,
    display_name: org.display_name,
    store_count: org.store_count,
    attention: org.attention,
  }));

  const ids = organizations.map((org) => org.id);
  const safeIds = ids.length ? ids : [SENTINEL];
  const nowMs = Date.now();
  const horizonIso = new Date(nowMs + UPCOMING_DAYS * DAY_MS).toISOString();
  const horizonDate = horizonIso.slice(0, 10);
  const windowStartIso = new Date(nowMs - windowDays * DAY_MS).toISOString();

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const [
    alerts,
    rawTasks,
    calls,
    connections,
    financial,
    milestones,
    campaigns,
  ] = await Promise.all([
    block<WorkbenchAlertRow[]>(
      [],
      () =>
        supabase
          .from("alerts")
          .select("id, organization_id, severity, status, title, first_detected_at")
          .in("organization_id", safeIds)
          .in("status", ["open", "acknowledged"])
          .order("first_detected_at", { ascending: true })
          .limit(ROW_LIMIT),
      (rows) =>
        rows.map((row) => ({
          id: str(row.id),
          organization_id: str(row.organization_id),
          severity: str(row.severity),
          status: str(row.status),
          title: str(row.title),
          first_detected_at: str(row.first_detected_at),
        })),
    ),
    block<Array<WorkbenchTaskRow & { assigned_to: string | null }>>(
      [],
      () =>
        supabase
          .from("tasks")
          .select(
            "id, organization_id, title, status, priority, due_at, alert_id, assigned_to",
          )
          .in("organization_id", safeIds)
          .in("status", ["pending", "in_progress"])
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(ROW_LIMIT),
      (rows) =>
        rows.map((row) => ({
          id: str(row.id),
          organization_id: str(row.organization_id),
          title: str(row.title),
          status: str(row.status),
          priority: str(row.priority),
          due_at: nullableStr(row.due_at),
          alert_id: nullableStr(row.alert_id),
          assigned_to: nullableStr(row.assigned_to),
          assignee_name: null,
        })),
    ),
    block<WorkbenchCallRow[]>(
      [],
      () =>
        supabase
          .from("consulting_calls")
          .select(
            "id, organization_id, title, scheduled_at, held_at, call_ai_summaries(status)",
          )
          .in("organization_id", safeIds)
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
      (rows) =>
        rows.map((row) => {
          const summaries =
            (row.call_ai_summaries as Array<{ status: string }> | null) ?? [];
          return {
            id: str(row.id),
            organization_id: str(row.organization_id),
            title: str(row.title),
            scheduled_at: nullableStr(row.scheduled_at),
            held_at: nullableStr(row.held_at),
            summary_pending: summaries.some(
              (summary) => summary.status === "pending_approval",
            ),
          };
        }),
    ),
    block<WorkbenchConnectionRow[]>(
      [],
      () =>
        supabase
          .from("integration_connections")
          .select("organization_id, provider, status, last_sync_at")
          .in("organization_id", safeIds)
          .limit(ROW_LIMIT),
      (rows) =>
        rows.map((row) => ({
          organization_id: str(row.organization_id),
          provider: str(row.provider),
          status: str(row.status),
          last_sync_at: nullableStr(row.last_sync_at),
        })),
    ),
    block<string[]>(
      [],
      () =>
        supabase
          .from("organization_financial_settings")
          .select("organization_id")
          .in("organization_id", safeIds),
      (rows) => rows.map((row) => str(row.organization_id)),
    ),
    block<WorkbenchMilestoneRow[]>(
      [],
      () =>
        supabase
          .from("strategic_plan_milestones")
          .select(
            "id, organization_id, name, target_date, status, strategic_plan_phases(name)",
          )
          .in("organization_id", safeIds)
          .not("target_date", "is", null)
          .lte("target_date", horizonDate)
          .order("target_date", { ascending: true })
          .limit(ROW_LIMIT),
      (rows) =>
        rows.map((row) => ({
          id: str(row.id),
          organization_id: str(row.organization_id),
          name: str(row.name),
          target_date: str(row.target_date),
          status: str(row.status),
          phase_name:
            nullableStr(firstOf(row.strategic_plan_phases)?.name) ?? null,
        })),
    ),
    block<WorkbenchCampaignRow[]>(
      [],
      () =>
        supabase
          .from("campaign_calendar_items")
          .select("id, organization_id, title, channel, starts_at, status")
          .in("organization_id", safeIds)
          .is("deleted_at", null)
          .gte("starts_at", new Date(nowMs).toISOString())
          .lte("starts_at", horizonIso)
          .order("starts_at", { ascending: true })
          .limit(ROW_LIMIT),
      (rows) =>
        rows.map((row) => ({
          id: str(row.id),
          organization_id: str(row.organization_id),
          title: str(row.title),
          channel: str(row.channel),
          starts_at: str(row.starts_at),
          status: str(row.status),
        })),
    ),
  ]);

  // Nombre del responsable: una consulta aparte sobre los perfiles que
  // realmente aparecen, en vez de un embed que depende del nombre de la FK.
  const assigneeIds = [
    ...new Set(
      rawTasks.rows.flatMap((task) =>
        task.assigned_to ? [task.assigned_to] : [],
      ),
    ),
  ];
  const assignees = await block<Map<string, string>>(
    new Map(),
    () =>
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", assigneeIds.length ? assigneeIds : [SENTINEL]),
    (rows) =>
      new Map(
        rows.flatMap((row) => {
          const name = nullableStr(row.full_name);
          return name ? [[str(row.id), name] as [string, string]] : [];
        }),
      ),
  );

  const tasks: WorkbenchTaskRow[] = rawTasks.rows.map((task) => ({
    id: task.id,
    organization_id: task.organization_id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    due_at: task.due_at,
    alert_id: task.alert_id,
    assignee_name: task.assigned_to
      ? (assignees.rows.get(task.assigned_to) ?? null)
      : null,
  }));

  // Propuestas y mensajes reusan las funciones que ya alimentan /tareas y
  // /mensajes: mismo criterio de "pendiente" en las tres pantallas.
  const proposalsResult = await listConsultantProposedTasks(
    env,
    authorization,
    context,
  ).catch(() => null);
  let proposals: WorkbenchProposalRow[] = [];
  let proposalsState: WorkbenchSourceState = "ok";
  if (!proposalsResult || proposalsResult.ok === false) {
    proposalsState = "error";
  } else {
    proposals = proposalsResult.data.clients.flatMap((client) =>
      client.tasks
        // Solo lo que espera una decision humana; lo ya decidido vive en /tareas.
        .filter((task) => task.pending_approval)
        .map((task) => ({
          organization_id: client.organization_id,
          title: task.title,
          rationale: task.rationale,
          priority: task.priority,
          phase: task.phase,
          evidence: task.evidence,
        })),
    );
  }

  const threadsResult = await listClientMessageThreads(
    env,
    authorization,
    context,
  ).catch(() => null);
  let threads: WorkbenchThreadRow[] = [];
  let threadsState: WorkbenchSourceState = "ok";
  if (!threadsResult || threadsResult.ok === false) {
    threadsState = "error";
  } else {
    threads = threadsResult.data.threads.map((thread) => ({
      organization_id: thread.organization_id,
      unread_count: thread.unread_count,
      counterpart_name: thread.counterpart_name,
      last_message_at: thread.last_message?.created_at ?? null,
    }));
  }

  const sources: Record<WorkbenchSourceKey, WorkbenchSourceState> = {
    alerts: alerts.state,
    tasks: rawTasks.state,
    calls: calls.state,
    proposals: proposalsState,
    messages: threadsState,
    connections: connections.state,
    financial: financial.state,
    milestones: milestones.state,
    campaigns: campaigns.state,
  };

  const workbench = buildWorkbench({
    organizations,
    alerts: alerts.rows,
    tasks,
    calls: calls.rows,
    proposals,
    threads,
    connections: connections.rows,
    organizationsWithFinancialSettings: financial.rows,
    milestones: milestones.rows,
    campaigns: campaigns.rows,
    sources,
    windowDays,
    nowMs,
  });

  if (!focusId) {
    return { ok: true as const, data: workbench };
  }

  const client = await loadClientDesk({
    supabase,
    organizationId: focusId,
    organization: allOrganizations.find((org) => org.id === focusId) ?? null,
    connections: connections.rows,
    hasFinancialSettings: financial.rows.includes(focusId),
    calls: calls.rows,
    milestones: milestones.rows,
    thread: threads.find((item) => item.organization_id === focusId) ?? null,
    windowDays,
    windowStartIso,
    nowMs,
  });

  return { ok: true as const, data: { ...workbench, client } };
}

type OrganizationSummary = {
  id: string;
  display_name: string;
  status: string;
  currency_code: string;
  timezone: string;
  store_count: number;
};

/**
 * La ficha de un cliente: el estado del negocio, que cambio respecto al
 * periodo anterior, por donde va el plan y como esta la relacion. Todo lo que
 * no tenga cobertura se declara en `coverage` en vez de salir como 0.
 */
async function loadClientDesk(input: {
  supabase: ReturnType<typeof createUserScopedClient>;
  organizationId: string;
  organization: OrganizationSummary | null;
  connections: WorkbenchConnectionRow[];
  hasFinancialSettings: boolean;
  calls: WorkbenchCallRow[];
  milestones: WorkbenchMilestoneRow[];
  thread: WorkbenchThreadRow | null;
  windowDays: 7 | 30 | 90;
  windowStartIso: string;
  nowMs: number;
}) {
  const {
    supabase,
    organizationId,
    organization,
    connections,
    hasFinancialSettings,
    calls,
    thread,
    windowDays,
    windowStartIso,
    nowMs,
  } = input;

  const periodEnd = new Date(nowMs).toISOString();
  const prevStart = new Date(nowMs - 2 * windowDays * DAY_MS).toISOString();

  // "Desde mi ultima revision" es personal: la RLS de la tabla ya limita las
  // filas a las de este usuario, asi que no hay filtro por user_id aqui.
  const lastReview = await block<{ reviewed_at: string; note: string | null } | null>(
    null,
    () =>
      supabase
        .from("consultant_client_review_events")
        .select("reviewed_at, note")
        .eq("organization_id", organizationId)
        .order("reviewed_at", { ascending: false })
        .limit(1),
    (rows) => {
      const row = rows[0];
      if (!row) return null;
      return {
        reviewed_at: str(row.reviewed_at),
        note: nullableStr(row.note),
      };
    },
  );

  // El criterio vive en `resolveActivityCut` (puro y con test): decide si
  // manda la revision humana o la ventana.
  const { since: activitySinceIso, kind: activitySinceKind } =
    resolveActivityCut({
      lastReviewedAt: lastReview.rows?.reviewed_at ?? null,
      windowStartIso,
    });

  const [currentRollup, previousRollup, stock, stores, phases, recent, shopifyCurrencies, metaCurrencies] =
    await Promise.all([
      block<Record<string, unknown> | null>(
        null,
        () =>
          supabase.rpc("consultant_business_rollup", {
            org_ids: [organizationId],
            period_start: windowStartIso,
            period_end: periodEnd,
          }),
        (rows) => rows[0] ?? null,
      ),
      block<Record<string, unknown> | null>(
        null,
        () =>
          supabase.rpc("consultant_business_rollup", {
            org_ids: [organizationId],
            period_start: prevStart,
            period_end: windowStartIso,
          }),
        (rows) => rows[0] ?? null,
      ),
      block<Record<string, unknown> | null>(
        null,
        () =>
          supabase.rpc("shopify_stock_summary", {
            target_organization_id: organizationId,
            low_stock_threshold: LOW_STOCK_THRESHOLD,
          }),
        (rows) => rows[0] ?? null,
      ),
      block<
        Array<{
          id: string;
          provider: string;
          name: string | null;
          status: string;
          last_sync_at: string | null;
        }>
      >(
        [],
        () =>
          supabase
            .from("integration_connections")
            .select(
              "id, provider, provider_account_name, status, last_sync_at",
            )
            .eq("organization_id", organizationId),
        (rows) =>
          rows.map((row) => ({
            id: str(row.id),
            provider: str(row.provider),
            name: nullableStr(row.provider_account_name),
            status: str(row.status),
            last_sync_at: nullableStr(row.last_sync_at),
          })),
      ),
      block<
        Array<{
          id: string;
          name: string;
          status: string;
          position: number;
        }>
      >(
        [],
        () =>
          supabase
            .from("strategic_plan_phases")
            .select("id, name, status, position")
            .eq("organization_id", organizationId)
            .order("position", { ascending: true }),
        (rows) =>
          rows.map((row) => ({
            id: str(row.id),
            name: str(row.name),
            status: str(row.status),
            position: num(row.position),
          })),
      ),
      // "Que cambio": alertas nacidas y tareas cerradas desde el corte de
      // actividad. No es una cronologia exhaustiva -- son las dos variaciones
      // que obligan a cambiar de decision.
      block<{ newAlerts: number; closedTasks: number }>(
        { newAlerts: 0, closedTasks: 0 },
        () =>
          supabase
            .from("alerts")
            .select("id, first_detected_at, status")
            .eq("organization_id", organizationId)
            .gte("first_detected_at", activitySinceIso)
            .limit(ROW_LIMIT),
        (rows) => ({ newAlerts: rows.length, closedTasks: 0 }),
      ),
      block<Array<string | null>>(
        [],
        () => supabase
          .from("shopify_stores")
          .select("currency_code")
          .eq("organization_id", organizationId),
        (rows) => rows.map((row) => nullableStr(row.currency_code)),
      ),
      block<Array<string | null>>(
        [],
        () => supabase
          .from("meta_ad_accounts")
          .select("currency_code")
          .eq("organization_id", organizationId),
        (rows) => rows.map((row) => nullableStr(row.currency_code)),
      ),
    ]);

  const closedTasks = await block<number>(
    0,
    () =>
      supabase
        .from("tasks")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .gte("completed_at", activitySinceIso)
        .limit(ROW_LIMIT),
    (rows) => rows.length,
  );

  const allMilestones = await block<
    Array<{ id: string; name: string; status: string; target_date: string | null; phase_id: string }>
  >(
    [],
    () =>
      supabase
        .from("strategic_plan_milestones")
        .select("id, name, status, target_date, phase_id")
        .eq("organization_id", organizationId)
        .order("position", { ascending: true }),
    (rows) =>
      rows.map((row) => ({
        id: str(row.id),
        name: str(row.name),
        status: str(row.status),
        target_date: nullableStr(row.target_date),
        phase_id: str(row.phase_id),
      })),
  );

  const current = currentRollup.rows;
  const previous = previousRollup.rows;

  // Lo que no se puede interpretar se dice; no se rellena con ceros.
  const coverage: string[] = [];
  if (!hasFinancialSettings) {
    coverage.push(
      "Sin configuración financiera: no se muestran beneficio ni margen.",
    );
  }
  const shopify = connections.filter(
    (row) => row.organization_id === organizationId && row.provider === "shopify",
  );
  if (shopify.length === 0) {
    coverage.push("Shopify sin conectar: ventas y pedidos no son medibles.");
  }
  const meta = connections.filter(
    (row) => row.organization_id === organizationId && row.provider === "meta",
  );
  if (meta.length === 0) {
    coverage.push("Meta Ads sin conectar: inversión y ROAS no son medibles.");
  }
  const shopifyCurrency = singleCurrency(shopifyCurrencies.rows);
  const metaCurrency = singleCurrency(metaCurrencies.rows);
  if (shopify.length > 0 && !shopifyCurrency) {
    coverage.push("Las tiendas Shopify usan monedas distintas o sin identificar; no se agregan ventas sin conversiÃ³n.");
  }
  if (meta.length > 0 && !metaCurrency) {
    coverage.push("Las cuentas de Meta usan monedas distintas o sin identificar; no se agregan importes ni ROAS.");
  }
  if (shopifyCurrencies.state === "error" || metaCurrencies.state === "error") {
    coverage.push("No se pudo verificar la moneda de una fuente; se ocultan sus importes agregados.");
  }
  if (currentRollup.state === "error" || previousRollup.state === "error") {
    coverage.push("El resumen de negocio no se pudo calcular; reinténtalo.");
  }

  const business =
    current === null
      ? null
      : {
          window_days: windowDays,
          has_financial_settings: hasFinancialSettings,
          shopify_connected: shopify.length > 0,
          meta_connected: meta.length > 0,
          shopify_currency_code: shopifyCurrency,
          meta_currency_code: metaCurrency,
          net_sales: shopifyCurrency ? num(current.net_sales) : null,
          orders: num(current.orders_count),
          meta_spend: metaCurrency ? num(current.meta_spend) : null,
          meta_purchase_value: metaCurrency ? num(current.meta_purchase_value) : null,
          roas: !metaCurrency || current.roas == null ? null : num(current.roas),
          prev_net_sales: previous && shopifyCurrency ? num(previous.net_sales) : null,
          prev_orders: previous ? num(previous.orders_count) : null,
          prev_meta_spend: previous && metaCurrency ? num(previous.meta_spend) : null,
          prev_roas:
            previous && previous.roas != null && metaCurrency ? num(previous.roas) : null,
          out_of_stock_items: stock.rows
            ? num(stock.rows.out_of_stock_items)
            : null,
          low_stock_items: stock.rows ? num(stock.rows.low_stock_items) : null,
          coverage,
        };

  const phaseById = new Map(phases.rows.map((phase) => [phase.id, phase]));
  const activePhase =
    phases.rows.find((phase) => phase.status === "active") ??
    phases.rows.find((phase) => phase.status === "pending") ??
    null;
  const phaseMilestones = activePhase
    ? allMilestones.rows.filter(
        (milestone) => milestone.phase_id === activePhase.id,
      )
    : [];
  const nextMilestone =
    allMilestones.rows.find((milestone) =>
      ["pending", "in_progress"].includes(milestone.status),
    ) ?? null;

  const scheduledCalls = calls
    .filter(
      (call) =>
        call.organization_id === organizationId &&
        call.scheduled_at &&
        Date.parse(call.scheduled_at) >= nowMs,
    )
    .sort(
      (a, b) =>
        Date.parse(a.scheduled_at as string) -
        Date.parse(b.scheduled_at as string),
    );
  const heldCalls = calls
    .filter(
      (call) => call.organization_id === organizationId && Boolean(call.held_at),
    )
    .sort(
      (a, b) =>
        Date.parse(b.held_at as string) - Date.parse(a.held_at as string),
    );

  return {
    organization_id: organizationId,
    organization_name: organization?.display_name ?? organizationId,
    status: organization?.status ?? null,
    currency_code: organization?.currency_code ?? null,
    timezone: organization?.timezone ?? null,
    stores: stores.rows,
    business,
    last_review: lastReview.rows,
    changes: {
      // `since` y `since_kind` van en el contrato porque la UI tiene que decir
      // si "lo que cambió" se cuenta desde que TU lo revisaste o desde el
      // inicio de la ventana. Sin eso, el mismo numero significa dos cosas.
      since: activitySinceIso,
      since_kind: activitySinceKind,
      new_alerts: recent.rows.newAlerts,
      closed_tasks: closedTasks.rows,
      net_sales_delta:
        current && previous && shopifyCurrency
          ? num(current.net_sales) - num(previous.net_sales)
          : null,
      orders_delta:
        current && previous
          ? num(current.orders_count) - num(previous.orders_count)
          : null,
      meta_spend_delta:
        current && previous && metaCurrency
          ? num(current.meta_spend) - num(previous.meta_spend)
          : null,
    },
    camino: activePhase
      ? {
          phase_name: activePhase.name,
          phase_status: activePhase.status,
          milestones_total: phaseMilestones.length,
          milestones_done: phaseMilestones.filter(
            (milestone) => milestone.status === "completed",
          ).length,
          next_milestone: nextMilestone
            ? {
                id: nextMilestone.id,
                name: nextMilestone.name,
                target_date: nextMilestone.target_date,
                phase_name:
                  phaseById.get(nextMilestone.phase_id)?.name ?? null,
              }
            : null,
        }
      : null,
    relationship: {
      next_call: scheduledCalls[0]
        ? {
            id: scheduledCalls[0].id,
            title: scheduledCalls[0].title,
            scheduled_at: scheduledCalls[0].scheduled_at,
          }
        : null,
      last_call: heldCalls[0]
        ? {
            id: heldCalls[0].id,
            title: heldCalls[0].title,
            held_at: heldCalls[0].held_at,
            summary_pending: heldCalls[0].summary_pending,
          }
        : null,
      unread_count: thread?.unread_count ?? 0,
      counterpart_name: thread?.counterpart_name ?? null,
    },
  };
}

/**
 * "Marcar como revisado": el hito explicito que hace que "desde la ultima
 * revision" sea personal y verificable en vez de una ventana de tiempo.
 *
 * Es una accion deliberada, nunca un efecto de abrir la ficha: si visitar la
 * pantalla escribiera el hito, el consultor perderia la comparacion justo
 * cuando la necesita (entra, no le da tiempo a mirar, y ya "lo ha revisado").
 *
 * Escritura con service role + chequeo manual de rol y pertenencia a la
 * cartera; la RLS de la tabla solo abre `select`.
 */
export async function markClientReviewed(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  params: { organizationId: string; note?: unknown },
) {
  const role = context.profile.platform_role;
  if (role !== "platform_admin" && role !== "consultant") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_access_required",
    };
  }

  const organizationId = params.organizationId?.trim();
  if (!organizationId) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "organization_id_required",
    };
  }

  // La misma frontera que la lectura: la cartera autorizada, no un parametro.
  const orgsResult = await listConsultantOrganizations(
    env,
    authorization,
    context,
  );
  if (orgsResult.ok === false) {
    return orgsResult;
  }
  if (
    !orgsResult.data.organizations.some((org) => org.id === organizationId)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
      message: "Esa organización no está en tu cartera.",
    };
  }

  const rawNote = typeof params.note === "string" ? params.note.trim() : "";
  if (rawNote.length > REVIEW_NOTE_MAX) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "review_note_too_long",
      message: `La nota no puede pasar de ${REVIEW_NOTE_MAX} caracteres.`,
    };
  }

  const supabase = createServiceClient(env);
  const reviewedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("consultant_client_review_events")
    .insert({
      organization_id: organizationId,
      consultant_user_id: context.user.id,
      reviewed_at: reviewedAt,
      note: rawNote.length > 0 ? rawNote : null,
    })
    .select("id, reviewed_at, note")
    .single();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "review_event_write_failed",
      detail: error.message,
    };
  }

  return {
    ok: true as const,
    data: {
      id: str(data?.id),
      reviewed_at: str(data?.reviewed_at),
      note: nullableStr(data?.note),
    },
  };
}
