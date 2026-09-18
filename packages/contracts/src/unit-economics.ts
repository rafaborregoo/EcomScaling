import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const UNIT_ECONOMICS_INTERVENTION_FAMILIES = [
  "PRICING",
  "AOV",
  "COGS",
  "SHIPPING",
  "FULFILLMENT",
  "RETURNS",
  "PAYMENT_FEES",
  "CAC",
  "RETENTION",
  "PRODUCT_MIX",
  "GEO_MIX",
  "COST_STRUCTURE",
  "NO_ACTION",
] as const;
export type UnitEconomicsInterventionFamily = (typeof UNIT_ECONOMICS_INTERVENTION_FAMILIES)[number];

export const UNIT_ECONOMIC_UNITS = [
  "ORDER",
  "CUSTOMER",
  "SKU",
  "CHANNEL",
  "COHORT",
  "SEGMENT",
  "GEO",
  "MARKET",
] as const;
export type UnitEconomicUnit = (typeof UNIT_ECONOMIC_UNITS)[number];

export const unitEconomicsInterventionProfileSchema = z.object({
  intervention_family: z.enum(UNIT_ECONOMICS_INTERVENTION_FAMILIES),
  analysis_unit: z.enum(UNIT_ECONOMIC_UNITS),
  primary_metric_ref: z.string().min(1).optional(),
  economic_metric_ref: z.string().min(1).optional(),
  guardrail_metric_refs: z.array(z.string().min(1)).default([]),
  scenario_ref: z.string().min(1).optional(),
  reversible: z.boolean(),
});
export type UnitEconomicsInterventionProfile = z.infer<typeof unitEconomicsInterventionProfileSchema>;

export const unitEconomicsDomainExtensionSchema = z.object({
  unit_economics: unitEconomicsInterventionProfileSchema.optional(),
});
export type UnitEconomicsDomainExtension = z.infer<typeof unitEconomicsDomainExtensionSchema>;

export type UnitEconomicsTemplateValidation = {
  valid: boolean;
  profile: UnitEconomicsInterventionProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): UnitEconomicsTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseUnitEconomicsDomainExtension(raw: unknown): UnitEconomicsDomainExtension | null {
  const parsed = unitEconomicsDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateUnitEconomicsPlaybookTemplate(raw: PlaybookTemplateInput): UnitEconomicsTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["UNIT_ECONOMICS.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "unit_economics")) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "UNIT_ECONOMICS") {
    return invalid(["UNIT_ECONOMICS.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.unit_economics"]);
  }
  const parsedExtension = unitEconomicsDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.unit_economics) {
    return invalid(["UNIT_ECONOMICS.DOMAIN_EXTENSION_INVALID"], ["unit_economics"]);
  }
  return { valid: true, profile: parsedExtension.data.unit_economics, reason_codes: [], unresolved_fields: [] };
}
