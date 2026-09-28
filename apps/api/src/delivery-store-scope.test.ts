import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDeliveryStoreScope } from "./delivery-store-scope.js";

describe("A22 scope de tienda", () => {
  it("solo agrega datos cuando no se solicitó una conexión concreta", () => {
    assert.deepEqual(resolveDeliveryStoreScope(null, { data: null }), {
      ok: true, storeId: null, storeLabel: "todas las tiendas de la organización",
    });
  });
  it("un connectionId desconocido no cae silenciosamente al agregado", () => {
    assert.deepEqual(resolveDeliveryStoreScope("connection-missing", { data: null }), {
      ok: false, statusCode: 404, error: "delivery_store_not_found",
    });
  });
  it("un fallo al resolver la tienda es un error, no datos vacíos", () => {
    assert.deepEqual(resolveDeliveryStoreScope("connection-1", { data: null, error: { message: "db unavailable" } }), {
      ok: false, statusCode: 503, error: "delivery_store_scope_unavailable", detail: "db unavailable",
    });
  });
  it("conserva el ID y el nombre de la tienda resuelta", () => {
    assert.deepEqual(resolveDeliveryStoreScope("connection-1", { data: { id: "store-1", shop_name: "Tienda A" } }), {
      ok: true, storeId: "store-1", storeLabel: "la tienda \"Tienda A\"",
    });
  });
});
