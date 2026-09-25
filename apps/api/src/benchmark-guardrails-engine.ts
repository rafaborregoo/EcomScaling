import {
  validateBenchmarkGuardrailsPlaybookTemplate,
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

const BENCHMARK_SOURCE_VERSION = "f6-p00.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type BenchmarkGuardrailsEvidence = {
  sales?: { available: boolean; orders_count?: number | null; revenue?: number | null } | null;
  funnel?: { available: boolean; sessions?: number | null; conversion_rate?: number | null } | null;
  margin?: { available: boolean; items_with_cost?: number | null } | null;
  stock?: { available: boolean; tracked_items?: number | null } | null;
  delivery?: { available: boolean; fulfillments?: number | null } | null;
  measurement?: { available: boolean; days?: number | null } | null;
};

function observed(available: boolean | null | undefined, value: number | null | undefined): PlaybookTriState {
  return available === true && value !== null && value !== undefined ? "TRUE" : available === false ? "FALSE" : UNKNOWN;
}

export function buildBenchmarkGuardrailsPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  const facts: Record<string, PlaybookTriState> = {
    "benchmark.metric.definition.observed": UNKNOWN,
    "benchmark.metric.value.observed": UNKNOWN,
    "benchmark.metric.source.observed": UNKNOWN,
    "benchmark.period.observed": UNKNOWN,
    "benchmark.sample.observed": UNKNOWN,
    "benchmark.history.observed": UNKNOWN,
    "benchmark.context.observed": UNKNOWN,
    "benchmark.comparability.observed": UNKNOWN,
    "benchmark.reference.observed": UNKNOWN,
    "benchmark.economics.observed": UNKNOWN,
    "benchmark.guardrails.observed": UNKNOWN,
    "benchmark.segment_mix.observed": UNKNOWN,
    "benchmark.trend.observed": UNKNOWN,
    "benchmark.materiality.observed": UNKNOWN,
    "benchmark.confidence.observed": UNKNOWN,
    "benchmark.intervention_evaluation.observed": UNKNOWN,
  };
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "benchmark-guardrails-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f6-p00"),
    source_versions: [...(base.source_versions ?? []), BENCHMARK_SOURCE_VERSION],
    facts: { ...base.facts, ...facts },
  };
}

export function applyBenchmarkGuardrailsEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: BenchmarkGuardrailsEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const hasSource = Boolean(evidence.sales || evidence.funnel || evidence.margin || evidence.stock || evidence.delivery || evidence.measurement);
  const facts: Record<string, PlaybookTriState> = {
    ...context.facts,
    "benchmark.metric.definition.observed": UNKNOWN,
    "benchmark.metric.value.observed": observed(evidence.sales?.available, evidence.sales?.revenue ?? evidence.sales?.orders_count),
    "benchmark.metric.source.observed": hasSource ? "TRUE" : UNKNOWN,
    "benchmark.period.observed": hasSource ? "TRUE" : UNKNOWN,
    "benchmark.sample.observed": observed(evidence.sales?.available, evidence.sales?.orders_count ?? evidence.funnel?.sessions),
    "benchmark.history.observed": observed(evidence.measurement?.available, evidence.measurement?.days),
    "benchmark.context.observed": UNKNOWN,
    "benchmark.comparability.observed": UNKNOWN,
    "benchmark.reference.observed": UNKNOWN,
    "benchmark.economics.observed": observed(evidence.margin?.available, evidence.margin?.items_with_cost),
    "benchmark.guardrails.observed": UNKNOWN,
    "benchmark.segment_mix.observed": UNKNOWN,
    "benchmark.trend.observed": UNKNOWN,
    "benchmark.materiality.observed": UNKNOWN,
    "benchmark.confidence.observed": UNKNOWN,
    "benchmark.intervention_evaluation.observed": UNKNOWN,
  };
  return { ...context, evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])], facts };
}

async function enrichBenchmarkGuardrailsContext(supabase: any, context: PlaybookFrameworkInputLike["context"], organizationId: string) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rpcArgs = { target_organization_id: organizationId, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), target_store_id: null };
  const [salesResult, funnelResult, marginResult, stockResult, deliveryResult, dailyResult] = await Promise.all([
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase.rpc("shopify_funnel_summary", rpcArgs),
    supabase.rpc("shopify_margin_summary", rpcArgs),
    supabase.rpc("shopify_stock_summary", { target_organization_id: organizationId, low_stock_threshold: 5, target_store_id: null }),
    supabase.rpc("shopify_delivery_times", rpcArgs),
    supabase.rpc("shopify_sales_daily", rpcArgs),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  const day = context.as_of.slice(0, 10);
  return applyBenchmarkGuardrailsEvidence(
    context,
    {
      sales: salesResult.error ? { available: false } : { available: true, orders_count: first(salesResult)?.orders_count, revenue: first(salesResult)?.net_sales },
      funnel: funnelResult.error ? { available: false } : { available: true, sessions: first(funnelResult)?.sessions, conversion_rate: first(funnelResult)?.conversion_rate_shopify },
      margin: marginResult.error ? { available: false } : { available: true, items_with_cost: first(marginResult)?.items_with_cost },
      stock: stockResult.error ? { available: false } : { available: true, tracked_items: first(stockResult)?.tracked_items },
      delivery: deliveryResult.error ? { available: false } : { available: true, fulfillments: first(deliveryResult)?.fulfillments },
      measurement: dailyResult.error ? { available: false } : { available: true, days: Array.isArray(dailyResult.data) ? dailyResult.data.length : null },
    },
    [
      !salesResult.error ? `shopify_sales_summary:${organizationId}:${day}` : "",
      !funnelResult.error ? `shopify_funnel_summary:${organizationId}:${day}` : "",
      !marginResult.error ? `shopify_margin_summary:${organizationId}:${day}` : "",
      !stockResult.error ? `shopify_stock_summary:${organizationId}:${day}` : "",
      !deliveryResult.error ? `shopify_delivery_times:${organizationId}:${day}` : "",
      !dailyResult.error ? `shopify_sales_daily:${organizationId}:${day}` : "",
    ].filter(Boolean),
  );
}

function benchmarkTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "BENCHMARKS_GUARDRAILS" && validateBenchmarkGuardrailsPlaybookTemplate(template).valid;
}

const benchmarkOptions = {
  domain: "BENCHMARKS_GUARDRAILS",
  contextBuilder: buildBenchmarkGuardrailsPlaybookContext,
  contextEnricher: enrichBenchmarkGuardrailsContext,
  templateFilter: benchmarkTemplateFilter,
};

export function runBenchmarkGuardrailsPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, benchmarkOptions);
}
export function runBenchmarkGuardrailsPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, benchmarkOptions);
}
export { parseActivePlaybookTemplates };
