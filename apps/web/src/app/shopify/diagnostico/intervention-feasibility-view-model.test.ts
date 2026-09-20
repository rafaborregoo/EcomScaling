import assert from "node:assert/strict";
import test from "node:test";
import { interventionFeasibilityViewModel } from "./intervention-feasibility-view-model";

test("F7.05 view model preserves bottleneck and adaptation", () => {
  const model = interventionFeasibilityViewModel({ disposition: "FEASIBILITY_AVAILABLE", candidate_count: 1, primary_priority_candidate_id: "fix@1.0.0", result: { candidate_evaluations: [{ candidate_id: "fix@1.0.0", disposition: "FEASIBLE_WITH_ADAPTATION", resource_trace: { bottleneck_resources: ["creative"] }, adaptations: [{ kind: "pilot", description: "Top SKU" }] }] } });
  assert.equal(model.primary, "fix@1.0.0");
  assert.deepEqual(model.candidates[0]?.resource_trace?.bottleneck_resources, ["creative"]);
});

test("F7.05 view model keeps validation visible", () => {
  const model = interventionFeasibilityViewModel({ disposition: "VALIDATION_REQUIRED", candidate_count: 1, unresolved_unknowns: ["management:capacity"] });
  assert.equal(model.disposition, "VALIDATION_REQUIRED");
  assert.deepEqual(model.unknowns, ["management:capacity"]);
});
