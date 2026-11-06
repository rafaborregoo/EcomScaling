import assert from "node:assert/strict";
import test from "node:test";
import { costCoverage, dataConfidence, monthFinancial, staleIntegrations } from "./camino-economics.js";

const row = { orders_count: 40, net_revenue_ex_tax: 9000, net_profit: 900, net_margin_pct: 10, has_settings: true, items_without_cost: 0, cogs: 4000, payment_fees: 100, shipping_costs: 300, fixed_costs: 500, fixed_expenses_count: 2, ads_spend: 800 };

test("un mes sin costes completos no da margen, pero sí ventas", () => {
  const complete = monthFinancial({ month: "2026-10", row }, true, "2026-11");
  assert.equal(complete.margin_pct, 10);
  assert.equal(complete.in_progress, false);
  const incomplete = monthFinancial({ month: "2026-11", row: { ...row, items_without_cost: 3 } }, true, "2026-11");
  assert.equal(incomplete.margin_pct, null);
  assert.equal(incomplete.revenue, 9000);
  assert.equal(incomplete.in_progress, true);
  assert.equal(monthFinancial({ month: "2026-11", row }, false, "2026-11").revenue, null);
  assert.equal(monthFinancial({ month: "2026-09", row: null }, true, "2026-11").margin_pct, null);
});

test("los costes que faltan se nombran y hacen el margen parcial", () => {
  assert.ok(costCoverage(row).every((item) => item.included));
  const partial = costCoverage({ ...row, items_without_cost: 2, fixed_expenses_count: 0, ads_spend: 0 });
  assert.deepEqual(partial.filter((item) => !item.included).map((item) => item.key), ["cogs", "fixed", "ads"]);
  assert.equal(partial[0]!.note, "2 artículos vendidos sin coste");
});

const solid = { historyMonths: 24, coversSeason: true, seasonLabel: "noviembre", missingCosts: [], adsMeasured: true, disconnected: [] };

test("la confianza sale de condiciones observables, no de la opinión del modelo", () => {
  assert.equal(dataConfidence(solid).level, "high");
  assert.equal(dataConfidence({ ...solid, coversSeason: false }).level, "medium");
  assert.equal(dataConfidence({ ...solid, coversSeason: false, adsMeasured: false, disconnected: ["Klaviyo"] }).level, "low");
  const empty = dataConfidence({ ...solid, historyMonths: null });
  assert.equal(empty.level, "low");
  assert.equal(empty.signals[0]!.detail, "Sin pedidos registrados");
});

test("una integración cuenta si está conectada y sincronizó en 48 h", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const fresh = "2026-11-05T01:00:00Z";
  assert.deepEqual(
    staleIntegrations(
      [
        { provider: "shopify", status: "connected", last_sync_at: fresh },
        { provider: "meta_ads", status: "connected", last_sync_at: "2026-11-01T00:00:00Z" },
      ],
      now,
    ),
    ["Meta Ads", "Klaviyo"],
  );
});
