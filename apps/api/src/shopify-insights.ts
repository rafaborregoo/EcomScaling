import {
  longestMaturedMilestone,
  parseLifetimeRows,
  paybackFromCurve,
  type LifetimeMilestone,
  type Payback,
} from "@e-nora/contracts";
import { createLogger } from "@e-nora/observability";
import { createClient } from "@supabase/supabase-js";
import { type AuthContext, createUserScopedClient, membershipCoversStore } from "./auth-context.js";
import { getCached, setCached } from "./redis-cache.js";
import { recordProtectedDataAccess } from "./protected-data-access.js";
import { resolveShopifyStoreScope } from "./shopify-store-scope.js";
import { resolveShopifyFinancialCurrencyCoverage, type ShopifyFinancialCurrencyCoverage } from "./shopify-financial-currency.js";
import { normalizeShopifyDiscountAttributionRows } from "./shopify-discount-attribution.js";

const logger = createLogger("api:shopify-insights");

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  REDIS_URL?: string;
};

const MIN_PERIOD_DAYS = 1;
const MAX_PERIOD_DAYS = 3650;
const DEFAULT_PERIOD_DAYS = 30;
const CACHE_TTL_SECONDS = 60;
const COHORT_MONTHS = 12;
const LIST_LIMIT = 10;

export type ShopifyInsightsData = {
  organization_id: string;
  selected_connection_id: string | null;
  store_id: string | null;
  financial_currency_coverage: ShopifyFinancialCurrencyCoverage;
  period: { days: number | "all"; start: string | null; end: string };
  // Cada bloque es null cuando su consulta falla, y falla por separado: una
  // metrica rota no puede dejar la pagina entera en blanco. La lista de
  // `unavailable` es lo que permite decir cual, en vez de mostrar un hueco.
  recurrence: {
    new_orders: number;
    returning_orders: number;
    unknown_orders: number;
    new_revenue: number;
    returning_revenue: number;
    repeat_order_rate: number | null;
  } | null;
  customer_value: {
    customers: number;
    orders_with_customer: number;
    guest_orders: number;
    avg_orders_per_customer: number | null;
    avg_revenue_per_customer: number | null;
    median_revenue_per_customer: number | null;
    p90_revenue_per_customer: number | null;
  } | null;
  cohorts: Array<{
    cohort_month: string;
    cohort_customers: number;
    month_offset: number;
    customers: number;
    orders: number;
    revenue: number;
  }>;
  attribution: Array<{
    source_type: string | null;
    source: string | null;
    utm_campaign: string | null;
    orders: number;
    revenue: number;
    new_customers: number;
    avg_days_to_conversion: number | null;
  }>;
  returns: Array<{
    product_id: string;
    title: string;
    units_sold: number;
    units_returned: number;
    return_rate: number | null;
    revenue: number;
    refunded_amount: number;
    top_return_reason: string | null;
    lines_with_exact_metrics: number;
    lines_with_estimated_metrics: number;
    lines_without_metrics: number;
  }>;
  delivery: {
    fulfillments: number;
    delivered: number;
    in_transit: number;
    avg_hours_to_ship: number | null;
    avg_days_to_deliver: number | null;
    with_estimate: number;
    late_deliveries: number;
    avg_delay_days: number | null;
  } | null;
  delivery_exceptions: Array<{
    id: string;
    order_name: string | null;
    tracking_company: string | null;
    exception_type: string;
    reason_confidence: number;
    likely_area: string;
    next_action_code: string;
    episode_started_at: string;
    age_hours: number;
    last_observed_at: string;
    latest_event_at: string | null;
    latest_event_status: string | null;
  }> | null;
  checkout_recovery: {
    checkouts: number;
    recovered: number;
    recovery_rate: number | null;
    lost_value: number;
    recovered_value: number;
    avg_checkout_value: number | null;
    avg_hours_to_recover: number | null;
  } | null;
  discounts: Array<{
    code: string;
    orders: number;
    order_revenue: number;
    /** Descuento del pedido completo; puede repetirse entre códigos. */
    order_discount_total: number;
    /** Importe atribuido a esta aplicación solo si la cobertura está completa. */
    attributed_discount_total: number | null;
    attribution_coverage: "complete" | "partial" | "unavailable" | "migration_pending";
    new_customers: number;
    orders_with_multiple_codes: number;
    discount_share: number | null;
  }>;
  // LTV a 30/60/90/180/365 dias sobre cohortes maduras, con su payback, y
  // churn a 180 dias. Sin ventana, como el valor por cliente: un LTV no se
  // recorta al periodo seleccionado.
  lifetime: {
    curve: LifetimeMilestone[];
    ltv: LifetimeMilestone | null;
    payback: Payback;
  } | null;
  churn: {
    churn_days: number;
    base_customers: number;
    churned_customers: number;
    churn_rate: number | null;
  } | null;
  unavailable: string[];
};

function applyLifetimeCurrencyCoverage(
  lifetime: ShopifyInsightsData["lifetime"],
  coverage: ShopifyFinancialCurrencyCoverage,
): ShopifyInsightsData["lifetime"] {
  if (!lifetime || coverage.status === "compatible") return lifetime;
  const curve = lifetime.curve.map((milestone) => ({
    ...milestone,
    avg_contribution: null,
    cohort_cac: null,
  }));
  const ltv = lifetime.ltv
    ? { ...lifetime.ltv, avg_contribution: null }
    : null;
  return {
    curve,
    ltv,
    payback: {
      status: "UNKNOWN",
      reason: `currency_${coverage.status}`,
    },
  };
}

function parsePeriodDays(daysInput: string | undefined): number | "all" {
  if (daysInput === "all") {
    return "all";
  }

  const parsed = Number(daysInput);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PERIOD_DAYS;
  }

  return Math.min(
    MAX_PERIOD_DAYS,
    Math.max(MIN_PERIOD_DAYS, Math.floor(parsed)),
  );
}

async function loadOpenDeliveryExceptions(
  supabase: ReturnType<typeof createUserScopedClient>,
  organizationId: string,
  storeId: string | null,
) {
  let query = supabase
    .from("shopify_delivery_exceptions")
    .select(
      "id, organization_id, store_id, fulfillment_id, exception_type, reason_confidence, likely_area, next_action_code, episode_started_at, last_observed_at, latest_event_at, latest_event_status",
    )
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .order("episode_started_at", { ascending: true })
    .limit(50);
  if (storeId) query = query.eq("store_id", storeId);

  const { data: exceptions, error } = await query;
  if (error) throw new Error(`delivery_exceptions_read_failed: ${error.message}`);
  if (!exceptions?.length) return [];

  const fulfillmentIds = [...new Set(exceptions.map((row) => row.fulfillment_id))];
  let fulfillmentsQuery = supabase
    .from("shopify_fulfillments")
    .select("id, order_id, tracking_company")
    .eq("organization_id", organizationId)
    .in("id", fulfillmentIds);
  if (storeId) fulfillmentsQuery = fulfillmentsQuery.eq("store_id", storeId);
  const { data: fulfillments, error: fulfillmentsError } = await fulfillmentsQuery;
  if (fulfillmentsError) {
    throw new Error(`delivery_exception_fulfillments_read_failed: ${fulfillmentsError.message}`);
  }
  if (!fulfillments?.length) return [];

  const fulfillmentById = new Map((fulfillments ?? []).map((row) => [row.id, row]));
  const orderIds = [...new Set((fulfillments ?? []).map((row) => row.order_id))];
  let ordersQuery = supabase
    .from("shopify_order_facts")
    .select("id, order_name")
    .eq("organization_id", organizationId)
    .in("id", orderIds);
  if (storeId) ordersQuery = ordersQuery.eq("store_id", storeId);
  const { data: orders, error: ordersError } = await ordersQuery;
  if (ordersError) {
    throw new Error(`delivery_exception_orders_read_failed: ${ordersError.message}`);
  }

  const orderNameById = new Map((orders ?? []).map((row) => [row.id, row.order_name]));
  return exceptions.flatMap((exception) => {
    const fulfillment = fulfillmentById.get(exception.fulfillment_id);
    if (!fulfillment) return [];
    return [{
      id: exception.id,
      order_name: orderNameById.get(fulfillment.order_id) ?? null,
      tracking_company: fulfillment.tracking_company,
      exception_type: exception.exception_type,
      reason_confidence: exception.reason_confidence,
      likely_area: exception.likely_area,
      next_action_code: exception.next_action_code,
      episode_started_at: exception.episode_started_at,
      age_hours: Math.max(0, (Date.now() - Date.parse(exception.episode_started_at)) / 3_600_000),
      last_observed_at: exception.last_observed_at,
      latest_event_at: exception.latest_event_at,
      latest_event_status: exception.latest_event_status,
    }];
  });
}

type RpcResult = { data: unknown; error: { message: string } | null };

/**
 * Las funciones que devuelven una fila unica llegan como array de uno. Cuando
 * la consulta falla se apunta el nombre y se devuelve null: el bloque se
 * dibuja como "no disponible" y los otros siete siguen.
 */
function singleRow<T>(
  result: RpcResult,
  name: string,
  unavailable: string[],
): T | null {
  if (result.error) {
    unavailable.push(name);
    return null;
  }

  const rows = (result.data ?? []) as T[];
  return rows[0] ?? null;
}

function rows<T>(
  result: RpcResult,
  name: string,
  unavailable: string[],
): T[] {
  if (result.error) {
    unavailable.push(name);
    return [];
  }

  return (result.data ?? []) as T[];
}

export async function getShopifyInsights(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  daysInput: string | undefined,
  connectionId?: string,
) {
  if (
    ![...context.memberships, ...(context.storeMemberships ?? [])].some(
      (membership) => membership.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
      message: "No tienes acceso a esta tienda.",
    };
  }

  const periodDays = parsePeriodDays(daysInput);
  const periodEnd = new Date();
  const periodStart =
    periodDays === "all"
      ? null
      : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  try {
    const storeScope = await resolveShopifyStoreScope(supabase, organizationId, connectionId);
    if (storeScope.status === "selection_required") {
      return {
        ok: false as const,
        statusCode: 409,
        error: "shopify_store_selection_required",
        message: "shopify_store_selection_required: Selecciona una tienda para consultar importes y métricas sin mezclar tiendas.",
      };
    }
    if (storeScope.status === "not_found") {
      return {
        ok: false as const,
        statusCode: 404,
        error: "shopify_connection_not_found",
        message: "La conexión de Shopify seleccionada no está activa en esta organización.",
      };
    }

    const storeId = storeScope.storeId;
    const membership = [...context.memberships, ...(context.storeMemberships ?? [])].find(
      (item) => item.organization_id === organizationId,
    );
    if (membership && !membershipCoversStore(membership, storeId)) {
      return {
        ok: false as const,
        statusCode: 403,
        error: "store_access_denied",
        message: "Esta cuenta no tiene acceso a la tienda seleccionada.",
      };
    }
    if (!storeId) {
      return {
        ok: false as const,
        statusCode: 409,
        error: "shopify_store_not_ready",
        message: "shopify_store_not_ready: La tienda todavía no ha terminado su primera sincronización.",
      };
    }
    if (!storeScope.currencyCode) {
      return {
        ok: false as const,
        statusCode: 409,
        error: "shopify_currency_unavailable",
        message: "shopify_currency_unavailable: La tienda todavía no tiene una moneda confirmada; sincronízala antes de mostrar importes.",
      };
    }

    const financialCurrencyCoverage = await resolveShopifyFinancialCurrencyCoverage(
      supabase,
      organizationId,
      storeId,
    ).catch(() => ({
      status: "unknown" as const,
      currency_code: storeScope.currencyCode,
      store_scope: "single_store" as const,
      store_count: 1,
      compared_sources: [],
      mismatched_sources: [],
      klaviyo_status: "unknown" as const,
      klaviyo_currency_code: null,
      klaviyo_unknown: true,
      unknown_sources: ["comprobación de moneda"],
      as_of: new Date().toISOString(),
    }));

    // Se registra antes de mirar la cache: quien pide el panel accede a los
    // datos igual, venga la respuesta de Redis o de Postgres. Registrar solo
    // los fallos de cache dejaria huecos en el rastro sin ningun motivo.
    // audit_logs no admite insert del rol authenticated (solo select): el rastro se escribe con service role.
    void recordProtectedDataAccess(createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }), {
      organizationId,
      actorUserId: context.user.id,
      surface: "shopify_insights",
      resources: [
        "shopify_customer_recurrence",
        "shopify_customer_value",
        "shopify_cohorts",
        "shopify_customer_lifetime",
        "shopify_customer_churn",
        "shopify_delivery_exceptions",
      ],
      purpose: "Panel de Shopify: métricas de clientes y seguimiento de incidencias de entrega",
      storeId,
      detail: { period_days: periodDays },
    });

    let deliveryExceptions: ShopifyInsightsData["delivery_exceptions"] = null;
    let deliveryExceptionsUnavailable = false;
    try {
      deliveryExceptions = await loadOpenDeliveryExceptions(
        supabase,
        organizationId,
        storeId,
      );
    } catch (error) {
      deliveryExceptionsUnavailable = true;
      logger.error(
        `No se pudo cargar la cola de incidencias de Shopify para la organizacion ${organizationId}`,
        error instanceof Error ? error : new Error("delivery_exceptions_read_failed"),
      );
    }

    const cacheKey = `shopify:insights:${organizationId}:${storeId ?? "org"}:${periodDays}`;
    const cached = await getCached<ShopifyInsightsData>(
      env.REDIS_URL,
      cacheKey,
    );

    if (cached) {
      return {
        ok: true as const,
        data: {
          ...cached,
          financial_currency_coverage: financialCurrencyCoverage,
          lifetime: applyLifetimeCurrencyCoverage(cached.lifetime, financialCurrencyCoverage),
          delivery_exceptions: deliveryExceptions,
          unavailable: deliveryExceptionsUnavailable
            ? [...new Set([...cached.unavailable, "delivery_exceptions"])]
            : cached.unavailable.filter((item) => item !== "delivery_exceptions"),
        },
      };
    }

    const window = {
      target_organization_id: organizationId,
      period_start: periodStart?.toISOString() ?? null,
      period_end: periodEnd.toISOString(),
      target_store_id: storeId,
    };

    const [
      recurrenceResult,
      customerValueResult,
      cohortsResult,
      attributionResult,
      returnsResult,
      deliveryResult,
      recoveryResult,
      discountsResult,
      lifetimeResult,
      churnResult,
    ] = await Promise.all([
      supabase.rpc("shopify_customer_recurrence", window),
      // Sin ventana: el valor de vida es todo el historial del cliente.
      supabase.rpc("shopify_customer_value", {
        target_organization_id: organizationId,
        target_store_id: storeId,
      }),
      supabase.rpc("shopify_cohorts", {
        target_organization_id: organizationId,
        target_store_id: storeId,
        months_back: COHORT_MONTHS,
      }),
      supabase.rpc("shopify_attribution_by_channel", window),
      supabase.rpc("shopify_return_rate_by_product", {
        ...window,
        result_limit: LIST_LIMIT,
      }),
      supabase.rpc("shopify_delivery_times", window),
      supabase.rpc("shopify_checkout_recovery", window),
      supabase.rpc("shopify_discount_cost_by_code", {
        ...window,
        result_limit: LIST_LIMIT,
      }),
      supabase.rpc("shopify_customer_lifetime", {
        target_organization_id: organizationId,
        target_store_id: storeId,
        as_of: periodEnd.toISOString(),
      }),
      supabase.rpc("shopify_customer_churn", {
        target_organization_id: organizationId,
        target_store_id: storeId,
        as_of: periodEnd.toISOString(),
      }),
    ]);

    const unavailable: string[] = [];

    const data: ShopifyInsightsData = {
      organization_id: organizationId,
      selected_connection_id: connectionId ?? null,
      store_id: storeId,
      financial_currency_coverage: financialCurrencyCoverage,
      period: {
        days: periodDays,
        start: periodStart?.toISOString() ?? null,
        end: periodEnd.toISOString(),
      },
      recurrence: singleRow(recurrenceResult, "recurrence", unavailable),
      customer_value: singleRow(
        customerValueResult,
        "customer_value",
        unavailable,
      ),
      cohorts: rows(cohortsResult, "cohorts", unavailable),
      attribution: rows(attributionResult, "attribution", unavailable),
      returns: rows(returnsResult, "returns", unavailable),
      delivery: singleRow(deliveryResult, "delivery", unavailable),
      delivery_exceptions: deliveryExceptions,
      checkout_recovery: singleRow(
        recoveryResult,
        "checkout_recovery",
        unavailable,
      ),
      discounts: normalizeShopifyDiscountAttributionRows(
        rows(discountsResult, "discounts", unavailable),
      ) as ShopifyInsightsData["discounts"],
      lifetime: lifetimeResult.error
        ? (unavailable.push("lifetime"), null)
        : applyLifetimeCurrencyCoverage((() => {
            const curve = parseLifetimeRows(lifetimeResult.data);
            return { curve, ltv: longestMaturedMilestone(curve), payback: paybackFromCurve(curve) };
          })(), financialCurrencyCoverage),
      churn: singleRow(churnResult, "churn", unavailable),
      unavailable,
    };
    if (deliveryExceptionsUnavailable) unavailable.push("delivery_exceptions");

    if (unavailable.length) {
      logger.error(
        `Bloques de insights de Shopify que no respondieron para la organizacion ${organizationId}: ${unavailable.join(", ")}`,
        new Error(
          [
            recurrenceResult.error?.message,
            customerValueResult.error?.message,
            cohortsResult.error?.message,
            attributionResult.error?.message,
            returnsResult.error?.message,
            deliveryResult.error?.message,
            recoveryResult.error?.message,
            discountsResult.error?.message,
            lifetimeResult.error?.message,
            churnResult.error?.message,
          ]
            .filter(Boolean)
            .join(" | "),
        ),
      );
    }

    await setCached(env.REDIS_URL, cacheKey, data, CACHE_TTL_SECONDS);

    return { ok: true as const, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "shopify_insights_failed";

    logger.error(
      `No se pudieron cargar los insights de Shopify de la organizacion ${organizationId}`,
      error instanceof Error ? error : new Error(message),
    );

    return {
      ok: false as const,
      statusCode: 500,
      error: "shopify_insights_failed",
      message,
    };
  }
}
