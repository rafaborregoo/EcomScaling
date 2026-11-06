import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assessShopifyFinancialComparability, financialSummaryForAgent, financialUtcWindows, loadShopifyFinancialEvidence } from "./shopify-financial-comparability.js";

const now = new Date("2026-11-02T12:00:00.000Z");
const window = financialUtcWindows(now, 30);
function fixture() {
  const connection = { status: "connected", last_sync_at: "2026-11-02T11:00:00Z", last_error_at: null };
  const financial = { orders_count: 1, net_sales: 120, net_revenue_ex_tax: 100, cogs: 50, payment_fees: 5, shipping_costs: 5, fixed_costs: 10, ads_spend: 10, net_profit: 20, has_settings: true, fixed_expenses_count: 1, items_without_cost: 0 };
  return {
    organizationId: "org-a", storeId: "store-a", start: window.start, end: window.end, now,
    financial,
    coverage: {
      version: "financial-coverage-v1", organization_id: "org-a", store_id: "store-a", period_start: window.start.toISOString(), period_end: window.end.toISOString(),
      model_totals: { ...financial },
      currency_code: "EUR", currencies: [{ source: "orders", code: "EUR" }, { source: "product_costs", code: "EUR" }],
      store_count: 1, orders_count: 1, orders_without_verified_totals: 0, orders_with_inconsistent_totals: 0, orders_without_lines: 0, orders_pending_refund_snapshot: 0,
      line_count: 1, items_with_cost: 1, items_without_cost: 0, items_with_estimated_cost: 0,
      lines_with_exact_metrics: 1, lines_with_estimated_metrics: 0, lines_without_metrics: 0, lines_with_invalid_values: 0,
      shopify_connection: connection, ads_connections: [connection], revenue_by_currency: [{ currency_code: "EUR", lines: 1, line_revenue: 100, revenue_without_cost: 0, revenue_with_estimated_cost: 0 }],
    },
  };
}

test("financial windows include every millisecond of completed UTC days without overlap", () => {
  assert.equal(window.end.toISOString(), "2026-11-01T23:59:59.999Z");
  assert.equal(window.start.getTime() - window.previousStart.getTime(), 30 * 86_400_000);
  assert.equal(window.previousEnd.getTime() + 1, window.start.getTime());
  assert.equal(window.end.getTime() + 1, window.endExclusive.getTime());
  assert.equal(window.end.getTime() - window.start.getTime() + 1, 30 * 86_400_000);
  assert.deepEqual(financialUtcWindows(new Date("2026-11-01T23:15:00-05:00"), 30), window);
  assert.throws(() => financialUtcWindows(new Date("invalid"), 30));
  assert.throws(() => financialUtcWindows(now, 0));
});

test("verified, scoped and reconciled inputs allow the configured financial model", () => {
  const result = assessShopifyFinancialComparability(fixture());
  assert.equal(result.status, "comparable");
  assert.equal(result.can_use_financial_model, true);
  assert.deepEqual(result.reason_codes, []);
  assert.equal(result.currency_code, "EUR");
  assert.equal(result.coverage?.line_count, 1);
  assert.deepEqual(result.revenue_by_currency, fixture().coverage.revenue_by_currency);
});

test("missing, estimated and inconsistent financial inputs never become comparable", async (t) => {
  const cases = [
    ["unverified order totals", { orders_without_verified_totals: 1 }, "incomplete"],
    ["return/refund totals not reconciled", { orders_with_inconsistent_totals: 1 }, "incomplete"],
    ["order without lines", { orders_without_lines: 1 }, "incomplete"],
    ["pending refund snapshot", { orders_pending_refund_snapshot: 1 }, "incomplete"],
    ["missing unit cost", { items_with_cost: 0, items_without_cost: 1 }, "incomplete"],
    ["current Shopify cost used historically", { items_with_estimated_cost: 1 }, "estimated"],
    ["REST metric estimate", { lines_with_exact_metrics: 0, lines_with_estimated_metrics: 1 }, "estimated"],
    ["missing line metrics", { lines_with_exact_metrics: 0, lines_without_metrics: 1 }, "incomplete"],
    ["invalid quantity", { lines_with_invalid_values: 1 }, "unknown"],
    ["wrong denominator", { line_count: 2 }, "unknown"],
    ["unknown count", { line_count: undefined }, "unknown"],
    ["wrong tenant", { organization_id: "org-b" }, "unknown"],
    ["wrong store", { store_id: "store-b" }, "unknown"],
    ["wrong period", { period_end: window.endExclusive.toISOString() }, "unknown"],
    ["old evidence version", { version: "old" }, "unknown"],
    ["missing currency", { currency_code: null }, "unknown"],
    ["missing currency provenance", { currencies: [] }, "unknown"],
    ["unconverted cost currency", { currencies: [{ source: "product_costs", code: "USD" }] }, "incompatible"],
    ["unknown cost currency", { currencies: [{ source: "product_costs", code: null }] }, "unknown"],
  ] as const;
  for (const [name, patch, status] of cases) await t.test(name, () => {
    const input = fixture();
    const result = assessShopifyFinancialComparability({ ...input, coverage: { ...input.coverage, ...patch } });
    assert.equal(result.status, status);
    assert.equal(result.can_use_financial_model, false);
    assert.ok(result.reason_codes.length > 0);
  });
});

test("financial query errors, missing fields, shared expenses and false profit fail closed", () => {
  const base = fixture();
  for (const input of [
    { ...base, queryFailed: true }, { ...base, financial: null }, { ...base, coverage: null }, { ...base, storeId: null },
    { ...base, financial: { ...base.financial, fixed_costs: null } },
    { ...base, financial: { ...base.financial, items_without_cost: undefined } },
    { ...base, financial: { ...base.financial, net_profit: 100 } },
    { ...base, financial: { ...base.financial, net_profit: NaN } },
    { ...base, financial: { ...base.financial, has_settings: false } },
    { ...base, coverage: { ...base.coverage, store_count: 2 } },
  ]) assert.equal(assessShopifyFinancialComparability(input).can_use_financial_model, false);
  assert.equal(assessShopifyFinancialComparability({ ...base, financial: { ...base.financial, fixed_expenses_count: 0 }, coverage: { ...base.coverage, model_totals: { ...base.financial, fixed_expenses_count: 0 }, store_count: 2 } }).status, "comparable");
  assert.equal(assessShopifyFinancialComparability({ ...base, financial: { ...base.financial, net_profit: 20.03 }, coverage: { ...base.coverage, model_totals: { ...base.financial, net_profit: 20.03 } } }).status, "comparable");
  assert.equal(assessShopifyFinancialComparability({ ...base, financial: { ...base.financial, net_profit: 20.04 } }).status, "unknown");
});

test("source errors, future timestamps and new connection errors invalidate economic conclusions", () => {
  const base = fixture();
  for (const connection of [
    null, { ...base.coverage.shopify_connection, status: "error" },
    { ...base.coverage.shopify_connection, last_sync_at: "2026-10-29T00:00:00Z" },
    { ...base.coverage.shopify_connection, last_sync_at: "2026-11-03T00:00:00Z" },
    { ...base.coverage.shopify_connection, last_error_at: "2026-11-02T11:01:00Z" },
    { ...base.coverage.shopify_connection, last_error_at: "invalid" },
  ]) {
    assert.equal(assessShopifyFinancialComparability({ ...base, coverage: { ...base.coverage, shopify_connection: connection } }).status, "unknown");
    assert.equal(assessShopifyFinancialComparability({ ...base, coverage: { ...base.coverage, ads_connections: [connection] } }).status, "unknown");
  }
});

test("zero cost can be verified; zero revenue never creates a profitability denominator", () => {
  const base = fixture();
  assert.equal(assessShopifyFinancialComparability({ ...base, financial: { ...base.financial, cogs: 0, net_profit: 70 }, coverage: { ...base.coverage, model_totals: { ...base.financial, cogs: 0, net_profit: 70 } } }).status, "comparable");
  const empty = { ...base.financial, orders_count: 0, net_sales: 0, net_revenue_ex_tax: 0, cogs: 0, payment_fees: 0, shipping_costs: 0, fixed_costs: 0, ads_spend: 0, net_profit: 0 };
  assert.equal(assessShopifyFinancialComparability({ ...base, financial: empty, coverage: { ...base.coverage, model_totals: empty, orders_count: 0, line_count: 0, items_with_cost: 0, lines_with_exact_metrics: 0 } }).status, "not_assessable");
  assert.equal(assessShopifyFinancialComparability({ ...base, end: new Date("2026-11-01T12:00:00Z"), coverage: { ...base.coverage, period_end: "2026-11-01T12:00:00Z" } }).status, "estimated");
});

test("noncomparable data masks derived profit, CAC and break-even fields for agents", () => {
  const base = fixture();
  const good = assessShopifyFinancialComparability(base);
  assert.equal(financialSummaryForAgent(base.financial, good), base.financial);
  const bad = assessShopifyFinancialComparability({ ...base, queryFailed: true });
  const masked = financialSummaryForAgent({ ...base.financial, mbee: 20, breakeven_roas: 2 }, bad);
  assert.equal(masked?.net_profit, null);
  assert.equal(masked?.mbee, null);
  assert.equal(masked?.breakeven_roas, null);
  assert.equal(masked?.net_sales, 120);
});

test("different financial visibility or a foreign snapshot cannot leak a verified aggregate", () => {
  const base = fixture();
  const differentView = assessShopifyFinancialComparability({ ...base, coverage: { ...base.coverage, model_totals: { ...base.financial, cogs: 99 } } });
  assert.equal(differentView.status, "unknown");
  assert.equal(differentView.coverage, null);
  assert.deepEqual(differentView.revenue_by_currency, []);
  assert.equal(financialSummaryForAgent(base.financial, differentView), null);
  const foreign = assessShopifyFinancialComparability({ ...base, coverage: { ...base.coverage, organization_id: "org-b" } });
  assert.equal(foreign.currency_code, null);
  assert.equal(foreign.coverage, null);
  assert.deepEqual(foreign.revenue_by_currency, []);
  assert.equal(financialSummaryForAgent(base.financial, foreign), null);
});

test("the shared loader uses one canonical financial snapshot with the selected tenant, store and inclusive window", async () => {
  const input = fixture();
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = { rpc: async (name: string, args: unknown) => {
    calls.push({ name, args });
    return { data: input.coverage, error: null };
  } } as unknown as SupabaseClient;
  const result = await loadShopifyFinancialEvidence(client, input.organizationId, input.storeId, input.start, input.end);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.name, "shopify_financial_coverage");
  assert.deepEqual(calls[0]?.args, { target_organization_id: "org-a", target_store_id: "store-a", period_start: input.start.toISOString(), period_end: input.end.toISOString() });
  assert.equal(result.comparability.scope.store_id, "store-a");
  calls.length = 0;
  assert.equal((await loadShopifyFinancialEvidence(client, "org-a", null, input.start, input.end)).comparability.status, "unknown");
  assert.equal(calls.length, 0);
});
