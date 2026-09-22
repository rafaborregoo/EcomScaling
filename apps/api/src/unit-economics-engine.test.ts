import assert from "node:assert/strict";
import test from "node:test";
import {
  applyUnitEconomicsEvidence,
  buildUnitEconomicsPlaybookContext,
} from "./unit-economics-engine.js";

test("P06 separa waterfall observado de contribution, CAC, payback y cash", () => {
  const context = buildUnitEconomicsPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyUnitEconomicsEvidence(context, {
    sales: { gross_sales: 500, discounts: 20, refunds: 10, net_sales: 470, orders_count: 10 },
    margin: { items_with_cost: 8, items_without_cost: 2, gross_margin: 180 },
    financial: { net_sales: 470, orders_count: 10, cogs: 290, payment_fees: 14, shipping_costs: 30, fixed_costs: 50, net_profit: 66 },
  });
  assert.equal(enriched.facts?.["unit_economics.revenue.net_observed"], "TRUE");
  assert.equal(enriched.facts?.["unit_economics.costs.cogs_observed"], "TRUE");
  assert.equal(enriched.facts?.["unit_economics.financial_summary.available"], "TRUE");
  assert.equal(enriched.facts?.["unit_economics.contribution.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["unit_economics.acquisition.cac_observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["unit_economics.payback.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["unit_economics.cash.observed"], "UNKNOWN");
});

// La v2 de `shopify_financial_summary` anade contribution y CAC mezclado. El
// motor recibia esas columnas y las fijaba a UNKNOWN a mano. Este test falla si
// vuelven a ignorarse; el de arriba sigue cubriendo que sin ellas no se
// inventan a partir de net_profit.
test("P06 observa contribution y CAC cuando el resumen financiero los trae", () => {
  const context = buildUnitEconomicsPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyUnitEconomicsEvidence(context, {
    financial: { net_profit: 66, contribution_per_order: 18.4, cac_blended: 11.2 },
  });
  assert.equal(enriched.facts?.["unit_economics.contribution.observed"], "TRUE");
  assert.equal(enriched.facts?.["unit_economics.acquisition.cac_observed"], "TRUE");
  // Payback no sale de aqui: el umbral de breakeven no es el periodo de
  // recuperacion, y fingir que si es el error que este fact existe para evitar.
  assert.equal(enriched.facts?.["unit_economics.payback.observed"], "UNKNOWN");
});

test("P06 conserva UNKNOWN cuando faltan costes comparables y segmentacion", () => {
  const context = buildUnitEconomicsPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyUnitEconomicsEvidence(context, { sales: null, margin: null, financial: null });
  assert.equal(enriched.facts?.["unit_economics.revenue.net_observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["unit_economics.costs.cogs_observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["unit_economics.segmented.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["unit_economics.scenarios.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["unit_economics.data_quality.comparable"], "UNKNOWN");
});
