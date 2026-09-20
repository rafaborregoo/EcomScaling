import assert from "node:assert/strict";
import test from "node:test";
import { recommendationConfidenceTone, recommendationConfidenceViewModel } from "./recommendation-confidence-view-model";

test("preserva confianza multidimensional y compromiso", () => {
  const model = recommendationConfidenceViewModel({ disposition: "CONFIDENCE_AVAILABLE", result: { recommendation_confidence: "MEDIUM", diagnosis_confidence: "HIGH", impact_magnitude_confidence: "LOW", scale_confidence: "UNKNOWN", main_uncertainty: "Magnitude", recommendation_form: "TEST_OR_PILOT", commitment_scope: "NARROW", action_implication: "No autoriza ejecución" } });
  assert.equal(model.recommendationConfidence, "MEDIUM"); assert.equal(model.diagnosisConfidence, "HIGH"); assert.equal(model.impactMagnitudeConfidence, "LOW"); assert.equal(model.scaleConfidence, "UNKNOWN"); assert.equal(model.commitmentScope, "NARROW"); assert.equal(model.executionAuthorized, false); assert.equal(recommendationConfidenceTone(model.disposition), "success");
});

test("muestra validación e incertidumbre principal", () => {
  const model = recommendationConfidenceViewModel({ disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["evidence_integrity"], result: { main_uncertainty: "UNKNOWN", recommendation_form: "VALIDATION_REQUIRED" } });
  assert.equal(model.disposition, "VALIDATION_REQUIRED"); assert.deepEqual(model.unknowns, ["evidence_integrity"]); assert.equal(recommendationConfidenceTone(model.disposition), "warn");
});
