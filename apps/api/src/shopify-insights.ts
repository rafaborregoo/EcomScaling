import {
  longestMaturedMilestone,
  parseLifetimeRows,
  paybackFromCurve,
  type LifetimeMilestone,
  type Payback,
} from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { getCached, setCached } from "./redis-cache.js";
import { recordProtectedDataAccess } from "./protected-data-access.js";

const logger = createLogger("api:shopify-insights");

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
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
    order_discount_total: number;
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

async function loadStoreIdForConnection(
  supabase: ReturnType<typeof createUserScopedClient>,
  organizationId: string,
  connectionId: string | undefined,
) {
  if (!connectionId) {
    return null;
  }

  const { data, error } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(`shopify_insights_store_load_failed: ${error.message}`);
  }

  return data?.id ?? null;
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
    !context.memberships.some(
      (membership) => membership.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
      message: "El usuario no pertenece a la organizacion solicitada.",
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
    const storeId = await loadStoreIdForConnection(
      supabase,
      organizationId,
      connectionId,
    );

    // Se registra antes de mirar la cache: quien pide el panel accede a los
    // datos igual, venga la respuesta de Redis o de Postgres. Registrar solo
    // los fallos de cache dejaria huecos en el rastro sin ningun motivo.
    void recordProtectedDataAccess(supabase, {
      organizationId,
      actorUserId: context.user.id,
      surface: "shopify_insights",
      resources: [
        "shopify_customer_recurrence",
        "shopify_customer_value",
        "shopify_cohorts",
        "shopify_customer_lifetime",
        "shopify_customer_churn",
      ],
      purpose: "Panel de Shopify: recurrencia, valor por cliente, cohortes, LTV y churn",
      storeId,
      detail: { period_days: periodDays },
    });

    const cacheKey = `shopify:insights:${organizationId}:${storeId ?? "org"}:${periodDays}`;
    const cached = await getCached<ShopifyInsightsData>(
      env.REDIS_URL,
      cacheKey,
    );

    if (cached) {
      return { ok: true as const, data: cached };
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
      checkout_recovery: singleRow(
        recoveryResult,
        "checkout_recovery",
        unavailable,
      ),
      discounts: rows(discountsResult, "discounts", unavailable),
      lifetime: lifetimeResult.error
        ? (unavailable.push("lifetime"), null)
        : (() => {
            const curve = parseLifetimeRows(lifetimeResult.data);
            return { curve, ltv: longestMaturedMilestone(curve), payback: paybackFromCurve(curve) };
          })(),
      churn: singleRow(churnResult, "churn", unavailable),
      unavailable,
    };

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
