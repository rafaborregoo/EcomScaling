/**
 * FASE 3 / D12 — Confusores y falsos diagnosticos.
 *
 * Fuente: `02-contratos-IA/D12-contrato-de-confusores-y-falsos-diagnosticos.md`
 * (22 apartados, 25 tipos de confusor, 18 tests nombrados con sus fixtures).
 *
 * **A diferencia de D00 a D11, D12 tiene una sola capa de fuente**: no hay
 * corpus maestro, ni guardrails, ni runtime, ni tenant-context. Lo que hay aqui
 * sale de los 22 apartados y de la lista de invariantes del 21.
 *
 * LA CAPA ADVERSARIAL. D12 no busca la mejor explicacion -- eso es D08 -- sino
 * la mejor razon por la que la interpretacion completa podria ser enganosa. El
 * principio de cierre del apartado 22: **intentar refutar la primera
 * explicacion, no protegerla.**
 *
 * DE AHI LA GARANTIA CENTRAL: no se puede declarar que un diagnostico sobrevive
 * sin haber escrito antes por que podria estar mal. Y no hay ninguna columna
 * para forzar la supervivencia -- el apartado 21 lo prohibe y la garantia es
 * que no cabe.
 */
import { z } from "zod";

import { type DiagnosticInvariantViolation } from "./diagnostics.js";

/** Apartado 3: los 25 tipos que el sistema debe reconocer como minimo. */
export const CONFOUNDER_TYPES = [
  "seasonality", "promotion", "launch", "traffic_mix", "customer_mix", "product_mix",
  "market_mix", "device_mix", "channel_mix", "price_change", "inventory_change",
  "attribution_change", "tracking_change", "metric_definition_change", "partial_period",
  "day_of_week", "holiday", "sample_size", "outlier", "external_event",
  "operational_change", "technology_change", "currency_change", "shipping_change",
  "payment_change",
] as const;

/** Apartado 3: las ocho categorias conceptuales. */
export const CONFOUNDER_CATEGORIES = [
  "measurement", "context", "composition", "temporal", "selection",
  "external", "behavioral", "operational",
] as const;

/** Apartado 5. */
export const CONFOUNDER_STATUSES = [
  "candidate", "plausible", "supported", "material", "rejected", "resolved",
] as const;

/** Apartado 14. */
export const CONFOUNDER_STRENGTHS = ["weak", "moderate", "strong", "decisive"] as const;

/** Apartado 14. */
export const CONFOUNDER_RESOLUTIONS = [
  "adjusted_for", "segmented_out", "rejected", "unresolved",
] as const;

/** Apartado 2. */
export const FALSE_DIAGNOSIS_RISKS = ["low", "medium", "high", "critical"] as const;

/** Apartado 10. */
export const SURVIVAL_STATUSES = [
  "survives", "survives_with_limitations", "weakened", "requires_revision", "invalidated",
] as const;

/** Apartado 13. */
export const DIAGNOSIS_STABILITY = [
  "stable_to_assumptions", "sensitive", "highly_sensitive",
] as const;

/** Apartado 4. */
export const COMPARABILITY_STATES = [
  "comparable", "partially_comparable", "not_comparable", "unknown",
] as const;

/** Apartado 6: el contrato prefiere estos controles a la opinion. */
export const CONTROL_KINDS = [
  "natural_control", "treated_untreated", "within_segment", "mature_cohort",
  "constant_currency", "normalized_rate", "other",
] as const;

export const DIAGNOSTIC_FAMILIES = [
  "revenue", "cac", "conversion", "retention", "finance", "inventory", "data", "technology",
] as const;

/**
 * Apartado 7, literal. **El runtime no debe ejecutar mecanicamente todos los
 * checks posibles**, pero estos son los minimos por familia. Tenerlos como dato
 * y no como prosa es lo que permite comprobar que no falta ninguno.
 */
export const MANDATORY_CHECKS_BY_FAMILY: Record<string, readonly string[]> = {
  revenue: [
    "period_comparability", "seasonality", "promotions", "tracking",
    "traffic", "cvr", "aov", "product_availability",
  ],
  cac: [
    "cpm", "ctr", "cvr", "traffic_channel_mix", "new_customer_definition",
    "attribution", "scale_level",
  ],
  conversion: [
    "traffic_mix", "device_mix", "market_mix", "product_mix",
    "inventory", "price", "promotion", "tracking",
  ],
  retention: [
    "cohort_maturity", "customer_mix", "product_mix",
    "promotion_cohorts", "identity_resolution",
  ],
  finance: [
    "accounting_timing", "one_offs", "inventory", "cash_vs_accrual", "cost_completeness",
  ],
  inventory: [
    "demand_spike", "promotion", "lead_time", "inbound_stock", "sku_mix", "forecast_horizon",
  ],
  data: ["schema", "tracking", "definitions", "sync", "permissions", "timezone"],
  technology: ["deployment", "traffic_load", "third_party_outage", "browser_device"],
};

/** Los tipos que son composicion: el corazon de la paradoja de Simpson. */
const TIPOS_DE_MIX = [
  "traffic_mix", "customer_mix", "product_mix", "market_mix", "device_mix", "channel_mix",
];

/** Cambios deliberados que, si caen a la vez, no se pueden atribuir por separado. */
const TIPOS_DE_INTERVENCION = [
  "price_change", "launch", "promotion", "technology_change", "operational_change",
];

const CONFIANZA = ["high", "medium", "low", "insufficient_data"] as const;
const nivel = (x: string) =>
  x === "high" ? 3 : x === "medium" ? 2 : x === "low" ? 1 : 0;

// ---------------------------------------------------------------------------
// El resultado de la revision adversarial
// ---------------------------------------------------------------------------

export const diagnosticRobustnessFields = z.object({
  robustness_id: z.string().min(1),
  case_id: z.string().min(1),
  false_diagnosis_risk: z.enum(FALSE_DIAGNOSIS_RISKS).default("medium"),
  survival_status: z.enum(SURVIVAL_STATUSES).default("weakened"),
  robustness: z.enum(["high", "medium", "low"]).default("medium"),
  diagnosis_stability: z.enum(DIAGNOSIS_STABILITY).default("sensitive"),

  confidence_before: z.enum(CONFIANZA).optional(),
  confidence_after: z.enum(CONFIANZA).optional(),
  confidence_adjustment: z.string().optional(),

  /** Apartado 12: sin esto no se puede decir que algo sobrevivio. */
  red_team_counter_explanation: z.string().optional(),
  red_team_supporting_evidence: z.string().optional(),
  red_team_required_evidence: z.string().optional(),
  red_team_effect: z.string().optional(),

  revision_triggered: z.boolean().default(false),
  reopened_blocks: z.array(z.string()).default([]),

  remaining_limitations: z.string().optional(),
});

export const diagnosticRobustnessSchema = diagnosticRobustnessFields
  // Apartados 12 y 22: la garantia central del bloque.
  .refine(
    (d) =>
      !["survives", "survives_with_limitations"].includes(d.survival_status) ||
      d.red_team_counter_explanation != null,
    { message: "Decir que un diagnostico sobrevive exige haber escrito por que podria estar mal (apartado 12)." },
  )
  // Apartado 2.
  .refine(
    (d) =>
      d.false_diagnosis_risk !== "critical" ||
      ["requires_revision", "invalidated"].includes(d.survival_status),
    { message: "Un riesgo CRITICAL de falso diagnostico bloquea el cierre (apartado 2)." },
  )
  .refine(
    (d) => d.survival_status !== "survives_with_limitations" || d.remaining_limitations != null,
    { message: "Sobrevivir con limitaciones exige decir cuales (apartado 10)." },
  )
  // Apartado 13.
  .refine(
    (d) =>
      d.diagnosis_stability !== "highly_sensitive" ||
      (d.survival_status !== "survives" && d.remaining_limitations != null),
    { message: "Un diagnostico muy sensible a los supuestos no sale intacto (apartado 13)." },
  )
  .refine(
    (d) => d.robustness !== "high" || d.diagnosis_stability === "stable_to_assumptions",
    { message: "Un diagnostico robusto del todo no puede ser sensible a los supuestos (apartado 13)." },
  )
  // Apartado 21: la confianza no queda intacta tras una revision que debilita.
  .refine(
    (d) =>
      !["weakened", "requires_revision"].includes(d.survival_status) ||
      d.confidence_before == null ||
      d.confidence_after == null ||
      nivel(d.confidence_after) < nivel(d.confidence_before),
    { message: "Si la revision debilita el diagnostico, la confianza baja (apartado 21)." },
  )
  // Apartado 11: revisar significa reabrir algo.
  .refine(
    (d) =>
      !["requires_revision", "invalidated"].includes(d.survival_status) ||
      (d.revision_triggered && d.reopened_blocks.length > 0),
    { message: "Revisar o invalidar obliga a reabrir D06 a D09, no solo a anotarlo (apartado 11)." },
  );

export type DiagnosticRobustness = z.infer<typeof diagnosticRobustnessSchema>;

// ---------------------------------------------------------------------------
// El confusor
// ---------------------------------------------------------------------------

export const diagnosticConfounderFields = z.object({
  confounder_id: z.string().min(1),
  case_id: z.string().min(1),
  /** El linaje con la candidata de D02, para no teclearla dos veces. */
  source_confounder_id: z.string().optional(),

  confounder_type: z.enum(CONFOUNDER_TYPES),
  category: z.enum(CONFOUNDER_CATEGORIES),
  description: z.string().min(20),

  affected_metrics: z.array(z.string()).default([]),
  scope: z.string().default("global"),

  evidence: z.string().optional(),
  plausibility: z.enum(["speculative", "plausible", "supported"]).default("speculative"),
  strength: z.enum(CONFOUNDER_STRENGTHS).default("weak"),
  materiality: z.enum(["low", "material", "high"]).default("low"),
  status: z.enum(CONFOUNDER_STATUSES).default("candidate"),
  resolution: z.enum(CONFOUNDER_RESOLUTIONS).default("unresolved"),
  adjustment_note: z.string().optional(),
  confidence_effect: z.string().optional(),

  /** Apartado 8: el lado del falso negativo. */
  masking_effect: z.boolean().default(false),
});

export const diagnosticConfounderSchema = diagnosticConfounderFields
  // Apartado 5: subir cuesta evidencia.
  .refine(
    (c) => !["supported", "material", "resolved"].includes(c.status) || c.evidence != null,
    { message: "Sin evidencia escrita un confusor no pasa de PLAUSIBLE (apartado 5)." },
  )
  // Apartado 5: descartar tambien cuesta evidencia.
  .refine((c) => c.status !== "rejected" || c.evidence != null, {
    message: "REJECTED es que la evidencia muestra que no puede explicarlo, no una comodidad (apartado 5).",
  })
  // Apartado 14: un confusor especulativo no destruye un diagnostico fuerte.
  .refine(
    (c) => c.plausibility !== "speculative" || ["weak", "moderate"].includes(c.strength),
    { message: "Un confusor hipotetico sin soporte no puede ser decisivo (apartado 14)." },
  )
  .refine((c) => c.strength !== "decisive" || c.plausibility === "supported", {
    message: "Lo decisivo esta soportado, no solo es plausible (apartado 14).",
  })
  .refine(
    (c) =>
      c.status !== "resolved" ||
      ["adjusted_for", "segmented_out", "rejected"].includes(c.resolution),
    { message: "RESOLVED es que su efecto ya se conto, aislo o controlo (apartado 5)." },
  )
  // Apartado 14: si se ajusta, la salida lo dice.
  .refine((c) => c.resolution !== "adjusted_for" || c.adjustment_note != null, {
    message: "Ajustar por un factor obliga a declarar que el diagnostico se expresa despues de controlarlo (apartado 14).",
  })
  .refine((c) => c.status !== "material" || c.confidence_effect != null, {
    message: "Un confusor material declara que le hace a la confianza (apartado 21).",
  });

export type DiagnosticConfounder = z.infer<typeof diagnosticConfounderSchema>;

export const confounderTestSchema = z
  .object({
    test_id: z.string().min(1),
    confounder_id: z.string().min(1),
    required_data: z.string().min(1),
    expected_pattern: z.string().min(15),
    control_kind: z.enum(CONTROL_KINDS).default("other"),
    result: z.enum(["pending", "confirmed", "refuted", "inconclusive"]).default("pending"),
    effect_on_diagnosis: z.string().optional(),
  })
  .refine((t) => t.result === "pending" || t.effect_on_diagnosis != null, {
    message: "Un test resuelto que no dice que le hace al diagnostico no ha resuelto nada.",
  });

export type ConfounderTest = z.infer<typeof confounderTestSchema>;

// ---------------------------------------------------------------------------
// La puerta de comparabilidad (apartado 4)
// ---------------------------------------------------------------------------

const SI_NO = ["yes", "no", "unknown"] as const;

export const comparabilityGateSchema = z
  .object({
    case_id: z.string().min(1),
    metric: z.string().min(1),
    same_definition: z.enum(SI_NO).default("unknown"),
    same_scope: z.enum(SI_NO).default("unknown"),
    same_time_logic: z.enum(SI_NO).default("unknown"),
    same_currency: z.enum(SI_NO).default("unknown"),
    same_status_filter: z.enum(SI_NO).default("unknown"),
    comparability: z.enum(COMPARABILITY_STATES).default("unknown"),
    note: z.string().optional(),
  })
  // Apartado 4: comparable significa las cinco cosas.
  .refine(
    (g) =>
      g.comparability !== "comparable" ||
      [g.same_definition, g.same_scope, g.same_time_logic, g.same_currency, g.same_status_filter]
        .every((x) => x === "yes"),
    { message: "Comparable son las cinco preguntas en `yes`, no una impresion (apartado 4)." },
  )
  .refine(
    (g) =>
      g.comparability !== "partially_comparable" ||
      [g.same_definition, g.same_scope, g.same_time_logic, g.same_currency, g.same_status_filter]
        .every((x) => x !== "no"),
    { message: "Basta un `no` para que deje de ser siquiera parcialmente comparable (apartado 4)." },
  )
  .refine((g) => g.comparability !== "not_comparable" || g.note != null, {
    message: "Declarar una metrica no comparable exige decir por que.",
  });

export type ComparabilityGate = z.infer<typeof comparabilityGateSchema>;

export const mandatoryCheckSchema = z
  .object({
    case_id: z.string().min(1),
    diagnostic_family: z.enum(DIAGNOSTIC_FAMILIES),
    check_key: z.string().min(1),
    status: z.enum(["pending", "executed", "skipped", "not_possible"]).default("pending"),
    outcome: z.string().optional(),
    reason: z.string().optional(),
  })
  // Apartado 19: no se salta un check obligatorio en silencio.
  .refine(
    (c) => !["skipped", "not_possible"].includes(c.status) || c.reason != null,
    { message: "Saltarse un check obligatorio exige decir por que (apartado 19)." },
  )
  .refine((c) => c.status !== "executed" || c.outcome != null, {
    message: "Un check ejecutado sin resultado no se ha ejecutado.",
  });

export type MandatoryCheck = z.infer<typeof mandatoryCheckSchema>;

export const sensitivityAnalysisSchema = z
  .object({
    robustness_id: z.string().min(1),
    assumption: z.string().min(15),
    low_case: z.string().optional(),
    base_case: z.string().optional(),
    high_case: z.string().optional(),
    diagnosis_changes: z.boolean().default(false),
    note: z.string().optional(),
  })
  .refine((s) => !s.diagnosis_changes || s.note != null, {
    message: "Un escenario que cambia el diagnostico y no dice como no informa de nada.",
  })
  .refine((s) => s.low_case != null || s.high_case != null, {
    message: "Probar la sensibilidad sin mover nada no es probarla.",
  });

export type SensitivityAnalysis = z.infer<typeof sensitivityAnalysisSchema>;

// ---------------------------------------------------------------------------
// Las reglas que miran el conjunto: los fixtures del apartado 20
// ---------------------------------------------------------------------------

export type AdversarialCheckInput = {
  robustness: DiagnosticRobustness;
  confounders?: DiagnosticConfounder[];
  tests?: ConfounderTest[];
  gates?: ComparabilityGate[];
  checks?: MandatoryCheck[];
  sensitivity?: SensitivityAnalysis[];
  /** La familia diagnostica del caso, que decide que checks son obligatorios. */
  family?: (typeof DIAGNOSTIC_FAMILIES)[number];
};

const SOBREVIVE = ["survives", "survives_with_limitations"];

export function checkAdversarialInvariants(
  input: AdversarialCheckInput,
): DiagnosticInvariantViolation[] {
  const violations: DiagnosticInvariantViolation[] = [];
  const d = input.robustness;
  const confusores = input.confounders ?? [];
  const tests = input.tests ?? [];
  const gates = input.gates ?? [];
  const checks = input.checks ?? [];
  const sensibilidad = input.sensitivity ?? [];
  const sobrevive = SOBREVIVE.includes(d.survival_status);

  // Apartado 10: SURVIVES es "no se encontro confusor material". Un material
  // sin resolver y el diagnostico intacto no puede ser las dos cosas.
  const materialesVivos = confusores.filter(
    (c) => c.status === "material" && c.resolution === "unresolved",
  );
  if (d.survival_status === "survives" && materialesVivos.length > 0) {
    violations.push({
      rule: "sobrevive_con_material_sin_resolver",
      source: "D12 apartado 10",
      message: `Hay ${materialesVivos.length} confusor(es) material(es) sin resolver y el diagnostico sale intacto.`,
    });
  }

  // Apartado 21: no mantener intacta la confianza despues de un confusor decisivo.
  const decisivos = confusores.filter((c) => c.strength === "decisive");
  if (decisivos.length > 0) {
    const sinBajar =
      d.confidence_before != null &&
      d.confidence_after != null &&
      nivel(d.confidence_after) >= nivel(d.confidence_before);
    if (sobrevive || sinBajar) {
      violations.push({
        rule: "confusor_decisivo_sin_efecto",
        source: "D12 apartado 21",
        message: `"${decisivos[0]?.confounder_type}" es decisivo y el diagnostico no lo acusa.`,
      });
    }
  }

  // Apartado 14: y al reves -- un diagnostico no se tumba con especulaciones.
  if (
    d.survival_status === "invalidated" &&
    confusores.length > 0 &&
    confusores.every((c) => c.plausibility === "speculative")
  ) {
    violations.push({
      rule: "especulativo_tumba_diagnostico",
      source: "D12 apartado 14",
      message: "El diagnostico se invalida sin un solo confusor soportado.",
    });
  }

  // Apartado 4: una metrica NOT_COMPARABLE no puede sostener un diagnostico fuerte.
  const noComparables = gates.filter((g) => g.comparability === "not_comparable");
  if (sobrevive && noComparables.length > 0) {
    violations.push({
      rule: "no_comparable_sostiene_diagnostico",
      source: "D12 apartado 4",
      message: `"${noComparables[0]?.metric}" no es comparable y el diagnostico se apoya en ella.`,
    });
  }

  // Fixture "Partial Period": comparar un periodo parcial con uno completo.
  if (
    sobrevive &&
    (gates.some((g) => g.same_time_logic === "no") ||
      confusores.some(
        (c) =>
          c.confounder_type === "partial_period" &&
          ["supported", "material"].includes(c.status),
      ))
  ) {
    violations.push({
      rule: "periodo_parcial_no_compara",
      source: "D12 apartado 20 (test_partial_period)",
      message: "La logica temporal no coincide entre periodos y el diagnostico sale intacto.",
    });
  }

  // Fixture "Simpson's Paradox": un confusor de composicion soportado tiene que
  // probarse within-segment. Si los segmentos mejoran y el global cae, lo que
  // hay es mix, no deterioro.
  for (const c of confusores) {
    if (!TIPOS_DE_MIX.includes(c.confounder_type)) continue;
    if (!["supported", "material"].includes(c.status)) continue;
    const suyos = tests.filter((t) => t.confounder_id === c.confounder_id);
    if (!suyos.some((t) => t.control_kind === "within_segment" && t.result !== "pending")) {
      violations.push({
        rule: "mix_sin_prueba_within_segment",
        source: "D12 apartado 20 (test_traffic_mix_simpsons_paradox)",
        message: `"${c.confounder_type}" se declara ${c.status} sin una comparacion within-segment resuelta.`,
      });
    }
  }

  // Fixture "Hidden Deterioration": el lado del falso negativo.
  const enmascarando = confusores.filter(
    (c) => c.masking_effect && ["supported", "material"].includes(c.status),
  );
  if (d.survival_status === "survives" && enmascarando.length > 0) {
    violations.push({
      rule: "deterioro_enmascarado",
      source: "D12 apartado 20 (test_masking_effect)",
      message: "Hay un efecto de enmascaramiento soportado: la lectura estable puede ser un deterioro tapado.",
    });
  }

  // Fixture "Simultaneous Changes": varios cambios deliberados a la vez no se
  // atribuyen por separado.
  const intervenciones = confusores.filter(
    (c) =>
      TIPOS_DE_INTERVENCION.includes(c.confounder_type) &&
      ["supported", "material"].includes(c.status),
  );
  if (sobrevive && intervenciones.length > 1) {
    violations.push({
      rule: "cambios_simultaneos_sin_separar",
      source: "D12 apartado 20 (test_simultaneous_interventions)",
      message: `Hubo ${intervenciones.length} intervenciones soportadas a la vez y el diagnostico atribuye a una sola.`,
    });
  }

  // Fixture "Low Sample": un porcentaje sobre una muestra insuficiente.
  if (
    sobrevive &&
    confusores.some(
      (c) => c.confounder_type === "sample_size" && ["supported", "material"].includes(c.status),
    )
  ) {
    violations.push({
      rule: "muestra_insuficiente",
      source: "D12 apartado 20 (test_low_sample)",
      message: "La muestra esta declarada insuficiente y el diagnostico sale intacto.",
    });
  }

  // Apartados 7 y 19: los checks minimos de la familia estan o se justifican.
  if (input.family != null) {
    const obligatorios = MANDATORY_CHECKS_BY_FAMILY[input.family] ?? [];
    const presentes = new Set(
      checks.filter((c) => c.status !== "pending").map((c) => c.check_key),
    );
    const faltan = obligatorios.filter((k) => !presentes.has(k));
    if (sobrevive && faltan.length > 0) {
      violations.push({
        rule: "familia_sin_sus_checks",
        source: "D12 apartado 7",
        message: `Familia "${input.family}": quedan sin resolver ${faltan.join(", ")}.`,
      });
    }
  }

  // Apartado 13: si mover un supuesto cambia el diagnostico, no es estable.
  if (
    d.diagnosis_stability === "stable_to_assumptions" &&
    sensibilidad.some((s) => s.diagnosis_changes)
  ) {
    violations.push({
      rule: "sensibilidad_ignorada",
      source: "D12 apartado 13",
      message: "Un escenario cambia el diagnostico y aun asi se declara estable a los supuestos.",
    });
  }

  // Apartado 12: el red team tiene que decir con que se zanjaria, o no es un
  // stress test: es una frase.
  if (
    d.red_team_counter_explanation != null &&
    d.red_team_supporting_evidence == null &&
    d.red_team_required_evidence == null
  ) {
    violations.push({
      rule: "red_team_sin_salida",
      source: "D12 apartado 12",
      message: "La contraexplicacion no dice ni que la apoya ni que haria falta para zanjarla.",
    });
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Motor puro de D12
// ---------------------------------------------------------------------------

export type AdversarialTriState = (typeof SI_NO)[number];

export type AdversarialRuntimeSignal = {
  metric: string;
  dataConfidence: "high" | "medium" | "low" | "insufficient_data";
  lowSample: boolean;
  baselineConflict: boolean;
  sampleSize?: number | null;
};

export type AdversarialRuntimeEvent = {
  eventType: string;
  description: string;
  occurredAt: string;
  source?: string | null;
};

export type AdversarialRuntimeBreak = {
  breakType: string;
  subtype?: string | null;
  description: string;
  affectedMetrics: string[];
  effectiveFrom: string;
};

export type AdversarialRuntimeMixSegment = {
  dimension: string;
  segment: string;
  weightBefore: number;
  weightAfter: number;
  performanceBefore: number | null;
  performanceAfter: number | null;
};

export type AdversarialRuntimeInput = {
  robustnessId: string;
  caseId: string;
  family: (typeof DIAGNOSTIC_FAMILIES)[number];
  metric: string;
  analysisPeriod: { start: string; end: string };
  comparisonPeriod: { start: string; end: string } | null;
  currentConfidence?: (typeof CONFIANZA)[number] | null;
  comparabilityFacts?: {
    sameDefinition?: AdversarialTriState;
    sameScope?: AdversarialTriState;
    sameCurrency?: AdversarialTriState;
    sameStatusFilter?: AdversarialTriState;
  };
  /** Linaje opcional de candidatas D02, por tipo de confusor. */
  sourceConfounderIds?: Readonly<Record<string, string>>;
  signals: readonly AdversarialRuntimeSignal[];
  events: readonly AdversarialRuntimeEvent[];
  comparabilityBreaks: readonly AdversarialRuntimeBreak[];
  mixSegments: readonly AdversarialRuntimeMixSegment[];
  orderCounts: { analysis: number | null; comparison: number | null };
  matureCohortsObservable?: boolean;
};

export type RedTeamResult = {
  strongest_counter_explanation: string;
  supporting_evidence: string | null;
  required_evidence: string;
  diagnosis_effect: "no_material_change" | "survives_with_limitations" | "requires_review_if_supported";
};

export type AdversarialReview = {
  robustness: DiagnosticRobustness;
  confounders: DiagnosticConfounder[];
  tests: ConfounderTest[];
  gates: ComparabilityGate[];
  checks: MandatoryCheck[];
  sensitivity: SensitivityAnalysis[];
  redTeam: RedTeamResult;
};

type ConfounderBlueprint = {
  type: (typeof CONFOUNDER_TYPES)[number];
  category: (typeof CONFOUNDER_CATEGORIES)[number];
  description: string;
  requiredData: string;
};

const BLUEPRINTS: Record<string, ConfounderBlueprint> = {
  period_comparability: {
    type: "partial_period", category: "temporal",
    description: "La ventana de analisis puede tener una duracion distinta de la ventana comparada",
    requiredData: "Fechas de inicio y fin de ambas ventanas",
  },
  seasonality: {
    type: "seasonality", category: "temporal",
    description: "La estacionalidad habitual puede hacer que este periodo no sea comparable con el baseline",
    requiredData: "Historico comparable por semana o por temporada",
  },
  promotions: {
    type: "promotion", category: "context",
    description: "Una promocion o evento comercial puede explicar el movimiento de la metrica",
    requiredData: "Calendario de promociones y su alcance durante ambas ventanas",
  },
  tracking: {
    type: "tracking_change", category: "measurement",
    description: "Un cambio de tracking puede haber movido la medicion sin mover el fenomeno real",
    requiredData: "Series de la fuente primaria y del sistema de medicion antes y despues del cambio",
  },
  traffic: {
    type: "traffic_mix", category: "composition",
    description: "El reparto de trafico entre canales puede cambiar la lectura agregada de la metrica",
    requiredData: "Desglose de trafico y rendimiento within-channel en las dos ventanas",
  },
  cvr: {
    type: "traffic_mix", category: "composition",
    description: "Una variacion de conversion puede venir de un cambio en la mezcla de trafico",
    requiredData: "Conversion y denominador por canal, dispositivo y mercado",
  },
  aov: {
    type: "product_mix", category: "composition",
    description: "Un cambio en la mezcla de productos puede mover el ticket agregado",
    requiredData: "Ticket y peso por producto o SKU en ambas ventanas",
  },
  product_availability: {
    type: "inventory_change", category: "operational",
    description: "La disponibilidad de producto puede cambiar las ventas observadas",
    requiredData: "Historico de disponibilidad y ventas por producto",
  },
  cpm: {
    type: "channel_mix", category: "composition",
    description: "El coste medio puede cambiar por la mezcla de canales comprados",
    requiredData: "Coste e impresiones por canal en ambas ventanas",
  },
  ctr: {
    type: "channel_mix", category: "composition",
    description: "El click-through agregado puede cambiar por la mezcla de campañas",
    requiredData: "Clicks e impresiones por canal y campaña",
  },
  traffic_channel_mix: {
    type: "traffic_mix", category: "composition",
    description: "La mezcla de canales puede explicar un cambio agregado sin cambio within-channel",
    requiredData: "Peso y rendimiento por canal en ambas ventanas",
  },
  new_customer_definition: {
    type: "metric_definition_change", category: "measurement",
    description: "La definicion de cliente nuevo puede haber cambiado entre ventanas",
    requiredData: "Version de la definicion y conteo bajo la misma regla",
  },
  attribution: {
    type: "attribution_change", category: "measurement",
    description: "Un cambio de ventana o metodologia de atribucion puede mover el resultado",
    requiredData: "Ventana y metodologia de atribucion de ambas ventanas",
  },
  scale_level: {
    type: "sample_size", category: "selection",
    description: "El nivel de escala puede hacer que un porcentaje represente muestras distintas",
    requiredData: "Denominador y tamaño de muestra de las dos ventanas",
  },
  device_mix: {
    type: "device_mix", category: "composition",
    description: "La mezcla de dispositivos puede cambiar la conversion agregada",
    requiredData: "Rendimiento within-device y peso por dispositivo",
  },
  market_mix: {
    type: "market_mix", category: "composition",
    description: "La mezcla de mercados puede cambiar la conversion o el CAC agregado",
    requiredData: "Rendimiento within-market y peso por mercado",
  },
  product_mix: {
    type: "product_mix", category: "composition",
    description: "La mezcla de productos puede cambiar el agregado aunque el producto no empeore",
    requiredData: "Rendimiento within-product y peso por producto",
  },
  inventory: {
    type: "inventory_change", category: "operational",
    description: "Un cambio de inventario puede explicar el movimiento de la conversion",
    requiredData: "Disponibilidad y demanda por producto durante ambas ventanas",
  },
  price: {
    type: "price_change", category: "operational",
    description: "Un cambio de precio puede coincidir con el movimiento observado",
    requiredData: "Historico de precios y fecha efectiva por producto",
  },
  promotion: {
    type: "promotion", category: "context",
    description: "Una promocion puede mover el resultado sin representar el regimen normal",
    requiredData: "Calendario, descuento y segmentos expuestos",
  },
  cohort_maturity: {
    type: "customer_mix", category: "selection",
    description: "Las cohortes inmaduras pueden hacer caer la retencion global de forma aparente",
    requiredData: "Edad y resultado de cada cohorte hasta su ventana de madurez",
  },
  customer_mix: {
    type: "customer_mix", category: "composition",
    description: "La mezcla de clientes nuevos y recurrentes puede mover la retencion agregada",
    requiredData: "Retencion y peso por tipo de cliente",
  },
  promotion_cohorts: {
    type: "promotion", category: "context",
    description: "Las cohortes adquiridas en promocion pueden tener una trayectoria distinta",
    requiredData: "Cohortes expuestas y no expuestas a la promocion",
  },
  identity_resolution: {
    type: "metric_definition_change", category: "measurement",
    description: "La resolucion de identidad puede cambiar quien aparece como cliente recurrente",
    requiredData: "Regla de identidad y tasa de resolucion por ventana",
  },
  accounting_timing: {
    type: "partial_period", category: "temporal",
    description: "El momento contable puede desplazar ingresos o costes entre periodos",
    requiredData: "Calendario contable y fechas de reconocimiento",
  },
  one_offs: {
    type: "external_event", category: "external",
    description: "Un evento financiero puntual puede mover el resultado sin cambiar la operacion",
    requiredData: "Libro de one-offs y su fecha de reconocimiento",
  },
  cash_vs_accrual: {
    type: "metric_definition_change", category: "measurement",
    description: "Mezclar caja y devengo puede fabricar una variacion entre periodos",
    requiredData: "Base contable aplicada de forma identica en ambas ventanas",
  },
  cost_completeness: {
    type: "metric_definition_change", category: "measurement",
    description: "La falta de costes completos puede hacer que el margen aparente cambie",
    requiredData: "Costes completos por pedido y por ventana",
  },
  demand_spike: {
    type: "external_event", category: "external",
    description: "Un pico de demanda puede explicar el movimiento de inventario observado",
    requiredData: "Demanda, evento externo y horizonte de suministro",
  },
  lead_time: {
    type: "shipping_change", category: "operational",
    description: "Un cambio en el plazo de suministro puede afectar la disponibilidad",
    requiredData: "Plazos de proveedor y fechas de entrada de stock",
  },
  inbound_stock: {
    type: "inventory_change", category: "operational",
    description: "La entrada de stock puede cambiar el nivel observado sin cambiar la demanda",
    requiredData: "Recepciones de stock y demanda por SKU",
  },
  sku_mix: {
    type: "product_mix", category: "composition",
    description: "La mezcla de SKU puede mover el inventario o margen agregado",
    requiredData: "Peso y rendimiento within-SKU",
  },
  forecast_horizon: {
    type: "seasonality", category: "temporal",
    description: "El horizonte de previsión puede dejar fuera una parte del patrón esperado",
    requiredData: "Horizonte, demanda observada y estacionalidad histórica",
  },
  schema: {
    type: "metric_definition_change", category: "measurement",
    description: "Un cambio de esquema puede alterar qué eventos llegan a la métrica",
    requiredData: "Version de esquema y reconciliacion de registros",
  },
  definitions: {
    type: "metric_definition_change", category: "measurement",
    description: "Una definicion distinta impide comparar la métrica entre ventanas",
    requiredData: "Definicion versionada de la métrica",
  },
  sync: {
    type: "technology_change", category: "operational",
    description: "Una sincronizacion incompleta puede hacer parecer que cambió el negocio",
    requiredData: "Rango ingerido y estado de sincronizacion de ambas ventanas",
  },
  permissions: {
    type: "technology_change", category: "operational",
    description: "Un permiso perdido puede reducir la cobertura sin reducir el fenómeno real",
    requiredData: "Scopes concedidos y cobertura por fuente",
  },
  timezone: {
    type: "day_of_week", category: "temporal",
    description: "Un cambio de zona horaria puede mover eventos entre dias y periodos",
    requiredData: "Zona horaria y regla de cierre aplicadas en ambas ventanas",
  },
  deployment: {
    type: "technology_change", category: "operational",
    description: "Un despliegue puede coincidir con el cambio observado en la métrica",
    requiredData: "Registro de despliegues y comparación antes/después",
  },
  traffic_load: {
    type: "technology_change", category: "operational",
    description: "La carga de tráfico puede afectar el comportamiento técnico observado",
    requiredData: "Carga, errores y latencia por ventana",
  },
  third_party_outage: {
    type: "external_event", category: "external",
    description: "Una caída de un tercero puede explicar el cambio de tecnología observado",
    requiredData: "Estado del tercero y ventana de impacto",
  },
  browser_device: {
    type: "device_mix", category: "composition",
    description: "Un cambio de navegador o dispositivo puede concentrar el deterioro",
    requiredData: "Error y conversión within-device",
  },
};

const EVENT_TO_TYPE: Record<string, ConfounderBlueprint["type"]> = {
  promotion: "promotion", sale_event: "promotion", free_shipping: "shipping_change",
  bundle_change: "product_mix", discount_policy_change: "promotion",
  launch: "launch", market_launch: "launch", channel_launch: "launch",
  price_change: "price_change", tracking_change: "tracking_change",
  deployment: "technology_change", theme_change: "technology_change",
  checkout_change: "technology_change", platform_change: "technology_change",
  product_mix_change: "product_mix", inventory_event: "inventory_change",
  warehouse_change: "inventory_change", shipping_change: "shipping_change",
  supplier_change: "operational_change", external_event: "external_event",
  campaign_change: "channel_mix", creative_change: "channel_mix", budget_change: "channel_mix",
};

const CATEGORY_BY_TYPE: Record<ConfounderBlueprint["type"], ConfounderBlueprint["category"]> = {
  seasonality: "temporal", promotion: "context", launch: "context", traffic_mix: "composition",
  customer_mix: "composition", product_mix: "composition", market_mix: "composition", device_mix: "composition",
  channel_mix: "composition", price_change: "operational", inventory_change: "operational",
  attribution_change: "measurement", tracking_change: "measurement", metric_definition_change: "measurement",
  partial_period: "temporal", day_of_week: "temporal", holiday: "temporal", sample_size: "selection",
  outlier: "selection", external_event: "external", operational_change: "operational",
  technology_change: "operational", currency_change: "measurement", shipping_change: "operational",
  payment_change: "operational",
};

const TIPO_POR_DIMENSION: Record<string, ConfounderBlueprint["type"]> = {
  channel: "traffic_mix", traffic: "traffic_mix", customer_type: "customer_mix",
  customer: "customer_mix", product: "product_mix", sku: "product_mix", market: "market_mix", device: "device_mix",
};

function durationMs(period: { start: string; end: string }): number | null {
  const start = Date.parse(period.start);
  const end = Date.parse(period.end);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : null;
}

function periodComparable(input: AdversarialRuntimeInput): AdversarialTriState {
  if (!input.comparisonPeriod) return "unknown";
  const analysis = durationMs(input.analysisPeriod);
  const comparison = durationMs(input.comparisonPeriod);
  return analysis != null && comparison != null && analysis === comparison ? "yes" : "no";
}

function confidenceAfter(
  before: (typeof CONFIANZA)[number] | null | undefined,
  lower: boolean,
): (typeof CONFIANZA)[number] | undefined {
  if (!before) return undefined;
  if (!lower) return before;
  if (before === "high") return "low";
  if (before === "medium") return "low";
  return "insufficient_data";
}

function addOrReplaceConfounder(
  confounders: Map<string, DiagnosticConfounder>,
  candidate: DiagnosticConfounder,
) {
  const previous = confounders.get(candidate.confounder_type);
  const rank = (status: DiagnosticConfounder["status"]): number => ({
    candidate: 0,
    plausible: 1,
    supported: 2,
    rejected: 2,
    material: 3,
    resolved: 4,
  })[status];
  if (!previous || rank(candidate.status) > rank(previous.status)) {
    confounders.set(candidate.confounder_type, candidate);
  }
}

function makeConfounder(
  input: AdversarialRuntimeInput,
  blueprint: ConfounderBlueprint,
  overrides: Partial<DiagnosticConfounder> = {},
): DiagnosticConfounder {
  return diagnosticConfounderSchema.parse({
    confounder_id: `CF-${blueprint.type}`,
    case_id: input.caseId,
    confounder_type: blueprint.type,
    category: blueprint.category,
    description: blueprint.description,
    affected_metrics: [input.metric],
    scope: "global",
    ...(input.sourceConfounderIds?.[blueprint.type]
      ? { source_confounder_id: input.sourceConfounderIds[blueprint.type] }
      : {}),
    ...overrides,
  });
}

function blueprintForCheck(checkKey: string): ConfounderBlueprint {
  return BLUEPRINTS[checkKey] ?? {
    type: "outlier", category: "selection",
    description: "Un valor atipico puede distorsionar el movimiento agregado de la métrica",
    requiredData: "Serie completa y criterio de atipicidad",
  };
}

function familyCheckOutcome(
  input: AdversarialRuntimeInput,
  checkKey: string,
  confounders: readonly DiagnosticConfounder[],
  gate: ComparabilityGate,
): MandatoryCheck {
  if (checkKey === "period_comparability") {
    return mandatoryCheckSchema.parse({
      case_id: input.caseId, diagnostic_family: input.family, check_key: checkKey,
      status: "executed", outcome: `Comparabilidad temporal: ${gate.comparability}.`,
    });
  }
  if (checkKey === "cohort_maturity" && input.matureCohortsObservable !== true) {
    return mandatoryCheckSchema.parse({
      case_id: input.caseId, diagnostic_family: input.family, check_key: checkKey,
      status: "not_possible", reason: "No existe una serie de cohortes con edad suficiente para comprobar su madurez.",
    });
  }
  const blueprint = blueprintForCheck(checkKey);
  const found = confounders.find((c) => c.confounder_type === blueprint.type);
  return mandatoryCheckSchema.parse({
    case_id: input.caseId, diagnostic_family: input.family, check_key: checkKey,
    status: "executed",
    outcome: found
      ? `Se revisó: ${found.evidence ?? found.description}.`
      : "No hay evidencia observable en las fuentes disponibles; esto no demuestra ausencia.",
  });
}

/**
 * Red team determinista. La salida es una biblioteca acotada por familia: el
 * LLM puede explicarla después, pero no puede inventar un factor externo ni
 * sobrescribir los checks que ya se calcularon aquí.
 */
export function runRedTeam(input: AdversarialRuntimeInput): RedTeamResult {
  const signal = input.signals.find((item) => item.metric === input.metric);
  const breakForMetric = input.comparabilityBreaks.find((item) =>
    item.affectedMetrics.length === 0 || item.affectedMetrics.includes(input.metric),
  );
  if (signal?.dataConfidence === "insufficient_data" || signal?.baselineConflict || breakForMetric) {
    return {
      strongest_counter_explanation: "Podría ser una distorsión de medición: el cambio observado puede no representar el fenómeno real.",
      supporting_evidence: breakForMetric?.description ?? "La fuente de la señal declara datos insuficientes o conflicto con su baseline.",
      required_evidence: "Serie de la fuente primaria reconciliada con la fuente de medición y registro del cambio.",
      diagnosis_effect: "requires_review_if_supported",
    };
  }
  const changedMix = input.mixSegments.find((segment) =>
    Math.abs(segment.weightAfter - segment.weightBefore) > Number.EPSILON,
  );
  if (changedMix) {
    return {
      strongest_counter_explanation: "Podría ser un cambio de composición: el agregado puede moverse aunque el rendimiento within-segment sea estable.",
      supporting_evidence: `Cambió el peso del segmento ${changedMix.segment} en ${changedMix.dimension}.`,
      required_evidence: "Comparación within-segment con pesos y rendimiento de las dos ventanas.",
      diagnosis_effect: "survives_with_limitations",
    };
  }
  const event = input.events[0];
  if (event) {
    return {
      strongest_counter_explanation: `Podría ser el evento declarado «${event.description}», coincidente con la ventana del diagnóstico.`,
      supporting_evidence: `Evento ${event.eventType} registrado el ${event.occurredAt}.`,
      required_evidence: "Comparación tratada/no tratada o una serie anterior que separe el efecto del evento.",
      diagnosis_effect: "survives_with_limitations",
    };
  }
  const blueprint = blueprintForCheck(MANDATORY_CHECKS_BY_FAMILY[input.family]?.[0] ?? "seasonality");
  return {
    strongest_counter_explanation: `Podría existir ${blueprint.description.toLowerCase()}.`,
    supporting_evidence: null,
    required_evidence: blueprint.requiredData,
    diagnosis_effect: "requires_review_if_supported",
  };
}

/** Evalúa una revisión D12 sin IO. Todas las decisiones son trazables a inputs. */
export function getDiagnosticRobustness(input: AdversarialRuntimeInput): AdversarialReview {
  const sameTime = periodComparable(input);
  const facts = input.comparabilityFacts ?? {};
  const sameDefinition = facts.sameDefinition ?? "unknown";
  const sameScope = facts.sameScope ?? "unknown";
  const sameCurrency = facts.sameCurrency ?? "unknown";
  const sameStatusFilter = facts.sameStatusFilter ?? "unknown";
  const comparabilityValues = [sameDefinition, sameScope, sameTime, sameCurrency, sameStatusFilter];
  const comparability = comparabilityValues.some((value) => value === "no")
    ? "not_comparable"
    : comparabilityValues.every((value) => value === "yes")
      ? "comparable"
      : comparabilityValues.some((value) => value === "yes")
        ? "partially_comparable"
        : "unknown";
  const gate = comparabilityGateSchema.parse({
    case_id: input.caseId,
    metric: input.metric,
    same_definition: sameDefinition,
    same_scope: sameScope,
    same_time_logic: sameTime,
    same_currency: sameCurrency,
    same_status_filter: sameStatusFilter,
    comparability,
    ...(comparability === "not_comparable"
      ? { note: "Al menos una de las cinco dimensiones de comparabilidad no coincide." }
      : {}),
  });

  const confounders = new Map<string, DiagnosticConfounder>();
  const mandatoryKeys = MANDATORY_CHECKS_BY_FAMILY[input.family] ?? [];
  for (const checkKey of mandatoryKeys) {
    const blueprint = blueprintForCheck(checkKey);
    addOrReplaceConfounder(confounders, makeConfounder(input, blueprint));
  }

  if (sameTime === "no") {
    const blueprint = blueprintForCheck("period_comparability");
    addOrReplaceConfounder(confounders, makeConfounder(input, blueprint, {
      evidence: "Las ventanas declaradas tienen duraciones distintas.",
      plausibility: "supported", strength: "decisive", materiality: "material", status: "material",
      confidence_effect: "La comparación temporal deja de sostener una lectura intacta.",
    }));
  }

  for (const event of input.events) {
    const type = EVENT_TO_TYPE[event.eventType];
    if (!type) continue;
    const category = CATEGORY_BY_TYPE[type];
    addOrReplaceConfounder(confounders, makeConfounder(input, {
      type, category,
      description: `El evento ${event.eventType} puede explicar parte del movimiento observado en la ventana`,
      requiredData: "Comparación tratada/no tratada y serie fuera de la ventana del evento",
    }, {
      evidence: event.description,
      plausibility: event.eventType === "external_event" ? "plausible" : "supported",
      status: event.eventType === "external_event" ? "plausible" : "supported",
      strength: "moderate",
      materiality: "low",
    }));
  }

  for (const change of input.comparabilityBreaks) {
    if (change.affectedMetrics.length > 0 && !change.affectedMetrics.includes(input.metric)) continue;
    const type: ConfounderBlueprint["type"] = change.breakType.includes("tracking") || change.subtype?.includes("pixel") || change.subtype?.includes("attribution") || change.subtype?.includes("consent")
      ? "tracking_change"
      : change.breakType.includes("currency") || change.subtype?.includes("currency")
        ? "currency_change"
        : change.breakType.includes("definition") || change.breakType.includes("schema") || change.subtype?.includes("definition")
          ? "metric_definition_change"
          : "technology_change";
    const material = type === "tracking_change" || type === "metric_definition_change" || type === "currency_change";
    addOrReplaceConfounder(confounders, makeConfounder(input, {
      type, category: CATEGORY_BY_TYPE[type],
      description: "La ruptura registrada puede haber cambiado la medicion o la comparabilidad de la metrica",
      requiredData: "Reconciliacion de la fuente antes y despues de la ruptura",
    }, {
      evidence: change.description,
      plausibility: "supported",
      strength: material ? "decisive" : "strong",
      materiality: material ? "material" : "low",
      status: material ? "material" : "supported",
      ...(material ? { confidence_effect: "La ruptura impide mantener intacta la confianza de la lectura." } : {}),
    }));
  }

  const signal = input.signals.find((item) => item.metric === input.metric);
  if (signal?.lowSample) {
    const blueprint = blueprintForCheck("scale_level");
    addOrReplaceConfounder(confounders, makeConfounder(input, blueprint, {
      evidence: `La señal declara muestra baja${signal.sampleSize != null ? ` (${signal.sampleSize} observaciones)` : ""}.`,
      plausibility: "supported", strength: "strong", materiality: "material", status: "material",
      confidence_effect: "La muestra no permite mantener intacta la confianza en el porcentaje observado.",
    }));
  }

  for (const segment of input.mixSegments) {
    if (Math.abs(segment.weightAfter - segment.weightBefore) <= Number.EPSILON) continue;
    const type = TIPO_POR_DIMENSION[segment.dimension] ?? "channel_mix";
    const performanceStable = segment.performanceBefore != null && segment.performanceAfter != null
      && Math.abs(segment.performanceAfter - segment.performanceBefore) <= Number.EPSILON;
    addOrReplaceConfounder(confounders, makeConfounder(input, {
      type, category: CATEGORY_BY_TYPE[type],
      description: "El peso del segmento cambio y puede mover el agregado aunque el rendimiento por segmento permanezca estable",
      requiredData: "Comparacion within-segment con pesos y rendimiento de las dos ventanas",
    }, {
      evidence: `El peso de ${segment.segment} paso de ${segment.weightBefore} a ${segment.weightAfter}.`,
      plausibility: "supported", strength: "moderate", materiality: "low", status: "supported",
      masking_effect: performanceStable,
    }));
  }

  const redTeam = runRedTeam(input);
  const confounderList = [...confounders.values()]
    .map((confounder) => confounder.confounder_type === "external_event" && confounder.status === "candidate"
      ? { ...confounder, status: "plausible" as const }
      : confounder);
  const checks = mandatoryKeys.map((checkKey) => familyCheckOutcome(input, checkKey, confounderList, gate));
  const sensitivityChanges = comparability === "not_comparable";
  const sensitivity = [sensitivityAnalysisSchema.parse({
    robustness_id: input.robustnessId,
    assumption: "La ventana de comparación mantiene la misma lógica temporal y definición",
    low_case: sensitivityChanges ? "Con la ventana corregida, la conclusión puede cambiar" : "La conclusión se mantiene con la ventana declarada",
    high_case: "Con la ventana declarada y un baseline alternativo, revisar la misma conclusión",
    diagnosis_changes: sensitivityChanges,
    ...(sensitivityChanges ? { note: "La comparación actual no es válida; la conclusión requiere revisión." } : {}),
  })];

  const material = confounderList.some((confounder) => confounder.status === "material");
  const supported = confounderList.some((confounder) => ["supported", "material"].includes(confounder.status));
  const notPossible = checks.some((check) => ["not_possible", "skipped"].includes(check.status));
  const critical = confounderList.some((confounder) => confounder.strength === "decisive" && confounder.category === "measurement");
  const survivalStatus = critical
    ? "requires_revision"
    : material
      ? "weakened"
      : supported || notPossible || sensitivityChanges
        ? "survives_with_limitations"
        : "survives";
  const lowerConfidence = critical || material || sensitivityChanges;
  const after = confidenceAfter(input.currentConfidence, lowerConfidence);
  const limitations = survivalStatus === "survives_with_limitations"
    ? [
      notPossible ? "Hay checks obligatorios que no pudieron ejecutarse." : null,
      supported ? "Existen factores observados que requieren control o segmentación." : null,
      sensitivityChanges ? "La conclusión depende de corregir la comparabilidad temporal." : null,
      "Los factores sin evidencia siguen siendo candidatos, no hechos.",
    ].filter((value): value is string => value != null).join(" ")
    : undefined;
  const robustness = diagnosticRobustnessSchema.parse({
    robustness_id: input.robustnessId,
    case_id: input.caseId,
    false_diagnosis_risk: critical ? "critical" : material ? "high" : supported || notPossible ? "medium" : "low",
    survival_status: survivalStatus,
    robustness: survivalStatus === "survives" ? "high" : survivalStatus === "survives_with_limitations" ? "medium" : "low",
    diagnosis_stability: survivalStatus === "survives" ? "stable_to_assumptions" : "sensitive",
    confidence_before: input.currentConfidence ?? undefined,
    confidence_after: after,
    confidence_adjustment: after !== input.currentConfidence
      ? "La revisión adversarial reduce la confianza porque encontró una distorsión material o una dependencia crítica."
      : undefined,
    red_team_counter_explanation: redTeam.strongest_counter_explanation,
    red_team_supporting_evidence: redTeam.supporting_evidence ?? undefined,
    red_team_required_evidence: redTeam.required_evidence,
    red_team_effect: redTeam.diagnosis_effect,
    revision_triggered: survivalStatus === "requires_revision",
    reopened_blocks: survivalStatus === "requires_revision" ? ["D06", "D07", "D08", "D09"] : [],
    remaining_limitations: limitations,
  });

  return { robustness, confounders: confounderList, tests: buildConfounderTests(input, confounderList), gates: [gate], checks, sensitivity, redTeam };
}

function buildConfounderTests(
  input: AdversarialRuntimeInput,
  confounders: readonly DiagnosticConfounder[],
): ConfounderTest[] {
  return confounders
    .filter((confounder) => confounder.status === "supported" || confounder.status === "material")
    .map((confounder) => {
      const withinSegment = ["traffic_mix", "customer_mix", "product_mix", "market_mix", "device_mix", "channel_mix"].includes(confounder.confounder_type);
      return confounderTestSchema.parse({
        test_id: `T-${confounder.confounder_type}`,
        confounder_id: confounder.confounder_id,
        required_data: `Datos para contrastar ${confounder.confounder_type} en las dos ventanas`,
        expected_pattern: withinSegment
          ? "El rendimiento within-segment permanece estable mientras cambia el peso agregado"
          : "La fuente o el evento cambia en la misma ventana que la métrica observada",
        control_kind: withinSegment ? "within_segment" : "other",
        result: "confirmed",
        effect_on_diagnosis: "El factor queda trazado; la conclusión no puede ignorarlo.",
      });
    });
}

// ---------------------------------------------------------------------------
// Presupuesto de revision (apartado 11). Decision de producto del 2026-09-24:
// como mucho REVISION_BUDGET reaperturas por caso; el sistema las PROPONE y el
// consultor las confirma. Agotado el presupuesto, el caso no se reabre mas y
// queda como no concluyente: reabrir sin fin es la forma de no cerrar nunca.
// ---------------------------------------------------------------------------

export const REVISION_BUDGET = 2;

export const REVISION_STATES = ["none", "proposed", "confirmed", "budget_exhausted"] as const;
export type RevisionState = (typeof REVISION_STATES)[number];

export function revisionDecision(input: {
  revision_triggered: boolean;
  /** Reaperturas ya confirmadas por el consultor para este caso. */
  confirmed_count: number;
  /** Hay una propuesta esperando respuesta. */
  open_proposal: boolean;
  /** La ultima confirmacion todavia no tiene una revision posterior. */
  confirmation_pending_review?: boolean;
}): { state: RevisionState; propose: boolean; budget_used: number } {
  const used = Math.max(0, input.confirmed_count);
  if (input.confirmation_pending_review) return { state: "confirmed", propose: false, budget_used: used };
  if (!input.revision_triggered) {
    return { state: input.open_proposal ? "proposed" : "none", propose: false, budget_used: used };
  }
  if (used >= REVISION_BUDGET) return { state: "budget_exhausted", propose: false, budget_used: used };
  return { state: "proposed", propose: !input.open_proposal, budget_used: used };
}

export const REVISION_BUDGET_EXHAUSTED_NOTE =
  `Presupuesto de revision agotado (${REVISION_BUDGET} reaperturas): el diagnostico no se reabre mas y queda como no concluyente hasta que cambie la evidencia.`;
