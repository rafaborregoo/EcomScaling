import assert from "node:assert/strict";
import test from "node:test";
import {
  createLogger,
  createMetricsRegistry,
  evaluateHttpSlo,
  redactSensitive,
  sanitizeForTelemetry,
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

test("limita series para evitar crecimiento ilimitado de memoria", () => {
  const metrics = createMetricsRegistry({ maxSeries: 1 });
  metrics.increment("first", { label: "a" });
  metrics.increment("second", { label: "b" });

  assert.deepEqual(metrics.snapshot(), [
    { name: "first", labels: { label: "a" }, value: 1 },
    {
      name: "observability_metric_series_dropped_total",
      labels: {},
      value: 1,
    },
  ]);
});

test("exporta histogramas acumulativos en formato Prometheus", () => {
  const metrics = createMetricsRegistry();
  metrics.observe(
    "http_request_duration_ms",
    { route: "/health" },
    42,
    [25, 50],
  );

  assert.deepEqual(metrics.snapshot(), [
    {
      name: "http_request_duration_ms_bucket",
      labels: { route: "/health", le: 50 },
      value: 1,
    },
    {
      name: "http_request_duration_ms_bucket",
      labels: { route: "/health", le: "+Inf" },
      value: 1,
    },
    {
      name: "http_request_duration_ms_count",
      labels: { route: "/health" },
      value: 1,
    },
    {
      name: "http_request_duration_ms_sum",
      labels: { route: "/health" },
      value: 42,
    },
  ]);
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

test("evalúa error rate y p95 como señal SLO accionable", () => {
  const metrics = createMetricsRegistry();
  metrics.increment("http_requests_total", { status_code: 200 }, 98);
  metrics.increment("http_requests_total", { status_code: 500 }, 2);
  metrics.observe("http_request_duration_ms", {}, 250, [100, 500, 1_000]);
  metrics.observe("http_request_duration_ms", {}, 1_500, [100, 500, 1_000]);

  const report = evaluateHttpSlo(metrics.snapshot(), {
    errorRateBudget: 0.01,
    p95LatencyBudgetMs: 1_000,
  });
  assert.equal(report.status, "degraded");
  assert.equal(report.requestCount, 100);
  assert.equal(report.errorCount, 2);
  assert.deepEqual(report.violations, ["error_rate"]);
});

test("devuelve no_traffic y no inventa una latencia", () => {
  const report = evaluateHttpSlo([]);
  assert.equal(report.status, "no_traffic");
  assert.equal(report.p95LatencyMs, null);
  assert.equal(report.requestCount, 0);
});

// ---------------------------------------------------------------------------
// AI-30: sanitizeForTelemetry. Unica puerta por la que un payload llega a una
// tabla de telemetria (agent_tool_calls.input/output, que iban en crudo).
// ---------------------------------------------------------------------------

test("sanitizeForTelemetry redacta credenciales anidadas", () => {
  const sanitized = sanitizeForTelemetry({
    query: "select 1",
    headers: { authorization: "Bearer secreto", "x-api-key": "abc123" },
    nested: [{ refresh_token: "rt_123" }],
  }) as Record<string, unknown>;

  assert.equal(JSON.stringify(sanitized).includes("secreto"), false);
  assert.equal(JSON.stringify(sanitized).includes("abc123"), false);
  assert.equal(JSON.stringify(sanitized).includes("rt_123"), false);
  // Lo que no es credencial sigue siendo util para depurar.
  assert.equal(sanitized.query, "select 1");
});

test("sanitizeForTelemetry recorta cadenas largas y declara cuanto quito", () => {
  const sanitized = sanitizeForTelemetry(
    { nota: "x".repeat(2_000) },
    { maxStringChars: 50 },
  ) as { nota: string };

  assert.ok(sanitized.nota.length < 100);
  assert.match(sanitized.nota, /\+1950 chars/);
});

test("sanitizeForTelemetry acota arrays largos sin perder la forma", () => {
  const rows = Array.from({ length: 400 }, (_, i) => ({ pedido: i }));
  const sanitized = sanitizeForTelemetry({ rows }) as { rows: unknown[] };

  // 20 filas + la nota de omision: basta para saber que devolvio la tool.
  assert.equal(sanitized.rows.length, 21);
  assert.deepEqual(sanitized.rows[0], { pedido: 0 });
  assert.match(String(sanitized.rows[20]), /380 elementos omitidos/);
});

test("sanitizeForTelemetry corta la profundidad en vez de reventar", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;

  const sanitized = sanitizeForTelemetry(cyclic);
  assert.match(JSON.stringify(sanitized), /TRUNCATED_DEPTH/);
});

test("sanitizeForTelemetry deja pasar los escalares tal cual", () => {
  assert.equal(sanitizeForTelemetry(42), 42);
  assert.equal(sanitizeForTelemetry(null), null);
  assert.equal(sanitizeForTelemetry(true), true);
});
