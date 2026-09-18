import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const RETENTION_INTERVENTION_FAMILIES = [
  "WELCOME",
  "POST_PURCHASE",
  "SECOND_PURCHASE",
  "REPLENISHMENT",
  "CROSS_SELL",
  "WIN_BACK",
  "LOYALTY",
  "SUBSCRIPTION",
  "SERVICE_RECOVERY",
  "PROACTIVE_SERVICE",
  "NO_ACTION",
  "CONTACT_POLICY",
] as const;
export type RetentionInterventionFamily = (typeof RETENTION_INTERVENTION_FAMILIES)[number];

export const RETENTION_CHANNELS = ["EMAIL", "SMS", "PUSH", "IN_APP", "NONE"] as const;
export type RetentionChannel = (typeof RETENTION_CHANNELS)[number];

export const retentionCrmInterventionProfileSchema = z.object({
  intervention_family: z.enum(RETENTION_INTERVENTION_FAMILIES),
  lifecycle_state_ref: z.string().min(1).optional(),
  segment_ref: z.string().min(1).optional(),
  channel: z.enum(RETENTION_CHANNELS).optional(),
  incentive_ref: z.string().min(1).optional(),
  primary_metric_ref: z.string().min(1).optional(),
  economic_metric_ref: z.string().min(1).optional(),
  guardrail_metric_refs: z.array(z.string().min(1)).default([]),
  consent_required: z.boolean(),
  reversible: z.boolean(),
});
export type RetentionCrmInterventionProfile = z.infer<typeof retentionCrmInterventionProfileSchema>;

export const retentionCrmDomainExtensionSchema = z.object({
  retention_crm: retentionCrmInterventionProfileSchema.optional(),
});
export type RetentionCrmDomainExtension = z.infer<typeof retentionCrmDomainExtensionSchema>;

export type RetentionCrmTemplateValidation = {
  valid: boolean;
  profile: RetentionCrmInterventionProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): RetentionCrmTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseRetentionCrmDomainExtension(raw: unknown): RetentionCrmDomainExtension | null {
  const parsed = retentionCrmDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateRetentionCrmPlaybookTemplate(raw: PlaybookTemplateInput): RetentionCrmTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["RETENTION.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "retention_crm")) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "RETENTION_CRM") {
    return invalid(["RETENTION.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.retention_crm"]);
  }
  const parsedExtension = retentionCrmDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.retention_crm) {
    return invalid(["RETENTION.DOMAIN_EXTENSION_INVALID"], ["retention_crm"]);
  }
  return { valid: true, profile: parsedExtension.data.retention_crm, reason_codes: [], unresolved_fields: [] };
}
