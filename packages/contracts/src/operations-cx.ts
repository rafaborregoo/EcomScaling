import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const OPERATIONS_MOTIONS = [
  "CAPACITY_RECOVERY",
  "FULFILLMENT_RELIABILITY_IMPROVEMENT",
  "ORDER_CYCLE_TIME_REDUCTION",
  "FULFILLMENT_ERROR_REDUCTION",
  "DELIVERY_RELIABILITY_IMPROVEMENT",
  "RETURNS_PROCESS_IMPROVEMENT",
  "REVERSE_LOGISTICS_IMPROVEMENT",
  "SUPPORT_EFFICIENCY_IMPROVEMENT",
  "SERVICE_RECOVERY",
  "PROCESS_SIMPLIFICATION",
  "OPERATIONAL_COST_EFFICIENCY",
  "CUSTOMER_EXPERIENCE_RECOVERY",
] as const;
export type OperationsMotion = (typeof OPERATIONS_MOTIONS)[number];

export const OPERATIONAL_SURFACES = [
  "ORDER_PROCESSING", "WAREHOUSE", "PICKING", "PACKING", "FULFILLMENT",
  "CARRIER_HANDOFF", "SHIPPING", "DELIVERY", "RETURNS", "REFUNDS",
  "EXCHANGES", "REVERSE_LOGISTICS", "CUSTOMER_SUPPORT", "SERVICE_RECOVERY",
  "MULTI_SURFACE",
] as const;
export type OperationalSurface = (typeof OPERATIONAL_SURFACES)[number];

export const PROCESS_SCOPES = [
  "SINGLE_PROCESS", "PROCESS_STAGE", "FULFILLMENT_FLOW", "WAREHOUSE",
  "CARRIER", "MARKET", "ORDER_SEGMENT", "BUSINESS_WIDE",
] as const;
export type ProcessScope = (typeof PROCESS_SCOPES)[number];

export const CUSTOMER_IMPACT_SCOPES = [
  "NO_DIRECT_CUSTOMER_IMPACT", "AFFECTED_CUSTOMER_SEGMENT", "AFFECTED_ORDER_COHORT", "CUSTOMER_BASE_WIDE",
] as const;
export type CustomerImpactScope = (typeof CUSTOMER_IMPACT_SCOPES)[number];

export const CAPACITY_STATES = ["AVAILABLE_HEADROOM", "TIGHT", "SATURATED", "UNKNOWN"] as const;
export type CapacityState = (typeof CAPACITY_STATES)[number];

export const SERVICE_STATES = ["WITHIN_SERVICE_LEVEL", "AT_RISK", "BREACHED", "UNKNOWN"] as const;
export type ServiceState = (typeof SERVICE_STATES)[number];

const refs = z.array(z.string().min(1)).default([]);

export const operationsCxInterventionProfileSchema = z.object({
  operations_motion: z.enum(OPERATIONS_MOTIONS),
  operational_surface: z.enum(OPERATIONAL_SURFACES),
  process_scope: z.enum(PROCESS_SCOPES),
  entity_refs: refs,
  customer_impact_scope: z.enum(CUSTOMER_IMPACT_SCOPES).optional(),
  capacity_state: z.enum(CAPACITY_STATES).optional(),
  service_state: z.enum(SERVICE_STATES).optional(),
  operational_context_ref: z.string().min(1).optional(),
  operations_evidence_requirements: z.array(z.string().min(1)).min(1),
  capacity_requirements: refs,
  service_level_requirements: refs,
  economics_requirements: refs,
  measurement_requirements: refs,
});
export type OperationsCxInterventionProfile = z.infer<typeof operationsCxInterventionProfileSchema>;

export const operationsCxDomainExtensionSchema = z.object({
  operations_cx: operationsCxInterventionProfileSchema.optional(),
});
export type OperationsCxDomainExtension = z.infer<typeof operationsCxDomainExtensionSchema>;

export type OperationsCxTemplateValidation = {
  valid: boolean;
  profile: OperationsCxInterventionProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): OperationsCxTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseOperationsCxDomainExtension(raw: unknown): OperationsCxDomainExtension | null {
  const parsed = operationsCxDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateOperationsCxPlaybookTemplate(raw: PlaybookTemplateInput): OperationsCxTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["OPERATIONS_CX.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "operations_cx")) return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  if (template.domain !== "OPERATIONS_CX") return invalid(["OPERATIONS_CX.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.operations_cx"]);
  const parsedExtension = operationsCxDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.operations_cx) return invalid(["OPERATIONS_CX.DOMAIN_EXTENSION_INVALID"], ["operations_cx"]);
  const profile = parsedExtension.data.operations_cx;
  if ((profile.service_state === "AT_RISK" || profile.service_state === "BREACHED") && (!profile.operational_context_ref || profile.service_level_requirements.length === 0)) {
    return invalid(["OPERATIONS_CX.SERVICE_CONTEXT_REQUIRED"], ["operations_cx.operational_context_ref", "operations_cx.service_level_requirements"]);
  }
  if ((profile.operations_motion === "SERVICE_RECOVERY" || profile.operations_motion === "CUSTOMER_EXPERIENCE_RECOVERY") && !profile.customer_impact_scope) {
    return invalid(["OPERATIONS_CX.CUSTOMER_IMPACT_SCOPE_REQUIRED"], ["operations_cx.customer_impact_scope"]);
  }
  return { valid: true, profile, reason_codes: [], unresolved_fields: [] };
}
