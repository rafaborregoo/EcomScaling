import assert from "node:assert/strict";
import test from "node:test";
import { checkHttpSlo, sanitizeOpsHealthDetails } from "./ops-health-check.js";

test("sanitiza detalles de operaciones antes de persistirlos", () => {
  const sanitized = sanitizeOpsHealthDetails({
    organization_id: "org-1",
    access_token: "secret-token",
    error_message:
      "Bearer embedded-token https://provider.test/callback?api_key=abc123",
    nested: [{ client_secret: "secret", message: "safe" }],
  });

  assert.deepEqual(sanitized, {
    organization_id: "org-1",
    access_token: "[REDACTED]",
    error_message:
      "Bearer [REDACTED] https://provider.test/callback?api_key=[REDACTED]",
    nested: [{ client_secret: "[REDACTED]", message: "safe" }],
  });
});

test("limita strings de detalle para proteger artifacts e incidencias operativas", () => {
  const sanitized = sanitizeOpsHealthDetails({ message: "x".repeat(2_500) });
  assert.equal(typeof sanitized.message, "string");
  assert.ok((sanitized.message as string).length <= 2_000);
});

test("checkHttpSlo: se omite sin API_BASE_URL/INTERNAL_API_SECRET configurados", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    throw new Error("no deberia llamarse");
  }) as typeof fetch;

  const findings = await checkHttpSlo({}, fetchImpl);
  assert.deepEqual(findings, []);
  assert.equal(calls, 0);
});

test("checkHttpSlo: sin findings cuando el SLO esta ok", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ status: "ok" }), { status: 200 })) as typeof fetch;

  const findings = await checkHttpSlo(
    { API_BASE_URL: "https://api.test", INTERNAL_API_SECRET: "secret" },
    fetchImpl,
  );
  assert.deepEqual(findings, []);
});

test("checkHttpSlo: reporta finding degradado con el secreto interno correcto", async () => {
  let receivedUrl = "";
  let receivedSecret: string | null = null;
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    receivedUrl = url.toString();
    receivedSecret = (init?.headers as Record<string, string>)?.["x-internal-secret"] ?? null;
    return new Response(
      JSON.stringify({
        status: "degraded",
        errorRate: 0.05,
        p95LatencyMs: 1200,
        violations: ["error_rate"],
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  const findings = await checkHttpSlo(
    { API_BASE_URL: "https://api.test", INTERNAL_API_SECRET: "secret" },
    fetchImpl,
  );

  assert.equal(receivedUrl, "https://api.test/health/slo");
  assert.equal(receivedSecret, "secret");
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.type, "http_slo_degraded");
  assert.equal(findings[0]?.runbook, "RB-011-http-slo-degraded.md");
});

test("checkHttpSlo: reporta http_slo_check_failed si la respuesta no es 200", async () => {
  const fetchImpl = (async () => new Response("", { status: 401 })) as typeof fetch;

  const findings = await checkHttpSlo(
    { API_BASE_URL: "https://api.test", INTERNAL_API_SECRET: "wrong" },
    fetchImpl,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.type, "http_slo_check_failed");
});

test("checkHttpSlo: reporta http_slo_check_failed si la peticion lanza (red caida)", async () => {
  const fetchImpl = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  const findings = await checkHttpSlo(
    { API_BASE_URL: "https://api.test", INTERNAL_API_SECRET: "secret" },
    fetchImpl,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.type, "http_slo_check_failed");
});
