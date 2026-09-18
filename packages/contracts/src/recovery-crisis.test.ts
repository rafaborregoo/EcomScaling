import assert from "node:assert/strict";
import test from "node:test";
import { validateRecoveryCrisisPlaybookTemplate } from "./recovery-crisis.js";

const baseTemplate = {
  template_id: "rc.fulfillment",
  template_version: "v1",
  schema_version: "p5.11.v1",
  lifecycle: "ACTIVE" as const,
  domain: "RECOVERY_CRISIS",
  domain_extension: {
    recovery_crisis: {
      recovery_motion: "STABILIZE_SYSTEM",
      crisis_scope: "SINGLE_DOMAIN",
      affected_domain_refs: ["OPERATIONS_CX"],
      affected_capability_refs: ["fulfillment"],
      continuity_requirement_refs: ["MINIMUM_VIABLE_OPERATING_MODE"],
      containment_requirements: ["STOP_PROPAGATION"],
      stabilization_requirements: ["RESTORE_PREDICTABILITY"],
      recovery_objective_refs: ["RESTORE_FULFILLMENT"],
      dependency_refs: ["carrier.status"],
      recovery_evidence_requirements: ["INCIDENT_SCOPE_EVIDENCE", "CONTINUITY_EVIDENCE"],
      communication_requirement_refs: [],
      measurement_requirements: ["MEASUREMENT_CONFIDENCE_EVIDENCE"],
    },
  },
  name: "Stabilize fulfillment",
  purpose: "Protect continuity before optimization.",
  problem_refs: [], intent: "Contain and stabilize the affected capability.",
  intervention_type: "SERVICE_RECOVERY", activation_signals: ["fulfillment-degradation"],
  preconditions: [], contraindications: [],
  steps: [{ step_id: "contain", label: "Contain impact", stage: "STABILIZE" as const, adaptation_policy: "LOCKED" as const }],
  expected_effects: ["PRESERVE_CONTINUITY"], validation_requirements: ["stability-evidence"],
  success_criteria: ["safe-state"], failure_criteria: ["impact-expands"],
  stop_conditions: ["customer-risk"], reassessment_conditions: [], resource_requirements: [],
  dependencies: [], intervention_risks: [], adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false },
  source_refs: ["verification:p5.11"],
};

test("P11 acepta recovery anclado a un alcance y objetivos", () => {
  const result = validateRecoveryCrisisPlaybookTemplate(baseTemplate);
  assert.equal(result.valid, true);
  assert.equal(result.profile?.crisis_scope, "SINGLE_DOMAIN");
  assert.equal(result.profile?.recovery_motion, "STABILIZE_SYSTEM");
});

test("P11 exige dominio afectado, objetivo y evidencia de recovery", () => {
  const result = validateRecoveryCrisisPlaybookTemplate({
    ...baseTemplate,
    domain_extension: { recovery_crisis: { ...baseTemplate.domain_extension.recovery_crisis, affected_domain_refs: [], recovery_objective_refs: [], recovery_evidence_requirements: [] } },
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["RECOVERY_CRISIS.PROFILE_REQUIRED"]);
});

test("P11 no permite la extensión de crisis en otro dominio", () => {
  const result = validateRecoveryCrisisPlaybookTemplate({ ...baseTemplate, domain: "OPERATIONS_CX" });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["RECOVERY_CRISIS.DOMAIN_EXTENSION_FORBIDDEN"]);
});
