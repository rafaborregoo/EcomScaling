import assert from "node:assert/strict";
import test from "node:test";
import {
  applyProductInventoryEvidence,
  buildProductInventoryPlaybookContext,
} from "./product-inventory-engine.js";

test("P07 distingue catalogo, inventario y demanda sin convertir stockout en orden de compra", () => {
  const context = buildProductInventoryPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyProductInventoryEvidence(context, {
    catalog: { products_count: 8, variants_count: 12 },
    stock: { tracked_items: 12, total_available: 50, low_stock_items: 3, out_of_stock_items: 1 },
    sales: { orders_count: 10, units_sold: 20 },
    margin: { items_with_cost: 10 },
  });
  assert.equal(enriched.facts?.["product_inventory.catalog.available"], "TRUE");
  assert.equal(enriched.facts?.["product_inventory.inventory.snapshot_available"], "TRUE");
  assert.equal(enriched.facts?.["product_inventory.stock.low_observed"], "TRUE");
  assert.equal(enriched.facts?.["product_inventory.stockout.observed"], "TRUE");
  assert.equal(enriched.facts?.["product_inventory.demand.observed"], "TRUE");
  assert.equal(enriched.facts?.["product_inventory.replenishment.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["product_inventory.forecast.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["product_inventory.supplier.observed"], "UNKNOWN");
});

test("P07 no clasifica overstock, calidad ni racionalizacion sin evidencia especifica", () => {
  const context = buildProductInventoryPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyProductInventoryEvidence(context, {
    catalog: null,
    stock: { tracked_items: 3, total_available: 1000, low_stock_items: 0, out_of_stock_items: 0 },
    sales: null,
    margin: null,
  });
  assert.equal(enriched.facts?.["product_inventory.overstock.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["product_inventory.quality.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["product_inventory.sku_rationalization.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["product_inventory.inventory_accuracy.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["product_inventory.demand_supply.alignment"], "UNKNOWN");
});
