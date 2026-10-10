import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_JUDGE_RUBRICS } from "@e-nora/ai";
import { agentJudgeEvalCaseInputSchema, validateAgentJudgeEvalLabels } from "./agent-judge-dataset.js";

const agent = "a05_estrategia_campanas" as const;
const rubric = AGENT_JUDGE_RUBRICS[agent];
const labels = rubric.map((criterion) => ({ criterion_id: criterion.id, score: 3, status: "evaluable" as const, critical_failure: false, rationale: "La evidencia respalda esta valoración.", evidence_refs: ["evidence.metric"] }));
const caseInput = (overrides: Record<string, unknown> = {}) => ({
  agent_code: agent, dataset_version: "judge-gold-v1", rubric_version: "judge-rubrics-v1", split: "development",
  provenance: "synthetic", privacy_reviewed: false, scenario: "Plan ante una campaña estacional.",
  evidence: { metric: "ventas estables" }, artifact: { plan: "preparación y seguimiento" }, ...overrides,
});

test("blind dataset accepts synthetic development fixtures and rejects synthetic holdout", () => {
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(caseInput()).success, true);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(caseInput({ split: "holdout" })).success, false);
});

test("blind dataset requires privacy review and rejects likely personal data", () => {
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(caseInput({ provenance: "anonymized_production", privacy_reviewed: false })).success, false);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(caseInput({ provenance: "anonymized_production", privacy_reviewed: true, evidence: { metric: "contacto@empresa.es" } })).success, false);
});

test("gold labels must cover the rubric and point to evidence that exists", () => {
  assert.equal(validateAgentJudgeEvalLabels(agent, labels, { metric: "ventas" }, { plan: "acciones" }).ok, true);
  assert.deepEqual(validateAgentJudgeEvalLabels(agent, labels.slice(1), { metric: "ventas" }, { plan: "acciones" }), { ok: false, detail: "criterion_set_mismatch" });
  const badReference = labels.map((label, index) => index ? label : { ...label, evidence_refs: ["evidence.missing"] });
  assert.deepEqual(validateAgentJudgeEvalLabels(agent, badReference, { metric: "ventas" }, { plan: "acciones" }), { ok: false, detail: `evidence_reference_not_found:${rubric[0]!.id}` });
});

test("critical failure requires a critical criterion scored at most one", () => {
  const criticalIndex = rubric.findIndex((criterion) => criterion.critical);
  const invalid = labels.map((label, index) => index === criticalIndex ? { ...label, score: 3, critical_failure: true } : label);
  assert.deepEqual(validateAgentJudgeEvalLabels(agent, invalid, { metric: "ventas" }, { plan: "acciones" }), { ok: false, detail: "invalid_critical_failure" });
});
