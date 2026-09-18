import assert from "node:assert/strict";
import test from "node:test";
import { validateBenchmarkGuardrailsPlaybookTemplate } from "./benchmark-guardrails.js";

const base = {
  template_id: "benchmark-context",
  template_version: "1.0.0",
  schema_version: "f5-p00.v1",
  lifecycle: "ACTIVE" as const,
  domain: "BENCHMARKS_GUARDRAILS",
  domain_extension: {
    benchmarks_guardrails: {
      benchmark_motion: "CONTEXTUALIZE_METRIC",
      benchmark_scopes: ["HISTORICAL_INTERNAL"],
      metric_refs: ["revenue"],
      comparison_context_refs: [],
      economic_metric_refs: ["contribution_margin"],
      guardrail_families: ["ECONOMIC", "STATISTICAL"],
      context_requirements: ["business_model", "season"],
      benchmark_evidence_requirements: ["metric_definition", "period"],
      guardrail_requirements: [],
      confidence_requirements: ["sample_size", "comparability"],
    },
  },
  name: "Benchmark context",
  purpose: "Contextualize a metric without prescribing an action",
  problem_refs: ["metric-context-missing"],
  intent: "Separate signal from judgment",
  intervention_type: "DIAGNOSTIC_CONTEXT",
  activation_signals: ["metric_observed"],
  preconditions: [], contraindications: [],
  steps: [{ step_id: "context", label: "Contextualize", stage: "ISOLATE" as const, adaptation_policy: "LOCKED" as const }],
  expected_effects: ["context_available"],
  validation_requirements: ["definition"], success_criteria: ["comparison_labeled"],
  failure_criteria: ["uncontextualized_judgment"], stop_conditions: ["missing_metric"],
  reassessment_conditions: [], resource_requirements: [], dependencies: [], intervention_risks: [],
  adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false },
  source_refs: ["fase-06/6.00"],
};

test("F6.00 acepta el perfil universal de benchmark y guardrails", () => {
  assert.equal(validateBenchmarkGuardrailsPlaybookTemplate(base).valid, true);
});

test("F6.00 rechaza la extension en otro dominio", () => {
  assert.deepEqual(validateBenchmarkGuardrailsPlaybookTemplate({ ...base, domain: "ACQUISITION" }).reason_codes, ["BENCHMARK_GUARDRAILS.DOMAIN_EXTENSION_FORBIDDEN"]);
});

test("F6.00 exige contexto y evidencia de benchmark", () => {
  const invalid = { ...base, domain_extension: { benchmarks_guardrails: { ...base.domain_extension.benchmarks_guardrails, context_requirements: [], benchmark_evidence_requirements: [] } } };
  assert.equal(validateBenchmarkGuardrailsPlaybookTemplate(invalid).valid, false);
});
