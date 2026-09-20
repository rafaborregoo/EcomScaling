import assert from "node:assert/strict";
import test from "node:test";
import { interventionRiskViewModel } from "./intervention-risk-view-model";

test("F7.06 view model preserves exposure and reversibility", () => {
  const model = interventionRiskViewModel({ disposition: "RISK_REQUIRES_MITIGATION", candidate_count: 1, primary_priority_candidate_id: "fix@1", result: { candidate_evaluations: [{ candidate_id: "fix@1", disposition: "RISK_REQUIRES_MITIGATION", blast_radius: { scope: ["mobile"], level: "MATERIAL" }, reversibility_profile: { can_revert: "PARTIAL" }, failure_modes: ["hidden damage"] }] } });
  assert.equal(model.primary, "fix@1");
  assert.deepEqual(model.candidates[0]?.blast_radius?.scope, ["mobile"]);
  assert.equal(model.candidates[0]?.reversibility_profile?.can_revert, "PARTIAL");
});

test("F7.06 keeps validation and unknowns visible", () => {
  const model = interventionRiskViewModel({ disposition: "VALIDATION_REQUIRED", candidate_count: 1, unresolved_unknowns: ["reversibility"] });
  assert.equal(model.disposition, "VALIDATION_REQUIRED");
  assert.deepEqual(model.unknowns, ["reversibility"]);
});
