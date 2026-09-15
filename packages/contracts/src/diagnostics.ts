// FASE 3 / D00 — Contrato de diagnostico (tipos e invariantes).
//
// Fuente: conocimiento/fase-03/02-contratos-IA/D00-contrato-de-diagnostico.md
//
// El apartado 60 del contrato es explicito sobre por que existe este fichero:
//
//   "El RAG aporta conocimiento. Pero el runtime debe imponer comportamiento.
//    Reglas como 'no diagnosis without evidence' o 'always expose confidence'
//    no deberian depender exclusivamente de que el vector search encuentre
//    este documento."
//
// La migracion 20260914110000 ya sostiene los invariantes que caben en una
// check constraint (una fila, una condicion). Aqui viven los que no caben,
// porque miran varias entidades a la vez: si la hipotesis ganadora tiene
// evidencia suficiente, si se consideraron alternativas, si se busco
// evidencia en contra. Ninguno de esos se puede expresar sobre una sola fila.
//
// Los catalogos de abajo son los mismos que las check constraints de esa
// migracion. Anadir un valor significa tocar los dos sitios: si divergen, la
// base rechaza lo que el tipo permite y el fallo aparece en runtime.

import { z } from "zod";

// --- Catalogos (apartados 15, 16, 25, 26, 27, 29, 44, 45, 49) ---------------

export const DIAGNOSTIC_SCOPES = [
  "business_global", "acquisition", "meta_ads", "google_ads", "creative",
  "conversion", "product", "offer", "retention", "email", "inventory",
  "operations", "finance", "data", "technology", "team", "strategy",
] as const;

export const DIAGNOSTIC_GRANULARITIES = ["L0", "L1", "L2", "L3", "L4", "L5", "L6"] as const;

export const DIAGNOSTIC_STATUSES = [
  "open", "investigating", "partially_confirmed", "confirmed",
  "inconclusive", "insufficient_data", "invalidated",
] as const;

export const DIAGNOSTIC_FINDINGS = [
  "strength", "healthy", "watch", "weakness", "problem",
  "critical_problem", "risk", "opportunity",
] as const;

export const DIAGNOSTIC_TYPES = [
  "performance", "structural", "constraint", "risk", "anomaly", "regression",
  "dependency", "data", "operational", "financial", "strategic", "opportunity",
] as const;

export const DIAGNOSTIC_SEVERITIES = [
  "info", "low", "moderate", "high", "critical", "business_threat",
] as const;

export const DIAGNOSTIC_TRAJECTORIES = [
  "improving", "stable", "deteriorating", "rapidly_deteriorating",
  "recovering", "volatile", "unknown",
] as const;

export const DIAGNOSTIC_CONFIDENCES = ["high", "medium", "low", "insufficient_data"] as const;

export const DIAGNOSTIC_BASELINES = [
  "previous_period", "year_over_year", "rolling_average", "business_target",
  "historical_normal", "pre_event", "control_group", "peer_group", "benchmark",
] as const;

// Apartado 13: el motor debe poder representar lo que NO sabe. `unknown` no es
// un error ni un hueco a rellenar: es informacion diagnostica.
export const KNOWLEDGE_STATES = [
  "known", "unknown", "unavailable", "unreliable", "not_applicable",
] as const;

// D08 amplio este vocabulario (apartado 3 de su contrato) y con el la tabla
// `diagnostic_hypotheses`, que es la misma de D00. Se pudo hacer sin migrar
// nada porque estaba vacia en los dos entornos; el catalogo vive aqui para que
// contrato y base no puedan discrepar.
export const HYPOTHESIS_STATUSES = [
  "untested",
  "under_test",
  "supported",
  "weakly_supported",
  "partially_supported",
  "most_likely",
  "contradicted",
  "invalidated",
  "confirmed",
  "inconclusive",
] as const;

/** Los dos estados que cierran la puerta y por eso exigen motivo. */
export const HYPOTHESIS_CLOSING_STATUSES = ["invalidated", "contradicted"] as const;

// D08 apartado 4: la evidencia que DISCRIMINA entre hipotesis es una categoria
// propia, no un "apoya" mas -- es la que hace avanzar el diagnostico.
export const EVIDENCE_RELATIONS = [
  "supports",
  "contradicts",
  "discriminates",
  "inconclusive",
] as const;

export type DiagnosticScope = (typeof DIAGNOSTIC_SCOPES)[number];
export type DiagnosticStatus = (typeof DIAGNOSTIC_STATUSES)[number];
export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number];
export type DiagnosticConfidence = (typeof DIAGNOSTIC_CONFIDENCES)[number];
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

// --- Entidades --------------------------------------------------------------

// Apartado 8: un hecho medido. Todavia no es una senal.
export const observationSchema = z.object({
  metric: z.string().min(1),
  value: z.number().nullable(),
  previous_value: z.number().nullable().optional(),
  change_absolute: z.number().nullable().optional(),
  change_relative: z.number().nullable().optional(),
  segment: z.record(z.string(), z.unknown()).default({}),
  source: z.string().min(1),
  knowledge_state: z.enum(KNOWLEDGE_STATES).default("known"),
  reliability: z.enum(["high", "medium", "low"]).nullable().optional(),
  baseline_type: z.enum(DIAGNOSTIC_BASELINES).nullable().optional(),
});

// Apartado 9: observacion que adquiere relevancia empresarial.
export const signalSchema = z.object({
  signal_type: z.string().min(1),
  direction: z.enum(["up", "down", "flat"]),
  magnitude: z.number().nullable().optional(),
  // Apartado 52: magnitud y persistencia son dimensiones distintas.
  persistence_days: z.number().int().min(0).nullable().optional(),
  statistical_relevance: z.enum(["high", "medium", "low"]).nullable().optional(),
  business_relevance: z.enum(["high", "medium", "low"]).nullable().optional(),
});

// Apartado 10: patron empresarial formado por varias senales.
export const symptomSchema = z.object({
  symptom_type: z.string().min(1),
  description: z.string().nullable().optional(),
});

// Apartado 11 y 34: incluidas las descartadas, con su motivo.
export const hypothesisSchema = z
  .object({
    code: z.string().min(1).max(8),
    statement: z.string().min(1),
    status: z.enum(HYPOTHESIS_STATUSES).default("untested"),
    rejection_reason: z.string().nullable().optional(),
  })
  .refine(
    (h) =>
      !(HYPOTHESIS_CLOSING_STATUSES as readonly string[]).includes(h.status) ||
      Boolean(h.rejection_reason),
    { message: "una hipotesis descartada tiene que decir por que (D00 §34, D08 §54)" },
  );

// Apartados 32 y 33: el ledger de evidencia.
export const evidenceSchema = z.object({
  code: z.string().min(1).max(8),
  source: z.string().min(1),
  metric: z.string().nullable().optional(),
  observation: z.string().min(1),
  reliability: z.enum(["high", "medium", "low"]).nullable().optional(),
  // A que hipotesis apoya o contradice. Vacio = evidencia de contexto.
  supports: z.array(z.string()).default([]),
  contradicts: z.array(z.string()).default([]),
});

// Apartado 14: lo que haria falta para poder distinguir entre hipotesis.
export const dataGapSchema = z.object({
  required_data: z.string().min(1),
  reason: z.string().min(1),
  impact_on_diagnosis: z.enum(["high", "medium", "low"]).default("medium"),
  affected_hypothesis: z.string().nullable().optional(),
});

// Apartado 56: el contrato de salida. "No todos los campos tendran siempre
// contenido. Pero la estructura debe permanecer estable."
export const diagnosticOutputSchema = z.object({
  diagnostic_id: z.string().min(1),
  scope: z.enum(DIAGNOSTIC_SCOPES),
  granularity: z.enum(DIAGNOSTIC_GRANULARITIES).default("L0"),

  target_metric: z.string().min(1),
  target_question: z.string().min(1),

  status: z.enum(DIAGNOSTIC_STATUSES),
  finding: z.enum(DIAGNOSTIC_FINDINGS).nullable().optional(),
  diagnosis_type: z.enum(DIAGNOSTIC_TYPES).nullable().optional(),

  primary_issue: z.string().nullable().optional(),
  root_cause: z.string().nullable().optional(),
  limiting_constraint: z.string().nullable().optional(),
  affected_capabilities: z.array(z.string()).default([]),

  severity: z.enum(DIAGNOSTIC_SEVERITIES).nullable().optional(),
  trajectory: z.enum(DIAGNOSTIC_TRAJECTORIES).nullable().optional(),
  confidence: z.enum(DIAGNOSTIC_CONFIDENCES).nullable().optional(),

  observations: z.array(observationSchema).default([]),
  signals: z.array(signalSchema).default([]),
  symptoms: z.array(symptomSchema).default([]),
  hypotheses: z.array(hypothesisSchema).default([]),
  evidence: z.array(evidenceSchema).default([]),
  data_gaps: z.array(dataGapSchema).default([]),

  data_quality: z.record(z.string(), z.unknown()).default({}),
  impact_scope: z.record(z.string(), z.unknown()).default({}),
  limitations: z.array(z.string()).default([]),
  summary: z.string().nullable().optional(),
});

export type DiagnosticOutput = z.infer<typeof diagnosticOutputSchema>;

// --- Invariantes (apartados 11, 14, 20, 26, 36, 46, 58) ---------------------

export type DiagnosticInvariantViolation = {
  /** Identificador estable de la regla, para agrupar en telemetria. */
  rule: string;
  /** Apartado del contrato que la impone, para poder ir a la fuente. */
  source: string;
  message: string;
};

/** Un caso se considera concluido cuando afirma algo hacia fuera. */
const CONCLUDED: readonly DiagnosticStatus[] = ["confirmed", "partially_confirmed"];

const asserts = (output: DiagnosticOutput) => CONCLUDED.includes(output.status);

/**
 * Comprueba los invariantes que no caben en una check constraint porque
 * relacionan varias entidades del caso.
 *
 * Devuelve la lista de violaciones en vez de lanzar: quien llama decide que
 * hacer con ellas. El runtime se niega a persistir la conclusion; una
 * evaluacion de agente las cuenta y sigue.
 *
 * Solo reglas mecanicas. "No confundir correlacion con causalidad" es un
 * invariante real del apartado 58 y no esta aqui: no se puede decidir mirando
 * la estructura del caso, y fingir que si lo comprobamos seria peor que
 * admitir que depende del juicio del motor y de la revision humana.
 */
export function checkDiagnosticInvariants(
  output: DiagnosticOutput,
): DiagnosticInvariantViolation[] {
  const violations: DiagnosticInvariantViolation[] = [];
  const concluded = asserts(output);
  const hasRootCause = Boolean(output.root_cause);

  // Apartado 11: nunca sintoma -> unica explicacion automatica. Concluir una
  // causa habiendo barajado una sola explicacion es exactamente ese salto.
  if (concluded && hasRootCause && output.hypotheses.length < 2) {
    violations.push({
      rule: "alternativas_consideradas",
      source: "D00 §11",
      message:
        "se afirma una causa habiendo formulado menos de dos hipotesis: el motor reduce el espacio de explicaciones, no lo salta",
    });
  }

  // Apartado 11 y 34: y esas alternativas tienen que haberse resuelto, no solo
  // enumerado. Si ninguna quedo descartada, no hubo contraste.
  if (concluded && hasRootCause) {
    const discarded = output.hypotheses.filter(
      (h) =>
        h.status === "invalidated" ||
        h.status === "contradicted" ||
        h.status === "weakly_supported",
    );
    if (discarded.length === 0 && output.hypotheses.length >= 2) {
      violations.push({
        rule: "alternativas_resueltas",
        source: "D00 §34",
        message:
          "ninguna hipotesis alternativa quedo descartada: sin contraste la conclusion no esta discriminada",
      });
    }
  }

  // Apartado 46: evidencia minima. Una sola metrica moviendose no confirma una
  // causa; como mucho la deja en POSSIBLE / LOW CONFIDENCE.
  if (hasRootCause && output.confidence === "high") {
    const supporting = output.evidence.filter((e) => e.supports.length > 0);
    if (supporting.length < 2) {
      violations.push({
        rule: "evidencia_minima",
        source: "D00 §46",
        message:
          "causa afirmada con confianza alta y menos de dos evidencias de apoyo: degradar a confianza media o baja",
      });
    }
  }

  // Apartados 12 y 36: falsacion. Una hipotesis ganadora sobre la que nunca se
  // busco evidencia en contra es sesgo de confirmacion. Si no se pudo buscar,
  // el contrato ya ofrece donde decirlo: un data gap.
  if (concluded && output.confidence === "high") {
    const contradicting = output.evidence.some((e) => e.contradicts.length > 0);
    if (!contradicting && output.data_gaps.length === 0) {
      violations.push({
        rule: "falsacion_intentada",
        source: "D00 §12, §36",
        message:
          "confianza alta sin ninguna evidencia en contra registrada ni ningun data gap: no consta que se intentara falsar la hipotesis",
      });
    }
  }

  // Apartado 58: ignorar calidad de datos. Concluir con confianza alta sin
  // haber mirado de que calidad era el dato de partida.
  if (concluded && output.confidence === "high") {
    if (Object.keys(output.data_quality).length === 0) {
      violations.push({
        rule: "calidad_de_datos_evaluada",
        source: "D00 §58",
        message:
          "conclusion con confianza alta sin evaluacion de calidad de datos (D01)",
      });
    }
  }

  // Apartado 58: ocultar falta de informacion. Declararse sin datos suficientes
  // y no decir cuales faltan deja al consultor sin nada que hacer.
  if (output.status === "insufficient_data" && output.data_gaps.length === 0) {
    violations.push({
      rule: "hueco_declarado",
      source: "D00 §14, §58",
      message:
        "estado insufficient_data sin ningun data gap: hay que decir que dato falta y para distinguir que",
    });
  }

  // Apartado 20 y 58: confundir root cause con constraint. La causa explica por
  // que pasa; el constraint, que limita hoy el rendimiento. Si son literalmente
  // lo mismo, una de las dos no se penso.
  if (
    hasRootCause &&
    output.limiting_constraint &&
    output.root_cause?.trim().toLowerCase() ===
      output.limiting_constraint.trim().toLowerCase()
  ) {
    violations.push({
      rule: "causa_distinta_de_constraint",
      source: "D00 §20",
      message:
        "root cause y constraint son el mismo texto: la causa explica por que ocurre, el constraint que limita el sistema",
    });
  }

  // Apartado 26: confianza insuficiente y causa afirmada no pueden convivir.
  if (hasRootCause && output.confidence === "insufficient_data") {
    violations.push({
      rule: "confianza_coherente",
      source: "D00 §26",
      message:
        "se afirma una causa declarando a la vez que no hay informacion suficiente para concluir",
    });
  }

  // Apartado 58: generalizar un problema localizado al negocio entero.
  if (
    concluded &&
    output.scope === "business_global" &&
    typeof output.impact_scope.revenue_share_affected === "number" &&
    output.impact_scope.revenue_share_affected < 0.5
  ) {
    violations.push({
      rule: "no_generalizar",
      source: "D00 §58",
      message:
        "diagnostico de alcance global sobre un impacto que afecta a menos de la mitad del revenue: acotar el scope a donde esta concentrado",
    });
  }

  return violations;
}
