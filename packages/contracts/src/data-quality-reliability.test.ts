import assert from "node:assert/strict";
import test from "node:test";
import { validateDataQualityReliabilityPlaybookTemplate } from "./data-quality-reliability.js";

const base = {
  template_id: "data-quality-reliability",
  template_version: "1.0.0",
  schema_version: "f6-p02.v1",
  lifecycle: "ACTIVE" as const,
  domain: "DATA_QUALITY_RELIABILITY",
  domain_extension: {
    data_quality_reliability: {
      quality_motion: "VALIDATE_METRIC",
      metric_refs: ["revenue", "conversion_rate"],
      quality_dimensions: ["DEFINITION", "COMPLETENESS", "FRESHNESS", "TRACEABILITY"],
      source_of_truth_refs: ["transactional_orders"],
      evidence_requirements: ["observed", "transactional"],
      missingness_requirements: ["zero_vs_missing"],
      maturity_requirements: ["period_settlement", "conversion_lag"],
      reconciliation_requirements: ["align_period", "align_definition"],
      mathematical_check_requirements: ["formula_consistency", "unit_consistency"],
      limitation_requirements: ["evidence_gaps", "scope_of_claim"],
      confidence_requirements: ["quality", "sample", "consistency"],
    },
  },
  name: "Reliable data gate",
  purpose: "Validate data before diagnosis",
  problem_refs: ["data-quality-unknown"],
  intent: "Separate observed values from trustworthy evidence",
  intervention_type: "DATA_VALIDATION",
  activation_signals: ["metric_observed"],
  preconditions: [], contraindications: [],
  steps: [{ step_id: "validate", label: "Validate metric", stage: "ISOLATE" as const, adaptation_policy: "LOCKED" as const }],
  expected_effects: ["evidence_scope_declared"],
  validation_requirements: ["source_and_definition"], success_criteria: ["confidence_bounded"],
  failure_criteria: ["false_certainty"], stop_conditions: ["invalid_metric"],
  reassessment_conditions: [], resource_requirements: [], dependencies: [], intervention_risks: [],
  adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false },
  source_refs: ["fase-06/6.02"],
};

test("F6.02 acepta requisitos de calidad y trazabilidad del dato", () => {
  assert.equal(validateDataQualityReliabilityPlaybookTemplate(base).valid, true);
});

test("F6.02 rechaza la extension en otro dominio", () => {
  assert.deepEqual(validateDataQualityReliabilityPlaybookTemplate({ ...base, domain: "ACQUISITION" }).reason_codes, ["DATA_QUALITY_RELIABILITY.DOMAIN_EXTENSION_FORBIDDEN"]);
});

test("F6.02 exige dimensiones, evidencia y limitaciones", () => {
  const invalid = {
    ...base,
    domain_extension: {
      data_quality_reliability: {
        ...base.domain_extension.data_quality_reliability,
        quality_dimensions: [],
        evidence_requirements: [],
        limitation_requirements: [],
      },
    },
  };
  assert.equal(validateDataQualityReliabilityPlaybookTemplate(invalid).valid, false);
});
