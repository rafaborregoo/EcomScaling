import {
  validateCohortContextPlaybookTemplate,
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

const COHORT_SOURCE_VERSION = "f6-p01.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type CohortContextEvidence = {
  sales?: { available: boolean; orders_count?: number | null; revenue?: number | null } | null;
  funnel?: { available: boolean; sessions?: number | null; conversion_rate?: number | null } | null;
  margin?: { available: boolean; items_with_cost?: number | null } | null;
  measurement?: { available: boolean; days?: number | null } | null;
};

function observed(available: boolean | null | undefined, value: number | null | undefined): PlaybookTriState {
  return available === true && value !== null && value !== undefined ? "TRUE" : available === false ? "FALSE" : UNKNOWN;
}

function cohortFacts(): Record<string, PlaybookTriState> {
  return {
    "cohort.metric.observed": UNKNOWN,
    "cohort.metric.definition.observed": UNKNOWN,
    "cohort.metric.source.observed": UNKNOWN,
    "cohort.period.observed": UNKNOWN,
    "cohort.sample.observed": UNKNOWN,
    "cohort.history.observed": UNKNOWN,
    "cohort.tenant_context.observed": UNKNOWN,
    "cohort.segment.observed": UNKNOWN,
    "cohort.reference.observed": UNKNOWN,
    "cohort.definition_compatibility.observed": UNKNOWN,
    "cohort.mix.observed": UNKNOWN,
    "cohort.temporal_context.observed": UNKNOWN,
    "cohort.economics.observed": UNKNOWN,
    "cohort.comparability.observed": UNKNOWN,
    "cohort.sample_adequacy.observed": UNKNOWN,
    "cohort.oversegmentation_risk.observed": UNKNOWN,
    "cohort.alternative_references.observed": UNKNOWN,
    "cohort.confidence.observed": UNKNOWN,
  };
}

export function buildCohortContextPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "cohort-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f6-p01"),
    source_versions: [...(base.source_versions ?? []), COHORT_SOURCE_VERSION],
    facts: { ...base.facts, ...cohortFacts() },
  };
}

export function applyCohortContextEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: CohortContextEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const hasSource = Boolean(evidence.sales || evidence.funnel || evidence.measurement);
  const facts: Record<string, PlaybookTriState> = {
    ...context.facts,
    ...cohortFacts(),
    "cohort.metric.observed": observed(
      evidence.sales?.available ?? evidence.funnel?.available,
      evidence.sales?.revenue ?? evidence.sales?.orders_count ?? evidence.funnel?.conversion_rate,
    ),
    "cohort.metric.source.observed": hasSource ? "TRUE" : UNKNOWN,
    "cohort.period.observed": hasSource ? "TRUE" : UNKNOWN,
    "cohort.sample.observed": observed(evidence.sales?.available ?? evidence.funnel?.available, evidence.sales?.orders_count ?? evidence.funnel?.sessions),
    "cohort.history.observed": observed(evidence.measurement?.available, evidence.measurement?.days),
    "cohort.temporal_context.observed": observed(evidence.measurement?.available, evidence.measurement?.days),
    "cohort.economics.observed": observed(evidence.margin?.available, evidence.margin?.items_with_cost),
  };
  return { ...context, evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])], facts };
}

async function enrichCohortContext(supabase: any, context: PlaybookFrameworkInputLike["context"], organizationId: string) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rpcArgs = { target_organization_id: organizationId, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), target_store_id: null };
  const [salesResult, funnelResult, marginResult, measurementResult] = await Promise.all([
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase.rpc("shopify_funnel_summary", rpcArgs),
    supabase.rpc("shopify_margin_summary", rpcArgs),
    supabase.rpc("shopify_sales_daily", rpcArgs),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  const day = context.as_of.slice(0, 10);
  return applyCohortContextEvidence(context, {
    sales: salesResult.error ? { available: false } : { available: true, orders_count: first(salesResult)?.orders_count, revenue: first(salesResult)?.net_sales },
    funnel: funnelResult.error ? { available: false } : { available: true, sessions: first(funnelResult)?.sessions, conversion_rate: first(funnelResult)?.conversion_rate_shopify },
    margin: marginResult.error ? { available: false } : { available: true, items_with_cost: first(marginResult)?.items_with_cost },
    measurement: measurementResult.error ? { available: false } : { available: true, days: Array.isArray(measurementResult.data) ? measurementResult.data.length : null },
  }, [
    !salesResult.error ? `shopify_sales_summary:${organizationId}:${day}` : "",
    !funnelResult.error ? `shopify_funnel_summary:${organizationId}:${day}` : "",
    !marginResult.error ? `shopify_margin_summary:${organizationId}:${day}` : "",
    !measurementResult.error ? `shopify_sales_daily:${organizationId}:${day}` : "",
  ].filter(Boolean));
}

function cohortTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "COHORT_CONTEXT" && validateCohortContextPlaybookTemplate(template).valid;
}

const cohortOptions = {
  domain: "COHORT_CONTEXT",
  contextBuilder: buildCohortContextPlaybookContext,
  contextEnricher: enrichCohortContext,
  templateFilter: cohortTemplateFilter,
};

export function runCohortContextPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, cohortOptions);
}

export function runCohortContextPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, cohortOptions);
}

export { parseActivePlaybookTemplates };
