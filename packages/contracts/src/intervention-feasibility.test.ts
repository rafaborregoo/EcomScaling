import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInterventionFeasibility,
  evaluateInterventionFeasibilitySet,
  type InterventionFeasibilityInput,
} from "./intervention-feasibility.js";

function base(overrides: Partial<InterventionFeasibilityInput> = {}): InterventionFeasibilityInput {
  return {
    candidate_id: "checkout-fix@1.0.0",
    priority_tier: "NOW",
    expected_impact_disposition: "SUPPORTED_QUALITATIVE",
    resource_requirements: [{ resource: "developer", required_level: "MODERATE", availability: "AVAILABLE", capacity_status: "SUFFICIENT", capability_status: "FIT", owner_status: "ASSIGNED", duration: "short", bottleneck: false, source_refs: ["resource:team"] }],
    cost_profile: { direct: "LIMITED", recurring: "UNKNOWN", fixed: "UNKNOWN", variable: "UNKNOWN", switching: "UNKNOWN", maintenance: "MODERATE", coordination: "LIMITED", training: "UNKNOWN", decommissioning: "UNKNOWN", opportunity: "MODERATE", numeric_support: false, amounts: [] },
    effort_profile: { complexity: "MODERATE", workload: "MODERATE", teams_involved: ["engineering"], handoffs: ["review"], coordination: "LIMITED" },
    time_requirement: { implementation: "short", operational_readiness: "medium", confident_outcome: "unknown", deadline_fit: "FIT" },
    capability_gaps: [], dependencies: [], current_priority_refs: [], opportunity_cost_refs: ["initiative:cleanup"],
    success_capacity: { required_resources: [], moving_bottleneck: null, buffer_status: "PRESENT" },
    adaptations: [], alternatives: [], minimum_viable_commitment: "one review cycle", recurring_burden: ["monitoring"], reversibility: "FLEXIBLE",
    guardrail_status: "PASS", unresolved_unknowns: [], evidence_refs: ["impact:1"], source_refs: ["template:1"],
    ...overrides,
  };
}

test("F7.05 keeps cost, effort and capacity separate and returns feasible now", () => {
  const result = evaluateInterventionFeasibility(base());
  assert.equal(result.disposition, "FEASIBLE_NOW");
  assert.equal(result.cost_profile.direct, "LIMITED");
  assert.equal(result.effort_profile.workload, "MODERATE");
  assert.equal(result.execution_authorized, false);
  assert.deepEqual(result.resource_trace.bottleneck_resources, []);
});

test("F7.05 does not invent a cost when numeric support is absent", () => {
  const result = evaluateInterventionFeasibility(base({ cost_profile: { ...base().cost_profile, numeric_support: false, amounts: [{ kind: "direct", amount: 500, unit: "EUR", support_refs: [] }] } }));
  assert.equal(result.cost_profile.amounts.length, 0);
  assert.ok(result.reason_codes.includes("COST.NUMERIC_UNSUPPORTED"));
});

test("F7.05 exposes a concrete bottleneck and can prefer adaptation", () => {
  const result = evaluateInterventionFeasibility(base({
    resource_requirements: [{ resource: "creative", required_level: "MATERIAL", availability: "PARTIAL", capacity_status: "CONTENDED", capability_status: "FIT", owner_status: "ASSIGNED", duration: "two weeks", bottleneck: true, source_refs: ["resource:creative"] }],
    adaptations: [{ kind: "smaller_scope", description: "Pilot top SKU", resource_burden: "LIMITED", source_refs: ["adaptation:pilot"] }],
  }));
  assert.equal(result.disposition, "FEASIBLE_WITH_ADAPTATION");
  assert.deepEqual(result.resource_trace.bottleneck_resources, ["creative"]);
});

test("F7.05 requires validation for unknown resource context", () => {
  const result = evaluateInterventionFeasibility(base({ resource_requirements: [{ resource: "management", required_level: "MODERATE", availability: "UNKNOWN", capacity_status: "UNKNOWN", capability_status: "UNKNOWN", owner_status: "UNKNOWN", duration: "unknown", bottleneck: true, source_refs: [] }] }));
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.ok(result.unresolved_unknowns.includes("management:availability"));
});

test("F7.05 set keeps primary and never authorizes execution", () => {
  const result = evaluateInterventionFeasibilitySet({ context_id: "ctx", business_id: "org", decision_cycle_id: "cycle", primary_priority_candidate_id: "checkout-fix@1.0.0", candidates: [base()], evaluated_at: "2026-09-19T00:00:00.000Z" });
  assert.equal(result.disposition, "FEASIBILITY_AVAILABLE");
  assert.equal(result.primary_priority_candidate_id, "checkout-fix@1.0.0");
  assert.equal(result.execution_authorized, false);
});
