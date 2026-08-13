import assert from "node:assert/strict";
import test from "node:test";
import {
  createLogger,
  createMetricsRegistry,
  redactSensitive,
  redactSensitiveText,
} from "./index.js";

test("agrega contadores por etiquetas y exporta formato Prometheus estable", () => {
  const metrics = createMetricsRegistry();
  metrics.increment("http_requests_total", { status: 200, route: "/health" });
  metrics.increment(
    "http_requests_total",
    { route: "/health", status: 200 },
    2,
  );
  metrics.increment("http_requests_total", { route: "/health", status: 500 });

  assert.deepEqual(metrics.snapshot(), [
    {
      name: "http_requests_total",
      labels: { status: 200, route: "/health" },
      value: 3,
    },
    {
      name: "http_requests_total",
      labels: { route: "/health", status: 500 },
      value: 1,
    },
  ]);
  assert.equal(
    metrics.toPrometheus(),
    'http_requests_total{route="/health",status="200"} 3\nhttp_requests_total{route="/health",status="500"} 1',
  );
});

test("rechaza incrementos inválidos", () => {
  const metrics = createMetricsRegistry();
  assert.throws(() => metrics.increment("bad", {}, -1), /finite non-negative/);
  assert.throws(
    () => metrics.increment("bad", {}, Number.NaN),
    /finite non-negative/,
  );
});

test("redacta secretos anidados antes de serializar logs", () => {
  assert.deepEqual(
    redactSensitive({
      organization_id: "org-1",
      access_token: "token-value",
      nested: { client_secret: "secret-value", safe: "ok" },
      rows: [{ apiKey: "key-value", value: 1 }],
    }),
    {
      organization_id: "org-1",
      access_token: "[REDACTED]",
      nested: { client_secret: "[REDACTED]", safe: "ok" },
      rows: [{ apiKey: "[REDACTED]", value: 1 }],
    },
  );
});

test("createLogger no imprime metadatos sensibles", () => {
  const originalLog = console.log;
  const lines: string[] = [];
  console.log = (line?: unknown) => lines.push(String(line));
  try {
    createLogger("test").info("request", {
      authorization: "Bearer secret",
      organization_id: "org-1",
    });
  } finally {
    console.log = originalLog;
  }

  assert.match(lines[0] ?? "", /\[REDACTED\]/);
  assert.doesNotMatch(lines[0] ?? "", /Bearer secret/);
  assert.match(lines[0] ?? "", /org-1/);
});

test("redacta credenciales embebidas en texto de error", () => {
  assert.equal(
    redactSensitiveText(
      "Bearer super-secret https://example.test/callback?access_token=abc123&ok=1",
    ),
    "Bearer [REDACTED] https://example.test/callback?access_token=[REDACTED]&ok=1",
  );
});
