import assert from "node:assert/strict";
import test from "node:test";
import { evaluateExpectedOutcome, type ExpectedOutcomeInput } from "./expected-outcome.js";

const base = (over: Partial<ExpectedOutcomeInput> = {}): ExpectedOutcomeInput => ({
  context_id: "outcome-context", business_id: "org-a", decision_cycle_id: "cycle-a", scope: "checkout", recommendation: "Improve checkout recovery", cause: "Recovery friction", lever: "Checkout flow", causal_mechanism: "Reducing friction increases completed purchases", intervention_type: "optimization", current_baseline: "Comparable checkout baseline declared", maturity: "SCALING", constraints: ["Limited engineering capacity"], resources: "Focused team capacity", intensity: "Contained", risk: "CONTAINED", reversibility: "REVERSIBLE", time_horizon: "INTERMEDIATE", business_objective: "Improve contribution without harming margin", dominant_business_outcome: "Contribution", headroom: "AVAILABLE", current_economics: "Contribution economics declared", current_portfolio: "One primary initiative", current_priority: "checkout", primary_success_criterion: "More completed purchases with contribution intact", mechanism_evidence: ["Fewer recovery friction events"], guardrails: ["Contribution margin remains intact"], materiality: "Material enough to justify the intervention", baseline_counterfactual: "Comparable pre-intervention checkout", incrementality: "Must be validated", economic_meaning: "Contribution after variable costs", sustainability: "Works under normal operations", repeatability: "Can be repeated without heroics", scalability: "Scale readiness remains contextual", durability: "Durability to be observed", adoption_fidelity: "Implementation fidelity confirmed", maintenance_cost: "Ongoing upkeep remains bounded", known_downside: "Engineering opportunity cost", failure_evidence: ["Mechanism does not move", "Contribution deteriorates"], ambiguous_evidence: ["Window incomplete", "Measurement unreliable"], source_refs: ["outcome:test"], unresolved_unknowns: [], ...over,
});

test("F7.15 construye tesis causal y outcomes por capas sin prometer resultado", () => {
  const result = evaluateExpectedOutcome(base());
  assert.equal(result.disposition, "OUTCOME_CRITERIA_AVAILABLE");
  assert.match(result.causal_thesis, /If we do|because|expect/i);
  assert.ok(result.mechanism_outcome.length > 0);
  assert.ok(result.business_outcome.length > 0);
  assert.equal(result.execution_authorized, false);
});

test("F7.15 conserva criterios observables, guardrails y consecuencias de decisión", () => {
  const result = evaluateExpectedOutcome(base({ magnitude: "NOT_DECLARED", intervention_type: "pilot" }));
  assert.equal(result.magnitude, "NOT_DECLARED");
  assert.ok(result.guardrails.length > 0);
  assert.ok(result.failure_evidence.length > 0);
  assert.match(result.scale_criterion, /exposure|scale|scope/i);
  assert.match(result.rollback_criterion, /previous|rollback|harm/i);
});

test("F7.15 reconoce learning success sin confundirlo con éxito comercial", () => {
  const result = evaluateExpectedOutcome(base({ intervention_type: "learning", business_objective: "Reduce decision uncertainty", primary_success_criterion: "Decision clarity improves" }));
  assert.match(result.primary_success_criterion, /Decision clarity/i);
  assert.match(result.business_outcome.join(" "), /decision|uncertainty/i);
  assert.match(result.quality_flags.join(" "), /LEARNING|COMMERCIAL/i);
});

test("F7.15 no declara éxito de escala por éxito local de un piloto", () => {
  const result = evaluateExpectedOutcome(base({ intervention_type: "pilot", scope: "one segment", scalability: "UNKNOWN", repeatability: "UNKNOWN" }));
  assert.match(result.quality_flags.join(" "), /PILOT|SCALE/);
  assert.match(result.scale_criterion, /readiness|evidence|scope/i);
});

test("F7.15 conserva outcomes por scope y evita average masking", () => {
  const result = evaluateExpectedOutcome(base({ scope: "segment: returning customers", mechanism_evidence: ["Returning-customer recovery friction falls"], guardrails: ["New-customer margin and complaints remain intact"] }));
  assert.equal(result.scope, "segment: returning customers");
  assert.match(result.mechanism_evidence.join(" "), /Returning/);
  assert.match(result.ambiguous_evidence.join(" "), /segment|scope|window|Measurement/i);
});

test("F7.15 exige validación cuando faltan baseline u objetivo decisivos", () => {
  const result = evaluateExpectedOutcome(base({ current_baseline: "UNKNOWN", business_objective: "UNKNOWN", causal_mechanism: "UNKNOWN" }));
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.ok(result.unresolved_unknowns.includes("current_baseline"));
  assert.equal(result.execution_authorized, false);
});
