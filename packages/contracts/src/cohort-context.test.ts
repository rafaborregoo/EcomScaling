import assert from "node:assert/strict";
import test from "node:test";
import { validateCohortContextPlaybookTemplate } from "./cohort-context.js";

const base = {
  template_id: "cohort-context",
  template_version: "1.0.0",
  schema_version: "f6-p01.v1",
  lifecycle: "ACTIVE" as const,
  domain: "COHORT_CONTEXT",
  domain_extension: {
    cohort_context: {
      cohort_motion: "SELECT_REFERENCE",
      metric_refs: ["conversion_rate"],
      material_dimensions: ["device", "source_channel", "new_vs_returning"],
      cohort_scopes: ["CONTROL", "HISTORICAL_COMPARABLE", "INTERNAL_SEGMENT"],
      cohort_dimension_refs: ["device", "source_channel"],
      reference_priority: ["CONTROL", "HISTORICAL_COMPARABLE", "INTERNAL_SEGMENT"],
      definition_requirements: ["metric_definition", "denominator"],
      sample_requirements: ["sample_size"],
      mix_control_requirements: ["device_mix", "channel_mix"],
      limitation_requirements: ["uncontrolled_dimensions", "temporal_context"],
    },
  },
  name: "Comparable cohort context",
  purpose: "Select a defensible reference before comparing a metric",
  problem_refs: ["cohort-context-missing"],
  intent: "Separate like-for-like comparison from superficial similarity",
  intervention_type: "DIAGNOSTIC_CONTEXT",
  activation_signals: ["metric_observed"],
  preconditions: [], contraindications: [],
  steps: [{ step_id: "select-reference", label: "Select reference", stage: "ISOLATE" as const, adaptation_policy: "LOCKED" as const }],
  expected_effects: ["comparison_context_available"],
  validation_requirements: ["definitions_compatible"], success_criteria: ["comparability_labeled"],
  failure_criteria: ["false_comparability"], stop_conditions: ["missing_metric"],
  reassessment_conditions: [], resource_requirements: [], dependencies: [], intervention_risks: [],
  adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false },
  source_refs: ["fase-06/6.01"],
};

test("F6.01 acepta un perfil de contexto y cohortes comparables", () => {
  assert.equal(validateCohortContextPlaybookTemplate(base).valid, true);
});

test("F6.01 rechaza la extension en otro dominio", () => {
  assert.deepEqual(validateCohortContextPlaybookTemplate({ ...base, domain: "ACQUISITION" }).reason_codes, ["COHORT_CONTEXT.DOMAIN_EXTENSION_FORBIDDEN"]);
});

test("F6.01 exige dimensiones, definiciones y controles de muestra", () => {
  const invalid = {
    ...base,
    domain_extension: {
      cohort_context: {
        ...base.domain_extension.cohort_context,
        material_dimensions: [],
        definition_requirements: [],
        sample_requirements: [],
      },
    },
  };
  assert.equal(validateCohortContextPlaybookTemplate(invalid).valid, false);
});
