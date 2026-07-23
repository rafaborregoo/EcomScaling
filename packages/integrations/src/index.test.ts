import assert from "node:assert/strict";
import test from "node:test";
import { deriveIntegrationHealth, INTEGRATION_CATALOG, IntegrationError } from "./index.js";

test("el catálogo distingue implementación disponible de credenciales configuradas", () => {
  assert.deepEqual(
    INTEGRATION_CATALOG.map((provider) => provider.id),
    ["shopify", "meta_ads", "klaviyo", "instagram"],
  );

  assert.equal(INTEGRATION_CATALOG.find((provider) => provider.id === "shopify")?.available, true);
  assert.equal(INTEGRATION_CATALOG.find((provider) => provider.id === "meta_ads")?.available, true);
  assert.equal(INTEGRATION_CATALOG.find((provider) => provider.id === "klaviyo")?.available, false);
  assert.equal(INTEGRATION_CATALOG.find((provider) => provider.id === "instagram")?.available, false);
});

test("deriveIntegrationHealth distingue salud, stale, error y ausencia de conexion", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");

  assert.equal(deriveIntegrationHealth({ available: true, connectionStatus: "connected", lastSyncAt: "2026-07-22T11:00:00.000Z", now }).status, "healthy");
  assert.equal(deriveIntegrationHealth({ available: true, connectionStatus: "syncing", now }).status, "syncing");
  assert.equal(deriveIntegrationHealth({ available: true, connectionStatus: "connected", lastSyncAt: "2026-07-20T12:00:00.000Z", now }).status, "stale");
  assert.equal(deriveIntegrationHealth({ available: true, connectionStatus: "connected", lastSyncAt: "2026-07-22T11:00:00.000Z", latestSyncStatus: "failed", now }).reason, "last_sync_failed");
  assert.equal(deriveIntegrationHealth({ available: false }).reason, "integration_not_available");
  assert.equal(deriveIntegrationHealth({ available: true }).reason, "not_connected");
});

test("cada conector futuro tiene flag y capacidades explícitas", () => {
  for (const provider of INTEGRATION_CATALOG) {
    assert.match(provider.featureFlag, /^integration\.[a-z_]+$/);
    assert.equal(typeof provider.capabilities.oauth, "boolean");
    assert.equal(typeof provider.capabilities.initialSync, "boolean");
    assert.equal(typeof provider.capabilities.incrementalSync, "boolean");
  }
});

test("IntegrationError conserva clasificación segura y accionable", () => {
  const error = new IntegrationError(
    "RATE_LIMITED",
    "meta_ads",
    "meta_graph_rate_limited",
    true,
    false,
    429,
    "613",
  );

  assert.equal(error.integrationCode, "RATE_LIMITED");
  assert.equal(error.provider, "meta_ads");
  assert.equal(error.retryable, true);
  assert.equal(error.externalStatus, 429);
  assert.equal(error.externalCode, "613");
});
