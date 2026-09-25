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

// --- El motor ---------------------------------------------------------------

/**
 * EL MOTOR DE SEVERIDAD. Y lo primero que hay que entender es **lo que no
 * hace**: no pone ni una severidad.
 *
 * Las cinco columnas de severidad salen todas en `unknown`, a proposito. El
 * apartado 29 dice que la fuente **no define formula de severidad, ni
 * ponderacion de impacto, ni modelo monetario, ni modelo de probabilidad**, y el
 * guardrail 17 anade que un scope pequeno puede ser material -- o sea que
 * tampoco hay umbral por cuota. Poner "3% del revenue = moderate" seria
 * inventarse el umbral que el documento se niega a dar, y presentarlo como
 * derivado de el.
 *
 * Lo que si se puede hacer, y es justo lo que el artefacto llama la rama de
 * cuantificacion: **medir**. Cuanto dinero se movio, sobre que base, en que
 * periodo, con que metodo y con que supuestos. Eso convierte "las ventas netas
 * bajan un 18%" en "-2.400 EUR en la semana, que es el 3,1% del revenue del
 * periodo" -- y elegir mal ese denominador es, segun los guardrails 15 a 18, la
 * forma mas comun de exagerar un problema o de quitarle importancia.
 *
 * LA CUENTA NO ES OBSERVADA, ES ESTIMADA. El valor de hoy se observa; la
 * perdida es la diferencia contra un baseline, y un baseline es un modelo. Por
 * eso `evidence_type` es `estimated` y los supuestos se escriben (guardrail 22).
 * Decir `observed` ahi seria presentar un calculo como una medicion.
 */

export type CaseForSeverity = {
  case_id: string;
  target_metric: string;
  scope: string;
  analysis_period_start: string;
  analysis_period_end: string;
};

export type SignalForSeverity = {
  metric: string;
  direction: string;
  observed_value: number | null;
  baseline_value: number | null;
  magnitude_absolute: number | null;
  trajectory: string | null;
  persistence: string;
  business_exposure: string | null;
  window_start: string;
  window_end: string;
};

/** Una base contra la que medir la cuota. Medida, no declarada. */
export type DenominatorReading = {
  denominator: "revenue" | "orders" | "customers" | "traffic" | "spend";
  value: number;
};

/**
 * Umbrales de cuota para la severidad aguda: que parte de la base elegida
 * tiene que moverse para que el dano sea bajo, moderado, alto o critico.
 *
 * NO salen del artefacto --el apartado 29 se niega a darlos--: son una
 * decision de producto del 2026-09-24. Hay unos por defecto para toda la
 * cartera y el consultor los cambia por tienda, porque un 3 % no pesa igual en
 * una tienda con un 60 % de margen que en una con un 15 %.
 */
export type SeverityThresholds = { low: number; moderate: number; high: number; critical: number };

export const DEFAULT_SEVERITY_THRESHOLDS: SeverityThresholds = {
  low: 0.01,
  moderate: 0.03,
  high: 0.07,
  critical: 0.15,
};

export const severityThresholdsSchema = z
  .object({
    low: z.number().gt(0).lte(1),
    moderate: z.number().gt(0).lte(1),
    high: z.number().gt(0).lte(1),
    critical: z.number().gt(0).lte(1),
  })
  .refine((t) => t.low < t.moderate && t.moderate < t.high && t.high < t.critical, {
    message: "Los umbrales tienen que crecer: bajo < moderado < alto < critico.",
  });

/** De la cuota a la severidad. Por debajo del umbral bajo es informativo. */
export function severityFromShare(share: number, t: SeverityThresholds): string {
  if (share >= t.critical) return "critical";
  if (share >= t.high) return "high";
  if (share >= t.moderate) return "moderate";
  if (share >= t.low) return "low";
  return "info";
}

const pctText = (v: number) => `${Number((v * 100).toFixed(2))} %`;

export type SeverityCaseInput = {
  diagnosticCase: CaseForSeverity;
  signal: SignalForSeverity | null;
  denominators: DenominatorReading[];
  currency: string;
  /** Sin umbrales, las severidades se quedan en `unknown` como antes. */
  thresholds?: { values: SeverityThresholds; source: "default" | "organization" } | null;
  /** De D01. Medir mal no es perder dinero, pero si compromete la cifra. */
  dataReliability?: string | null;
  /** De D06: cuantas veces ha pasado esto antes. */
  symptomRecurrence?: { persistence: string; recurrence_count: number } | null;
};

export type ImpactMeasurementDraft = {
  dimension: string;
  dimension_severity: string;
  nature: string;
  timing: string;
  evidence_type: string;
  quantification: string;
  metric: string | null;
  value: number | null;
  unit: string | null;
  period_start: string;
  period_end: string;
  period_open: boolean;
  method: string;
  baseline_reference: string;
  assumptions: string;
  impact_confidence: string;
  note: string | null;
};

export type ImpactExposureDraft = {
  denominator: string;
  denominator_value: number;
  denominator_note: string | null;
  exposure_share: number | null;
  affected_segment: string | null;
  is_chosen_denominator: boolean;
  confidence: string;
  rationale: string | null;
};

export type SeverityAssessmentDraft = {
  case_id: string;
  target: string;
  scope: string;
  acute_severity: string;
  cumulative_severity: "unknown";
  forward_risk_severity: "unknown";
  structural_severity: "unknown";
  overall_severity: string;
  cause_confidence: string;
  impact_confidence: string;
  severity_confidence: string;
  trajectory: string;
  velocity: string;
  recurrence: string;
  measurement_compromised: boolean;
  material_exposure: boolean;
  escalation_signal: string;
  summary: string;
  assumptions: string | null;
  limitations: string;
  measurements: ImpactMeasurementDraft[];
  exposures: ImpactExposureDraft[];
};

const DENOMINADOR_POR_METRICA: Record<
  string,
  { denominator: DenominatorReading["denominator"]; rationale: string }
> = {
  net_sales: {
    denominator: "revenue",
    rationale:
      "Se juzga sobre el revenue del periodo porque la metrica afectada es dinero facturado. Sobre la contribucion la cuota seria mayor, pero no hay coste por referencia para calcularla.",
  },
  orders_count: {
    denominator: "orders",
    rationale:
      "Se juzga sobre los pedidos del periodo porque lo que se movio es el numero de pedidos, no su valor. Medirlo sobre revenue mezclaria la caida de volumen con la de ticket medio.",
  },
  average_order_value: {
    denominator: "revenue",
    rationale:
      "Se juzga sobre el revenue del periodo: el ticket medio no tiene base propia, su efecto se ve en lo facturado.",
  },
  sessions: {
    denominator: "traffic",
    rationale:
      "Se juzga sobre las sesiones del periodo. Llevarlo a revenue exigiria suponer una conversion constante, que es justo lo que no se sabe.",
  },
};

/**
 * En que esta medida cada base.
 *
 * Existe porque la primera corrida real dividio 2.280 EUR entre 50 pedidos y
 * saco un 4.560 %. No era un error de magnitud sino **de categoria**: una
 * perdida en dinero no tiene cuota sobre un recuento. El guardrail 15 deja
 * registrar varias bases, pero solo las que comparten unidad con la perdida
 * dan una cuota que signifique algo.
 */
const UNIDAD_DE_BASE: Record<DenominatorReading["denominator"], "money" | "count"> = {
  revenue: "money",
  spend: "money",
  orders: "count",
  customers: "count",
  traffic: "count",
};

/** Las metricas que se miden en dinero. Las demas cuentan cosas. */
const METRICAS_EN_DINERO = ["net_sales", "average_order_value"];

export function metricUnitKind(metric: string): "money" | "count" {
  return METRICAS_EN_DINERO.includes(metric) ? "money" : "count";
}

/**
 * Sobre que base se juzga esta metrica, y por que.
 *
 * El guardrail 16 dice que elegir un denominador en vez de otro es un juicio y
 * se razona -- el esquema ni siquiera deja marcar el elegido sin escribir el
 * motivo. El mismo incidente es un 3 % del revenue y un 30 % de la contribucion.
 */
export function chooseDenominator(targetMetric: string): {
  denominator: DenominatorReading["denominator"];
  rationale: string;
} | null {
  return DENOMINADOR_POR_METRICA[targetMetric] ?? null;
}

/**
 * La cuota, solo cuando significa algo.
 *
 * Si la perdida sale mayor que la base, la cuota no es "100 %": es que la base
 * esta mal elegida o mal medida. Devolver 1 seria tapar un error de medicion con
 * una cifra creible, asi que devuelve `null` y quien lo lea ve el hueco.
 */
export function exposureShare(
  loss: number,
  denominator: number,
  sameUnit = true,
): number | null {
  if (!sameUnit) return null;
  if (!Number.isFinite(loss) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  const cuota = Math.abs(loss) / denominator;
  return cuota >= 0 && cuota <= 1 ? cuota : null;
}

/**
 * De la trayectoria de D05 a la velocidad de D10.
 *
 * Son vocabularios distintos y no se copian: `volatile` no es una velocidad, y
 * mapearlo a "empeorando" convertiria el vaiven en una direccion.
 */
export function velocityFrom(trajectory: string | null): string {
  switch (trajectory) {
    case "deteriorating":
      return "worsening";
    case "rapidly_deteriorating":
      return "rapidly_deteriorating";
    case "improving":
    case "recovering":
      return "recovering";
    case "stable":
      return "stable";
    default:
      return "unknown";
  }
}

/** Cuantas veces ha pasado esto. Sin sintoma detras, no se sabe. */
export function recurrenceFrom(
  symptom: { persistence: string; recurrence_count: number } | null | undefined,
): string {
  if (!symptom) return "unknown";
  if (symptom.persistence === "chronic") return "chronic";
  if (symptom.recurrence_count > 1) return "recurrent";
  return "first_time";
}

/**
 * Lo que esta evaluacion **no** puede decir, escrito.
 *
 * El guardrail 54 lo exige cuando la confianza en la causa es baja, y aqui lo es
 * siempre: no hay motor de causa raiz. Una evaluacion de severidad sin esta
 * frase se leeria como si alguien hubiera decidido que el dano es desconocido,
 * cuando lo que pasa es que nadie ha definido como medirlo.
 */
export function limitationsFor(input: SeverityCaseInput, acuteApplied = false): string {
  const t = input.thresholds;
  const faltas: string[] = [
    acuteApplied && t
      ? `La severidad aguda se juzga con umbrales de cuota ${t.source === "organization" ? "fijados para esta tienda" : "por defecto de la cartera"} (bajo desde ${pctText(t.values.low)}, moderado ${pctText(t.values.moderate)}, alto ${pctText(t.values.high)}, critico ${pctText(t.values.critical)} de la base elegida): son una politica, no una derivacion del artefacto. Acumulada, prospectiva y estructural siguen en \`unknown\`.`
      : "Las cinco severidades quedan en `unknown`: la fuente no define formula de severidad (apartado 29) y sin umbrales de cuota o sin cuota sobre la base elegida no hay lectura que dar.",
    "No hay causa raiz ni constraint: D07 a D09 no tienen motor, asi que la confianza en la causa es insuficiente por construccion.",
    "Reversibilidad y recuperabilidad quedan sin evaluar: dependen de D09.",
  ];

  if (!input.signal) {
    faltas.push("No hay senal en la ventana del caso, asi que no hay nada que cuantificar.");
  }
  // Siempre, hoy: 43 de 44 referencias no tienen coste, asi que la contribucion
  // no se puede calcular en ninguna tienda. Cuando se pueda, esta linea sobra.
  faltas.push(
    "No se mide el impacto sobre la contribucion: no hay coste por referencia para calcularla.",
  );
  if (input.dataReliability && ["low", "unusable"].includes(input.dataReliability)) {
    faltas.push(
      "D01 da la fuente por degradada, asi que la cifra economica se declara comprometida (guardrail 51).",
    );
  }

  return faltas.join(" ");
}

/**
 * La evaluacion de severidad de un caso: la medida, no el juicio.
 */
export function assessSeverity(input: SeverityCaseInput): SeverityAssessmentDraft {
  const { diagnosticCase, signal, denominators, currency } = input;

  const comprometida = Boolean(
    input.dataReliability && ["low", "unusable"].includes(input.dataReliability),
  );

  const perdida =
    signal && typeof signal.magnitude_absolute === "number"
      ? Math.abs(signal.magnitude_absolute)
      : null;

  const eleccion = chooseDenominator(diagnosticCase.target_metric);

  // Guardrail 21: lo inferido no sostiene confianza alta. Y si D01 degrado la
  // fuente, la confianza en el impacto baja aunque la cuenta este bien hecha:
  // una resta exacta sobre un dato malo sigue siendo un dato malo.
  const impactConfidence = perdida === null ? "insufficient" : comprometida ? "low" : "medium";

  const measurements: ImpactMeasurementDraft[] = [];
  if (perdida !== null && signal) {
    const esDinero = ["net_sales", "average_order_value"].includes(signal.metric);
    measurements.push({
      dimension: esDinero ? "revenue" : "operations",
      // La severidad de la dimension medida es la aguda: es el mismo dano.
      dimension_severity: "unknown",
      nature: "realized_loss",
      timing: "realized",
      // La resta contra un baseline no es una observacion: el baseline es un
      // modelo. Llamarlo `observed` seria presentar un calculo como medicion.
      evidence_type: "estimated",
      quantification: "estimated",
      metric: signal.metric,
      value: perdida,
      unit: esDinero ? currency : "unidades",
      period_start: signal.window_start,
      period_end: signal.window_end,
      period_open: false,
      method:
        "Diferencia entre el valor observado en la ventana y el baseline con el que D05 emitio la senal.",
      baseline_reference: `Baseline de D05 para ${signal.metric} (${signal.baseline_value ?? "sin valor"}).`,
      assumptions:
        "Supone que el baseline habria seguido vigente en la ventana medida, es decir que sin el movimiento detectado la metrica habria seguido su nivel previo. No ajusta por estacionalidad ni por calendario comercial, que D05 todavia no aplica.",
      impact_confidence: impactConfidence,
      note: comprometida
        ? "D01 da la fuente por degradada: la cifra se declara comprometida."
        : null,
    });
  }

  const unidadPerdida = signal ? metricUnitKind(signal.metric) : null;

  const exposures: ImpactExposureDraft[] = denominators
    .filter((d) => d.value > 0)
    .map((d) => {
      const elegido = eleccion?.denominator === d.denominator;
      const mismaUnidad = unidadPerdida !== null && UNIDAD_DE_BASE[d.denominator] === unidadPerdida;
      const cuota =
        perdida === null ? null : exposureShare(perdida, d.value, mismaUnidad);
      return {
        denominator: d.denominator,
        denominator_value: d.value,
        denominator_note:
          perdida === null || cuota !== null
            ? null
            : !mismaUnidad
              ? "No se calcula cuota: la perdida y esta base no estan en la misma unidad. La base queda registrada como contexto."
              : "La perdida calculada supera esta base: la base esta mal elegida o mal medida, y la cuota no se escribe.",
        exposure_share: cuota,
        // El esquema exige que la fila diga algo: si no hay cuota, dice al menos
        // sobre que parte del negocio se mira.
        affected_segment: cuota === null ? diagnosticCase.scope : null,
        is_chosen_denominator: elegido,
        confidence: comprometida ? "low" : "medium",
        rationale: elegido ? (eleccion?.rationale ?? null) : null,
      };
    });

  const cuotaElegida = exposures.find((e) => e.is_chosen_denominator)?.exposure_share;

  // Guardrail 17: la cuota sola no es la gravedad, pero con umbrales
  // declarados si es la lectura aguda de un dano realizado y medido.
  const aguda =
    input.thresholds && typeof cuotaElegida === "number"
      ? severityFromShare(cuotaElegida, input.thresholds.values)
      : "unknown";
  // Guardrail 14: un critico local no es un critico global sin exposicion
  // material declarada; se queda en alto en la global.
  const global =
    aguda === "critical" && diagnosticCase.scope !== "business_global" ? "high" : aguda;
  for (const medida of measurements) medida.dimension_severity = aguda;

  return {
    case_id: diagnosticCase.case_id,
    target: diagnosticCase.target_metric,
    scope: diagnosticCase.scope === "business_global" ? "business" : "capability",
    acute_severity: aguda,
    cumulative_severity: "unknown",
    forward_risk_severity: "unknown",
    structural_severity: "unknown",
    overall_severity: global,
    // Guardrail 13: se puede estar seguro del dano y no tener ni idea de por
    // que. Aqui la causa es insuficiente siempre, porque no hay motor causal.
    cause_confidence: "insufficient",
    impact_confidence: impactConfidence,
    // Con umbral, la severidad es una lectura de politica sobre una perdida
    // estimada: baja, nunca mas.
    severity_confidence: aguda === "unknown" ? "insufficient" : "low",
    trajectory: signal?.trajectory ?? "unknown",
    velocity: velocityFrom(signal?.trajectory ?? null),
    recurrence: recurrenceFrom(input.symptomRecurrence),
    measurement_compromised: comprometida,
    // Guardrail 14: para que lo local sea global hay que **declarar** que la
    // exposicion es material. Nadie lo ha declarado, asi que no.
    material_exposure: false,
    // Guardrail 56: D10 no define a quien se avisa. Esto es una lectura del
    // estado, no una orden, y sin severidad no hay lectura que dar.
    escalation_signal: "none",
    summary:
      perdida === null
        ? `Sin senal en la ventana del caso: no hay impacto que cuantificar sobre ${diagnosticCase.target_metric}.`
        : `${diagnosticCase.target_metric} se movio ${perdida.toFixed(2)} ${
            ["net_sales", "average_order_value"].includes(signal?.metric ?? "")
              ? currency
              : "unidades"
          } frente a su baseline en la ventana medida${
            typeof cuotaElegida === "number"
              ? `, lo que supone un ${(cuotaElegida * 100).toFixed(1)}% de la base elegida`
              : ""
          }${aguda === "unknown" ? "" : `; severidad aguda ${aguda} segun los umbrales ${input.thresholds?.source === "organization" ? "de la tienda" : "por defecto"}`}.`,
    assumptions: null,
    limitations: limitationsFor(input, aguda !== "unknown"),
    measurements,
    exposures,
  };
}
