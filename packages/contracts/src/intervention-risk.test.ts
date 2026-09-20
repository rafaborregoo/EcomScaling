import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInterventionRisk,
  evaluateInterventionRiskSet,
  type InterventionRiskInput,
} from "./intervention-risk.js";

function base(overrides: Partial<InterventionRiskInput> = {}): InterventionRiskInput {
  return {
    candidate_id: "checkout-fix@1.0.0",
    priority_tier: "NOW",
    expected_impact_disposition: "SUPPORTED_QUALITATIVE",
    feasibility_disposition: "FEASIBLE_NOW",
    intervention: "Fix mobile checkout error",
    intended_outcome: "Recover checkout completion",
    commitment_level: "LIMITED",
    exposure: "Mobile traffic only",
    potential_upside: ["Recover completed checkouts"],
    potential_downside: ["Deployment regression"],
    evidence_strength: "DIRECT_EVIDENCE",
    uncertainty: ["Traffic mix may change"],
    reversibility_profile: { can_revert: "TRUE", reversal_delay: "minutes", reversal_cost: "LIMITED", residual_damage: "UNKNOWN" },
    blast_radius: { scope: ["mobile traffic"], level: "LIMITED", concentration: [], dependencies: [] },
    inaction_risk: ["Continued checkout loss"],
    action_risk: ["Regression in checkout"],
    guardrails: { hard_veto: false, status: "PASS", refs: ["guardrail:checkout"] },
    observability: { monitoring_available: "TRUE", detection_speed: "FAST", feedback_loop: "AVAILABLE", measurement_quality: "GOOD" },
    risk_dependencies: [],
    risk_capacity: "MODERATE",
    failure_modes: ["negative effect", "hidden damage"],
    scenarios: { downside_case: "Checkout remains degraded", base_case: "Error rate improves", upside_case: "Completion recovers", tail_risk: "Customer harm" },
    cost_of_error: { severity: "LIMITED", action: "LIMITED", delay: "MATERIAL", failure: "MATERIAL", rollback: "LIMITED", residual: "UNKNOWN" },
    recommended_commitment: "LIMITED_TEST",
    de_risking_actions: ["Monitor checkout errors", "Keep rollback ready"],
    risk_tradeoff: { accepted: ["Short deployment risk"], avoided: ["Full traffic exposure"], introduced: [], transferred: [] },
    decision_conditions: ["Expand only after direct evidence"],
    assumptions: ["Rollback is available"],
    quantitative_support: false,
    quantitative_claims: [],
    unresolved_unknowns: [],
    evidence_refs: ["evidence:checkout"],
    source_refs: ["template:f7-risk"],
    ...overrides,
  };
}

test("F7.06 mantiene separados upside, downside, exposición y reversibilidad", () => {
  const result = evaluateInterventionRisk(base());
  assert.equal(result.disposition, "RISK_ACCEPTABLE_WITH_GUARDRAILS");
  assert.deepEqual(result.risk_trace.exposure, ["mobile traffic"]);
  assert.equal(result.reversibility_profile.can_revert, "TRUE");
  assert.equal(result.cost_of_error.severity, "LIMITED");
  assert.equal(result.execution_authorized, false);
});

test("F7.06 bloquea un guardrail duro aunque exista upside", () => {
  const result = evaluateInterventionRisk(base({ guardrails: { hard_veto: true, status: "FAIL", refs: ["guardrail:privacy"] } }));
  assert.equal(result.disposition, "DO_NOT_PROCEED");
  assert.ok(result.reason_codes.includes("GUARDRAIL.HARD_VETO"));
});

test("F7.06 exige validación si faltan contexto y reversibilidad", () => {
  const result = evaluateInterventionRisk(base({
    reversibility_profile: { can_revert: "UNKNOWN", reversal_delay: "unknown", reversal_cost: "unknown", residual_damage: "unknown" },
    guardrails: { hard_veto: false, status: "UNKNOWN", refs: [] },
    unresolved_unknowns: ["tenant.risk_capacity"],
  }));
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.ok(result.unresolved_unknowns.includes("tenant.risk_capacity"));
  assert.ok(result.unresolved_unknowns.includes("reversibility"));
});

test("F7.06 elimina claims cuantitativos si no tienen soporte explícito", () => {
  const result = evaluateInterventionRisk(base({ quantitative_support: false, quantitative_claims: [{ claim: "loss", value: 500, unit: "EUR", support_refs: [] }] }));
  assert.deepEqual(result.quantitative_claims, []);
  assert.ok(result.reason_codes.includes("RISK.NUMERIC_UNSUPPORTED"));
});

test("F7.06 conserva la candidata primaria y nunca autoriza ejecución", () => {
  const result = evaluateInterventionRiskSet({
    context_id: "ctx",
    business_id: "org",
    decision_cycle_id: "cycle",
    primary_priority_candidate_id: "checkout-fix@1.0.0",
    candidates: [base()],
    evaluated_at: "2026-09-19T00:00:00.000Z",
  });
  assert.equal(result.disposition, "RISK_ASSESSMENTS_AVAILABLE");
  assert.equal(result.primary_priority_candidate_id, "checkout-fix@1.0.0");
  assert.equal(result.execution_authorized, false);
});
