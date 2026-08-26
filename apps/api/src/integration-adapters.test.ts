import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createIntegrationAdapters } from "./integration-adapters.js";

const env = {
  API_HOST: "127.0.0.1",
  API_PORT: 3001,
  WEB_ORIGIN: "http://localhost:3000",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SHOPIFY_API_KEY: "shopify-key",
  SHOPIFY_API_SECRET: "shopify-secret",
  SHOPIFY_SCOPES: "read_products",
  SHOPIFY_REDIRECT_URI: "https://api.example.com/v1/shopify/callback",
  META_APP_ID: "meta-id",
  META_APP_SECRET: "meta-secret",
  META_REDIRECT_URI: "https://api.example.com/v1/meta/callback",
  META_SCOPES: "ads_read",
};

test("los adapters completos construyen OAuth con el contrato comun", async () => {
  const adapters = createIntegrationAdapters(env);
  const shopifyUrl = await adapters.shopify.buildAuthorizationUrl({
    organizationId: "org-1",
    shopDomain: "store.myshopify.com",
    redirectUri: "https://api.example.com/v1/shopify/callback",
    state: "state-1",
  });
  const metaUrl = await adapters.meta_ads.buildAuthorizationUrl({
    organizationId: "org-1",
    redirectUri: "https://api.example.com/v1/meta/callback",
    state: "state-2",
  });
  const klaviyo = createIntegrationAdapters({
    ...env,
    KLAVIYO_CLIENT_ID: "klaviyo-id",
    KLAVIYO_CLIENT_SECRET: "klaviyo-secret",
    KLAVIYO_REDIRECT_URI: "https://api.example.com/v1/klaviyo/oauth/callback",
  }).klaviyo;
  const klaviyoUrl = await klaviyo.buildAuthorizationUrl({
    organizationId: "org-1",
    redirectUri: "https://api.example.com/v1/klaviyo/oauth/callback",
    state: "state-3",
    codeChallenge: "challenge-3",
  });

  assert.match(
    shopifyUrl.url,
    /store\.myshopify\.com\/admin\/oauth\/authorize/,
  );
  assert.match(shopifyUrl.url, /state=state-1/);
  assert.match(metaUrl.url, /facebook\.com\/v23\.0\/dialog\/oauth/);
  assert.match(metaUrl.url, /state=state-2/);
  assert.match(klaviyoUrl.url, /www\.klaviyo\.com\/oauth\/authorize/);
  assert.match(klaviyoUrl.url, /code_challenge=challenge-3/);
});

test("el adapter Shopify verifica firma y conserva el contexto para procesar el webhook", async () => {
  const adapter = createIntegrationAdapters(env).shopify;
  const body = JSON.stringify({ id: 42 });
  const signature = crypto
    .createHmac("sha256", env.SHOPIFY_API_SECRET)
    .update(body)
    .digest("base64");
  const verified = await adapter.verifyWebhook!({
    body,
    headers: {
      "x-shopify-hmac-sha256": signature,
      "x-shopify-topic": "products/update",
    },
  });

  assert.equal(verified.provider, "shopify");
  assert.equal(verified.topic, "products/update");
  assert.deepEqual(verified.payload, { id: 42 });
  assert.equal(verified.rawBody, body);

  await assert.rejects(
    () =>
      adapter.verifyWebhook!({
        body,
        headers: { "x-shopify-hmac-sha256": "invalid" },
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "shopify_webhook_signature_invalid",
  );
});

test("el health del adapter reutiliza el estado derivado sin leer ni escribir produccion", async () => {
  const health = await createIntegrationAdapters(
    env,
  ).shopify.getConnectionHealth({
    id: "connection-1",
    organizationId: "org-1",
    provider: "shopify",
    status: "connected",
    lastSyncAt: new Date().toISOString(),
  });

  assert.equal(health.status, "healthy");
});

test("los conectores futuros exponen el contrato comun y fallan de forma honesta sin credenciales", async () => {
  const adapters = createIntegrationAdapters(env);

  for (const provider of ["klaviyo", "instagram"] as const) {
    const adapter = adapters[provider];
    assert.equal(adapter.provider, provider);
    assert.equal(
      (
        await adapter.getConnectionHealth({
          id: `${provider}-connection`,
          organizationId: "org-1",
          provider,
          status: "pending",
        })
      ).status,
      "unknown",
    );
    const expectedError =
      provider === "klaviyo"
        ? "klaviyo_app_not_configured"
        : "instagram_connector_not_enabled";
    await assert.rejects(
      () =>
        adapter.buildAuthorizationUrl({
          organizationId: "org-1",
          redirectUri: "https://api.example.com/callback",
          state: "future-state",
        }),
      (error: unknown) =>
        error instanceof Error && error.message === expectedError,
    );

    if (provider === "instagram") {
      await assert.rejects(
        () =>
          adapter.discoverAssets!({
            id: "instagram-connection",
            organizationId: "org-1",
            provider: "instagram",
            status: "pending",
          }),
        (error: unknown) =>
          error instanceof Error &&
          error.message === "instagram_connector_not_enabled",
      );
    }
  }
});
