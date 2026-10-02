import {
  validateUnitEconomicsBenchmarksPlaybookTemplate,
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
import { shopifyNetMetricsComplete, shopifyNetMetricsQualityFacts } from "./shopify-net-metrics-coverage.js";

const UNKNOWN: PlaybookTriState = "UNKNOWN";
const SOURCE = "f6-p08.v3";
const present = (value: unknown) => value !== null && value !== undefined;
const obs = (available: boolean | null | undefined, value: boolean): PlaybookTriState =>
  available === true && value ? "TRUE" : available === false ? "FALSE" : UNKNOWN;

export type UnitEconomicsBenchmarksEvidence = {
  sales?: {
    available: boolean;
    gross_sales?: number | null;
    discounts?: number | null;
    refunds?: number | null;
    net_sales?: number | null;
    orders_count?: number | null;
  } | null;
  margin?: {
    available: boolean;
    items_with_cost?: number | null;
    items_without_cost?: number | null;
    gross_margin?: number | null;
    lines_with_exact_metrics?: number | null;
    lines_with_estimated_metrics?: number | null;
    lines_without_metrics?: number | null;
  } | null;
  financial?: {
    available: boolean;
    cogs?: number | null;
    payment_fees?: number | null;
    shipping_costs?: number | null;
    fixed_costs?: number | null;
    net_profit?: number | null;
    contribution_per_order?: number | null;
    cac_blended?: number | null;
  } | null;
  history?: { available: boolean; days?: number | null } | null;
};

function facts(): Record<string, PlaybookTriState> {
  return {
    "unit_economics_benchmarks.revenue.observed": UNKNOWN,
    "unit_economics_benchmarks.discounts.observed": UNKNOWN,
    "unit_economics_benchmarks.refunds.observed": UNKNOWN,
    "unit_economics_benchmarks.costs.observed": UNKNOWN,
    "unit_economics_benchmarks.gross_profit.observed": UNKNOWN,
    "unit_economics_benchmarks.contribution.observed": UNKNOWN,
    "unit_economics_benchmarks.cac.observed": UNKNOWN,
    "unit_economics_benchmarks.payback.observed": UNKNOWN,
    "unit_economics_benchmarks.cash.observed": UNKNOWN,
    "unit_economics_benchmarks.fixed_costs.observed": UNKNOWN,
    "unit_economics_benchmarks.cohort_economics.observed": UNKNOWN,
    "unit_economics_benchmarks.scenarios.observed": UNKNOWN,
    "unit_economics_benchmarks.history.observed": UNKNOWN,
    "unit_economics_benchmarks.confidence.observed": UNKNOWN,
    "unit_economics_benchmarks.scope_of_claim.observed": UNKNOWN,
    "unit_economics_benchmarks.data_quality.net_line_metrics_complete": UNKNOWN,
    "unit_economics_benchmarks.data_quality.net_line_metrics_exact": UNKNOWN,
    "unit_economics_benchmarks.data_quality.net_line_metrics_estimated": UNKNOWN,
  };
}

export function buildUnitEconomicsBenchmarksPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "unit-economics-benchmarks-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f6-p08"),
    source_versions: [...(base.source_versions ?? []), SOURCE],
    facts: { ...base.facts, ...facts() },
  };
}

export function applyUnitEconomicsBenchmarksEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: UnitEconomicsBenchmarksEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const sales = evidence.sales;
  const financial = evidence.financial;
  const margin = evidence.margin;
  const netLineMetricsComplete = shopifyNetMetricsComplete(margin);
  const lineMetricsComplete: PlaybookTriState = netLineMetricsComplete === null
    ? UNKNOWN
    : netLineMetricsComplete ? "TRUE" : "FALSE";
  const anyEvidence = Object.values(evidence).some(Boolean);
  const marginAvailable = margin?.available === true;
  const gatedMarginObservation = (available: boolean | null | undefined, value: boolean) =>
    lineMetricsComplete === "TRUE" ? obs(available, value) : UNKNOWN;

  const updated: Record<string, PlaybookTriState> = {
    ...context.facts,
    ...facts(),
    ...shopifyNetMetricsQualityFacts(margin),
    "unit_economics_benchmarks.revenue.observed": obs(
      sales?.available,
      Boolean(sales && [sales.gross_sales, sales.net_sales].some(present)),
    ),
    "unit_economics_benchmarks.discounts.observed": obs(sales?.available, present(sales?.discounts)),
    "unit_economics_benchmarks.refunds.observed": obs(sales?.available, present(sales?.refunds)),
    // shopify_financial_summary consumes line-level margin; do not make it
    // decision evidence while some order lines have unknown net amounts.
    "unit_economics_benchmarks.costs.observed": gatedMarginObservation(
      marginAvailable && financial?.available === true,
      Boolean(financial && [financial.cogs, financial.payment_fees, financial.shipping_costs].some(present)),
    ),
    "unit_economics_benchmarks.gross_profit.observed": gatedMarginObservation(
      marginAvailable,
      present(margin?.gross_margin),
    ),
    "unit_economics_benchmarks.contribution.observed": gatedMarginObservation(
      marginAvailable && financial?.available === true,
      present(financial?.contribution_per_order),
    ),
    "unit_economics_benchmarks.cac.observed": obs(financial?.available, present(financial?.cac_blended)),
    "unit_economics_benchmarks.payback.observed": UNKNOWN,
    "unit_economics_benchmarks.cash.observed": UNKNOWN,
    "unit_economics_benchmarks.fixed_costs.observed": obs(financial?.available, present(financial?.fixed_costs)),
    "unit_economics_benchmarks.cohort_economics.observed": UNKNOWN,
    "unit_economics_benchmarks.scenarios.observed": UNKNOWN,
    "unit_economics_benchmarks.history.observed": obs(evidence.history?.available, present(evidence.history?.days)),
    "unit_economics_benchmarks.confidence.observed": UNKNOWN,
    "unit_economics_benchmarks.scope_of_claim.observed": anyEvidence ? "TRUE" : UNKNOWN,
    "unit_economics_benchmarks.data_quality.net_line_metrics_complete": lineMetricsComplete,
    "unit_economics_benchmarks.data_quality.net_line_metrics_exact":
      typeof margin?.lines_with_exact_metrics === "number"
        ? (margin.lines_with_exact_metrics > 0 ? "TRUE" : "FALSE")
        : UNKNOWN,
    "unit_economics_benchmarks.data_quality.net_line_metrics_estimated":
      typeof margin?.lines_with_estimated_metrics === "number"
        ? (margin.lines_with_estimated_metrics > 0 ? "TRUE" : "FALSE")
        : UNKNOWN,
  };

  return {
    ...context,
    evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])],
    facts: updated,
  };
}

async function enrich(
  supabase: any,
  context: PlaybookFrameworkInputLike["context"],
  organizationId: string,
) {
  const end = new Date(context.as_of);
  const start = new Date(end.getTime() - 90 * 86400000);
  const args = {
    target_organization_id: organizationId,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    target_store_id: null,
  };
  const [salesResult, marginResult, financialResult, dailyResult] = await Promise.all([
    supabase.rpc("shopify_sales_summary", args),
    supabase.rpc("shopify_margin_summary", args),
    supabase.rpc("shopify_financial_summary", args),
    supabase.rpc("shopify_sales_daily", args),
  ]);
  const first = (result: any) => Array.isArray(result?.data) ? result.data[0] ?? null : null;
  const day = context.as_of.slice(0, 10);
  const ref = (name: string, result: any) => !result?.error ? `${name}:${organizationId}:${day}` : "";

  return applyUnitEconomicsBenchmarksEvidence(context, {
    sales: salesResult.error ? { available: false } : { available: true, ...first(salesResult) },
    margin: marginResult.error ? { available: false } : { available: true, ...first(marginResult) },
    financial: financialResult.error ? { available: false } : { available: true, ...first(financialResult) },
    history: dailyResult.error
      ? { available: false }
      : { available: true, days: Array.isArray(dailyResult.data) ? dailyResult.data.length : null },
  }, [
    ref("shopify_sales_summary", salesResult),
    ref("shopify_margin_summary", marginResult),
    ref("shopify_financial_summary", financialResult),
    ref("shopify_sales_daily", dailyResult),
  ].filter(Boolean));
}

function filter(template: PlaybookTemplate) {
  return template.domain === "UNIT_ECONOMICS_BENCHMARKS" &&
    validateUnitEconomicsBenchmarksPlaybookTemplate(template).valid;
}

const options = {
  domain: "UNIT_ECONOMICS_BENCHMARKS",
  contextBuilder: buildUnitEconomicsBenchmarksPlaybookContext,
  contextEnricher: enrich,
  templateFilter: filter,
};

export function runUnitEconomicsBenchmarksPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, options);
}
export function runUnitEconomicsBenchmarksPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, options);
}
export { parseActivePlaybookTemplates };
