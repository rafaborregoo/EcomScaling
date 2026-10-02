import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShopifyRevenueDropDetection,
  buildShopifyStockOutDetection,
} from "./operations.js";

const orgId = "org-1";
const storeA = { id: "store-a", shop_name: "Tienda A" };
const storeB = { id: "store-b", shop_name: "Tienda B" };

test("la alerta de stock lleva el scope y fingerprint de la tienda que la originó", () => {
  const detection = buildShopifyStockOutDetection({
    organizationId: orgId,
    store: storeA,
    outOfStockItems: 4,
    threshold: 2,
  });

  assert.equal(detection?.storeId, storeA.id);
  assert.equal(detection?.sourceEntityId, storeA.id);
  assert.equal(detection?.fingerprint, `shopify_stock_out:${orgId}:${storeA.id}`);
  assert.deepEqual(detection?.contextData, { store_name: storeA.shop_name });
  assert.equal(
    buildShopifyStockOutDetection({
      organizationId: orgId,
      store: storeA,
      outOfStockItems: 2,
      threshold: 2,
    }),
    null,
  );
});

test("la caída de ventas se calcula por tienda y no mezcla fingerprints", () => {
  const detectionA = buildShopifyRevenueDropDetection({
    organizationId: orgId,
    store: storeA,
    currentNetSales: 60,
    previousNetSales: 100,
    threshold: -30,
    weekKey: "2026-09-29",
  });
  const detectionB = buildShopifyRevenueDropDetection({
    organizationId: orgId,
    store: storeB,
    currentNetSales: 60,
    previousNetSales: 100,
    threshold: -30,
    weekKey: "2026-09-29",
  });

  assert.equal(detectionA?.storeId, storeA.id);
  assert.equal(detectionB?.storeId, storeB.id);
  assert.notEqual(detectionA?.fingerprint, detectionB?.fingerprint);
  assert.equal(detectionA?.metricValue, -40);
  assert.equal(
    buildShopifyRevenueDropDetection({
      organizationId: orgId,
      store: storeA,
      currentNetSales: 70,
      previousNetSales: 100,
      threshold: -30,
      weekKey: "2026-09-29",
    }),
    null,
  );
  assert.equal(
    buildShopifyRevenueDropDetection({
      organizationId: orgId,
      store: storeA,
      currentNetSales: 0,
      previousNetSales: 0,
      threshold: -30,
      weekKey: "2026-09-29",
    }),
    null,
  );
});
