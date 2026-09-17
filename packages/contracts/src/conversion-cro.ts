import { z } from "zod";
import {
  playbookTemplateSchema,
  type PlaybookTemplateInput,
} from "./playbook.js";

/** Nomenclatura del artefacto CRO; no implica que cada etapa tenga dato. */
export const CRO_FUNNEL_STAGES = [
  "session",
  "discovery",
  "pdp",
  "add_to_cart",
  "cart",
  "checkout",
  "payment",
  "purchase",
] as const;
export type CroFunnelStage = (typeof CRO_FUNNEL_STAGES)[number];

export const CRO_INTERVENTION_MODES = ["FIX", "RESEARCH", "TEST"] as const;
export type CroInterventionMode = (typeof CRO_INTERVENTION_MODES)[number];

export const CRO_EVIDENCE_REQUIREMENTS = [
  "FUNNEL_EVIDENCE",
  "TRAFFIC_QUALITY_EVIDENCE",
  "SEGMENT_EVIDENCE",
  "QUALITATIVE_RESEARCH_EVIDENCE",
  "PRODUCT_OFFER_EVIDENCE",
  "CHECKOUT_PAYMENT_EVIDENCE",
  "ECONOMIC_GUARDRAIL_EVIDENCE",
  "POST_PURCHASE_EVIDENCE",
] as const;
export type CroEvidenceRequirement = (typeof CRO_EVIDENCE_REQUIREMENTS)[number];

/**
 * La extensión solo transporta el contexto CRO que el contrato conceptual
 * exige. La duración, el tamaño muestral, los umbrales y la significancia no
 * viven aquí porque la fuente no los define.
 */
export const croInterventionProfileSchema = z.object({
  intervention_mode: z.enum(CRO_INTERVENTION_MODES),
  funnel_stage: z.enum(CRO_FUNNEL_STAGES),
  affected_segment_ref: z.string().min(1).optional(),
  hypothesis_ref: z.string().min(1).optional(),
  primary_metric_ref: z.string().min(1).optional(),
  guardrail_metric_refs: z.array(z.string().min(1)).default([]),
  economic_metric_ref: z.string().min(1).optional(),
  evidence_requirements: z.array(z.enum(CRO_EVIDENCE_REQUIREMENTS)).min(1),
});
export type CroInterventionProfile = z.infer<typeof croInterventionProfileSchema>;

export const conversionCroDomainExtensionSchema = z.object({
  conversion_cro: croInterventionProfileSchema.optional(),
});
export type ConversionCroDomainExtension = z.infer<
  typeof conversionCroDomainExtensionSchema
>;

export type ConversionCroTemplateValidation = {
  valid: boolean;
  profile: CroInterventionProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(
  reason_codes: string[],
  unresolved_fields: string[] = [],
): ConversionCroTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseConversionCroDomainExtension(
  raw: unknown,
): ConversionCroDomainExtension | null {
  const parsed = conversionCroDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateConversionCroPlaybookTemplate(
  raw: PlaybookTemplateInput,
): ConversionCroTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) {
    return invalid(["CRO.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  }

  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  const hasExtension = Object.prototype.hasOwnProperty.call(
    extension,
    "conversion_cro",
  );
  if (!hasExtension) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "CONVERSION") {
    return invalid(
      ["CRO.DOMAIN_EXTENSION_FORBIDDEN"],
      ["domain_extension.conversion_cro"],
    );
  }

  const parsedExtension = conversionCroDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.conversion_cro) {
    return invalid(["CRO.DOMAIN_EXTENSION_INVALID"], ["conversion_cro"]);
  }
  const profile = parsedExtension.data.conversion_cro;
  if (profile.intervention_mode === "TEST" && !profile.hypothesis_ref) {
    return invalid(["CRO.TEST_HYPOTHESIS_REQUIRED"], ["hypothesis_ref"]);
  }
  if (profile.intervention_mode === "TEST" && !profile.primary_metric_ref) {
    return invalid(["CRO.TEST_PRIMARY_METRIC_REQUIRED"], ["primary_metric_ref"]);
  }
  return { valid: true, profile, reason_codes: [], unresolved_fields: [] };
}
