import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { getCached, setCached } from "./redis-cache.js";

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

    const [salesResult, topProductsResult, stockResult, marginResult] = await Promise.all([
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
