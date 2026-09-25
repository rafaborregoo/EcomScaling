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
  "f8-universal",
  "f8-executability",
  "f8-capabilities",
  "f8-safe-execution",
  "f8-monitoring",
  "f8-guardrails",
  "f8-incidents",
  "f8-rollback-recovery",
  "f8-override-escalation",
  "f8-concurrency",
  "f8-verification",
  "f8-reporting",
  "expected-outcome",
  "recommendation-confidence",
  "recommendation-communication",
  "hitl-approval",
  "closure-handoff",
  "continuous-learning",
  "f9-evidence",
  "f9-domains",
  "f9-knowledge",
  "f9-governance",
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
