import assert from "node:assert/strict";
import { test } from "node:test";
import { scalingEconomics } from "./camino-scaling.js";

const financial = {
  net_revenue_ex_tax: "280583.60", cogs: "112821.60", payment_fees: "5208.67", shipping_costs: "43537.00", orders_count: "5122",
  ads_spend: "22967.06", breakeven_roas: "4.81", breakeven_cac_per_order: "11.38", aov_ex_tax: "54.78", net_margin_pct: "12.59",
  contribution_per_order: "19.77", new_customers: "1", has_settings: true, items_without_cost: "0",
};

test("break-even variable, MER y lectura de escalado con los datos reales de la tienda de prueba", () => {
  const result = scalingEconomics(financial, { roas: "8.0801" }, { items_with_cost: "5122", items_without_cost: "0", items_with_estimated_cost: "5122", margin_pct: "59.79" });
  assert.equal(result.breakeven_roas_variable, 2.36);
  assert.equal(result.mer, 12.22);
  assert.equal(result.breakeven_roas_total, 4.81);
  assert.equal(result.cac_per_order_paid, 4.48);
  assert.equal(result.free_shipping_threshold_hint, 70);
  assert.ok(result.reading[0]?.includes("margen para aumentar la inversión"));
  assert.ok(result.quality_flags.some((flag) => flag.includes("coste de producto estimado")));
  assert.ok(result.quality_flags.some((flag) => flag.includes("1 clientes nuevos")));
});

test("sin ventas no se razona la inversion", () => {
  assert.equal(scalingEconomics(null, null, null).status, "insufficient");
});
