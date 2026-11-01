import assert from "node:assert/strict";
import test from "node:test";
import { objectiveWindow, objectiveProgress, readCaminoObjectives } from "./camino-measurement.js";
import type { SupabaseClient } from "@supabase/supabase-js";

test("periodos naturales, bisiesto y objetivos anteriores explícitos", () => {
  const now = new Date("2028-02-29T12:00:00Z");
  assert.equal(objectiveWindow("monthly", "calendar", now).start, "2028-02-01T00:00:00.000Z");
  assert.equal(objectiveWindow("quarterly", "calendar", now).start, "2028-01-01T00:00:00.000Z");
  assert.equal(objectiveWindow("yearly", "calendar", now).start, "2028-01-01T00:00:00.000Z");
  assert.match(objectiveWindow("yearly", null, now).label, /30 días/);
  assert.equal(objectiveWindow("quarterly", "calendar", new Date("2026-12-31T12:00:00Z")).start, "2026-10-01T00:00:00.000Z");
});

test("la lectura usa fechas reales, ratios ponderados y falla cerrada por fuente", async () => {
  const now = new Date(), window = objectiveWindow("quarterly", "calendar", now);
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let metaFails = false;
  const service = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      const rows: Record<string, unknown> = {
        shopify_sales_summary: { orders_count: 20, net_sales: 1200, aov: 60 },
        shopify_financial_summary: { has_settings: true, items_without_cost: 0, orders_count: 20, net_profit: 120, net_margin_pct: 10, net_revenue_ex_tax: 1000, aov_ex_tax: 50 },
        shopify_funnel_summary: { sessions: 1000 }, shopify_stock_summary: { tracked_items: 10, out_of_stock_items: 0 },
        meta_spend_summary: { roas: 3, days_with_data: 7 },
      };
      return { data: [rows[name]], error: metaFails && name === "meta_spend_summary" ? { message: "provider unavailable" } : null };
    },
    from: (table: string) => {
      const rows: Record<string, unknown[]> = {
        shopify_stores: [{ id: "s", currency_code: "EUR" }], organization_financial_settings: [{ currency_code: "EUR" }],
        integration_connections: ["shopify", "meta_ads"].map((provider) => ({ provider, last_sync_at: now.toISOString(), status: "connected" })),
      };
      const query = { select: () => query, eq: () => query, in: () => query, range: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null, count: (rows[table] ?? []).length }).then(resolve) };
      return query;
    },
  } as unknown as SupabaseClient;
  const result = await readCaminoObjectives(service, "org", null, window);
  assert.equal(result.values.conversion_rate, 2);
  assert.equal(result.values.net_margin_pct, 10);
  assert.equal(result.values.roas, 3);
  assert.equal(calls.find((c) => c.name === "shopify_financial_summary")?.args.period_start, window.start);
  metaFails = true;
  const failed = await readCaminoObjectives(service, "org", null, window);
  assert.equal(failed.values.roas, null);
  assert.equal(failed.values.orders_count, 20);
});
test("el estado de logro no depende de que exista un cociente válido", () => {
  assert.deepEqual(objectiveProgress(-10, -20, "up"), { reached: true, pct: 100 });
  assert.deepEqual(objectiveProgress(0, 0, "down"), { reached: true, pct: 100 });
  assert.deepEqual(objectiveProgress(2, 0, "down"), { reached: false, pct: null });
  assert.deepEqual(objectiveProgress(null, 10, "up"), { reached: false, pct: null });
});
