import { z } from "zod";

// Fase 10 (conocimiento/fase-10/02-contratos-IA/10.02): evidencia de
// atribucion cross-channel. Compone C6.1 sin renombrar su vocabulario
// (measurement_basis, attribution_basis, attribution_model, attribution_window,
// revenue_basis, value_state, source_system) y no sustituye a ADR-0021.
//
// Ninguna cifra atribuida viaja desnuda: lleva fuente, periodo, moneda, modelo
// y ventana. `null` en modelo/ventana/moneda = desconocido, nunca un default.

// Solo fuentes con integracion real (10.03 R9: sin enums para Google Ads/GA4).
export const ATTRIBUTION_SOURCE_SYSTEMS = ["shopify", "meta", "klaviyo"] as const;

// C6.1 §42, §43 y §25.
export const MEASUREMENT_BASES = ["observed", "predicted", "modeled", "inferred"] as const;
export const ATTRIBUTION_BASES = ["attributed", "incremental", "unattributed", "blended"] as const;
export const VALUE_STATES = ["available", "missing", "not_applicable", "undefined", "suppressed"] as const;

export const attributionEvidenceSchema = z
  .object({
    metric_id: z.string().min(1),
    source_system: z.enum(ATTRIBUTION_SOURCE_SYSTEMS),
    channel: z.string().min(1),
    measurement_period: z.object({ start: z.string().min(1), end: z.string().min(1) }),
    measurement_basis: z.enum(MEASUREMENT_BASES),
    // null = no aplica (magnitud observada del comercio, no un credito asignado).
    attribution_basis: z.enum(ATTRIBUTION_BASES).nullable(),
    attribution_model: z.string().min(1).nullable(),
    attribution_window: z.string().min(1).nullable(),
    revenue_basis: z.string().min(1),
    currency_code: z.string().regex(/^[A-Z]{3}$/).nullable(),
    value: z.number().finite().nullable(),
    value_state: z.enum(VALUE_STATES),
    // causal_evidence y demas roles de 10.02 no se emiten todavia: no hay fuente
    // causal implementada. Se anaden cuando exista.
    evidence_role: z.enum(["economic_anchor", "channel_signal"]),
    evidence_strength: z.string().min(1).optional(),
    confidence: z.string().min(1).optional(),
    lineage: z.array(z.string().min(1)).min(1),
    data_maturity: z.enum(["provisional", "consolidated", "unknown"]),
    limitations: z.array(z.string().min(1)),
  })
  .superRefine((evidence, ctx) => {
    // C6.1 §26: missing != 0. Un valor solo existe si esta disponible.
    if ((evidence.value_state === "available") !== (evidence.value !== null)) {
      ctx.addIssue({ code: "custom", message: "value solo puede ser no-null con value_state=available" });
    }
    // INV-XCA-006/008: una senal de canal es credito atribuido, nunca incremental.
    if (evidence.evidence_role === "channel_signal" && evidence.attribution_basis !== "attributed") {
      ctx.addIssue({ code: "custom", message: "channel_signal exige attribution_basis=attributed" });
    }
    if (
      evidence.evidence_role === "economic_anchor" &&
      (evidence.measurement_basis !== "observed" || evidence.attribution_basis !== null)
    ) {
      ctx.addIssue({ code: "custom", message: "economic_anchor exige magnitud observada sin atribucion" });
    }
  });

export type AttributionEvidence = z.infer<typeof attributionEvidenceSchema>;

export const COMPARISON_STATUSES = [
  "comparable",
  "partially_comparable",
  "insufficient_context",
  "not_comparable",
] as const;
export type ComparisonStatus = (typeof COMPARISON_STATUSES)[number];

export type CompatibilityIssue =
  | "currency_mismatch"
  | "currency_unknown"
  | "measurement_period_mismatch"
  | "missing_attribution_context";

export type AnchorComparison = {
  metric_id: string;
  source_system: AttributionEvidence["source_system"];
  comparison_status: ComparisonStatus;
  compatibility_issues: CompatibilityIssue[];
  unknowns: string[];
  // Revenue atribuido por la plataforma / revenue observado del anchor, en %.
  // NO es incrementalidad ni "cuanto genera el canal": solo la relacion entre
  // el credito que se adjudica la plataforma y la economia observada. Puede
  // pasar de 100 (la plataforma se atribuye mas de lo que se vendio).
  dependency_pct: number | null;
};

/**
 * Relaciona una senal de canal con el anchor economico. Devuelve ratio solo si
 * hay dos valores disponibles, misma moneda conocida, mismo periodo y anchor >
 * 0; en cualquier otro caso ratio null con el motivo, nunca 0.
 */
export function compareToEconomicAnchor(
  anchor: AttributionEvidence,
  channel: AttributionEvidence,
): AnchorComparison {
  const base = { metric_id: channel.metric_id, source_system: channel.source_system };
  const unknowns: string[] = [];
  if (anchor.value === null) unknowns.push(anchor.metric_id);
  if (channel.value === null) unknowns.push(channel.metric_id);
  if (anchor.value === null || channel.value === null) {
    return { ...base, comparison_status: "insufficient_context", compatibility_issues: [], unknowns, dependency_pct: null };
  }

  const blocking: CompatibilityIssue[] = [];
  if (anchor.currency_code === null || channel.currency_code === null) blocking.push("currency_unknown");
  else if (anchor.currency_code !== channel.currency_code) blocking.push("currency_mismatch");
  if (
    anchor.measurement_period.start !== channel.measurement_period.start ||
    anchor.measurement_period.end !== channel.measurement_period.end
  ) {
    blocking.push("measurement_period_mismatch");
  }
  if (blocking.length > 0) {
    return { ...base, comparison_status: "not_comparable", compatibility_issues: blocking, unknowns, dependency_pct: null };
  }

  // Denominador 0: ratio indefinido (C6.1 §28), no 0% ni infinito.
  if (anchor.value <= 0) {
    return { ...base, comparison_status: "insufficient_context", compatibility_issues: [], unknowns: [`${anchor.metric_id}:zero`], dependency_pct: null };
  }

  // INV-XCA-005: sin modelo o ventana la relacion se puede calcular, pero la
  // comparabilidad baja y queda dicho por que.
  const partial = channel.attribution_model === null || channel.attribution_window === null;
  if (channel.attribution_model === null) unknowns.push(`${channel.metric_id}:attribution_model`);
  if (channel.attribution_window === null) unknowns.push(`${channel.metric_id}:attribution_window`);
  return {
    ...base,
    comparison_status: partial ? "partially_comparable" : "comparable",
    compatibility_issues: partial ? ["missing_attribution_context"] : [],
    unknowns,
    dependency_pct: (channel.value / anchor.value) * 100,
  };
}

// 10.02 CrossChannelMeasurementSet: agrupa sin fusionar. Deliberadamente sin
// ningun campo "total": INV-XCA-001 prohibe sumar revenue atribuido entre
// plataformas. cross_channel_claims no se emite todavia (ningun productor de
// claims usa este contrato aun).
export type CrossChannelMeasurementSet = {
  economic_anchor: AttributionEvidence;
  channel_evidence: AttributionEvidence[];
  comparisons: AnchorComparison[];
  comparison_status: ComparisonStatus;
  compatibility_issues: CompatibilityIssue[];
  unknowns: string[];
};

export function buildCrossChannelMeasurementSet(
  anchor: AttributionEvidence,
  channels: AttributionEvidence[],
): CrossChannelMeasurementSet {
  const economicAnchor = attributionEvidenceSchema.parse(anchor);
  const channelEvidence = channels.map((channel) => attributionEvidenceSchema.parse(channel));
  const comparisons = channelEvidence.map((channel) => compareToEconomicAnchor(economicAnchor, channel));
  // El estado del conjunto es el peor de sus comparaciones.
  const worst = comparisons.reduce<ComparisonStatus>(
    (acc, item) =>
      COMPARISON_STATUSES.indexOf(item.comparison_status) > COMPARISON_STATUSES.indexOf(acc) ? item.comparison_status : acc,
    "comparable",
  );
  return {
    economic_anchor: economicAnchor,
    channel_evidence: channelEvidence,
    comparisons,
    comparison_status: comparisons.length ? worst : "insufficient_context",
    compatibility_issues: [...new Set(comparisons.flatMap((item) => item.compatibility_issues))],
    unknowns: [...new Set(comparisons.flatMap((item) => item.unknowns))],
  };
}
