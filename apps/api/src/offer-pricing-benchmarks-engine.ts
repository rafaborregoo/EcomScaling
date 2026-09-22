import { validateOfferPricingBenchmarksPlaybookTemplate, type PlaybookFrameworkInputLike, type PlaybookTemplate, type PlaybookTriState } from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { buildPlaybookContext, parseActivePlaybookTemplates, runPlaybookFrameworkEngine, runPlaybookFrameworkEngineForAllOrganizations } from "./playbook-engine.js";

const SOURCE_VERSION = "f6-p06.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type OfferPricingBenchmarksEvidence = {
  sales?: { available: boolean; orders_count?: number | null; revenue?: number | null; units_sold?: number | null } | null;
  margin?: { available: boolean; items_with_cost?: number | null; margin?: number | null; contribution?: number | null } | null;
  funnel?: { available: boolean; sessions?: number | null; conversion_rate?: number | null } | null;
  products?: { available: boolean; product_count?: number | null; top_products_count?: number | null } | null;
  promotions?: { available: boolean; discount_codes?: number | null } | null;
  returns?: { available: boolean; return_rate?: number | null } | null;
  stock?: { available: boolean; tracked_items?: number | null } | null;
  history?: { available: boolean; days?: number | null } | null;
};

function present(value: unknown) { return value !== null && value !== undefined; }
function observed(available: boolean | null | undefined, valuePresent: boolean): PlaybookTriState { return available === true && valuePresent ? "TRUE" : available === false ? "FALSE" : UNKNOWN; }

function facts(): Record<string, PlaybookTriState> {
  return {
    "offer_pricing_benchmarks.offer_context.observed": UNKNOWN,
    "offer_pricing_benchmarks.pricing.observed": UNKNOWN,
    "offer_pricing_benchmarks.aov.observed": UNKNOWN,
    "offer_pricing_benchmarks.upt.observed": UNKNOWN,
    "offer_pricing_benchmarks.asp.observed": UNKNOWN,
    "offer_pricing_benchmarks.funnel.observed": UNKNOWN,
    "offer_pricing_benchmarks.economics.observed": UNKNOWN,
    "offer_pricing_benchmarks.contribution_per_order.observed": UNKNOWN,
    "offer_pricing_benchmarks.contribution_per_session.observed": UNKNOWN,
    "offer_pricing_benchmarks.product_mix.observed": UNKNOWN,
    "offer_pricing_benchmarks.promotions.observed": UNKNOWN,
    "offer_pricing_benchmarks.returns.observed": UNKNOWN,
    "offer_pricing_benchmarks.inventory.observed": UNKNOWN,
    "offer_pricing_benchmarks.merchandising.observed": UNKNOWN,
    "offer_pricing_benchmarks.customer_quality.observed": UNKNOWN,
    "offer_pricing_benchmarks.incrementality.observed": UNKNOWN,
    "offer_pricing_benchmarks.pricing_elasticity.observed": UNKNOWN,
    "offer_pricing_benchmarks.benchmark.observed": UNKNOWN,
    "offer_pricing_benchmarks.guardrails.observed": UNKNOWN,
    "offer_pricing_benchmarks.history.observed": UNKNOWN,
    "offer_pricing_benchmarks.confidence.observed": UNKNOWN,
    "offer_pricing_benchmarks.scope_of_claim.observed": UNKNOWN,
  };
}

export function buildOfferPricingBenchmarksPlaybookContext(organizationId: string, diagnostics: Parameters<typeof buildPlaybookContext>[1], latestDecision: Parameters<typeof buildPlaybookContext>[2], now?: string): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return { ...base, context_id: base.context_id.replace("playbook-context", "offer-pricing-benchmarks-context"), decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f6-p06"), source_versions: [...(base.source_versions ?? []), SOURCE_VERSION], facts: { ...base.facts, ...facts() } };
}

export function applyOfferPricingBenchmarksEvidence(context: PlaybookFrameworkInputLike["context"], evidence: OfferPricingBenchmarksEvidence, sourceRefs: string[] = []): PlaybookFrameworkInputLike["context"] {
  const sales = evidence.sales;
  const margin = evidence.margin;
  const funnel = evidence.funnel;
  const hasAnyEvidence = Object.values(evidence).some(Boolean);
  const hasSales = Boolean(sales && [sales.orders_count, sales.revenue].some(present));
  const hasEconomics = Boolean(margin && [margin.margin, margin.contribution, margin.items_with_cost].some(present));
  const updated: Record<string, PlaybookTriState> = {
    ...context.facts, ...facts(),
    "offer_pricing_benchmarks.offer_context.observed": UNKNOWN,
    "offer_pricing_benchmarks.pricing.observed": UNKNOWN,
    "offer_pricing_benchmarks.aov.observed": observed(sales?.available, Boolean(sales && present(sales.orders_count) && present(sales.revenue))),
    "offer_pricing_benchmarks.upt.observed": observed(sales?.available, Boolean(sales && present(sales.units_sold) && Number(sales.orders_count) > 0)),
    "offer_pricing_benchmarks.asp.observed": UNKNOWN,
    "offer_pricing_benchmarks.funnel.observed": observed(funnel?.available, Boolean(funnel && [funnel.sessions, funnel.conversion_rate].some(present))),
    "offer_pricing_benchmarks.economics.observed": observed(margin?.available, hasEconomics),
    "offer_pricing_benchmarks.contribution_per_order.observed": observed(margin?.available, Boolean(margin && present(margin.contribution) && Number(sales?.orders_count) > 0)),
    "offer_pricing_benchmarks.contribution_per_session.observed": observed(margin?.available, Boolean(margin && present(margin.contribution) && Number(funnel?.sessions) > 0)),
    "offer_pricing_benchmarks.product_mix.observed": observed(evidence.products?.available, Boolean(evidence.products && present(evidence.products.top_products_count))),
    "offer_pricing_benchmarks.promotions.observed": observed(evidence.promotions?.available, present(evidence.promotions?.discount_codes)),
    "offer_pricing_benchmarks.returns.observed": observed(evidence.returns?.available, present(evidence.returns?.return_rate)),
    "offer_pricing_benchmarks.inventory.observed": observed(evidence.stock?.available, present(evidence.stock?.tracked_items)),
    "offer_pricing_benchmarks.merchandising.observed": observed(evidence.products?.available, Boolean(evidence.products && present(evidence.products.product_count))),
    "offer_pricing_benchmarks.customer_quality.observed": UNKNOWN,
    "offer_pricing_benchmarks.incrementality.observed": UNKNOWN,
    "offer_pricing_benchmarks.pricing_elasticity.observed": UNKNOWN,
    "offer_pricing_benchmarks.benchmark.observed": UNKNOWN,
    "offer_pricing_benchmarks.guardrails.observed": UNKNOWN,
    "offer_pricing_benchmarks.history.observed": observed(evidence.history?.available, present(evidence.history?.days)),
    "offer_pricing_benchmarks.confidence.observed": UNKNOWN,
    "offer_pricing_benchmarks.scope_of_claim.observed": hasAnyEvidence ? "TRUE" : UNKNOWN,
  };
  return { ...context, evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])], facts: updated };
}

function first(result: any) { return Array.isArray(result?.data) ? result.data[0] ?? null : null; }
function available(result: any) { return !result?.error && first(result) !== null; }

async function enrichOfferPricingBenchmarksContext(supabase: any, context: PlaybookFrameworkInputLike["context"], organizationId: string) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const args = { target_organization_id: organizationId, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), target_store_id: null };
  const [salesResult, marginResult, funnelResult, productsResult, discountResult, returnsResult, stockResult, dailyResult] = await Promise.all([
    supabase.rpc("shopify_sales_summary", args),
    supabase.rpc("shopify_margin_summary", args),
    supabase.rpc("shopify_funnel_summary", args),
    supabase.rpc("shopify_top_products", { ...args, result_limit: 20 }),
    supabase.rpc("shopify_discount_cost_by_code", { ...args, result_limit: 20 }),
    supabase.rpc("shopify_return_rate_by_product", { ...args, result_limit: 20 }),
    supabase.rpc("shopify_stock_summary", { target_organization_id: organizationId, low_stock_threshold: 5, target_store_id: null }),
    supabase.rpc("shopify_sales_daily", args),
  ]);
  const sales = first(salesResult); const margin = first(marginResult); const funnel = first(funnelResult); const day = context.as_of.slice(0, 10);
  const source = (name: string, result: any, requireRow = true) => !result?.error && (!requireRow || first(result) !== null) ? `${name}:${organizationId}:${day}` : "";
  return applyOfferPricingBenchmarksEvidence(context, {
    sales: available(salesResult) ? { available: true, orders_count: sales?.orders_count, revenue: sales?.net_sales, units_sold: sales?.units_sold } : { available: false },
    margin: available(marginResult) ? { available: true, items_with_cost: margin?.items_with_cost, margin: margin?.gross_margin, contribution: null, /* shopify_margin_summary NO devuelve contribution: leerla era undefined silencioso. La real es shopify_financial_summary.contribution_per_order, que este motor no pide */ } : { available: false },
    funnel: available(funnelResult) ? { available: true, sessions: funnel?.sessions, conversion_rate: funnel?.conversion_rate_shopify } : { available: false },
    products: !productsResult?.error && Array.isArray(productsResult?.data) && productsResult.data.length > 0 ? { available: true, product_count: productsResult.data.length, top_products_count: productsResult.data.length } : { available: false },
    promotions: !discountResult?.error && Array.isArray(discountResult?.data) && discountResult.data.length > 0 ? { available: true, discount_codes: discountResult.data.length } : { available: false },
    returns: !returnsResult?.error && Array.isArray(returnsResult?.data) && returnsResult.data.length > 0 ? { available: true, return_rate: returnsResult.data[0]?.return_rate } : { available: false },
    stock: available(stockResult) ? { available: true, tracked_items: first(stockResult)?.tracked_items } : { available: false },
    history: dailyResult?.error ? { available: false } : { available: true, days: Array.isArray(dailyResult.data) ? dailyResult.data.length : null },
  }, [source("shopify_sales_summary", salesResult), source("shopify_margin_summary", marginResult), source("shopify_funnel_summary", funnelResult), source("shopify_top_products", productsResult), source("shopify_discount_cost_by_code", discountResult), source("shopify_return_rate_by_product", returnsResult), source("shopify_stock_summary", stockResult), source("shopify_sales_daily", dailyResult, false)].filter(Boolean));
}

function offerPricingBenchmarksTemplateFilter(template: PlaybookTemplate) { return template.domain === "OFFER_PRICING_BENCHMARKS" && validateOfferPricingBenchmarksPlaybookTemplate(template).valid; }
const options = { domain: "OFFER_PRICING_BENCHMARKS", contextBuilder: buildOfferPricingBenchmarksPlaybookContext, contextEnricher: enrichOfferPricingBenchmarksContext, templateFilter: offerPricingBenchmarksTemplateFilter };
export function runOfferPricingBenchmarksPlaybookEngine(env: LoadedApiEnv, organizationId: string) { return runPlaybookFrameworkEngine(env, organizationId, options); }
export function runOfferPricingBenchmarksPlaybookEngineForAllOrganizations(env: LoadedApiEnv) { return runPlaybookFrameworkEngineForAllOrganizations(env, options); }
export { parseActivePlaybookTemplates };
