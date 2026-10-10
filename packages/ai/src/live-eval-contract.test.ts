import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDefaultLiveEvalCases,
  buildLiveAgentEvalEvidencePayload,
  runLiveAgentEvalCase,
  runLiveAgentEvalSuite,
  type LiveAgentEvalCase,
} from "./live-eval-contract.js";
import { ACTIVE_AGENT_CODES } from "./agent-evals.js";
import { AGENT_JUDGE_RUBRICS, finalizeAgentJudgeResult } from "./agent-judge.js";
import { hashLiveAgentEvalOutput } from "./live-eval-contract.js";

// El registro de la suite live/shadow debe permanecer alineado con el catalogo
// activo; el proveedor de eval es inyectable y puede ser un fixture sin API key.
//
// No se sube 11 a 13. Un numero a mano vuelve a caducar con el agente 14, y lo
// que el test dice querer comprobar no es un numero fijo sino "hay un caso por
// agente activo, y ninguno se queda fuera". Eso se compara contra la fuente de
// verdad, que es la misma lista que usa la implementacion.
test("genera un caso base para cada agente activo, sin dejarse ninguno", () => {
  const cases = buildDefaultLiveEvalCases();

  assert.deepEqual(
    cases.map((item) => item.agentCode).sort(),
    [...ACTIVE_AGENT_CODES].sort(),
  );
  assert.equal(
    new Set(cases.map((item) => item.agentCode)).size,
    ACTIVE_AGENT_CODES.length,
  );
  assert.ok(cases.every((item) => item.expectedAbstention));
  assert.ok(cases.every((item) => item.datasetSplit === "smoke"));
});

const testCase: LiveAgentEvalCase = {
  id: "a14-missing-meta",
  agentCode: "a14_operativa_meta",
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

test("valida la evidencia del contrato Camino A19 sin exigir el envelope genérico answer", async () => {
  const result = await runLiveAgentEvalCase({
    id: "a19-camino", agentCode: "a19_arquitecto_camino", objective: "Propón un Camino", expectedAbstention: false,
    evidenceContext: { organizationId: "eval-org", availableSources: [{ reference: "shopify.summary", organizationId: "eval-org" }] },
  }, "shadow", async () => ({
    output: { plan_name: "Camino", diagnosis: "Ventas observadas en shopify.summary.", sources: [{ kind: "metric", reference: "shopify.summary", period: "30d" }], confidence: "medium", warnings: [], phases: [] },
    latencyMs: 50, costUsd: 0.02, traceId: "a19-trace",
  }));
  assert.equal(result.passed, true);
  assert.deepEqual(result.failures, []);
});

test("evalúa A19 revisión con executive_summary y avance determinista del Camino", async () => {
  const result = await runLiveAgentEvalCase({
    id: "a19-review", agentCode: "a19_revision_camino", objective: "Revisa el avance", expectedAbstention: false,
    evidenceContext: { organizationId: "eval-org", availableSources: [] },
  }, "shadow", async () => ({
    output: {
      executive_summary: "El hito de medición sigue en curso.",
      goal_progress: { status: "on_track", observed_value: 1200, comparison_value: 1100, explanation: "Evolución observada." },
      confidence: "medium", warnings: [],
    }, latencyMs: 60, costUsd: 0.02, traceId: "review-trace",
  }));
  assert.equal(result.passed, true);
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
    datasetVersion: "2026-09-29.v2",
    mode: "shadow",
    results: [
      {
        caseId: "case-1",
        agentCode: "a14_operativa_meta",
        datasetSplit: "smoke",
        mode: "shadow",
        passed: true,
        failures: [],
        latencyMs: 250,
        costUsd: 0.03,
        traceId: "trace-1",
        executedAgentCode: null,
        executedAgentVersionId: null,
        executedCandidateFingerprint: null,
        candidateJudgeStatus: null,
        candidateJudgeScore: null,
        candidateJudgeRubricVersion: null,
        candidateJudgedOutputSha256: null,
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
        agent_code: "a14_operativa_meta",
        dataset_split: "smoke",
        latency_ms: 250,
        cost_usd: 0.03,
        trace_id: "trace-1",
        executed_agent_code: null,
        executed_agent_version_id: null,
        executed_candidate_fingerprint: null,
        candidate_judge_status: null,
        candidate_judge_score: null,
        candidate_judge_rubric_version: null,
        candidate_judged_output_sha256: null,
      },
    ],
  });
});

test("una suite live pinned rechaza una versión o huella distinta a la candidata", async () => {
  const candidate = {
    agentVersionId: "candidate-v2",
    agentCode: "a14_operativa_meta" as const,
    candidateFingerprint: "a".repeat(64),
  };
  const result = await runLiveAgentEvalCase(
    testCase,
    "live",
    async (_testCase, _signal, requestedCandidate) => ({
      output: { answer: "No hay datos suficientes.", sources: [], confidence: "low", warnings: ["missing_data"] },
      latencyMs: 20,
      costUsd: 0.01,
      traceId: "candidate-run",
      executedAgentCode: requestedCandidate!.agentCode,
      executedAgentVersionId: requestedCandidate!.agentVersionId,
      executedCandidateFingerprint: "b".repeat(64),
    }),
    undefined,
    candidate,
  );
  assert.equal(result.passed, false);
  assert.ok(result.failures.includes("candidate_fingerprint_mismatch"));
  assert.equal(result.executedAgentVersionId, "candidate-v2");
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

test("a live candidate requires a passing judge result bound to the exact output", async () => {
  const candidate = {
    agentVersionId: "candidate-v2",
    agentCode: testCase.agentCode,
    candidateFingerprint: "a".repeat(64),
  };
  const output = { answer: "No hay datos suficientes.", sources: [], confidence: "low", warnings: ["missing_data"] };
  const candidateJudgment = finalizeAgentJudgeResult(testCase.agentCode, {
    summary: "La salida respeta la evidencia disponible.",
    criteria: AGENT_JUDGE_RUBRICS[testCase.agentCode].map((criterion) => ({
      criterion_id: criterion.id,
      score: 4,
      status: "evaluable" as const,
      rationale: "El artefacto contiene evidencia suficiente para este criterio.",
      evidence_refs: ["$.output.answer"],
      critical_failure: false,
    })),
  }, () => true);
  const accepted = await runLiveAgentEvalCase(testCase, "live", async (_item, _signal, requested) => ({
    output, latencyMs: 20, costUsd: 0.01, traceId: "candidate-run",
    executedAgentCode: requested!.agentCode,
    executedAgentVersionId: requested!.agentVersionId,
    executedCandidateFingerprint: requested!.candidateFingerprint,
    candidateJudgment,
    candidateJudgedOutputSha256: hashLiveAgentEvalOutput(output),
  }), undefined, candidate);
  assert.equal(accepted.passed, true);
  assert.equal(accepted.candidateJudgeStatus, "passed");

  const missing = await runLiveAgentEvalCase(testCase, "live", async (_item, _signal, requested) => ({
    output, latencyMs: 20, costUsd: 0.01, traceId: null,
    executedAgentCode: requested!.agentCode,
    executedAgentVersionId: requested!.agentVersionId,
    executedCandidateFingerprint: requested!.candidateFingerprint,
  }), undefined, candidate);
  assert.equal(missing.passed, false);
  assert.ok(missing.failures.includes("candidate_judgment_missing_or_invalid"));

  const mismatched = await runLiveAgentEvalCase(testCase, "live", async (_item, _signal, requested) => ({
    output, latencyMs: 20, costUsd: 0.01, traceId: null,
    executedAgentCode: requested!.agentCode,
    executedAgentVersionId: requested!.agentVersionId,
    executedCandidateFingerprint: requested!.candidateFingerprint,
    candidateJudgment,
    candidateJudgedOutputSha256: "f".repeat(64),
  }), undefined, candidate);
  assert.equal(mismatched.passed, false);
  assert.ok(mismatched.failures.includes("candidate_judgment_output_mismatch"));

  const scoreSpoof = { ...candidateJudgment, status: "passed" as const, overall_score: 4,
    criteria: candidateJudgment.criteria.map((criterion) => ({ ...criterion, score: 0 })) };
  const inconsistent = await runLiveAgentEvalCase(testCase, "live", async (_item, _signal, requested) => ({
    output, latencyMs: 20, costUsd: 0.01, traceId: null,
    executedAgentCode: requested!.agentCode,
    executedAgentVersionId: requested!.agentVersionId,
    executedCandidateFingerprint: requested!.candidateFingerprint,
    candidateJudgment: scoreSpoof,
    candidateJudgedOutputSha256: hashLiveAgentEvalOutput(output),
  }), undefined, candidate);
  assert.equal(inconsistent.passed, false);
  assert.ok(inconsistent.failures.includes("candidate_judgment_not_passed"));
});
