import {
  validateAcquisitionDemandPlaybookTemplate,
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

const ACQUISITION_DEMAND_SOURCE_VERSION = "f6-p03.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type AcquisitionDemandEvidence = {
  sales?: { available: boolean; orders_count?: number | null; net_sales?: number | null; revenue?: number | null } | null;
  funnel?: { available: boolean; sessions?: number | null; conversion_rate?: number | null } | null;
  recurrence?: { available: boolean; new_orders?: number | null; returning_orders?: number | null; unknown_orders?: number | null; repeat_order_rate?: number | null } | null;
  customerValue?: { available: boolean; customers?: number | null; orders_with_customer?: number | null; guest_orders?: number | null; avg_revenue_per_customer?: number | null } | null;
  margin?: { available: boolean; gross_margin?: number | null; contribution?: number | null; items_with_cost?: number | null; items_without_cost?: number | null } | null;
  // `cac_blended`, `ads_spend` y `new_customers` vienen en la misma fila de
  // `shopify_financial_summary` que el resto: el motor ya las recibia y no las
  // leia, asi que `acquisition.cac.observed` salia UNKNOWN teniendo el dato
  // delante. `cac_blended` es gasto publicitario entre clientes nuevos -- coste
  // real sobre ancla de Shopify, no atribucion de plataforma (ADR-0021).
  financial?: { available: boolean; net_profit?: number | null; break_even_monthly_revenue?: number | null; has_settings?: boolean | null; cac_blended?: number | null; ads_spend?: number | null; new_customers?: number | null } | null;
  stock?: { available: boolean; tracked_items?: number | null } | null;
  measurement?: { available: boolean; days?: number | null } | null;
};

function observed(available: boolean | null | undefined, value: number | null | undefined): PlaybookTriState {
  return available === true && value !== null && value !== undefined ? "TRUE" : available === false ? "FALSE" : UNKNOWN;
}

function acquisitionFacts(): Record<string, PlaybookTriState> {
  return {
    "acquisition.sales.observed": UNKNOWN,
    "acquisition.sample.observed": UNKNOWN,
    "acquisition.new_customer_orders.observed": UNKNOWN,
    "acquisition.new_customers.observed": UNKNOWN,
    "acquisition.returning_customers.observed": UNKNOWN,
    "acquisition.cac.observed": UNKNOWN,
    "acquisition.spend.observed": UNKNOWN,
    "acquisition.marginal_cac.observed": UNKNOWN,
    "acquisition.economics.observed": UNKNOWN,
    "acquisition.customer_quality.observed": UNKNOWN,
    "acquisition.channel_mix.observed": UNKNOWN,
    "acquisition.channel_role.observed": UNKNOWN,
    "acquisition.concentration.observed": UNKNOWN,
    "acquisition.demand_generation.observed": UNKNOWN,
    "acquisition.demand_capture.observed": UNKNOWN,
    "acquisition.incrementality.observed": UNKNOWN,
    "acquisition.payback.observed": UNKNOWN,
    "acquisition.cash_constraint.observed": UNKNOWN,
    "acquisition.inventory_constraint.observed": UNKNOWN,
    "acquisition.operations_constraint.observed": UNKNOWN,
    "acquisition.cohort_maturity.observed": UNKNOWN,
    "acquisition.history.observed": UNKNOWN,
    "acquisition.confidence.observed": UNKNOWN,
    "acquisition.scope_of_claim.observed": UNKNOWN,
  };
}

export function buildAcquisitionDemandPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "acquisition-demand-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f6-p03"),
    source_versions: [...(base.source_versions ?? []), ACQUISITION_DEMAND_SOURCE_VERSION],
    facts: { ...base.facts, ...acquisitionFacts() },
  };
}

export function applyAcquisitionDemandEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: AcquisitionDemandEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const facts: Record<string, PlaybookTriState> = {
    ...context.facts,
    ...acquisitionFacts(),
    "acquisition.sales.observed": observed(evidence.sales?.available, evidence.sales?.orders_count ?? evidence.sales?.net_sales ?? evidence.sales?.revenue),
    "acquisition.sample.observed": observed(evidence.sales?.available ?? evidence.funnel?.available, evidence.sales?.orders_count ?? evidence.funnel?.sessions),
    "acquisition.new_customer_orders.observed": observed(evidence.recurrence?.available, evidence.recurrence?.new_orders),
    "acquisition.returning_customers.observed": observed(evidence.recurrence?.available, evidence.recurrence?.returning_orders),
    "acquisition.economics.observed": observed(evidence.margin?.available ?? evidence.financial?.available, evidence.margin?.gross_margin ?? evidence.margin?.contribution ?? evidence.financial?.net_profit),
    "acquisition.customer_quality.observed": observed(evidence.customerValue?.available ?? evidence.recurrence?.available, evidence.customerValue?.customers ?? evidence.recurrence?.repeat_order_rate),
    "acquisition.cac.observed": observed(evidence.financial?.available, evidence.financial?.cac_blended),
    "acquisition.spend.observed": observed(evidence.financial?.available, evidence.financial?.ads_spend),
    "acquisition.new_customers.observed": observed(evidence.financial?.available ?? evidence.recurrence?.available, evidence.financial?.new_customers ?? evidence.recurrence?.new_orders),
    "acquisition.inventory_constraint.observed": observed(evidence.stock?.available, evidence.stock?.tracked_items),
    "acquisition.history.observed": observed(evidence.measurement?.available, evidence.measurement?.days),
  };
  return { ...context, evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])], facts };
}

async function enrichAcquisitionDemand(supabase: any, context: PlaybookFrameworkInputLike["context"], organizationId: string) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rpcArgs = { target_organization_id: organizationId, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), target_store_id: null };
  const [salesResult, funnelResult, recurrenceResult, customerValueResult, marginResult, financialResult, stockResult, dailyResult] = await Promise.all([
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase.rpc("shopify_funnel_summary", rpcArgs),
    supabase.rpc("shopify_customer_recurrence", rpcArgs),
    supabase.rpc("shopify_customer_value", { target_organization_id: organizationId, target_store_id: null }),
    supabase.rpc("shopify_margin_summary", rpcArgs),
    supabase.rpc("shopify_financial_summary", rpcArgs),
    supabase.rpc("shopify_stock_summary", { target_organization_id: organizationId, low_stock_threshold: 5, target_store_id: null }),
    supabase.rpc("shopify_sales_daily", rpcArgs),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  const day = context.as_of.slice(0, 10);
  return applyAcquisitionDemandEvidence(context, {
    sales: salesResult.error ? { available: false } : { available: true, orders_count: first(salesResult)?.orders_count, net_sales: first(salesResult)?.net_sales, revenue: first(salesResult)?.net_sales },
    funnel: funnelResult.error ? { available: false } : { available: true, sessions: first(funnelResult)?.sessions, conversion_rate: first(funnelResult)?.conversion_rate_shopify },
    recurrence: recurrenceResult.error ? { available: false } : { available: true, new_orders: first(recurrenceResult)?.new_orders, returning_orders: first(recurrenceResult)?.returning_orders, unknown_orders: first(recurrenceResult)?.unknown_orders, repeat_order_rate: first(recurrenceResult)?.repeat_order_rate },
    customerValue: customerValueResult.error ? { available: false } : { available: true, customers: first(customerValueResult)?.customers, orders_with_customer: first(customerValueResult)?.orders_with_customer, guest_orders: first(customerValueResult)?.guest_orders, avg_revenue_per_customer: first(customerValueResult)?.avg_revenue_per_customer },
    margin: marginResult.error ? { available: false } : { available: true, gross_margin: first(marginResult)?.gross_margin, contribution: first(financialResult)?.contribution_per_order, items_with_cost: first(marginResult)?.items_with_cost, items_without_cost: first(marginResult)?.items_without_cost },
    financial: financialResult.error ? { available: false } : { available: true, net_profit: first(financialResult)?.net_profit, break_even_monthly_revenue: first(financialResult)?.break_even_monthly_revenue, has_settings: first(financialResult)?.has_settings, cac_blended: first(financialResult)?.cac_blended, ads_spend: first(financialResult)?.ads_spend, new_customers: first(financialResult)?.new_customers },
    stock: stockResult.error ? { available: false } : { available: true, tracked_items: first(stockResult)?.tracked_items },
    measurement: dailyResult.error ? { available: false } : { available: true, days: Array.isArray(dailyResult.data) ? dailyResult.data.length : null },
  }, [
    !salesResult.error ? `shopify_sales_summary:${organizationId}:${day}` : "",
    !funnelResult.error ? `shopify_funnel_summary:${organizationId}:${day}` : "",
    !recurrenceResult.error ? `shopify_customer_recurrence:${organizationId}:${day}` : "",
    !customerValueResult.error ? `shopify_customer_value:${organizationId}:${day}` : "",
    !marginResult.error ? `shopify_margin_summary:${organizationId}:${day}` : "",
    !financialResult.error ? `shopify_financial_summary:${organizationId}:${day}` : "",
    !stockResult.error ? `shopify_stock_summary:${organizationId}:${day}` : "",
    !dailyResult.error ? `shopify_sales_daily:${organizationId}:${day}` : "",
  ].filter(Boolean));
}

function acquisitionDemandTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "ACQUISITION_DEMAND" && validateAcquisitionDemandPlaybookTemplate(template).valid;
}

const acquisitionDemandOptions = {
  domain: "ACQUISITION_DEMAND",
  contextBuilder: buildAcquisitionDemandPlaybookContext,
  contextEnricher: enrichAcquisitionDemand,
  templateFilter: acquisitionDemandTemplateFilter,
};

export function runAcquisitionDemandPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, acquisitionDemandOptions);
}

export function runAcquisitionDemandPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, acquisitionDemandOptions);
}

export { parseActivePlaybookTemplates };
