import assert from "node:assert/strict";
import test from "node:test";
import { evaluateInterventionTestExecute, type InterventionTestExecuteInput } from "./intervention-test-execute.js";

const base: InterventionTestExecuteInput = {
  candidate_id: "checkout@1", candidate_intervention: "Improve checkout form", known_defect: "NOT_CONFIRMED", evidence_strength: "qualitative", evidence_sufficiency: "INSUFFICIENT", remaining_uncertainty: ["mechanism works"], decision_relevance: "YES", downside: ["conversion friction"], reversibility: ["feature flag"], blast_radius: ["checkout"], cost_of_error: ["moderate"], cost_of_delay: ["opportunity"], value_of_learning: ["change prioritization"], measurement_capability: "READY", traffic_volume: "sufficient for directional learning", resources: ["developer"], existing_evidence: ["session recordings"], context_similarity: "HIGH", guardrails: ["contribution", "returns"], guardrail_status: "PASS", urgency: "MEDIUM", current_experiments: [], business_priority: ["checkout"], economics_screen: "PLAUSIBLE", testability: "HIGH", implementation_fidelity: "READY", contamination: [], segment_relevance: ["mobile"], primary_outcome: "completed checkout", guardrail_outcomes: ["contribution remains acceptable"], measurement_requirement: "validated checkout events", hypothesis: "If checkout friction is reduced because form errors are clearer, completed checkout improves while contribution remains acceptable", learning_question: "Does clearer error recovery improve completed checkout?", decision_after_result: ["expand if outcome and guardrails hold", "modify if mixed", "stop if guardrail worsens"], exposure_mode: "limited relevant segment", pilot_scope: "mobile checkout", observation_requirement: "observe through conversion lag", observation_state: "NOT_APPLICABLE", evidence_reuse: "recordings inform mechanism", transferability_caveat: "mobile evidence may not transfer to desktop", experiment_cost: "moderate", experimentability: "HIGH", execution_uncertainty: "LOW", intervention_scale: "SMALL", experiment_type: "COMPONENT", sequence_handoff: ["Hypothesis -> Limited Exposure -> Evidence -> Gate"], unresolved_unknowns: [], evidence_refs: ["evidence:recordings"], source_refs: ["source:smoke"],
};

test("F7.08 known harmful defects are fixed, not tested", () => {
  const result = evaluateInterventionTestExecute({ ...base, known_defect: "CONFIRMED", guardrail_status: "PASS" });
  assert.equal(result.recommended_mode, "FIX");
  assert.ok(result.rationale.includes("DEFECT.FIX_DIRECTLY"));
  assert.equal(result.execution_authorized, false);
});

test("F7.08 clear hypothesis and measurable uncertainty choose TEST", () => {
  const result = evaluateInterventionTestExecute(base);
  assert.equal(result.recommended_mode, "TEST");
  assert.match(result.hypothesis, /because/);
  assert.deepEqual(result.decision_path.after_result, base.decision_after_result);
});

test("F7.08 large or materially uncertain interventions choose PILOT", () => {
  const result = evaluateInterventionTestExecute({ ...base, intervention_scale: "LARGE", execution_uncertainty: "MATERIAL" });
  assert.equal(result.recommended_mode, "PILOT");
});

test("F7.08 broken measurement gathers evidence first", () => {
  const result = evaluateInterventionTestExecute({ ...base, measurement_capability: "MISSING" });
  assert.equal(result.recommended_mode, "GATHER_EVIDENCE");
  assert.ok(result.rationale.includes("MEASUREMENT.IMPROVE_BEFORE_INTERVENING"));
});

test("F7.08 failed economics or guardrails do not proceed", () => {
  assert.equal(evaluateInterventionTestExecute({ ...base, economics_screen: "IMPOSSIBLE" }).recommended_mode, "DO_NOT_PROCEED");
  assert.equal(evaluateInterventionTestExecute({ ...base, guardrail_status: "FAIL" }).recommended_mode, "DO_NOT_PROCEED");
});

test("F7.08 immature observation waits without authorizing a change", () => {
  const result = evaluateInterventionTestExecute({ ...base, observation_state: "IMMATURE", urgency: "LOW" });
  assert.equal(result.recommended_mode, "WAIT_OBSERVE");
  assert.equal(result.execution_authorized, false);
});
