import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDynamicDecision, type DynamicDecisionInput, type DynamicDecisionUnitInput } from "./dynamic-decision.js";

const unit = (over: Partial<DynamicDecisionUnitInput> = {}): DynamicDecisionUnitInput => ({
  unit_id: "checkout@1",
  original_recommendation: "Mejorar recuperación del checkout",
  intervention_type: "optimization",
  intended_mechanism: "Reducir fricción de recuperación",
  expected_outcome: "Más compras completadas",
  observed_outcome: "POSITIVE_AND_STABLE",
  primary_outcome: "POSITIVE",
  secondary_effects: ["MARGIN_INTACT"],
  economics: "MARGIN_HEALTHY",
  guardrails: ["INTACT"],
  risk: "CONTAINED",
  intervention_fidelity: "CONFIRMED",
  baseline_quality: "COMPARABLE",
  trend: "IMPROVING",
  causal_confidence: "STRONG",
  incrementality: "SUPPORTED",
  headroom: "AVAILABLE",
  marginal_economics: "HEALTHY",
  scale_readiness: "READY",
  reversibility: "REVERSIBLE",
  rollback_cost: "CONTAINED",
  opportunity_cost: "LOW",
  decision_scope: "checkout",
  source_refs: ["dynamic:test"],
  unresolved_unknowns: [],
  ...over,
});

const base = (over: Partial<DynamicDecisionInput> = {}): DynamicDecisionInput => ({
  context_id: "dynamic-context",
  business_id: "org-a",
  decision_cycle_id: "cycle-a",
  original_recommendation: "Mejorar recuperación del checkout",
  portfolio_context: "Primary checkout; no conflicting work",
  external_context: "No regime change declared",
  decision_units: [unit()],
  source_refs: ["f7-p13:test"],
  unresolved_unknowns: [],
  ...over,
});

test("F7.13 escala solo con outcome, causalidad, incrementalidad, headroom y readiness suficientes", () => {
  const result = evaluateDynamicDecision(base());
  assert.equal(result.disposition, "DECISIONS_AVAILABLE");
  assert.equal(result.unit_decisions[0]?.decision, "SCALE");
  assert.match(result.unit_decisions[0]?.scale_limit ?? "", /guardrail|capacity|marginal/i);
  assert.equal(result.execution_authorized, false);
});

test("F7.13 hace rollback cuando hay daño material y el estado previo es mejor y reversible", () => {
  const result = evaluateDynamicDecision(base({ decision_units: [unit({ observed_outcome: "MATERIAL_HARM", primary_outcome: "NEGATIVE", guardrails: ["MATERIAL_BREACH"], baseline_quality: "PREVIOUS_STATE_BETTER", reversibility: "REVERSIBLE", rollback_cost: "CONTAINED" })] }));
  assert.equal(result.unit_decisions[0]?.decision, "ROLLBACK");
  assert.match(result.unit_decisions[0]?.rollback_target ?? "", /previous|prior/i);
  assert.equal(result.overall_decision, "ROLLBACK");
});

test("F7.13 no confunde fallo de ejecución con fallo de estrategia", () => {
  const result = evaluateDynamicDecision(base({ decision_units: [unit({ observed_outcome: "NO_EFFECT", primary_outcome: "NEGATIVE", intervention_fidelity: "FAILED", fix_forward_alternative: "Corregir implementación y observar de nuevo" } as never)] }));
  assert.equal(result.unit_decisions[0]?.decision, "CONTINUE");
  assert.match(result.unit_decisions[0]?.decision_qualifiers.join(" ") ?? "", /FIX_FORWARD|ADJUST/);
});

test("F7.13 conserva decisiones parciales y exige validación cuando fidelity es desconocida", () => {
  const result = evaluateDynamicDecision(base({ decision_units: [unit({ unit_id: "checkout@1" }), unit({ unit_id: "retention@1", observed_outcome: "NEGATIVE", primary_outcome: "NEGATIVE", intervention_fidelity: "UNKNOWN", original_recommendation: "Reactivar CRM" })] }));
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.ok(result.unresolved_unknowns.includes("intervention_fidelity:retention@1"));
  assert.equal(result.unit_decisions.length, 0);
});
