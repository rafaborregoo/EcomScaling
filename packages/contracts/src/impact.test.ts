import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateDecisionImpact, type DecisionImpactInputLike } from "./impact.js";

const base: DecisionImpactInputLike = {
  assessment_id: "impact:case-1",
  business_id: "org-1",
  candidate_ref: "case-1",
  as_of: "2026-09-16T12:00:00.000Z",
  value_type: "CONTRIBUTION",
  impact_type: "PROTECT",
  value_state: "POTENTIAL",
  evidence_basis: "MEASURED",
  magnitude: {
    absolute_value: 120000,
    currency: "EUR",
    relative_share: 0.18,
    business_relative_materiality: "HIGH",
  },
  baseline: {
    type: "SEASONALLY_ADJUSTED",
    reference: "baseline:2026-q3",
    counterfactual_method: "EXPECTED_TRAJECTORY",
    confidence: "MEDIUM",
  },
  exposure: [{ dimension: "CONTRIBUTION", share: 0.18, unit_count: null, value_density: "HIGH", source_refs: ["metric:1"] }],
  recoverability: "PARTIAL",
  incrementality: { gross_value: 120000, incremental_value: null, cannibalization: "UNKNOWN", substitution: "UNKNOWN", recapture: "UNKNOWN", counterfactual_present: false },
  scenarios: { best: null, base: 120000, downside: 220000, upside: null, currency: "EUR" },
  confidence: { diagnosis: "HIGH", impact: "MEDIUM", attribution: "UNKNOWN", assumption_sensitivity: ["counterfactual"] },
  assumptions: ["La trayectoria esperada es el baseline disponible"],
  explanation: { what_value: "contribution protegible", mechanism: "fallo sostenido afecta ventas con margen", whose_value: "negocio", horizon: "90d", what_wait_changes: "aumenta la exposición", uncertainty: "incrementalidad no validada" },
  source_refs: ["metric:1", "diagnosis:1"],
};

test("P04 conserva el perfil de valor y no lo convierte en ranking", () => {
  const result = evaluateDecisionImpact(base);
  assert.equal(result.impact_assessment, "HIGH");
  assert.equal(result.value_type, "CONTRIBUTION");
  assert.equal(result.magnitude.absolute_value, 120000);
  assert.ok(!("priority" in result));
  assert.ok(!("rank" in result));
  assert.ok(result.unresolved_unknowns.includes("incrementality"));
});

test("P04 distingue exposición de pérdida y deja unknown sin baseline", () => {
  const result = evaluateDecisionImpact({
    ...base,
    assessment_id: "impact:case-2",
    value_state: "POTENTIAL",
    magnitude: { absolute_value: null, currency: null, relative_share: 0.8, business_relative_materiality: "UNKNOWN" },
    baseline: null,
    exposure: [{ dimension: "REVENUE", share: 0.8, unit_count: null, value_density: "UNKNOWN", source_refs: ["metric:2"] }],
  });
  assert.equal(result.impact_assessment, "UNKNOWN");
  assert.ok(result.unresolved_unknowns.includes("baseline"));
  assert.ok(result.unresolved_unknowns.includes("absolute_value"));
  assert.equal(result.exposure[0]?.share, 0.8);
});

test("P04 no afirma incrementalidad sin counterfactual", () => {
  assert.throws(() => evaluateDecisionImpact({
    ...base,
    assessment_id: "impact:case-3",
    incrementality: { ...base.incrementality, incremental_value: 90000, counterfactual_present: false },
  }), /impact_input_invalid/);
});

test("P04 conserva escenarios y confidence separadas", () => {
  const result = evaluateDecisionImpact({
    ...base,
    assessment_id: "impact:case-4",
    evidence_basis: "POTENTIAL",
    scenarios: { best: 50000, base: 100000, downside: 300000, upside: 150000, currency: "EUR" },
  });
  assert.equal(result.confidence.diagnosis, "HIGH");
  assert.equal(result.confidence.impact, "MEDIUM");
  assert.equal(result.confidence.attribution, "UNKNOWN");
  assert.equal(result.scenarios.downside, 300000);
});
