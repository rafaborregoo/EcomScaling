import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveIntegrationActivation,
  deriveIntegrationConfiguration,
  hasRecoveredSync,
} from "./integrations.js";
import { INTEGRATION_CATALOG } from "@ecomscaling/integrations";

const baseEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable",
};

test("distingue feature flag, credenciales y conector no implementado", () => {
  assert.deepEqual(deriveIntegrationConfiguration("meta_ads", true, baseEnv), {
    status: "credentials_missing",
    reason: "provider_app_credentials_missing",
  });
  assert.deepEqual(
    deriveIntegrationConfiguration("meta_ads", true, {
      ...baseEnv,
      META_APP_ID: "app-id",
      META_APP_SECRET: "app-secret",
      META_REDIRECT_URI: "https://api.example.com/meta/callback",
    }),
    { status: "configured", reason: "provider_app_configured" },
  );
  assert.deepEqual(deriveIntegrationConfiguration("meta_ads", false, baseEnv), {
    status: "feature_disabled",
    reason: "feature_flag_disabled",
  });
  assert.deepEqual(deriveIntegrationConfiguration("instagram", true, baseEnv), {
    status: "not_implemented",
    reason: "instagram_connector_not_implemented",
  });
  assert.deepEqual(deriveIntegrationConfiguration("fathom", true, baseEnv), {
    status: "credentials_missing",
    reason: "provider_app_credentials_missing",
  });
  assert.deepEqual(
    deriveIntegrationConfiguration("fathom", true, {
      ...baseEnv,
      FATHOM_API_KEY: "fathom-api-key",
      FATHOM_WEBHOOK_SECRET: "whsec_test",
    }),
    { status: "configured", reason: "provider_app_configured" },
  );
});

test("considera operativa la app personalizada de Shopify aunque la pública falte", () => {
  assert.deepEqual(
    deriveIntegrationConfiguration("shopify", true, {
      ...baseEnv,
      SHOPIFY_CUSTOM_API_KEY: "custom-key",
      SHOPIFY_CUSTOM_API_SECRET: "custom-secret",
      SHOPIFY_CUSTOM_SCOPES: "read_products",
      SHOPIFY_CUSTOM_REDIRECT_URI: "https://api.example.com/shopify/callback",
    }),
    { status: "configured", reason: "provider_app_configured" },
  );
});

test("la readiness API respeta las capacidades webhook-only de Fathom", () => {
  const fathom = INTEGRATION_CATALOG.find((provider) => provider.id === "fathom");
  assert.ok(fathom);
  const readiness = deriveIntegrationActivation({
    configuration: { status: "configured", reason: "test" },
    capabilities: fathom.capabilities,
  }, null, null, { status: "healthy", lastSyncAt: null });
  assert.equal(readiness.missing.includes("redirectUriExact"), false);
  assert.equal(readiness.missing.includes("initialSyncSucceeded"), false);
  assert.ok(readiness.missing.includes("recoverableErrorVerified"));
});

test("la recuperación se verifica sólo tras fallo/partial seguido de éxito", () => {
  assert.equal(
    hasRecoveredSync("connection-1", [
      { connection_id: "connection-1", status: "succeeded", created_at: "2026-08-26T12:00:00Z" },
      { connection_id: "connection-1", status: "failed", created_at: "2026-08-26T11:00:00Z" },
    ]),
    true,
  );
  assert.equal(
    hasRecoveredSync("connection-1", [
      { connection_id: "connection-1", status: "succeeded", created_at: "2026-08-26T12:00:00Z" },
    ]),
    false,
  );
});

test("Meta puede cerrar readiness cuando existe recuperación operacional", () => {
  const meta = INTEGRATION_CATALOG.find((provider) => provider.id === "meta_ads");
  assert.ok(meta);
  const readiness = deriveIntegrationActivation(
    { configuration: { status: "configured", reason: "test" }, capabilities: meta.capabilities },
    {
      id: "connection-1",
      organization_id: "org-1",
      provider: "meta_ads",
      provider_account_name: "Cuenta principal",
      status: "connected",
      scopes: ["ads_read"],
      api_version: "v24.0",
      connected_at: "2026-08-26T10:00:00Z",
      last_sync_at: "2026-08-26T12:00:00Z",
      last_error_at: null,
      last_error_message: null,
      created_at: "2026-08-26T09:00:00Z",
    },
    { id: "run-2", connection_id: "connection-1", sync_type: "incremental", status: "succeeded", records_read: 1, records_written: 1, records_failed: 0, started_at: null, finished_at: null, error_message: null, created_at: "2026-08-26T12:00:00Z" },
    { status: "healthy", lastSyncAt: "2026-08-26T12:00:00Z" },
    true,
  );
  assert.equal(readiness.ready, true);
});
