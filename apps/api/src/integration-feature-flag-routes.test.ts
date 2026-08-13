import assert from "node:assert/strict";
import test from "node:test";
import {
  createKlaviyoConnectionAuthUrl,
  handleKlaviyoOAuthCallback,
} from "./klaviyo.js";
import {
  reconcileAllKlaviyoConnections,
  runKlaviyoReport,
  runKlaviyoSync,
} from "./klaviyo-sync.js";
import { reconcileAllMetaConnections, runMetaSync } from "./meta-sync.js";
import { buildApp } from "./server.js";

// Esta suite pertenece a `test:unit` y debe funcionar en un runner limpio:
// prueba el allowlist, no una conexión real a Supabase.
process.env.API_HOST = "127.0.0.1";
process.env.API_PORT = "4000";
process.env.WEB_ORIGIN = "http://localhost:3001";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
process.env.SHOPIFY_API_KEY = "shopify-key";
process.env.SHOPIFY_API_SECRET = "shopify-secret";
process.env.SHOPIFY_SCOPES = "read_products";
process.env.SHOPIFY_REDIRECT_URI =
  "https://api.example.com/v1/shopify/callback";

test("las rutas Meta y Klaviyo respetan el allowlist de feature flags", async () => {
  const previousFlags = process.env.INTEGRATION_FEATURE_FLAGS;
  process.env.INTEGRATION_FEATURE_FLAGS = "shopify";
  const app = await buildApp();
  try {
    const meta = await app.inject({
      method: "GET",
      url: "/v1/meta/oauth/callback",
    });
    const klaviyo = await app.inject({
      method: "GET",
      url: "/v1/organizations/00000000-0000-0000-0000-000000000000/klaviyo/reporting",
    });

    assert.equal(meta.statusCode, 404);
    assert.equal(klaviyo.statusCode, 404);
    assert.deepEqual(meta.json(), {
      error: "integration_feature_disabled",
      provider: "meta_ads",
    });
    assert.deepEqual(klaviyo.json(), {
      error: "integration_feature_disabled",
      provider: "klaviyo",
    });
  } finally {
    await app.close();
    if (previousFlags === undefined)
      delete process.env.INTEGRATION_FEATURE_FLAGS;
    else process.env.INTEGRATION_FEATURE_FLAGS = previousFlags;
  }
});

test("los runners internos respetan el allowlist antes de tocar Supabase", async () => {
  const disabledEnv = {
    INTEGRATION_FEATURE_FLAGS: "shopify",
  } as unknown as Parameters<typeof reconcileAllKlaviyoConnections>[0];

  assert.deepEqual(await reconcileAllKlaviyoConnections(disabledEnv), {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    results: [],
  });
  await assert.rejects(
    () => runKlaviyoSync(disabledEnv, "connection-1", "incremental"),
    /klaviyo_integration_disabled/,
  );
  await assert.rejects(
    () =>
      runKlaviyoReport(disabledEnv, "org-1", "connection-1", {
        type: "campaign-values-report",
        statistics: ["opens"],
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
      }),
    /klaviyo_integration_disabled/,
  );
  await assert.rejects(
    () => runMetaSync(disabledEnv, "connection-1", "initial"),
    /meta_ads_integration_disabled/,
  );
  await assert.rejects(
    () => runMetaSync(disabledEnv, "connection-1", "incremental"),
    /meta_ads_integration_disabled/,
  );
  assert.deepEqual(await reconcileAllMetaConnections(disabledEnv), {
    total: 0,
    succeeded: 0,
    failed: 0,
    results: [],
  });
  assert.deepEqual(
    await createKlaviyoConnectionAuthUrl(
      disabledEnv,
      {} as Parameters<typeof createKlaviyoConnectionAuthUrl>[1],
      "org-1",
    ),
    { ok: false, statusCode: 404, error: "integration_feature_disabled" },
  );
  assert.deepEqual(await handleKlaviyoOAuthCallback(disabledEnv, {}), {
    ok: false,
    statusCode: 404,
    error: "integration_feature_disabled",
  });
});
