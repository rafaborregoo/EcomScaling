import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const RECOVERY_MOTIONS = [
  "CONTAIN_IMPACT", "STABILIZE_SYSTEM", "PRESERVE_CONTINUITY", "DEGRADE_GRACEFULLY",
  "SWITCH_TO_CONTINGENCY", "RESTORE_CRITICAL_CAPABILITY", "RECOVER_SERVICE_LEVEL",
  "LIMIT_CUSTOMER_DAMAGE", "LIMIT_ECONOMIC_DAMAGE", "COORDINATE_MULTI_DOMAIN_RECOVERY",
  "RETURN_TO_NORMAL_OPERATING_MODE",
] as const;
export const CRISIS_SCOPES = ["LOCALIZED", "SINGLE_DOMAIN", "MULTI_DOMAIN", "BUSINESS_CRITICAL", "BUSINESS_WIDE"] as const;
export const RECOVERY_CUSTOMER_IMPACT_SCOPES = ["NO_DIRECT_IMPACT", "LIMITED_CUSTOMER_COHORT", "SPECIFIC_MARKET", "LARGE_CUSTOMER_SEGMENT", "CUSTOMER_BASE_WIDE"] as const;

const refs = z.array(z.string().min(1)).default([]);
const requiredRefs = z.array(z.string().min(1)).min(1);

export const recoveryCrisisInterventionProfileSchema = z.object({
  recovery_motion: z.enum(RECOVERY_MOTIONS),
  crisis_scope: z.enum(CRISIS_SCOPES),
  severity_ref: z.string().min(1).optional(),
  blast_radius_ref: z.string().min(1).optional(),
  affected_domain_refs: requiredRefs,
  affected_capability_refs: refs,
  customer_impact_scope: z.enum(RECOVERY_CUSTOMER_IMPACT_SCOPES).optional(),
  continuity_requirement_refs: refs,
  containment_requirements: requiredRefs,
  stabilization_requirements: requiredRefs,
  recovery_objective_refs: requiredRefs,
  dependency_refs: refs,
  contingency_ref: z.string().min(1).optional(),
  escalation_policy_ref: z.string().min(1).optional(),
  reversibility_requirement: z.string().min(1).optional(),
  recovery_evidence_requirements: requiredRefs,
  communication_requirement_refs: refs,
  measurement_requirements: refs,
});
export type RecoveryCrisisInterventionProfile = z.infer<typeof recoveryCrisisInterventionProfileSchema>;

export const recoveryCrisisDomainExtensionSchema = z.object({ recovery_crisis: recoveryCrisisInterventionProfileSchema.optional() });
export type RecoveryCrisisDomainExtension = z.infer<typeof recoveryCrisisDomainExtensionSchema>;
export type RecoveryCrisisTemplateValidation = { valid: boolean; profile: RecoveryCrisisInterventionProfile | null; reason_codes: string[]; unresolved_fields: string[] };

function invalid(reason_codes: string[], unresolved_fields: string[] = []): RecoveryCrisisTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseRecoveryCrisisDomainExtension(raw: unknown): RecoveryCrisisDomainExtension | null {
  const parsed = recoveryCrisisDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateRecoveryCrisisPlaybookTemplate(raw: PlaybookTemplateInput): RecoveryCrisisTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["RECOVERY_CRISIS.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "recovery_crisis")) return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  if (template.domain !== "RECOVERY_CRISIS") return invalid(["RECOVERY_CRISIS.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.recovery_crisis"]);
  const parsedExtension = recoveryCrisisDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.recovery_crisis) return invalid(["RECOVERY_CRISIS.PROFILE_REQUIRED"], ["domain_extension.recovery_crisis"]);
  return { valid: true, profile: parsedExtension.data.recovery_crisis, reason_codes: [], unresolved_fields: [] };
}
