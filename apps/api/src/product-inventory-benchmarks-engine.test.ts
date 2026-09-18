import assert from "node:assert/strict";
import test from "node:test";
import { applyProductInventoryBenchmarksEvidence, buildProductInventoryBenchmarksPlaybookContext } from "./product-inventory-benchmarks-engine.js";

test("F6.10 observa stock, demanda y cobertura sin inventar forecast", () => {
  const result = applyProductInventoryBenchmarksEvidence(buildProductInventoryBenchmarksPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z"), {
    catalog: { products_count: 12, variants_count: 20 }, stock: { available: true, tracked_items: 20, total_available: 140, low_stock_items: 3, out_of_stock_items: 1 }, sales: { available: true, orders_count: 40, units_sold: 70 }, margin: { available: true, items_with_cost: 18 }, history: { available: true, days: 90 },
  }, ["shopify_stock_summary:org-1:2026-09-18"]);
  assert.equal(result.facts?.["inventory_benchmarks.stock.observed"], "TRUE");
  assert.equal(result.facts?.["inventory_benchmarks.demand.observed"], "TRUE");
  assert.equal(result.facts?.["inventory_benchmarks.coverage.observed"], "UNKNOWN");
  assert.equal(result.facts?.["inventory_benchmarks.forecast.observed"], "UNKNOWN");
});

test("F6.10 conserva UNKNOWN sin lead time, aging o precisión física", () => {
  const result = applyProductInventoryBenchmarksEvidence(buildProductInventoryBenchmarksPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z"), {});
  assert.equal(result.facts?.["inventory_benchmarks.stockout.observed"], "UNKNOWN");
  assert.equal(result.facts?.["inventory_benchmarks.lead_time.observed"], "UNKNOWN");
  assert.equal(result.facts?.["inventory_benchmarks.accuracy.observed"], "UNKNOWN");
});
