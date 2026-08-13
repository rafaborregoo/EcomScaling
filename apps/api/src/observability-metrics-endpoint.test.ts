import assert from "node:assert/strict";
import { after, before, test } from "node:test";

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
process.env.INTERNAL_API_SECRET = "metrics-test-secret";

const { buildApp } = await import("./server.js");
const app = await buildApp();

before(async () => {
  await app.ready();
});

after(async () => {
  await app.close();
});

test("protege las métricas internas y devuelve contadores Prometheus", async () => {
  const unauthorized = await app.inject({
    method: "GET",
    url: "/health/metrics",
  });
  assert.equal(unauthorized.statusCode, 401);

  const health = await app.inject({ method: "GET", url: "/health/live" });
  assert.equal(health.statusCode, 200);
  assert.match(String(health.headers["x-request-id"] ?? ""), /.+/);

  const authorized = await app.inject({
    method: "GET",
    url: "/health/metrics",
    headers: { "x-internal-secret": "metrics-test-secret" },
  });
  assert.equal(authorized.statusCode, 200);
  assert.match(String(authorized.headers["content-type"] ?? ""), /text\/plain/);
  assert.match(authorized.body, /http_requests_total/);
  assert.match(authorized.body, /route="\/health\/live"/);
});

test("x-request-id es legible por el navegador cross-origin", async () => {
  // Poner la cabecera no basta: sin Access-Control-Expose-Headers el
  // navegador se la oculta al codigo de `apps/web`, asi que soporte no puede
  // correlacionar el error que ve un cliente con el log del servidor.
  const response = await app.inject({
    method: "GET",
    url: "/health/live",
    headers: { origin: "http://localhost:3001" },
  });

  assert.equal(response.statusCode, 200);
  assert.match(
    String(response.headers["access-control-expose-headers"] ?? ""),
    /x-request-id/i,
  );
});
