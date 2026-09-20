import assert from "node:assert/strict";
import test from "node:test";
import { interventionPrioritizationViewModel } from "./intervention-prioritization-view-model.js";

test("F7.03 view model exposes one primary without turning it into execution", () => {
  const model = interventionPrioritizationViewModel({
    disposition: "PRIORITY_AVAILABLE",
    candidate_count: 2,
    primary_priority_candidate_id: "fix-checkout",
    result: { candidate_evaluations: [{ candidate_id: "fix-checkout", priority_tier: "NOW", reason_codes: [], unresolved_unknowns: [] }] },
  });
  assert.equal(model.primary, "fix-checkout");
  assert.equal(model.candidates[0]?.priority_tier, "NOW");
});

test("F7.03 view model keeps validation state visible", () => {
  const model = interventionPrioritizationViewModel({ disposition: "VALIDATION_REQUIRED", candidate_count: 1, unresolved_unknowns: ["candidate:impact"] });
  assert.equal(model.primary, null);
  assert.deepEqual(model.unknowns, ["candidate:impact"]);
});
