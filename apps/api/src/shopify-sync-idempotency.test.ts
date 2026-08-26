import assert from "node:assert/strict";
import test from "node:test";
import { buildShopifySyncIdempotencyKey } from "./shopify-sync.js";

test("Shopify initial sync keeps one idempotency key across retries", () => {
  assert.equal(
    buildShopifySyncIdempotencyKey(
      "initial_import",
      "catalog",
      "connection-1",
      "2026-08-24T10:00:00.000Z",
    ),
    "initial_import:catalog:connection-1",
  );
  assert.equal(
    buildShopifySyncIdempotencyKey(
      "initial_import",
      "catalog",
      "connection-1",
      "2026-08-25T18:45:00.000Z",
    ),
    "initial_import:catalog:connection-1",
  );
});

test("Shopify incremental sync groups retries in the same UTC hour", () => {
  assert.equal(
    buildShopifySyncIdempotencyKey(
      "incremental",
      "orders",
      "connection-1",
      "2026-08-24T10:59:59.000Z",
    ),
    "incremental:orders:connection-1:2026-08-24T10",
  );
  assert.notEqual(
    buildShopifySyncIdempotencyKey(
      "incremental",
      "orders",
      "connection-1",
      "2026-08-24T11:00:00.000Z",
    ),
    "incremental:orders:connection-1:2026-08-24T10",
  );
});
