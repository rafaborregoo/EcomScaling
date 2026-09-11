import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveIntegrationHealth,
  getInstagramAuthStrategyContract,
  INSTAGRAM_AUTH_STRATEGY_CONTRACTS,
  INTEGRATION_CATALOG,
  IntegrationError,
  isIntegrationFeatureEnabled,
} from "./index.js";

test("el catálogo distingue implementación disponible de credenciales configuradas", () => {
  assert.deepEqual(
    INTEGRATION_CATALOG.map((provider) => provider.id),
    ["shopify", "meta_ads", "klaviyo", "instagram", "fathom"],
  );

  assert.equal(
    INTEGRATION_CATALOG.find((provider) => provider.id === "shopify")
      ?.available,
    true,
  );
  assert.equal(
    INTEGRATION_CATALOG.find((provider) => provider.id === "meta_ads")
      ?.available,
    true,
  );
  assert.equal(
    INTEGRATION_CATALOG.find((provider) => provider.id === "klaviyo")
      ?.available,
    true,
  );
  assert.equal(
    INTEGRATION_CATALOG.find((provider) => provider.id === "instagram")
      ?.available,
    false,
  );
  assert.equal(
    INTEGRATION_CATALOG.find((provider) => provider.id === "fathom")?.available,
    true,
  );
});

test("deriveIntegrationHealth distingue salud, stale, error y ausencia de conexion", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");

  assert.equal(
    deriveIntegrationHealth({
      available: true,
      connectionStatus: "connected",
      lastSyncAt: "2026-07-22T11:00:00.000Z",
      now,
    }).status,
    "healthy",
  );
  assert.equal(
    deriveIntegrationHealth({
      available: true,
      connectionStatus: "syncing",
      now,
    }).status,
    "syncing",
  );
  assert.equal(
    deriveIntegrationHealth({
      available: true,
      connectionStatus: "connected",
      lastSyncAt: "2026-07-20T12:00:00.000Z",
      now,
    }).status,
    "stale",
  );
  assert.equal(
    deriveIntegrationHealth({
      available: true,
      connectionStatus: "connected",
      lastSyncAt: "2026-07-22T11:00:00.000Z",
      latestSyncStatus: "failed",
      now,
    }).reason,
    "last_sync_failed",
  );
  assert.equal(
    deriveIntegrationHealth({ available: false }).reason,
    "integration_not_available",
  );
  assert.equal(
    deriveIntegrationHealth({ available: true }).reason,
    "not_connected",
  );
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

test("el contrato de autorizacion conserva la estrategia futura de Instagram", () => {
  const context: import("./index.js").IntegrationAuthorizationContext = {
    organizationId: "org-1",
    redirectUri: "https://api.example.com/callback",
    state: "state-1",
    authStrategy: "instagram_login",
  };
  assert.equal(context.authStrategy, "instagram_login");
});

test("el catalogo expone las dos estrategias oficiales de Instagram", () => {
  assert.deepEqual(
    INTEGRATION_CATALOG.find((provider) => provider.id === "instagram")
      ?.capabilities.authStrategies,
    ["instagram_login", "facebook_login"],
  );
});

test("el contrato de Instagram separa hosts, dependencia de pagina y limitaciones", () => {
  assert.equal(INSTAGRAM_AUTH_STRATEGY_CONTRACTS.length, 2);
  assert.deepEqual(getInstagramAuthStrategyContract("facebook_login"), {
    strategy: "facebook_login",
    apiHost: "graph.facebook.com",
    requiresLinkedFacebookPage: true,
    supportedScopes: [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_comments",
      "instagram_manage_insights",
    ],
    limitations: ["professional_account_only"],
  });
  assert.ok(
    getInstagramAuthStrategyContract("instagram_login").limitations.includes(
      "ads_and_tagging_unavailable",
    ),
  );
});

test("declara refresh OAuth solo donde el adaptador lo soporta", () => {
  assert.equal(
    INTEGRATION_CATALOG.find((provider) => provider.id === "shopify")
      ?.capabilities.tokenRefresh,
    true,
  );
  assert.equal(
    INTEGRATION_CATALOG.find((provider) => provider.id === "meta_ads")
      ?.capabilities.tokenRefresh,
    false,
  );
  assert.equal(
    INTEGRATION_CATALOG.find((provider) => provider.id === "klaviyo")
      ?.capabilities.tokenRefresh,
    true,
  );
});

test("el allowlist distingue el conector implementado del no implementado", () => {
  assert.equal(isIntegrationFeatureEnabled("shopify"), true);
  assert.equal(isIntegrationFeatureEnabled("meta_ads"), false);
  assert.equal(isIntegrationFeatureEnabled("klaviyo"), false);
  assert.equal(isIntegrationFeatureEnabled("fathom"), true);
  assert.equal(isIntegrationFeatureEnabled("meta_ads", "shopify"), false);
  assert.equal(
    isIntegrationFeatureEnabled("shopify", " SHOPIFY, META_ADS "),
    true,
  );
  assert.equal(
    isIntegrationFeatureEnabled("meta_ads", "integration.meta_ads"),
    true,
  );
  assert.equal(isIntegrationFeatureEnabled("klaviyo", "shopify,klaviyo"), true);
  assert.equal(isIntegrationFeatureEnabled("instagram", "instagram"), false);
});

test("una conexion 'syncing' con un error posterior al ultimo sync esta colgada, no sincronizando", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");

  // Caso real: una tienda con app personalizada sin credenciales configuradas
  // se queda en `syncing` para siempre, con su error escrito al lado, y la
  // interfaz la pintaba en gris como si estuviera trabajando.
  assert.equal(
    deriveIntegrationHealth({
      available: true,
      connectionStatus: "syncing",
      lastErrorAt: "2026-09-10T11:00:00.000Z",
      now,
    }).status,
    "degraded",
  );

  // Un sync en marcha despues de haber arreglado el error sigue siendo un sync.
  assert.equal(
    deriveIntegrationHealth({
      available: true,
      connectionStatus: "syncing",
      lastErrorAt: "2026-09-10T10:00:00.000Z",
      lastSyncAt: "2026-09-10T11:30:00.000Z",
      now,
    }).status,
    "syncing",
  );
});
