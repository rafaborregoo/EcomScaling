import assert from "node:assert/strict";
import test from "node:test";
import { resolveMarketingStoreScope } from "./marketing-store-scope.js";

test("no selected store explicitly means organization aggregate", () => {
  assert.deepEqual(resolveMarketingStoreScope(null, { data: null }), {
    ok: true,
    storeId: null,
    storeLabel: "todas las tiendas de la organización",
  });
});

test("a selected but missing/inactive store fails closed", () => {
  assert.deepEqual(resolveMarketingStoreScope("connection-old", { data: null }), {
    ok: false,
    statusCode: 404,
    error: "marketing_store_not_found",
  });
});

test("a store lookup error never becomes aggregate data", () => {
  assert.deepEqual(resolveMarketingStoreScope("connection-1", {
    data: null,
    error: { message: "database unavailable" },
  }), {
    ok: false,
    statusCode: 503,
    error: "marketing_store_scope_unavailable",
    detail: "database unavailable",
  });
});

test("a valid active store preserves its exact internal ID", () => {
  assert.deepEqual(resolveMarketingStoreScope("connection-1", {
    data: { id: "store-1", shop_name: "Tienda A" },
  }), {
    ok: true,
    storeId: "store-1",
    storeLabel: 'la tienda "Tienda A"',
  });
});
