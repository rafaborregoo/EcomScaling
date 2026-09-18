import assert from "node:assert/strict";
import test from "node:test";
import { validateScalabilityPlaybookTemplate } from "./scalability-constraints.js";

const baseTemplate = {
  template_id: "sc.constraint",
  template_version: "v1",
  schema_version: "p5.10.v1",
  lifecycle: "ACTIVE" as const,
  domain: "SCALABILITY",
  domain_extension: {
    scalability: {
      scalability_motion: "REMOVE_BINDING_CONSTRAINT",
      constraint_ref: "constraint.fulfillment",
      constraint_domain_ref: "OPERATIONS_CX",
      constrained_resource_ref: "warehouse.picking",
      capacity_context_ref: "capacity.fulfillment",
      headroom_state: "UNKNOWN",
      dependency_refs: ["process.stable"],
      scale_scope: "PROCESS",
      scaling_target_ref: "picking.process",
      readiness_requirements: ["CAPACITY_READINESS", "DATA_READINESS"],
      scalability_evidence_requirements: ["CAPACITY_EVIDENCE", "HEADROOM_EVIDENCE"],
      economics_requirements: ["MARGINAL_ECONOMICS_EVIDENCE"],
      resilience_requirements: ["FRAGILITY_EVIDENCE"],
      measurement_requirements: ["MEASUREMENT_READINESS_EVIDENCE"],
    },
  },
  name: "Remove fulfillment constraint",
  purpose: "Create headroom without overscaling.",
  problem_refs: [], intent: "Elevate the binding constraint.",
  intervention_type: "BINDING_CONSTRAINT_REMOVAL", activation_signals: ["plateau"],
  preconditions: [], contraindications: [],
  steps: [{ step_id: "map", label: "Map capacity", stage: "ISOLATE" as const, adaptation_policy: "LOCKED" as const }],
  expected_effects: ["INCREASE_HEADROOM"], validation_requirements: ["capacity-evidence"],
  success_criteria: ["constraint-resolved"], failure_criteria: ["economics-deteriorate"],
  stop_conditions: ["cx-degrades"], reassessment_conditions: [], resource_requirements: [],
  dependencies: [], intervention_risks: [], adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false },
  source_refs: ["verification:p5.10"],
};

test("P10 acepta una extensión de escalabilidad anclada a un constraint", () => {
  const result = validateScalabilityPlaybookTemplate(baseTemplate);
  assert.equal(result.valid, true);
  assert.equal(result.profile?.constraint_ref, "constraint.fulfillment");
  assert.equal(result.profile?.scale_scope, "PROCESS");
});

test("P10 exige constraint, scope y evidencia mínima", () => {
  const result = validateScalabilityPlaybookTemplate({
    ...baseTemplate,
    domain_extension: { scalability: { ...baseTemplate.domain_extension.scalability, constraint_ref: "", scale_scope: "PROCESS", scalability_evidence_requirements: [] } },
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["SCALABILITY.CONSTRAINT_PROFILE_REQUIRED"]);
});

test("P10 no permite la extensión en otro dominio", () => {
  const result = validateScalabilityPlaybookTemplate({ ...baseTemplate, domain: "OPERATIONS_CX" });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["SCALABILITY.DOMAIN_EXTENSION_FORBIDDEN"]);
});
