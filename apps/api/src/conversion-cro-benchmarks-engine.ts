import {
  validateConversionCroBenchmarksPlaybookTemplate,
  type PlaybookFrameworkInputLike,
  type PlaybookTemplate,
  type PlaybookTriState,
} from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import {
  buildPlaybookContext,
  parseActivePlaybookTemplates,
  runPlaybookFrameworkEngine,
  runPlaybookFrameworkEngineForAllOrganizations,
} from "./playbook-engine.js";

const CONVERSION_CRO_SOURCE_VERSION = "f6-p05.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type ConversionCroBenchmarksEvidence = {
  funnel?: { available: boolean; sessions?: number | null; product_views?: number | null; cart_additions?: number | null; checkouts_reached?: number | null; purchases?: number | null; conversion_rate?: number | null; funnel_data_since?: string | null } | null;
  sales?: { available: boolean; orders_count?: number | null; revenue?: number | null } | null;
  economics?: { available: boolean; aov?: number | null; margin?: number | null; contribution?: number | null; contribution_per_session?: number | null } | null;
  returns?: { available: boolean; return_rate?: number | null; refunded_amount?: number | null } | null;
  cancellations?: { available: boolean; cancellations?: number | null } | null;
  attribution?: { available: boolean; channels?: number | null; new_customers?: number | null } | null;
  history?: { available: boolean; days?: number | null } | null;
  mix?: { available: boolean; dimensions?: number | null } | null;
  technical?: { available: boolean; errors?: number | null; payment_authorization?: number | null } | null;
  offer?: { available: boolean; discounts?: number | null; promotions?: number | null } | null;
  inventory?: { available: boolean; tracked_items?: number | null } | null;
  operations?: { available: boolean; fulfillments?: number | null } | null;
  experiments?: { available: boolean; tests?: number | null; valid_tests?: number | null } | null;
  opportunity?: { available: boolean; affected_traffic?: number | null; recoverable_gap?: number | null; economic_value?: number | null } | null;
};

function present(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function observed(available: boolean | null | undefined, valuePresent: boolean): PlaybookTriState {
  return available === true && valuePresent ? "TRUE" : available === false ? "FALSE" : UNKNOWN;
}

function conversionCroFacts(): Record<string, PlaybookTriState> {
  return {
    "conversion_cro.definition.observed": UNKNOWN,
    "conversion_cro.funnel.observed": UNKNOWN,
    "conversion_cro.sessions.observed": UNKNOWN,
    "conversion_cro.product_views.observed": UNKNOWN,
    "conversion_cro.add_to_cart.observed": UNKNOWN,
    "conversion_cro.checkout.observed": UNKNOWN,
    "conversion_cro.purchase.observed": UNKNOWN,
    "conversion_cro.mix.observed": UNKNOWN,
    "conversion_cro.history.observed": UNKNOWN,
    "conversion_cro.benchmark.observed": UNKNOWN,
    "conversion_cro.economics.observed": UNKNOWN,
    "conversion_cro.aov.observed": UNKNOWN,
    "conversion_cro.contribution_per_session.observed": UNKNOWN,
    "conversion_cro.returns.observed": UNKNOWN,
    "conversion_cro.cancellations.observed": UNKNOWN,
    "conversion_cro.customer_quality.observed": UNKNOWN,
    "conversion_cro.technical.observed": UNKNOWN,
    "conversion_cro.offer.observed": UNKNOWN,
    "conversion_cro.inventory.observed": UNKNOWN,
    "conversion_cro.operations.observed": UNKNOWN,
    "conversion_cro.experiments.observed": UNKNOWN,
    "conversion_cro.opportunity.observed": UNKNOWN,
    "conversion_cro.guardrails.observed": UNKNOWN,
    "conversion_cro.confidence.observed": UNKNOWN,
    "conversion_cro.scope_of_claim.observed": UNKNOWN,
  };
}

export function buildConversionCroBenchmarksPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "conversion-cro-benchmarks-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f6-p05"),
    source_versions: [...(base.source_versions ?? []), CONVERSION_CRO_SOURCE_VERSION],
    facts: { ...base.facts, ...conversionCroFacts() },
  };
}

export function applyConversionCroBenchmarksEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: ConversionCroBenchmarksEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const funnel = evidence.funnel;
  const economics = evidence.economics;
  const hasAnyEvidence = Object.values(evidence).some(Boolean);
  const hasFunnelValue = Boolean(funnel && [funnel.sessions, funnel.cart_additions, funnel.checkouts_reached, funnel.purchases, funnel.conversion_rate].some(present));
  const facts: Record<string, PlaybookTriState> = {
    ...context.facts,
    ...conversionCroFacts(),
    "conversion_cro.definition.observed": observed(funnel?.available, hasFunnelValue),
    "conversion_cro.funnel.observed": observed(funnel?.available, hasFunnelValue),
    "conversion_cro.sessions.observed": observed(funnel?.available, present(funnel?.sessions)),
    "conversion_cro.product_views.observed": observed(funnel?.available, present(funnel?.product_views)),
    "conversion_cro.add_to_cart.observed": observed(funnel?.available, present(funnel?.cart_additions)),
    "conversion_cro.checkout.observed": observed(funnel?.available, present(funnel?.checkouts_reached)),
    "conversion_cro.purchase.observed": observed(funnel?.available, present(funnel?.purchases)),
    "conversion_cro.mix.observed": observed(evidence.mix?.available, present(evidence.mix?.dimensions)),
    "conversion_cro.history.observed": observed(evidence.history?.available, present(evidence.history?.days)),
    "conversion_cro.benchmark.observed": UNKNOWN,
    "conversion_cro.economics.observed": observed(economics?.available, Boolean(economics && [economics.aov, economics.margin, economics.contribution, economics.contribution_per_session].some(present))),
    "conversion_cro.aov.observed": observed(economics?.available, present(economics?.aov)),
    "conversion_cro.contribution_per_session.observed": observed(economics?.available, present(economics?.contribution_per_session)),
    "conversion_cro.returns.observed": observed(evidence.returns?.available, Boolean(evidence.returns && [evidence.returns.return_rate, evidence.returns.refunded_amount].some(present))),
    "conversion_cro.cancellations.observed": observed(evidence.cancellations?.available, present(evidence.cancellations?.cancellations)),
    "conversion_cro.customer_quality.observed": UNKNOWN,
    "conversion_cro.technical.observed": observed(evidence.technical?.available, Boolean(evidence.technical && [evidence.technical.errors, evidence.technical.payment_authorization].some(present))),
    "conversion_cro.offer.observed": observed(evidence.offer?.available, Boolean(evidence.offer && [evidence.offer.discounts, evidence.offer.promotions].some(present))),
    "conversion_cro.inventory.observed": observed(evidence.inventory?.available, present(evidence.inventory?.tracked_items)),
    "conversion_cro.operations.observed": observed(evidence.operations?.available, present(evidence.operations?.fulfillments)),
    "conversion_cro.experiments.observed": observed(evidence.experiments?.available, Boolean(evidence.experiments && [evidence.experiments.tests, evidence.experiments.valid_tests].some(present))),
    "conversion_cro.opportunity.observed": observed(evidence.opportunity?.available, Boolean(evidence.opportunity && [evidence.opportunity.affected_traffic, evidence.opportunity.recoverable_gap, evidence.opportunity.economic_value].some(present))),
    "conversion_cro.guardrails.observed": UNKNOWN,
    "conversion_cro.confidence.observed": UNKNOWN,
    "conversion_cro.scope_of_claim.observed": hasAnyEvidence ? "TRUE" : UNKNOWN,
  };
  return { ...context, evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])], facts };
}

function first(result: any): any | null {
  return Array.isArray(result?.data) ? result.data[0] ?? null : null;
}

function available(result: any): boolean {
  return !result?.error && first(result) !== null;
}

async function enrichConversionCroBenchmarksContext(
  supabase: any,
  context: PlaybookFrameworkInputLike["context"],
  organizationId: string,
) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const timestampArgs = { target_organization_id: organizationId, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), target_store_id: null };
  const [funnelResult, salesResult, marginResult, financialResult, checkoutResult, returnsResult, attributionResult, stockResult, deliveryResult, discountResult, dailyResult, viewsResult] = await Promise.all([
    supabase.rpc("shopify_funnel_summary", timestampArgs),
    supabase.rpc("shopify_sales_summary", timestampArgs),
    supabase.rpc("shopify_margin_summary", timestampArgs),
    supabase.rpc("shopify_financial_summary", timestampArgs),
    supabase.rpc("shopify_checkout_recovery", timestampArgs),
    supabase.rpc("shopify_return_rate_by_product", { ...timestampArgs, result_limit: 20 }),
    supabase.rpc("shopify_attribution_by_channel", timestampArgs),
    supabase.rpc("shopify_stock_summary", { target_organization_id: organizationId, low_stock_threshold: 5, target_store_id: null }),
    supabase.rpc("shopify_delivery_times", timestampArgs),
    supabase.rpc("shopify_discount_cost_by_code", { ...timestampArgs, result_limit: 20 }),
    supabase.rpc("shopify_sales_daily", timestampArgs),
    // Vistas de producto del pixel propio. Sin pixel activo (first_event_at
    // null) no hay dato: se queda null, no cero.
    supabase.rpc("shopify_product_views", timestampArgs),
  ]);
  const views = first(viewsResult);
  const productViews = views?.first_event_at ? views.product_views : null;
  const funnel = first(funnelResult);
  const sales = first(salesResult);
  const margin = first(marginResult);
  const financial = first(financialResult);
  const day = context.as_of.slice(0, 10);
  const source = (name: string, result: any, requireRow = true) => !result?.error && (!requireRow || first(result) !== null) ? `${name}:${organizationId}:${day}` : "";
  const aov = present(sales?.orders_count) && Number(sales.orders_count) > 0 && present(sales?.net_sales) ? Number(sales.net_sales) / Number(sales.orders_count) : null;
  return applyConversionCroBenchmarksEvidence(context, {
    funnel: available(funnelResult) ? { available: true, sessions: funnel?.sessions, product_views: productViews, cart_additions: funnel?.cart_additions, checkouts_reached: funnel?.checkouts_reached, purchases: funnel?.purchases, conversion_rate: funnel?.conversion_rate_shopify, funnel_data_since: funnel?.funnel_data_since } : { available: false },
    sales: available(salesResult) ? { available: true, orders_count: sales?.orders_count, revenue: sales?.net_sales } : { available: false },
    economics: available(marginResult) || available(financialResult) ? { available: true, aov, margin: margin?.gross_margin, contribution: financial?.contribution_per_order, contribution_per_session: present(financial?.contribution_per_order) && present(funnel?.sessions) && Number(funnel.sessions) > 0 ? Number(financial.contribution_per_order) / Number(funnel.sessions) : null } : { available: false },
    returns: !returnsResult?.error && Array.isArray(returnsResult?.data) && returnsResult.data.length > 0 ? { available: true, return_rate: returnsResult.data[0]?.return_rate, refunded_amount: returnsResult.data[0]?.refunded_amount } : { available: false },
    cancellations: { available: false },
    attribution: !attributionResult?.error && Array.isArray(attributionResult?.data) && attributionResult.data.length > 0 ? { available: true, channels: attributionResult.data.length, new_customers: attributionResult.data.reduce((sum: number, row: any) => sum + Number(row?.new_customers ?? 0), 0) } : { available: false },
    history: dailyResult?.error ? { available: false } : { available: true, days: Array.isArray(dailyResult.data) ? dailyResult.data.length : null },
    mix: { available: false },
    technical: { available: false },
    offer: !discountResult?.error && Array.isArray(discountResult?.data) && discountResult.data.length > 0 ? { available: true, discounts: discountResult.data.length } : { available: false },
    inventory: available(stockResult) ? { available: true, tracked_items: first(stockResult)?.tracked_items } : { available: false },
    operations: !deliveryResult?.error && Array.isArray(deliveryResult?.data) && deliveryResult.data.length > 0 ? { available: true, fulfillments: deliveryResult.data[0]?.fulfillments } : { available: false },
    experiments: { available: false },
    opportunity: { available: false },
  }, [
    source("shopify_funnel_summary", funnelResult), source("shopify_sales_summary", salesResult), source("shopify_margin_summary", marginResult),
    source("shopify_financial_summary", financialResult), source("shopify_checkout_recovery", checkoutResult), source("shopify_return_rate_by_product", returnsResult),
    source("shopify_attribution_by_channel", attributionResult), source("shopify_stock_summary", stockResult), source("shopify_delivery_times", deliveryResult),
    source("shopify_discount_cost_by_code", discountResult), source("shopify_sales_daily", dailyResult, false), productViews !== null ? source("shopify_product_views", viewsResult) : "",
  ].filter(Boolean));
}

function conversionCroTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "CONVERSION_CRO_BENCHMARKS" && validateConversionCroBenchmarksPlaybookTemplate(template).valid;
}

const conversionCroOptions = {
  domain: "CONVERSION_CRO_BENCHMARKS",
  contextBuilder: buildConversionCroBenchmarksPlaybookContext,
  contextEnricher: enrichConversionCroBenchmarksContext,
  templateFilter: conversionCroTemplateFilter,
};

export function runConversionCroBenchmarksPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, conversionCroOptions);
}

export function runConversionCroBenchmarksPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, conversionCroOptions);
}

export { parseActivePlaybookTemplates };
