import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRecommendationCommunication } from "./recommendation-communication.js";

const base = {
  context_id: "ctx", business_id: "org", decision_cycle_id: "cycle",
  recommendation: "Fix the checkout payment error",
  reason: "The payment step is the current conversion bottleneck",
  why_now: "The failure is active in the current decision cycle",
  what_not_to_do: ["Do not scale acquisition before checkout is reliable"],
  expected_outcome: "If the mechanism is correct, completed checkouts should recover",
  main_risk: "The observed error may be channel-specific",
  main_uncertainty: "Whether the error affects all payment methods",
  priority_role: "PRIMARY", recommendation_strength: "SHOULD_PRIORITIZE",
  scope: "checkout / affected payment methods", stage: "TEST", value_type: "RISK_REDUCTION",
  temporary_or_structural: "STRUCTURAL_FIX", audience: "CONSULTANT", user_need: "DECISION",
  confidence_language: "The evidence supports a focused test, not a broad rollout",
  fact_evidence: ["Payment failures increased in the current window"],
  inference_evidence: ["The payment step is the likely bottleneck"],
  strongest_evidence: ["Payment error reproduced in the affected flow"],
  conflicting_evidence: [], success_signal: "Completed payment rate recovers in the affected scope",
  invalidating_condition: "Errors remain unchanged after the fix is isolated",
  next_decision: "Continue if the success signal holds; otherwise reassess the mechanism",
  sequence: ["First isolate the payment defect", "Then reassess checkout exposure"], dependencies: [],
  constraints: ["Preserve the current working payment method"], current_priority: "Checkout reliability",
  current_bottleneck: "Payment completion", evidence_quality: "DIRECT_OBSERVATION",
  current_confidence: "MEDIUM", commitment_scope: "NARROW", commitment_magnitude: "LOW",
  commitment_velocity: "CONTROLLED", commitment_duration: "INITIAL_WINDOW", source_refs: ["test"],
  unresolved_unknowns: [],
};

test("pone la recomendación primero y conserva hechos, inferencias y siguiente decisión", () => {
  const result = evaluateRecommendationCommunication(base);
  assert.equal(result.disposition, "COMMUNICATION_AVAILABLE");
  assert.equal(result.primary_recommendation, base.recommendation);
  assert.deepEqual(result.fact_evidence, base.fact_evidence);
  assert.deepEqual(result.inference_evidence, base.inference_evidence);
  assert.match(result.next_decision, /Continue/);
  assert.equal(result.execution_authorized, false);
});

test("no oculta la incertidumbre crítica y reduce la forma de compromiso", () => {
  const result = evaluateRecommendationCommunication({
    ...base,
    recommendation: "UNKNOWN",
    main_uncertainty: "UNKNOWN",
    unresolved_unknowns: ["payment_scope"],
  });
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.ok(result.unresolved_unknowns.includes("recommendation"));
  assert.ok(result.unresolved_unknowns.includes("main_uncertainty"));
  assert.equal(result.recommendation_stage, "GATHER_EVIDENCE");
  assert.equal(result.execution_authorized, false);
});

test("no presenta un outcome condicional como garantía ni inventa precisión", () => {
  const result = evaluateRecommendationCommunication({
    ...base,
    expected_outcome: "Guaranteed 27% uplift in 14 days",
    fact_evidence: [],
  });
  assert.equal(result.disposition, "COMMUNICATION_AVAILABLE");
  assert.ok(result.quality_flags.includes("COMMUNICATION.FALSE_PRECISION_REVIEW"));
  assert.match(result.expected_outcome, /conditional|If|si|si el mecanismo/i);
});

test("mantiene la frontera entre comunicación y ejecución", () => {
  const result = evaluateRecommendationCommunication({ ...base, stage: "SCALE", audience: "EXECUTIVE" });
  assert.equal(result.audience, "EXECUTIVE");
  assert.equal(result.execution_authorized, false);
  assert.match(result.action_implication, /no autoriza/i);
});
