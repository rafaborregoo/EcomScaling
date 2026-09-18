import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const CONVERSION_CRO_MOTIONS = [
  "VALIDATE_CONVERSION_DEFINITION",
  "CONTROL_MIX",
  "DECOMPOSE_FUNNEL",
  "ASSESS_TECHNICAL_FRICTION",
  "ASSESS_ECONOMICS",
  "EVALUATE_GUARDRAILS",
  "CHOOSE_METHOD",
  "ASSESS_EXPERIMENT",
  "CAPTURE_LEARNING",
] as const;

export const CRO_GUARDRAIL_FAMILIES = [
  "AOV", "MARGIN", "CONTRIBUTION", "RETURNS", "CANCELLATIONS", "CUSTOMER_QUALITY",
  "SUPPORT", "BRAND", "LEGAL_ETHICAL", "INVENTORY", "OPERATIONS", "FRAUD",
  "PAYMENT_AUTHORIZATION", "MIX", "SAMPLE",
] as const;

const refs = z.array(z.string().min(1)).default([]);
const requiredRefs = z.array(z.string().min(1)).min(1);

export const conversionCroBenchmarksProfileSchema = z.object({
  conversion_cro_motion: z.enum(CONVERSION_CRO_MOTIONS),
  conversion_definition_refs: requiredRefs,
  funnel_metric_refs: requiredRefs,
  segment_refs: refs,
  mix_refs: refs,
  benchmark_refs: refs,
  economic_metric_refs: requiredRefs,
  technical_evidence_refs: refs,
  offer_context_refs: refs,
  hypothesis_refs: refs,
  experiment_refs: refs,
  guardrail_families: z.array(z.enum(CRO_GUARDRAIL_FAMILIES)).default([]),
  opportunity_refs: refs,
  method_refs: requiredRefs,
  learning_refs: refs,
  limitation_requirements: requiredRefs,
});
export type ConversionCroBenchmarksProfile = z.infer<typeof conversionCroBenchmarksProfileSchema>;

export const conversionCroBenchmarksDomainExtensionSchema = z.object({
  conversion_cro_benchmarks: conversionCroBenchmarksProfileSchema.optional(),
});
export type ConversionCroBenchmarksDomainExtension = z.infer<typeof conversionCroBenchmarksDomainExtensionSchema>;

export type ConversionCroBenchmarksTemplateValidation = {
  valid: boolean;
  profile: ConversionCroBenchmarksProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): ConversionCroBenchmarksTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseConversionCroBenchmarksDomainExtension(raw: unknown): ConversionCroBenchmarksDomainExtension | null {
  const parsed = conversionCroBenchmarksDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateConversionCroBenchmarksPlaybookTemplate(raw: PlaybookTemplateInput): ConversionCroBenchmarksTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["CONVERSION_CRO_BENCHMARKS.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "conversion_cro_benchmarks")) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "CONVERSION_CRO_BENCHMARKS") {
    return invalid(["CONVERSION_CRO_BENCHMARKS.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.conversion_cro_benchmarks"]);
  }
  const parsedExtension = conversionCroBenchmarksDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.conversion_cro_benchmarks) {
    return invalid(["CONVERSION_CRO_BENCHMARKS.PROFILE_REQUIRED"], ["domain_extension.conversion_cro_benchmarks"]);
  }
  return { valid: true, profile: parsedExtension.data.conversion_cro_benchmarks, reason_codes: [], unresolved_fields: [] };
}
