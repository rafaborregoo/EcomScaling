/**
 * Destinos de navegacion que puede proponer el Copiloto.
 *
 * El modelo solo devuelve el slug. La ruta real la resuelve la UI contra el
 * mismo catalogo de InsightsMenu; asi nunca se ejecuta una URL inventada por
 * el modelo.
 */
export const COPILOT_INSIGHT_TARGET_SLUGS = [
  "d12-adversarial",
  "d13-temporal",
  "d14-output",
  "intervention-eligibility",
  "intervention-matching",
  "intervention-prioritization",
  "intervention-impact",
  "intervention-feasibility",
  "intervention-risk",
  "intervention-sequencing",
  "intervention-test-execute",
  "intervention-intensity",
  "maturity-recommendations",
  "constraint-recommendations",
  "recommendation-portfolio",
  "dynamic-decision",
  "restraint-decision",
  "acquisition",
  "paid-media",
  "conversion",
  "offer-pricing",
  "retention-crm",
  "unit-economics",
  "product-inventory",
  "operations-cx",
  "measurement-experimentation",
  "scalability",
  "recovery-crisis",
  "benchmark-guardrails",
  "cohort-context",
  "data-quality-reliability",
  "acquisition-demand",
  "paid-media-benchmarks",
  "conversion-cro-benchmarks",
  "offer-pricing-benchmarks",
  "retention-crm-benchmarks",
  "unit-economics-benchmarks",
  "operations-cx-benchmarks",
  "product-inventory-benchmarks",
  "scalability-benchmarks",
  "anomalies-red-flags",
  "benchmark-confidence",
  "execution-plan",
  "readiness",
  "action-envelope",
  "execution-supervision",
  "expected-outcome",
  "recommendation-confidence",
  "recommendation-communication",
  "hitl-approval",
  "closure-handoff",
  "continuous-learning",
] as const;

export type CopilotInsightTarget = (typeof COPILOT_INSIGHT_TARGET_SLUGS)[number];

export function isCopilotInsightTarget(value: unknown): value is CopilotInsightTarget {
  return typeof value === "string" && (COPILOT_INSIGHT_TARGET_SLUGS as readonly string[]).includes(value);
}

export function copilotInsightHref(value: unknown): string | null {
  return isCopilotInsightTarget(value)
    ? `/shopify/diagnostico#insight-${value}`
    : null;
}
