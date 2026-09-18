import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const PRODUCT_INVENTORY_MOTIONS = [
  "ASSORTMENT_OPTIMIZATION",
  "SKU_RATIONALIZATION",
  "STOCK_AVAILABILITY_RECOVERY",
  "STOCKOUT_PREVENTION",
  "OVERSTOCK_REDUCTION",
  "INVENTORY_REALLOCATION",
  "REPLENISHMENT_CORRECTION",
  "PRODUCT_MIX_CORRECTION",
  "SLOW_MOVER_RECOVERY",
  "OBSOLESCENCE_REDUCTION",
  "CATALOG_SIMPLIFICATION",
  "CATALOG_EXPANSION",
] as const;
export type ProductInventoryMotion = (typeof PRODUCT_INVENTORY_MOTIONS)[number];

export const PRODUCT_INVENTORY_SURFACES = [
  "PRODUCT",
  "SKU",
  "VARIANT",
  "CATEGORY",
  "COLLECTION",
  "ASSORTMENT",
  "CATALOG",
  "INVENTORY_POOL",
  "REPLENISHMENT_POLICY",
  "SUPPLIER",
  "MULTI_SURFACE",
] as const;
export type ProductInventorySurface = (typeof PRODUCT_INVENTORY_SURFACES)[number];

export const PRODUCT_SCOPES = ["SINGLE_PRODUCT", "PRODUCT_SET", "CATEGORY", "COLLECTION", "CATALOG", "BUSINESS_WIDE"] as const;
export type ProductScope = (typeof PRODUCT_SCOPES)[number];

export const INVENTORY_STATES = ["HEALTHY", "LOW", "CRITICAL_LOW", "STOCKOUT", "EXCESS", "CRITICAL_EXCESS", "OBSOLETE_RISK", "UNKNOWN"] as const;
export type InventoryState = (typeof INVENTORY_STATES)[number];

export const DEMAND_SUPPLY_STATES = ["BALANCED", "DEMAND_EXCEEDS_SUPPLY", "SUPPLY_EXCEEDS_DEMAND", "VOLATILE", "SEASONAL_MISMATCH", "UNKNOWN"] as const;
export type DemandSupplyState = (typeof DEMAND_SUPPLY_STATES)[number];

const referenceArray = z.array(z.string().min(1)).default([]);

export const productInventoryInterventionProfileSchema = z.object({
  product_inventory_motion: z.enum(PRODUCT_INVENTORY_MOTIONS),
  intervention_surface: z.enum(PRODUCT_INVENTORY_SURFACES),
  product_scope: z.enum(PRODUCT_SCOPES),
  product_refs: referenceArray,
  category_refs: referenceArray,
  inventory_state: z.enum(INVENTORY_STATES).optional(),
  demand_supply_state: z.enum(DEMAND_SUPPLY_STATES).optional(),
  replenishment_context_ref: z.string().min(1).optional(),
  supplier_dependency_refs: referenceArray,
  product_inventory_evidence_requirements: z.array(z.string().min(1)).min(1),
  economics_requirements: referenceArray,
  operational_requirements: referenceArray,
  measurement_requirements: referenceArray,
});
export type ProductInventoryInterventionProfile = z.infer<typeof productInventoryInterventionProfileSchema>;

export const productInventoryDomainExtensionSchema = z.object({
  product_inventory: productInventoryInterventionProfileSchema.optional(),
});
export type ProductInventoryDomainExtension = z.infer<typeof productInventoryDomainExtensionSchema>;

export type ProductInventoryTemplateValidation = {
  valid: boolean;
  profile: ProductInventoryInterventionProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): ProductInventoryTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseProductInventoryDomainExtension(raw: unknown): ProductInventoryDomainExtension | null {
  const parsed = productInventoryDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateProductInventoryPlaybookTemplate(raw: PlaybookTemplateInput): ProductInventoryTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["PRODUCT_INVENTORY.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "product_inventory")) {
    return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  }
  if (template.domain !== "PRODUCT_INVENTORY") {
    return invalid(["PRODUCT_INVENTORY.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.product_inventory"]);
  }
  const parsedExtension = productInventoryDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.product_inventory) {
    return invalid(["PRODUCT_INVENTORY.DOMAIN_EXTENSION_INVALID"], ["product_inventory"]);
  }
  const profile = parsedExtension.data.product_inventory;
  if (profile.product_scope === "SINGLE_PRODUCT" && profile.product_refs.length === 0) {
    return invalid(["PRODUCT_INVENTORY.PRODUCT_REF_REQUIRED"], ["product_inventory.product_refs"]);
  }
  if (profile.product_inventory_motion === "STOCKOUT_PREVENTION" && !profile.replenishment_context_ref) {
    return invalid(["PRODUCT_INVENTORY.REPLENISHMENT_CONTEXT_REQUIRED"], ["product_inventory.replenishment_context_ref"]);
  }
  return { valid: true, profile, reason_codes: [], unresolved_fields: [] };
}
