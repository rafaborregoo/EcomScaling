import assert from "node:assert/strict";
import test from "node:test";
import { summarizeShopifySyncCoverage } from "./shopify-sync-coverage.js";

const now = Date.parse("2026-09-29T12:00:00.000Z");

test("A21 reports the selected active store sync without including another store", () => {
  const result = summarizeShopifySyncCoverage(
    [
      { id: "store-a", shop_name: "Tienda A", connection_id: "connection-a" },
      { id: "store-b", shop_name: "Tienda B", connection_id: "connection-b" },
    ],
    [
      { id: "connection-a", status: "connected", last_sync_at: "2026-09-29T11:00:00.000Z", last_error_at: null },
      { id: "connection-b", status: "disconnected", last_sync_at: "2026-09-28T11:00:00.000Z", last_error_at: null },
    ],
    "store-a",
    now,
  );
  assert.equal(result.scope, "selected_store");
  assert.equal(result.status, "fresh");
  assert.deepEqual(result.stores.map((store) => store.store), ["Tienda A"]);
  assert.equal(result.stores[0]?.availability, "fresh");
});

test("A21 labels stale, errored, missing, and aggregate sync coverage honestly", () => {
  const result = summarizeShopifySyncCoverage(
    [
      { id: "store-a", shop_name: "Tienda A", connection_id: "connection-a" },
      { id: "store-b", shop_name: "Tienda B", connection_id: null },
    ],
    [
      { id: "connection-a", status: "syncing", last_sync_at: "2026-09-27T11:00:00.000Z", last_error_at: "2026-09-28T11:00:00.000Z" },
    ],
    null,
    now,
  );
  assert.equal(result.scope, "active_organization_stores");
  assert.equal(result.status, "partial_or_unavailable");
  assert.equal(result.stores[0]?.availability, "unknown_or_unavailable");
  assert.equal(result.stores[1]?.availability, "unknown_or_unavailable");
  assert.equal(result.stores[1]?.connection_status, "not_connected");
  assert.equal(summarizeShopifySyncCoverage([], [], null, now).status, "no_active_stores");
});
