import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateConstraintRecommendation,
  evaluateConstraintRecommendationSet,
  type ConstraintRecommendationInput,
} from "./constraint-recommendations.js";

const base = (over: Partial<ConstraintRecommendationInput> = {}): ConstraintRecommendationInput => ({
  candidate_id: "checkout@1",
  desired_intervention: "Aumentar adquisición validada",
  required_resources: ["cash", "creative"],
  constraints: [],
  binding_constraint: "NONE",
  secondary_constraints: [],
  latent_constraints: [],
  expected_outcome: "Más pedidos rentables",
  success_capacity: "READY",
  business_context: "Crecimiento controlado",
  evidence: ["evidence:checkout"],
  risk: ["cash pressure"],
  dependencies: ["measurement"],
  guardrails: ["protect margin"],
  current_recommendation: "Aumentar adquisición validada",
  deferred_action: "No diferir",
  activation_trigger: "Mantener capacidad de fulfillment",
  constraint_effect: "NONE",
  remove_options: [],
  scope_reduction_options: [],
  alternative_mechanisms: [],
  reallocation_options: [],
  resequencing_options: [],
  prepare_actions: [],
  opportunity_cost: [],
  resource_productivity: [],
  temporary_workaround: [],
  resource_substitution: [],
  cash_path: [],
  unresolved_unknowns: [],
  evidence_refs: ["evidence:checkout"],
  source_refs: ["f7-p11:test"],
  ...over,
});

test("F7.11 blocks an immediate action on a hard binding constraint", () => {
  const result = evaluateConstraintRecommendation(base({
    binding_constraint: "cash",
    constraints: [{ name: "cash", type: "hard", duration: "temporary", status: "BLOCKED", slack: "none", granularity: "business", controllability: "partial", severity: "high", evidence: ["cash:runway"], classification: "scarcity" }],
    deferred_action: "Aumentar adquisición cuando exista liquidez",
    prepare_actions: ["Preparar una prueba reversible"],
    activation_trigger: "Liquidez disponible",
  }));
  assert.equal(result.feasibility_disposition, "BLOCKED");
  assert.equal(result.recommended_mode, "BLOCKED_BY_HARD_CONSTRAINT");
  assert.equal(result.timing_fit, "LATER");
  assert.equal(result.execution_authorized, false);
});

test("F7.11 reduces a soft constraint before rejecting the intervention", () => {
  const result = evaluateConstraintRecommendation(base({
    binding_constraint: "creative capacity",
    constraints: [{ name: "creative capacity", type: "soft", duration: "temporary", status: "ACTIVE", slack: "limited", granularity: "channel", controllability: "controllable", severity: "moderate", evidence: ["creative:queue"], classification: "scarcity" }],
    scope_reduction_options: ["Empezar solo en el canal con mejor evidencia"],
    expected_outcome: "Incremento acotado en el canal seleccionado",
  }));
  assert.equal(result.feasibility_disposition, "FEASIBLE_WITH_ADAPTATION");
  assert.equal(result.recommended_mode, "REDUCE_SCOPE");
  assert.equal(result.constraint_response, "reduce");
  assert.equal(result.minimum_viable_intervention, "Empezar solo en el canal con mejor evidencia");
});

test("F7.11 reallocates before asking for more capacity", () => {
  const result = evaluateConstraintRecommendation(base({
    binding_constraint: "developer capacity",
    constraints: [{ name: "developer capacity", type: "soft", duration: "temporary", status: "ACTIVE", slack: "none", granularity: "team", controllability: "controllable", severity: "high", evidence: ["team:allocation"], classification: "poor_allocation" }],
    reallocation_options: ["Mover capacidad desde mantenimiento de bajo valor"],
    remove_options: ["Contratar un proveedor"],
  }));
  assert.equal(result.recommended_mode, "REALLOCATE");
  assert.equal(result.constraint_response, "reallocate");
  assert.match(result.enabling_recommendation ?? "", /Mover capacidad/);
});

test("F7.11 protects success capacity when the business cannot absorb the upside", () => {
  const result = evaluateConstraintRecommendation(base({
    binding_constraint: "fulfillment",
    success_capacity: "NOT_READY",
    constraints: [{ name: "fulfillment", type: "soft", duration: "structural", status: "ACTIVE", slack: "none", granularity: "SKU", controllability: "partial", severity: "high", evidence: ["ops:headroom"], classification: "scarcity" }],
    scope_reduction_options: ["Limitar la exposición al stock disponible"],
  }));
  assert.equal(result.recommended_mode, "PROTECT_SUCCESS_CAPACITY");
  assert.equal(result.feasibility_disposition, "FEASIBLE_WITH_ADAPTATION");
  assert.equal(result.timing_fit, "LATER");
  assert.match(result.rationale.join(" "), /SUCCESS_CAPACITY/);
});

test("F7.11 asks for validation when the binding constraint is vague or ungrounded", () => {
  const result = evaluateConstraintRecommendation(base({
    binding_constraint: "resources",
    constraints: [{ name: "resources", type: "unknown", duration: "unknown", status: "ASSUMED", slack: "unknown", granularity: "unknown", controllability: "unknown", severity: "unknown", evidence: [], classification: "unknown" }],
    evidence: [],
  }));
  assert.equal(result.recommended_mode, "VALIDATE_CONSTRAINT");
  assert.equal(result.feasibility_disposition, "VALIDATION_REQUIRED");
  assert.equal(result.timing_fit, "VALIDATION_REQUIRED");
});

test("F7.11 keeps the feasible set deterministic and tenant-traceable", () => {
  const result = evaluateConstraintRecommendationSet({
    context_id: "ctx",
    business_id: "org",
    decision_cycle_id: "cycle",
    primary_priority_candidate_id: "checkout@1",
    candidates: [base()],
    evaluated_at: "2026-09-20T10:00:00.000Z",
  });
  assert.equal(result.disposition, "CONSTRAINT_RECOMMENDATIONS_AVAILABLE");
  assert.equal(result.business_id, "org");
  assert.equal(result.deterministic, true);
  assert.equal(result.execution_authorized, false);
});
