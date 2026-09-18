import {
  validateRecoveryCrisisPlaybookTemplate,
  type PlaybookFrameworkInputLike,
  type PlaybookTemplate,
  type PlaybookTriState,
} from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { buildPlaybookContext, parseActivePlaybookTemplates, runPlaybookFrameworkEngine, runPlaybookFrameworkEngineForAllOrganizations } from "./playbook-engine.js";

const RECOVERY_CRISIS_SOURCE_VERSION = "f5-p11.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type RecoveryCrisisEvidence = {
  sales?: { available: boolean; orders_count?: number | null } | null;
  delivery?: { available: boolean; fulfillments?: number | null } | null;
  stock?: { available: boolean; tracked_items?: number | null } | null;
  measurement?: { available: boolean; days?: number | null } | null;
};

function observed(available: boolean | null | undefined, value: number | null | undefined): PlaybookTriState {
  return available === true && value !== null && value !== undefined ? "TRUE" : available === false ? "FALSE" : UNKNOWN;
}

export function buildRecoveryCrisisPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  const facts: Record<string, PlaybookTriState> = {
    "recovery_crisis.sources.available": UNKNOWN,
    "recovery_crisis.demand.observed": UNKNOWN,
    "recovery_crisis.throughput.observed": UNKNOWN,
    "recovery_crisis.crisis_state.observed": UNKNOWN,
    "recovery_crisis.incident.observed": UNKNOWN,
    "recovery_crisis.severity.observed": UNKNOWN,
    "recovery_crisis.blast_radius.observed": UNKNOWN,
    "recovery_crisis.customer_impact.observed": UNKNOWN,
    "recovery_crisis.continuity.observed": UNKNOWN,
    "recovery_crisis.containment.observed": UNKNOWN,
    "recovery_crisis.stabilization.observed": UNKNOWN,
    "recovery_crisis.recovery_baseline.observed": UNKNOWN,
    "recovery_crisis.stability.observed": UNKNOWN,
    "recovery_crisis.measurement_confidence.observed": UNKNOWN,
    "recovery_crisis.root_cause.observed": UNKNOWN,
    "recovery_crisis.communication.observed": UNKNOWN,
  };
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "recovery-crisis-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p11"),
    source_versions: [...(base.source_versions ?? []), RECOVERY_CRISIS_SOURCE_VERSION],
    facts: { ...base.facts, ...facts },
  };
}

/** Declara cobertura disponible; no convierte una caída o una fuente existente en crisis. */
export function applyRecoveryCrisisEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: RecoveryCrisisEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const hasSources = Boolean(evidence.sales || evidence.delivery || evidence.stock || evidence.measurement);
  return {
    ...context,
    evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])],
    facts: {
      ...context.facts,
      "recovery_crisis.sources.available": hasSources ? "TRUE" : UNKNOWN,
      "recovery_crisis.demand.observed": observed(evidence.sales?.available, evidence.sales?.orders_count),
      "recovery_crisis.throughput.observed": observed(evidence.delivery?.available, evidence.delivery?.fulfillments ?? evidence.sales?.orders_count),
      "recovery_crisis.crisis_state.observed": UNKNOWN,
      "recovery_crisis.incident.observed": UNKNOWN,
      "recovery_crisis.severity.observed": UNKNOWN,
      "recovery_crisis.blast_radius.observed": UNKNOWN,
      "recovery_crisis.customer_impact.observed": UNKNOWN,
      "recovery_crisis.continuity.observed": UNKNOWN,
      "recovery_crisis.containment.observed": UNKNOWN,
      "recovery_crisis.stabilization.observed": UNKNOWN,
      "recovery_crisis.recovery_baseline.observed": UNKNOWN,
      "recovery_crisis.stability.observed": UNKNOWN,
      "recovery_crisis.measurement_confidence.observed": observed(evidence.measurement?.available, evidence.measurement?.days),
      "recovery_crisis.root_cause.observed": UNKNOWN,
      "recovery_crisis.communication.observed": UNKNOWN,
    },
  };
}

async function enrichRecoveryCrisisContext(supabase: any, context: PlaybookFrameworkInputLike["context"], organizationId: string) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rpcArgs = { target_organization_id: organizationId, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), target_store_id: null };
  const [salesResult, deliveryResult, stockResult, dailyResult] = await Promise.all([
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase.rpc("shopify_delivery_times", rpcArgs),
    supabase.rpc("shopify_stock_summary", { target_organization_id: organizationId, low_stock_threshold: 5, target_store_id: null }),
    supabase.rpc("shopify_sales_daily", rpcArgs),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  const day = context.as_of.slice(0, 10);
  return applyRecoveryCrisisEvidence(context, {
    sales: salesResult.error ? { available: false } : { available: true, orders_count: first(salesResult)?.orders_count },
    delivery: deliveryResult.error ? { available: false } : { available: true, fulfillments: first(deliveryResult)?.fulfillments },
    stock: stockResult.error ? { available: false } : { available: true, tracked_items: first(stockResult)?.tracked_items },
    measurement: dailyResult.error ? { available: false } : { available: true, days: Array.isArray(dailyResult.data) ? dailyResult.data.length : null },
  }, [
    !salesResult.error ? `shopify_sales_summary:${organizationId}:${day}` : "",
    !deliveryResult.error ? `shopify_delivery_times:${organizationId}:${day}` : "",
    !stockResult.error ? `shopify_stock_summary:${organizationId}:${day}` : "",
    !dailyResult.error ? `shopify_sales_daily:${organizationId}:${day}` : "",
  ].filter(Boolean));
}

function recoveryCrisisTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "RECOVERY_CRISIS" && validateRecoveryCrisisPlaybookTemplate(template).valid;
}

const recoveryCrisisOptions = { domain: "RECOVERY_CRISIS", contextBuilder: buildRecoveryCrisisPlaybookContext, contextEnricher: enrichRecoveryCrisisContext, templateFilter: recoveryCrisisTemplateFilter };

export function runRecoveryCrisisPlaybookEngine(env: LoadedApiEnv, organizationId: string) { return runPlaybookFrameworkEngine(env, organizationId, recoveryCrisisOptions); }
export function runRecoveryCrisisPlaybookEngineForAllOrganizations(env: LoadedApiEnv) { return runPlaybookFrameworkEngineForAllOrganizations(env, recoveryCrisisOptions); }
export { parseActivePlaybookTemplates };
