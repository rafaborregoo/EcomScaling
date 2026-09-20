import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInterventionImpact,
  evaluateInterventionImpactSet,
  type InterventionImpactInput,
} from "./intervention-impact.js";

const candidate = (overrides: Partial<InterventionImpactInput> = {}): InterventionImpactInput => ({
  candidate_id: "fix-checkout@1",
  priority_tier: "NOW",
  primary_effect: "restore checkout completion",
  mechanism_refs: ["mechanism:checkout-completion"],
  leading_indicator_refs: ["signal:checkout-errors"],
  business_outcome_refs: ["kpi:conversion-rate"],
  economic_outcome_refs: ["economic:contribution"],
  scope: "device:mobile",
  magnitude_qualitative: "MATERIAL",
  magnitude_value: null,
  magnitude_unit: null,
  time_to_signal: "FAST",
  time_to_full_value: "MEDIUM",
  durability: "ONGOING",
  estimate_basis: "OBSERVED",
  quantitative_support: false,
  incrementality: "INCREMENTAL",
  counterfactual_present: true,
  secondary_effects: [],
  negative_effects: [],
  tradeoffs: [],
  assumptions: ["tracking remains stable"],
  guardrail_refs: ["guardrail:margin"],
  guardrail_status: "PASS",
  unresolved_unknowns: [],
  evidence_refs: ["evidence:checkout"],
  source_refs: ["source:smoke"],
  ...overrides,
});

test("F7.04 construye una cadena de impacto trazable sin prometer resultado", () => {
  const result = evaluateInterventionImpact(candidate());

  assert.equal(result.disposition, "SUPPORTED_QUALITATIVE");
  assert.deepEqual(result.impact_trace, {
    mechanism_refs: ["mechanism:checkout-completion"],
    leading_indicator_refs: ["signal:checkout-errors"],
    business_outcome_refs: ["kpi:conversion-rate"],
    economic_outcome_refs: ["economic:contribution"],
  });
  assert.equal(result.magnitude_value, null);
  assert.equal(result.execution_authorized, false);
});

test("F7.04 degrada una expectativa especulativa y conserva el counterfactual", () => {
  const result = evaluateInterventionImpact(candidate({
    estimate_basis: "SPECULATIVE",
    incrementality: "ATTRIBUTED_ONLY",
    counterfactual_present: false,
    secondary_effects: ["may increase support load"],
    negative_effects: ["possible margin pressure"],
  }));

  assert.equal(result.disposition, "POTENTIAL_ONLY");
  assert.ok(result.reason_codes.includes("EVIDENCE.SPECULATIVE"));
  assert.ok(result.unresolved_unknowns.includes("incrementality"));
  assert.deepEqual(result.negative_effects, ["possible margin pressure"]);
});

test("F7.04 no inventa impacto si falta el mecanismo o la señal leading", () => {
  const result = evaluateInterventionImpact(candidate({ mechanism_refs: [], leading_indicator_refs: [] }));

  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.ok(result.unresolved_unknowns.includes("mechanism_refs"));
  assert.ok(result.unresolved_unknowns.includes("leading_indicator_refs"));
});

test("F7.04 no publica un valor numérico sin soporte cuantitativo explícito", () => {
  const result = evaluateInterventionImpact(candidate({ magnitude_value: 15, magnitude_unit: "percent", quantitative_support: false }));

  assert.equal(result.magnitude_value, null);
  assert.ok(result.reason_codes.includes("MAGNITUDE.QUANTITATIVE_UNSUPPORTED"));
});

test("F7.04 el conjunto conserva la candidata primaria y sus unknowns", () => {
  const result = evaluateInterventionImpactSet({
    context_id: "ctx-1",
    business_id: "org-1",
    decision_cycle_id: "f7-p04:org-1:2026-09-19",
    primary_priority_candidate_id: "fix-checkout@1",
    candidates: [candidate(), candidate({ candidate_id: "rewrite-copy@1", mechanism_refs: [], leading_indicator_refs: [] })],
    evaluated_at: "2026-09-19T10:00:00.000Z",
  });

  assert.equal(result.disposition, "IMPACTS_AVAILABLE");
  assert.equal(result.primary_priority_candidate_id, "fix-checkout@1");
  assert.equal(result.candidate_evaluations.length, 2);
  assert.equal(result.execution_authorized, false);
});
