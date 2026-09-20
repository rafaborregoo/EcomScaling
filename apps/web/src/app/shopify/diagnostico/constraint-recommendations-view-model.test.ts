import assert from "node:assert/strict";
import test from "node:test";
import { constraintRecommendationViewModel, recommendationTone } from "./constraint-recommendations-view-model";

test("F7.11 view model exposes the first run without inventing missing values", () => {
  const model = constraintRecommendationViewModel({ disposition: "CONSTRAINT_RECOMMENDATIONS_AVAILABLE", candidate_count: 1, result: { candidate_evaluations: [{ candidate_id: "scale@1", binding_constraint: "creative capacity", recommended_mode: "REDUCE_SCOPE", feasibility_disposition: "FEASIBLE_WITH_ADAPTATION", best_feasible_recommendation: "Canal principal", deferred_action: "Resto de canales", next_constraint_to_monitor: "fulfillment", rationale: [] }] } });
  assert.equal(model.candidates[0]?.criticalConstraint, "creative capacity");
  assert.equal(model.candidates[0]?.bestFeasible, "Canal principal");
  assert.equal(model.candidates[0]?.deferredAction, "Resto de canales");
  assert.equal(model.candidates[0]?.nextConstraint, "fulfillment");
});

test("F7.11 warning tone covers blocked and validation modes", () => {
  assert.equal(recommendationTone("BLOCKED_BY_HARD_CONSTRAINT"), "danger");
  assert.equal(recommendationTone("VALIDATE_CONSTRAINT"), "warn");
});
