import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const COHORT_SCOPES = [
  "CONTROL", "HISTORICAL_COMPARABLE", "INTERNAL_SEGMENT", "PEER_GROUP", "INDUSTRY", "GENERIC",
] as const;
export const COHORT_DIMENSIONS = [
  "sector", "category", "business_model", "aov", "margin", "recurrence", "purchase_cycle",
  "geography", "device", "source_channel", "audience_temperature", "new_vs_returning", "maturity",
  "revenue_scale", "order_volume", "catalog_size", "sku_concentration", "brand_awareness",
  "promotional_intensity", "seasonality", "commercial_calendar", "product_market_fit", "demand_type",
  "acquisition_type", "strategic_objective", "first_product", "discount", "customer_value", "first_order",
] as const;
export const COHORT_MOTIONS = [
  "IDENTIFY_METRIC", "SELECT_REFERENCE", "CHECK_DEFINITIONS", "CHECK_SAMPLE", "CHECK_MIX",
  "CHECK_TEMPORAL_CONTEXT", "ASSESS_COMPARABILITY", "ASSESS_CONFIDENCE", "TRIANGULATE_EVIDENCE",
] as const;
export const COMPARABILITY_LEVELS = ["HIGH", "MEDIUM", "LOW", "NOT_COMPARABLE", "UNKNOWN"] as const;

const refs = z.array(z.string().min(1)).default([]);
const requiredRefs = z.array(z.string().min(1)).min(1);

export const cohortContextProfileSchema = z.object({
  cohort_motion: z.enum(COHORT_MOTIONS),
  metric_refs: requiredRefs,
  material_dimensions: z.array(z.enum(COHORT_DIMENSIONS)).min(1),
  cohort_scopes: z.array(z.enum(COHORT_SCOPES)).min(1),
  cohort_dimension_refs: z.array(z.enum(COHORT_DIMENSIONS)).default([]),
  reference_priority: z.array(z.enum(COHORT_SCOPES)).min(1),
  definition_requirements: requiredRefs,
  sample_requirements: requiredRefs,
  mix_control_requirements: refs,
  limitation_requirements: requiredRefs,
});
export type CohortContextProfile = z.infer<typeof cohortContextProfileSchema>;

export const cohortContextDomainExtensionSchema = z.object({
  cohort_context: cohortContextProfileSchema.optional(),
});
export type CohortContextDomainExtension = z.infer<typeof cohortContextDomainExtensionSchema>;

export type CohortContextTemplateValidation = {
  valid: boolean;
  profile: CohortContextProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): CohortContextTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseCohortContextDomainExtension(raw: unknown): CohortContextDomainExtension | null {
  const parsed = cohortContextDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateCohortContextPlaybookTemplate(raw: PlaybookTemplateInput): CohortContextTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["COHORT_CONTEXT.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "cohort_context")) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "COHORT_CONTEXT") return invalid(["COHORT_CONTEXT.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.cohort_context"]);
  const parsedExtension = cohortContextDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.cohort_context) return invalid(["COHORT_CONTEXT.PROFILE_REQUIRED"], ["domain_extension.cohort_context"]);
  const profile = parsedExtension.data.cohort_context;
  const invalidPriority = profile.reference_priority.some((scope) => !profile.cohort_scopes.includes(scope));
  if (invalidPriority) return invalid(["COHORT_CONTEXT.REFERENCE_PRIORITY_OUTSIDE_SCOPE"], ["domain_extension.cohort_context.reference_priority"]);
  return { valid: true, profile, reason_codes: [], unresolved_fields: [] };
}
