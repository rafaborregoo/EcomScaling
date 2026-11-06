import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAgentTools } from "./ai-runtime.js";

const org = "10000000-0000-4000-8000-000000000001";
const store = "20000000-0000-4000-8000-000000000001";
function harness({ missingCoverage = false, estimatedCost = false, failAll = false } = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const financial = { orders_count: 1, net_sales: 120, net_revenue_ex_tax: 100, cogs: 50, payment_fees: 5, shipping_costs: 5, fixed_costs: 10, ads_spend: 10, net_profit: 20, has_settings: true, fixed_expenses_count: 1, items_without_cost: 0 };
  const client = {
    from: () => ({ insert: async () => ({ error: null }) }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (failAll || missingCoverage && name === "shopify_financial_coverage") return { data: null, error: { message: "source unavailable" } };
      if (name === "shopify_financial_summary") return { data: [financial], error: null };
      if (name === "shopify_margin_summary") return { data: [{ revenue: 100, cogs: 50, gross_margin: 50, margin_pct: 50 }], error: null };
      const connection = { status: "connected", last_sync_at: new Date(Date.now() - 1000).toISOString(), last_error_at: null };
      if (name === "shopify_financial_coverage") return { data: {
        model_totals: financial,
        version: "financial-coverage-v1", organization_id: org, store_id: store, period_start: args.period_start, period_end: args.period_end,
        currency_code: "EUR", currencies: [{ source: "orders", code: "EUR" }],
        store_count: 1, orders_count: 1, orders_without_verified_totals: 0, orders_with_inconsistent_totals: 0, orders_without_lines: 0, orders_pending_refund_snapshot: 0,
        line_count: 1, items_with_cost: 1, items_without_cost: 0, items_with_estimated_cost: estimatedCost ? 1 : 0,
        lines_with_exact_metrics: 1, lines_with_estimated_metrics: 0, lines_without_metrics: 0, lines_with_invalid_values: 0,
        shopify_connection: connection, ads_connections: [], revenue_by_currency: [],
      }, error: null };
      return { data: [], error: null };
    },
  } as unknown as SupabaseClient;
  const build = (storeId: string | null = store) => buildAgentTools({} as never, client, org, org, ["shopify_margin_health"], "", storeId, ["shopify"], ["client_visible"], { actorUserId: org, approvalMode: "required_before_publish" }).tools.find((tool) => tool.name === "shopify_margin_health")!;
  return { calls, build };
}

type ToolResult = { data: { financial_comparability: { status: string; can_use_financial_model: boolean }; financial: { net_profit: number | null } | null; margen: { gross_margin: number | null; margin_pct: number | null } } };

test("A09 uses the canonical economic gate and the same completed UTC period for every source", async () => {
  const { calls, build } = harness();
  const output = await build().execute({}) as ToolResult;
  assert.equal(output.data.financial_comparability.status, "comparable");
  assert.equal(output.data.financial?.net_profit, 20);
  assert.equal(output.data.margen.gross_margin, 50);
  assert.equal(calls.length, 5);
  const first = calls[0]!.args;
  assert.ok(String(first.period_start).endsWith("T00:00:00.000Z"));
  assert.ok(String(first.period_end).endsWith("T23:59:59.999Z"));
  for (const call of calls) {
    assert.equal(call.args.target_organization_id, org);
    assert.equal(call.args.target_store_id, store);
    assert.equal(call.args.period_start, first.period_start);
    assert.equal(call.args.period_end, first.period_end);
  }
});

test("A09 masks profit and margin when cost history or source coverage is not verified", async () => {
  for (const options of [{ missingCoverage: true }, { estimatedCost: true }]) {
    const output = await harness(options).build().execute({}) as ToolResult;
    assert.equal(output.data.financial_comparability.can_use_financial_model, false);
    assert.equal(output.data.financial_comparability.status, options.missingCoverage ? "unknown" : "estimated");
    assert.ok(output.data.financial === null || output.data.financial.net_profit === null);
    assert.equal(output.data.margen.gross_margin, null);
    assert.equal(output.data.margen.margin_pct, null);
  }
});

test("A09 rejects an absent store before any read and retains full-source errors", async () => {
  const missing = harness();
  assert.match(JSON.stringify(await missing.build(null).execute({})), /shopify_margin_health_unavailable/);
  assert.equal(missing.calls.length, 0);
  assert.match(JSON.stringify(await harness({ failAll: true }).build().execute({})), /shopify_margin_health_unavailable/);
});
