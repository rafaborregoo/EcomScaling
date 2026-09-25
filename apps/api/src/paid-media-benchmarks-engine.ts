import {
  validatePaidMediaBenchmarksPlaybookTemplate,
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

const PAID_MEDIA_BENCHMARKS_SOURCE_VERSION = "f6-p04.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type PaidMediaBenchmarksEvidence = {
  media?: { available: boolean; spend?: number | null; impressions?: number | null; clicks?: number | null; days?: number | null } | null;
  ecommerce?: { available: boolean; sessions?: number | null; orders_count?: number | null; revenue?: number | null; conversion_rate?: number | null } | null;
  economics?: { available: boolean; contribution?: number | null; gross_margin?: number | null; net_profit?: number | null; returns?: number | null } | null;
  attribution?: { available: boolean; attributed_revenue?: number | null; purchases?: number | null; roas?: number | null; days?: number | null } | null;
  adsSpend?: { available: boolean; spend?: number | null; days?: number | null } | null;
  customerMix?: { available: boolean; new_customer_share?: number | null; returning_share?: number | null; branded_share?: number | null; retargeting_share?: number | null } | null;
  incrementality?: { available: boolean; evidence_kind?: string | null } | null;
  scale?: { available: boolean; spend_delta?: number | null; customer_delta?: number | null; marginal_cac?: number | null; marginal_roas?: number | null; marginal_contribution?: number | null; reach_growth?: number | null } | null;
  saturation?: { available: boolean; frequency?: number | null; reach_growth?: number | null } | null;
  creative?: { available: boolean; creative_count?: number | null; fatigue_signals?: number | null } | null;
  guardrails?: { available: boolean; contribution?: number | null; cash?: number | null; payback?: number | null; inventory?: number | null; operations?: number | null } | null;
  measurement?: { available: boolean; days?: number | null } | null;
};

function observed(available: boolean | null | undefined, valuePresent = available): PlaybookTriState {
  return available === true && valuePresent === true ? "TRUE" : available === false ? "FALSE" : UNKNOWN;
}

function paidMediaFacts(): Record<string, PlaybookTriState> {
  return {
    "paid_media.objective.observed": UNKNOWN,
    "paid_media.delivery.observed": UNKNOWN,
    "paid_media.response.observed": UNKNOWN,
    "paid_media.traffic.observed": UNKNOWN,
    "paid_media.post_click.observed": UNKNOWN,
    "paid_media.acquisition.observed": UNKNOWN,
    "paid_media.revenue.observed": UNKNOWN,
    "paid_media.economics.observed": UNKNOWN,
    "paid_media.incrementality.observed": UNKNOWN,
    "paid_media.attribution.observed": UNKNOWN,
    "paid_media.scale.observed": UNKNOWN,
    "paid_media.saturation.observed": UNKNOWN,
    "paid_media.creative_fatigue.observed": UNKNOWN,
    "paid_media.customer_mix.observed": UNKNOWN,
    "paid_media.guardrails.observed": UNKNOWN,
    "paid_media.benchmark_context.observed": UNKNOWN,
    "paid_media.sample.observed": UNKNOWN,
    "paid_media.history.observed": UNKNOWN,
    "paid_media.confidence.observed": UNKNOWN,
    "paid_media.primary_deterioration.observed": UNKNOWN,
    "paid_media.scope_of_claim.observed": UNKNOWN,
  };
}

export function buildPaidMediaBenchmarksPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "paid-media-benchmarks-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f6-p04"),
    source_versions: [...(base.source_versions ?? []), PAID_MEDIA_BENCHMARKS_SOURCE_VERSION],
    facts: { ...base.facts, ...paidMediaFacts() },
  };
}

export function applyPaidMediaBenchmarksEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: PaidMediaBenchmarksEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const media = evidence.media;
  const ecommerce = evidence.ecommerce;
  const economics = evidence.economics;
  const attribution = evidence.attribution;
  const hasAnyEvidence = [media, ecommerce, economics, attribution, evidence.adsSpend, evidence.measurement].some(Boolean);
  const facts: Record<string, PlaybookTriState> = {
    ...context.facts,
    ...paidMediaFacts(),
    "paid_media.objective.observed": UNKNOWN,
    "paid_media.delivery.observed": observed(media?.available, media?.spend !== null && media?.spend !== undefined),
    "paid_media.response.observed": observed(media?.available, media?.impressions !== null && media?.impressions !== undefined && media?.clicks !== null && media?.clicks !== undefined),
    "paid_media.traffic.observed": observed(ecommerce?.available, ecommerce?.sessions !== null && ecommerce?.sessions !== undefined),
    "paid_media.post_click.observed": observed(ecommerce?.available, ecommerce?.orders_count !== null && ecommerce?.orders_count !== undefined),
    "paid_media.acquisition.observed": observed(attribution?.available, attribution?.purchases !== null && attribution?.purchases !== undefined),
    "paid_media.revenue.observed": observed(ecommerce?.available, ecommerce?.revenue !== null && ecommerce?.revenue !== undefined),
    "paid_media.economics.observed": observed(economics?.available, economics?.contribution !== null && economics?.contribution !== undefined),
    "paid_media.incrementality.observed": observed(evidence.incrementality?.available, Boolean(evidence.incrementality?.evidence_kind)),
    "paid_media.attribution.observed": observed(attribution?.available, attribution?.roas !== null && attribution?.roas !== undefined),
    "paid_media.scale.observed": observed(evidence.scale?.available, evidence.scale?.marginal_cac !== null && evidence.scale?.marginal_cac !== undefined),
    "paid_media.saturation.observed": observed(evidence.saturation?.available, evidence.saturation?.frequency !== null && evidence.saturation?.frequency !== undefined),
    "paid_media.creative_fatigue.observed": observed(evidence.creative?.available, evidence.creative?.fatigue_signals !== null && evidence.creative?.fatigue_signals !== undefined),
    "paid_media.customer_mix.observed": observed(evidence.customerMix?.available, evidence.customerMix?.new_customer_share !== null && evidence.customerMix?.new_customer_share !== undefined),
    "paid_media.guardrails.observed": observed(evidence.guardrails?.available, evidence.guardrails?.contribution !== null && evidence.guardrails?.contribution !== undefined),
    "paid_media.benchmark_context.observed": UNKNOWN,
    "paid_media.sample.observed": observed(evidence.measurement?.available ?? media?.available, evidence.measurement?.days !== null && evidence.measurement?.days !== undefined || media?.days !== null && media?.days !== undefined),
    "paid_media.history.observed": observed(evidence.measurement?.available, evidence.measurement?.days !== null && evidence.measurement?.days !== undefined),
    "paid_media.confidence.observed": UNKNOWN,
    "paid_media.primary_deterioration.observed": UNKNOWN,
    "paid_media.scope_of_claim.observed": hasAnyEvidence ? "TRUE" : UNKNOWN,
  };
  return { ...context, evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])], facts };
}

function first(result: any): any | null {
  return Array.isArray(result?.data) ? result.data[0] ?? null : null;
}

function available(result: any): boolean {
  return !result?.error && first(result) !== null;
}

async function enrichPaidMediaBenchmarksContext(
  supabase: any,
  context: PlaybookFrameworkInputLike["context"],
  organizationId: string,
) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const dateStart = periodStart.toISOString().slice(0, 10);
  const dateEnd = periodEnd.toISOString().slice(0, 10);
  const timestampArgs = {
    target_organization_id: organizationId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    target_store_id: null,
  };
  const dateArgs = {
    target_organization_id: organizationId,
    period_start: dateStart,
    period_end: dateEnd,
    target_store_id: null,
  };
  const [metaResult, adsResult, salesResult, funnelResult, marginResult, financialResult, stockResult, attributionResult, pixelResult, learningResult, creativeResult, dailyResult] = await Promise.all([
    supabase.rpc("meta_spend_summary", dateArgs),
    supabase.rpc("ads_spend_summary", timestampArgs),
    supabase.rpc("shopify_sales_summary", timestampArgs),
    supabase.rpc("shopify_funnel_summary", timestampArgs),
    supabase.rpc("shopify_margin_summary", timestampArgs),
    supabase.rpc("shopify_financial_summary", timestampArgs),
    supabase.rpc("shopify_stock_summary", { target_organization_id: organizationId, low_stock_threshold: 5, target_store_id: null }),
    supabase.rpc("shopify_attribution_by_channel", timestampArgs),
    supabase.rpc("meta_pixel_health", dateArgs),
    supabase.rpc("meta_learning_phase_status", dateArgs),
    supabase.rpc("meta_creative_performance", { ...dateArgs, min_impressions: 1000 }),
    supabase.rpc("shopify_sales_daily", timestampArgs),
  ]);
  const meta = first(metaResult);
  const sales = first(salesResult);
  const funnel = first(funnelResult);
  const margin = first(marginResult);
  const financial = first(financialResult);
  const ads = first(adsResult);
  const day = context.as_of.slice(0, 10);
  const source = (name: string, result: any) => !result?.error && first(result) !== null ? `${name}:${organizationId}:${day}` : "";
  return applyPaidMediaBenchmarksEvidence(context, {
    media: available(metaResult) ? { available: true, spend: meta?.spend, impressions: meta?.impressions, clicks: meta?.clicks, days: meta?.days_with_data } : { available: false },
    adsSpend: available(adsResult) ? { available: true, spend: ads?.spend, days: ads?.days_with_data } : { available: false },
    ecommerce: available(salesResult) || available(funnelResult) ? { available: true, sessions: funnel?.sessions, orders_count: sales?.orders_count, revenue: sales?.net_sales, conversion_rate: funnel?.conversion_rate_shopify } : { available: false },
    economics: available(marginResult) || available(financialResult) ? { available: true, contribution: financial?.contribution_per_order, gross_margin: margin?.gross_margin, net_profit: financial?.net_profit } : { available: false },
    attribution: available(metaResult) ? { available: true, attributed_revenue: meta?.purchase_value, purchases: meta?.purchases, roas: meta?.roas, days: meta?.days_with_data } : { available: false },
    customerMix: { available: false },
    incrementality: { available: false },
    scale: { available: false },
    saturation: { available: false },
    creative: available(creativeResult) ? { available: true, creative_count: Array.isArray(creativeResult.data) ? creativeResult.data.length : null } : { available: false },
    guardrails: { available: false },
    measurement: dailyResult?.error ? { available: false } : { available: true, days: Array.isArray(dailyResult.data) ? dailyResult.data.length : null },
  }, [
    source("meta_spend_summary", metaResult),
    source("ads_spend_summary", adsResult),
    source("shopify_sales_summary", salesResult),
    source("shopify_funnel_summary", funnelResult),
    source("shopify_margin_summary", marginResult),
    source("shopify_financial_summary", financialResult),
    source("shopify_stock_summary", stockResult),
    source("shopify_attribution_by_channel", attributionResult),
    source("meta_pixel_health", pixelResult),
    source("meta_learning_phase_status", learningResult),
    source("meta_creative_performance", creativeResult),
    source("shopify_sales_daily", dailyResult),
  ].filter(Boolean));
}

function paidMediaBenchmarksTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "PAID_MEDIA_BENCHMARKS" && validatePaidMediaBenchmarksPlaybookTemplate(template).valid;
}

const paidMediaBenchmarksOptions = {
  domain: "PAID_MEDIA_BENCHMARKS",
  contextBuilder: buildPaidMediaBenchmarksPlaybookContext,
  contextEnricher: enrichPaidMediaBenchmarksContext,
  templateFilter: paidMediaBenchmarksTemplateFilter,
};

export function runPaidMediaBenchmarksPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, paidMediaBenchmarksOptions);
}

export function runPaidMediaBenchmarksPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, paidMediaBenchmarksOptions);
}

export { parseActivePlaybookTemplates };
