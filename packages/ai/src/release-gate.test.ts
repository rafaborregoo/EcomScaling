import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateReleaseGate,
  type ReleaseGate,
  type ReleaseEvaluation,
} from "./release-gate.js";

const gate: ReleaseGate = {
  minimumOverallScore: 0.88,
  minimumScores: { toolSelection: 0.95, tenantIsolation: 1 },
  maximumRates: {
    unauthorizedActionRate: 0,
    tenantLeakRate: 0,
    approvalBypassRate: 0,
    regressionFailureRate: 0.02,
  },
  maximumCostIncrease: 0.1,
  maximumLatencyIncrease: 0.2,
};

const passingEvaluation: ReleaseEvaluation = {
  overallScore: 0.91,
  scores: { toolSelection: 0.97, tenantIsolation: 1 },
  rates: {
    unauthorizedActionRate: 0,
    tenantLeakRate: 0,
    approvalBypassRate: 0,
    regressionFailureRate: 0.01,
  },
  costIncrease: 0.05,
  latencyIncrease: 0.12,
};

test("permite activar una version cuando todos los gates pasan", () => {
  assert.deepEqual(evaluateReleaseGate(gate, passingEvaluation), {
    allowed: true,
    reasons: [],
  });
});

test("bloquea fallos criticos y metricas fuera de umbral", () => {
  const decision = evaluateReleaseGate(gate, {
    ...passingEvaluation,
    overallScore: 0.7,
    rates: { ...passingEvaluation.rates, tenantLeakRate: 0.01 },
    criticalFailures: ["approval_bypass"],
  });

  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.reasons, [
    "overallScore:below_minimum:0.7<0.88",
    "rate.tenantLeakRate:above_maximum:0.01>0",
    "critical_failure:approval_bypass",
  ]);
});

test("trata la evidencia ausente como fallo y no como cero", () => {
  const evaluation = { ...passingEvaluation, scores: { toolSelection: 0.99 } };
  const decision = evaluateReleaseGate(gate, evaluation);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("score.tenantIsolation:missing"));
});

test("bloquea activacion si falta cobertura o falla cualquier eval de agente", () => {
  const decision = evaluateReleaseGate(
    { ...gate, requiredAgentCodes: ["a01_analista_llamadas", "a09_copiloto_consultor"] },
    {
      ...passingEvaluation,
      evaluatedAgentCodes: ["a01_analista_llamadas"],
      agentEvalFailures: ["a09_copiloto_consultor:tenant_leak"],
    },
  );

  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.reasons, [
    "agentEvalCoverage:missing:a09_copiloto_consultor",
    "agent_eval_failure:a09_copiloto_consultor:tenant_leak",
  ]);
});
