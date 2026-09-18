import assert from "node:assert/strict";
import test from "node:test";
import {
  validateMeasurementExperimentationPlaybookTemplate,
} from "./measurement-experimentation.js";

const baseTemplate = {
  template_id: "me.verification",
  template_version: "v1",
  schema_version: "p5.09.v1",
  lifecycle: "ACTIVE" as const,
  domain: "MEASUREMENT_EXPERIMENTATION",
  domain_extension: {
    measurement_experimentation: {
      measurement_motion: "TRACKING_RELIABILITY_RECOVERY",
      measurement_surface: "EVENT_COLLECTION",
      data_scope: "EVENT",
      source_refs: ["SHOPIFY", "SERVER_EVENTS"],
      event_refs: ["PURCHASE"],
      metric_refs: ["orders_count"],
      quality_state: "UNKNOWN",
      measurement_evidence_requirements: ["event-completeness", "reconciliation"],
      observability_requirements: ["source-lineage"],
    },
  },
  name: "Purchase tracking recovery",
  purpose: "Recuperar la confianza de la medición de compras.",
  problem_refs: [],
  intent: "Separar tracking roto de una caída real del negocio.",
  intervention_type: "PURCHASE_TRACKING_RECOVERY",
  activation_signals: ["tracking-gap"],
  preconditions: [],
  contraindications: [],
  steps: [
    { step_id: "reconcile", label: "Reconciliar fuentes", stage: "ISOLATE" as const, adaptation_policy: "LOCKED" as const },
  ],
  expected_effects: ["measurement-confidence"],
  validation_requirements: ["source-reconciliation"],
  success_criteria: ["coverage-explained"],
  failure_criteria: ["lineage-missing"],
  stop_conditions: ["privacy-risk"],
  reassessment_conditions: [],
  resource_requirements: [],
  dependencies: [],
  intervention_risks: [],
  adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false },
  source_refs: ["verification:p5.09"],
};

test("P09 acepta recuperación de tracking sin imponer diseño experimental", () => {
  const result = validateMeasurementExperimentationPlaybookTemplate(baseTemplate);
  assert.equal(result.valid, true);
  assert.equal(result.profile?.measurement_surface, "EVENT_COLLECTION");
  assert.equal(result.profile?.experiment_mode, undefined);
});

test("P09 exige diseño completo antes de validar causalidad", () => {
  const result = validateMeasurementExperimentationPlaybookTemplate({
    ...baseTemplate,
    domain_extension: {
      measurement_experimentation: {
        ...baseTemplate.domain_extension.measurement_experimentation,
        measurement_motion: "CAUSAL_HYPOTHESIS_VALIDATION",
        measurement_surface: "EXPERIMENTATION",
        experiment_mode: "CONTROLLED_EXPERIMENT",
        experiment_requirements: ["HYPOTHESIS_REQUIRED"],
      },
    },
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["MEASUREMENT_EXPERIMENTATION.EXPERIMENT_DESIGN_REQUIRED"]);
});

test("P09 acepta un experimento cuando primary outcome, unidad y guardrails están predefinidos", () => {
  const result = validateMeasurementExperimentationPlaybookTemplate({
    ...baseTemplate,
    domain_extension: {
      measurement_experimentation: {
        ...baseTemplate.domain_extension.measurement_experimentation,
        measurement_motion: "CAUSAL_HYPOTHESIS_VALIDATION",
        measurement_surface: "EXPERIMENTATION",
        experiment_mode: "CONTROLLED_EXPERIMENT",
        experiment_unit: "USER",
        treatment_scope: "SINGLE_CHANGE",
        primary_outcome_ref: "checkout_completion_rate",
        guardrail_metric_refs: ["refund_rate"],
        experiment_requirements: ["HYPOTHESIS_REQUIRED", "PRIMARY_OUTCOME_REQUIRED", "GUARDRAILS_REQUIRED"],
      },
    },
  });
  assert.equal(result.valid, true);
  assert.equal(result.profile?.primary_outcome_ref, "checkout_completion_rate");
});

test("P09 no permite la extensión de medición en otro dominio", () => {
  const result = validateMeasurementExperimentationPlaybookTemplate({
    ...baseTemplate,
    domain: "CONVERSION",
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["MEASUREMENT_EXPERIMENTATION.DOMAIN_EXTENSION_FORBIDDEN"]);
});
