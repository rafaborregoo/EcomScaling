import {
  validateOperationsCxPlaybookTemplate,
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

const OPERATIONS_CX_SOURCE_VERSION = "f5-p08.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type OperationsCxEvidence = {
  delivery?: {
    fulfillments?: number | null;
    delivered?: number | null;
    in_transit?: number | null;
    avg_hours_to_ship?: number | null;
    avg_days_to_deliver?: number | null;
    with_estimate?: number | null;
    late_deliveries?: number | null;
    avg_delay_days?: number | null;
  } | null;
  orders?: { orders_count?: number | null } | null;
  returns?: { return_count?: number | null } | null;
  support?: { ticket_count?: number | null; wismo_count?: number | null } | null;
};

function available(value: number | null | undefined): PlaybookTriState {
  return value === null || value === undefined ? UNKNOWN : "TRUE";
}

export function buildOperationsCxPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  const facts: Record<string, PlaybookTriState> = {
    "operations.order_volume.observed": UNKNOWN,
    "operations.delivery.fulfillments_observed": UNKNOWN,
    "operations.delivery.delivered_observed": UNKNOWN,
    "operations.delivery.in_transit_observed": UNKNOWN,
    "operations.delivery.processing_time_observed": UNKNOWN,
    "operations.delivery.transit_time_observed": UNKNOWN,
    "operations.delivery.promise_observed": UNKNOWN,
    "operations.delivery.on_time_observed": UNKNOWN,
    "operations.backlog.observed": UNKNOWN,
    "operations.capacity.observed": UNKNOWN,
    "operations.capacity.bottleneck_observed": UNKNOWN,
    "operations.returns.observed": UNKNOWN,
    "operations.support.observed": UNKNOWN,
    "operations.support.wismo_observed": UNKNOWN,
    "operations.customer_experience.observed": UNKNOWN,
    "operations.economics.cost_observed": UNKNOWN,
    "operations.data_quality.timestamps_observed": UNKNOWN,
    "operations.service_recovery.observed": UNKNOWN,
    "operations.learning.observed": UNKNOWN,
  };
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "operations-cx-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p08"),
    source_versions: [...(base.source_versions ?? []), OPERATIONS_CX_SOURCE_VERSION],
    facts: { ...base.facts, ...facts },
  };
}

/** Declara qué datos operativos existen; no convierte retrasos en una causa. */
export function applyOperationsCxEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: OperationsCxEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const delivery = evidence.delivery;
  const orders = evidence.orders;
  const returns = evidence.returns;
  const support = evidence.support;
  const hasPromiseComparison =
    delivery?.with_estimate !== null &&
    delivery?.with_estimate !== undefined &&
    delivery.with_estimate > 0 &&
    delivery.late_deliveries !== null &&
    delivery.late_deliveries !== undefined;
  const facts: Record<string, PlaybookTriState> = {
    ...context.facts,
    "operations.order_volume.observed": available(orders?.orders_count),
    "operations.delivery.fulfillments_observed": available(delivery?.fulfillments),
    "operations.delivery.delivered_observed": available(delivery?.delivered),
    "operations.delivery.in_transit_observed": available(delivery?.in_transit),
    "operations.delivery.processing_time_observed": available(delivery?.avg_hours_to_ship),
    "operations.delivery.transit_time_observed": available(delivery?.avg_days_to_deliver),
    "operations.delivery.promise_observed": available(delivery?.with_estimate),
    "operations.delivery.on_time_observed": hasPromiseComparison ? "TRUE" : UNKNOWN,
    "operations.returns.observed": available(returns?.return_count),
    "operations.support.observed": available(support?.ticket_count),
    "operations.support.wismo_observed": available(support?.wismo_count),
    "operations.data_quality.timestamps_observed":
      delivery &&
      ((delivery.avg_hours_to_ship !== null && delivery.avg_hours_to_ship !== undefined) ||
        (delivery.avg_days_to_deliver !== null && delivery.avg_days_to_deliver !== undefined))
        ? "TRUE"
        : UNKNOWN,
  };
  return {
    ...context,
    evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])],
    facts,
  };
}

async function enrichOperationsCxContext(
  supabase: any,
  context: PlaybookFrameworkInputLike["context"],
  organizationId: string,
) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rpcArgs = {
    target_organization_id: organizationId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    target_store_id: null,
  };
  const [deliveryResult, salesResult, returnsResult] = await Promise.all([
    supabase.rpc("shopify_delivery_times", rpcArgs),
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase
      .from("shopify_returns")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("external_created_at", periodStart.toISOString())
      .lte("external_created_at", periodEnd.toISOString()),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  return applyOperationsCxEvidence(
    context,
    {
      delivery: deliveryResult.error ? null : first(deliveryResult),
      orders: salesResult.error ? null : first(salesResult),
      returns: returnsResult.error ? null : { return_count: returnsResult.count },
    },
    [
      !deliveryResult.error ? `shopify_delivery_times:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !salesResult.error ? `shopify_sales_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !returnsResult.error ? `shopify_returns:${organizationId}:${context.as_of.slice(0, 10)}` : "",
    ].filter(Boolean),
  );
}

function operationsCxTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "OPERATIONS_CX" && validateOperationsCxPlaybookTemplate(template).valid;
}

const operationsCxOptions = {
  domain: "OPERATIONS_CX",
  contextBuilder: buildOperationsCxPlaybookContext,
  contextEnricher: enrichOperationsCxContext,
  templateFilter: operationsCxTemplateFilter,
};

export function runOperationsCxPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, operationsCxOptions);
}

export function runOperationsCxPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, operationsCxOptions);
}

export { parseActivePlaybookTemplates };
