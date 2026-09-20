import assert from "node:assert/strict";
import test from "node:test";
import { hitlApprovalTone, hitlApprovalViewModel } from "./hitl-approval-view-model.js";

test("F8.02 view-model hace visible el gate y separa ejecución", () => {
  const model = hitlApprovalViewModel({ disposition: "APPROVAL_REQUIRED", autonomy_level: "APPROVAL_GATED", approval_requirement: "APPROVAL", approval_state: "PENDING", approval_gate: true, execution_state: "BLOCKED", unresolved_unknowns: ["authority"], result: { required_approver_type: "finance", escalation_reasons: ["material_action"] } });
  assert.equal(model.approvalGate, true); assert.equal(model.executionState, "BLOCKED"); assert.equal(model.executionAuthorized, false); assert.equal(model.requiredApproverType, "finance"); assert.equal(hitlApprovalTone(model.disposition), "warn");
});
