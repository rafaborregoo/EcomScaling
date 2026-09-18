import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const OFFER_PRICING_BENCHMARK_MOTIONS = [
  "VALIDATE_OFFER_CONTEXT", "DECOMPOSE_AOV", "ASSESS_PRICING", "ASSESS_PROMOTION", "ASSESS_PRODUCT_MIX",
  "ASSESS_MERCHANDISING", "ASSESS_INCREMENTALITY", "ASSESS_CUSTOMER_QUALITY", "EVALUATE_GUARDRAILS", "CHOOSE_METHOD",
] as const;
export const OFFER_PRICING_GUARDRAIL_FAMILIES = [
  "MARGIN", "CVR", "CUSTOMER_QUALITY", "BRAND", "RETURNS", "INVENTORY", "FUTURE_DEMAND", "TRANSPARENCY", "INCREMENTALITY", "COMPLEXITY", "SAMPLE",
] as const;
const refs = z.array(z.string().min(1)).default([]);
const requiredRefs = z.array(z.string().min(1)).min(1);

export const offerPricingBenchmarksProfileSchema = z.object({
  offer_pricing_motion: z.enum(OFFER_PRICING_BENCHMARK_MOTIONS),
  offer_refs: requiredRefs, pricing_refs: requiredRefs, aov_refs: requiredRefs, economics_refs: requiredRefs,
  product_mix_refs: refs, promotion_refs: refs, customer_quality_refs: refs, merchandising_refs: refs,
  incrementality_refs: refs, guardrail_families: z.array(z.enum(OFFER_PRICING_GUARDRAIL_FAMILIES)).default([]),
  benchmark_refs: refs, method_refs: requiredRefs, limitation_requirements: requiredRefs,
});
export type OfferPricingBenchmarksProfile = z.infer<typeof offerPricingBenchmarksProfileSchema>;
export const offerPricingBenchmarksDomainExtensionSchema = z.object({ offer_pricing_benchmarks: offerPricingBenchmarksProfileSchema.optional() });
export type OfferPricingBenchmarksDomainExtension = z.infer<typeof offerPricingBenchmarksDomainExtensionSchema>;
export type OfferPricingBenchmarksTemplateValidation = { valid: boolean; profile: OfferPricingBenchmarksProfile | null; reason_codes: string[]; unresolved_fields: string[] };
function invalid(reason_codes: string[], unresolved_fields: string[] = []): OfferPricingBenchmarksTemplateValidation { return { valid: false, profile: null, reason_codes, unresolved_fields }; }
export function parseOfferPricingBenchmarksDomainExtension(raw: unknown): OfferPricingBenchmarksDomainExtension | null { const parsed = offerPricingBenchmarksDomainExtensionSchema.safeParse(raw); return parsed.success ? parsed.data : null; }
export function validateOfferPricingBenchmarksPlaybookTemplate(raw: PlaybookTemplateInput): OfferPricingBenchmarksTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["OFFER_PRICING_BENCHMARKS.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "offer_pricing_benchmarks")) return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  if (template.domain !== "OFFER_PRICING_BENCHMARKS") return invalid(["OFFER_PRICING_BENCHMARKS.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.offer_pricing_benchmarks"]);
  const parsedExtension = offerPricingBenchmarksDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.offer_pricing_benchmarks) return invalid(["OFFER_PRICING_BENCHMARKS.PROFILE_REQUIRED"], ["domain_extension.offer_pricing_benchmarks"]);
  return { valid: true, profile: parsedExtension.data.offer_pricing_benchmarks, reason_codes: [], unresolved_fields: [] };
}
