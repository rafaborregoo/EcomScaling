import assert from "node:assert/strict";
import test from "node:test";
import { validateConversionCroBenchmarksPlaybookTemplate } from "./conversion-cro-benchmarks.js";

const base = {
  template_id: "conversion-cro-benchmarks-1",
  template_version: "1.0.0",
  schema_version: "f6-p05.v1",
  lifecycle: "ACTIVE" as const,
  domain: "CONVERSION_CRO_BENCHMARKS",
  domain_extension: {
    conversion_cro_benchmarks: {
      conversion_cro_motion: "DECOMPOSE_FUNNEL",
      conversion_definition_refs: ["session_cvr", "purchase_definition", "period"],
      funnel_metric_refs: ["sessions", "product_views", "add_to_cart", "checkout_start", "purchase"],
      segment_refs: ["device", "channel", "new_returning"],
      mix_refs: ["traffic", "device", "customer", "geo"],
      benchmark_refs: ["historical", "internal_segment", "sustainable_best"],
      economic_metric_refs: ["cvr", "aov", "contribution_per_session", "returns"],
      technical_evidence_refs: ["errors", "payment_authorization", "site_performance"],
      offer_context_refs: ["pricing", "discounts", "shipping", "returns_policy"],
      hypothesis_refs: ["observation", "mechanism", "alternatives", "confidence"],
      experiment_refs: ["primary", "guardrails", "srm", "sample", "mde"],
      guardrail_families: ["AOV", "MARGIN", "CONTRIBUTION", "RETURNS", "SAMPLE"],
      opportunity_refs: ["affected_traffic", "recoverable_gap", "economic_value"],
      method_refs: ["direct_fix", "experiment", "further_diagnosis", "monitor"],
      learning_refs: ["win", "loss", "inconclusive", "falsified"],
      limitation_requirements: ["no_universal_thresholds", "no_assumed_recoverability", "no_execution"],
    },
  },
  name: "Conversion and CRO benchmarks",
  purpose: "Diagnose conversion with funnel, economics, evidence and guardrails",
  problem_refs: ["conversion_deterioration_uncertain"],
  intent: "diagnose-conversion-cro-benchmarks",
  intervention_type: "CONVERSION_DIAGNOSTIC",
  activation_signals: ["funnel_metrics_available"],
  preconditions: [],
  contraindications: [],
  steps: [{ step_id: "step-1", label: "Decompose funnel", stage: "ISOLATE" as const, adaptation_policy: "LOCKED" as const }],
  expected_effects: ["LOCATE_CONVERSION_FRICTION"],
  validation_requirements: ["conversion definition and economics evidence"],
  success_criteria: ["claim bounded by evidence"],
  failure_criteria: ["microoptimization without diagnosis"],
  stop_conditions: ["denominator or tracking insufficient"],
  reassessment_conditions: [],
  resource_requirements: [],
  dependencies: [],
  intervention_risks: [],
  adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false },
  source_refs: ["fase-06/6.05"],
};

test("F6.05 acepta el contrato específico de conversión y CRO", () => {
  assert.equal(validateConversionCroBenchmarksPlaybookTemplate(base).valid, true);
});

test("F6.05 no permite la extensión en otro dominio", () => {
  assert.deepEqual(
    validateConversionCroBenchmarksPlaybookTemplate({ ...base, domain: "CONVERSION" }).reason_codes,
    ["CONVERSION_CRO_BENCHMARKS.DOMAIN_EXTENSION_FORBIDDEN"],
  );
});

test("F6.05 exige definición, métricas de funnel y limitaciones", () => {
  const invalid = {
    ...base,
    domain_extension: {
      conversion_cro_benchmarks: {
        ...base.domain_extension.conversion_cro_benchmarks,
        conversion_definition_refs: [],
        funnel_metric_refs: [],
        limitation_requirements: [],
      },
    },
  };
  assert.equal(validateConversionCroBenchmarksPlaybookTemplate(invalid).valid, false);
});
