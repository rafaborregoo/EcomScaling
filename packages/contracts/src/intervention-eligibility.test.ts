import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateInterventionEligibility,
  evaluateInterventionEligibilitySet,
  type InterventionEligibilityInput,
} from "./intervention-eligibility.js";

function input(
  overrides: Partial<InterventionEligibilityInput> = {},
): InterventionEligibilityInput {
  return {
    candidate_id: "template:fix-checkout@v1",
    priority_problem_refs: ["problem:checkout"],
    candidate_problem_refs: ["problem:checkout"],
    diagnosis_sufficient: "TRUE",
    causal_coherence: "TRUE",
    evidence_sufficient: "TRUE",
    critical_constraint_clear: "TRUE",
    dependencies_satisfied: "TRUE",
    resource_fit: "TRUE",
    timing_maturity_fit: "TRUE",
    risk_acceptable: "TRUE",
    strategy_aligned: "TRUE",
    interference_clear: "TRUE",
    materiality: "TRUE",
    conditions: [],
    blockers: [],
    unresolved_unknowns: [],
    evidence_refs: ["diagnostic:output-1"],
    source_refs: ["f3-d14.v1", "f7-01.v1"],
    ...overrides,
  };
}

test("eligibility does not pass a candidate without sufficient diagnosis or evidence", () => {
  const result = evaluateInterventionEligibility(
    input({ diagnosis_sufficient: "UNKNOWN", evidence_sufficient: "UNKNOWN" }),
  );

  assert.equal(result.disposition, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(result.unresolved_unknowns, [
    "diagnosis_sufficient",
    "evidence_sufficient",
  ]);
  assert.equal(result.deterministic, true);
});

test("a hard constraint blocks an intervention without turning it into a recommendation", () => {
  const result = evaluateInterventionEligibility(
    input({
      critical_constraint_clear: "FALSE",
      blockers: ["stock.coverage.critical"],
    }),
  );

  assert.equal(result.disposition, "BLOCKED_BY_CONSTRAINT");
  assert.deepEqual(result.reason_codes, ["CRITICAL_CONSTRAINT_ACTIVE"]);
  assert.equal(result.blockers[0], "stock.coverage.critical");
});

test("causal mismatch is not applicable even when the candidate is otherwise feasible", () => {
  const result = evaluateInterventionEligibility(
    input({ causal_coherence: "FALSE" }),
  );

  assert.equal(result.disposition, "NOT_APPROPRIATE");
  assert.deepEqual(result.reason_codes, ["CAUSAL_FIT_FAILED"]);
});

test("eligible with conditions preserves soft constraints and does not rank candidates", () => {
  const result = evaluateInterventionEligibility(
    input({ conditions: ["limit exposure to tracked SKUs"] }),
  );

  assert.equal(result.disposition, "ELIGIBLE_WITH_CONDITIONS");
  assert.deepEqual(result.conditions, ["limit exposure to tracked SKUs"]);
  assert.equal(result.selected, false);
});

test("a fully supported candidate is eligible now, while unknowns remain explicit", () => {
  const result = evaluateInterventionEligibility(input());

  assert.equal(result.disposition, "ELIGIBLE_NOW");
  assert.deepEqual(result.unresolved_unknowns, []);
  assert.deepEqual(result.evidence_refs, ["diagnostic:output-1"]);
  assert.deepEqual(result.source_refs, ["f3-d14.v1", "f7-01.v1"]);
});

test("the set evaluator exposes candidates without selecting or ranking one", () => {
  const result = evaluateInterventionEligibilitySet({
    context_id: "eligibility-context:org-1:2026-09-18",
    business_id: "org-1",
    decision_cycle_id: "f7-p01:org-1:2026-09-18",
    evaluated_at: "2026-09-18T00:00:00.000Z",
    candidates: [
      input({ candidate_id: "candidate-a" }),
      input({ candidate_id: "candidate-b", evidence_sufficient: "UNKNOWN" }),
    ],
  });

  assert.equal(result.disposition, "CANDIDATES_AVAILABLE");
  assert.deepEqual(result.eligible_candidate_ids, ["candidate-a"]);
  assert.equal(result.candidate_evaluations[0]?.selected, false);
  assert.equal(result.candidate_evaluations[1]?.disposition, "INSUFFICIENT_EVIDENCE");
});
