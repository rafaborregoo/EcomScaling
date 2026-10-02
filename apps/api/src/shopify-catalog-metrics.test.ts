import assert from "node:assert/strict";
import test from "node:test";
import { fillWeekly, productMetricsView, weekStarts } from "./shopify-catalog.js";

const baseRow = {
  product_id: "p1",
  units_ordered: 10,
  units_refunded: 2,
  orders_count: 8,
  last_order_at: null,
  stock_available: 4,
  tracked_variants: 2,
  variants_total: 2,
  variants_out: 0,
  variants_low: 1,
  variants_without_cost: 0,
  price_min: 10,
  price_max: 12,
  order_lines: 8,
  lines_missing_cost: 0,
  lines_missing_net: 0,
  net_revenue: 100,
  cogs: 40,
};

test("las semanas van de la mas antigua a la actual y empiezan en lunes", () => {
  // miercoles 1 oct 2026 -> la semana actual empieza el lunes 28 sep
  const weeks = weekStarts(new Date("2026-10-01T10:00:00Z"), 3);
  assert.deepEqual(weeks, ["2026-09-14", "2026-09-21", "2026-09-28"]);
});

test("las semanas sin ventas salen con cero, no desaparecen", () => {
  const filled = fillWeekly(
    [{ product_id: "p1", week_start: "2026-09-21", units_ordered: 5, units_refunded: 1 }],
    new Date("2026-10-01T10:00:00Z"),
    3,
  );
  assert.deepEqual(filled.map((w) => w.units_ordered), [0, 5, 0]);
  assert.deepEqual(filled.map((w) => w.units_refunded), [0, 1, 0]);
});

test("el margen solo se da con todas las lineas con coste e importe neto", () => {
  assert.equal(productMetricsView(baseRow).margin_pct, 0.6);
  assert.equal(productMetricsView({ ...baseRow, lines_missing_cost: 1 }).margin_pct, null);
  assert.equal(productMetricsView({ ...baseRow, lines_missing_net: 2 }).margin_pct, null);
  assert.equal(productMetricsView({ ...baseRow, order_lines: 0, net_revenue: null }).margin_pct, null);
});

test("la tasa de devolucion es null sin ventas, no 0", () => {
  assert.equal(productMetricsView({ ...baseRow, units_ordered: 0, units_refunded: 0 }).return_rate, null);
  assert.equal(productMetricsView(baseRow).return_rate, 0.2);
});
