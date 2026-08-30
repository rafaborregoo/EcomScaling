import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApiEnv, loadWorkerEnv } from "./index.js";

const BASE_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SHOPIFY_API_KEY: "shopify-key",
  SHOPIFY_API_SECRET: "shopify-secret",
  SHOPIFY_SCOPES: "read_products,read_orders",
  SHOPIFY_REDIRECT_URI: "https://example.com/callback",
};

test("loadApiEnv: acepta las variables minimas requeridas y aplica defaults", () => {
  const env = loadApiEnv(BASE_ENV);
  assert.equal(env.API_HOST, "0.0.0.0");
  assert.equal(env.API_PORT, 4000);
  assert.equal(env.WEB_ORIGIN, "http://localhost:3001");
  assert.equal(env.SUPABASE_URL, BASE_ENV.SUPABASE_URL);
  assert.equal(env.META_APP_ID, undefined);
  assert.equal(env.SHOPIFY_CUSTOM_API_KEY, undefined);
});

test("loadApiEnv: usa las variables NEXT_PUBLIC_* como fallback de Supabase", () => {
  const env = loadApiEnv({
    ...BASE_ENV,
    SUPABASE_URL: undefined,
    SUPABASE_PUBLISHABLE_KEY: undefined,
    NEXT_PUBLIC_SUPABASE_URL: "https://fallback.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fallback-key",
  });
  assert.equal(env.SUPABASE_URL, "https://fallback.supabase.co");
  assert.equal(env.SUPABASE_PUBLISHABLE_KEY, "fallback-key");
});

test("loadApiEnv: falla si no hay SUPABASE_URL ni NEXT_PUBLIC_SUPABASE_URL", () => {
  assert.throws(
    () => loadApiEnv({ ...BASE_ENV, SUPABASE_URL: undefined }),
    /SUPABASE_URL/,
  );
});

test("loadApiEnv: falla si falta SHOPIFY_API_KEY", () => {
  assert.throws(
    () => loadApiEnv({ ...BASE_ENV, SHOPIFY_API_KEY: undefined }),
    /SHOPIFY_API_KEY/,
  );
});

test("loadApiEnv: una variable opcional presente pero vacia cuenta como no configurada", () => {
  // Los .env suelen copiarse de .env.example con claves opcionales en blanco
  // (META_APP_ID=), no ausentes del todo.
  const env = loadApiEnv({ ...BASE_ENV, META_APP_ID: "" });
  assert.equal(env.META_APP_ID, undefined);
});

test("loadApiEnv: propaga una versiÃ³n Shopify vÃ¡lida", () => {
  const env = loadApiEnv({ ...BASE_ENV, SHOPIFY_API_VERSION: "2026-10" });
  assert.equal(env.SHOPIFY_API_VERSION, "2026-10");
});

test("loadApiEnv: rechaza una versiÃ³n Shopify mal formada", () => {
  assert.throws(
    () => loadApiEnv({ ...BASE_ENV, SHOPIFY_API_VERSION: "latest" }),
    /SHOPIFY_API_VERSION/,
  );
});

test("loadApiEnv: falla si solo parte de las variables custom de Shopify estan seteadas", () => {
  assert.throws(
    () =>
      loadApiEnv({
        ...BASE_ENV,
        SHOPIFY_CUSTOM_API_KEY: "custom-key",
      }),
    /SHOPIFY_CUSTOM_API_KEY.*deben estar todas seteadas o ninguna/,
  );
});

test("loadApiEnv: incluye las variables custom de Shopify cuando las 4 estan seteadas", () => {
  const env = loadApiEnv({
    ...BASE_ENV,
    SHOPIFY_CUSTOM_API_KEY: "custom-key",
    SHOPIFY_CUSTOM_API_SECRET: "custom-secret",
    SHOPIFY_CUSTOM_SCOPES: "read_products",
    SHOPIFY_CUSTOM_REDIRECT_URI: "https://example.com/custom-callback",
  });
  assert.equal(env.SHOPIFY_CUSTOM_API_KEY, "custom-key");
  assert.equal(
    env.SHOPIFY_CUSTOM_REDIRECT_URI,
    "https://example.com/custom-callback",
  );
});

test("loadApiEnv: falla si solo parte de las variables de Meta estan seteadas", () => {
  assert.throws(
    () =>
      loadApiEnv({
        ...BASE_ENV,
        META_APP_ID: "meta-app-id",
        META_APP_SECRET: "meta-secret",
      }),
    /META_APP_ID.*deben estar todas seteadas o ninguna/,
  );
});

test("loadApiEnv: aplica META_SCOPES por defecto cuando las 3 variables de Meta estan pero META_SCOPES no", () => {
  const env = loadApiEnv({
    ...BASE_ENV,
    META_APP_ID: "meta-app-id",
    META_APP_SECRET: "meta-secret",
    META_REDIRECT_URI: "https://example.com/meta-callback",
  });
  assert.equal(env.META_SCOPES, "ads_read,business_management,pages_show_list");
});

test("loadApiEnv: respeta META_SCOPES explicito en vez del default", () => {
  const env = loadApiEnv({
    ...BASE_ENV,
    META_APP_ID: "meta-app-id",
    META_APP_SECRET: "meta-secret",
    META_REDIRECT_URI: "https://example.com/meta-callback",
    META_SCOPES: "ads_read",
  });
  assert.equal(env.META_SCOPES, "ads_read");
});

test("loadApiEnv: propaga una versiÃ³n Graph Meta vÃ¡lida", () => {
  const env = loadApiEnv({
    ...BASE_ENV,
    META_APP_ID: "meta-app-id",
    META_APP_SECRET: "meta-secret",
    META_REDIRECT_URI: "https://example.com/meta-callback",
    META_GRAPH_VERSION: "v24.0",
  });
  assert.equal(env.META_GRAPH_VERSION, "v24.0");
});

test("loadApiEnv: rechaza una versiÃ³n Graph Meta mal formada", () => {
  assert.throws(
    () => loadApiEnv({ ...BASE_ENV, META_GRAPH_VERSION: "graph-latest" }),
    /META_GRAPH_VERSION/,
  );
});

test("loadApiEnv: conserva el modo asíncrono de Insights solo con Meta completo", () => {
  const env = loadApiEnv({
    ...BASE_ENV,
    META_APP_ID: "meta-app-id",
    META_APP_SECRET: "meta-secret",
    META_REDIRECT_URI: "https://example.com/meta-callback",
    META_INSIGHTS_MODE: "async",
  });
  assert.equal(env.META_INSIGHTS_MODE, "async");
});

test("loadApiEnv: exige la configuración completa de Klaviyo OAuth", () => {
  assert.throws(
    () =>
      loadApiEnv({
        ...BASE_ENV,
        KLAVIYO_CLIENT_ID: "klaviyo-client",
        KLAVIYO_CLIENT_SECRET: "klaviyo-secret",
      }),
    /KLAVIYO_CLIENT_ID.*deben estar todas seteadas o ninguna/,
  );
});

test("loadApiEnv: aplica scopes de lectura de Klaviyo cuando OAuth está configurado", () => {
  const env = loadApiEnv({
    ...BASE_ENV,
    KLAVIYO_CLIENT_ID: "klaviyo-client",
    KLAVIYO_CLIENT_SECRET: "klaviyo-secret",
    KLAVIYO_REDIRECT_URI: "https://example.com/klaviyo-callback",
  });
  assert.equal(
    env.KLAVIYO_SCOPES,
    "accounts:read flows:read campaigns:read forms:read lists:read segments:read metrics:read",
  );
});

test("loadApiEnv: conserva el allowlist de feature flags de integraciones", () => {
  const env = loadApiEnv({
    ...BASE_ENV,
    INTEGRATION_FEATURE_FLAGS: "shopify,meta_ads",
  });
  assert.equal(env.INTEGRATION_FEATURE_FLAGS, "shopify,meta_ads");
});

test("loadApiEnv: conserva el routing IA opcional sin exigir proveedores", () => {
  const routing = JSON.stringify({
    a02_monitor_negocio: {
      anthropicModel: "claude-sonnet-4-5",
      maxCostUsd: 0.5,
    },
  });
  const env = loadApiEnv({ ...BASE_ENV, AI_MODEL_ROUTING_JSON: routing });
  assert.equal(env.AI_MODEL_ROUTING_JSON, routing);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
});

test("loadApiEnv: conserva el modelo Anthropic global opcional", () => {
  const env = loadApiEnv({
    ...BASE_ENV,
    ANTHROPIC_MODEL: "claude-sonnet-5",
  });
  assert.equal(env.ANTHROPIC_MODEL, "claude-sonnet-5");
});

test("loadApiEnv: conserva los presupuestos IA por plan sin exigir proveedores", () => {
  const budgets = JSON.stringify({ starter: { dailyBudgetUsd: 8 } });
  const env = loadApiEnv({ ...BASE_ENV, AI_PLAN_BUDGETS_JSON: budgets });
  assert.equal(env.AI_PLAN_BUDGETS_JSON, budgets);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
});

test("loadApiEnv: mantiene direct por contrato y permite activar LangGraph explícitamente", () => {
  const direct = loadApiEnv({ ...BASE_ENV });
  assert.equal(direct.AI_ORCHESTRATION_MODE, undefined);

  const langgraph = loadApiEnv({
    ...BASE_ENV,
    AI_ORCHESTRATION_MODE: "langgraph",
  });
  assert.equal(langgraph.AI_ORCHESTRATION_MODE, "langgraph");
  assert.equal(langgraph.ANTHROPIC_API_KEY, undefined);
});

test("loadApiEnv: rechaza un modo de orquestación desconocido", () => {
  assert.throws(
    () => loadApiEnv({ ...BASE_ENV, AI_ORCHESTRATION_MODE: "experimental" }),
    /AI_ORCHESTRATION_MODE/,
  );
});

test("loadWorkerEnv: aplica defaults de REDIS_URL y API_URL cuando no estan seteados", () => {
  const env = loadWorkerEnv({});
  assert.equal(env.REDIS_URL, "redis://localhost:6379");
  assert.equal(env.API_URL, "http://localhost:4000");
});

test("loadWorkerEnv: respeta REDIS_URL y API_URL explicitos", () => {
  const env = loadWorkerEnv({
    REDIS_URL: "redis://custom-host:6380",
    API_URL: "https://api.example.com",
  });
  assert.equal(env.REDIS_URL, "redis://custom-host:6380");
  assert.equal(env.API_URL, "https://api.example.com");
});
