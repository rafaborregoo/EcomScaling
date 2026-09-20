import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRestraintDecision, type RestraintDecisionInput } from "./restraint-decision.js";

const base = (over: Partial<RestraintDecisionInput> = {}): RestraintDecisionInput => ({
  context_id: "restraint-context", business_id: "org-a", decision_cycle_id: "cycle-a", scope: "checkout",
  problem_opportunity: "Checkout conversion is below the comparable baseline", current_state: "Stable enough to assess qualitatively", status_quo_expected_value: "Acceptable short-term economics", action_downside: "Implementation risk and opportunity cost", inaction_downside: "Some lost conversion if the issue is real", timing_context: "No immediate deadline", decision_critical_uncertainty: "UNKNOWN", evidence_available: "Existing analytics and qualitative context", evidence_freshness: "FRESH", reversibility: "REVERSIBLE", cost_of_delay: "LOW", information_cost: "LOW", opportunity_value: "MODERATE", constraints: ["Limited analytical attention"], maturity: "EARLY", portfolio_context: "One primary initiative already active", problem_materiality: "MATERIAL", signal_quality: "REPRESENTATIVE", headroom: "AVAILABLE", known_resolution_point: "NONE", natural_resolution: "NONE", decision_critical_question: "What fact would change the next commitment?", existing_evidence_sufficiency: "INSUFFICIENT", evidence_path_options: ["analytics", "targeted observation"], action_low_cost: "YES", action_informative: "YES", urgency: "LOW", current_exposure: "NONE", what_not_to_change: ["Do not change pricing globally"], source_refs: ["restraint:test"], unresolved_unknowns: [], ...over,
});

test("F7.14 chooses NO_ACTION when the signal is noise and the status quo is acceptable", () => {
  const result = evaluateRestraintDecision(base({ problem_materiality: "LOW", signal_quality: "NOISE", headroom: "LOW", action_downside: "HIGH", status_quo_expected_value: "ACCEPTABLE" }));
  assert.equal(result.disposition, "DECISION_AVAILABLE");
  assert.equal(result.decision, "NO_ACTION");
  assert.match(result.what_not_to_change.join(" "), /pricing|scope/i);
  assert.ok(result.future_trigger.length > 0);
});

test("F7.14 chooses WAIT only with a real timing reason and review condition", () => {
  const result = evaluateRestraintDecision(base({ timing_context: "Wait for cohort maturation", known_resolution_point: "Cohort maturity at next natural purchase cycle", natural_resolution: "YES", cost_of_delay: "LOW", decision_critical_uncertainty: "Timing of retention outcome" }));
  assert.equal(result.decision, "WAIT");
  assert.match(result.wait_reason, /cohort|matur/i);
  assert.ok(result.review_condition.length > 0);
  assert.ok(result.future_trigger.length > 0);
});

test("F7.14 gathers only decision-critical evidence and defines the evidence path", () => {
  const result = evaluateRestraintDecision(base({ decision_critical_uncertainty: "Whether the apparent lift is incremental", existing_evidence_sufficiency: "INSUFFICIENT", evidence_path_options: ["analytics", "focused counterfactual check"], information_cost: "LOW", cost_of_delay: "LOW" }));
  assert.equal(result.decision, "GATHER_EVIDENCE");
  assert.ok(result.evidence_needed.length > 0);
  assert.ok(result.evidence_path.length > 0);
  assert.ok(result.completion_condition.length > 0);
});

test("F7.14 prefers ACT_SMALL when uncertainty is high but the action is cheap, reversible and informative", () => {
  const result = evaluateRestraintDecision(base({ decision_critical_uncertainty: "Which mechanism explains the drop", action_low_cost: "YES", action_informative: "YES", reversibility: "REVERSIBLE", cost_of_delay: "HIGH", urgency: "HIGH" }));
  assert.equal(result.decision, "ACT_SMALL");
  assert.match(result.rationale, /reversible|inform/i);
});

test("F7.14 does not confuse No-action, Wait and Gather Evidence", () => {
  const wait = evaluateRestraintDecision(base({ timing_context: "Stabilization window", known_resolution_point: "After current intervention settles", natural_resolution: "YES", decision_critical_uncertainty: "Timing" }));
  const gather = evaluateRestraintDecision(base({ timing_context: "No blocker", known_resolution_point: "NONE", natural_resolution: "NO", decision_critical_uncertainty: "Incrementality", existing_evidence_sufficiency: "INSUFFICIENT" }));
  const noAction = evaluateRestraintDecision(base({ problem_materiality: "LOW", signal_quality: "NOISE", headroom: "LOW", action_downside: "HIGH" }));
  assert.equal(wait.decision, "WAIT");
  assert.equal(gather.decision, "GATHER_EVIDENCE");
  assert.equal(noAction.decision, "NO_ACTION");
});

test("F7.14 requires validation when decision-critical context is unknown", () => {
  const result = evaluateRestraintDecision(base({ decision_critical_uncertainty: "UNKNOWN", problem_materiality: "UNKNOWN" }));
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.ok(result.unresolved_unknowns.includes("problem_materiality"));
  assert.equal(result.execution_authorized, false);
});
