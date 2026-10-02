import {
  validateProductInventoryPlaybookTemplate,
  type PlaybookFrameworkInputLike,
  type PlaybookTemplate,
  type PlaybookTriState,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import {
  buildPlaybookContext,
  parseActivePlaybookTemplates,
  runPlaybookFrameworkEngine,
  runPlaybookFrameworkEngineForAllOrganizations,
} from "./playbook-engine.js";
import { gateShopifyNetMetricsObservation, shopifyNetMetricsQualityFacts } from "./shopify-net-metrics-coverage.js";

const PRODUCT_INVENTORY_SOURCE_VERSION = "f5-p07.v2";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type ProductInventoryEvidence = {
  catalog?: { products_count?: number | null; variants_count?: number | null } | null;
  stock?: { tracked_items?: number | null; total_available?: number | null; low_stock_items?: number | null; out_of_stock_items?: number | null } | null;
  sales?: { orders_count?: number | null; units_sold?: number | null } | null;
  margin?: { items_with_cost?: number | null; lines_with_exact_metrics?: number | null; lines_with_estimated_metrics?: number | null; lines_without_metrics?: number | null } | null;
};

function observed(value: number | null | undefined): PlaybookTriState {
  return value === null || value === undefined ? UNKNOWN : value > 0 ? "TRUE" : "FALSE";
}

export function buildProductInventoryPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "product-inventory-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p07"),
    source_versions: [...(base.source_versions ?? []), PRODUCT_INVENTORY_SOURCE_VERSION],
    facts: {
      ...base.facts,
      "product_inventory.catalog.available": UNKNOWN,
      "product_inventory.catalog.assortment_observed": UNKNOWN,
      "product_inventory.catalog.roles_observed": UNKNOWN,
      "product_inventory.variants.available": UNKNOWN,
      "product_inventory.inventory.snapshot_available": UNKNOWN,
      "product_inventory.inventory.total_available_observed": UNKNOWN,
      "product_inventory.stock.low_observed": UNKNOWN,
      "product_inventory.stockout.observed": UNKNOWN,
      "product_inventory.overstock.observed": UNKNOWN,
      "product_inventory.demand.observed": UNKNOWN,
      "product_inventory.demand.velocity_observed": UNKNOWN,
      "product_inventory.demand_supply.alignment": UNKNOWN,
      "product_inventory.replenishment.observed": UNKNOWN,
      "product_inventory.forecast.observed": UNKNOWN,
      "product_inventory.supplier.observed": UNKNOWN,
      "product_inventory.quality.observed": UNKNOWN,
      "product_inventory.inventory_accuracy.observed": UNKNOWN,
      "product_inventory.sku_rationalization.observed": UNKNOWN,
      "product_inventory.economics.available": UNKNOWN,
      "product_inventory.learning.observed": UNKNOWN,
    },
  };
}

/** Declara cobertura de catálogo, stock y demanda; no decide compras ni delistings. */
export function applyProductInventoryEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: ProductInventoryEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const catalog = evidence.catalog;
  const stock = evidence.stock;
  const sales = evidence.sales;
  const margin = evidence.margin;
  const facts = {
    ...context.facts,
    ...shopifyNetMetricsQualityFacts(margin),
    "product_inventory.catalog.available": observed(catalog?.products_count),
    "product_inventory.catalog.assortment_observed": observed(catalog?.products_count),
    "product_inventory.catalog.roles_observed": UNKNOWN,
    "product_inventory.variants.available": observed(catalog?.variants_count),
    "product_inventory.inventory.snapshot_available": observed(stock?.tracked_items),
    "product_inventory.inventory.total_available_observed": stock ? "TRUE" : UNKNOWN,
    "product_inventory.stock.low_observed": observed(stock?.low_stock_items),
    "product_inventory.stockout.observed": observed(stock?.out_of_stock_items),
    // A stock snapshot cannot prove overstock: demand, age and policy are needed.
    "product_inventory.overstock.observed": UNKNOWN,
    "product_inventory.demand.observed": observed(sales?.orders_count),
    "product_inventory.demand.velocity_observed": observed(sales?.units_sold),
    "product_inventory.demand_supply.alignment": UNKNOWN,
    "product_inventory.replenishment.observed": UNKNOWN,
    "product_inventory.forecast.observed": UNKNOWN,
    "product_inventory.supplier.observed": UNKNOWN,
    "product_inventory.quality.observed": UNKNOWN,
    "product_inventory.inventory_accuracy.observed": UNKNOWN,
    "product_inventory.sku_rationalization.observed": UNKNOWN,
    "product_inventory.economics.available": gateShopifyNetMetricsObservation(margin, observed(margin?.items_with_cost)),
    "product_inventory.learning.observed": UNKNOWN,
  } satisfies Record<string, PlaybookTriState>;
  return {
    ...context,
    evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])],
    facts,
  };
}

async function enrichProductInventoryContext(
  supabase: any,
  context: PlaybookFrameworkInputLike["context"],
  organizationId: string,
) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rpcArgs = {
    target_organization_id: organizationId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    target_store_id: null,
  };
  const [productsResult, variantsResult, stockResult, salesResult, marginResult] = await Promise.all([
    supabase.from("shopify_products").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("shopify_variants").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.rpc("shopify_stock_summary", { target_organization_id: organizationId, low_stock_threshold: 5, target_store_id: null }),
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase.rpc("shopify_margin_summary", rpcArgs),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  return applyProductInventoryEvidence(
    context,
    {
      catalog: productsResult.error || variantsResult.error ? null : { products_count: productsResult.count, variants_count: variantsResult.count },
      stock: stockResult.error ? null : first(stockResult),
      sales: salesResult.error ? null : first(salesResult),
      margin: marginResult.error ? null : first(marginResult),
    },
    [
      !productsResult.error && !variantsResult.error ? `shopify_catalog:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !stockResult.error ? `shopify_stock_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !salesResult.error ? `shopify_sales_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !marginResult.error ? `shopify_margin_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
    ].filter(Boolean),
  );
}

function productInventoryTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "PRODUCT_INVENTORY" && validateProductInventoryPlaybookTemplate(template).valid;
}

const productInventoryOptions = {
  domain: "PRODUCT_INVENTORY",
  contextBuilder: buildProductInventoryPlaybookContext,
  contextEnricher: enrichProductInventoryContext,
  templateFilter: productInventoryTemplateFilter,
};

export function runProductInventoryPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, productInventoryOptions);
}

export function runProductInventoryPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, productInventoryOptions);
}

export { parseActivePlaybookTemplates };
