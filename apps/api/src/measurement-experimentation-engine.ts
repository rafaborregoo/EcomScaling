import {
  validateMeasurementExperimentationPlaybookTemplate,
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

export const MEASUREMENT_EXPERIMENTATION_SOURCE_VERSION = "f5-p09.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type MeasurementExperimentationEvidence = {
  sales?: { available: boolean; orders_count?: number | null } | null;
  funnel?: {
    available: boolean;
    has_sessions?: boolean | null;
    sessions?: number | null;
    has_funnel_steps?: boolean | null;
    purchases?: number | null;
  } | null;
  daily?: { available: boolean; days?: number | null } | null;
};

function availability(value: boolean | null | undefined): PlaybookTriState {
  return value === true ? "TRUE" : value === false ? "FALSE" : UNKNOWN;
}

function numericAvailability(
  available: boolean | null | undefined,
  value: number | null | undefined,
): PlaybookTriState {
  return available === true && value !== null && value !== undefined
    ? "TRUE"
    : available === false
      ? "FALSE"
      : UNKNOWN;
}

export function buildMeasurementExperimentationPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  const facts: Record<string, PlaybookTriState> = {
    "measurement.data.available": UNKNOWN,
    "measurement.orders.observed": UNKNOWN,
    "measurement.sessions.observed": UNKNOWN,
    "measurement.funnel.steps_observed": UNKNOWN,
    "measurement.purchase_events.observed": UNKNOWN,
    "measurement.baseline.observed": UNKNOWN,
    "measurement.reconciliation.observed": UNKNOWN,
    "measurement.data_quality.completeness_observed": UNKNOWN,
    "measurement.data_quality.accuracy_observed": UNKNOWN,
    "measurement.data_quality.consistency_observed": UNKNOWN,
    "measurement.data_quality.freshness_observed": UNKNOWN,
    "measurement.data_quality.uniqueness_observed": UNKNOWN,
    "measurement.data_quality.validity_observed": UNKNOWN,
    "measurement.data_quality.lineage_observed": UNKNOWN,
    "measurement.tracking.event_semantics_observed": UNKNOWN,
    "measurement.identity.observed": UNKNOWN,
    "measurement.attribution.observed": UNKNOWN,
    "measurement.experimentation.capability_observed": UNKNOWN,
    "measurement.experimentation.primary_outcome_observed": UNKNOWN,
    "measurement.experimentation.guardrails_observed": UNKNOWN,
    "measurement.causal_evidence.observed": UNKNOWN,
    "measurement.learning.observed": UNKNOWN,
  };
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "measurement-experimentation-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p09"),
    source_versions: [...(base.source_versions ?? []), MEASUREMENT_EXPERIMENTATION_SOURCE_VERSION],
    facts: { ...base.facts, ...facts },
  };
}

/** Declara disponibilidad de medición sin convertir cobertura en calidad ni causalidad. */
export function applyMeasurementExperimentationEvidence(
  context: PlaybookFrameworkInputLike["context"],
  evidence: MeasurementExperimentationEvidence,
  sourceRefs: string[] = [],
): PlaybookFrameworkInputLike["context"] {
  return {
    ...context,
    evidence_refs: [...new Set([...(context.evidence_refs ?? []), ...sourceRefs])],
    facts: { ...context.facts, ...measurementObservationFacts(evidence) },
  };
}

/** Shared coverage contract for the playbook engine and store-scoped A24. */
export function measurementObservationFacts(
  evidence: MeasurementExperimentationEvidence,
): Record<string, PlaybookTriState> {
  const sales = evidence.sales;
  const funnel = evidence.funnel;
  const daily = evidence.daily;
  const hasData = sales?.available === true || funnel?.available === true || daily?.available === true;
  const facts: Record<string, PlaybookTriState> = {
    "measurement.data.available": hasData ? "TRUE" : sales || funnel || daily ? "FALSE" : UNKNOWN,
    "measurement.orders.observed": numericAvailability(sales?.available, sales?.orders_count),
    "measurement.sessions.observed": numericAvailability(funnel?.available, funnel?.sessions),
    "measurement.funnel.steps_observed": availability(funnel?.available === true ? funnel.has_funnel_steps : funnel?.available === false ? false : undefined),
    "measurement.purchase_events.observed": numericAvailability(funnel ? funnel.available && funnel.has_funnel_steps === true : undefined, funnel?.purchases),
    "measurement.baseline.observed": numericAvailability(daily?.available, daily?.days),
  };
  return facts;
}

async function enrichMeasurementExperimentationContext(
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
  const [salesResult, funnelResult, dailyResult] = await Promise.all([
    supabase.rpc("shopify_sales_summary", rpcArgs),
    supabase.rpc("shopify_funnel_summary", rpcArgs),
    supabase.rpc("shopify_sales_daily", rpcArgs),
  ]);
  const first = (result: any) => (Array.isArray(result.data) ? result.data[0] : null);
  return applyMeasurementExperimentationEvidence(
    context,
    {
      sales: salesResult.error ? { available: false } : { available: true, orders_count: first(salesResult)?.orders_count },
      funnel: funnelResult.error
        ? { available: false }
        : {
            available: true,
            has_sessions: (first(funnelResult)?.sessions ?? 0) > 0,
            sessions: first(funnelResult)?.sessions,
            has_funnel_steps: [first(funnelResult)?.cart_additions, first(funnelResult)?.checkouts_reached].some((v: number | null | undefined) => v !== null && v !== undefined),
            purchases: first(funnelResult)?.purchases,
          },
      daily: dailyResult.error
        ? { available: false }
        : { available: true, days: Array.isArray(dailyResult.data) ? dailyResult.data.length : null },
    },
    [
      !salesResult.error ? `shopify_sales_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !funnelResult.error ? `shopify_funnel_summary:${organizationId}:${context.as_of.slice(0, 10)}` : "",
      !dailyResult.error ? `shopify_sales_daily:${organizationId}:${context.as_of.slice(0, 10)}` : "",
    ].filter(Boolean),
  );
}

function measurementExperimentationTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "MEASUREMENT_EXPERIMENTATION" && validateMeasurementExperimentationPlaybookTemplate(template).valid;
}

const measurementExperimentationOptions = {
  domain: "MEASUREMENT_EXPERIMENTATION",
  contextBuilder: buildMeasurementExperimentationPlaybookContext,
  contextEnricher: enrichMeasurementExperimentationContext,
  templateFilter: measurementExperimentationTemplateFilter,
};

export function runMeasurementExperimentationPlaybookEngine(env: LoadedApiEnv, organizationId: string) {
  return runPlaybookFrameworkEngine(env, organizationId, measurementExperimentationOptions);
}

export function runMeasurementExperimentationPlaybookEngineForAllOrganizations(env: LoadedApiEnv) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, measurementExperimentationOptions);
}

export { parseActivePlaybookTemplates };
