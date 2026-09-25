import { createLogger } from "@e-nora/observability";
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
// Mes en curso y los once anteriores: el grafico de barras del panel.
const MONTHLY_SERIES_MONTHS = 12;

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
    // Lineas cuyo coste sale del `current_unit_cost` de Shopify y no de una
    // fila fechada en `product_costs`: el coste de hoy aplicado a un pedido
    // viejo. Mejor que contarlo como gratis, pero la pantalla debe decirlo.
    items_with_estimated_cost: number;
  };
  // `net_sales` sigue siendo el total con IVA y envio cobrado; el ingreso que
  // manda en beneficio, margen y unit economics es `net_revenue_ex_tax`. Los
  // dos viajan a proposito: la pantalla ensena el de sin IVA, y los agentes que
  // ya leian `net_sales` no cambian de significado bajo los pies.
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
    net_revenue_ex_tax: number;
    tax_collected: number;
    shipping_charged: number;
    shipping_net: number;
    uses_shipping_rules: boolean;
    ads_spend: number;
    ads_by_platform: Record<string, number>;
    ads_days_with_data: number;
    new_customers: number;
    cac_blended: number | null;
    aov_ex_tax: number;
    cogs_per_order: number;
    shipping_per_order: number;
    payment_fee_per_order: number;
    fixed_per_order: number;
    fixed_pct_revenue: number;
    cac_per_order: number;
    contribution_per_order: number;
    breakeven_cac_per_order: number;
    mbee: number;
    breakeven_roas: number | null;
  };
  // Serie mensual para el grafico de barras del panel. Vacia si la consulta
  // falla: el grafico desaparece, el resto del dashboard sigue en pie.
  financial_monthly: Array<{
    month: string;
    orders_count: number;
    net_revenue_ex_tax: number;
    net_profit: number;
    ads_spend: number;
    new_customers: number;
  }>;
  // Objetivos vigentes por metrica (`organization_metric_targets`). Sin ellos
  // una cifra no puede decir si va bien o mal, que es la mitad de su utilidad.
  // Viajan con las metricas y no se piden a /financial-config: una llamada en
  // vez de dos, y sin depender de un endpoint restringido a owner/manager.
  metric_targets: Array<{
    metric_key: string;
    target_value: number;
    period: string;
  }>;
  previous_period: {
    period: { start: string; end: string };
    sales: ShopifyMetricsData["sales"];
    financial: { net_profit: number; net_margin_pct: number };
  } | null;
  // La misma ventana del ano anterior. Responde una pregunta distinta a
  // `previous_period`: en un negocio con temporada, agosto contra julio dice
  // poco y agosto contra el agosto pasado lo dice todo. `null` con "Todo"
  // (no hay ventana que desplazar) o si la consulta falla.
  previous_year: {
    period: { start: string; end: string };
    orders_count: number;
    net_revenue_ex_tax: number;
    net_profit: number;
    aov_ex_tax: number;
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
    // Pasos intermedios del embudo, los tres de ShopifyQL y en la misma unidad
    // que `sessions`: visitas a la tienda online. `purchases` NO es
    // `orders_count` -- los pedidos incluyen otros canales.
    //
    // `has_funnel_steps` en false = no lo sabemos (esas metricas empezaron a
    // pedirse despues del periodo que se esta mirando), que no es lo mismo que
    // "nadie llego ahi". La pantalla omite los pasos en vez de pintar ceros.
    cart_additions: number;
    checkouts_reached: number;
    purchases: number;
    has_funnel_steps: boolean;
    cart_rate: number | null;
    checkout_rate: number | null;
    checkout_to_purchase_rate: number | null;
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

/**
 * La misma fecha del ano anterior.
 *
 * Se desplaza por CALENDARIO y no restando 365 dias, porque lo que compara un
 * consultor es agosto contra agosto: con la resta fija, un ano bisiesto de por
 * medio corre la ventana un dia y el "mismo periodo" deja de serlo.
 *
 * El 29 de febrero se lleva al 28: `setUTCFullYear` por si solo lo desbordaria
 * al 1 de marzo, que ya es otro mes.
 */
export function shiftOneYearBack(date: Date): Date {
  const shifted = new Date(date.getTime());
  const day = shifted.getUTCDate();

  if (shifted.getUTCMonth() === 1 && day === 29) {
    shifted.setUTCDate(28);
  }

  shifted.setUTCFullYear(shifted.getUTCFullYear() - 1);
  return shifted;
}

export type MetricTargetRow = {
  metric_key: string;
  target_value: number;
  period: string;
  valid_until: string | null;
};

/**
 * Un objetivo por metrica y periodicidad: el de `valid_from` mas reciente que
 * siga vigente. Espera las filas ya ordenadas por `valid_from` descendente, asi
 * que el primero que aparece de cada clave es el que manda.
 *
 * Los caducados se descartan aqui y no en SQL porque `valid_until` es nullable
 * ("sin fecha de fin" es lo normal) y un `or` de PostgREST sobre nulos se lee
 * mucho peor que esta comparacion.
 */
export function selectCurrentTargets(
  rows: MetricTargetRow[],
  today: string,
): Array<{ metric_key: string; target_value: number; period: string }> {
  const selected: Array<{ metric_key: string; target_value: number; period: string }> = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.valid_until && row.valid_until < today) {
      continue;
    }

    const key = `${row.metric_key}:${row.period}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    selected.push({
      metric_key: row.metric_key,
      target_value: Number(row.target_value) || 0,
      period: row.period,
    });
  }

  return selected;
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
      items_with_estimated_cost: 0,
    },
    financial: emptyFinancialData(),
    financial_monthly: [],
    metric_targets: [],
    previous_period: null,
    previous_year: null,
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
    net_revenue_ex_tax: 0,
    tax_collected: 0,
    shipping_charged: 0,
    shipping_net: 0,
    uses_shipping_rules: false,
    ads_spend: 0,
    ads_by_platform: {},
    ads_days_with_data: 0,
    new_customers: 0,
    cac_blended: null,
    aov_ex_tax: 0,
    cogs_per_order: 0,
    shipping_per_order: 0,
    payment_fee_per_order: 0,
    fixed_per_order: 0,
    fixed_pct_revenue: 0,
    cac_per_order: 0,
    contribution_per_order: 0,
    breakeven_cac_per_order: 0,
    mbee: 0,
    breakeven_roas: null,
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

  // F6: la misma ventana, un ano antes. Es otra comparacion, no un sustituto
  // del periodo anterior: "agosto contra julio" y "agosto contra el agosto
  // pasado" responden preguntas distintas, y en un negocio con temporada la
  // segunda es la unica que no enganya.
  const yearAgoStart = periodStart ? shiftOneYearBack(periodStart) : null;
  const yearAgoEnd = periodStart ? shiftOneYearBack(periodEnd) : null;

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
      monthlyResult,
      targetsResult,
      yearAgoSalesResult,
      yearAgoFinancialResult,
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
      // No depende del periodo elegido: siempre los ultimos 12 meses. Es la
      // llamada mas cara de la request (12 periodos encadenados por dentro),
      // pero va en paralelo y es no fatal; medido en produccion: 87 ms con 789
      // pedidos. Si algun dia se acerca al statement_timeout de 8s, lo que hay
      // que materializar es el primer pedido por cliente, no partir la funcion.
      supabase.rpc("shopify_financial_monthly", {
        target_organization_id: organizationId,
        months_back: MONTHLY_SERIES_MONTHS,
        target_store_id: storeId,
      }),
      // Los objetivos pueden ser de la organizacion (store_id null) o de una
      // tienda concreta. Con la tienda activa se piden los dos y manda el de la
      // tienda: por eso se ordena primero por store_id con los nulos al final,
      // y despues por fecha. `selectCurrentTargets` se queda con el primero de
      // cada metrica, asi que el orden ES la regla de precedencia.
      (storeId
        ? supabase
            .from("organization_metric_targets")
            .select("metric_key, target_value, period, valid_from, valid_until")
            .eq("organization_id", organizationId)
            .or(`store_id.is.null,store_id.eq.${storeId}`)
        : supabase
            .from("organization_metric_targets")
            .select("metric_key, target_value, period, valid_from, valid_until")
            .eq("organization_id", organizationId)
            .is("store_id", null)
      )
        .lte("valid_from", new Date().toISOString().slice(0, 10))
        .order("store_id", { ascending: false, nullsFirst: false })
        .order("valid_from", { ascending: false }),
      yearAgoStart && yearAgoEnd
        ? supabase.rpc("shopify_sales_summary", {
            target_organization_id: organizationId,
            period_start: yearAgoStart.toISOString(),
            period_end: yearAgoEnd.toISOString(),
            target_store_id: storeId,
          })
        : Promise.resolve({ data: null, error: null }),
      yearAgoStart && yearAgoEnd
        ? supabase.rpc("shopify_financial_summary", {
            target_organization_id: organizationId,
            period_start: yearAgoStart.toISOString(),
            period_end: yearAgoEnd.toISOString(),
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
    // No fatales: sin serie mensual el panel pierde el grafico de barras, y sin
    // objetivos las tarjetas pierden el "vs objetivo". Ninguna de las dos cosas
    // justifica tumbar el dashboard entero.
    if (monthlyResult.error) {
      logger.error("shopify_financial_monthly_failed", { organization_id: organizationId, error: monthlyResult.error.message });
    }
    if (targetsResult.error) {
      logger.error("organization_metric_targets_failed", { organization_id: organizationId, error: targetsResult.error.message });
    }
    // Tampoco fatal: sin el ano anterior el panel pierde una comparacion, no
    // una cifra.
    if (yearAgoSalesResult.error) {
      logger.error("shopify_sales_summary_year_ago_failed", { organization_id: organizationId, error: yearAgoSalesResult.error.message });
    }
    if (yearAgoFinancialResult.error) {
      logger.error("shopify_financial_summary_year_ago_failed", { organization_id: organizationId, error: yearAgoFinancialResult.error.message });
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
      items_with_estimated_cost: 0,
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
      cart_additions: number;
      checkouts_reached: number;
      purchases: number;
      funnel_data_since: string | null;
    };
    const funnelRow = (!funnelResult.error
      ? (funnelResult.data?.[0] as FunnelRow | undefined)
      : undefined) ?? null;
    const funnelSessions = Number(funnelRow?.sessions) || 0;
    const funnelOrders = Number(sales.orders_count) || 0;
    const funnelNetSales = Number(sales.net_sales) || 0;
    // Los tres pasos intermedios, todos de ShopifyQL y en visitas. Antes el de
    // "pago iniciado" se componia sumando checkouts abandonados a los pedidos:
    // servia, pero mezclaba dos unidades en la misma columna de porcentajes.
    const cartAdditions = Number(funnelRow?.cart_additions) || 0;
    const checkoutsReached = Number(funnelRow?.checkouts_reached) || 0;
    const funnelPurchases = Number(funnelRow?.purchases) || 0;
    // Los pasos solo valen si TODO el periodo esta cubierto: esas metricas
    // empezaron a pedirse el 2026-09-16, y antes las filas tienen null, no
    // cero. Con "Todo" no se puede afirmar, asi que se declaran desconocidos en
    // vez de pintar una caida enorme que solo existe porque no preguntamos.
    const funnelDataSince = funnelRow?.funnel_data_since ?? null;
    const hasFunnelSteps =
      funnelDataSince !== null &&
      periodStart !== null &&
      funnelDataSince <= periodStart.toISOString().slice(0, 10);

    const funnel = funnelRow
      ? {
          has_sessions: Number(funnelRow.days_with_sessions) > 0,
          cart_additions: cartAdditions,
          checkouts_reached: checkoutsReached,
          purchases: funnelPurchases,
          has_funnel_steps: hasFunnelSteps,
          cart_rate:
            hasFunnelSteps && funnelSessions > 0
              ? cartAdditions / funnelSessions
              : null,
          checkout_rate:
            hasFunnelSteps && funnelSessions > 0
              ? checkoutsReached / funnelSessions
              : null,
          checkout_to_purchase_rate:
            hasFunnelSteps && checkoutsReached > 0
              ? funnelPurchases / checkoutsReached
              : null,
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

    type MonthlyRow = {
      bucket_month: string;
      orders_count: number;
      net_revenue_ex_tax: number;
      net_profit: number;
      ads_spend: number;
      new_customers: number;
    };
    const financialMonthly =
      !monthlyResult.error && Array.isArray(monthlyResult.data)
        ? (monthlyResult.data as MonthlyRow[]).map((row) => ({
            month: row.bucket_month,
            orders_count: Number(row.orders_count) || 0,
            net_revenue_ex_tax: Number(row.net_revenue_ex_tax) || 0,
            net_profit: Number(row.net_profit) || 0,
            ads_spend: Number(row.ads_spend) || 0,
            new_customers: Number(row.new_customers) || 0,
          }))
        : [];

    // El ano anterior solo cuenta si la consulta salio bien Y hay algo que
    // comparar: una tienda que abrio hace seis meses tendria un "vs ano
    // anterior" de +infinito contra cero, que no informa de nada.
    const yearAgoFinancial =
      !yearAgoFinancialResult.error && yearAgoStart && yearAgoEnd
        ? (yearAgoFinancialResult.data?.[0] as
            | { net_revenue_ex_tax: number; net_profit: number; aov_ex_tax: number }
            | undefined)
        : undefined;
    const yearAgoSales =
      !yearAgoSalesResult.error && yearAgoStart
        ? (yearAgoSalesResult.data?.[0] as { orders_count: number } | undefined)
        : undefined;

    const previousYear =
      yearAgoStart && yearAgoEnd && yearAgoFinancial && Number(yearAgoSales?.orders_count) > 0
        ? {
            period: {
              start: yearAgoStart.toISOString(),
              end: yearAgoEnd.toISOString(),
            },
            orders_count: Number(yearAgoSales?.orders_count) || 0,
            net_revenue_ex_tax: Number(yearAgoFinancial.net_revenue_ex_tax) || 0,
            net_profit: Number(yearAgoFinancial.net_profit) || 0,
            aov_ex_tax: Number(yearAgoFinancial.aov_ex_tax) || 0,
          }
        : null;

    const metricTargets = selectCurrentTargets(
      !targetsResult.error && Array.isArray(targetsResult.data)
        ? (targetsResult.data as MetricTargetRow[])
        : [],
      new Date().toISOString().slice(0, 10),
    );

    // Anotado a proposito: sin el tipo explicito, TypeScript infiere la forma
    // del literal y el contrato de arriba no comprueba nada.
    const data: ShopifyMetricsData = {
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
      financial_monthly: financialMonthly,
      metric_targets: metricTargets,
      previous_period: previousPeriod,
      previous_year: previousYear,
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
