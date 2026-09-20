import assert from "node:assert/strict";
import test from "node:test";
import { restraintDecisionViewModel, restraintDecisionTone } from "./restraint-decision-view-model";

test("F7.14 conserva decision, frontera, evidencia y coste de espera", () => {
  const model = restraintDecisionViewModel({ disposition: "DECISION_AVAILABLE", decision: "WAIT", scope: "retention", result: { rationale: "cohort", wait_reason: "maturation", review_condition: "next cycle", decision_critical_question: "does retention recover", evidence_needed: ["outcome"], evidence_path: ["observe"], completion_condition: "interpretable", cost_of_delay_consideration: "low", what_not_to_change: ["pricing"] } });
  assert.equal(model.decision, "WAIT");
  assert.equal(model.waitReason, "maturation");
  assert.deepEqual(model.evidencePath, ["observe"]);
  assert.deepEqual(model.whatNotToChange, ["pricing"]);
  assert.equal(model.executionAuthorized, false);
});

test("F7.14 tiene tonos visuales estables", () => {
  assert.equal(restraintDecisionTone("NO_ACTION"), "success");
  assert.equal(restraintDecisionTone("WAIT"), "warn");
  assert.equal(restraintDecisionTone("GATHER_EVIDENCE"), "brand");
  assert.equal(restraintDecisionTone("ACT"), "danger");
});
