import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const OFFER_INTERVENTION_FAMILIES = [
  "BUNDLE",
  "CROSS_SELL",
  "UPSELL",
  "THRESHOLD",
  "PRICE_CHANGE",
  "PROMOTION_TARGETING",
  "MERCHANDISING",
  "SKU_RATIONALIZATION",
  "LIQUIDATION",
  "FINANCING",
  "PRODUCT_LADDER",
] as const;
export type OfferInterventionFamily = (typeof OFFER_INTERVENTION_FAMILIES)[number];

/**
 * Extensión acotada para transportar una intervención económica de oferta.
 * Los objetivos, límites y fórmulas no se fijan aquí: no están definidos por
 * el corpus y deben venir declarados por el tenant o por una experiencia.
 */
export const offerPricingInterventionProfileSchema = z.object({
  intervention_family: z.enum(OFFER_INTERVENTION_FAMILIES),
  offer_ref: z.string().min(1).optional(),
  product_refs: z.array(z.string().min(1)).default([]),
  primary_metric_ref: z.string().min(1).optional(),
  economic_metric_ref: z.string().min(1),
  guardrail_metric_refs: z.array(z.string().min(1)).default([]),
  reversible: z.boolean(),
});
export type OfferPricingInterventionProfile = z.infer<
  typeof offerPricingInterventionProfileSchema
>;

export const offerPricingDomainExtensionSchema = z.object({
  offer_pricing: offerPricingInterventionProfileSchema.optional(),
});
export type OfferPricingDomainExtension = z.infer<
  typeof offerPricingDomainExtensionSchema
>;

export type OfferPricingTemplateValidation = {
  valid: boolean;
  profile: OfferPricingInterventionProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(
  reason_codes: string[],
  unresolved_fields: string[] = [],
): OfferPricingTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseOfferPricingDomainExtension(
  raw: unknown,
): OfferPricingDomainExtension | null {
  const parsed = offerPricingDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateOfferPricingPlaybookTemplate(
  raw: PlaybookTemplateInput,
): OfferPricingTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) {
    return invalid(["OFFER.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  }
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "offer_pricing")) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "OFFER_PRICING") {
    return invalid(
      ["OFFER.DOMAIN_EXTENSION_FORBIDDEN"],
      ["domain_extension.offer_pricing"],
    );
  }
  const parsedExtension = offerPricingDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.offer_pricing) {
    return invalid(["OFFER.DOMAIN_EXTENSION_INVALID"], ["offer_pricing"]);
  }
  const profile = parsedExtension.data.offer_pricing;
  if (profile.intervention_family === "PRICE_CHANGE" && !profile.primary_metric_ref) {
    return invalid(["OFFER.PRICE_PRIMARY_METRIC_REQUIRED"], ["primary_metric_ref"]);
  }
  if (profile.intervention_family === "BUNDLE" && profile.product_refs.length < 2) {
    return invalid(["OFFER.BUNDLE_PRODUCTS_REQUIRED"], ["product_refs"]);
  }
  return { valid: true, profile, reason_codes: [], unresolved_fields: [] };
}
