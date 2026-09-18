import assert from "node:assert/strict";
import test from "node:test";
import {
  validateOperationsCxPlaybookTemplate,
  type OperationsCxInterventionProfile,
} from "./operations-cx.js";
import type { PlaybookTemplateInput } from "./playbook.js";

const baseTemplate = (
  profile: Partial<OperationsCxInterventionProfile>,
): PlaybookTemplateInput => ({
  template_id: "OPS-001",
  template_version: "1.0.0",
  schema_version: "p5.08.v1",
  lifecycle: "ACTIVE",
  domain: "OPERATIONS_CX",
  domain_extension: {
    operations_cx: {
      operations_motion: "DELIVERY_RELIABILITY_IMPROVEMENT",
      operational_surface: "DELIVERY",
      process_scope: "FULFILLMENT_FLOW",
      entity_refs: ["carrier:primary"],
      customer_impact_scope: "AFFECTED_ORDER_COHORT",
      capacity_state: "TIGHT",
      service_state: "AT_RISK",
      operational_context_ref: "ops:delivery-context",
      operations_evidence_requirements: ["delivery-reliability", "promise-accuracy"],
      capacity_requirements: ["headroom"],
      service_level_requirements: ["service-level-ref"],
      economics_requirements: ["cost-per-order"],
      measurement_requirements: ["on-time-delivery"],
      ...profile,
    },
  },
  name: "Operations validation",
  purpose: "Validate an operations intervention",
  problem_refs: [],
  intent: "improve-operational-reliability",
  intervention_type: "OPERATIONS_CX",
  activation_signals: ["delivery-risk"],
  preconditions: [],
  contraindications: [],
  steps: [{ step_id: "OPS-001-S01", label: "Decompose processing and transit", stage: "ISOLATE", adaptation_policy: "LOCKED" }],
  expected_effects: ["IMPROVE_OPERATIONAL_RELIABILITY"],
  validation_requirements: ["service and customer evidence"],
  success_criteria: ["reliability improves without harming quality"],
  failure_criteria: ["service or customer outcome deteriorates"],
  stop_conditions: ["customer integrity risk"],
  reassessment_conditions: [],
  resource_requirements: [],
  dependencies: [],
  intervention_risks: [],
  adaptation_policy: { default: "LOCKED", allow_new_steps: false },
  source_refs: ["artifact:f5.08"],
});

test("P08 acepta mejora de entrega con superficie, scope y contexto trazables", () => {
  const result = validateOperationsCxPlaybookTemplate(baseTemplate({}));
  assert.equal(result.valid, true);
  assert.equal(result.profile?.operational_surface, "DELIVERY");
  assert.equal(result.profile?.service_state, "AT_RISK");
});

test("P08 exige contexto de nivel de servicio cuando el estado esta en riesgo", () => {
  const result = validateOperationsCxPlaybookTemplate(baseTemplate({ operational_context_ref: undefined, service_level_requirements: [] }));
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["OPERATIONS_CX.SERVICE_CONTEXT_REQUIRED"]);
});

test("P08 no permite service recovery sin impacto de cliente declarado", () => {
  const result = validateOperationsCxPlaybookTemplate(baseTemplate({ operations_motion: "SERVICE_RECOVERY", customer_impact_scope: undefined }));
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["OPERATIONS_CX.CUSTOMER_IMPACT_SCOPE_REQUIRED"]);
});

test("P08 no permite extension de operaciones en otro dominio", () => {
  const result = validateOperationsCxPlaybookTemplate({ ...baseTemplate({}), domain: "CONVERSION" });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["OPERATIONS_CX.DOMAIN_EXTENSION_FORBIDDEN"]);
});
