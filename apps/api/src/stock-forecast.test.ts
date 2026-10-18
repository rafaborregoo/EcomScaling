import assert from "node:assert/strict";
import test from "node:test";
import { selectStockForecast } from "./stock-forecast.js";
import { enrichStockRiskEvidence } from "./stock-risk-evidence.js";

const now = Date.parse("2026-09-01T00:00:00.000Z");
const fresh = "2026-08-31T20:00:00.000Z";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (n: number, sold: number, days: number, available: number | null, extra: Record<string, unknown> = {}) => ({
  product_id: id(n), title: `P${n}`, quantity_sold_period: sold, selling_days: days, available_quantity: available,
  inventory_status: "tracked_current", latest_inventory_sync_at: fresh, ...extra,
});
const run = (rows: unknown[], active = rows.map((_r, i) => id(i + 1))) =>
  selectStockForecast(enrichStockRiskEvidence(rows, { periodStart: "2026-08-02T00:00:00.000Z", periodEnd: "2026-09-01T00:00:00.000Z", now }), new Set(active));

test("solo sale lo que se vende y se agota dentro del horizonte", () => {
  const items = run([
    row(1, 30, 12, 0), // agotado con demanda
    row(2, 30, 12, 10), // 10 días de cobertura
    row(3, 30, 12, 500), // repuesto: cobertura de sobra
    row(4, 2, 1, 0), // agotado pero apenas se vende: no hace falta
    row(5, 30, 12, 0, { inventory_status: "inventory_not_synced", available_quantity: null }), // stock desconocido
    row(6, 30, 12, 0, { latest_inventory_sync_at: "2026-08-20T00:00:00.000Z" }), // sincronización vieja
  ]);
  assert.deepEqual(items.map((i) => [i.title, i.status]), [["P1", "out"], ["P2", "soon"]]);
});

test("los productos no activos (archivados, borrador) no salen", () => {
  assert.equal(run([row(1, 30, 12, 0)], []).length, 0);
});

test("orden: agotados por venta, luego por días de cobertura", () => {
  const items = run([row(1, 15, 6, 0), row(2, 60, 20, 0), row(3, 30, 12, 12), row(4, 30, 12, 3)]);
  assert.deepEqual(items.map((i) => i.title), ["P2", "P1", "P4", "P3"]);
});
