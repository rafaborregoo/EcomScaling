import {
  validateScalabilityPlaybookTemplate,
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

const SCALABILITY_SOURCE_VERSION = "f5-p10.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type ScalabilityEvidence = {
  sales?: { available: boolean; orders_count?: number | null } | null;
  margin?: { available: boolean; items_with_cost?: number | null } | null;
  stock?: { available: boolean; tracked_items?: number | null; total_available?: number | null } | null;
  delivery?: { available: boolean; fulfillments?: number | null } | null;
  measurement?: { available: boolean; days?: number | null } | null;
};

function observed(available: boolean | null | undefined, value: number | null | undefined): PlaybookTriState {
  return available === true && value !== null && value !== undefined ? "TRUE" : available === false ? "FALSE" : UNKNOWN;
}

export function buildScalabilityPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  const facts: Record<string, PlaybookTriState> = {
    "scalability.system.map_available": UNKNOWN,
    "scalability.demand.observed": UNKNOWN,
    "scalability.throughput.observed": UNKNOWN,
    "scalability.capacity.observed": UNKNOWN,
    "scalability.headroom.observed": UNKNOWN,
    "scalability.constraint.observed": UNKNOWN,
    "scalability.economics.observed": UNKNOWN,
    "scalability.inventory_readiness.observed": UNKNOWN,
    "scalability.operational_readiness.observed": UNKNOWN,
    "scalability.measurement_readiness.observed": UNKNOWN,
    "scalability.dependencies.observed": UNKNOWN,
    "scalability.fragility.observed": UNKNOWN,
    "scalability.scale_test.observed": UNKNOWN,
    "scalability.guardrails.observed": UNKNOWN,
    "scalability.next_constraint.observed": UNKNOWN,
  };
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "scalability-constraints-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p10"),
    source_versions: [...(base.source_versions ?? []), SCALABILITY_SOURCE_VERSION],
    facts: { ...base.facts, ...facts },
  };
}

/** Declara cobertura de demanda/throughput y readiness sin convertir señales en un bottleneck probado. */
export function applyScalabilityEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: ScalabilityEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const facts: Record<string, PlaybookTriState> = {
    ...context.facts,
    "scalability.system.map_available": evidence.sales || evidence.margin || evidence.stock || evidence.delivery || evidence.measurement ? "TRUE" : UNKNOWN,
    "scalability.demand.observed": observed(evidence.sales?.available, evidence.sales?.orders_count),
    "scalability.throughput.observed": observed(evidence.delivery?.available, evidence.delivery?.fulfillments ?? evidence.sales?.orders_count),
    "scalability.capacity.observed": UNKNOWN,
    "scalability.headroom.observed": UNKNOWN,
    "scalability.constraint.observed": UNKNOWN,
    "scalability.economics.observed": observed(evidence.margin?.available, evidence.margin?.items_with_cost),
    "scalability.inventory_readiness.observed": observed(evidence.stock?.available, evidence.stock?.tracked_items),
    "scalability.operational_readiness.observed": observed(evidence.delivery?.available, evidence.delivery?.fulfillments),
    "scalability.measurement_readiness.observed": observed(evidence.measurement?.available, evidence.measurement?.days),
    "scalability.dependencies.observed": UNKNOWN,
    "scalability.fragility.observed": UNKNOWN,
    "scalability.scale_test.observed": UNKNOWN,
    "scalability.guardrails.observed": UNKNOWN,
    "scalability.next_constraint.observed": UNKNOWN,
  };
  return { ...context, evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])], facts };
}

async function enrichScalabilityContext(supabase: any, context: PlaybookFrameworkInputLike["context"], organizationId: string) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rpcArgs = { target_organization_id: organizationId, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), target_store_id: null };
  const [salesResult, marginResult, stockResult, deliveryResult, dailyResult] = await Promise.all([
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase.rpc("shopify_margin_summary", rpcArgs),
    supabase.rpc("shopify_stock_summary", { target_organization_id: organizationId, low_stock_threshold: 5, target_store_id: null }),
    supabase.rpc("shopify_delivery_times", rpcArgs),
    supabase.rpc("shopify_sales_daily", rpcArgs),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  const day = context.as_of.slice(0, 10);
  return applyScalabilityEvidence(
    context,
    {
      sales: salesResult.error ? { available: false } : { available: true, orders_count: first(salesResult)?.orders_count },
      margin: marginResult.error ? { available: false } : { available: true, items_with_cost: first(marginResult)?.items_with_cost },
      stock: stockResult.error ? { available: false } : { available: true, tracked_items: first(stockResult)?.tracked_items, total_available: first(stockResult)?.total_available },
      delivery: deliveryResult.error ? { available: false } : { available: true, fulfillments: first(deliveryResult)?.fulfillments },
      measurement: dailyResult.error ? { available: false } : { available: true, days: Array.isArray(dailyResult.data) ? dailyResult.data.length : null },
    },
    [
      !salesResult.error ? `shopify_sales_summary:${organizationId}:${day}` : "",
      !marginResult.error ? `shopify_margin_summary:${organizationId}:${day}` : "",
      !stockResult.error ? `shopify_stock_summary:${organizationId}:${day}` : "",
      !deliveryResult.error ? `shopify_delivery_times:${organizationId}:${day}` : "",
      !dailyResult.error ? `shopify_sales_daily:${organizationId}:${day}` : "",
    ].filter(Boolean),
  );
}

function scalabilityTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "SCALABILITY" && validateScalabilityPlaybookTemplate(template).valid;
}

const scalabilityOptions = {
  domain: "SCALABILITY",
  contextBuilder: buildScalabilityPlaybookContext,
  contextEnricher: enrichScalabilityContext,
  templateFilter: scalabilityTemplateFilter,
};

export function runScalabilityPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, scalabilityOptions);
}
export function runScalabilityPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, scalabilityOptions);
}
export { parseActivePlaybookTemplates };
