import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDefaultLiveEvalCases,
  buildLiveAgentEvalEvidencePayload,
  runLiveAgentEvalCase,
  runLiveAgentEvalSuite,
  type LiveAgentEvalCase,
} from "./live-eval-contract.js";

test("genera un caso base para los diez agentes", () => {
  const cases = buildDefaultLiveEvalCases();
  assert.equal(cases.length, 10);
  assert.equal(new Set(cases.map((item) => item.agentCode)).size, 10);
  assert.ok(cases.every((item) => item.expectedAbstention));
});

const testCase: LiveAgentEvalCase = {
  id: "a03-missing-meta",
  agentCode: "a03_analista_adquisicion",
  objective: "Analiza Meta Ads",
  expectedAbstention: true,
  evidenceContext: { organizationId: "eval-org", availableSources: [] },
};

test("no ejecuta live/shadow sin proveedor configurado", async () => {
  await assert.rejects(
    runLiveAgentEvalCase(testCase, "shadow"),
    /live_eval_provider_required/,
  );
});

test("evalua abstencion, evidencia, coste, latencia y trace id", async () => {
  const result = await runLiveAgentEvalCase(testCase, "shadow", async () => ({
    output: {
      answer: "No hay datos suficientes.",
      sources: [],
      confidence: "low",
      warnings: ["meta_not_connected"],
    },
    latencyMs: 120,
    costUsd: 0.01,
    traceId: "trace-1",
  }));

  assert.equal(result.passed, true);
  assert.deepEqual(result.failures, []);
  assert.equal(result.traceId, "trace-1");
});

test("marca una salida que no cumple la abstencion esperada", async () => {
  const result = await runLiveAgentEvalCase(testCase, "live", async () => ({
    output: {
      answer: "Meta gastó 500€.",
      sources: [],
      confidence: "high",
      warnings: [],
    },
    latencyMs: 100,
    costUsd: 0.02,
    traceId: null,
  }));

  assert.equal(result.passed, false);
  assert.ok(result.failures.includes("evidence_contract"));
  assert.ok(result.failures.includes("abstention_expectation"));
});

test("convierte resultados shadow en evidencia AI-26 con coste, latencia y trazas", () => {
  const payload = buildLiveAgentEvalEvidencePayload({
    agentVersionId: "version-1",
    datasetVersion: "2026-08-26.v1",
    mode: "shadow",
    results: [
      {
        caseId: "case-1",
        agentCode: "a03_analista_adquisicion",
        mode: "shadow",
        passed: true,
        failures: [],
        latencyMs: 250,
        costUsd: 0.03,
        traceId: "trace-1",
      },
    ],
  });

  assert.equal(payload.evaluation.status, "passed");
  assert.equal(payload.evaluation.overall_score, 1);
  assert.deepEqual(payload.evaluation.evidence, {
    mode: "shadow",
    cases: [
      {
        case_id: "case-1",
        agent_code: "a03_analista_adquisicion",
        latency_ms: 250,
        cost_usd: 0.03,
        trace_id: "trace-1",
      },
    ],
  });
});

test("ejecuta la suite con concurrencia I/O acotada y conserva errores por caso", async () => {
  const cases = buildDefaultLiveEvalCases().slice(0, 4);
  let active = 0;
  let maxActive = 0;
  const results = await runLiveAgentEvalSuite(
    cases,
    "shadow",
    async (testCase) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      if (testCase.agentCode === "a02_monitor_negocio") {
        throw new Error("provider_timeout");
      }
      return {
        output: {
          answer: "No hay datos suficientes.",
          sources: [],
          confidence: "low",
          warnings: ["missing_data"],
        },
        latencyMs: 20,
        costUsd: 0.01,
        traceId: null,
      };
    },
    2,
  );

  assert.equal(maxActive <= 2, true);
  assert.equal(results.length, 4);
  assert.equal(results[1]?.passed, false);
  assert.ok(results[1]?.failures[0]?.includes("provider_timeout"));
});

test("aplica timeout y retries de la politica comun a cada caso", async () => {
  let attempts = 0;
  const result = await runLiveAgentEvalCase(
    testCase,
    "shadow",
    async () => {
      attempts += 1;
      if (attempts === 1) {
        const transient = Object.assign(new Error("temporarily unavailable"), {
          status: 503,
        });
        throw transient;
      }
      return {
        output: {
          answer: "No hay datos suficientes.",
          sources: [],
          confidence: "low",
          warnings: ["missing_data"],
        },
        latencyMs: 20,
        costUsd: 0.01,
        traceId: null,
      };
    },
    {
      timeoutMs: 100,
      maxRetries: 1,
      baseBackoffMs: 1,
      maxBackoffMs: 2,
      jitterRatio: 0,
    },
  );

  assert.equal(attempts, 2);
  assert.equal(result.passed, true);
});

test("abre circuit breaker tras fallos repetidos del proveedor", async () => {
  const cases = buildDefaultLiveEvalCases();
  let calls = 0;
  const results = await runLiveAgentEvalSuite(
    cases,
    "live",
    async () => {
      calls += 1;
      throw new Error("provider_down");
    },
    1,
    {
      maxConsecutiveProviderFailures: 2,
      policy: {
        timeoutMs: 50,
        maxRetries: 0,
        baseBackoffMs: 1,
        maxBackoffMs: 1,
        jitterRatio: 0,
      },
    },
  );

  assert.equal(calls, 2);
  assert.equal(results[2]?.failures.includes("circuit_open"), true);
});
