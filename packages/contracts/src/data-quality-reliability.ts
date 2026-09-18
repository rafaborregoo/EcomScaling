import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const DATA_QUALITY_MOTIONS = [
  "VALIDATE_METRIC", "SELECT_SOURCE_OF_TRUTH", "CHECK_COMPLETENESS", "CHECK_RECONCILIATION",
  "CHECK_MATURITY", "CHECK_MISSINGNESS", "CHECK_PLAUSIBILITY", "ASSESS_CONFIDENCE", "BOUND_CLAIM",
] as const;
export const DATA_QUALITY_DIMENSIONS = [
  "ACCURACY", "COMPLETENESS", "CONSISTENCY", "FRESHNESS", "REPRESENTATIVENESS",
  "COMPARABILITY", "GRANULARITY", "DEFINITION", "INTEGRITY", "TRACEABILITY",
] as const;
export const DATA_EVIDENCE_KINDS = [
  "TRANSACTIONAL", "BEHAVIORAL", "ATTRIBUTED", "MODELED", "INFERRED",
  "OBSERVED", "IMPUTED", "ESTIMATED", "EXTRAPOLATED",
] as const;

const refs = z.array(z.string().min(1)).default([]);
const requiredRefs = z.array(z.string().min(1)).min(1);

export const dataQualityReliabilityProfileSchema = z.object({
  quality_motion: z.enum(DATA_QUALITY_MOTIONS),
  metric_refs: requiredRefs,
  quality_dimensions: z.array(z.enum(DATA_QUALITY_DIMENSIONS)).min(1),
  source_of_truth_refs: refs,
  evidence_requirements: requiredRefs,
  missingness_requirements: requiredRefs,
  maturity_requirements: requiredRefs,
  reconciliation_requirements: refs,
  mathematical_check_requirements: refs,
  limitation_requirements: requiredRefs,
  confidence_requirements: requiredRefs,
});
export type DataQualityReliabilityProfile = z.infer<typeof dataQualityReliabilityProfileSchema>;

export const dataQualityReliabilityDomainExtensionSchema = z.object({
  data_quality_reliability: dataQualityReliabilityProfileSchema.optional(),
});
export type DataQualityReliabilityDomainExtension = z.infer<typeof dataQualityReliabilityDomainExtensionSchema>;

export type DataQualityReliabilityTemplateValidation = {
  valid: boolean;
  profile: DataQualityReliabilityProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): DataQualityReliabilityTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseDataQualityReliabilityDomainExtension(raw: unknown): DataQualityReliabilityDomainExtension | null {
  const parsed = dataQualityReliabilityDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateDataQualityReliabilityPlaybookTemplate(raw: PlaybookTemplateInput): DataQualityReliabilityTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["DATA_QUALITY_RELIABILITY.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "data_quality_reliability")) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "DATA_QUALITY_RELIABILITY") return invalid(["DATA_QUALITY_RELIABILITY.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.data_quality_reliability"]);
  const parsedExtension = dataQualityReliabilityDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.data_quality_reliability) return invalid(["DATA_QUALITY_RELIABILITY.PROFILE_REQUIRED"], ["domain_extension.data_quality_reliability"]);
  return { valid: true, profile: parsedExtension.data.data_quality_reliability, reason_codes: [], unresolved_fields: [] };
}
