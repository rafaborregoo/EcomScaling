import assert from "node:assert/strict";
import test from "node:test";
import { interventionSequencingViewModel } from "./intervention-sequencing-view-model";

test("F7.07 view model preserves now, gate and next", () => {
  const model = interventionSequencingViewModel({ disposition: "SEQUENCES_AVAILABLE", candidate_count: 1, primary_priority_candidate_id: "scale@1", result: { candidate_evaluations: [{ candidate_id: "scale@1", disposition: "SEQUENCE_READY", decision_path: { now: ["Confirm tracking"], then: ["Scale checkout"], if_branches: ["ready -> scale"] }, gates: [{ gate_id: "gate-1", condition: "tracking reliable" }] }] } });
  assert.equal(model.primary, "scale@1");
  assert.deepEqual(model.candidates[0]?.decision_path?.now, ["Confirm tracking"]);
  assert.equal(model.candidates[0]?.gates?.[0]?.gate_id, "gate-1");
});

test("F7.07 keeps blockers and validation visible", () => {
  const model = interventionSequencingViewModel({ disposition: "VALIDATION_REQUIRED", candidate_count: 1, unresolved_unknowns: ["sequence_steps"], result: { candidate_evaluations: [{ candidate_id: "scale@1", current_blockers: ["tracking"] }] } });
  assert.deepEqual(model.unknowns, ["sequence_steps"]);
  assert.deepEqual(model.candidates[0]?.current_blockers, ["tracking"]);
});
