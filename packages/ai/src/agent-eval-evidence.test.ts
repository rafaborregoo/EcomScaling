import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentEvalEvidencePayload } from "./agent-eval-evidence.js";

const passing = {
  agentCode: "a01_analista_llamadas" as const,
  passed: true,
  checks: 9,
  failed: [],
};

test("serializa la evidencia completa de agentes para AI-26", () => {
  const payload = buildAgentEvalEvidencePayload({
    agentVersionId: "version-1",
    datasetVersion: "2026-08-26.v1",
    evaluationMode: "offline",
    results: [passing],
    overallScore: 1,
    evidence: { source: "deterministic_offline_suite" },
  });

  assert.equal(payload.evaluation.status, "passed");
  assert.deepEqual(payload.evaluation.evaluated_agent_codes, [
    "a01_analista_llamadas",
  ]);
  assert.deepEqual(payload.results[0], {
    agent_code: "a01_analista_llamadas",
    passed: true,
    checks: 9,
    failed: [],
    metrics: {},
  });
});

test("persiste fallos por agente y marca la evaluacion como failed", () => {
  const payload = buildAgentEvalEvidencePayload({
    agentVersionId: "version-1",
    datasetVersion: "2026-08-26.v1",
    evaluationMode: "shadow",
    results: [{ ...passing, passed: false, failed: ["tenant_leak"] }],
  });

  assert.equal(payload.evaluation.status, "failed");
  assert.deepEqual(payload.evaluation.agent_eval_failures, [
    "a01_analista_llamadas:tenant_leak",
  ]);
});

test("rechaza resultados vacios y agentes duplicados", () => {
  assert.throws(
    () =>
      buildAgentEvalEvidencePayload({
        agentVersionId: "version-1",
        datasetVersion: "2026-08-26.v1",
        evaluationMode: "offline",
        results: [],
      }),
    /agent_eval_results_required/,
  );
  assert.throws(
    () =>
      buildAgentEvalEvidencePayload({
        agentVersionId: "version-1",
        datasetVersion: "2026-08-26.v1",
        evaluationMode: "offline",
        results: [passing, passing],
      }),
    /agent_eval_duplicate/,
  );
});
