import { createLogger } from "@ecomscaling/observability";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { getCached, setCached } from "./redis-cache.js";

const logger = createLogger("api:shopify-metrics");

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  REDIS_URL?: string;
};

const MIN_PERIOD_DAYS = 1;
const MAX_PERIOD_DAYS = 3650;
const DEFAULT_PERIOD_DAYS = 30;
const METRICS_CACHE_TTL_SECONDS = 60;

type ShopifyMetricsData = {
  organization_id: string;
  selected_connection_id: string | null;
  store_id: string | null;
  period: { days: number | "all"; start: string | null; end: string };
  sales: {
    orders_count: number;
    gross_sales: number;
    net_sales: number;
    discounts: number;
    refunds: number;
    units_sold: number;
    aov: number;
  };
  top_products: unknown[];
  stock: {
    tracked_items: number;
    total_available: number;
    low_stock_items: number;
    out_of_stock_items: number;
  };
  margin: {
    revenue: number;
    cogs: number;
    gross_margin: number;
    margin_pct: number;
    items_with_cost: number;
    items_without_cost: number;
  };
  financial: {
    net_sales: number;
    orders_count: number;
    cogs: number;
    gross_margin: number;
    payment_fees: number;
    shipping_costs: number;
    fixed_costs: number;
    net_profit: number;
    net_margin_pct: number;
    monthly_fixed_costs: number;
    break_even_monthly_revenue: number | null;
    has_settings: boolean;
    fixed_expenses_count: number;
    items_without_cost: number;
  };
  previous_period: {
    period: { start: string; end: string };
    sales: ShopifyMetricsData["sales"];
    financial: { net_profit: number; net_margin_pct: number };
  } | null;
  // Serie diaria para los sparklines de las tarjetas KPI. Vacia cuando se pide
  // "Todo" (no hay ventana acotada) o si el bloque falla (no es fatal).
  daily: Array<{ date: string; net_sales: number; orders_count: number }>;
  // Embudo: sesiones (ShopifyQL, bloque de sync `sessions`) + pedidos propios.
  // `null` si la consulta falla; `has_sessions: false` si no hay ni un dia con
  // dato -- la pantalla debe distinguir "0 sesiones" de "no lo sabemos".
  funnel: {
    has_sessions: boolean;
    sessions: number;
    online_store_visitors: number;
    conversion_rate_shopify: number | null;
    orders_count: number;
    net_sales: number;
    conversion_rate_own: number | null;
    revenue_per_session: number | null;
    days_with_sessions: number;
  } | null;
  funnel_daily: Array<{
    date: string;
    sessions: number;
    orders_count: number;
    conversion_rate_own: number | null;
  }>;
};

function parsePeriodDays(daysInput: string | undefined): number | "all" {
  if (daysInput === "all") {
    return "all";
  }

  const parsed = Number(daysInput);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PERIOD_DAYS;
  }

  return Math.min(MAX_PERIOD_DAYS, Math.max(MIN_PERIOD_DAYS, Math.floor(parsed)));
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
    throw new Error(`shopify_metric_store_load_failed: ${error.message}`);
  }

  return data?.id ?? null;
}

function emptyMetricsData(
  organizationId: string,
  connectionId: string | undefined,
  storeId: string | null,
  periodDays: number | "all",
  periodStart: Date | null,
  periodEnd: Date,
): ShopifyMetricsData {
  return {
    organization_id: organizationId,
    selected_connection_id: connectionId ?? null,
    store_id: storeId,
    period: {
      days: periodDays,
      start: periodStart?.toISOString() ?? null,
      end: periodEnd.toISOString(),
    },
    sales: {
      orders_count: 0,
      gross_sales: 0,
      net_sales: 0,
      discounts: 0,
      refunds: 0,
      units_sold: 0,
      aov: 0,
    },
    top_products: [],
    stock: {
      tracked_items: 0,
      total_available: 0,
      low_stock_items: 0,
      out_of_stock_items: 0,
    },
    margin: {
      revenue: 0,
      cogs: 0,
      gross_margin: 0,
      margin_pct: 0,
      items_with_cost: 0,
      items_without_cost: 0,
    },
    financial: emptyFinancialData(),
    previous_period: null,
    daily: [],
    funnel: null,
    funnel_daily: [],
  };
}

function emptyFinancialData(): ShopifyMetricsData["financial"] {
  return {
    net_sales: 0,
    orders_count: 0,
    cogs: 0,
    gross_margin: 0,
    payment_fees: 0,
    shipping_costs: 0,
    fixed_costs: 0,
    net_profit: 0,
    net_margin_pct: 0,
    monthly_fixed_costs: 0,
    break_even_monthly_revenue: null,
    has_settings: false,
    fixed_expenses_count: 0,
    items_without_cost: 0,
  };
}

export async function getShopifyMetrics(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  daysInput: string | undefined,
  connectionId?: string,
) {
  if (!context.memberships.some((membership) => membership.organization_id === organizationId)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
      message: "El usuario no pertenece a la organizacion solicitada.",
    };
  }

  const periodDays = parsePeriodDays(daysInput);
  const periodEnd = new Date();
  const periodStart = periodDays === "all" ? null : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // FE-02: comparacion contra el periodo anterior -- mismo numero de dias,
  // inmediatamente antes de `periodStart`. No aplica a "Todo" (no hay un
  // "periodo anterior" bien definido cuando se pide el historico completo).
  const previousPeriodEnd = periodStart;
  const previousPeriodStart =
    periodDays === "all" || !periodStart
      ? null
      : new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  try {
    const storeId = await loadStoreIdForConnection(supabase, organizationId, connectionId);

    if (connectionId && !storeId) {
      return {
        ok: true as const,
        data: emptyMetricsData(organizationId, connectionId, null, periodDays, periodStart, periodEnd),
      };
    }

    const cacheKey = `shopify:metrics:${organizationId}:${storeId ?? "org"}:${periodDays}`;
    const cached = await getCached<ShopifyMetricsData>(env.REDIS_URL, cacheKey);

    if (cached) {
      return { ok: true as const, data: cached };
    }

    const [
      salesResult,
      topProductsResult,
      stockResult,
      marginResult,
      financialResult,
      previousSalesResult,
      previousFinancialResult,
      dailyResult,
      funnelResult,
      funnelDailyResult,
    ] = await Promise.all([
      supabase.rpc("shopify_sales_summary", {
        target_organization_id: organizationId,
        period_start: periodStart?.toISOString() ?? null,
        period_end: periodEnd.toISOString(),
        target_store_id: storeId,
      }),
      supabase.rpc("shopify_top_products", {
        target_organization_id: organizationId,
        period_start: periodStart?.toISOString() ?? null,
        period_end: periodEnd.toISOString(),
        result_limit: 10,
        target_store_id: storeId,
      }),
      supabase.rpc("shopify_stock_summary", {
        target_organization_id: organizationId,
        low_stock_threshold: 5,
        target_store_id: storeId,
      }),
      supabase.rpc("shopify_margin_summary", {
        target_organization_id: organizationId,
        period_start: periodStart?.toISOString() ?? null,
        period_end: periodEnd.toISOString(),
        target_store_id: storeId,
      }),
      supabase.rpc("shopify_financial_summary", {
        target_organization_id: organizationId,
        period_start: periodStart?.toISOString() ?? null,
        period_end: periodEnd.toISOString(),
        target_store_id: storeId,
      }),
      previousPeriodStart
        ? supabase.rpc("shopify_sales_summary", {
            target_organization_id: organizationId,
            period_start: previousPeriodStart.toISOString(),
            period_end: previousPeriodEnd!.toISOString(),
            target_store_id: storeId,
          })
        : Promise.resolve({ data: null, error: null }),
      previousPeriodStart
        ? supabase.rpc("shopify_financial_summary", {
            target_organization_id: organizationId,
            period_start: previousPeriodStart.toISOString(),
            period_end: previousPeriodEnd!.toISOString(),
            target_store_id: storeId,
          })
        : Promise.resolve({ data: null, error: null }),
      periodStart
        ? supabase.rpc("shopify_sales_daily", {
            target_organization_id: organizationId,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            target_store_id: storeId,
          })
        : Promise.resolve({ data: null, error: null }),
      supabase.rpc("shopify_funnel_summary", {
        target_organization_id: organizationId,
        period_start: periodStart?.toISOString() ?? null,
        period_end: periodEnd.toISOString(),
        target_store_id: storeId,
      }),
      periodStart
        ? supabase.rpc("shopify_funnel_daily", {
            target_organization_id: organizationId,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            target_store_id: storeId,
          })
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (salesResult.error) {
      throw new Error(`shopify_sales_summary_failed: ${salesResult.error.message}`);
    }

    if (topProductsResult.error) {
      throw new Error(`shopify_top_products_failed: ${topProductsResult.error.message}`);
    }

    if (stockResult.error) {
      throw new Error(`shopify_stock_summary_failed: ${stockResult.error.message}`);
    }

    if (marginResult.error) {
      throw new Error(`shopify_margin_summary_failed: ${marginResult.error.message}`);
    }

    if (financialResult.error) {
      throw new Error(`shopify_financial_summary_failed: ${financialResult.error.message}`);
    }

    // No fatal: la comparacion contra el periodo anterior es un anadido, no
    // debe tumbar el dashboard entero si falla.
    if (previousSalesResult.error) {
      logger.error("shopify_sales_summary_previous_period_failed", { organization_id: organizationId, error: previousSalesResult.error.message });
    }
    if (previousFinancialResult.error) {
      logger.error("shopify_financial_summary_previous_period_failed", { organization_id: organizationId, error: previousFinancialResult.error.message });
    }
    // No fatal: los sparklines son un adorno de las tarjetas KPI.
    if (dailyResult.error) {
      logger.error("shopify_sales_daily_failed", { organization_id: organizationId, error: dailyResult.error.message });
    }
    // No fatal: el embudo depende del bloque de sync `sessions`, que puede no
    // estar disponible (conexion sin el scope read_reports).
    if (funnelResult.error) {
      logger.error("shopify_funnel_summary_failed", { organization_id: organizationId, error: funnelResult.error.message });
    }
    if (funnelDailyResult.error) {
      logger.error("shopify_funnel_daily_failed", { organization_id: organizationId, error: funnelDailyResult.error.message });
    }

    type DailyRow = { bucket_date: string; net_sales: number; orders_count: number };
    const daily = !dailyResult.error && Array.isArray(dailyResult.data)
      ? (dailyResult.data as DailyRow[]).map((row) => ({
          date: row.bucket_date,
          net_sales: Number(row.net_sales) || 0,
          orders_count: Number(row.orders_count) || 0,
        }))
      : [];

    const sales = salesResult.data?.[0] ?? {
      orders_count: 0,
      gross_sales: 0,
      net_sales: 0,
      discounts: 0,
      refunds: 0,
      units_sold: 0,
      aov: 0,
    };

    const stock = stockResult.data?.[0] ?? {
      tracked_items: 0,
      total_available: 0,
      low_stock_items: 0,
      out_of_stock_items: 0,
    };

    const margin = marginResult.data?.[0] ?? {
      revenue: 0,
      cogs: 0,
      gross_margin: 0,
      margin_pct: 0,
      items_with_cost: 0,
      items_without_cost: 0,
    };

    const financial = financialResult.data?.[0] ?? emptyFinancialData();

    const previousSales =
      !previousSalesResult.error && previousPeriodStart
        ? previousSalesResult.data?.[0] ?? { orders_count: 0, gross_sales: 0, net_sales: 0, discounts: 0, refunds: 0, units_sold: 0, aov: 0 }
        : null;
    const previousFinancial =
      !previousFinancialResult.error && previousPeriodStart
        ? previousFinancialResult.data?.[0] ?? emptyFinancialData()
        : null;

    const previousPeriod =
      previousPeriodStart && previousSales && previousFinancial
        ? {
            period: { start: previousPeriodStart.toISOString(), end: previousPeriodEnd!.toISOString() },
            sales: previousSales,
            financial: { net_profit: previousFinancial.net_profit, net_margin_pct: previousFinancial.net_margin_pct },
          }
        : null;

    // Embudo. `has_sessions` distingue "0 sesiones reales" de "no tenemos el
    // dato" (bloque sessions nunca ejecutado o sin permiso de informes): la
    // pantalla no debe pintar 0 % de conversion cuando en realidad no sabe.
    // Las RPC del embudo solo traen sesiones: los pedidos salen de `sales` y
    // `daily`, que esta misma request ya pidio. Antes las recalculaban con su
    // propio escaneo de shopify_order_facts y esa duplicidad hacia saltar el
    // statement_timeout de 8s del rol `authenticated` (500 en el dashboard).
    type FunnelRow = {
      sessions: number;
      online_store_visitors: number;
      conversion_rate_shopify: number | null;
      days_with_sessions: number;
    };
    const funnelRow = (!funnelResult.error
      ? (funnelResult.data?.[0] as FunnelRow | undefined)
      : undefined) ?? null;
    const funnelSessions = Number(funnelRow?.sessions) || 0;
    const funnelOrders = Number(sales.orders_count) || 0;
    const funnelNetSales = Number(sales.net_sales) || 0;
    const funnel = funnelRow
      ? {
          has_sessions: Number(funnelRow.days_with_sessions) > 0,
          sessions: funnelSessions,
          online_store_visitors: Number(funnelRow.online_store_visitors) || 0,
          conversion_rate_shopify:
            funnelRow.conversion_rate_shopify === null ||
            funnelRow.conversion_rate_shopify === undefined
              ? null
              : Number(funnelRow.conversion_rate_shopify),
          orders_count: funnelOrders,
          net_sales: funnelNetSales,
          conversion_rate_own:
            funnelSessions > 0 ? funnelOrders / funnelSessions : null,
          revenue_per_session:
            funnelSessions > 0 ? funnelNetSales / funnelSessions : null,
          days_with_sessions: Number(funnelRow.days_with_sessions) || 0,
        }
      : null;

    type FunnelDailyRow = { bucket_date: string; sessions: number };
    const sessionsByDate = new Map<string, number>(
      !funnelDailyResult.error && Array.isArray(funnelDailyResult.data)
        ? (funnelDailyResult.data as FunnelDailyRow[]).map((row) => [
            row.bucket_date,
            Number(row.sessions) || 0,
          ])
        : [],
    );
    // `daily` ya viene con los huecos rellenos, asi que marca el eje temporal.
    const funnelDaily = daily.map((day) => {
      const sessions = sessionsByDate.get(day.date) ?? 0;
      return {
        date: day.date,
        sessions,
        orders_count: day.orders_count,
        conversion_rate_own:
          sessions > 0 ? day.orders_count / sessions : null,
      };
    });

    const data = {
      organization_id: organizationId,
      selected_connection_id: connectionId ?? null,
      store_id: storeId,
      period: {
        days: periodDays,
        start: periodStart?.toISOString() ?? null,
        end: periodEnd.toISOString(),
      },
      sales,
      top_products: topProductsResult.data ?? [],
      stock,
      margin,
      financial,
      previous_period: previousPeriod,
      daily,
      funnel,
      funnel_daily: funnelDaily,
    };

    await setCached(env.REDIS_URL, cacheKey, data, METRICS_CACHE_TTL_SECONDS);

    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "shopify_metrics_load_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }
}
