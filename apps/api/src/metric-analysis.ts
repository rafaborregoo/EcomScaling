import { createClient } from "@supabase/supabase-js";
import { createRagEmbeddingProvider } from "@e-nora/ai";
import type { LoadedApiEnv } from "@e-nora/config";
import { assessMetric, METRIC_SPECS, suggestConversionTarget, type MetricAnalysis, type MetricId, type MetricObservation } from "@e-nora/contracts";
import { requireOperationalStore, type AuthContext } from "./auth-context.js";
import { createReranker, executeKnowledgeSearch } from "./knowledge.js";
import { getCached, setCached } from "./redis-cache.js";
import { getKlaviyoEmailReport } from "./klaviyo.js";
import { getMetaInsights } from "./meta-insights.js";
import { getShopifyMetrics } from "./shopify-metrics.js";

/**
 * Analista de métricas, capa determinista (ADR-0027): observa cada métrica de la
 * ficha con los servicios que ya pintan el panel y la juzga con `assessMetric`.
 * Sin modelo de lenguaje: no gasta crédito, no pasa por el gate de release y el
 * veredicto es reproducible. La capa IA (A29) explicará sobre esta salida.
 *
 * El periodo anterior de las cifras que son sumas (gasto, clientes nuevos,
 * sesiones, compras de Meta...) se saca pidiendo 2N días y restando N: los
 * servicios no lo devuelven y así no hace falta otra RPC. Las dos peticiones a
 * Shopify van a la caché Redis de `getShopifyMetrics`.
 */

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

function parseDays(input: string | undefined) {
  const n = Math.floor(Number(input));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_DAYS) : DEFAULT_DAYS;
}

const div = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || b <= 0 ? null : a / b);

const DEFAULT_NET_MARGIN = 0.1;
/** Si a la publicidad le queda menos de un cuarto de lo disponible antes de anuncios, no se sugiere objetivo: se avisa. */
const MIN_AD_ROOM_SHARE = 0.25;

// --- Metodología del RAG ---------------------------------------------------------
// Fragmentos del conocimiento global (corpus E-NORA) por métrica. No dependen de la
// tienda, así que se cachean por consulta: una semana en Redis y, sin Redis, en memoria.
const METHODOLOGY_TTL_SECONDS = 60 * 60;
const METHODOLOGY_CACHE_VERSION = "a29-global-corpus-v1";
const methodologyMemo = new Map<string, { expiresAt: number; rows: Array<{ title: string; excerpt: string }> }>();
const MAX_METHODOLOGY_MEMO_ENTRIES = 256;

function memoizeMethodology(key: string, rows: Array<{ title: string; excerpt: string }>) {
  methodologyMemo.delete(key);
  methodologyMemo.set(key, { rows, expiresAt: Date.now() + METHODOLOGY_TTL_SECONDS * 1000 });
  while (methodologyMemo.size > MAX_METHODOLOGY_MEMO_ENTRIES) {
    const oldest = methodologyMemo.keys().next().value;
    if (oldest === undefined) break;
    methodologyMemo.delete(oldest);
  }
}

async function methodologyFor(env: LoadedApiEnv, organizationId: string, query: string) {
  const key = `metric-analysis:methodology:${METHODOLOGY_CACHE_VERSION}:${organizationId}:${query}`;
  const memo = methodologyMemo.get(key);
  if (memo && memo.expiresAt > Date.now()) return memo.rows;
  if (memo) methodologyMemo.delete(key);
  const cached = await getCached<Array<{ title: string; excerpt: string }>>(env.REDIS_URL, key);
  if (cached) {
    memoizeMethodology(key, cached);
    return cached;
  }
  if (!env.VOYAGE_API_KEY) return [];
  try {
    const [embedding] = await createRagEmbeddingProvider(env.VOYAGE_API_KEY).embed([query], "query");
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await executeKnowledgeSearch(
      supabase,
      { targetOrganizationId: organizationId, queryEmbedding: JSON.stringify(embedding), queryText: query, audienceAllowed: ["client_visible", "consultant_only"], matchCount: 8 },
      createReranker(env),
    );
    if (error) return [];
    // Solo metodología de plataforma: la memoria de la tienda no se mezcla aquí.
    const rows = ((data ?? []) as Array<{ visibility?: string; document_title?: string; content?: string }>)
      .filter((row) => row.visibility === "global" && row.content)
      .slice(0, 2)
      .map((row) => ({ title: String(row.document_title ?? ""), excerpt: excerptOf(String(row.content), query) }));
    memoizeMethodology(key, rows);
    await setCached(env.REDIS_URL, key, rows, METHODOLOGY_TTL_SECONDS);
    return rows;
  } catch {
    // La metodología acompaña; si el RAG falla, el veredicto sigue en pie.
    return [];
  }
}

/**
 * Benchmark externo más reciente por métrica (tabla metric_benchmarks): el del sector de la
 * organización si existe, si no el "general". Un importe solo vale en la moneda de la tienda.
 */
async function loadBenchmarks(env: LoadedApiEnv, organizationId: string, currency: string | null) {
  const out = new Map<MetricId, { p25: number; p50: number; p75: number; label: string }>();
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: org } = await supabase.from("organizations").select("sector").eq("id", organizationId).maybeSingle();
    const sector = (org as { sector?: string | null } | null)?.sector ?? null;
    const { data } = await supabase
      .from("metric_benchmarks")
      .select("metric_id, sector, country, p25, p50, p75, currency, source, as_of")
      .in("sector", sector ? [sector, "general"] : ["general"])
      .order("as_of", { ascending: false });
    const rows = (data ?? []) as Array<{ metric_id: MetricId; sector: string; country: string; p25: number; p50: number; p75: number; currency: string | null; source: string; as_of: string }>;
    for (const id of Object.keys(METRIC_SPECS) as MetricId[]) {
      const usable = rows.filter((r) => r.metric_id === id && (METRIC_SPECS[id].unit !== "money" || (r.currency !== null && r.currency === currency)));
      const row = usable.find((r) => r.sector === sector) ?? usable.find((r) => r.sector === "general");
      if (row) {
        out.set(id, {
          p25: Number(row.p25),
          p50: Number(row.p50),
          p75: Number(row.p75),
          label: `${row.sector === "general" ? "ecommerce en general" : row.sector} (${row.country}, ${row.as_of.slice(0, 4)}, ${row.source})`,
        });
      }
    }
  } catch {
    // Sin benchmark se juzga con lo demás: es la referencia de menos peso.
  }
  return out;
}

/**
 * Texto plano y corto: el corpus es markdown y un fragmento de 2.000 caracteres no se lee
 * en un popover. Los chunks empiezan a mitad de frase; se elige la sección (separadas por
 * `---`) que más palabras de la consulta contiene, que suele empezar en su propio título.
 */
function excerptOf(content: string, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  const sections = content.split(/\n\s*-{3,}\s*\n/).map((s) => s.trim()).filter(Boolean);
  const best = sections
    .map((s) => ({ s, hits: terms.filter((t) => s.toLowerCase().includes(t)).length }))
    .sort((a, b) => b.hits - a.hits)[0]?.s ?? content;
  const plain = best.replace(/[#*_>`]|\\(?=[=.+-])/g, "").replace(/\s+/g, " ").trim();
  return plain.length > 420 ? `${plain.slice(0, 420).replace(/\s\S*$/, "")}…` : plain;
}

export async function getMetricAnalysis(
  env: LoadedApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  daysInput: string | undefined,
  connectionId?: string,
  /** A29 la necesita para razonar aunque quien pulse sea el cliente (no se le muestra). */
  options: { includeMethodology?: boolean; targetMetric?: MetricId } = {},
) {
  const days = parseDays(daysInput);
  let selectedConnectionId = connectionId;
  if (!selectedConnectionId) {
    const membership = context.memberships.find((item) => item.organization_id === organizationId && item.access_scope === "store")
      ?? context.storeMemberships?.find((item) => item.organization_id === organizationId);
    if (membership) {
      const storeIds = [...new Set([...(membership.store_ids ?? []), ...(membership.store_id ? [membership.store_id] : [])])];
      if (storeIds.length !== 1) return { ok: false as const, statusCode: 409, error: "metric_analysis_store_selection_required", message: "Selecciona una tienda concreta para consultar esta métrica." };
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: store, error } = await supabase.from("shopify_stores").select("id, connection_id").eq("organization_id", organizationId).eq("id", storeIds[0]).eq("is_active", true).maybeSingle();
      if (error) return { ok: false as const, statusCode: 503, error: "metric_analysis_store_lookup_failed", detail: error.message };
      if (!store) return { ok: false as const, statusCode: 404, error: "metric_analysis_store_not_found" };
      const access = requireOperationalStore(context, organizationId, store.id);
      if (access.ok === false) return access;
      selectedConnectionId = store.connection_id as string;
    }
  }
  if (options.targetMetric === "email_open_rate") {
    const mail = await getKlaviyoEmailReport(env, context, organizationId, String(days), selectedConnectionId);
    const totals = mail.ok && mail.data.connected ? mail.data.totals : null;
    const previous = mail.ok && mail.data.connected ? mail.data.previous : null;
    const methodology = options.includeMethodology
      ? await methodologyFor(env, organizationId, METRIC_SPECS.email_open_rate.ragQuery)
      : null;
    const analysis = assessMetric(METRIC_SPECS.email_open_rate, totals ? {
      value: totals.open_rate,
      previous: previous?.open_rate ?? null,
      sample: totals.delivered,
      drivers: [
        { id: "bounce_rate", value: totals.bounce_rate, previous: previous?.bounce_rate ?? null },
        { id: "spam_rate", value: totals.spam_rate, previous: previous?.spam_rate ?? null },
        { id: "unsub_rate", value: totals.unsub_rate, previous: previous?.unsub_rate ?? null },
      ],
    } : { value: null, sample: 0, unavailable: mail.ok ? "Klaviyo no está conectado." : "No se pudo obtener el informe de Klaviyo." });
    const measurementPeriod = { start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() };
    return {
      ok: true as const,
      data: {
        organization_id: organizationId,
        period_days: days,
        measurement_period: measurementPeriod,
        generated_at: new Date().toISOString(),
        engine: "deterministic.v1" as const,
        analyses: [{ ...analysis, suggested_target: null, measurement_period: measurementPeriod, currency_code: null, ...(methodology ? { methodology } : {}) }],
      },
    };
  }
  const loadMeta = !options.targetMetric || options.targetMetric === "meta_roas";
  const loadMail = !options.targetMetric;
  const loadPreviousShop = !options.targetMetric || options.targetMetric !== "meta_roas";
  const loadShop = options.targetMetric !== "meta_roas";
  const metaNotRequested = { ok: false as const, statusCode: 503, error: "metric_source_not_requested" };
  const mailNotRequested = { ok: false as const, statusCode: 503, error: "metric_source_not_requested" };
  const [shop, shop2, meta, meta2, mail] = await Promise.all([
    loadShop ? getShopifyMetrics(env, authorization, context, organizationId, String(days), selectedConnectionId) : Promise.resolve(null),
    loadPreviousShop ? getShopifyMetrics(env, authorization, context, organizationId, String(days * 2), selectedConnectionId) : Promise.resolve(null),
    loadMeta ? getMetaInsights(env, authorization, context, organizationId, String(days), selectedConnectionId) : Promise.resolve(metaNotRequested),
    loadMeta ? getMetaInsights(env, authorization, context, organizationId, String(days * 2), selectedConnectionId) : Promise.resolve(metaNotRequested),
    loadMail ? getKlaviyoEmailReport(env, context, organizationId, String(days), selectedConnectionId) : Promise.resolve(mailNotRequested),
  ]);

  if (options.targetMetric === "meta_roas") {
    if (!meta.ok) return meta;
    const current = meta.data.summary;
    const previousWindow = meta2.ok ? meta2.data.summary : null;
    const previousSpend = current && previousWindow ? previousWindow.spend - current.spend : null;
    const previousImpressions = current && previousWindow ? previousWindow.impressions - current.impressions : null;
    const previousClicks = current && previousWindow ? previousWindow.clicks - current.clicks : null;
    const previousPurchases = current && previousWindow ? previousWindow.purchases - current.purchases : null;
    const previousPurchaseValue = current && previousWindow ? previousWindow.purchase_value - current.purchase_value : null;
    const observation: MetricObservation = current ? {
      value: current.roas,
      previous: previousSpend != null && previousPurchaseValue != null ? div(previousPurchaseValue, previousSpend) : null,
      sample: current.purchases,
      drivers: [
        { id: "cpm", value: current.cpm, previous: previousSpend != null && previousImpressions != null ? div(previousSpend * 1000, previousImpressions) : null, currency_code: meta.data.currency },
        { id: "ctr", value: div(current.clicks, current.impressions), previous: previousClicks != null && previousImpressions != null ? div(previousClicks, previousImpressions) : null },
        { id: "click_to_purchase", value: div(current.purchases, current.clicks), previous: previousPurchases != null && previousClicks != null ? div(previousPurchases, previousClicks) : null },
        { id: "aov", value: div(current.purchase_value, current.purchases), previous: previousPurchases != null && previousPurchaseValue != null ? div(previousPurchaseValue, previousPurchases) : null, currency_code: meta.data.currency },
      ],
    } : { value: null, sample: 0, unavailable: "Meta Ads no tiene datos en este periodo o no está conectado." };
    const analysis = assessMetric(METRIC_SPECS.meta_roas, observation);
    const consultant = ["platform_admin", "consultant"].includes(context.profile.platform_role);
    const methodology = consultant || options.includeMethodology
      ? await methodologyFor(env, organizationId, METRIC_SPECS.meta_roas.ragQuery)
      : null;
    const period = meta.data.period.start ? { start: meta.data.period.start, end: meta.data.period.end } : undefined;
    return {
      ok: true as const,
      data: {
        organization_id: organizationId,
        period_days: days,
        measurement_period: period ?? { start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(), end: meta.data.period.end },
        generated_at: new Date().toISOString(),
        engine: "deterministic.v1" as const,
        analyses: [{ ...analysis, suggested_target: null, currency_code: null, ...(period ? { measurement_period: period } : {}), ...(methodology ? { methodology } : {}) }],
      },
    };
  }

  // El acceso lo decide el primer servicio: si Shopify dice 403, todo es 403.
  if (!shop || !shop.ok) return shop ?? { ok: false as const, statusCode: 503, error: "metric_source_not_requested" };

  const d = shop.data;
  const fin = d.financial;
  const f2 = shop2?.ok ? shop2.data.financial : null;
  const funnel = d.funnel;
  const funnel2 = shop2?.ok ? shop2.data.funnel : null;
  // Beneficio y umbrales solo con costes completos y moneda comparable: la misma regla que el panel.
  const economicsOk =
    d.financial_currency_coverage.status === "compatible" &&
    fin.has_settings &&
    fin.items_without_cost === 0 &&
    d.margin.lines_without_metrics === 0;
  const target = (key: string | undefined, scale: number) => {
    const row = key ? d.metric_targets.find((t) => t.metric_key === key) : undefined;
    return row ? Number(row.target_value) * scale : null;
  };
  // Objetivo sugerido (corpus 7.34 "Target ROAS": se deriva de margen, costes y beneficio
  // objetivo, nunca a ojo). De cada 100 € vendidos quedan `available` antes de publicidad
  // (= 1 / ROAS de equilibrio); si se quiere ganar `margin`, la publicidad puede costar como
  // mucho `available - margin`, y el ROAS que lo consigue es su inverso. El margen es el
  // objetivo de margen neto si existe; si no, un 10 %.
  const margin = target("net_margin_pct", 0.01) ?? DEFAULT_NET_MARGIN;
  const marginText = `${Math.round(margin * 100)} %`;
  const available = economicsOk && fin.breakeven_roas ? 1 / fin.breakeven_roas : null;
  // Si el margen pedido se come casi todo lo disponible, no hay ROAS razonable que sugerir:
  // se dice eso en vez de proponer un 30 que nadie alcanzará.
  const adRoom = available != null ? available - margin : null;
  const roasValue = adRoom != null && adRoom >= available! * MIN_AD_ROOM_SHARE ? Math.ceil((1 / adRoom) * 10) / 10 : null;
  const suggestedRoas =
    available == null
      ? null
      : roasValue != null
        ? {
            value: roasValue,
            text: `De cada 100 € vendidos te quedan ${Math.round(available * 100)} € antes de publicidad. Para ganar un ${marginText} neto, la publicidad puede costar como mucho ${Math.round(adRoom! * 100)} €: hace falta un ROAS de ${roasValue.toFixed(1).replace(".", ",")} o más.`,
          }
        : {
            value: 0,
            text: `De cada 100 € vendidos te quedan ${Math.round(available * 100)} € antes de publicidad: con un objetivo de margen neto del ${marginText} casi no queda sitio para anuncios. Antes que un ROAS, revisa precios, costes o ese objetivo.`,
          };
  const cacRoom = economicsOk ? fin.breakeven_cac_per_order - margin * fin.aov_ex_tax : null;
  const suggestedCac =
    cacRoom == null || fin.breakeven_cac_per_order <= 0
      ? null
      : cacRoom >= fin.breakeven_cac_per_order * MIN_AD_ROOM_SHARE
        ? {
            value: Math.floor(cacRoom),
            text: `Un primer pedido deja ${fin.breakeven_cac_per_order.toFixed(0)} € para captarlo. Reservando un ${marginText} del ticket (${(margin * fin.aov_ex_tax).toFixed(0)} €) como beneficio, el CAC no debería pasar de ${Math.floor(cacRoom)} €.`,
          }
        : {
            value: 0,
            text: `Un primer pedido deja ${fin.breakeven_cac_per_order.toFixed(0)} € para captarlo: con un margen neto del ${marginText} no queda presupuesto de captación en la primera compra. Solo compensa si el cliente repite.`,
          };
  // El objetivo fijado manda; sin él, se juzga contra el sugerido y la pantalla lo dice.
  // `value: 0` = no hay objetivo alcanzable que sugerir (solo el aviso de texto).
  const withTarget = (set: number | null, suggested: { value: number } | null) =>
    set != null ? { target: set } : suggested?.value ? { target: suggested.value, targetLabel: "objetivo sugerido" } : {};
  const monthly = d.financial_monthly.filter((m) => m.net_revenue_ex_tax > 0 || m.ads_spend > 0);
  // El mes en curso está a medias: fuera del historial.
  const closedMonths = monthly.slice(0, -1);

  const observations: Record<MetricId, MetricObservation> = {
    mer: {
      value: div(fin.net_revenue_ex_tax, fin.ads_spend),
      previous: f2 ? div(f2.net_revenue_ex_tax - fin.net_revenue_ex_tax, f2.ads_spend - fin.ads_spend) : null,
      sample: fin.ads_spend > 0 ? d.sales.orders_count : 0,
      threshold: economicsOk && fin.breakeven_roas != null ? { value: fin.breakeven_roas, label: "MER de equilibrio" } : null,
      history: closedMonths.map((m) => div(m.net_revenue_ex_tax, m.ads_spend)).filter((v): v is number => v != null),
      ...withTarget(null, suggestedRoas),
      drivers: [
        { id: "revenue", value: fin.net_revenue_ex_tax, previous: f2 ? f2.net_revenue_ex_tax - fin.net_revenue_ex_tax : null, currency_code: d.currency_code },
        { id: "spend", value: fin.ads_spend, previous: f2 ? f2.ads_spend - fin.ads_spend : null, currency_code: d.currency_code },
      ],
      unavailable: fin.ads_spend > 0 ? null : "No hay inversión en anuncios en el periodo.",
    },
    cac_new: {
      value: div(fin.ads_spend, fin.new_customers),
      previous: f2 ? div(f2.ads_spend - fin.ads_spend, f2.new_customers - fin.new_customers) : null,
      sample: fin.new_customers,
      // Techo por pedido: lo máximo que se puede pagar por captar un pedido sin perder dinero.
      threshold: economicsOk && fin.breakeven_cac_per_order > 0 ? { value: fin.breakeven_cac_per_order, label: "CAC máximo del primer pedido" } : null,
      ...withTarget(target(METRIC_SPECS.cac_new.target?.key, 1), suggestedCac),
      history: closedMonths.map((m) => div(m.ads_spend, m.new_customers)).filter((v): v is number => v != null),
      drivers: [
        { id: "spend", value: fin.ads_spend, previous: f2 ? f2.ads_spend - fin.ads_spend : null, currency_code: d.currency_code },
        { id: "new_customers", value: fin.new_customers, previous: f2 ? f2.new_customers - fin.new_customers : null },
      ],
      unavailable: fin.ads_spend > 0 ? null : "No hay inversión en anuncios en el periodo.",
    },
    conversion: (() => {
      if (!funnel?.has_sessions) return { value: null, sample: 0, unavailable: "No hay sesiones sincronizadas de la tienda online." };
      // Pasos del periodo anterior por resta de recuentos; las tasas no se restan.
      const prevCounts =
        funnel2?.has_sessions && funnel.has_funnel_steps && funnel2.has_funnel_steps
          ? {
              sessions: funnel2.sessions - funnel.sessions,
              cart: funnel2.cart_additions - funnel.cart_additions,
              checkout: funnel2.checkouts_reached - funnel.checkouts_reached,
              purchases: funnel2.purchases - funnel.purchases,
            }
          : null;
      return {
        value: funnel.conversion_rate_own,
        previous: d.previous_period?.conversion_rate_own ?? null,
        sample: funnel.sessions,
      target: target(METRIC_SPECS.conversion.target?.key, METRIC_SPECS.conversion.target?.scale ?? 1),
        drivers: funnel.has_funnel_steps
          ? [
              { id: "cart_rate", value: funnel.cart_rate, previous: prevCounts ? div(prevCounts.cart, prevCounts.sessions) : null },
              { id: "checkout_rate", value: funnel.checkout_rate, previous: prevCounts ? div(prevCounts.checkout, prevCounts.sessions) : null },
              { id: "checkout_to_purchase_rate", value: funnel.checkout_to_purchase_rate, previous: prevCounts ? div(prevCounts.purchases, prevCounts.checkout) : null },
            ]
          : [],
      };
    })(),
    meta_roas: (() => {
      const s = meta.ok ? meta.data.summary : null;
      if (!s) return { value: null, sample: 0, unavailable: "Meta Ads no tiene datos en este periodo o no está conectado." };
      const s2 = meta2.ok ? meta2.data.summary : null;
      const p = s2
        ? {
            spend: s2.spend - s.spend,
            impressions: s2.impressions - s.impressions,
            clicks: s2.clicks - s.clicks,
            purchases: s2.purchases - s.purchases,
            value: s2.purchase_value - s.purchase_value,
          }
        : null;
      return {
        value: s.roas,
        previous: p ? div(p.value, p.spend) : null,
        sample: s.purchases,
        threshold: economicsOk && fin.breakeven_roas != null ? { value: fin.breakeven_roas, label: "ROAS de equilibrio de la tienda" } : null,
        ...withTarget(target(METRIC_SPECS.meta_roas.target?.key, 1), suggestedRoas),
        drivers: [
          { id: "cpm", value: s.cpm, previous: p ? div(p.spend * 1000, p.impressions) : null, currency_code: meta.ok ? meta.data.currency : null },
          { id: "ctr", value: div(s.clicks, s.impressions), previous: p ? div(p.clicks, p.impressions) : null },
          { id: "click_to_purchase", value: div(s.purchases, s.clicks), previous: p ? div(p.purchases, p.clicks) : null },
          { id: "aov", value: div(s.purchase_value, s.purchases), previous: p ? div(p.value, p.purchases) : null, currency_code: meta.ok ? meta.data.currency : null },
        ],
      };
    })(),
    email_open_rate: (() => {
      if (!mail.ok || !mail.data.connected) return { value: null, sample: 0, unavailable: "Klaviyo no está conectado." };
      const t = mail.data.totals;
      const p = mail.data.previous;
      return {
        value: t.open_rate,
        previous: p?.open_rate ?? null,
        sample: t.delivered,
        drivers: [
          { id: "bounce_rate", value: t.bounce_rate, previous: p?.bounce_rate ?? null },
          { id: "spam_rate", value: t.spam_rate, previous: p?.spam_rate ?? null },
          { id: "unsub_rate", value: t.unsub_rate, previous: p?.unsub_rate ?? null },
        ],
      };
    })(),
  };

  const suggestions: Partial<Record<MetricId, { value: number; text: string } | null>> = {
    mer: suggestedRoas,
    cac_new: target(METRIC_SPECS.cac_new.target?.key, 1) == null ? suggestedCac : null,
    meta_roas: target(METRIC_SPECS.meta_roas.target?.key, 1) == null ? suggestedRoas : null,
    // Solo se sugiere, no se juzga contra ella: las mejores semanas de la tienda
    // son una meta, y quedarse por debajo es lo normal, no una alarma.
    conversion:
      target(METRIC_SPECS.conversion.target?.key, 1) == null
        ? suggestConversionTarget(shop2?.ok ? shop2.data.funnel_daily : d.funnel_daily)
        : null,
  };
  // La metodología es conocimiento interno de E-NORA: la ve el consultor, no el cliente.
  const isConsultant = ["platform_admin", "consultant"].includes(context.profile.platform_role);
  const ids = Object.keys(METRIC_SPECS) as MetricId[];
  const methodologyIds = options.targetMetric ? [options.targetMetric] : ids;
  const methodology = isConsultant || options.includeMethodology
    ? new Map(await Promise.all(methodologyIds.map(async (id) => [id, await methodologyFor(env, organizationId, METRIC_SPECS[id].ragQuery)] as const)))
    : null;

  const benchmarks = await loadBenchmarks(env, organizationId, d.currency_code);
  const analyses = ids.map((id): MetricAnalysis => ({
    ...assessMetric(METRIC_SPECS[id], { ...observations[id], benchmark: benchmarks.get(id) ?? null }),
    suggested_target: suggestions[id] ?? null,
    currency_code: METRIC_SPECS[id].unit === "money" ? d.currency_code : null,
    ...(d.period.start && d.period.end ? { measurement_period: { start: d.period.start, end: d.period.end } } : {}),
    ...(methodology ? { methodology: methodology.get(id) ?? [] } : {}),
  }));

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      period_days: days,
      measurement_period: { start: d.period.start, end: d.period.end },
      generated_at: new Date().toISOString(),
      engine: "deterministic.v1" as const,
      analyses,
    },
  };
}
