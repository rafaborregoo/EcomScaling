import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const SCALABILITY_MOTIONS = [
  "REMOVE_BINDING_CONSTRAINT", "EXPAND_CAPACITY", "INCREASE_HEADROOM", "REDUCE_FRAGILITY",
  "DECOUPLE_DEPENDENCY", "STANDARDIZE_FOR_SCALE", "AUTOMATE_FOR_SCALE", "DISTRIBUTE_LOAD",
  "PREPARE_NEXT_SCALE_STAGE", "PROTECT_SCALING_ECONOMICS",
] as const;
export const SCALE_SCOPES = [
  "RESOURCE", "PROCESS", "TEAM", "SYSTEM", "CHANNEL", "MARKET", "WAREHOUSE",
  "SUPPLIER_NETWORK", "BUSINESS_FUNCTION", "BUSINESS_WIDE",
] as const;
export const HEADROOM_STATES = ["HIGH", "ADEQUATE", "LOW", "CRITICAL", "UNKNOWN"] as const;

const refs = z.array(z.string().min(1)).default([]);
const evidenceRefs = z.array(z.string().min(1)).min(1);

export const scalabilityInterventionProfileSchema = z.object({
  scalability_motion: z.enum(SCALABILITY_MOTIONS),
  constraint_ref: z.string().min(1),
  constraint_domain_ref: z.string().min(1).optional(),
  constrained_resource_ref: z.string().min(1).optional(),
  capacity_context_ref: z.string().min(1).optional(),
  headroom_state: z.enum(HEADROOM_STATES).optional(),
  dependency_refs: refs,
  scale_scope: z.enum(SCALE_SCOPES),
  scaling_target_ref: z.string().min(1).optional(),
  readiness_requirements: evidenceRefs,
  scalability_evidence_requirements: evidenceRefs,
  economics_requirements: refs,
  resilience_requirements: refs,
  measurement_requirements: refs,
});
export type ScalabilityInterventionProfile = z.infer<typeof scalabilityInterventionProfileSchema>;

export const scalabilityDomainExtensionSchema = z.object({
  scalability: scalabilityInterventionProfileSchema.optional(),
});
export type ScalabilityDomainExtension = z.infer<typeof scalabilityDomainExtensionSchema>;

export type ScalabilityTemplateValidation = {
  valid: boolean;
  profile: ScalabilityInterventionProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): ScalabilityTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseScalabilityDomainExtension(raw: unknown): ScalabilityDomainExtension | null {
  const parsed = scalabilityDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateScalabilityPlaybookTemplate(raw: PlaybookTemplateInput): ScalabilityTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["SCALABILITY.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "scalability")) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "SCALABILITY") return invalid(["SCALABILITY.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.scalability"]);
  const parsedExtension = scalabilityDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.scalability) return invalid(["SCALABILITY.CONSTRAINT_PROFILE_REQUIRED"], ["domain_extension.scalability"]);
  const profile = parsedExtension.data.scalability;
  return { valid: true, profile, reason_codes: [], unresolved_fields: [] };
}
