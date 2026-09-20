import assert from "node:assert/strict";
import test from "node:test";
import { interventionTestExecuteViewModel } from "./intervention-test-execute-view-model.js";

test("F7.08 view model preserves mode, hypothesis and decision after result", () => {
  const model = interventionTestExecuteViewModel({ disposition: "DECISIONS_AVAILABLE", candidate_count: 1, result: { candidate_evaluations: [{ candidate_id: "checkout@1", recommended_mode: "TEST", hypothesis: "If X because Y, Z improves", decision_after_result: ["expand", "stop"], execution_authorized: false }] } });
  assert.equal(model.candidates[0]?.recommended_mode, "TEST");
  assert.match(model.candidates[0]?.hypothesis ?? "", /because/);
  assert.deepEqual(model.candidates[0]?.decision_after_result, ["expand", "stop"]);
  assert.equal(model.candidates[0]?.execution_authorized, false);
});

test("F7.08 view model keeps missing measurement and contamination visible", () => {
  const model = interventionTestExecuteViewModel({ disposition: "VALIDATION_REQUIRED", candidate_count: 1, unresolved_unknowns: ["measurement_capability"], result: { candidate_evaluations: [{ candidate_id: "checkout@1", recommended_mode: "GATHER_EVIDENCE", contamination: ["promotion changed"], unresolved_unknowns: ["measurement_capability"] }] } });
  assert.deepEqual(model.unknowns, ["measurement_capability"]);
  assert.deepEqual(model.candidates[0]?.contamination, ["promotion changed"]);
});
