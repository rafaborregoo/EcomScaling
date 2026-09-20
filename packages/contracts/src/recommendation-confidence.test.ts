import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRecommendationConfidence } from "./recommendation-confidence.js";

const base = {
  context_id: "ctx", business_id: "org", decision_cycle_id: "cycle", scope: "checkout", recommendation: "Fix checkout defect",
  diagnosis_confidence: "HIGH", cause_confidence: "HIGH", recommendation_confidence: "HIGH", mechanism_confidence: "HIGH", impact_direction_confidence: "HIGH", impact_magnitude_confidence: "LOW", risk_confidence: "MEDIUM", attribution_confidence: "UNKNOWN", execution_confidence: "HIGH", temporal_confidence: "MEDIUM", durability_confidence: "UNKNOWN", scale_confidence: "UNKNOWN", transferability_confidence: "LOW",
  evidence_quality: "DIRECT_OBSERVATION", evidence_relevance: "DIRECTLY_RELEVANT", evidence_consistency: "CORROBORATED", causal_coherence: "CLEAR", context_fit: "LOCAL", measurement_reliability: "RELIABLE", sample_representativeness: "TARGETED", maturity: "EARLY", risk: "CONTAINED", reversibility: "REVERSIBLE", cost_of_error: "LOW", cost_of_delay: "HIGH", constraints: [], opportunity_cost: "UNKNOWN", feasibility_readiness: "READY", main_uncertainty: "Impact magnitude", contradictory_evidence: [], prior_belief: "Fix addresses the observed defect", new_evidence: "Payment failure reproduced locally", evidence_integrity: "VALID", transfer_context: "Same tenant and checkout flow", source_refs: ["test"], unresolved_unknowns: [], commitment_scope: "LOCAL", commitment_magnitude: "CAREFUL", commitment_velocity: "CONTROLLED", commitment_duration: "INITIAL_WINDOW", recommendation_form: "EXECUTE_CAREFULLY",
};

test("conserva las dimensiones separadas y no crea un score", () => {
  const result = evaluateRecommendationConfidence(base);
  assert.equal(result.disposition, "CONFIDENCE_AVAILABLE");
  assert.equal(result.diagnosis_confidence, "HIGH");
  assert.equal(result.recommendation_confidence, "HIGH");
  assert.equal(result.impact_magnitude_confidence, "LOW");
  assert.equal(result.scale_confidence, "UNKNOWN");
  assert.equal("confidence_score" in result, false);
  assert.equal(result.execution_authorized, false);
});

test("confianza baja y downside alto reducen el compromiso", () => {
  const result = evaluateRecommendationConfidence({ ...base, recommendation_confidence: "LOW", mechanism_confidence: "LOW", risk: "HIGH", reversibility: "IRREVERSIBLE", cost_of_error: "HIGH", cost_of_delay: "LOW" });
  assert.equal(result.disposition, "CONFIDENCE_AVAILABLE");
  assert.equal(result.recommendation_form, "GATHER_EVIDENCE_OR_WAIT");
  assert.equal(result.commitment_scope, "NARROW");
  assert.equal(result.commitment_velocity, "SLOW");
  assert.match(result.action_implication, /no autoriza/i);
});

test("evidencia inválida no actualiza confianza materialmente", () => {
  const result = evaluateRecommendationConfidence({ ...base, evidence_integrity: "INVALID_MEASUREMENT", new_evidence: "Tracking corrupto" });
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.ok(result.reason_codes.includes("CONFIDENCE.EVIDENCE_INVALID"));
  assert.equal(result.execution_authorized, false);
});

test("la actualización puede ser específica por capa", () => {
  const result = evaluateRecommendationConfidence({ ...base, mechanism_confidence: "HIGH", scale_confidence: "LOW", layer_update: "Mechanism worked but warehouse capacity failed", layer_update_effect: "MECHANISM_UP_SCALE_DOWN" });
  assert.equal(result.mechanism_confidence, "HIGH");
  assert.equal(result.scale_confidence, "LOW");
  assert.match(result.layer_update, /warehouse/i);
});

test("exige validación si falta la incertidumbre que puede cambiar la recomendación", () => {
  const result = evaluateRecommendationConfidence({ ...base, main_uncertainty: "UNKNOWN", evidence_quality: "UNKNOWN" });
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.ok(result.unresolved_unknowns.includes("main_uncertainty"));
});
