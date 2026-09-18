import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const ACQUISITION_DEMAND_MOTIONS = [
  "ASSESS_NEW_CUSTOMERS", "EVALUATE_CAC", "ASSESS_SUSTAINABILITY", "CHECK_CUSTOMER_QUALITY",
  "ANALYZE_CHANNEL_MIX", "CHECK_DEPENDENCY", "ASSESS_MARGINAL_EFFICIENCY", "DISTINGUISH_DEMAND_DISTRIBUTION",
  "CHECK_RESTRICTIONS", "ASSESS_INCREMENTALITY",
] as const;
export const ACQUISITION_CHANNEL_ROLES = [
  "DEMAND_GENERATION", "DEMAND_CAPTURE", "RETARGETING", "RETENTION", "BRAND", "UNKNOWN",
] as const;

const refs = z.array(z.string().min(1)).default([]);
const requiredRefs = z.array(z.string().min(1)).min(1);

export const acquisitionDemandProfileSchema = z.object({
  acquisition_motion: z.enum(ACQUISITION_DEMAND_MOTIONS),
  metric_refs: requiredRefs,
  objective_refs: requiredRefs,
  acquisition_definition_refs: requiredRefs,
  economic_guardrail_refs: requiredRefs,
  customer_quality_refs: requiredRefs,
  channel_role_refs: z.array(z.enum(ACQUISITION_CHANNEL_ROLES)).min(1),
  dependency_refs: requiredRefs,
  scale_refs: requiredRefs,
  restriction_refs: requiredRefs,
  cohort_refs: requiredRefs,
  incrementality_refs: refs,
  limitation_requirements: requiredRefs,
});
export type AcquisitionDemandProfile = z.infer<typeof acquisitionDemandProfileSchema>;

export const acquisitionDemandDomainExtensionSchema = z.object({
  acquisition_demand: acquisitionDemandProfileSchema.optional(),
});
export type AcquisitionDemandDomainExtension = z.infer<typeof acquisitionDemandDomainExtensionSchema>;

export type AcquisitionDemandTemplateValidation = {
  valid: boolean;
  profile: AcquisitionDemandProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): AcquisitionDemandTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseAcquisitionDemandDomainExtension(raw: unknown): AcquisitionDemandDomainExtension | null {
  const parsed = acquisitionDemandDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateAcquisitionDemandPlaybookTemplate(raw: PlaybookTemplateInput): AcquisitionDemandTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["ACQUISITION_DEMAND.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "acquisition_demand")) return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  if (template.domain !== "ACQUISITION_DEMAND") return invalid(["ACQUISITION_DEMAND.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.acquisition_demand"]);
  const parsedExtension = acquisitionDemandDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.acquisition_demand) return invalid(["ACQUISITION_DEMAND.PROFILE_REQUIRED"], ["domain_extension.acquisition_demand"]);
  return { valid: true, profile: parsedExtension.data.acquisition_demand, reason_codes: [], unresolved_fields: [] };
}
