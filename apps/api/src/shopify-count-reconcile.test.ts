import assert from "node:assert/strict";
import test from "node:test";
import { classifyShopifyCountComparison } from "./shopify-count-reconcile.js";

test("clasifica conteos exactos sin precision aproximada", () => {
  assert.deepEqual(
    classifyShopifyCountComparison("products", 11, 11, "EXACT"),
    {
      status: "exact",
      statusReason: "local_count_matches_shopify_count",
    },
  );
});

test("no convierte un lower bound de Shopify en falsa discrepancia", () => {
  assert.deepEqual(
    classifyShopifyCountComparison("products", 120, 100, "AT_LEAST"),
    {
      status: "warning",
      statusReason: "shopify_count_is_lower_bound",
    },
  );
});

test("clasifica pedidos locales adicionales como warning de alcance", () => {
  assert.deepEqual(
    classifyShopifyCountComparison("orders", 363, 341, "EXACT"),
    {
      status: "warning",
      statusReason: "local_orders_may_include_history_outside_shopify_scope",
    },
  );
});

test("clasifica un conteo local inferior como mismatch", () => {
  assert.deepEqual(
    classifyShopifyCountComparison("customers", 9, 10, "EXACT"),
    {
      status: "mismatch",
      statusReason: "local_count_below_shopify_count",
    },
  );
});
