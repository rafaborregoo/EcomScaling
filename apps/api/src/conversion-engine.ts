import {
  validateConversionCroPlaybookTemplate,
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

const CONVERSION_SOURCE_VERSION = "f5-p03.v1";
const UNKNOWN: PlaybookTriState = "UNKNOWN";

export type ConversionFunnelSummary = {
  sessions?: number | null;
  days_with_sessions?: number | null;
  funnel_data_since?: string | null;
};

export function buildConversionPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "conversion-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p03"),
    source_versions: [...(base.source_versions ?? []), CONVERSION_SOURCE_VERSION],
    facts: {
      ...base.facts,
      "conversion_cro.funnel.measurement.sufficient": UNKNOWN,
      "conversion_cro.funnel.sessions.available": UNKNOWN,
      "conversion_cro.funnel.steps.available": UNKNOWN,
      "conversion_cro.traffic.quality.available": UNKNOWN,
      "conversion_cro.segment.evidence.available": UNKNOWN,
      "conversion_cro.qualitative.research.available": UNKNOWN,
      "conversion_cro.economics.available": UNKNOWN,
      "conversion_cro.post_purchase.evidence.available": UNKNOWN,
    },
  };
}

/**
 * Traduce únicamente cobertura observable del embudo a hechos tri-state. No
 * convierte una tasa en "fuga": el artefacto no define umbrales ni un
 * benchmark, por lo que esa conclusión necesita diagnóstico/evidencia aparte.
 */
export function applyConversionFunnelFacts(
  context: PlaybookFrameworkInputLike["context"],
  summary: ConversionFunnelSummary | null,
  periodStart: string,
  sourceRef?: string,
): PlaybookFrameworkInputLike["context"] {
  if (!summary) return context;
  const hasSessions = Number(summary.days_with_sessions) > 0;
  const completeSince = summary.funnel_data_since ?? null;
  const hasCompleteSteps =
    completeSince !== null && completeSince <= periodStart.slice(0, 10);
  const evidenceRefs = sourceRef
    ? [...(context.evidence_refs ?? []), sourceRef]
    : context.evidence_refs;
  return {
    ...context,
    evidence_refs: evidenceRefs,
    facts: {
      ...context.facts,
      "conversion_cro.funnel.measurement.sufficient": hasCompleteSteps
        ? "TRUE"
        : UNKNOWN,
      "conversion_cro.funnel.sessions.available": hasSessions ? "TRUE" : UNKNOWN,
      "conversion_cro.funnel.steps.available": hasCompleteSteps ? "TRUE" : UNKNOWN,
    },
  };
}

async function enrichConversionContext(
  supabase: any,
  context: PlaybookFrameworkInputLike["context"],
  organizationId: string,
) {
  const periodEnd = new Date(context.as_of);
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase.rpc("shopify_funnel_summary", {
    target_organization_id: organizationId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    target_store_id: null,
  });
  if (error) return context;
  const summary = (Array.isArray(data) ? data[0] : null) as ConversionFunnelSummary | null;
  return applyConversionFunnelFacts(
    context,
    summary,
    periodStart.toISOString(),
    `shopify_funnel_summary:${organizationId}:${context.as_of.slice(0, 10)}`,
  );
}

function conversionTemplateFilter(template: PlaybookTemplate): boolean {
  return (
    template.domain === "CONVERSION" &&
    validateConversionCroPlaybookTemplate(template).valid
  );
}

const conversionOptions = {
  domain: "CONVERSION",
  contextBuilder: buildConversionPlaybookContext,
  contextEnricher: enrichConversionContext,
  templateFilter: conversionTemplateFilter,
};

export async function runConversionPlaybookEngine(
  env: LoadedApiEnv,
  organizationId: string,
) {
  return runPlaybookFrameworkEngine(env, organizationId, conversionOptions);
}

export async function runConversionPlaybookEngineForAllOrganizations(
  env: LoadedApiEnv,
) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, conversionOptions);
}

export { parseActivePlaybookTemplates };
