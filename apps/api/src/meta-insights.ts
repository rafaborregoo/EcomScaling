import { createLogger } from "@e-nora/observability";
import { type AuthContext, createUserScopedClient, requireOperationalStore } from "./auth-context.js";
import { getCached, setCached } from "./redis-cache.js";
import { providerCurrencyCode } from "./provider-currency.js";

/**
 * CPM y CPC: aritmetica sobre gasto, impresiones y clics, que son hechos (no
 * atribucion). null cuando el denominador es 0: sin impresiones no hay CPM,
 * no hay un CPM de 0.
 */
export function metaCostRates(spend: number, impressions: number, clicks: number) {
  return {
    cpm: impressions > 0 ? Math.round((spend / impressions) * 1000 * 100) / 100 : null,
    cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : null,
  };
}

const logger = createLogger("api:meta-insights");

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  REDIS_URL?: string;
};

const MIN_PERIOD_DAYS = 1;
const MAX_PERIOD_DAYS = 3650;
const DEFAULT_PERIOD_DAYS = 30;
const CACHE_TTL_SECONDS = 60;

// Por debajo de esto una tasa de video es ruido, no una medida. Sale del
// backend y no de la pagina para que el agente y la pantalla juzguen con el
// mismo raton.
const MIN_IMPRESSIONS_FOR_RATES = 1000;

// Ventana a cada lado de un cambio y gasto minimo para que la comparacion
// signifique algo.
const CHANGE_WINDOW_DAYS = 7;
const CHANGE_MIN_SPEND = 50;

export type MetaCreativeRow = {
  ad_id: string;
  campaign_id: string | null;
  ad_name: string;
  ad_set_name: string;
  campaign_name: string;
  effective_status: string | null;
  spend: number;
  spend_currency: string | null;
  impressions: number;
  outbound_clicks: number | null;
  outbound_ctr: number | null;
  video_plays: number | null;
  hook_rate: number | null;
  hold_rate: number | null;
  thruplay_rate: number | null;
  quality_ranking: string | null;
  engagement_rate_ranking: string | null;
  conversion_rate_ranking: string | null;
  purchases: number;
  purchase_value: number;
  roas: number | null;
  cost_per_purchase: number | null;
  purchase_attribution_window: string | null;
  has_video: boolean;
  enough_volume: boolean;
  days_with_data: number;
};

export type MetaInsightsData = {
  organization_id: string;
  selected_connection_id: string | null;
  store_id: string | null;
  period: { days: number | "all"; start: string | null; end: string };
  // La moneda solo se declara cuando todas las cuentas del ambito coinciden.
  // Con dos cuentas en monedas distintas, pintar un simbolo seria mentir
  // sobre una suma que no se puede hacer: la pantalla ensena la cifra sin
  // simbolo y lo dice.
  currency: string | null;
  // El umbral viaja con los datos: la pantalla tiene que poder decir "sin
  // volumen suficiente (menos de N impresiones)" sin repetir el numero.
  min_impressions_for_rates: number;
  change_window_days: number;
  // La vista general del modulo. Va aparte de los bloques de detalle porque
  // responde otra pregunta: "como va Meta" antes de "que anuncio falla".
  // `days_with_data` es lo que permite decir si el periodo esta completo: con
  // huecos, el gasto de arriba describe menos dias de los que dice la ventana.
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    purchase_value: number;
    roas: number | null;
    cac: number | null;
    cpm: number | null;
    cpc: number | null;
    days_with_data: number;
    // Que accion cuenta Meta como compra en esta cuenta. Si hay mas de una,
    // las cifras de abajo no son comparables entre cuentas del ambito.
    purchase_action_types: string[];
  } | null;
  daily_spend: Array<{ bucket_date: string; spend: number }>;
  daily_roas: Array<{ bucket_date: string; roas: number | null }>;
  creatives: MetaCreativeRow[];
  ranking_distribution: Array<{
    dimension: string;
    ranking_value: string;
    ads: number;
    spend: number | null;
    spend_share: number | null;
    currency_code: string | null;
  }>;
  learning: Array<{
    ad_set_id: string;
    ad_set_name: string;
    campaign_name: string;
    effective_status: string | null;
    optimization_goal: string | null;
    learning_stage_status: string | null;
    learning_conversions: number | null;
    learning_conversions_needed: number | null;
    conversions_missing: number | null;
    daily_budget: number | null;
    spend_in_period: number;
    learning_threshold_source: string | null;
    spend_source_days: number | null;
    spend_source_rows: number | null;
    last_account_activity_at: string | null;
    last_account_activity_type: string | null;
    last_account_activity_description: string | null;
    days_since_account_activity: number | null;
    activity_reset_confirmation: string | null;
    activity_sync_state: string | null;
    activity_sync_finished_at: string | null;
    activity_sync_records_read: number | null;
    account_last_synced_at: string | null;
  }>;
  pixels: Array<{
    pixel_id: string;
    pixel_name: string | null;
    external_pixel_id: string;
    is_unavailable: boolean | null;
    last_fired_at: string | null;
    hours_since_last_fire: number | null;
    event_name: string | null;
    events_total: number;
    days_with_events: number;
    days_in_period: number;
    days_missing: number;
    last_event_date: string | null;
    avg_daily_events: number | null;
  }>;
  audiences: Array<{
    audience_id: string;
    audience_name: string | null;
    subtype: string | null;
    approximate_count_lower: number | null;
    approximate_count_upper: number | null;
    retention_days: number | null;
    is_lookalike: boolean;
    lookalike_ratio: number | null;
    lookalike_country: string | null;
    origin_name: string | null;
    delivery_status_code: number | null;
    delivery_status_description: string | null;
    ad_sets_using: number;
    external_updated_at: string | null;
  }>;
  changes: Array<{
    event_id: string;
    ad_account_id: string;
    store_id: string;
    object_external_id: string | null;
    entity_id: string | null;
    event_time: string;
    event_type: string;
    translated_event_type: string | null;
    actor_name: string | null;
    object_name: string | null;
    entity_level: string | null;
    comparison_status: string;
    currency_code: string | null;
    spend_before: number | null;
    spend_after: number | null;
    purchases_before: number | null;
    purchases_after: number | null;
    purchase_value_before: number | null;
    purchase_value_after: number | null;
    roas_before: number | null;
    roas_after: number | null;
    cpa_before: number | null;
    cpa_after: number | null;
    roas_delta_pct: number | null;
    days_before: number;
    days_after: number;
    purchase_attribution_window: string | null;
    total_count: number;
    has_more: boolean;
  }>;
  // Que bloques no se han podido calcular. Sin esta lista, un bloque roto y un
  // bloque vacio se dibujan igual.
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
    throw new Error(`meta_insights_store_load_failed: ${error.message}`);
  }

  return data?.id ?? null;
}

async function loadCurrency(
  supabase: ReturnType<typeof createUserScopedClient>,
  organizationId: string,
  storeId: string | null,
) {
  let query = supabase
    .from("meta_ad_accounts")
    .select("currency_code, raw_data")
    .eq("organization_id", organizationId)
    .eq("is_selected", true)
    .eq("is_active", true);

  if (storeId) {
    query = query.eq("store_id", storeId);
  }

  const { data, error } = await query;
  if (error) return null;

  const codes = new Set((data ?? []).map((row) =>
    providerCurrencyCode(row.currency_code, row.raw_data, "currency"),
  ));
  return codes.size === 1 ? [...codes][0] ?? null : null;
}

type RpcResult = { data: unknown; error: { message: string } | null };

function rows<T>(result: RpcResult, name: string, unavailable: string[]): T[] {
  if (result.error) {
    unavailable.push(name);
    console.error(`meta_insights_rpc_failed[${name}]`, result.error.message);
    return [];
  }

  return (result.data ?? []) as T[];
}

export async function getMetaInsights(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  daysInput: string | undefined,
  connectionId?: string,
) {
  const periodDays = parsePeriodDays(daysInput);
  const periodEnd = new Date();
  const periodStart =
    periodDays === "all"
      ? null
      : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const trendDays = periodDays === "all" ? 365 : periodDays;
  const trendStart = new Date(
    periodEnd.getTime() - trendDays * 24 * 60 * 60 * 1000,
  );

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const organizationMembership = context.memberships.find((membership) => membership.organization_id === organizationId);
  if (!organizationMembership || organizationMembership.access_scope === "store") {
    const storeId = await loadStoreIdForConnection(supabase, organizationId, connectionId);
    if (!storeId) return { ok: false as const, statusCode: 403, error: "organization_access_denied", message: "El acceso de esta cuenta debe indicar una tienda autorizada." };
    const scoped = requireOperationalStore(context, organizationId, storeId);
    if (scoped.ok === false) return scoped;
  }

  try {
    const storeId = await loadStoreIdForConnection(
      supabase,
      organizationId,
      connectionId,
    );

    const cacheKey = `meta:insights:v2:${organizationId}:${storeId ?? "org"}:${periodDays}`;
    const cached = await getCached<MetaInsightsData>(env.REDIS_URL, cacheKey);

    if (cached) {
      return { ok: true as const, data: cached };
    }

    const window = {
      target_organization_id: organizationId,
      period_start: periodStart?.toISOString() ?? null,
      period_end: periodEnd.toISOString(),
      target_store_id: storeId,
    };

    const currency = await loadCurrency(supabase, organizationId, storeId);

    const [
      summaryResult,
      dailyPerformanceResult,
      creativesResult,
      rankingResult,
      learningResult,
      pixelsResult,
      audiencesResult,
      changesResult,
      adCampaignsResult,
    ] = await Promise.all([
      supabase.rpc("meta_spend_summary", window),
      supabase.rpc("meta_performance_daily", {
        target_organization_id: organizationId,
        period_start: trendStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        target_store_id: storeId,
      }),
      supabase.rpc("meta_creative_performance", {
        ...window,
        min_impressions: MIN_IMPRESSIONS_FOR_RATES,
      }),
      supabase.rpc("meta_creative_ranking_distribution", window),
      supabase.rpc("meta_learning_phase_status", window),
      supabase.rpc("meta_pixel_health", window),
      // Sin ventana: un publico no pertenece a un periodo, existe o no.
      supabase.rpc("meta_audience_overview", {
        target_organization_id: organizationId,
        target_store_id: storeId,
      }),
      supabase.rpc("meta_change_impact", {
        ...window,
        window_days: CHANGE_WINDOW_DAYS,
        min_spend: CHANGE_MIN_SPEND,
      }),
      // ponytail: tope de 1.000 filas de PostgREST; por encima, esos anuncios quedan sin enlace. Si pasa, campaign_id en la RPC.
      supabase.from("meta_ads").select("id, meta_ad_sets(campaign_id)").eq("organization_id", organizationId),
    ]);

    const campaignByAd = new Map(((adCampaignsResult.data ?? []) as unknown as Array<{ id: string; meta_ad_sets: { campaign_id: string } | null }>)
      .map((ad) => [ad.id, ad.meta_ad_sets?.campaign_id ?? null]));

    const unavailable: string[] = [];

    // Sin filas no es un fallo: es una cuenta sin insights en la ventana. El
    // fallo ya lo registra `rows` en `unavailable`, y son cosas distintas --
    // "no gastaste nada" y "no se pudo calcular" no se pueden dibujar igual.
    const summaryRow =
      rows<Record<string, unknown>>(summaryResult, "resumen", unavailable)[0] ??
      null;
    // PostgREST devuelve `numeric` como cadena. Sin esta conversion, la moneda
    // se formatea sobre un string y el ROAS se compara como texto.
    const num = (value: unknown): number => Number(value) || 0;
    const nullableNum = (value: unknown): number | null =>
      value === null || value === undefined ? null : Number(value);
    const dailyPerformance = rows<Record<string, unknown>>(
      dailyPerformanceResult,
      "rendimiento diario",
      unavailable,
    );

    const data: MetaInsightsData = {
      organization_id: organizationId,
      selected_connection_id: connectionId ?? null,
      store_id: storeId,
      period: {
        days: periodDays,
        start: periodStart?.toISOString() ?? null,
        end: periodEnd.toISOString(),
      },
      currency,
      min_impressions_for_rates: MIN_IMPRESSIONS_FOR_RATES,
      change_window_days: CHANGE_WINDOW_DAYS,
      summary: summaryRow
        ? {
            spend: num(summaryRow.spend),
            impressions: num(summaryRow.impressions),
            clicks: num(summaryRow.clicks),
            purchases: num(summaryRow.purchases),
            purchase_value: num(summaryRow.purchase_value),
            roas: nullableNum(summaryRow.roas),
            cac: nullableNum(summaryRow.cac),
            ...metaCostRates(
              num(summaryRow.spend),
              num(summaryRow.impressions),
              num(summaryRow.clicks),
            ),
            days_with_data: num(summaryRow.days_with_data),
            purchase_action_types: Array.isArray(
              summaryRow.purchase_action_types,
            )
              ? (summaryRow.purchase_action_types as string[])
              : [],
          }
        : null,
      daily_spend: dailyPerformance.map((row) => ({
        bucket_date: String(row.bucket_date),
        spend: num(row.spend),
      })),
      daily_roas: dailyPerformance.map((row) => ({
        bucket_date: String(row.bucket_date),
        roas: nullableNum(row.roas),
      })),
      creatives: rows<MetaCreativeRow>(creativesResult, "creatives", unavailable)
        .map((row) => ({ ...row, campaign_id: campaignByAd.get(row.ad_id) ?? null })),
      ranking_distribution: rows(rankingResult, "ranking", unavailable),
      learning: rows(learningResult, "learning", unavailable),
      pixels: rows(pixelsResult, "pixels", unavailable),
      audiences: rows(audiencesResult, "audiences", unavailable),
      changes: rows(changesResult, "changes", unavailable),
      unavailable,
    };

    if (unavailable.length > 0) {
      logger.error("meta_insights_blocks_unavailable", {
        organization_id: organizationId,
        blocks: unavailable,
      });
    }

    await setCached(env.REDIS_URL, cacheKey, data, CACHE_TTL_SECONDS);

    return { ok: true as const, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("meta_insights_failed", {
      organization_id: organizationId,
      message,
    });

    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_insights_failed",
      detail: message,
    };
  }
}
