import test from "node:test";
import assert from "node:assert/strict";
import { enrichStockRiskEvidence, hasOpenStockTaskForProduct } from "./stock-risk-evidence.js";

const options = {
  periodStart: "2026-08-01T00:00:00.000Z",
  periodEnd: "2026-08-31T00:00:00.000Z",
  now: Date.parse("2026-09-01T00:00:00.000Z"),
};

test("estima cobertura solo con inventario fiable y muestra suficiente", () => {
  const [item] = enrichStockRiskEvidence([{
    quantity_sold_period: 30,
    selling_days: 12,
    available_quantity: 15,
    inventory_status: "tracked_current",
    latest_inventory_sync_at: "2026-08-31T12:00:00.000Z",
  }], options);
  assert.ok(item);
  assert.equal(item.stock_coverage_sample_sufficient, true);
  assert.equal(item.average_daily_sales, 1);
  assert.equal(item.days_of_cover, 15);
  assert.equal(item.lead_time_days, null);
  assert.equal(item.reorder_quantity, null);
});

test("no confunde cero con desconocido y no calcula cobertura con poca muestra", () => {
  const rows = enrichStockRiskEvidence([
    { quantity_sold_period: 12, selling_days: 5, available_quantity: 0, inventory_status: "tracked_current", latest_inventory_sync_at: "2026-08-31T12:00:00.000Z" },
    { quantity_sold_period: 2, selling_days: 1, available_quantity: 0, inventory_status: "tracked_current", latest_inventory_sync_at: "2026-08-31T12:00:00.000Z" },
    { quantity_sold_period: 12, selling_days: 5, available_quantity: null, inventory_status: "inventory_not_synced", latest_inventory_sync_at: null },
  ], options);
  const [reliableZero, sparse, unsynced] = rows;
  assert.ok(reliableZero && sparse && unsynced);
  assert.equal(reliableZero.days_of_cover, 0);
  assert.equal(sparse.stock_coverage_sample_sufficient, false);
  assert.equal(sparse.days_of_cover, null);
  assert.equal(unsynced.inventory_sync_is_stale, true);
  assert.equal(unsynced.days_of_cover, null);
});

test("rechaza cantidades no numericas y estados parciales como stock confiable", () => {
  const [item] = enrichStockRiskEvidence([{
    quantity_sold_period: "bad",
    selling_days: 8,
    available_quantity: "bad",
    inventory_status: "partial_sync",
    latest_inventory_sync_at: "2026-08-31T23:00:00.000Z",
  }], options);
  assert.ok(item);
  assert.equal(item.quantity_sold_in_period, null);
  assert.equal(item.average_daily_sales, null);
  assert.equal(item.days_of_cover, null);
});

test("deduplica reposicion por product ID exacto y respeta el alcance de tienda", () => {
  const productA = "00000000-0000-4000-8000-000000000111";
  const productB = "00000000-0000-4000-8000-000000000222";
  const tasks = [
    { store_id: "store-a", metadata: { ai_shopify_product_id: productA } },
    { store_id: "store-b", metadata: { ai_shopify_product_id: productB } },
    { store_id: null, metadata: { ai_shopify_product_id: productB } },
    { store_id: "store-a", metadata: { ai_shopify_product_id: "not-a-uuid" } },
  ];
  assert.equal(hasOpenStockTaskForProduct(productA, tasks, "store-a"), true);
  assert.equal(hasOpenStockTaskForProduct(productB, tasks, "store-a"), true, "una tarea organizativa sin tienda cuenta para todas");
  assert.equal(hasOpenStockTaskForProduct(productB, tasks, "store-b"), true);
  assert.equal(hasOpenStockTaskForProduct(productA, tasks, "store-b"), false);
  assert.equal(hasOpenStockTaskForProduct("not-a-uuid", tasks, "store-a"), false);
  assert.equal(hasOpenStockTaskForProduct(productA.toUpperCase(), tasks, "store-a"), true);
});
