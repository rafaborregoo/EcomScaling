import {
  validateOfferPricingPlaybookTemplate,
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

const OFFER_PRICING_SOURCE_VERSION = "f5-p04.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type OfferPricingEvidence = {
  sales?: { orders_count?: number | null; discounts?: number | null } | null;
  margin?: { items_with_cost?: number | null } | null;
  stock?: { tracked_items?: number | null } | null;
  top_products_count?: number | null;
};

export function buildOfferPricingPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "offer-pricing-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p04"),
    source_versions: [...(base.source_versions ?? []), OFFER_PRICING_SOURCE_VERSION],
    facts: {
      ...base.facts,
      "offer_pricing.economics.aov.available": UNKNOWN,
      "offer_pricing.economics.margin.available": UNKNOWN,
      "offer_pricing.economics.discounts.available": UNKNOWN,
      "offer_pricing.catalog.available": UNKNOWN,
      "offer_pricing.inventory.available": UNKNOWN,
      "offer_pricing.pricing.elasticity.observed": UNKNOWN,
      "offer_pricing.promotions.incrementality.supported": UNKNOWN,
      "offer_pricing.customer_quality.available": UNKNOWN,
    },
  };
}

/** Traduce disponibilidad, no rendimiento: no hay thresholds ni elasticidad inventada. */
export function applyOfferPricingEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: OfferPricingEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const sales = evidence.sales;
  const margin = evidence.margin;
  const stock = evidence.stock;
  const facts = {
    ...context.facts,
    "offer_pricing.economics.aov.available": Number(sales?.orders_count) > 0 ? "TRUE" : UNKNOWN,
    "offer_pricing.economics.discounts.available": sales ? "TRUE" : UNKNOWN,
    "offer_pricing.economics.margin.available": Number(margin?.items_with_cost) > 0 ? "TRUE" : UNKNOWN,
    "offer_pricing.catalog.available": Number(evidence.top_products_count) > 0 ? "TRUE" : UNKNOWN,
    "offer_pricing.inventory.available": Number(stock?.tracked_items) > 0 ? "TRUE" : UNKNOWN,
  } satisfies Record<string, PlaybookTriState>;
  return {
    ...context,
    evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])],
    facts,
  };
}

async function enrichOfferPricingContext(
  supabase: any,
  context: PlaybookFrameworkInputLike["context"],
  organizationId: string,
) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const rpcArgs = {
    target_organization_id: organizationId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    target_store_id: null,
  };
  const [salesResult, marginResult, stockResult, productsResult] = await Promise.all([
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase.rpc("shopify_margin_summary", rpcArgs),
    supabase.rpc("shopify_stock_summary", {
      target_organization_id: organizationId,
      low_stock_threshold: 5,
      target_store_id: null,
    }),
    supabase.rpc("shopify_top_products", {
      ...rpcArgs,
      result_limit: 10,
    }),
  ]);
  const row = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  return applyOfferPricingEvidence(
    context,
    {
      sales: salesResult.error ? null : row(salesResult),
      margin: marginResult.error ? null : row(marginResult),
      stock: stockResult.error ? null : row(stockResult),
      top_products_count: productsResult.error || !Array.isArray(productsResult.data)
        ? null
        : productsResult.data.length,
    },
    [
      !salesResult.error ? `shopify_sales_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !marginResult.error ? `shopify_margin_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !stockResult.error ? `shopify_stock_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !productsResult.error ? `shopify_top_products:${organizationId}:${context.as_of.slice(0, 10)}` : "",
    ].filter(Boolean),
  );
}

function offerPricingTemplateFilter(template: PlaybookTemplate): boolean {
  return (
    template.domain === "OFFER_PRICING" &&
    validateOfferPricingPlaybookTemplate(template).valid
  );
}

const offerPricingOptions = {
  domain: "OFFER_PRICING",
  contextBuilder: buildOfferPricingPlaybookContext,
  contextEnricher: enrichOfferPricingContext,
  templateFilter: offerPricingTemplateFilter,
};

export async function runOfferPricingPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, offerPricingOptions);
}

export async function runOfferPricingPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, offerPricingOptions);
}

export { parseActivePlaybookTemplates };
