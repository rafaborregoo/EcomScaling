import assert from "node:assert/strict";
import test from "node:test";
import { buildRecommendationConfidenceContext, recommendationConfidenceInputFromSources } from "./recommendation-confidence-engine.js";

test("F7.17 conserva contexto upstream y ciclo diario", () => {
  const context = buildRecommendationConfidenceContext("org-a", { context_id: "ctx:p15", decision_cycle_id: "cycle:p15", source_refs: ["outcome:p15"] }, "2026-09-20T11:00:00.000Z");
  assert.equal(context.business_id, "org-a"); assert.equal(context.as_of, "2026-09-20T00:00:00.000Z"); assert.equal(context.decision_cycle_id, "cycle:p15"); assert.ok(context.source_refs.includes("f7-p17.v1"));
});

test("F7.17 usa únicamente confidence declarada por el tenant", () => {
  const context = buildRecommendationConfidenceContext("org-a", {}, "2026-09-20T11:00:00.000Z");
  const input = recommendationConfidenceInputFromSources({ template_id: "checkout", template_version: "1", domain_extension: { recommendation_confidence: { recommendation: "Fix checkout", recommendation_confidence: "HIGH", main_uncertainty: "Magnitude", evidence_quality: "DIRECT", commitment_scope: "LOCAL" } } } as any, context, { scope: "checkout", result: { recommendation: "Fallback" }, source_refs: ["outcome:p15"] });
  assert.equal(input.recommendation, "Fix checkout"); assert.equal(input.recommendation_confidence, "HIGH"); assert.equal(input.commitment_scope, "LOCAL"); assert.equal(input.diagnosis_confidence, "UNKNOWN");
});
