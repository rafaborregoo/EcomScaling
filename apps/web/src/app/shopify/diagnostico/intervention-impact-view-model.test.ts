import assert from "node:assert/strict";
import test from "node:test";
import { interventionImpactViewModel } from "./intervention-impact-view-model";

test("preserves primary and causal trace", () => {
    const model = interventionImpactViewModel({ disposition: "IMPACTS_AVAILABLE", candidate_count: 1, primary_priority_candidate_id: "p-1", result: { candidate_evaluations: [{ candidate_id: "p-1", disposition: "SUPPORTED_QUALITATIVE", impact_trace: { mechanism_refs: ["m-1"] } }] } });
    assert.equal(model.primary, "p-1");
    assert.deepEqual(model.candidates[0]?.impact_trace?.mechanism_refs, ["m-1"]);
});
test("keeps validation unknowns visible", () => {
    const model = interventionImpactViewModel({ disposition: "VALIDATION_REQUIRED", candidate_count: 1, unresolved_unknowns: ["counterfactual"] });
    assert.equal(model.disposition, "VALIDATION_REQUIRED");
    assert.deepEqual(model.unknowns, ["counterfactual"]);
});
