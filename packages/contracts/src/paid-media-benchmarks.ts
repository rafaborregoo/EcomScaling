import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const PAID_MEDIA_MOTIONS = [
  "VALIDATE_OBJECTIVE",
  "DECOMPOSE_EFFICIENCY_CHAIN",
  "ASSESS_MEDIA_EFFICIENCY",
  "ASSESS_BUSINESS_EFFICIENCY",
  "ASSESS_INCREMENTALITY",
  "ASSESS_SCALE",
  "ASSESS_ATTRIBUTION",
  "ASSESS_CONCENTRATION",
  "LOCATE_DETERIORATION",
  "APPLY_GUARDRAILS",
] as const;

export const PAID_MEDIA_GUARDRAIL_FAMILIES = [
  "CONTRIBUTION",
  "CASH",
  "PAYBACK",
  "INVENTORY",
  "OPERATIONS",
  "RETURNS",
  "CUSTOMER_QUALITY",
  "ATTRIBUTION",
  "SAMPLE",
  "CONCENTRATION",
  "MARGINAL_EFFICIENCY",
] as const;

const refs = z.array(z.string().min(1)).default([]);
const requiredRefs = z.array(z.string().min(1)).min(1);

export const paidMediaBenchmarksProfileSchema = z.object({
  paid_media_motion: z.enum(PAID_MEDIA_MOTIONS),
  metric_refs: requiredRefs,
  objective_refs: requiredRefs,
  media_efficiency_refs: refs,
  post_click_refs: refs,
  acquisition_refs: refs,
  economics_refs: refs,
  incrementality_refs: refs,
  attribution_refs: refs,
  scale_refs: refs,
  customer_mix_refs: refs,
  guardrail_families: z.array(z.enum(PAID_MEDIA_GUARDRAIL_FAMILIES)).default([]),
  benchmark_context_refs: requiredRefs,
  limitation_requirements: requiredRefs,
});
export type PaidMediaBenchmarksProfile = z.infer<typeof paidMediaBenchmarksProfileSchema>;

export const paidMediaBenchmarksDomainExtensionSchema = z.object({
  paid_media_benchmarks: paidMediaBenchmarksProfileSchema.optional(),
});
export type PaidMediaBenchmarksDomainExtension = z.infer<typeof paidMediaBenchmarksDomainExtensionSchema>;

export type PaidMediaBenchmarksTemplateValidation = {
  valid: boolean;
  profile: PaidMediaBenchmarksProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): PaidMediaBenchmarksTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parsePaidMediaBenchmarksDomainExtension(raw: unknown): PaidMediaBenchmarksDomainExtension | null {
  const parsed = paidMediaBenchmarksDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validatePaidMediaBenchmarksPlaybookTemplate(raw: PlaybookTemplateInput): PaidMediaBenchmarksTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["PAID_MEDIA_BENCHMARKS.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "paid_media_benchmarks")) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "PAID_MEDIA_BENCHMARKS") {
    return invalid(["PAID_MEDIA_BENCHMARKS.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.paid_media_benchmarks"]);
  }
  const parsedExtension = paidMediaBenchmarksDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.paid_media_benchmarks) {
    return invalid(["PAID_MEDIA_BENCHMARKS.PROFILE_REQUIRED"], ["domain_extension.paid_media_benchmarks"]);
  }
  return { valid: true, profile: parsedExtension.data.paid_media_benchmarks, reason_codes: [], unresolved_fields: [] };
}
