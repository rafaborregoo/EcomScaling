import {
  validateUnitEconomicsPlaybookTemplate,
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

const UNIT_ECONOMICS_SOURCE_VERSION = "f5-p06.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type UnitEconomicsEvidence = {
  sales?: {
    gross_sales?: number | null;
    discounts?: number | null;
    refunds?: number | null;
    net_sales?: number | null;
    orders_count?: number | null;
  } | null;
  margin?: {
    items_with_cost?: number | null;
    items_without_cost?: number | null;
    gross_margin?: number | null;
  } | null;
  financial?: {
    net_sales?: number | null;
    orders_count?: number | null;
    cogs?: number | null;
    gross_margin?: number | null;
    payment_fees?: number | null;
    shipping_costs?: number | null;
    fixed_costs?: number | null;
    net_profit?: number | null;
    items_without_cost?: number | null;
    // Columnas de `shopify_financial_summary` v2 (migracion 20260929093000).
    // El motor ya recibia la fila entera; estas tres estaban sin declarar, y
    // por eso contribution y CAC se fijaban a UNKNOWN teniendo el dato dentro.
    contribution_per_order?: number | null;
    cac_blended?: number | null;
    breakeven_cac_per_order?: number | null;
  } | null;
};

function observed(value: number | null | undefined): PlaybookTriState {
  return value === null || value === undefined ? UNKNOWN : value > 0 ? "TRUE" : "FALSE";
}

export function buildUnitEconomicsPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "unit-economics-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p06"),
    source_versions: [...(base.source_versions ?? []), UNIT_ECONOMICS_SOURCE_VERSION],
    facts: {
      ...base.facts,
      "unit_economics.revenue.gross_observed": UNKNOWN,
      "unit_economics.revenue.discounts_observed": UNKNOWN,
      "unit_economics.revenue.refunds_observed": UNKNOWN,
      "unit_economics.revenue.net_observed": UNKNOWN,
      "unit_economics.unit_order.observed": UNKNOWN,
      "unit_economics.costs.cogs_observed": UNKNOWN,
      "unit_economics.costs.variable_observed": UNKNOWN,
      "unit_economics.costs.fixed_observed": UNKNOWN,
      "unit_economics.costs.payment_fees_observed": UNKNOWN,
      "unit_economics.costs.shipping_observed": UNKNOWN,
      "unit_economics.gross_profit.observed": UNKNOWN,
      "unit_economics.financial_summary.available": UNKNOWN,
      "unit_economics.contribution.observed": UNKNOWN,
      "unit_economics.acquisition.cac_observed": UNKNOWN,
      "unit_economics.payback.observed": UNKNOWN,
      "unit_economics.cash.observed": UNKNOWN,
      "unit_economics.segmented.observed": UNKNOWN,
      "unit_economics.scenarios.observed": UNKNOWN,
      "unit_economics.data_quality.comparable": UNKNOWN,
      "unit_economics.data_quality.cost_coverage": UNKNOWN,
    },
  };
}

/** Declara fuentes y cobertura; nunca convierte beneficio neto en contribution. */
export function applyUnitEconomicsEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: UnitEconomicsEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  const sales = evidence.sales;
  const margin = evidence.margin;
  const financial = evidence.financial;
  const facts = {
    ...context.facts,
    "unit_economics.revenue.gross_observed": observed(sales?.gross_sales),
    "unit_economics.revenue.discounts_observed": sales ? "TRUE" : UNKNOWN,
    "unit_economics.revenue.refunds_observed": sales ? "TRUE" : UNKNOWN,
    "unit_economics.revenue.net_observed": observed(sales?.net_sales),
    "unit_economics.unit_order.observed": observed(sales?.orders_count),
    "unit_economics.costs.cogs_observed": observed(margin?.items_with_cost),
    "unit_economics.costs.variable_observed": financial && [financial.cogs, financial.payment_fees, financial.shipping_costs].some((value) => value !== null && value !== undefined) ? "TRUE" : UNKNOWN,
    "unit_economics.costs.fixed_observed": observed(financial?.fixed_costs),
    "unit_economics.costs.payment_fees_observed": observed(financial?.payment_fees),
    "unit_economics.costs.shipping_observed": observed(financial?.shipping_costs),
    "unit_economics.gross_profit.observed": observed(margin?.gross_margin ?? financial?.gross_margin),
    "unit_economics.financial_summary.available": financial ? "TRUE" : UNKNOWN,
    // `net_profit` sigue sin ser contribution: incluye costes fijos. Lo que
    // cambio es que la v2 del RPC anade `contribution_per_order`, que si lo es,
    // y `cac_blended` (gasto publicitario entre clientes nuevos). El motor ya
    // recibia las dos columnas y las ignoraba.
    "unit_economics.contribution.observed": observed(financial?.contribution_per_order),
    "unit_economics.acquisition.cac_observed": observed(financial?.cac_blended),
    // Payback sigue UNKNOWN a proposito: `breakeven_cac_per_order` es el umbral
    // que no hay que superar, no el periodo de recuperacion. Calcularlo pide
    // decidir horizonte y si va sobre margen o ingreso -- decision de producto.
    "unit_economics.payback.observed": UNKNOWN,
    "unit_economics.cash.observed": UNKNOWN,
    "unit_economics.segmented.observed": UNKNOWN,
    "unit_economics.scenarios.observed": UNKNOWN,
    "unit_economics.data_quality.comparable": UNKNOWN,
    "unit_economics.data_quality.cost_coverage": margin ? observed(margin.items_without_cost) : UNKNOWN,
  } satisfies Record<string, PlaybookTriState>;
  return {
    ...context,
    evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])],
    facts,
  };
}

async function enrichUnitEconomicsContext(
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
  const [salesResult, marginResult, financialResult] = await Promise.all([
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase.rpc("shopify_margin_summary", rpcArgs),
    supabase.rpc("shopify_financial_summary", rpcArgs),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  return applyUnitEconomicsEvidence(
    context,
    {
      sales: salesResult.error ? null : first(salesResult),
      margin: marginResult.error ? null : first(marginResult),
      financial: financialResult.error ? null : first(financialResult),
    },
    [
      !salesResult.error ? `shopify_sales_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !marginResult.error ? `shopify_margin_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !financialResult.error ? `shopify_financial_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
    ].filter(Boolean),
  );
}

function unitEconomicsTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "UNIT_ECONOMICS" && validateUnitEconomicsPlaybookTemplate(template).valid;
}

const unitEconomicsOptions = {
  domain: "UNIT_ECONOMICS",
  contextBuilder: buildUnitEconomicsPlaybookContext,
  contextEnricher: enrichUnitEconomicsContext,
  templateFilter: unitEconomicsTemplateFilter,
};

export function runUnitEconomicsPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, unitEconomicsOptions);
}

export function runUnitEconomicsPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, unitEconomicsOptions);
}

export { parseActivePlaybookTemplates };
