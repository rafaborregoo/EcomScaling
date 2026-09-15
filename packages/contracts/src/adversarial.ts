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
