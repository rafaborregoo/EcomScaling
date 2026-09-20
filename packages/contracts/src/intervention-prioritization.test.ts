import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInterventionPrioritizationSet,
  type InterventionPrioritizationInput,
} from "./intervention-prioritization.js";

const candidate = (
  id: string,
  overrides: Partial<InterventionPrioritizationInput> = {},
): InterventionPrioritizationInput => ({
  candidate_id: id,
  matched_disposition: "MATCHED",
  eligibility_disposition: "ELIGIBLE_NOW",
  bottleneck_relation: "BOTTLENECK",
  active_damage: "FALSE",
  expected_impact: "HIGH",
  evidence_quality: "HIGH",
  urgency: "HIGH",
  time_to_value: "FAST",
  effort: "LOW",
  risk: "LOW",
  reversibility: "HIGH",
  dependency_status: "READY",
  learning_value: "MEDIUM",
  resource_fit: "TRUE",
  guardrail_status: "PASS",
  strategic_fit: "HIGH",
  intervention_state: "VALIDATED",
  problem_refs: ["problem-1"],
  dependency_refs: [],
  conditions: [],
  unresolved_unknowns: [],
  evidence_refs: [`evidence-${id}`],
  source_refs: [`source-${id}`],
  ...overrides,
});

const run = (candidates: InterventionPrioritizationInput[]) =>
  evaluateInterventionPrioritizationSet({
    context_id: "ctx-1",
    business_id: "org-1",
    decision_cycle_id: "f7-p03:org-1:2026-09-18",
    candidates,
    evaluated_at: "2026-09-18T10:00:00.000Z",
  });

test("F7.03 chooses one primary intervention only when it dominates qualitatively", () => {
  const result = run([
    candidate("fix-checkout"),
    candidate("rewrite-copy", {
      bottleneck_relation: "SYMPTOM",
      expected_impact: "MEDIUM",
      evidence_quality: "MEDIUM",
      urgency: "MEDIUM",
      time_to_value: "SLOW",
      effort: "HIGH",
    }),
  ]);

  assert.equal(result.disposition, "PRIORITY_AVAILABLE");
  assert.equal(result.primary_priority_candidate_id, "fix-checkout");
  assert.deepEqual(result.ordered_candidate_ids, ["fix-checkout", "rewrite-copy"]);
  assert.equal(result.execution_authorized, false);
  assert.equal(result.candidate_evaluations[1]?.priority_tier, "LATER");
});

test("F7.03 refuses false precision when candidates trade off", () => {
  const result = run([
    candidate("high-impact-slow", { time_to_value: "SLOW", effort: "HIGH" }),
    candidate("fast-learning", {
      expected_impact: "MEDIUM",
      evidence_quality: "MEDIUM",
      time_to_value: "FAST",
      effort: "LOW",
      learning_value: "HIGH",
    }),
  ]);

  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.equal(result.primary_priority_candidate_id, null);
  assert.deepEqual(result.ordered_candidate_ids, []);
  assert.ok(result.reason_codes.includes("PRIORITY.TRADE_OFF_UNRESOLVED"));
});

test("F7.03 lets a critical guardrail veto an otherwise attractive candidate", () => {
  const result = run([candidate("unsafe-change", { guardrail_status: "FAIL" })]);

  assert.equal(result.disposition, "PRIORITY_AVAILABLE");
  assert.equal(result.primary_priority_candidate_id, null);
  assert.equal(result.candidate_evaluations[0]?.priority_tier, "DO_NOT_DO");
  assert.ok(result.candidate_evaluations[0]?.reason_codes.includes("GUARDRAIL.CRITICAL_FAIL"));
});

test("F7.03 preserves unknowns and does not treat them as low", () => {
  const result = run([
    candidate("unknown-context", {
      expected_impact: "UNKNOWN",
      evidence_quality: "UNKNOWN",
      urgency: "UNKNOWN",
      resource_fit: "UNKNOWN",
    }),
  ]);

  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.equal(result.primary_priority_candidate_id, null);
  assert.ok(result.unresolved_unknowns.includes("unknown-context:expected_impact"));
  assert.equal(result.candidate_evaluations[0]?.priority_tier, undefined);
});

test("F7.03 never prioritizes an ineligible or unmatched candidate", () => {
  const result = run([
    candidate("not-eligible", { eligibility_disposition: "INSUFFICIENT_EVIDENCE" }),
    candidate("not-matched", { matched_disposition: "NO_CAUSAL_MATCH" }),
  ]);

  assert.equal(result.disposition, "NO_PRIORIZABLE_CANDIDATES");
  assert.equal(result.primary_priority_candidate_id, null);
  assert.deepEqual(result.ordered_candidate_ids, []);
  assert.ok(result.candidate_evaluations.every((item) => item.priority_tier === "DO_NOT_DO"));
});
