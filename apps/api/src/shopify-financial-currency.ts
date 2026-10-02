import type { SupabaseClient } from "@supabase/supabase-js";

export type ShopifyFinancialCurrencyCoverage = {
  status: "compatible" | "incompatible" | "unknown";
  currency_code: string | null;
  store_scope: "single_store" | "organization" | "unavailable";
  store_count: number;
  compared_sources: string[];
  mismatched_sources: Array<{ source: string; currencies: string[] }>;
  unknown_sources: string[];
  as_of: string;
};

type CurrencyRow = { currency_code: string | null };
type CoverageQuery = { data: CurrencyRow[] | null; error: unknown; count?: number | null };

const MAX_CURRENCY_ROWS = 1_000;

function readCurrencies(rows: CurrencyRow[] | null): { currencies: string[]; hasUnknown: boolean } {
  const currencies = new Set<string>();
  let hasUnknown = false;
  for (const row of rows ?? []) {
    const code = row.currency_code?.trim().toUpperCase();
    if (!code || !/^[A-Z]{3}$/.test(code)) hasUnknown = true;
    else currencies.add(code);
  }
  return { currencies: [...currencies].sort(), hasUnknown };
}

/**
 * Financial summaries have no FX conversion. This reports whether all known
 * monetary inputs currently used by the Shopify financial engine share the
 * selected store currency. Reads fail closed: an incomplete read is unknown.
 */
export async function resolveShopifyFinancialCurrencyCoverage(
  client: SupabaseClient,
  organizationId: string,
  storeId: string | null,
): Promise<ShopifyFinancialCurrencyCoverage> {
  const storesQuery = client
    .from("shopify_stores")
    .select("id, currency_code", { count: "exact" })
    .eq("organization_id", organizationId);
  const scopedStoresQuery = storeId ? storesQuery.eq("id", storeId) : storesQuery;

  const [storesResult, settingsResult, fixedExpensesResult, shippingRulesResult, productCostsResult, metaAccountsResult, klaviyoAccountsResult] = await Promise.all([
    scopedStoresQuery.range(0, MAX_CURRENCY_ROWS - 1),
    client.from("organization_financial_settings").select("currency_code", { count: "exact" }).eq("organization_id", organizationId).range(0, MAX_CURRENCY_ROWS - 1),
    client.from("fixed_expenses").select("currency_code", { count: "exact" }).eq("organization_id", organizationId).eq("is_active", true).range(0, MAX_CURRENCY_ROWS - 1),
    client.from("shipping_cost_rules").select("currency_code", { count: "exact" }).eq("organization_id", organizationId).eq("is_active", true).range(0, MAX_CURRENCY_ROWS - 1),
    client.from("product_costs").select("currency_code", { count: "exact" }).eq("organization_id", organizationId).range(0, MAX_CURRENCY_ROWS - 1),
    (() => {
      let query = client.from("meta_ad_accounts").select("currency_code", { count: "exact" }).eq("organization_id", organizationId);
      if (storeId) query = query.eq("store_id", storeId);
      return query.range(0, MAX_CURRENCY_ROWS - 1);
    })(),
    (() => {
      let query = client.from("klaviyo_accounts").select("currency_code", { count: "exact" }).eq("organization_id", organizationId).eq("is_active", true);
      if (storeId) query = query.eq("store_id", storeId);
      return query.range(0, MAX_CURRENCY_ROWS - 1);
    })(),
  ]) as [CoverageQuery, CoverageQuery, CoverageQuery, CoverageQuery, CoverageQuery, CoverageQuery, CoverageQuery];

  const queryRows = [
    { source: "tiendas Shopify", result: storesResult },
    { source: "configuración financiera", result: settingsResult },
    { source: "gastos fijos", result: fixedExpensesResult },
    { source: "reglas de envío", result: shippingRulesResult },
    { source: "costes de producto", result: productCostsResult },
    { source: "cuentas publicitarias Meta", result: metaAccountsResult },
    { source: "cuentas de Klaviyo", result: klaviyoAccountsResult },
  ];
  const unknownSources: string[] = [];
  const mismatchedSources: ShopifyFinancialCurrencyCoverage["mismatched_sources"] = [];
  const comparedSources: string[] = [];
  let truncated = false;

  for (const { source, result } of queryRows) {
    if (result.error) {
      unknownSources.push(source);
      continue;
    }
    if ((result.count ?? 0) > (result.data?.length ?? 0)) {
      truncated = true;
      unknownSources.push(`${source} (lectura parcial)`);
    }
  }

  const storeRows = storesResult.data ?? [];
  const storeCurrencies = readCurrencies(storeRows);
  const storeCount = storesResult.count ?? storeRows.length;
  const storeScope = storeCount === 1 ? "single_store" : storeCount > 1 ? "organization" : "unavailable";
  if (storesResult.error || storeCount === 0 || storeCurrencies.hasUnknown || truncated && (storesResult.count ?? 0) > storeRows.length) {
    if (!unknownSources.includes("tiendas Shopify")) unknownSources.push("tiendas Shopify");
  }

  const comparisonCurrency = storeCurrencies.currencies.length === 1 ? storeCurrencies.currencies[0]! : null;
  if (storeCurrencies.currencies.length > 1) {
    mismatchedSources.push({ source: "tiendas Shopify", currencies: storeCurrencies.currencies });
  }

  if (comparisonCurrency) {
    for (const { source, result } of queryRows.slice(1)) {
      if (result.error) continue;
      const { currencies, hasUnknown } = readCurrencies(result.data);
      if (hasUnknown) unknownSources.push(source);
      if (currencies.length) comparedSources.push(source);
      const mismatches = currencies.filter((code) => code !== comparisonCurrency);
      if (mismatches.length) mismatchedSources.push({ source, currencies: mismatches });
    }
  } else if (storeCount > 0) {
    unknownSources.push("moneda base de Shopify");
  }

  const uniqueUnknownSources = [...new Set(unknownSources)];
  return {
    status: mismatchedSources.length ? "incompatible" : uniqueUnknownSources.length ? "unknown" : "compatible",
    currency_code: comparisonCurrency,
    store_scope: storeScope,
    store_count: storeCount,
    compared_sources: comparedSources,
    mismatched_sources: mismatchedSources,
    unknown_sources: uniqueUnknownSources,
    as_of: new Date().toISOString(),
  };
}
