import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("fx-rates");

/**
 * Tipos de referencia del BCE (base EUR). Se guardan en `fx_rates` y se
 * refrescan bajo demanda: el BCE publica una vez por dia habil hacia las 16:00
 * CET, asi que basta con mirar si lo guardado tiene menos de 12 horas.
 */
const ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const ECB_90D_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 15 * 60 * 1000;

export type FxRateRow = { rate_date: string; currency_code: string; eur_rate: number };
export type FxQuote = { from: string; to: string; rate: number; rate_date: string; source: "BCE" };

export function parseEcbXml(xml: string): FxRateRow[] {
  const rows: FxRateRow[] = [];
  for (const day of xml.matchAll(/<Cube time=['"](\d{4}-\d{2}-\d{2})['"]>([\s\S]*?)<\/Cube>/g)) {
    for (const quote of day[2]!.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) {
      const rate = Number(quote[2]);
      if (rate > 0) rows.push({ rate_date: day[1]!, currency_code: quote[1]!, eur_rate: rate });
    }
  }
  return rows;
}

let lastAttemptAt = 0;

async function ensureFreshRates(supabase: SupabaseClient): Promise<void> {
  if (Date.now() - lastAttemptAt < RETRY_AFTER_FAILURE_MS) return;
  const { data: latest } = await supabase
    .from("fx_rates")
    .select("rate_date, fetched_at")
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest && Date.now() - Date.parse(latest.fetched_at) < REFRESH_AFTER_MS) return;
  lastAttemptAt = Date.now();
  // Vacia o con mas de 5 dias de hueco: se trae el historico de 90 dias.
  const stale = !latest || Date.now() - Date.parse(latest.rate_date) > 5 * 24 * 60 * 60 * 1000;
  try {
    const response = await fetch(stale ? ECB_90D_URL : ECB_DAILY_URL, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`ecb_http_${response.status}`);
    const rows = parseEcbXml(await response.text());
    if (!rows.length) throw new Error("ecb_empty_feed");
    const fetchedAt = new Date().toISOString();
    const { error } = await supabase
      .from("fx_rates")
      .upsert(rows.map((row) => ({ ...row, fetched_at: fetchedAt })), { onConflict: "rate_date,currency_code" });
    if (error) throw new Error(error.message);
  } catch (cause) {
    // Sin tipos nuevos se usa el ultimo guardado; la cita lleva su fecha.
    logger.error("fx_rates_refresh_failed", { error: cause instanceof Error ? cause.message : String(cause) });
  }
}

export type CurrencyContext = {
  reporting_currency: string;
  sources: Array<{ source: string; name: string | null; currency_code: string | null }>;
  same_currency: boolean;
  fx_quotes: FxQuote[];
  unconvertible: string[];
};

const code = (value: unknown) =>
  typeof value === "string" && /^[A-Z]{3}$/.test(value.trim().toUpperCase()) ? value.trim().toUpperCase() : null;

/**
 * La moneda de cada fuente de importes del cliente (o de la tienda elegida) y
 * el tipo BCE para llevarlas a la moneda de informe: la de la tienda elegida,
 * o la de la organizacion si se mira el cliente entero.
 */
export async function loadCurrencyContext(
  supabase: SupabaseClient,
  organizationId: string,
  storeId: string | null,
): Promise<CurrencyContext> {
  const metaQuery = supabase.from("meta_ad_accounts").select("account_name, currency_code").eq("organization_id", organizationId).eq("is_selected", true).eq("is_active", true);
  const klaviyoQuery = supabase.from("klaviyo_accounts").select("name, currency_code").eq("organization_id", organizationId);
  const [organization, settings, stores, meta, klaviyo, fixed, costs] = await Promise.all([
    supabase.from("organizations").select("currency_code").eq("id", organizationId).maybeSingle(),
    supabase.from("organization_financial_settings").select("currency_code, klaviyo_revenue_currency_code").eq("organization_id", organizationId).maybeSingle(),
    (storeId
      ? supabase.from("shopify_stores").select("shop_name, currency_code").eq("organization_id", organizationId).eq("id", storeId)
      : supabase.from("shopify_stores").select("shop_name, currency_code").eq("organization_id", organizationId).eq("is_active", true)),
    storeId ? metaQuery.eq("store_id", storeId) : metaQuery,
    storeId ? klaviyoQuery.eq("store_id", storeId) : klaviyoQuery,
    supabase.from("fixed_expenses").select("currency_code").eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("product_costs").select("currency_code").eq("organization_id", organizationId).limit(1000),
  ]);
  const storeRows = stores.data ?? [];
  const reporting =
    (storeId ? code(storeRows[0]?.currency_code) : null) ??
    code(settings.data?.currency_code) ??
    code(organization.data?.currency_code) ??
    "EUR";
  const distinct = (rows: Array<{ currency_code: unknown }> | null) => [...new Set((rows ?? []).map((row) => code(row.currency_code)))];
  const sources: CurrencyContext["sources"] = [
    ...storeRows.map((row) => ({ source: "Tienda Shopify", name: row.shop_name ?? null, currency_code: code(row.currency_code) })),
    ...(meta.data ?? []).map((row) => ({ source: "Cuenta Meta Ads", name: row.account_name ?? null, currency_code: code(row.currency_code) })),
    // Klaviyo: su moneda de cuenta, salvo que finanzas haya fijado otra para los ingresos atribuidos.
    ...(klaviyo.data ?? []).map((row) => ({ source: "Cuenta Klaviyo", name: row.name ?? null, currency_code: code(settings.data?.klaviyo_revenue_currency_code) ?? code(row.currency_code) })),
    ...distinct(fixed.data).map((currency) => ({ source: "Gastos fijos", name: null, currency_code: currency })),
    ...distinct(costs.data).map((currency) => ({ source: "Costes de producto", name: null, currency_code: currency })),
  ];
  const foreign = [...new Set(sources.map((row) => row.currency_code).filter((currency): currency is string => !!currency && currency !== reporting))];
  const fxQuotes = await loadFxQuotes(supabase, foreign, reporting);
  return {
    reporting_currency: reporting,
    sources,
    same_currency: foreign.length === 0,
    fx_quotes: fxQuotes,
    unconvertible: foreign.filter((currency) => !fxQuotes.some((quote) => quote.from === currency)),
  };
}

/**
 * Tipo para pasar de cada moneda de `from` a `to`, con el ultimo publicado en
 * `onDate` o antes. Las monedas sin tipo (no cotizan en el BCE) no vuelven.
 */
export async function loadFxQuotes(
  supabase: SupabaseClient,
  from: string[],
  to: string,
  onDate = new Date().toISOString().slice(0, 10),
): Promise<FxQuote[]> {
  const target = to.toUpperCase();
  const sources = [...new Set(from.map((code) => code.toUpperCase()))].filter((code) => code !== target);
  if (!sources.length) return [];
  await ensureFreshRates(supabase);
  const needed = [...new Set([...sources, target])].filter((code) => code !== "EUR");
  const { data, error } = await supabase
    .from("fx_rates")
    .select("rate_date, currency_code, eur_rate")
    .in("currency_code", needed)
    .lte("rate_date", onDate)
    .gte("rate_date", new Date(Date.parse(onDate) - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .order("rate_date", { ascending: false });
  if (error) return [];
  const latest = new Map<string, FxRateRow>([["EUR", { rate_date: onDate, currency_code: "EUR", eur_rate: 1 }]]);
  for (const row of data ?? []) {
    if (!latest.has(row.currency_code)) latest.set(row.currency_code, { ...row, eur_rate: Number(row.eur_rate) });
  }
  const targetRow = latest.get(target);
  if (!targetRow) return [];
  return sources.flatMap((code) => {
    const sourceRow = latest.get(code);
    if (!sourceRow) return [];
    return [{
      from: code,
      to: target,
      rate: Number((targetRow.eur_rate / sourceRow.eur_rate).toFixed(6)),
      // El EUR no tiene fila: la fecha es la del tipo publicado mas antiguo de los dos.
      rate_date: [sourceRow, targetRow].filter((row) => row.currency_code !== "EUR").map((row) => row.rate_date).sort()[0]!,
      source: "BCE" as const,
    }];
  });
}
