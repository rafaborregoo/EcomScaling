import assert from "node:assert/strict";
import test from "node:test";
import { validateAcquisitionDemandPlaybookTemplate } from "./acquisition-demand.js";

const base = {
  template_id: "acquisition-demand",
  template_version: "1.0.0",
  schema_version: "f6-p03.v1",
  lifecycle: "ACTIVE" as const,
  domain: "ACQUISITION_DEMAND",
  domain_extension: {
    acquisition_demand: {
      acquisition_motion: "ASSESS_SUSTAINABILITY",
      metric_refs: ["new_customers", "cac", "contribution"],
      objective_refs: ["sustainable_growth"],
      acquisition_definition_refs: ["new_customer_definition", "paid_vs_blended_cac"],
      economic_guardrail_refs: ["contribution", "payback", "cash"],
      customer_quality_refs: ["repeat", "margin", "refunds"],
      channel_role_refs: ["DEMAND_GENERATION", "DEMAND_CAPTURE"],
      dependency_refs: ["platform_concentration", "paid_dependency"],
      scale_refs: ["marginal_cac", "saturation"],
      restriction_refs: ["inventory", "operations"],
      cohort_refs: ["acquisition_cohort", "cohort_maturity"],
      incrementality_refs: ["holdout", "geo_test"],
      limitation_requirements: ["attribution", "sample", "scope_of_claim"],
    },
  },
  name: "Acquisition demand evaluation",
  purpose: "Evaluate demand generation and customer acquisition sustainably",
  problem_refs: ["acquisition-context-missing"],
  intent: "Separate demand, distribution and economics",
  intervention_type: "ACQUISITION_DIAGNOSTIC",
  activation_signals: ["new_customers_observed"],
  preconditions: [], contraindications: [],
  steps: [{ step_id: "evaluate", label: "Evaluate acquisition", stage: "ISOLATE" as const, adaptation_policy: "LOCKED" as const }],
  expected_effects: ["acquisition_scope_declared"],
  validation_requirements: ["economics_and_quality"], success_criteria: ["guardrails_labeled"],
  failure_criteria: ["scale_without_evidence"], stop_conditions: ["missing_customer_definition"],
  reassessment_conditions: [], resource_requirements: [], dependencies: [], intervention_risks: [],
  adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false },
  source_refs: ["fase-06/6.03"],
};

test("F6.03 acepta el contrato de adquisición y generación de demanda", () => {
  assert.equal(validateAcquisitionDemandPlaybookTemplate(base).valid, true);
});

test("F6.03 rechaza la extension en otro dominio", () => {
  assert.deepEqual(validateAcquisitionDemandPlaybookTemplate({ ...base, domain: "ACQUISITION" }).reason_codes, ["ACQUISITION_DEMAND.DOMAIN_EXTENSION_FORBIDDEN"]);
});

test("F6.03 exige economics, calidad, dependencia y limitaciones", () => {
  const invalid = {
    ...base,
    domain_extension: {
      acquisition_demand: {
        ...base.domain_extension.acquisition_demand,
        economic_guardrail_refs: [],
        customer_quality_refs: [],
        dependency_refs: [],
        limitation_requirements: [],
      },
    },
  };
  assert.equal(validateAcquisitionDemandPlaybookTemplate(invalid).valid, false);
});
