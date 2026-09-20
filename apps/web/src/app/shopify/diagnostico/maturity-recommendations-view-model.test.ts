import { test } from "node:test";
import assert from "node:assert/strict";
import { maturityRecommendationViewModel, recommendationTone } from "./maturity-recommendations-view-model";

test("F7.10 view model conserva now/later y capability previa", () => {
  const model = maturityRecommendationViewModel({ disposition: "MATURITY_RECOMMENDATIONS_AVAILABLE", candidate_count: 1, result: { candidate_evaluations: [{ candidate_id: "c-1", timing_fit: "LATER", missing_capability: "identity", current_recommendation: "Construir identidad" }] } });
  assert.equal(model.candidates[0]?.timing_fit, "LATER");
  assert.equal(model.candidates[0]?.missing_capability, "identity");
});

test("F7.10 view model marca sofisticación prematura como aviso", () => {
  assert.equal(recommendationTone("SIMPLIFY"), "warn");
  assert.equal(recommendationTone("OPTIMIZE_ALLOCATION"), "neutral");
});
