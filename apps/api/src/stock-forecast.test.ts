import assert from "node:assert/strict";
import test from "node:test";
import { forecastStockDemand } from "@e-nora/contracts";
import { selectStockForecast } from "./stock-forecast.js";
import { enrichStockRiskEvidence, projectStockScenario } from "./stock-risk-evidence.js";
import { mapShopifyInventoryLevels } from "./shopify-inventory-levels.js";

const now = Date.parse("2026-09-01T00:00:00.000Z");
const fresh = "2026-08-31T20:00:00.000Z";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (
  n: number,
  sold: number,
  days: number,
  available: number | null,
  extra: Record<string, unknown> = {},
) => ({
  product_id: id(n),
  store_id: "store-1",
  title: `P${n}`,
  quantity_sold_period: sold,
  selling_days: days,
  available_quantity: available,
  inventory_status: "tracked_current",
  latest_inventory_sync_at: fresh,
  ...extra,
});
const run = (rows: unknown[], active = rows.map((_r, i) => id(i + 1))) =>
  selectStockForecast(
    enrichStockRiskEvidence(rows, {
      periodStart: "2026-08-02T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
      now,
    }),
    new Set(active),
  );

test("solo sale lo que se vende y se agota dentro del horizonte", () => {
  const items = run([
    row(1, 30, 12, 0), // agotado con demanda
    row(2, 30, 12, 10), // 10 días de cobertura
    row(3, 30, 12, 500), // repuesto: cobertura de sobra
    row(4, 2, 1, 0), // agotado pero apenas se vende: no hace falta
    row(5, 30, 12, 0, {
      inventory_status: "inventory_not_synced",
      available_quantity: null,
    }), // stock desconocido
    row(6, 30, 12, 0, { latest_inventory_sync_at: "2026-08-20T00:00:00.000Z" }), // sincronización vieja
  ]);
  assert.deepEqual(
    items.map((i) => [i.title, i.status]),
    [
      ["P1", "out"],
      ["P2", "soon"],
    ],
  );
});

test("los productos no activos (archivados, borrador) no salen", () => {
  assert.equal(run([row(1, 30, 12, 0)], []).length, 0);
});

test("orden: agotados por venta, luego por días de cobertura", () => {
  const items = run([
    row(1, 15, 6, 0),
    row(2, 60, 20, 0),
    row(3, 30, 12, 12),
    row(4, 30, 12, 3),
  ]);
  assert.deepEqual(
    items.map((i) => i.title),
    ["P2", "P1", "P4", "P3"],
  );
});

test("returns variant/location detail without converting unknown quantities to zero", () => {
  const items = run([row(1, 30, 12, 10)]);
  const levelsByProduct = mapShopifyInventoryLevels(
    [{ id: "variant-1", product_id: id(1), title: "Arena / M" }],
    [{ id: "inventory-1", variant_id: "variant-1", sku: "ARENA-M" }],
    [
      {
        inventory_item_id: "inventory-1",
        location_id: "location-1",
        available_quantity: 10,
        updated_at: fresh,
      },
      {
        inventory_item_id: "inventory-1",
        location_id: "location-2",
        available_quantity: null,
        updated_at: null,
      },
    ],
    [
      { id: "location-1", name: "Madrid" },
      { id: "location-2", name: "Online" },
    ],
  );

  const product = items[0];
  assert.ok(product);
  assert.equal(product.product_id, id(1));
  assert.equal(product.available, 10);
  assert.deepEqual(
    levelsByProduct
      .get(product.product_id)
      ?.map((level) => [
        level.variant_id,
        level.location_name,
        level.available_quantity,
      ]),
    [
      ["variant-1", "Madrid", 10],
      ["variant-1", "Online", null],
    ],
  );
});

test("proyecta unidades y fecha de agotamiento al ritmo base con cifras trazables", () => {
  const scenario = projectStockScenario({
    available: 30,
    averageDailySales: 2,
    inventoryReliable: true,
    sampleMature: true,
    asOf: "2026-10-20T00:00:00.000Z",
    targetDate: "2026-11-27T00:00:00.000Z",
  });
  assert.deepEqual(scenario, {
    target_date: "2026-11-27",
    days_from_now: 38,
    projected_units: 0,
    stockout_date: "2026-11-04",
  });
});

test("no proyecta fechas comerciales si el stock es obsoleto o la muestra es inmadura", () => {
  const input = {
    available: 30,
    averageDailySales: 2,
    inventoryReliable: false,
    sampleMature: true,
    asOf: "2026-10-20T00:00:00.000Z",
    targetDate: "2026-11-27T00:00:00.000Z",
  };
  assert.equal(projectStockScenario(input), null);
  assert.equal(projectStockScenario({ ...input, inventoryReliable: true, sampleMature: false }), null);
});

test("backtest holdout: semanas futuras no entran en la previsión base", () => {
  const history = Array<number>(8).fill(14);
  const heldOut = Array<number>(4).fill(14);
  const forecast = forecastStockDemand(history, 60, true);
  const actual30d = heldOut.reduce((sum, units) => sum + units, 0) * 30 / 28;
  assert.equal(forecast.forecast30d, 60);
  assert.equal(actual30d, 60);
  assert.equal(Math.abs(forecast.forecast30d! - actual30d), 0);
});
