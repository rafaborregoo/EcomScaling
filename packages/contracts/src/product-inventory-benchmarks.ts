import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const PRODUCT_INVENTORY_BENCHMARK_MOTIONS = [
  "VALIDATE_STOCK",
  "ASSESS_DEMAND_VELOCITY",
  "ASSESS_COVERAGE",
  "ASSESS_STOCKOUT_RISK",
  "ASSESS_AGING",
  "ASSESS_SELL_THROUGH",
  "ASSESS_SUPPLIER",
  "EVALUATE_GUARDRAILS",
  "CHOOSE_METHOD",
] as const;
export const PRODUCT_INVENTORY_GUARDRAIL_FAMILIES = [
  "ACCURACY",
  "AVAILABILITY",
  "CASH",
  "STOCKOUT",
  "OVERSTOCK",
  "SUPPLIER",
  "MARGIN",
  "DATA_QUALITY",
] as const;
const refs = z.array(z.string().min(1)).default([]);
const req = z.array(z.string().min(1)).min(1);
export const productInventoryBenchmarksProfileSchema = z.object({
  product_inventory_motion: z.enum(PRODUCT_INVENTORY_BENCHMARK_MOTIONS),
  stock_refs: req,
  accuracy_refs: req,
  demand_refs: req,
  coverage_refs: req,
  stockout_refs: req,
  method_refs: req,
  limitation_requirements: req,
  lead_time_refs: refs,
  aging_refs: refs,
  supplier_refs: refs,
  economics_refs: refs,
  benchmark_refs: refs,
  guardrail_families: z.array(z.enum(PRODUCT_INVENTORY_GUARDRAIL_FAMILIES)).default([]),
});
export type ProductInventoryBenchmarksProfile = z.infer<typeof productInventoryBenchmarksProfileSchema>;
export const productInventoryBenchmarksDomainExtensionSchema = z.object({ product_inventory_benchmarks: productInventoryBenchmarksProfileSchema.optional() });
export type ProductInventoryBenchmarksDomainExtension = z.infer<typeof productInventoryBenchmarksDomainExtensionSchema>;
export type ProductInventoryBenchmarksTemplateValidation = { valid: boolean; profile: ProductInventoryBenchmarksProfile | null; reason_codes: string[]; unresolved_fields: string[] };
const invalid = (reason_codes: string[], unresolved_fields: string[] = []): ProductInventoryBenchmarksTemplateValidation => ({ valid: false, profile: null, reason_codes, unresolved_fields });
export function parseProductInventoryBenchmarksDomainExtension(raw: unknown): ProductInventoryBenchmarksDomainExtension | null { const parsed = productInventoryBenchmarksDomainExtensionSchema.safeParse(raw); return parsed.success ? parsed.data : null; }
export function validateProductInventoryBenchmarksPlaybookTemplate(raw: PlaybookTemplateInput): ProductInventoryBenchmarksTemplateValidation {
  const parsed = playbookTemplateSchema.safeParse(raw);
  if (!parsed.success) return invalid(["PRODUCT_INVENTORY_BENCHMARKS.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsed.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "product_inventory_benchmarks")) return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  if (template.domain !== "PRODUCT_INVENTORY_BENCHMARKS") return invalid(["PRODUCT_INVENTORY_BENCHMARKS.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.product_inventory_benchmarks"]);
  const profile = productInventoryBenchmarksDomainExtensionSchema.safeParse(extension);
  if (!profile.success || !profile.data.product_inventory_benchmarks) return invalid(["PRODUCT_INVENTORY_BENCHMARKS.PROFILE_REQUIRED"], ["domain_extension.product_inventory_benchmarks"]);
  return { valid: true, profile: profile.data.product_inventory_benchmarks, reason_codes: [], unresolved_fields: [] };
}
