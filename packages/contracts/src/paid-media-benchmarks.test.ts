import assert from "node:assert/strict";
import test from "node:test";
import { validatePaidMediaBenchmarksPlaybookTemplate } from "./paid-media-benchmarks.js";

const base = {
  template_id: "paid-media-benchmarks-1",
  template_version: "1.0.0",
  schema_version: "f6-p04.v1",
  lifecycle: "ACTIVE" as const,
  domain: "PAID_MEDIA_BENCHMARKS",
  domain_extension: {
    paid_media_benchmarks: {
      paid_media_motion: "DECOMPOSE_EFFICIENCY_CHAIN",
      metric_refs: ["spend", "cpm", "ctr", "cpc", "cvr", "cac", "roas", "contribution"],
      objective_refs: ["purchase", "prospecting"],
      media_efficiency_refs: ["cpm", "ctr", "cpc", "reach", "frequency"],
      post_click_refs: ["sessions", "conversion_rate", "landing_quality"],
      acquisition_refs: ["platform_cpa", "real_cac", "new_customer_cac"],
      economics_refs: ["revenue", "margin", "contribution", "payback"],
      incrementality_refs: ["holdout", "geo_test", "triangulation"],
      attribution_refs: ["window", "branded_share", "retargeting_share", "overlap"],
      scale_refs: ["marginal_cac", "marginal_roas", "marginal_contribution"],
      customer_mix_refs: ["new", "returning", "branded", "retargeted"],
      guardrail_families: ["CONTRIBUTION", "CASH", "SAMPLE", "MARGINAL_EFFICIENCY"],
      benchmark_context_refs: ["platform", "geo", "objective", "season"],
      limitation_requirements: ["no_universal_thresholds", "no_budget_mutation"],
    },
  },
  name: "Paid Media benchmark",
  purpose: "Evaluate media and business efficiency before any intervention",
  problem_refs: ["paid-media-efficiency-uncertain"],
  intent: "diagnose-paid-media-benchmarks",
  intervention_type: "PAID_MEDIA_DIAGNOSTIC",
  activation_signals: ["paid_media_metrics_available"],
  preconditions: [],
  contraindications: [],
  steps: [{ step_id: "step-1", label: "Decompose the chain", stage: "ISOLATE" as const, adaptation_policy: "LOCKED" as const }],
  expected_effects: ["LOCATE_PAID_MEDIA_DETERIORATION"],
  validation_requirements: ["business and media evidence"],
  success_criteria: ["claim bounded by evidence"],
  failure_criteria: ["attribution mistaken for incrementality"],
  stop_conditions: ["sample or definitions insufficient"],
  reassessment_conditions: [],
  resource_requirements: [],
  dependencies: [],
  intervention_risks: [],
  adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false },
  source_refs: ["fase-06/6.04"],
};

test("F6.04 acepta el contrato específico de Paid Media", () => {
  assert.equal(validatePaidMediaBenchmarksPlaybookTemplate(base).valid, true);
});

test("F6.04 no permite su extensión en otro dominio", () => {
  assert.deepEqual(
    validatePaidMediaBenchmarksPlaybookTemplate({ ...base, domain: "PAID_MEDIA" }).reason_codes,
    ["PAID_MEDIA_BENCHMARKS.DOMAIN_EXTENSION_FORBIDDEN"],
  );
});

test("F6.04 exige objetivo, cadena de métricas y limitaciones", () => {
  const invalid = {
    ...base,
    domain_extension: {
      paid_media_benchmarks: {
        ...base.domain_extension.paid_media_benchmarks,
        metric_refs: [],
        objective_refs: [],
        limitation_requirements: [],
      },
    },
  };
  assert.equal(validatePaidMediaBenchmarksPlaybookTemplate(invalid).valid, false);
});
