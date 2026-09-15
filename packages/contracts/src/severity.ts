/**
 * FASE 3 / D10 — Severidad e impacto.
 *
 * Fuentes: `02-contratos-IA/d10-requisitos-contrato-severidad-impacto.md` (29 apartados),
 * `04-policies-guardrails/d10-guardrails-severidad-impacto.md` (56 guardrails),
 * `03-runtime/d10-flujo-evaluacion-severidad-impacto.md`,
 * `06-tenant-context/d10-contexto-severidad-impacto.md`,
 * `05-experience-learning/d10-memoria-severidad-impacto.md`.
 *
 * El primer bloque de la fase que puede ordenar algo, y por eso el que hereda
 * todas las fronteras que D05 a D09 han ido guardando. Mide cuanto dano hay.
 * **No decide que se ataca primero** (guardrails 3, 46, 47 y 48).
 *
 * TRES AUSENCIAS GARANTIZADAS, CADA UNA CON SU TEST:
 *
 * 1. No hay `priority`, `recommended_action`, `playbook`, `effort` ni
 *    `intervention_order`. Donde D09 no tenia sitio para una persona, D10 no
 *    tiene sitio para una decision.
 * 2. No hay ninguna columna de probabilidad numerica. `likelihood` es
 *    cualitativa porque el guardrail 29 prohibe inventar un "13,7 %" sin
 *    modelo calibrado, y la garantia es que el numero no cabe.
 * 3. No hay donde escribir el porcentaje de cambio de una metrica. Los
 *    guardrails 9 y 10 dicen que la magnitud no define la gravedad; la
 *    magnitud vive en D05 y aqui hay que declarar exposicion, impacto y
 *    colchon.
 */
import { z } from "zod";

import {
  DIAGNOSTIC_SEVERITIES,
  DIAGNOSTIC_TRAJECTORIES,
  type DiagnosticInvariantViolation,
} from "./diagnostics.js";
import { DEFINITIVE_LANGUAGE, REVERSIBILITY } from "./root-cause.js";

/**
 * Apartado 2. Los seis de D00 mas `unknown`, que en D10 es una respuesta y no
 * un hueco: el guardrail 51 dice que el impacto sobre el negocio puede quedar
 * en UNKNOWN cuando lo que falla es la medicion.
 */
export const SEVERITY_LEVELS = [...DIAGNOSTIC_SEVERITIES, "unknown"] as const;

/** Orden para comparar, no para puntuar. `unknown` no se compara. */
const ORDEN: Record<string, number> = {
  info: 0, low: 1, moderate: 2, high: 3, critical: 4, business_threat: 5,
};

/** Apartado 4. */
export const IMPACT_DIMENSIONS = [
  "revenue", "contribution", "cash", "customer", "operations",
  "brand", "strategic", "continuity", "data",
] as const;

/** Apartado 5. */
export const IMPACT_TIMINGS = ["realized", "ongoing", "potential", "projected"] as const;

/** Apartado 6. Las cuatro capas que los guardrails 19 a 21 prohiben mezclar. */
export const IMPACT_EVIDENCE_TYPES = ["observed", "estimated", "inferred", "forecast"] as const;

/** Apartado 20. */
export const QUANTIFICATION_QUALITIES = [
  "exact", "estimated", "range", "directional", "unknown",
] as const;

/**
 * Guardrails 6, 32, 43 y 44. Cinco cosas que se suman mal entre si: lo perdido,
 * lo que se sigue perdiendo, lo que esta en riesgo, lo que se deja de ganar y
 * lo que cuesta de mas.
 */
export const IMPACT_NATURES = [
  "realized_loss", "ongoing_loss", "at_risk", "opportunity_cost",
  "cost_increase", "exposure_only",
] as const;

/**
 * Guardrails 29 y 30. **Cualitativa a proposito.** No hay una variante numerica
 * de esto en ninguna parte del bloque: un "13,7 %" inventado suena mas serio
 * que un "medium" honesto, y es peor.
 */
export const LIKELIHOODS = ["low", "medium", "high", "unknown"] as const;

/** Apartado 13. Elegir mal el denominador es la forma mas comun de exagerar. */
export const EXPOSURE_DENOMINATORS = [
  "revenue", "contribution", "spend", "orders", "customers", "traffic",
  "inventory_value", "other",
] as const;

/** Apartado 14. */
export const PROPAGATION_KINDS = ["direct", "second_order", "cascade", "systemic"] as const;

/**
 * Apartado 17 y guardrail 7. **No comparte ni un valor con `REVERSIBILITY`**, a
 * proposito: que la causa se arregle en diez minutos no devuelve los pedidos
 * que no se hicieron.
 */
export const RECOVERABILITY = [
  "fully_recoverable", "partially_recoverable", "not_recoverable", "unknown",
] as const;

/** Apartado 25. */
export const ABSORPTION_CAPACITY = ["strong", "moderate", "thin", "none", "unknown"] as const;

/** Guardrail 11. `BUSINESS_THREAT` solo se reserva para estas cinco cosas. */
export const THREAT_KINDS = [
  "continuity", "liquidity", "ability_to_transact", "customer_trust", "legal_operational",
] as const;

/** Apartado 24. */
export const BUFFER_TYPES = [
  "cash", "safety_stock", "inventory_cover", "warehouse_capacity", "spare_capacity",
  "backup_provider", "alternate_supplier", "alternate_channel", "technical_redundancy",
  "creative_inventory",
] as const;

export const BUFFER_STATES = ["intact", "consuming", "thin", "exhausted", "unknown"] as const;

/** Guardrail 55. Un insumo de escalado, no una politica de aviso (56). */
export const ESCALATION_SIGNALS = ["none", "escalating", "sustained", "de_escalating"] as const;

const CONFIANZA = ["high", "medium", "low", "insufficient"] as const;

// ---------------------------------------------------------------------------
// La evaluacion de severidad
// ---------------------------------------------------------------------------

export const severityAssessmentFields = z.object({
  assessment_id: z.string().min(1),
  case_id: z.string().min(1),
  /** Apartado 91 del corpus: la severidad siempre lo es respecto de un target. */
  target: z.string().min(1),
  scope: z.string().default("business"),

  /** Apartado 3: cinco severidades, no una. */
  acute_severity: z.enum(SEVERITY_LEVELS).default("unknown"),
  cumulative_severity: z.enum(SEVERITY_LEVELS).default("unknown"),
  forward_risk_severity: z.enum(SEVERITY_LEVELS).default("unknown"),
  structural_severity: z.enum(SEVERITY_LEVELS).default("unknown"),
  overall_severity: z.enum(SEVERITY_LEVELS).default("unknown"),

  /** Apartado 27 y guardrail 4: tres juicios distintos, tres campos. */
  cause_confidence: z.enum(CONFIANZA).default("insufficient"),
  impact_confidence: z.enum(CONFIANZA).default("insufficient"),
  severity_confidence: z.enum(CONFIANZA).default("insufficient"),

  trajectory: z.enum(DIAGNOSTIC_TRAJECTORIES).default("unknown"),
  recurrence: z.enum(["first_time", "recurrent", "chronic", "unknown"]).default("unknown"),
  duration_hours: z.number().min(0).optional(),

  critical_path_failure: z.boolean().default(false),
  /** Guardrail 8: criticidad de la capacidad != dano de hoy. */
  capability_criticality: z.enum(["minimal", "moderate", "high", "critical", "unknown"]).default("unknown"),

  material_exposure: z.boolean().default(false),
  exposure_basis: z.string().optional(),

  threat_kind: z.enum(THREAT_KINDS).optional(),
  continuity_rationale: z.string().optional(),

  reversibility: z.enum(REVERSIBILITY).default("unknown"),
  recoverability: z.enum(RECOVERABILITY).default("unknown"),
  absorption_capacity: z.enum(ABSORPTION_CAPACITY).default("unknown"),

  measurement_compromised: z.boolean().default(false),
  escalation_signal: z.enum(ESCALATION_SIGNALS).default("none"),

  summary: z.string().optional(),
  assumptions: z.string().optional(),
  limitations: z.string().optional(),
});

export const severityAssessmentSchema = severityAssessmentFields
  // Guardrail 11.
  .refine(
    (s) =>
      s.overall_severity !== "business_threat" ||
      (s.threat_kind != null && s.continuity_rationale != null),
    { message: "BUSINESS_THREAT es excepcional: exige decir de que amenaza se trata y razonarla (guardrail 11)." },
  )
  // Guardrail 14 y apartado 219, con la excepcion del 220 y del guardrail 12.
  .refine(
    (s) =>
      !["critical", "business_threat"].includes(s.overall_severity) ||
      s.scope === "business" ||
      s.material_exposure ||
      s.threat_kind != null ||
      s.critical_path_failure,
    { message: "Un CRITICAL local no es un CRITICAL global sin exposicion material (guardrail 14)." },
  )
  // Guardrail 15: decir que es material obliga a decir sobre que base.
  .refine((s) => !s.material_exposure || s.exposure_basis != null, {
    message: "Declarar exposicion material obliga a decir sobre que denominador (guardrail 15).",
  })
  // Guardrail 54. El 13 permite la combinacion; este obliga a escribir por que.
  .refine(
    (s) =>
      !["critical", "business_threat"].includes(s.overall_severity) ||
      ["high", "medium"].includes(s.severity_confidence) ||
      s.limitations != null,
    { message: "Gravedad alta con poca confianza se permite (guardrail 13), pero declarando limitaciones (54)." },
  )
  // Guardrail 50.
  .refine((s) => !s.measurement_compromised || s.impact_confidence !== "high", {
    message: "Con la medicion comprometida no se puede estar muy seguro del impacto (guardrail 50).",
  });

export type SeverityAssessment = z.infer<typeof severityAssessmentSchema>;

// ---------------------------------------------------------------------------
// El vector de impacto
// ---------------------------------------------------------------------------

export const impactMeasurementFields = z.object({
  measurement_id: z.string().min(1),
  assessment_id: z.string().min(1),
  dimension: z.enum(IMPACT_DIMENSIONS),
  dimension_severity: z.enum(SEVERITY_LEVELS).default("unknown"),
  nature: z.enum(IMPACT_NATURES).default("realized_loss"),
  timing: z.enum(IMPACT_TIMINGS),
  evidence_type: z.enum(IMPACT_EVIDENCE_TYPES),
  quantification: z.enum(QUANTIFICATION_QUALITIES).default("unknown"),

  metric: z.string().optional(),
  value: z.number().optional(),
  value_low: z.number().optional(),
  value_high: z.number().optional(),
  unit: z.string().optional(),
  period_open: z.boolean().default(false),

  loss_rate: z.number().optional(),
  loss_rate_unit: z.enum(["per_hour", "per_day", "per_week"]).optional(),

  method: z.string().optional(),
  baseline_reference: z.string().optional(),
  assumptions: z.string().optional(),

  likelihood: z.enum(LIKELIHOODS).optional(),
  impact_confidence: z.enum(CONFIANZA).default("insufficient"),
});

const futuro = (t: string) => t === "potential" || t === "projected";

export const impactMeasurementSchema = impactMeasurementFields
  // Guardrail 20, por los dos lados.
  .refine(
    (m) => m.evidence_type !== "observed" || ["realized", "ongoing"].includes(m.timing),
    { message: "Lo observado ya paso o esta pasando: no puede ser potencial ni proyectado (guardrail 20)." },
  )
  .refine((m) => !futuro(m.timing) || m.evidence_type !== "observed", {
    message: "Un pronostico no se presenta como observacion (guardrail 20).",
  })
  // Guardrails 5 y 30.
  .refine((m) => !futuro(m.timing) || m.likelihood != null, {
    message: "Un riesgo declara verosimilitud cualitativa (guardrail 30).",
  })
  .refine((m) => futuro(m.timing) || m.likelihood == null, {
    message: "Lo que ya ocurrio no tiene verosimilitud que declarar (guardrail 5).",
  })
  // Guardrails 23, 27 y 53.
  .refine(
    (m) =>
      m.quantification !== "exact" ||
      (m.evidence_type === "observed" && !m.period_open && m.method != null),
    { message: '"Exacto" solo se dice sobre lo observado, con metodo y periodo cerrado (guardrails 23, 27 y 53).' },
  )
  // Guardrail 24.
  .refine(
    (m) =>
      m.quantification !== "range" ||
      (m.value_low != null && m.value_high != null && m.value_high > m.value_low),
    { message: "Un rango necesita dos extremos y que el alto sea mayor (guardrail 24)." },
  )
  // Guardrail 28.
  .refine(
    (m) =>
      !["directional", "unknown"].includes(m.quantification) ||
      (m.value == null && m.value_low == null && m.value_high == null),
    { message: "Si no puede cuantificarse, no se cuantifica (guardrail 28)." },
  )
  // Guardrail 22.
  .refine((m) => m.evidence_type === "observed" || m.assumptions != null, {
    message: "Los supuestos de una estimacion se ven (guardrail 22).",
  })
  // Guardrail 21.
  .refine(
    (m) => m.impact_confidence !== "high" || ["observed", "estimated"].includes(m.evidence_type),
    { message: "Lo inferido y lo pronosticado no sostienen confianza alta (guardrail 21)." },
  )
  // Guardrails 43, 44 y 45.
  .refine(
    (m) =>
      m.nature !== "opportunity_cost" ||
      (futuro(m.timing) && m.evidence_type !== "observed"),
    { message: "El coste de oportunidad no es una perdida realizada ni se observa (guardrails 43 y 44)." },
  )
  // Guardrail 32.
  .refine((m) => m.nature !== "at_risk" || futuro(m.timing), {
    message: "Revenue-at-risk no es revenue perdido (guardrail 32).",
  })
  .refine((m) => m.nature !== "realized_loss" || m.timing === "realized", {
    message: "Una perdida realizada es, por definicion, realizada.",
  });

export type ImpactMeasurement = z.infer<typeof impactMeasurementSchema>;

// ---------------------------------------------------------------------------
// Exposicion, propagacion y colchones
// ---------------------------------------------------------------------------

export const impactExposureSchema = z
  .object({
    assessment_id: z.string().min(1),
    denominator: z.enum(EXPOSURE_DENOMINATORS),
    denominator_value: z.number().optional(),
    exposure_share: z.number().min(0).max(1).optional(),
    affected_segment: z.string().optional(),
    is_chosen_denominator: z.boolean().default(false),
    confidence: z.enum(CONFIANZA).default("insufficient"),
    rationale: z.string().optional(),
  })
  .refine((e) => e.exposure_share != null || e.affected_segment != null, {
    message: "Una exposicion que no dice ni cuanto ni de quien no es una exposicion.",
  })
  .refine((e) => !e.is_chosen_denominator || e.rationale != null, {
    message: "Elegir un denominador en vez de otro es un juicio, y se razona (guardrail 16).",
  });

export type ImpactExposure = z.infer<typeof impactExposureSchema>;

export const impactPropagationSchema = z
  .object({
    assessment_id: z.string().min(1),
    from_capability: z.string().optional(),
    to_capability: z.string().min(1),
    propagation_kind: z.enum(PROPAGATION_KINDS),
    causal_path_id: z.string().optional(),
    contributes_independent_loss: z.boolean().default(false),
    propagation_risk: z.enum(["low", "medium", "high", "unknown"]).default("unknown"),
  })
  // Guardrail 36.
  .refine((p) => p.propagation_kind !== "systemic" || p.causal_path_id != null, {
    message: "Lo sistemico se afirma con una ruta causal, no con una sensacion (guardrail 36).",
  })
  // Guardrails 33 y 34.
  .refine(
    (p) => !p.contributes_independent_loss || p.propagation_kind === "direct",
    { message: "Contar la cascada aparte es contar el mismo euro dos veces (guardrails 33 y 34)." },
  );

export type ImpactPropagation = z.infer<typeof impactPropagationSchema>;

export const absorptionBufferSchema = z
  .object({
    buffer_type: z.enum(BUFFER_TYPES),
    capability: z.string().optional(),
    description: z.string().min(1),
    state: z.enum(BUFFER_STATES).default("unknown"),
    headroom: z.string().optional(),
    exhaustion_horizon_days: z.number().min(0).optional(),
    activated: z.boolean().default(false),
  })
  .refine(
    (b) => b.state !== "exhausted" || (b.exhaustion_horizon_days ?? 0) === 0,
    { message: "Un colchon agotado no tiene horizonte por delante." },
  );

export type AbsorptionBuffer = z.infer<typeof absorptionBufferSchema>;

// ---------------------------------------------------------------------------
// Las reglas que miran el conjunto
// ---------------------------------------------------------------------------

export type SeverityCheckInput = {
  assessment: SeverityAssessment;
  measurements?: ImpactMeasurement[];
  exposures?: ImpactExposure[];
  propagation?: ImpactPropagation[];
  buffers?: AbsorptionBuffer[];
};

const ALTA = ["high", "critical", "business_threat"];

export function checkSeverityInvariants(
  input: SeverityCheckInput,
): DiagnosticInvariantViolation[] {
  const violations: DiagnosticInvariantViolation[] = [];
  const s = input.assessment;
  const medidas = input.measurements ?? [];
  const exposiciones = input.exposures ?? [];
  const propagacion = input.propagation ?? [];
  const colchones = input.buffers ?? [];

  // Guardrails 9 y 10: la magnitud de una metrica no es la gravedad del
  // negocio. Afirmar HIGH o mas sin haber declarado sobre cuanto negocio cae es
  // exactamente usar el porcentaje como gravedad.
  if (ALTA.includes(s.overall_severity) && exposiciones.length === 0) {
    violations.push({
      rule: "porcentaje_no_es_gravedad",
      source: "D10 guardrails 9 y 10",
      message: `Severidad ${s.overall_severity} sin ninguna exposicion declarada: falta decir sobre cuanto negocio cae.`,
    });
  }

  // Guardrail 15: se pueden registrar varios denominadores, pero hay que decir
  // cual se uso para juzgar. Dos sin elegir ninguno deja el juicio sin base.
  if (exposiciones.length > 1 && !exposiciones.some((e) => e.is_chosen_denominator)) {
    violations.push({
      rule: "denominador_sin_elegir",
      source: "D10 guardrails 15 y 16",
      message: "Hay varias exposiciones y ninguna marcada como la elegida para juzgar.",
    });
  }

  // Guardrail 8 y apartado 170: la criticidad de la capacidad no es el dano de
  // hoy. Si todo lo medido esta en unknown y la severidad es alta, lo unico que
  // la sostiene es que la capacidad sea importante.
  if (
    ALTA.includes(s.overall_severity) &&
    s.capability_criticality === "critical" &&
    medidas.length > 0 &&
    medidas.every((m) => m.quantification === "unknown" && m.dimension_severity === "unknown") &&
    !s.critical_path_failure
  ) {
    violations.push({
      rule: "criticidad_no_es_impacto",
      source: "D10 guardrail 8",
      message: "La severidad se apoya solo en que la capacidad es critica, no en dano medido.",
    });
  }

  // Guardrail 7: reversible no implica recuperable. Si la causa se arregla
  // facil pero hubo perdida realizada, decir que todo se recupera es un salto.
  if (
    s.reversibility === "easily_reversible" &&
    s.recoverability === "fully_recoverable" &&
    medidas.some((m) => m.nature === "realized_loss")
  ) {
    violations.push({
      rule: "reversible_no_es_recuperable",
      source: "D10 guardrail 7",
      message: "Hay perdida ya realizada: que la causa sea facil de revertir no la devuelve.",
    });
  }

  // Guardrail 34: el mismo dano contado en revenue, contribution y cash a la
  // vez, las tres como perdida independiente, se suma tres veces.
  const dobles = medidas.filter(
    (m) =>
      ["revenue", "contribution", "cash"].includes(m.dimension) &&
      ["realized_loss", "ongoing_loss"].includes(m.nature) &&
      m.value != null,
  );
  if (dobles.length > 1 && dobles.every((m) => m.baseline_reference == null)) {
    violations.push({
      rule: "doble_conteo_economico",
      source: "D10 guardrail 34",
      message: "Revenue, contribution y cash cifrados como perdidas separadas sin decir de que base sale cada una.",
    });
  }

  // Guardrail 36: nada sistemico sin ruta -- y ademas, si se declara sistemico,
  // el riesgo de propagacion no puede quedar en unknown.
  for (const p of propagacion) {
    if (p.propagation_kind === "systemic" && p.propagation_risk === "unknown") {
      violations.push({
        rule: "sistemico_sin_riesgo_evaluado",
        source: "D10 guardrail 36",
        message: `Propagacion sistemica hacia "${p.to_capability}" sin evaluar el riesgo.`,
      });
    }
  }

  // Guardrails 37 y 39: no ignorar el colchon. Un riesgo prospectivo alto sin
  // horizonte de agotamiento y sin ningun colchon registrado es una alarma sin
  // mirar la despensa.
  if (
    ALTA.includes(s.forward_risk_severity) &&
    colchones.length === 0 &&
    s.absorption_capacity === "unknown"
  ) {
    violations.push({
      rule: "buffer_no_evaluado",
      source: "D10 guardrails 37 y 39",
      message: "Riesgo prospectivo alto sin haber mirado colchones ni capacidad de absorcion.",
    });
  }

  // Guardrail 40: la recurrencia sube la severidad estructural. Un problema
  // cronico con severidad estructural baja se esta tratando como un incidente.
  if (
    s.recurrence === "chronic" &&
    ["info", "low"].includes(s.structural_severity)
  ) {
    violations.push({
      rule: "recurrencia_ignorada",
      source: "D10 guardrail 40",
      message: "Un problema cronico con severidad estructural baja se esta leyendo como incidente.",
    });
  }

  // Guardrail 41, el otro lado: la recurrencia sola no hace una amenaza. Si lo
  // agudo y lo acumulado son bajos, la estructural no llega a extrema.
  if (
    ["critical", "business_threat"].includes(s.structural_severity) &&
    ["info", "low", "unknown"].includes(s.acute_severity) &&
    ["info", "low", "unknown"].includes(s.cumulative_severity)
  ) {
    violations.push({
      rule: "recurrencia_no_es_amenaza_automatica",
      source: "D10 guardrail 41",
      message: "Severidad estructural extrema sin dano agudo ni acumulado que la sostenga.",
    });
  }

  // Guardrail 50: si la medicion esta comprometida no se inventa la perdida.
  if (
    s.measurement_compromised &&
    medidas.some(
      (m) =>
        ["revenue", "contribution", "cash"].includes(m.dimension) &&
        m.evidence_type === "observed" &&
        m.value != null,
    )
  ) {
    violations.push({
      rule: "perdida_observada_sobre_medicion_rota",
      source: "D10 guardrails 49 y 50",
      message: "La medicion esta comprometida y aun asi hay una perdida economica dada por observada.",
    });
  }

  // Apartado 3 y 95: no hay formula, pero una global dos escalones por debajo
  // de la peor dimension declarada no es dominancia, es olvido. Solo avisa.
  const partes = [s.acute_severity, s.cumulative_severity, s.forward_risk_severity, s.structural_severity]
    .filter((x) => x !== "unknown")
    .map((x) => ORDEN[x] ?? 0);
  const peor = partes.length > 0 ? Math.max(...partes) : null;
  const global = s.overall_severity === "unknown" ? null : ORDEN[s.overall_severity] ?? null;
  if (peor != null && global != null && peor - global >= 2) {
    violations.push({
      rule: "perfil_incoherente",
      source: "D10 apartado 3",
      message: `La severidad global (${s.overall_severity}) queda muy por debajo de la peor dimension del perfil.`,
    });
  }

  // Guardrails 52 y 53: el lenguaje se calibra a la evidencia. Misma regex que
  // en D09 y **con la misma limitacion**: lint sobre texto interno, no garantia.
  // La mitad estructural de estos dos guardrails si esta cubierta y es la que
  // importa: "exacto" no se puede declarar sobre algo no observado ni sobre un
  // periodo abierto, porque el check no lo deja. La frase calibrada que ve el
  // cliente se generara desde los campos en D14.
  if (
    s.summary != null &&
    DEFINITIVE_LANGUAGE.test(s.summary) &&
    medidas.length > 0 &&
    medidas.every((m) => m.evidence_type !== "observed")
  ) {
    violations.push({
      rule: "lenguaje_sin_calibrar",
      source: "D10 guardrails 52 y 53",
      message: "El resumen habla en terminos categoricos de un impacto que nadie ha observado.",
    });
  }

  return violations;
}
