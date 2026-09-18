import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const BENCHMARK_SCOPES = [
  "HISTORICAL_INTERNAL", "TEMPORAL", "EXTERNAL", "PEER_GROUP", "SEGMENT",
  "FUNNEL", "ECONOMIC", "STRATEGIC", "MARGINAL", "BLENDED", "INCREMENTAL", "MATURITY",
] as const;
export const BENCHMARK_MOTIONS = [
  "CONTEXTUALIZE_METRIC", "COMPARE_HISTORY", "COMPARE_SEGMENTS", "COMPARE_PEERS",
  "CHECK_ECONOMICS", "CHECK_GUARDRAILS", "ASSESS_MATERIALITY", "ASSESS_CONFIDENCE",
  "EVALUATE_INTERVENTION",
] as const;
export const GUARDRAIL_FAMILIES = [
  "ECONOMIC", "CASH", "INVENTORY", "OPERATIONS", "CUSTOMER_EXPERIENCE",
  "BRAND", "CONCENTRATION", "STATISTICAL", "ATTRIBUTION", "GROWTH_QUALITY",
] as const;

const refs = z.array(z.string().min(1)).default([]);
const requiredRefs = z.array(z.string().min(1)).min(1);

export const benchmarkEvaluationProfileSchema = z.object({
  benchmark_motion: z.enum(BENCHMARK_MOTIONS),
  benchmark_scopes: z.array(z.enum(BENCHMARK_SCOPES)).min(1),
  metric_refs: requiredRefs,
  comparison_context_refs: refs,
  economic_metric_refs: refs,
  guardrail_families: z.array(z.enum(GUARDRAIL_FAMILIES)).default([]),
  context_requirements: requiredRefs,
  benchmark_evidence_requirements: requiredRefs,
  guardrail_requirements: refs,
  confidence_requirements: refs,
});
export type BenchmarkEvaluationProfile = z.infer<typeof benchmarkEvaluationProfileSchema>;

export const benchmarkGuardrailsDomainExtensionSchema = z.object({
  benchmarks_guardrails: benchmarkEvaluationProfileSchema.optional(),
});
export type BenchmarkGuardrailsDomainExtension = z.infer<typeof benchmarkGuardrailsDomainExtensionSchema>;

export type BenchmarkGuardrailsTemplateValidation = {
  valid: boolean;
  profile: BenchmarkEvaluationProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): BenchmarkGuardrailsTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseBenchmarkGuardrailsDomainExtension(raw: unknown): BenchmarkGuardrailsDomainExtension | null {
  const parsed = benchmarkGuardrailsDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateBenchmarkGuardrailsPlaybookTemplate(raw: PlaybookTemplateInput): BenchmarkGuardrailsTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["BENCHMARK_GUARDRAILS.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "benchmarks_guardrails")) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "BENCHMARKS_GUARDRAILS") return invalid(["BENCHMARK_GUARDRAILS.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.benchmarks_guardrails"]);
  const parsedExtension = benchmarkGuardrailsDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.benchmarks_guardrails) return invalid(["BENCHMARK_GUARDRAILS.PROFILE_REQUIRED"], ["domain_extension.benchmarks_guardrails"]);
  return { valid: true, profile: parsedExtension.data.benchmarks_guardrails, reason_codes: [], unresolved_fields: [] };
}
