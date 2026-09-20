import assert from "node:assert/strict";
import test from "node:test";
import { dynamicDecisionViewModel, dynamicDecisionTone } from "./dynamic-decision-view-model";

test("F7.13 agrupa decisiones y conserva el contexto operativo", () => {
  const model = dynamicDecisionViewModel({ disposition: "DECISIONS_AVAILABLE", overall_decision: "MIXED", unit_count: 2, result: { unit_decisions: [{ unit_id: "a", decision: "SCALE", decision_scope: "checkout", rationale: "positive", decision_qualifiers: ["PROGRESSIVE_SCALE"], scale_limit: "guardrails", next_evidence_needed: ["marginal economics"] }, { unit_id: "b", decision: "ROLLBACK", decision_scope: "retention", rationale: "harm", rollback_target: "previous", decision_qualifiers: ["DAMAGE_CONTROL"] }], next_evidence_needed: ["evidence"] } });
  assert.equal(model.overallDecision, "MIXED");
  assert.equal(model.scaleCount, 1);
  assert.equal(model.rollbackCount, 1);
  assert.equal(model.units[0]?.scaleLimit, "guardrails");
  assert.equal(model.executionAuthorized, false);
});

test("F7.13 tiene tonos estables para decisiones", () => {
  assert.equal(dynamicDecisionTone("SCALE"), "success");
  assert.equal(dynamicDecisionTone("ROLLBACK"), "danger");
  assert.equal(dynamicDecisionTone("CONTINUE"), "warn");
});
