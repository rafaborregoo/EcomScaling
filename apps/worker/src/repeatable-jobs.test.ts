import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHOPIFY_RECONCILE_CRON,
  isStaleShopifyReconcileRepeatable,
} from "./repeatable-jobs.js";

// Regresion del bug real documentado en worker.ts: al cambiar de `every` (6h)
// a `pattern` (cron diario), BullMQ dejaba el job repetible viejo huerfano en
// Redis por indexarlo por su config de repeat, no solo por jobId, duplicando
// el reconcile de Shopify hasta que se borrara a mano.

test("marca como huerfano un repetible de shopify-reconcile con un pattern distinto al vigente", () => {
  const stale = { name: "shopify-reconcile", pattern: "0 */6 * * *" };
  assert.equal(
    isStaleShopifyReconcileRepeatable(stale, SHOPIFY_RECONCILE_CRON),
    true,
  );
});

test("no marca como huerfano el repetible de shopify-reconcile ya con el pattern vigente", () => {
  const current = {
    name: "shopify-reconcile",
    pattern: SHOPIFY_RECONCILE_CRON,
  };
  assert.equal(
    isStaleShopifyReconcileRepeatable(current, SHOPIFY_RECONCILE_CRON),
    false,
  );
});

test("ignora repetibles de otros jobs aunque su pattern tambien difiera", () => {
  const otherJob = { name: "alert-rules", pattern: "0 */6 * * *" };
  assert.equal(
    isStaleShopifyReconcileRepeatable(otherJob, SHOPIFY_RECONCILE_CRON),
    false,
  );
});

test("trata un repetible sin pattern (configurado por `every`) como huerfano", () => {
  const everyBased = { name: "shopify-reconcile", pattern: null };
  assert.equal(
    isStaleShopifyReconcileRepeatable(everyBased, SHOPIFY_RECONCILE_CRON),
    true,
  );
});
