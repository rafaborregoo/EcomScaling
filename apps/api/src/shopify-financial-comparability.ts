import type { SupabaseClient } from "@supabase/supabase-js";
import { providerCurrencyCode } from "./provider-currency.js";

type Row = Record<string, unknown>;
export type FinancialComparabilityStatus = "comparable" | "estimated" | "incomplete" | "incompatible" | "unknown" | "not_assessable";
const DAY_MS = 86_400_000;
const MAX_SOURCE_AGE_MS = 48 * 60 * 60 * 1000;
const countKeys = ["store_count", "orders_count", "orders_without_verified_totals", "orders_with_inconsistent_totals", "orders_without_lines", "orders_pending_refund_snapshot", "line_count", "items_with_cost", "items_without_cost", "items_with_estimated_cost", "lines_with_exact_metrics", "lines_with_estimated_metrics", "lines_without_metrics", "lines_with_invalid_values"] as const;
const moneyKeys = ["net_sales", "net_revenue_ex_tax", "net_profit", "cogs", "payment_fees", "shipping_costs", "fixed_costs", "ads_spend"] as const;
const derivedMoneyKeys = ["net_profit", "net_margin_pct", "gross_margin", "margin_pct", "break_even_monthly_revenue", "breakeven_roas", "breakeven_cac_per_order", "mbee", "contribution_per_order", "cac_blended", "cac_per_order"];

export function financialUtcWindows(now: Date, days: number) {
  if (!Number.isFinite(now.getTime()) || !Number.isSafeInteger(days) || days < 1) throw new Error("invalid_financial_window");
  const endExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(endExclusive.getTime() - days * DAY_MS);
  return { start, end: new Date(endExclusive.getTime() - 1), previousStart: new Date(start.getTime() - days * DAY_MS), previousEnd: new Date(start.getTime() - 1), endExclusive };
}

const isRow = (value: unknown): value is Row => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function assessShopifyFinancialComparability(input: {
  organizationId: string; storeId: string | null; start: Date; end: Date;
  financial: Row | null; coverage: Row | null; queryFailed?: boolean; now?: Date;
}) {
  const now = input.now ?? new Date();
  const { financial, coverage } = input;
  const reasons: string[] = [];
  let status: FinancialComparabilityStatus = "comparable";
  const add = (reason: string, state: FinancialComparabilityStatus) => {
    reasons.push(reason);
    const rank = { comparable: 0, not_assessable: 1, estimated: 2, incomplete: 3, unknown: 4, incompatible: 5 };
    if (rank[state] > rank[status]) status = state;
  };
  const validWindow = [input.start, input.end, now].every((date) => Number.isFinite(date.getTime())) && input.start <= input.end;
  const currency = providerCurrencyCode(coverage?.currency_code, null, "");
  let sameSourceView = false;
  if (!input.storeId) add("store_scope_required", "unknown");
  if (!validWindow) add("invalid_financial_window", "unknown");
  if (input.queryFailed || !financial || !coverage) add("financial_sources_unavailable", "unknown");
  if (financial && coverage && validWindow) {
    if (coverage.version !== "financial-coverage-v1" || coverage.organization_id !== input.organizationId || coverage.store_id !== input.storeId ||
      typeof coverage.period_start !== "string" || Date.parse(coverage.period_start) !== input.start.getTime() ||
      typeof coverage.period_end !== "string" || Date.parse(coverage.period_end) !== input.end.getTime()) add("financial_scope_or_window_mismatch", "unknown");
    if (!countKeys.every((key) => isCount(coverage[key])) || !isCount(financial.orders_count) || !isCount(financial.fixed_expenses_count) ||
      !isCount(financial.items_without_cost) || !moneyKeys.every((key) => typeof financial[key] === "number" && Number.isFinite(financial[key]))) add("financial_values_unverified", "unknown");
    const model = coverage.model_totals;
    sameSourceView = isRow(model) && [...moneyKeys,"orders_count","fixed_expenses_count","items_without_cost","has_settings"].every((key) => model[key] === financial[key]);
    if (!sameSourceView) add("financial_source_views_differ", "unknown");
    const connectionFresh = (connection: unknown) => {
      if (!isRow(connection) || connection.status !== "connected" || typeof connection.last_sync_at !== "string") return false;
      const syncedAt = Date.parse(connection.last_sync_at);
      const errorAt = connection.last_error_at === null ? null : typeof connection.last_error_at === "string" ? Date.parse(connection.last_error_at) : NaN;
      return Number.isFinite(syncedAt) && syncedAt <= now.getTime() && now.getTime() - syncedAt <= MAX_SOURCE_AGE_MS &&
        (errorAt === null || Number.isFinite(errorAt) && errorAt <= syncedAt);
    };
    if (!connectionFresh(coverage.shopify_connection)) add("shopify_source_stale_or_unavailable", "unknown");
    if (!Array.isArray(coverage.ads_connections) || !coverage.ads_connections.every(connectionFresh)) add("ads_source_stale_or_unavailable", "unknown");
    if (!currency || !Array.isArray(coverage.currencies) || !coverage.currencies.length) add("financial_currency_unknown", "unknown");
    else for (const row of coverage.currencies) {
      const code = isRow(row) ? providerCurrencyCode(row.code, null, "") : null;
      if (!code) add("financial_currency_unknown", "unknown");
      else if (code !== currency) add("financial_currency_mismatch", "incompatible");
    }
    if (countKeys.every((key) => isCount(coverage[key]))) {
      if (!coverage.store_count || financial.orders_count !== coverage.orders_count ||
        Number(coverage.items_with_cost) + Number(coverage.items_without_cost) !== coverage.line_count ||
        Number(coverage.lines_with_exact_metrics) + Number(coverage.lines_with_estimated_metrics) + Number(coverage.lines_without_metrics) !== coverage.line_count ||
        Number(coverage.items_with_estimated_cost) > Number(coverage.items_with_cost)) add("financial_coverage_inconsistent", "unknown");
      if (!coverage.orders_count || Number(financial.net_revenue_ex_tax) <= 0) add("no_positive_revenue_denominator", "not_assessable");
      if (Number(coverage.orders_without_verified_totals) > 0) add("order_totals_basis_unverified", "incomplete");
      if (Number(coverage.orders_with_inconsistent_totals) > 0) add("order_totals_not_reconciled", "incomplete");
      if (Number(coverage.orders_without_lines) > 0 || Number(coverage.lines_without_metrics) > 0) add("order_line_metrics_missing", "incomplete");
      if (Number(coverage.orders_pending_refund_snapshot) > 0) add("refund_snapshot_pending", "incomplete");
      if (Number(coverage.items_without_cost) > 0 || Number(financial.items_without_cost) > 0) add("product_costs_missing", "incomplete");
      if (Number(coverage.lines_with_invalid_values) > 0) add("invalid_order_line_values", "unknown");
      if (Number(coverage.items_with_estimated_cost) > 0) add("current_cost_used_for_historical_order", "estimated");
      if (Number(coverage.lines_with_estimated_metrics) > 0) add("order_line_metrics_estimated", "estimated");
      if (Number(coverage.store_count) > 1 && Number(financial.fixed_expenses_count) > 0) add("organization_fixed_costs_unallocated_between_stores", "incomplete");
    }
    if (financial.has_settings !== true) add("financial_settings_missing", "incomplete");
    if (moneyKeys.every((key) => typeof financial[key] === "number" && Number.isFinite(financial[key]))) {
      const expected = Number(financial.net_revenue_ex_tax) - Number(financial.cogs) - Number(financial.payment_fees) - Number(financial.shipping_costs) - Number(financial.fixed_costs) - Number(financial.ads_spend);
      // Independently rounded components can differ from the rounded SQL total by up to three cents.
      if (Math.abs(expected - Number(financial.net_profit)) > 0.030001) add("financial_profit_reconciliation_failed", "unknown");
    }
    if (input.start.getTime() % DAY_MS !== 0 || (input.end.getTime() + 1) % DAY_MS !== 0) add("partial_utc_days_not_comparable_to_daily_ads", "estimated");
  }
  return {
    version: "financial-comparability-v1", status: status as FinancialComparabilityStatus,
    reason_codes: [...new Set(reasons)], can_use_financial_model: status === "comparable",
    currency_code: reasons.includes("financial_scope_or_window_mismatch") ? null : currency,
    currency_status: reasons.includes("financial_scope_or_window_mismatch") ? "unknown" as const : reasons.includes("financial_currency_mismatch") ? "incompatible" as const : !currency || reasons.includes("financial_currency_unknown") ? "unknown" as const : "compatible" as const,
    scope: { organization_id: input.organizationId, store_id: input.storeId },
    window: { start: validWindow ? input.start.toISOString() : null, end: validWindow ? input.end.toISOString() : null, timezone: "UTC" },
    coverage: coverage && sameSourceView && !reasons.includes("financial_scope_or_window_mismatch") ? Object.fromEntries(countKeys.map((key) => [key, isCount(coverage[key]) ? coverage[key] : null])) : null,
    revenue_by_currency: sameSourceView && !reasons.includes("financial_scope_or_window_mismatch") && Array.isArray(coverage?.revenue_by_currency) ? coverage.revenue_by_currency : [],
    limitations: ["Modelo configurado: comisiones y envíos no equivalen a un libro contable conciliado.", "El gasto publicitario canónico incluye Meta; no acredita gasto total en otros proveedores.", "Sin conversión de divisas. Comparar ROAS atribuido exige además un veredicto A24 vigente.", "El histórico usa el estado actual de los pedidos reconciliados, no un cierre contable inmutable."],
  };
}

export type ShopifyFinancialComparability = ReturnType<typeof assessShopifyFinancialComparability>;

export async function loadShopifyFinancialEvidence(client: SupabaseClient, organizationId: string, storeId: string | null, start: Date, end: Date) {
  const valid = storeId && [start, end].every((date) => Number.isFinite(date.getTime())) && start <= end;
  const args = valid ? { target_organization_id: organizationId, target_store_id: storeId, period_start: start.toISOString(), period_end: end.toISOString() } : null;
  const coverage = args ? await client.rpc("shopify_financial_coverage", args) : { data: null, error: null };
  const row = isRow(coverage.data) && isRow(coverage.data.model_totals) ? coverage.data.model_totals : null;
  const comparability = assessShopifyFinancialComparability({ organizationId, storeId, start, end, financial: row, coverage: isRow(coverage.data) ? coverage.data : null, queryFailed: Boolean(coverage.error) });
  const financial = { data: row && !comparability.reason_codes.includes("financial_scope_or_window_mismatch") ? [row] : null, error: coverage.error };
  return { financial, comparability };
}

export function financialSummaryForAgent(row: unknown, comparability: ShopifyFinancialComparability) {
  if (!isRow(row)) return null;
  if (comparability.reason_codes.includes("financial_scope_or_window_mismatch") || comparability.reason_codes.includes("financial_source_views_differ")) return null;
  return comparability.can_use_financial_model ? row : { ...row, ...Object.fromEntries(derivedMoneyKeys.map((key) => [key, null])) };
}
