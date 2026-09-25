import {
  validateDataQualityReliabilityPlaybookTemplate,
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

const DATA_QUALITY_SOURCE_VERSION = "f6-p02.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type DataQualityReliabilityEvidence = {
  assessments?: { available: boolean; count?: number | null; with_coverage?: number | null; with_freshness?: number | null } | null;
  issues?: { available: boolean; open_material?: number | null } | null;
  sales?: { available: boolean; orders_count?: number | null; revenue?: number | null } | null;
  funnel?: { available: boolean; sessions?: number | null; conversion_rate?: number | null } | null;
  measurement?: { available: boolean; days?: number | null } | null;
};

function observed(available: boolean | null | undefined, value: number | null | undefined): PlaybookTriState {
  return available === true && value !== null && value !== undefined ? "TRUE" : available === false ? "FALSE" : UNKNOWN;
}

function dataQualityFacts(): Record<string, PlaybookTriState> {
  return {
    "data_quality.metric.observed": UNKNOWN,
    "data_quality.source.observed": UNKNOWN,
    "data_quality.definition.observed": UNKNOWN,
    "data_quality.source_of_truth.observed": UNKNOWN,
    "data_quality.accuracy.observed": UNKNOWN,
    "data_quality.completeness.observed": UNKNOWN,
    "data_quality.consistency.observed": UNKNOWN,
    "data_quality.freshness.observed": UNKNOWN,
    "data_quality.representativeness.observed": UNKNOWN,
    "data_quality.comparability.observed": UNKNOWN,
    "data_quality.granularity.observed": UNKNOWN,
    "data_quality.integrity.observed": UNKNOWN,
    "data_quality.traceability.observed": UNKNOWN,
    "data_quality.evidence_kind.observed": UNKNOWN,
    "data_quality.sample.observed": UNKNOWN,
    "data_quality.maturity.observed": UNKNOWN,
    "data_quality.missingness.observed": UNKNOWN,
    "data_quality.reconciliation.observed": UNKNOWN,
    "data_quality.math_checks.observed": UNKNOWN,
    "data_quality.tracking.observed": UNKNOWN,
    "data_quality.contamination.observed": UNKNOWN,
    "data_quality.issues.observed": UNKNOWN,
    "data_quality.confidence.observed": UNKNOWN,
    "data_quality.scope_of_claim.observed": UNKNOWN,
  };
}

export function buildDataQualityReliabilityPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "data-quality-reliability-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f6-p02"),
    source_versions: [...(base.source_versions ?? []), DATA_QUALITY_SOURCE_VERSION],
    facts: { ...base.facts, ...dataQualityFacts() },
  };
}

export function applyDataQualityReliabilityEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: DataQualityReliabilityEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const hasMetric = Boolean(evidence.sales || evidence.funnel);
  const hasSource = Boolean(evidence.assessments || evidence.sales || evidence.funnel || evidence.measurement);
  const facts: Record<string, PlaybookTriState> = {
    ...context.facts,
    ...dataQualityFacts(),
    "data_quality.metric.observed": observed(evidence.sales?.available ?? evidence.funnel?.available, evidence.sales?.revenue ?? evidence.sales?.orders_count ?? evidence.funnel?.conversion_rate),
    "data_quality.source.observed": hasSource ? "TRUE" : UNKNOWN,
    "data_quality.completeness.observed": observed(evidence.assessments?.available, evidence.assessments?.with_coverage),
    "data_quality.freshness.observed": observed(evidence.assessments?.available, evidence.assessments?.with_freshness),
    "data_quality.granularity.observed": observed(evidence.assessments?.available, evidence.assessments?.count),
    "data_quality.traceability.observed": hasSource ? "TRUE" : UNKNOWN,
    "data_quality.evidence_kind.observed": hasMetric ? "TRUE" : UNKNOWN,
    "data_quality.sample.observed": observed(evidence.sales?.available ?? evidence.funnel?.available, evidence.sales?.orders_count ?? evidence.funnel?.sessions),
    "data_quality.missingness.observed": observed(evidence.assessments?.available, evidence.assessments?.with_coverage),
    "data_quality.tracking.observed": observed(evidence.assessments?.available, evidence.assessments?.count),
    "data_quality.issues.observed": evidence.issues?.available === true ? "TRUE" : evidence.issues?.available === false ? "FALSE" : UNKNOWN,
  };
  return { ...context, evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])], facts };
}

async function enrichDataQualityReliability(supabase: any, context: PlaybookFrameworkInputLike["context"], organizationId: string) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rpcArgs = { target_organization_id: organizationId, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), target_store_id: null };
  const [assessmentsResult, issuesResult, salesResult, funnelResult, dailyResult] = await Promise.all([
    supabase.from("data_quality_assessments").select("id, coverage, freshness, assessed_at").eq("organization_id", organizationId).order("assessed_at", { ascending: false }).limit(100),
    supabase.from("data_quality_issues").select("id, status, material").eq("organization_id", organizationId).in("status", ["open", "investigating"]).limit(100),
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase.rpc("shopify_funnel_summary", rpcArgs),
    supabase.rpc("shopify_sales_daily", rpcArgs),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  const assessments = Array.isArray(assessmentsResult.data) ? assessmentsResult.data : [];
  const issues = Array.isArray(issuesResult.data) ? issuesResult.data : [];
  const day = context.as_of.slice(0, 10);
  return applyDataQualityReliabilityEvidence(context, {
    assessments: assessmentsResult.error ? { available: false } : { available: true, count: assessments.length, with_coverage: assessments.filter((row: any) => row.coverage !== null && row.coverage !== undefined).length, with_freshness: assessments.filter((row: any) => row.freshness !== null && row.freshness !== undefined).length },
    issues: issuesResult.error ? { available: false } : { available: true, open_material: issues.filter((row: any) => row.material === true).length },
    sales: salesResult.error ? { available: false } : { available: true, orders_count: first(salesResult)?.orders_count, revenue: first(salesResult)?.net_sales },
    funnel: funnelResult.error ? { available: false } : { available: true, sessions: first(funnelResult)?.sessions, conversion_rate: first(funnelResult)?.conversion_rate_shopify },
    measurement: dailyResult.error ? { available: false } : { available: true, days: Array.isArray(dailyResult.data) ? dailyResult.data.length : null },
  }, [
    !assessmentsResult.error ? `data_quality_assessments:${organizationId}:${day}` : "",
    !issuesResult.error ? `data_quality_issues:${organizationId}:${day}` : "",
    !salesResult.error ? `shopify_sales_summary:${organizationId}:${day}` : "",
    !funnelResult.error ? `shopify_funnel_summary:${organizationId}:${day}` : "",
    !dailyResult.error ? `shopify_sales_daily:${organizationId}:${day}` : "",
  ].filter(Boolean));
}

function dataQualityTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "DATA_QUALITY_RELIABILITY" && validateDataQualityReliabilityPlaybookTemplate(template).valid;
}

const dataQualityOptions = {
  domain: "DATA_QUALITY_RELIABILITY",
  contextBuilder: buildDataQualityReliabilityPlaybookContext,
  contextEnricher: enrichDataQualityReliability,
  templateFilter: dataQualityTemplateFilter,
};

export function runDataQualityReliabilityPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, dataQualityOptions);
}

export function runDataQualityReliabilityPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, dataQualityOptions);
}

export { parseActivePlaybookTemplates };
