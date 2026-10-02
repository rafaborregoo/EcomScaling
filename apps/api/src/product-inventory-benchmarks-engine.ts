import { validateProductInventoryBenchmarksPlaybookTemplate, type PlaybookFrameworkInputLike, type PlaybookTemplate, type PlaybookTriState } from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { buildPlaybookContext, parseActivePlaybookTemplates, runPlaybookFrameworkEngine, runPlaybookFrameworkEngineForAllOrganizations } from "./playbook-engine.js";
import { gateShopifyNetMetricsObservation, shopifyNetMetricsQualityFacts } from "./shopify-net-metrics-coverage.js";

const SOURCE = "f6-p10.v2";
const UNKNOWN: PlaybookTriState = "UNKNOWN";
const present = (value: unknown) => value !== null && value !== undefined;
function observed(available: boolean | null | undefined, value: unknown): PlaybookTriState { return available === true && present(value) ? "TRUE" : available === false ? "FALSE" : UNKNOWN; }

export type ProductInventoryBenchmarksEvidence = {
  catalog?: { available?: boolean; products_count?: number | null; variants_count?: number | null } | null;
  stock?: { available?: boolean; tracked_items?: number | null; total_available?: number | null; low_stock_items?: number | null; out_of_stock_items?: number | null } | null;
  sales?: { available?: boolean; orders_count?: number | null; units_sold?: number | null } | null;
  margin?: { available?: boolean; items_with_cost?: number | null; lines_with_exact_metrics?: number | null; lines_with_estimated_metrics?: number | null; lines_without_metrics?: number | null } | null;
  history?: { available?: boolean; days?: number | null } | null;
  lead_time?: { available?: boolean; days?: number | null } | null;
  aging?: { available?: boolean; aged_items?: number | null } | null;
};

function baseFacts(): Record<string, PlaybookTriState> { return {
  "inventory_benchmarks.catalog.observed": UNKNOWN, "inventory_benchmarks.stock.observed": UNKNOWN, "inventory_benchmarks.available_to_sell.observed": UNKNOWN,
  "inventory_benchmarks.demand.observed": UNKNOWN, "inventory_benchmarks.velocity.observed": UNKNOWN, "inventory_benchmarks.coverage.observed": UNKNOWN,
  "inventory_benchmarks.stockout.observed": UNKNOWN, "inventory_benchmarks.replenishment.observed": UNKNOWN, "inventory_benchmarks.lead_time.observed": UNKNOWN,
  "inventory_benchmarks.aging.observed": UNKNOWN, "inventory_benchmarks.sell_through.observed": UNKNOWN, "inventory_benchmarks.forecast.observed": UNKNOWN,
  "inventory_benchmarks.supplier.observed": UNKNOWN, "inventory_benchmarks.economics.observed": UNKNOWN, "inventory_benchmarks.accuracy.observed": UNKNOWN,
  "inventory_benchmarks.assortment.observed": UNKNOWN, "inventory_benchmarks.history.observed": UNKNOWN, "inventory_benchmarks.confidence.observed": UNKNOWN,
  "inventory_benchmarks.scope_of_claim.observed": UNKNOWN,
}; }

export function buildProductInventoryBenchmarksPlaybookContext(organizationId: string, diagnostics: Parameters<typeof buildPlaybookContext>[1], latestDecision: Parameters<typeof buildPlaybookContext>[2], now?: string): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return { ...base, context_id: base.context_id.replace("playbook-context", "product-inventory-benchmarks-context"), decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f6-p10"), source_versions: [...(base.source_versions ?? []), SOURCE], facts: { ...base.facts, ...baseFacts() } };
}

export function applyProductInventoryBenchmarksEvidence(context: PlaybookFrameworkInputLike["context"], evidence: ProductInventoryBenchmarksEvidence, sourceRefs: string[] = []): PlaybookFrameworkInputLike["context"] {
  const catalog = evidence.catalog; const stock = evidence.stock; const sales = evidence.sales; const margin = evidence.margin;
  const anyEvidence = Object.values(evidence).some(Boolean);
  const facts: Record<string, PlaybookTriState> = { ...context.facts, ...baseFacts(), ...shopifyNetMetricsQualityFacts(margin),
    "inventory_benchmarks.catalog.observed": observed(catalog?.available, catalog?.products_count),
    "inventory_benchmarks.stock.observed": observed(stock?.available, stock?.tracked_items),
    "inventory_benchmarks.available_to_sell.observed": observed(stock?.available, stock?.total_available),
    "inventory_benchmarks.demand.observed": observed(sales?.available, sales?.orders_count),
    "inventory_benchmarks.velocity.observed": observed(sales?.available, sales?.units_sold),
    // Coverage needs a demand rate and a comparable stock window, not just a snapshot.
    "inventory_benchmarks.coverage.observed": UNKNOWN,
    "inventory_benchmarks.stockout.observed": observed(stock?.available, stock?.out_of_stock_items),
    "inventory_benchmarks.replenishment.observed": UNKNOWN,
    "inventory_benchmarks.lead_time.observed": observed(evidence.lead_time?.available, evidence.lead_time?.days),
    "inventory_benchmarks.aging.observed": observed(evidence.aging?.available, evidence.aging?.aged_items),
    "inventory_benchmarks.sell_through.observed": UNKNOWN,
    "inventory_benchmarks.forecast.observed": UNKNOWN,
    "inventory_benchmarks.supplier.observed": UNKNOWN,
    "inventory_benchmarks.economics.observed": gateShopifyNetMetricsObservation(margin, observed(margin?.available, margin?.items_with_cost)),
    "inventory_benchmarks.accuracy.observed": UNKNOWN,
    "inventory_benchmarks.assortment.observed": observed(catalog?.available, catalog?.variants_count),
    "inventory_benchmarks.history.observed": observed(evidence.history?.available, evidence.history?.days),
    "inventory_benchmarks.confidence.observed": UNKNOWN,
    "inventory_benchmarks.scope_of_claim.observed": anyEvidence ? "TRUE" : UNKNOWN,
  };
  return { ...context, evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])], facts };
}

async function enrich(supabase: any, context: PlaybookFrameworkInputLike["context"], organizationId: string) {
  const end = new Date(context.as_of); const start = new Date(end.getTime() - 90 * 86400000); const args = { target_organization_id: organizationId, period_start: start.toISOString(), period_end: end.toISOString(), target_store_id: null };
  const [products, variants, stock, sales, margin, history] = await Promise.all([
    supabase.from("shopify_products").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("shopify_variants").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.rpc("shopify_stock_summary", { target_organization_id: organizationId, low_stock_threshold: 5, target_store_id: null }),
    supabase.rpc("shopify_sales_summary", args),
    supabase.rpc("shopify_margin_summary", args),
    supabase.rpc("shopify_sales_daily", args),
  ]);
  const first = (result: any) => Array.isArray(result?.data) ? result.data[0] ?? null : null; const day = context.as_of.slice(0, 10);
  return applyProductInventoryBenchmarksEvidence(context, {
    catalog: products.error || variants.error ? { available: false } : { available: true, products_count: products.count, variants_count: variants.count },
    stock: stock.error ? { available: false } : { available: true, ...first(stock) }, sales: sales.error ? { available: false } : { available: true, ...first(sales) }, margin: margin.error ? { available: false } : { available: true, ...first(margin) }, history: history.error ? { available: false } : { available: true, days: Array.isArray(history.data) ? history.data.length : null },
  }, [!products.error && !variants.error ? `shopify_catalog:${organizationId}:${day}` : "", !stock.error ? `shopify_stock_summary:${organizationId}:${day}` : "", !sales.error ? `shopify_sales_summary:${organizationId}:${day}` : "", !margin.error ? `shopify_margin_summary:${organizationId}:${day}` : "", !history.error ? `shopify_sales_daily:${organizationId}:${day}` : ""].filter(Boolean));
}

function filter(template: PlaybookTemplate) { return template.domain === "PRODUCT_INVENTORY_BENCHMARKS" && validateProductInventoryBenchmarksPlaybookTemplate(template).valid; }
const options = { domain: "PRODUCT_INVENTORY_BENCHMARKS", contextBuilder: buildProductInventoryBenchmarksPlaybookContext, contextEnricher: enrich, templateFilter: filter };
export function runProductInventoryBenchmarksPlaybookEngine(env: LoadedApiEnv, organizationId: string) { return runPlaybookFrameworkEngine(env, organizationId, options); }
export function runProductInventoryBenchmarksPlaybookEngineForAllOrganizations(env: LoadedApiEnv) { return runPlaybookFrameworkEngineForAllOrganizations(env, options); }
export { parseActivePlaybookTemplates };
