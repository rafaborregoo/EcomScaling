import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveShopifyFinancialCurrencyCoverage } from "./shopify-financial-currency.js";

export function objectiveWindow(period: string, basis: string | null, now = new Date()) {
  const month = now.getUTCMonth();
  const start = basis === "calendar"
    ? new Date(Date.UTC(now.getUTCFullYear(), period === "yearly" ? 0 : period === "quarterly" ? Math.floor(month / 3) * 3 : month, 1))
    : new Date(now.getTime() - 30 * 86_400_000);
  return { start: start.toISOString(), end: now.toISOString(), label: basis === "calendar"
    ? `${period === "yearly" ? "Año" : period === "quarterly" ? "Trimestre" : "Mes"} natural hasta la fecha`
    : "Últimos 30 días · objetivo anterior" };
}

export function objectiveProgress(actual: number | null, target: number, direction: string) {
  if (actual === null || !Number.isFinite(actual) || !Number.isFinite(target)) return { reached: false, pct: null };
  const reached = direction === "down" ? actual <= target : actual >= target;
  // A negative baseline/target or a zero reduction has no meaningful quotient.
  const pct = reached ? 100 : target > 0 && actual > 0
    ? Math.max(0, Math.min(100, (direction === "down" ? target / actual : actual / target) * 100)) : null;
  return { reached, pct };
}

type Row = Record<string, unknown>;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
export async function readCaminoObjectives(service: SupabaseClient, organizationId: string, storeId: string | null, window: ReturnType<typeof objectiveWindow>) {
  const args = { target_organization_id: organizationId, target_store_id: storeId, period_start: window.start, period_end: window.end };
  const [sales, financial, stock, funnel, meta, connections, currency] = await Promise.all([
    service.rpc("shopify_sales_summary", args), service.rpc("shopify_financial_summary", args),
    service.rpc("shopify_stock_summary", { target_organization_id: organizationId, target_store_id: storeId, low_stock_threshold: 5 }),
    service.rpc("shopify_funnel_summary", args),
    service.rpc("meta_spend_summary", { ...args, period_start: window.start.slice(0, 10), period_end: window.end.slice(0, 10) }),
    service.from("integration_connections").select("id, provider, status, last_sync_at, last_error_at, shopify_stores(id)").eq("organization_id", organizationId),
    resolveShopifyFinancialCurrencyCoverage(service, organizationId, storeId),
  ]);
  const row = (r: { data: unknown; error: unknown }): Row => !r.error && Array.isArray(r.data) ? (r.data[0] ?? {}) : {};
  const s = row(sales), f = row(financial), st = row(stock), fu = row(funnel), m = row(meta);
  // Meta is mapped to stores through accounts, not through shopify_stores.
  let metaConnectionIds: string[] | null = null;
  if (storeId) {
    const accounts = await service.from("meta_ad_accounts").select("connection_id").eq("organization_id", organizationId).eq("store_id", storeId);
    metaConnectionIds = accounts.error ? [] : (accounts.data ?? []).map((a) => a.connection_id);
  }
  const all = (connections.data ?? []) as Array<Record<string, unknown>>;
  // Connection identity is required for the store-specific Meta filter.
  const metaConnections = storeId && metaConnectionIds?.length
    ? await service.from("integration_connections").select("provider, status, last_sync_at, last_error_at").eq("organization_id", organizationId).in("id", metaConnectionIds)
    : { data: storeId ? [] : all.filter((c) => c.provider === "meta_ads"), error: connections.error };
  const fresh = (items: Row[]) => !connections.error && items.length > 0 && items.every((c) => {
    const at = Date.parse(String(c.last_sync_at));
    return ["connected", "syncing"].includes(String(c.status)) && Number.isFinite(at) && at <= Date.parse(window.end)
      && Date.parse(window.end) - at <= 48 * 3_600_000 && (!c.last_error_at || Date.parse(String(c.last_error_at)) <= at);
  });
  const shopify = all.filter((c) => c.provider === "shopify" && (!storeId || (c.shopify_stores as Array<{ id: string }> | null)?.some((store) => store.id === storeId)));
  const shopifyFresh = fresh(shopify);
  const financialReady = currency.status === "compatible" && f.has_settings === true && number(f.items_without_cost) === 0 && (number(f.orders_count) ?? 0) > 0;
  const values: Record<string, number | null> = {
    net_revenue_ex_tax: number(f.net_revenue_ex_tax), net_sales: number(s.net_sales), orders_count: number(s.orders_count),
    aov: number(s.aov), aov_ex_tax: number(f.aov_ex_tax),
    net_profit: financialReady ? number(f.net_profit) : null, net_margin_pct: financialReady ? number(f.net_margin_pct) : null,
    cac_blended: financialReady ? number(f.cac_blended) : null,
    conversion_rate: (number(fu.sessions) ?? 0) > 0 && number(s.orders_count) !== null ? number(s.orders_count)! / number(fu.sessions)! * 100 : null,
    out_of_stock_items: (number(st.tracked_items) ?? 0) > 0 ? number(st.out_of_stock_items) : null,
    roas: !metaConnections.error && fresh(metaConnections.data as Row[]) && (number(m.days_with_data) ?? 0) >= 5 ? number(m.roas) : null,
  };
  for (const key of Object.keys(values)) if (key !== "roas" && !shopifyFresh) values[key] = null;
  if (currency.status !== "compatible") for (const key of ["net_revenue_ex_tax", "aov_ex_tax", "net_sales", "aov"]) values[key] = null;
  const lastSync = shopify.map((c) => String(c.last_sync_at)).sort()[0] ?? null;
  const metaLastSync = (metaConnections.data as Row[]).map((c) => String(c.last_sync_at)).sort()[0] ?? null;
  return { values, period_start: window.start, period_end: window.end, period_label: window.label, calculated_at: new Date().toISOString(), last_sync_at: lastSync, meta_last_sync_at: metaLastSync };
}
