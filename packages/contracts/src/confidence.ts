/**
 * FASE 3 / D11 â€” Confianza e incertidumbre.
 *
 * Fuentes: `02-contratos-IA/d11-requisitos-contrato-confianza-incertidumbre.md` (29 apartados),
 * `04-policies-guardrails/d11-guardrails-confianza-incertidumbre.md` (60 guardrails),
 * `03-runtime/d11-flujo-evaluacion-confianza-incertidumbre.md`,
 * `06-tenant-context/d11-contexto-confianza-incertidumbre.md`,
 * `05-experience-learning/d11-calibracion-historica-confianza.md`.
 *
 * El bloque que audita a todos los anteriores. `D01` a `D10` llevan diez
 * migraciones declarando `confidence` campo a campo; `D11` es el que dice si esa
 * confianza esta bien puesta, de donde sale y que la limita.
 *
 * DOS GARANTIAS ESTRUCTURALES:
 *
 * 1. **No hay confianza sin claim** (apartado 17 y 94). `claim` y
 *    `target_question` son obligatorios y con longitud minima: una etiqueta de
 *    confianza que no dice de que afirmacion habla no se puede auditar.
 * 2. **No hay ningun numero.** En todo el bloque existe una sola columna
 *    numerica, `retrieval_similarity`, y esta en la unica entidad que no decide
 *    nada sobre el negocio. El guardrail 36 prohibe el porcentaje opaco y el
 *    apartado 149 prohibe literalmente "Confianza: 75%". Hay un test que
 *    recorre todos los esquemas del bloque y comprueba que no hay otro numero.
 */
import { z } from "zod";

import {
  DIAGNOSTIC_CONFIDENCES,
  type DiagnosticInvariantViolation,
} from "./diagnostics.js";
import { EXPLANATORY_COVERAGE } from "./hypotheses.js";
import { DEFINITIVE_LANGUAGE } from "./root-cause.js";

/**
 * Apartado 2. **No se redefine**: son los mismos cuatro de `D00`. Dos catalogos
 * de lo que significa "alta" acabarian diciendo cosas distintas sobre la misma
 * conclusion, que es el error que este bloque existe para detectar.
 */
export const CLAIM_CONFIDENCE_LEVELS = DIAGNOSTIC_CONFIDENCES;

/**
 * Orden para comparar un nivel con su techo y una capa con la respuesta global.
 * **No es una escala**: no se promedia, no se suma y no se convierte en numero
 * de salida (guardrail 36).
 */
function nivel(x: string): number {
  switch (x) {
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 0;
  }
}

/** Apartado 3 y guardrail 21: no son equivalentes y no se aplanan. */
export const EPISTEMIC_STATES = [
  "observed", "derived", "inferred", "hypothesized", "confirmed", "unknown",
] as const;

/** Apartado 16 y apartado 150 del corpus: la confianza es distinta en cada capa. */
export const CLAIM_LAYERS = [
  "what", "where", "measurement", "signal", "symptom", "why", "root_cause",
  "constraint", "current_impact", "future_impact", "severity", "forecast", "overall",
] as const;

/**
 * Apartado 4, menos las dos que son puerta para llegar a alta y viven en la
 * fila del claim (`alternative_separation` y `contradiction_level`): cada cosa
 * en un solo sitio.
 */
export const CONFIDENCE_DIMENSIONS = [
  "data_reliability", "data_coverage", "context_quality", "sample_sufficiency",
  "temporal_fit", "scope_fit", "mechanism_strength", "evidence_consistency",
  "evidence_independence", "missing_evidence",
] as const;

export const DIMENSION_RATINGS = ["strong", "adequate", "weak", "absent", "unknown"] as const;

/** Guardrails 25, 26, 27 y apartado 78: importa la fuerza, no el numero. */
export const ALTERNATIVE_SEPARATION = [
  "strong", "moderate", "weak", "none", "not_applicable", "unknown",
] as const;

/** Guardrail 12 y apartado 73. */
export const CONTRADICTION_LEVELS = ["none", "immaterial", "material", "decisive"] as const;

/** Apartado 15 y guardrail 4: **no es confianza**, y no se deriva de ella. */
export const COMPLETENESS_STATES = ["complete_enough", "partial", "incomplete"] as const;

/** Apartado 21 y guardrail 8: tres estados, no dos. */
export const NEGATIVE_CLAIM_STATES = [
  "no_evidence", "evidence_of_no_problem", "evidence_of_stability",
] as const;

/** Apartado 5, guardrails 16 a 20. */
export const CAP_SOURCES = [
  "data_quality", "insufficient_coverage", "weak_temporal_fit", "scope_mismatch",
  "external_cause_unobserved", "inadequate_horizon", "broad_structural_claim",
  "measurement_change", "sample_too_small", "dependent_evidence", "stale_knowledge",
] as const;

/** Apartado 7. */
export const UNCERTAINTY_TYPES = [
  "data", "context", "measurement", "model", "causal", "scope", "temporal",
  "impact", "forecast", "knowledge",
] as const;

/** Apartado 9. */
export const UNCERTAINTY_MATERIALITY = ["low", "material", "high", "critical_unknown"] as const;

/** Apartado 10. */
export const RESOLVABILITY = [
  "resolvable_now", "with_new_data", "over_time", "not_resolvable",
] as const;

/** Apartado 20 y guardrail 40: la autoridad no sustituye la evidencia del caso. */
export const SOURCE_AUTHORITIES = [
  "canonical", "expert", "community", "unverified", "unknown",
] as const;

export const APPLICABILITY_LEVELS = ["high", "medium", "low", "not_applicable", "unknown"] as const;

/**
 * Guardrail 47: prohibido "esta claro que" cuando la confianza no es alta.
 * Complementa la `DEFINITIVE_LANGUAGE` de `D09` y **arrastra su limitacion**:
 * es un lint sobre texto interno, no una garantia.
 *
 * **La cobertura real de los guardrails 43 a 47 no es detectar, es generar.**
 * Esos cuatro guardrails no dicen "prohibido exagerar": dan la formula exacta de
 * cada nivel -- INSUFFICIENT_DATA "no puede determinarse", LOW "es compatible
 * con", MEDIUM "la explicacion mas probable es", HIGH fuerte pero nunca
 * absoluta. Componiendo la frase desde esos campos en `D14`, el lenguaje
 * descalibrado no se detecta: no se puede escribir. Hasta entonces, **este
 * guardrail queda cubierto solo a medias** y conviene saberlo.
 */
export const CERTAINTY_LANGUAGE =
  /\b(esta claro que|estÃ¡ claro que|es evidente|obviamente|con total seguridad|queda demostrado|no cabe duda)\b/i;

// ---------------------------------------------------------------------------
// El claim y su confianza
// ---------------------------------------------------------------------------

export const claimConfidenceFields = z.object({
  claim_id: z.string().min(1),
  claim_layer: z.enum(CLAIM_LAYERS),
  /** Apartado 17: **no hay confianza sin claim**, y no hay claim sin pregunta. */
  claim: z.string().min(10),
  target_question: z.string().min(10),
  subject_id: z.string().optional(),

  epistemic_state: z.enum(EPISTEMIC_STATES).default("unknown"),
  confidence_level: z.enum(CLAIM_CONFIDENCE_LEVELS).default("insufficient_data"),

  alternative_separation: z.enum(ALTERNATIVE_SEPARATION).default("unknown"),
  contradiction_level: z.enum(CONTRADICTION_LEVELS).default("none"),

  /** Guardrail 4: dos vocabularios distintos, ninguno derivado del otro. */
  completeness: z.enum(COMPLETENESS_STATES).default("partial"),
  explanatory_coverage: z.enum(EXPLANATORY_COVERAGE).default("unknown"),

  negative_claim_state: z.enum(NEGATIVE_CLAIM_STATES).optional(),
  coverage_declared: z.string().optional(),

  capped_at: z.enum(CLAIM_CONFIDENCE_LEVELS).optional(),
  cap_reason: z.string().optional(),

  recency_domain: z.string().optional(),
  is_stale: z.boolean().default(false),
  decay_reason: z.string().optional(),

  desired_level: z.enum(CLAIM_CONFIDENCE_LEVELS).optional(),
  missing_evidence: z.string().optional(),
  next_evidence_required: z.string().optional(),

  error_cost: z.enum(["low", "moderate", "high", "severe", "unknown"]).default("unknown"),

  assumptions: z.string().optional(),
  /** Guardrail 35: especifica, no de plantilla. */
  limitations: z.string().min(25).optional(),
});

export const claimConfidenceSchema = claimConfidenceFields
  // Apartado 5: un cap que no baja el nivel no es un cap.
  .refine(
    (c) => c.capped_at == null || nivel(c.confidence_level) <= nivel(c.capped_at),
    { message: "El nivel no puede superar su propio techo (apartado 5)." },
  )
  .refine((c) => c.capped_at == null || c.cap_reason != null, {
    message: "Un techo sin motivo no es un techo (guardrails 16 a 20).",
  })
  // Guardrail 25 y apartado 78.
  .refine(
    (c) =>
      c.confidence_level !== "high" ||
      ["strong", "not_applicable"].includes(c.alternative_separation),
    { message: "Con separacion debil frente a las alternativas no se llega a alta (guardrail 25)." },
  )
  // Guardrail 12.
  .refine(
    (c) =>
      c.confidence_level !== "high" || ["none", "immaterial"].includes(c.contradiction_level),
    { message: "Una contradiccion material no convive con confianza alta (guardrail 12)." },
  )
  // Guardrail 23 y 2: confirmado exige validacion, y alta no es certeza absoluta.
  .refine(
    (c) =>
      c.epistemic_state !== "confirmed" ||
      (c.confidence_level === "high" && c.limitations != null),
    { message: "CONFIRMED exige validacion suficiente y limitaciones escritas (guardrail 23)." },
  )
  // Guardrail 24.
  .refine((c) => c.epistemic_state !== "hypothesized" || c.confidence_level !== "high", {
    message: "Una suposicion no se presenta como un hecho (guardrail 24).",
  })
  // Guardrails 22 y 60.
  .refine(
    (c) => c.epistemic_state !== "unknown" || c.confidence_level === "insufficient_data",
    { message: "No saber es no saber: UNKNOWN solo va con INSUFFICIENT_DATA (guardrail 22)." },
  )
  // Guardrail 29.
  .refine(
    (c) =>
      c.negative_claim_state == null ||
      c.negative_claim_state === "no_evidence" ||
      c.coverage_declared != null,
    { message: '"No hay problema" exige declarar la cobertura con la que se mira (guardrail 29).' },
  )
  // Guardrail 31.
  .refine(
    (c) =>
      c.negative_claim_state !== "evidence_of_stability" ||
      (c.completeness === "complete_enough" && ["observed", "derived"].includes(c.epistemic_state)),
    { message: "Afirmar estabilidad exige medicion completa y observada (guardrail 31)." },
  )
  // Guardrail 30.
  .refine(
    (c) =>
      c.confidence_level !== "insufficient_data" ||
      c.negative_claim_state == null ||
      c.negative_claim_state === "no_evidence",
    { message: "Si faltan datos, la afirmacion negativa es NO_EVIDENCE (guardrail 30)." },
  )
  // Apartado 23.
  .refine((c) => c.desired_level == null || c.missing_evidence != null, {
    message: "Querer mas confianza sin decir que falta no es un plan (apartado 23).",
  })
  // Guardrail 48.
  .refine((c) => !c.is_stale || c.decay_reason != null, {
    message: "Marcar una confianza como caducada exige decir por que (guardrail 48).",
  });

export type ClaimConfidence = z.infer<typeof claimConfidenceSchema>;

export const confidenceDimensionSchema = z.object({
  claim_id: z.string().min(1),
  dimension: z.enum(CONFIDENCE_DIMENSIONS),
  rating: z.enum(DIMENSION_RATINGS),
  /** Apartado 30: los insumos de la confianza tienen que verse. */
  reason: z.string().min(15),
});

export type ConfidenceDimension = z.infer<typeof confidenceDimensionSchema>;

export const confidenceCapSchema = z.object({
  claim_id: z.string().min(1),
  cap_source: z.enum(CAP_SOURCES),
  capped_level: z.enum(CLAIM_CONFIDENCE_LEVELS),
  reason: z.string().min(20),
});

export type ConfidenceCap = z.infer<typeof confidenceCapSchema>;

export const uncertaintySchema = z
  .object({
    uncertainty_id: z.string().min(1),
    claim_id: z.string().optional(),
    uncertainty_type: z.enum(UNCERTAINTY_TYPES),
    /** Guardrail 34: el boilerplate no informa. */
    description: z.string().min(25),
    materiality: z.enum(UNCERTAINTY_MATERIALITY).default("material"),
    /** Apartado 8: solo existe el known unknown, y es deliberado. */
    is_known_unknown: z.boolean().default(true),
    resolvability: z.enum(RESOLVABILITY).default("with_new_data"),
    required_evidence: z.string().optional(),
    confidence_impact: z.string().optional(),
  })
  // Guardrail 33.
  .refine(
    (u) =>
      u.materiality !== "critical_unknown" ||
      (u.required_evidence != null && u.claim_id != null),
    { message: "Un critical unknown no se deja caer sin decir a que afecta y que lo resolveria (guardrail 33)." },
  )
  .refine((u) => u.resolvability !== "not_resolvable" || u.required_evidence == null, {
    message: "Lo que no tiene solucion no pide evidencia para resolverse.",
  });

export type DiagnosticUncertainty = z.infer<typeof uncertaintySchema>;

export const confidenceHistorySchema = z
  .object({
    claim_id: z.string().min(1),
    previous_level: z.enum(CLAIM_CONFIDENCE_LEVELS).optional(),
    new_level: z.enum(CLAIM_CONFIDENCE_LEVELS),
    previous_state: z.enum(EPISTEMIC_STATES).optional(),
    new_state: z.enum(EPISTEMIC_STATES).optional(),
    /** Apartado 120: "por que cambio" es la mitad del valor del historico. */
    reason: z.string().min(20),
    evidence_ref: z.string().optional(),
  })
  .refine(
    (h) => h.previous_level !== h.new_level || h.previous_state !== h.new_state,
    { message: "Un cambio que no cambia nada no es una entrada de historico." },
  );

export type ConfidenceHistoryEntry = z.infer<typeof confidenceHistorySchema>;

export const knowledgeApplicabilitySchema = z
  .object({
    claim_id: z.string().min(1),
    source_ref: z.string().min(1),
    source_authority: z.enum(SOURCE_AUTHORITIES).default("unknown"),
    source_version: z.string().optional(),
    /**
     * **El unico numero del bloque**, y esta aqui a proposito: en la entidad que
     * no decide nada sobre el negocio (guardrail 6).
     */
    retrieval_similarity: z.number().min(0).max(1).optional(),
    applicability: z.enum(APPLICABILITY_LEVELS).default("unknown"),
    validated_against_case: z.boolean().default(false),
    validation_note: z.string().optional(),
    is_stale: z.boolean().default(false),
  })
  // Guardrails 6, 39 y 40.
  .refine((k) => k.applicability !== "high" || k.validated_against_case, {
    message: "Ni el parecido ni la autoridad hacen aplicable algo: solo validarlo contra el caso (guardrail 39).",
  })
  .refine((k) => !k.validated_against_case || k.validation_note != null, {
    message: "Una validacion que no se escribe no es una validacion.",
  })
  // Guardrail 41.
  .refine(
    (k) => !k.is_stale || ["low", "not_applicable", "unknown"].includes(k.applicability),
    { message: "Lo caducado no puede ser muy aplicable (guardrail 41)." },
  );

export type KnowledgeApplicability = z.infer<typeof knowledgeApplicabilitySchema>;

// ---------------------------------------------------------------------------
// Las reglas que miran el conjunto
// ---------------------------------------------------------------------------

export type ConfidenceCheckInput = {
  claims: ClaimConfidence[];
  dimensions?: ConfidenceDimension[];
  caps?: ConfidenceCap[];
  uncertainties?: DiagnosticUncertainty[];
  knowledge?: KnowledgeApplicability[];
};

export function checkConfidenceInvariants(
  input: ConfidenceCheckInput,
): DiagnosticInvariantViolation[] {
  const violations: DiagnosticInvariantViolation[] = [];
  const dimensiones = input.dimensions ?? [];
  const caps = input.caps ?? [];
  const incertidumbres = input.uncertainties ?? [];
  const conocimiento = input.knowledge ?? [];

  for (const c of input.claims) {
    const suyas = dimensiones.filter((d) => d.claim_id === c.claim_id);
    const sus = conocimiento.filter((k) => k.claim_id === c.claim_id);
    const susUnknowns = incertidumbres.filter((u) => u.claim_id === c.claim_id);

    // Apartado 30 y guardrail 1: la confianza sale de la evidencia. Una alta sin
    // ninguna dimension evaluada sale de la seguridad con que esta escrita.
    if (c.confidence_level === "high" && suyas.length === 0) {
      violations.push({
        rule: "confianza_sin_insumos",
        source: "D11 guardrail 1 y apartado 30",
        message: `"${c.claim_layer}": confianza alta sin ninguna dimension evaluada.`,
      });
    }

    // Guardrails 7 y 11: tres metricas del mismo origen son una, no tres.
    if (
      nivel(c.confidence_level) >= nivel("medium") &&
      suyas.some(
        (d) => d.dimension === "evidence_independence" && ["weak", "absent"].includes(d.rating),
      )
    ) {
      violations.push({
        rule: "evidencia_dependiente_infla",
        source: "D11 guardrails 7 y 11",
        message: `"${c.claim_layer}": la evidencia no es independiente y aun asi sostiene ${c.confidence_level}.`,
      });
    }

    // Guardrail 4: confianza y completitud son dos cosas. Declarar cobertura
    // explicativa completa sobre algo declarado incompleto las colapsa.
    if (c.completeness === "incomplete" && c.explanatory_coverage === "full") {
      violations.push({
        rule: "completitud_leida_como_confianza",
        source: "D11 guardrail 4",
        message: `"${c.claim_layer}": cobertura explicativa completa sobre un claim declarado incompleto.`,
      });
    }

    // Guardrail 8 y 29: no haber visto no es haber visto que no.
    if (
      c.negative_claim_state === "evidence_of_no_problem" &&
      suyas.some((d) => d.dimension === "data_coverage" && ["weak", "absent"].includes(d.rating))
    ) {
      violations.push({
        rule: "ausencia_no_es_prueba",
        source: "D11 guardrail 8",
        message: `"${c.claim_layer}": se afirma que no hay problema con cobertura de datos debil.`,
      });
    }

    // Guardrail 33: un critical unknown que afecta al claim y aun asi alta.
    if (
      c.confidence_level === "high" &&
      susUnknowns.some((u) => u.materiality === "critical_unknown")
    ) {
      violations.push({
        rule: "unknown_critico_ignorado",
        source: "D11 guardrail 33",
        message: `"${c.claim_layer}": hay un critical unknown declarado sobre este claim y la confianza sigue siendo alta.`,
      });
    }

    // Guardrail 51 y apartado 188: si el contexto cambio, la conclusion caduca.
    if (c.is_stale && c.confidence_level === "high") {
      violations.push({
        rule: "caducado_no_sostiene_alta",
        source: "D11 guardrails 48 y 51",
        message: `"${c.claim_layer}": la confianza esta marcada como caducada y sigue en alta.`,
      });
    }

    // Guardrail 53: una confianza baja no puede tapar un riesgo serio. Si
    // equivocarse sale caro, hay que decir en que se falla.
    if (
      c.error_cost === "severe" &&
      nivel(c.confidence_level) <= nivel("low") &&
      c.limitations == null
    ) {
      violations.push({
        rule: "riesgo_serio_sin_declarar",
        source: "D11 guardrails 52 y 53",
        message: `"${c.claim_layer}": el coste de equivocarse es severo y no hay limitaciones escritas.`,
      });
    }

    // Apartado 23 y 262: pedir mas confianza sin decir con que se consigue deja
    // el hueco identificado y sin camino.
    if (c.desired_level != null && c.next_evidence_required == null) {
      violations.push({
        rule: "mejora_sin_siguiente_paso",
        source: "D11 apartado 23",
        message: `"${c.claim_layer}": se quiere subir a ${c.desired_level} sin decir que evidencia lo haria.`,
      });
    }

    // Guardrails 6, 39 y 40: el parecido del vector y la autoridad de la fuente
    // no son evidencia del caso. Una alta sostenida solo por documentos lo es.
    if (
      nivel(c.confidence_level) >= nivel("medium") &&
      suyas.length === 0 &&
      sus.length > 0 &&
      !sus.some((k) => k.validated_against_case)
    ) {
      violations.push({
        rule: "autoridad_no_sustituye_evidencia",
        source: "D11 guardrails 6, 39 y 40",
        message: `"${c.claim_layer}": la confianza se apoya en conocimiento recuperado sin validar contra el caso.`,
      });
    }

    // Guardrails 43 a 47: el lenguaje se calibra a la confianza. Misma
    // limitacion que en D09 y D10: es un aviso, no una garantia.
    if (
      c.confidence_level !== "high" &&
      (CERTAINTY_LANGUAGE.test(c.claim) || DEFINITIVE_LANGUAGE.test(c.claim))
    ) {
      violations.push({
        rule: "lenguaje_por_encima_de_la_confianza",
        source: "D11 guardrails 43 a 47",
        message: `"${c.claim_layer}": el claim esta escrito en terminos categoricos con confianza ${c.confidence_level}.`,
      });
    }
  }

  // Guardrail 33 y 37: los critical unknowns del caso se ven en algun sitio.
  const criticos = incertidumbres.filter((u) => u.materiality === "critical_unknown");
  if (criticos.length > 0 && input.claims.every((c) => c.limitations == null)) {
    violations.push({
      rule: "unknown_critico_oculto",
      source: "D11 guardrails 33 y 37",
      message: "Hay critical unknowns en el caso y ningun claim declara limitaciones.",
    });
  }

  // Apartado 181: la global puede quedar por debajo de sus capas, nunca por
  // encima. Que la causa raiz sea media es lo que hace media a la respuesta.
  const global = input.claims.find((c) => c.claim_layer === "overall");
  if (global != null) {
    const porDebajo = input.claims.filter(
      (c) =>
        c.claim_layer !== "overall" &&
        ["root_cause", "why", "severity", "current_impact"].includes(c.claim_layer) &&
        nivel(c.confidence_level) < nivel(global.confidence_level),
    );
    if (porDebajo.length > 0) {
      violations.push({
        rule: "global_por_encima_de_sus_capas",
        source: "D11 apartado 181",
        message: `La respuesta global va en ${global.confidence_level} con capas por debajo: ${porDebajo
          .map((c) => c.claim_layer)
          .join(", ")}.`,
      });
    }
  }

  // Apartado 5: un cap declarado que no aparece en el claim no ha capado nada.
  for (const cap of caps) {
    const suyo = input.claims.find((c) => c.claim_id === cap.claim_id);
    if (suyo != null && nivel(suyo.confidence_level) > nivel(cap.capped_level)) {
      violations.push({
        rule: "cap_declarado_sin_efecto",
        source: "D11 apartado 5",
        message: `El cap por ${cap.cap_source} deja el techo en ${cap.capped_level} y el claim sigue en ${suyo.confidence_level}.`,
      });
    }
  }

  return violations;
}

// --- El motor ---------------------------------------------------------------

/**
 * EL MOTOR DE CONFIANZA. Es el bloque que pone en palabras lo que los otros
 * seis saben y lo que no, **capa por capa**.
 *
 * LA IDEA QUE LO SOSTIENE, y es la de toda la fase: la confianza no es un
 * numero del caso, es una propiedad de **cada afirmacion**. Se puede saber con
 * certeza que las ventas cayeron (capa `what`, observado) y no tener ni idea de
 * por que (capa `why`, desconocido), y las dos cosas a la vez son lo normal, no
 * una contradiccion. Colapsarlas en "confianza media" borra justo la
 * informacion que sirve: te dice cuanto fiarte, pero no de que.
 *
 * LO QUE HOY SALE, Y POR QUE. Las capas `why`, `root_cause` y `constraint`
 * salen `unknown` / `insufficient_data` cuando el caso no tiene salidas de
 * D07-D09 enlazadas. Si las tiene, D11 conserva el estado real de la ruta, la
 * hipotesis, la causa y el constraint, sin convertir una evidencia parcial en
 * una conclusion cerrada.
 *
 * SIN FORMULA, COMO SIEMPRE EN ESTA FASE. No hay media ponderada de dimensiones
 * ni de capas. Lo unico que se deriva es el techo (`capped_at`), y se deriva de
 * una regla declarada, no de un umbral: la confianza de una capa **no puede
 * superar la de aquello en lo que se apoya**.
 *
 * Y NINGUN PORCENTAJE. El guardrail lo pide y el esquema lo garantiza: no hay
 * columna donde quepa un numero.
 */

/** Lo que D01 dice del dato que sostiene todo esto. */
export type DataQualityForConfidence = {
  reliability: string;
  coverage?: string | null;
};

/** Lo que D05 emitio, en lo que le hace falta a D11. */
export type SignalForConfidence = {
  metric: string;
  direction: string;
  scope: string;
  signal_confidence: string;
  data_confidence: string;
  low_sample: boolean;
  window_start: string;
  window_end: string;
};

/** Lo que D06 formo, si formo algo. */
export type SymptomForConfidence = {
  label: string;
  confidence: string;
  context_reviewed: boolean;
  compatible_direction: boolean;
  known_relationship: boolean;
};

/** Evidencia causal que D11 recibe de D07, sin volver a calcularla. */
export type CausalPathForConfidence = {
  status: "supported" | "contradicted" | "untested" | "partial";
  path_confidence: "insufficient_data" | "low" | "medium" | "high";
  confounders_reviewed: boolean;
  measurement_validated: boolean;
  evidence?: readonly { stance: "supporting" | "contradicting" | "inconclusive"; observation: string }[];
};

/** Hipotesis viva de D08 que D11 usa para separar alternativas. */
export type HypothesisForConfidence = {
  status: string;
  confidence: "high" | "medium" | "low" | "insufficient";
  explanatory_coverage: "full" | "partial" | "minimal" | "unknown";
  separation: "high" | "low" | "unknown";
};

/** Conclusion de D09: una causa no tiene que estar confirmada para ser util. */
export type RootCauseForConfidence = {
  status: string;
  confidence: "high" | "medium" | "low" | "insufficient";
  statement: string;
  explanatory_coverage: "full" | "partial" | "minimal" | "unknown";
  residual_material: boolean;
  limitations?: string | null;
};

/** Candidata de constraint de D09, independiente de las causas raiz. */
export type BusinessConstraintForConfidence = {
  binding_status: "binding" | "secondary" | "latent" | "none";
  confidence: string;
  statement: string;
  limits_target: boolean;
};

export type CausalEvidenceForConfidence = {
  paths: readonly CausalPathForConfidence[];
  hypotheses: readonly HypothesisForConfidence[];
  rootCauses: readonly RootCauseForConfidence[];
  constraints: readonly BusinessConstraintForConfidence[];
};

/** Lo que D10 midio, si midio algo. */
export type SeverityForConfidence = {
  impact_confidence: string;
  severity_confidence: string;
  measurement_compromised: boolean;
  has_measurement: boolean;
};

export type ConfidenceEngineInput = {
  caseId: string;
  targetMetric: string;
  targetQuestion: string;
  scope: string;
  dataQuality?: DataQualityForConfidence | null;
  signal?: SignalForConfidence | null;
  symptom?: SymptomForConfidence | null;
  severity?: SeverityForConfidence | null;
  causal?: CausalEvidenceForConfidence | null;
};

export type ClaimDraft = {
  claim_layer: string;
  claim: string;
  target_question: string;
  epistemic_state: string;
  confidence_level: string;
  alternative_separation: string;
  contradiction_level: string;
  completeness: string;
  explanatory_coverage: string;
  negative_claim_state: string | null;
  coverage_declared: string | null;
  capped_at: string | null;
  cap_reason: string | null;
  desired_level: string | null;
  missing_evidence: string | null;
  next_evidence_required: string | null;
  error_cost: string;
  limitations: string | null;
  dimensions: { dimension: string; rating: string; reason: string }[];
  caps: { cap_source: string; capped_level: string; reason: string }[];
};

export type ConfidenceEngineOutput = {
  claims: ClaimDraft[];
  uncertainties: {
    uncertainty_type: string;
    description: string;
    materiality: string;
    is_known_unknown: boolean;
    resolvability: string;
    required_evidence: string | null;
    claim_layer: string | null;
  }[];
};

const ORDEN_NIVEL: Record<string, number> = {
  insufficient_data: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * El techo que impone lo que hay debajo.
 *
 * Es la unica derivacion del motor, y no es un umbral: una afirmacion **no
 * puede** ser mas firme que aquello en lo que se apoya. Si D01 no se fia del
 * dato, ninguna lectura construida sobre ese dato se fia mas.
 */
export function capTo(level: string, ceiling: string | null): string {
  if (ceiling == null) return level;
  return (ORDEN_NIVEL[level] ?? 0) <= (ORDEN_NIVEL[ceiling] ?? 0) ? level : ceiling;
}

/**
 * El techo que impone la calidad del dato (guardrails 16 a 20).
 *
 * Devuelve `null` cuando D01 no degrada nada: un techo que no baja el nivel no
 * es un techo, y el esquema lo rechaza.
 */
export function dataQualityCap(
  quality: DataQualityForConfidence | null | undefined,
): { capped_level: string; reason: string } | null {
  if (!quality) {
    return {
      capped_level: "low",
      reason:
        "D01 no ha evaluado la fuente que sostiene este caso, asi que no se puede afirmar nada por encima de bajo sobre lo que mide.",
    };
  }
  if (["unusable"].includes(quality.reliability)) {
    return {
      capped_level: "insufficient_data",
      reason:
        "D01 da la fuente por inutilizable: lo que se lea de ella no sostiene ninguna afirmacion.",
    };
  }
  if (["low", "degraded"].includes(quality.reliability)) {
    return {
      capped_level: "low",
      reason:
        "D01 da la fuente por degradada, asi que toda lectura construida sobre ella hereda ese techo.",
    };
  }
  return null;
}

/**
 * Como se dice cada nivel de confianza, con las palabras de los guardrails 43 a
 * 46.
 *
 * **No son sinonimos elegantes**: cada nivel tiene su formula y cambiarla es
 * descalibrar el lenguaje. "Es compatible con" no significa lo mismo que "la
 * explicacion mas probable es", y esa diferencia es lo unico que separa una
 * hipotesis de una conclusion.
 */
export function calibratedPhrase(level: string): string {
  switch (level) {
    case "high":
      return "la evidencia sostiene con solidez que";
    case "medium":
      return "la explicacion mas probable es que";
    case "low":
      return "es compatible con que";
    default:
      return "no puede determinarse si";
  }
}

/**
 * Que afirmacion negativa se puede hacer cuando no hay senal.
 *
 * **Guardrail 8 y el corazon de toda la fase**: "no lo se" y "no lo hay" son
 * tres estados, no dos. Sin cobertura declarada, lo unico honesto es
 * `no_evidence`; decir `evidence_of_no_problem` sin haber mirado es afirmar una
 * ausencia que nadie ha comprobado. Y `evidence_of_stability` exige ademas
 * medicion completa y observada (guardrail 31): es la mas fuerte de las tres.
 */
export function negativeClaimFor(
  hayMedicion: boolean,
  cobertura: string | null,
): { state: string; coverage_declared: string | null } {
  if (!hayMedicion || !cobertura) {
    return { state: "no_evidence", coverage_declared: null };
  }
  return { state: "evidence_of_no_problem", coverage_declared: cobertura };
}

function dimension(dimension: string, rating: string, reason: string) {
  return { dimension, rating, reason };
}

type CausalRead = {
  available: boolean;
  root: RootCauseForConfidence | null;
  constraint: BusinessConstraintForConfidence | null;
  path: CausalPathForConfidence | null;
  hypothesis: HypothesisForConfidence | null;
  level: string;
  contradiction: "none" | "material";
  alternatives: "strong" | "weak" | "unknown" | "not_applicable";
  completeness: "complete_enough" | "partial" | "incomplete";
  coverage: "full" | "partial" | "minimal" | "unknown";
  limitations: string;
};

function normalizeConfidence(value: string): string {
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  if (value === "low") return "low";
  return "insufficient_data";
}

function minConfidence(...values: string[]): string {
  return values.reduce(
    (lowest, value) => (nivel(value) < nivel(lowest) ? value : lowest),
    "high",
  );
}

function readCausalEvidence(causal: CausalEvidenceForConfidence | null | undefined): CausalRead {
  const paths = causal?.paths ?? [];
  const hypotheses = causal?.hypotheses ?? [];
  const roots = causal?.rootCauses ?? [];
  const constraints = causal?.constraints ?? [];
  const available = paths.length > 0 || hypotheses.length > 0 || roots.length > 0 || constraints.length > 0;
  const root = roots.find((candidate) => candidate.status === "confirmed")
    ?? roots.find((candidate) => candidate.status === "partial_root_cause")
    ?? roots[0]
    ?? null;
  const constraint = constraints.find((candidate) => candidate.limits_target)
    ?? constraints[0]
    ?? null;
  const path = paths.find((candidate) => candidate.status === "supported")
    ?? paths.find((candidate) => candidate.status === "partial")
    ?? paths[0]
    ?? null;
  const hypothesis = hypotheses.find((candidate) => ["confirmed", "most_likely", "supported"].includes(candidate.status))
    ?? hypotheses[0]
    ?? null;
  const contradictory = paths.some((candidate) => candidate.status === "contradicted")
    || paths.some((candidate) => candidate.evidence?.some((evidence) => evidence.stance === "contradicting") ?? false);

  if (!available) {
    return {
      available: false,
      root: null,
      constraint: null,
      path: null,
      hypothesis: null,
      level: "insufficient_data",
      contradiction: "none",
      alternatives: "unknown",
      completeness: "incomplete",
      coverage: "unknown",
      limitations: "Este caso no tiene evidencia causal cargada; no se puede distinguir mecanismo de co-movimiento.",
    };
  }

  const pathLevel = path ? normalizeConfidence(path.path_confidence) : "insufficient_data";
  const hypothesisLevel = hypothesis ? normalizeConfidence(hypothesis.confidence) : "insufficient_data";
  const rootLevel = root ? normalizeConfidence(root.confidence) : "insufficient_data";
  const hasValidPath = Boolean(path && path.status === "supported" && path.confounders_reviewed && path.measurement_validated);
  const confirmedRoot = root?.status === "confirmed";
  const strongAlternatives = hypothesis?.separation === "high";
  const level = contradictory
    ? "low"
    : confirmedRoot && hasValidPath && strongAlternatives
      ? minConfidence(pathLevel, hypothesisLevel, rootLevel)
      : minConfidence("medium", pathLevel, hypothesisLevel, rootLevel);

  return {
    available: true,
    root,
    constraint,
    path,
    hypothesis,
    level,
    contradiction: contradictory ? "material" : "none",
    alternatives: hypothesis?.separation === "high"
      ? "strong"
      : hypothesis?.separation === "low"
        ? "weak"
        : hypotheses.length > 1
          ? "weak"
          : "unknown",
    completeness: root?.explanatory_coverage === "full" && !root.residual_material ? "complete_enough" : "partial",
    coverage: root?.explanatory_coverage ?? hypothesis?.explanatory_coverage ?? "unknown",
    limitations: root?.limitations
      ?? (path?.status === "supported"
        ? "La ruta causal está soportada, pero la confianza sigue limitada por la evidencia y la separación de alternativas."
        : "Hay una candidata causal, pero la ruta todavía no está suficientemente validada."),
  };
}

function buildCausalClaims(
  input: ConfidenceEngineInput,
  lectura: CausalRead,
  capsComunes: ClaimDraft["caps"],
  techo: string | null,
): ClaimDraft[] {
  const rootStatement = lectura.root?.statement ?? `No puede determinarse por que se movio ${input.targetMetric}.`;
  const rootMissing = lectura.root?.residual_material
    ? "Validar la parte residual de la cadena y separar las alternativas rivales."
    : null;
  const causalCaps = lectura.available
    ? [
        ...capsComunes,
        {
          cap_source: "dependent_evidence",
          capped_level: lectura.level,
          reason: lectura.limitations,
        },
      ]
    : capsComunes;
  const causalDimension = lectura.path?.status === "supported" ? "adequate" : "weak";
  const causalReason = lectura.path
    ? `D07 aporta una ruta ${lectura.path.status} con confianza ${lectura.path.path_confidence}.`
    : "No hay una ruta causal de D07 enlazada a este caso.";
  const common = {
    target_question: input.targetQuestion,
    epistemic_state: "inferred",
    confidence_level: lectura.level,
    alternative_separation: lectura.alternatives,
    contradiction_level: lectura.contradiction,
    completeness: lectura.completeness,
    explanatory_coverage: lectura.coverage,
    negative_claim_state: null,
    coverage_declared: null,
    capped_at: lectura.level === "high" ? techo : lectura.level,
    cap_reason: lectura.limitations,
    desired_level: lectura.level === "insufficient_data" ? "medium" : null,
    missing_evidence: rootMissing,
    next_evidence_required: rootMissing,
    error_cost: "severe",
    limitations: lectura.limitations,
    dimensions: [dimension("mechanism_strength", causalDimension, causalReason)],
    caps: causalCaps,
  } satisfies Omit<ClaimDraft, "claim_layer" | "claim">;

  const constraint = lectura.constraint;
  const constraintLevel = constraint
    ? constraint.binding_status === "binding"
      ? minConfidence("medium", normalizeConfidence(constraint.confidence))
      : "low"
    : "insufficient_data";

  return [
    {
      ...common,
      claim_layer: "why",
      claim: lectura.root
        ? `${rootStatement} La explicacion causal es ${lectura.coverage === "full" ? "completa" : "parcial"}.`
        : `No puede determinarse por que se movio ${input.targetMetric}; hay evidencia causal insuficiente.`,
      target_question: "Â¿Por que ha pasado esto?",
    },
    {
      ...common,
      claim_layer: "root_cause",
      claim: lectura.root ? rootStatement : "No puede determinarse cual es la causa raiz de este caso.",
      target_question: "Â¿Cual es la causa de fondo?",
    },
    {
      ...common,
      claim_layer: "constraint",
      claim: constraint
        ? `${constraint.statement} No se ha demostrado que sea vinculante.`
        : "No puede determinarse que cuello de botella limita a este negocio.",
      target_question: "Â¿Que le esta limitando?",
      confidence_level: constraintLevel,
      capped_at: constraintLevel,
      completeness: constraint ? "partial" : "incomplete",
      explanatory_coverage: "unknown",
      missing_evidence: constraint?.binding_status === "latent"
        ? "Medir capacidad y demanda, y resolver el contrafactual del constraint."
        : constraint ? null : "Una candidata a constraint de D09.",
      next_evidence_required: constraint?.binding_status === "latent"
        ? "Ejecutar el test contrafactual que D09 deja pendiente."
        : constraint ? null : "Ejecutar el motor de causa raiz y constraint.",
      limitations: constraint
        ? "D09 ha identificado una candidata, pero latent no significa vinculante."
        : lectura.limitations,
      dimensions: [
        dimension(
          "mechanism_strength",
          constraint ? "weak" : "unknown",
          constraint
            ? "La candidata de D09 necesita capacidad, demanda y contrafactual para declararse vinculante."
            : "No hay una candidata a constraint enlazada a este caso.",
        ),
      ],
    },
  ];
}

/**
 * La confianza de cada capa del caso.
 *
 * Una fila por capa **sobre la que hay algo que decir**, incluidas las que solo
 * pueden decir "no se sabe": esas son las que impiden que el caso se lea como
 * cerrado.
 */
export function assessConfidence(input: ConfidenceEngineInput): ConfidenceEngineOutput {
  const { targetMetric, targetQuestion, scope, signal, symptom, severity } = input;
  const lecturaCausal = readCausalEvidence(input.causal);

  const capDato = dataQualityCap(input.dataQuality);
  const techo = capDato?.capped_level ?? null;

  const capsComunes = capDato
    ? [
        {
          cap_source: input.dataQuality ? "data_quality" : "insufficient_coverage",
          capped_level: capDato.capped_level,
          reason: capDato.reason,
        },
      ]
    : [];

  const claims: ClaimDraft[] = [];

  // --- Capa `measurement`: Â¿me puedo fiar de la cifra? ---------------------
  claims.push({
    claim_layer: "measurement",
    claim: input.dataQuality
      ? `La medicion de ${targetMetric} tiene fiabilidad ${input.dataQuality.reliability} segun D01.`
      : `La medicion de ${targetMetric} no ha sido evaluada por D01.`,
    target_question: "Â¿Me puedo fiar de la cifra sobre la que se construye todo lo demas?",
    epistemic_state: input.dataQuality ? "observed" : "unknown",
    confidence_level: input.dataQuality
      ? capTo(input.dataQuality.reliability === "high" ? "high" : "medium", techo)
      : "insufficient_data",
    alternative_separation: "not_applicable",
    contradiction_level: "none",
    completeness: input.dataQuality ? "complete_enough" : "incomplete",
    explanatory_coverage: "unknown",
    negative_claim_state: null,
    coverage_declared: null,
    capped_at: techo,
    cap_reason: capDato?.reason ?? null,
    desired_level: input.dataQuality ? null : "medium",
    missing_evidence: input.dataQuality
      ? null
      : "Una evaluacion de calidad de datos de D01 sobre la fuente de esta metrica.",
    next_evidence_required: input.dataQuality ? null : "Ejecutar el motor de calidad de datos.",
    error_cost: "high",
    limitations: input.dataQuality
      ? null
      : "Sin evaluacion de D01 no se sabe si la cifra es fiable, asi que todo lo que se construya encima hereda esa duda.",
    dimensions: [
      dimension(
        "data_reliability",
        input.dataQuality
          ? input.dataQuality.reliability === "high"
            ? "strong"
            : input.dataQuality.reliability === "medium"
              ? "adequate"
              : "weak"
          : "unknown",
        input.dataQuality
          ? `D01 evaluo la fuente como ${input.dataQuality.reliability}.`
          : "D01 no ha evaluado la fuente de esta metrica todavia.",
      ),
    ],
    caps: capsComunes,
  });

  // --- Capa `what`: Â¿que se movio? -----------------------------------------
  if (signal) {
    const nivel = capTo(signal.low_sample ? "low" : "high", techo);
    claims.push({
      claim_layer: "what",
      claim: `${targetMetric} se movio (${signal.direction}) fuera de su rango esperado en la ventana medida.`,
      target_question: "Â¿Que ha cambiado?",
      // Es lo unico de toda la cadena que se observa directamente: la serie
      // esta ahi. Por eso es la capa que mas confianza admite.
      epistemic_state: "observed",
      confidence_level: nivel,
      alternative_separation: "not_applicable",
      contradiction_level: "none",
      completeness: "complete_enough",
      explanatory_coverage: "unknown",
      negative_claim_state: null,
      coverage_declared: null,
      capped_at: signal.low_sample ? capTo("low", techo) : techo,
      cap_reason: signal.low_sample
        ? "La muestra de la ventana es corta, asi que la desviacion puede ser ruido."
        : (capDato?.reason ?? null),
      desired_level: null,
      missing_evidence: null,
      next_evidence_required: null,
      error_cost: "moderate",
      limitations: null,
      dimensions: [
        dimension(
          "sample_sufficiency",
          signal.low_sample ? "weak" : "adequate",
          signal.low_sample
            ? "D05 marco la senal como muestra corta en la ventana medida."
            : "La ventana medida tiene puntos suficientes para el metodo robusto de D05.",
        ),
        dimension(
          "temporal_fit",
          "adequate",
          "La ventana de la senal cae dentro del periodo de analisis del caso.",
        ),
      ],
      caps: [
        ...capsComunes,
        ...(signal.low_sample
          ? [
              {
                cap_source: "sample_too_small",
                capped_level: "low",
                reason:
                  "La muestra de la ventana es corta: la desviacion medida puede ser ruido y no un cambio real.",
              },
            ]
          : []),
      ],
    });
  } else {
    // Sin senal no se afirma que no pase nada: se afirma que no se ha mirado.
    const negativa = negativeClaimFor(false, null);
    claims.push({
      claim_layer: "what",
      claim: `No hay ninguna senal de ${targetMetric} en la ventana del caso.`,
      target_question: "Â¿Que ha cambiado?",
      epistemic_state: "unknown",
      confidence_level: "insufficient_data",
      alternative_separation: "unknown",
      contradiction_level: "none",
      completeness: "incomplete",
      explanatory_coverage: "unknown",
      negative_claim_state: negativa.state,
      coverage_declared: negativa.coverage_declared,
      capped_at: null,
      cap_reason: null,
      desired_level: "medium",
      missing_evidence: "Una pasada del motor de senales sobre la ventana del caso.",
      next_evidence_required: "Ejecutar el motor de senales.",
      error_cost: "moderate",
      limitations:
        "Que no haya senal no significa que no haya pasado nada: significa que en esta ventana no se ha medido una desviacion.",
      dimensions: [
        dimension(
          "data_coverage",
          "unknown",
          "No consta que se haya medido esta metrica en la ventana del caso.",
        ),
      ],
      caps: capsComunes,
    });
  }

  // --- Capa `where`: Â¿donde pasa? ------------------------------------------
  claims.push({
    claim_layer: "where",
    claim: `El movimiento se observa en el alcance ${scope}.`,
    target_question: "Â¿Sobre que parte del negocio pasa esto?",
    epistemic_state: signal ? "observed" : "unknown",
    confidence_level: signal ? capTo("medium", techo) : "insufficient_data",
    alternative_separation: "not_applicable",
    contradiction_level: "none",
    completeness: "partial",
    explanatory_coverage: "unknown",
    negative_claim_state: null,
    coverage_declared: null,
    capped_at: capTo("medium", techo) === "medium" ? "medium" : techo,
    cap_reason:
      "El motor de senales no segmenta todavia por canal, mercado ni dispositivo, asi que el alcance fino no se puede afirmar.",
    desired_level: "high",
    missing_evidence:
      "Series segmentadas por canal, mercado o dispositivo, que las funciones SQL actuales no devuelven.",
    next_evidence_required: "Implementar los pasos 14 a 17 del runtime de D05.",
    error_cost: "moderate",
    limitations:
      "Un problema local puede esconderse dentro de un agregado estable, y hoy solo se mira el agregado.",
    dimensions: [
      dimension(
        "scope_fit",
        "weak",
        "Solo hay alcance de negocio: no hay drilldown por segmento que confirme donde pasa.",
      ),
    ],
    caps: [
      ...capsComunes,
      {
        cap_source: "scope_mismatch",
        capped_level: "medium",
        reason:
          "El alcance declarado es el agregado del negocio; sin series segmentadas no se puede afirmar donde pasa exactamente.",
      },
    ],
  });

  // --- Capa `symptom`: Â¿que patron forman? ---------------------------------
  if (symptom) {
    const nivelSintomaBase = capTo(
      symptom.confidence === "high" ? "high" : symptom.confidence === "medium" ? "medium" : "low",
      techo,
    );
    const nivelSintoma = lecturaCausal.available && lecturaCausal.alternatives === "strong"
      ? nivelSintomaBase
      : minConfidence(nivelSintomaBase, "medium");
    claims.push({
      claim_layer: "symptom",
      claim: `Las senales forman el patron "${symptom.label}".`,
      target_question: "Â¿Que patron forman los movimientos juntos?",
      epistemic_state: "derived",
      confidence_level: nivelSintoma,
      // Guardrail 25: la separacion frente a alternativas llega desde D08;
      // cuando falta, el sintoma no se presenta como una explicacion.
      alternative_separation: lecturaCausal.available ? lecturaCausal.alternatives : "unknown",
      contradiction_level: symptom.compatible_direction ? "none" : "material",
      completeness: "partial",
      explanatory_coverage: "unknown",
      negative_claim_state: null,
      coverage_declared: null,
      capped_at: nivelSintoma === "medium" ? "medium" : techo,
      cap_reason: lecturaCausal.available
        ? lecturaCausal.limitations
        : "Sin grafo causal no hay rutas rivales que descartar, asi que un patron no puede pasar de probable.",
      desired_level: "high",
      missing_evidence: lecturaCausal.available
        ? (lecturaCausal.alternatives === "unknown" ? "Hipotesis rivales de D08 con las que contrastar este patron." : null)
        : "Rutas causales rivales de D07 con las que contrastar este patron.",
      next_evidence_required: lecturaCausal.available
        ? (lecturaCausal.alternatives === "unknown" ? "Generar y contrastar hipotesis rivales." : null)
        : "Ejecutar D07 y D08 para este caso.",
      error_cost: "moderate",
      limitations: lecturaCausal.available
        ? "El patron tiene una ruta causal enlazada, pero sigue separado de una explicacion completa."
        : "Un patron coherente no es una explicacion: que dos metricas se muevan juntas y esten relacionadas no dice cual mueve a cual.",
      dimensions: [
        dimension(
          "evidence_consistency",
          symptom.compatible_direction ? "adequate" : "weak",
          symptom.compatible_direction
            ? "Las senales del patron se mueven en sentidos compatibles."
            : "Hay senales del patron moviendose en sentidos opuestos, y eso no se ha resuelto.",
        ),
        dimension(
          "context_quality",
          symptom.context_reviewed ? "adequate" : "weak",
          symptom.context_reviewed
            ? "D02 contextualizo el movimiento contra su baseline."
            : "D02 no ha contextualizado este movimiento todavia.",
        ),
        dimension(
          "mechanism_strength",
          symptom.known_relationship ? "weak" : "absent",
          symptom.known_relationship
            ? "Hay una relacion declarada entre las metricas, pero declarar una relacion no es demostrar un mecanismo."
            : "No hay ninguna relacion declarada entre estas metricas: coinciden en el tiempo y nada mas.",
        ),
      ],
      caps: [
        ...capsComunes,
        {
          cap_source: "external_cause_unobserved",
          capped_level: "medium",
          reason:
            "No existe grafo causal, asi que ninguna causa externa se ha podido descartar para este patron.",
        },
      ],
    });
  }

  // --- Capa `current_impact`: Â¿cuanto cuesta? ------------------------------
  if (severity?.has_measurement) {
    claims.push({
      claim_layer: "current_impact",
      claim: `El movimiento de ${targetMetric} tiene un impacto economico medido sobre la base declarada.`,
      target_question: "Â¿Cuanto dinero se ha movido?",
      // La cuenta es una resta contra un baseline, y un baseline es un modelo:
      // derivado, no observado.
      epistemic_state: "derived",
      confidence_level: capTo(
        severity.measurement_compromised ? "low" : severity.impact_confidence === "high" ? "high" : "medium",
        techo,
      ),
      alternative_separation: "not_applicable",
      contradiction_level: "none",
      completeness: "partial",
      explanatory_coverage: "unknown",
      negative_claim_state: null,
      coverage_declared: null,
      capped_at: capTo("medium", techo),
      cap_reason:
        "La cifra es la diferencia contra un baseline que no se ajusta por estacionalidad ni calendario comercial.",
      desired_level: "high",
      missing_evidence:
        "Ajuste por estacionalidad en D05 y coste por referencia para poder medir contribucion y no solo facturacion.",
      next_evidence_required: "Rellenar el coste por variante en Shopify.",
      error_cost: "high",
      limitations:
        "Se mide el efecto sobre la facturacion, no sobre el margen: sin coste por referencia, lo que el negocio deja de ganar de verdad no se sabe.",
      dimensions: [
        dimension(
          "data_coverage",
          "weak",
          "No hay coste por referencia, asi que la dimension de contribucion queda sin medir.",
        ),
      ],
      caps: capsComunes,
    });
  }

  // --- Capas `why`, `root_cause` y `constraint` -----------------------------
  //
  // Estas tres siguen siendo desconocidas cuando el caso todavia no tiene
  // salidas causales enlazadas. Cuando D07-D09 ya han escrito su fotografia,
  // `buildCausalClaims` conserva su estado real y sus limites.
  if (lecturaCausal.available) {
    claims.push(...buildCausalClaims(input, lecturaCausal, capsComunes, techo));
  } else for (const capa of ["why", "root_cause", "constraint"] as const) {
    claims.push({
      claim_layer: capa,
      claim:
        capa === "why"
          ? `No puede determinarse por que se movio ${targetMetric}.`
          : capa === "root_cause"
            ? "No puede determinarse cual es la causa raiz de este caso."
            : "No puede determinarse que cuello de botella limita a este negocio.",
      target_question:
        capa === "why"
          ? "Â¿Por que ha pasado esto?"
          : capa === "root_cause"
            ? "Â¿Cual es la causa de fondo?"
            : "Â¿Que le esta limitando?",
      epistemic_state: "unknown",
      // Guardrail 22: no saber es no saber. UNKNOWN solo va con
      // INSUFFICIENT_DATA, y el esquema lo rechaza de otra forma.
      confidence_level: "insufficient_data",
      alternative_separation: "none",
      contradiction_level: "none",
      completeness: "incomplete",
      explanatory_coverage: "minimal",
      negative_claim_state: "no_evidence",
      coverage_declared: null,
      capped_at: null,
      cap_reason: null,
      desired_level: "medium",
      missing_evidence:
        "Las salidas de D07, D08 y D09 enlazadas a este caso.",
      next_evidence_required:
        "Ejecutar los motores causales para este caso.",
      error_cost: "severe",
      limitations:
        "Este caso no tiene causa. Lo que hay es un movimiento medido y un patron coherente, y ninguna de las dos cosas explica nada por si sola.",
      dimensions: [
        dimension(
          "mechanism_strength",
          "absent",
          "No hay una salida causal enlazada a este caso: no hay un mecanismo evaluado que conecte estas metricas.",
        ),
        dimension(
          "missing_evidence",
          "absent",
          "Faltan las salidas causales de D07, D08 y D09 para este caso, no una pieza suelta del texto.",
        ),
      ],
      caps: capsComunes,
    });
  }

  // --- Capa `overall`: Â¿se puede cerrar este caso? -------------------------
  //
  // NO es una media de las anteriores. La regla viene de D00: un diagnostico es
  // una explicacion, y una explicacion sin causa no es un diagnostico. Por eso
  // el techo de `overall` es el nivel de la capa `why`, que hoy es siempre
  // insuficiente. No es un umbral inventado: es la definicion del bloque.
  const nivelWhy = claims.find((c) => c.claim_layer === "why")?.confidence_level ?? "insufficient_data";
  claims.push({
    claim_layer: "overall",
    claim: lecturaCausal.available && lecturaCausal.root
      ? `El caso sobre ${targetMetric} tiene una explicacion causal ${lecturaCausal.coverage === "full" ? "completa" : "parcial"}.`
      : `El caso sobre ${targetMetric} no puede concluirse.`,
    target_question: targetQuestion,
    epistemic_state: lecturaCausal.available ? "inferred" : "unknown",
    confidence_level: nivelWhy,
    alternative_separation: "none",
    contradiction_level: "none",
    completeness: lecturaCausal.available ? lecturaCausal.completeness : "incomplete",
    explanatory_coverage: lecturaCausal.available ? lecturaCausal.coverage : "minimal",
    negative_claim_state: lecturaCausal.available ? null : "no_evidence",
    coverage_declared: null,
    capped_at: nivelWhy,
    cap_reason: lecturaCausal.available
      ? lecturaCausal.limitations
      : "La confianza de un diagnostico no puede superar la que tiene en su causa: sin causa no hay explicacion, y sin explicacion no hay diagnostico (D00, apartado 2).",
    desired_level: lecturaCausal.available ? null : "medium",
    missing_evidence: lecturaCausal.available ? "Validar la parte residual de la explicacion causal." : "La capa causal entera.",
    next_evidence_required: lecturaCausal.available ? "Completar la validacion causal y el contrafactual pendiente." : "Cerrar D07, D08 y D09.",
    error_cost: "severe",
    limitations: lecturaCausal.available
      ? lecturaCausal.limitations
      : "Lo que este caso sabe es que algo se movio, que patron forma y cuanto costo. Presentarlo como un diagnostico seria dar por explicado lo que solo esta descrito.",
    dimensions: [
      dimension(
        "missing_evidence",
        lecturaCausal.available ? "weak" : "absent",
        lecturaCausal.available
          ? "La explicacion tiene evidencia causal, pero conserva residuo declarado."
          : "El caso no tiene ninguna capa causal resuelta, que es lo que lo convertiria en un diagnostico.",
      ),
    ],
    caps: capsComunes,
  });

  const uncertainties: ConfidenceEngineOutput["uncertainties"] = [
    {
      uncertainty_type: "causal",
      description: lecturaCausal.available
        ? lecturaCausal.limitations
        : "No existe grafo causal declarado en el sistema, asi que ningun caso puede pasar de describir lo que ocurre a explicarlo. Afecta a todos los casos por igual.",
      materiality: lecturaCausal.available ? "material" : "critical_unknown",
      is_known_unknown: true,
      resolvability: "resolvable_now",
      required_evidence: lecturaCausal.available
        ? "Validacion adicional de la ruta, separacion de alternativas y resolucion del residuo causal."
        : "Las relaciones causales del ecommerce escritas a mano: que mueve a que, con que mecanismo y en que direccion.",
      claim_layer: "why",
    },
  ];

  if (!signal) {
    uncertainties.push({
      uncertainty_type: "data",
      description:
        "No hay ninguna senal en la ventana del caso, asi que no se sabe si la metrica se movio o si simplemente no se ha medido.",
      materiality: "material",
      is_known_unknown: true,
      resolvability: "resolvable_now",
      required_evidence: "Una pasada del motor de senales sobre esta ventana.",
      claim_layer: "what",
    });
  }

  if (severity?.has_measurement) {
    uncertainties.push({
      uncertainty_type: "impact",
      description:
        "El impacto se mide sobre facturacion y no sobre contribucion, porque no hay coste por referencia. El dano real sobre el margen puede ser muy distinto del medido.",
      materiality: "material",
      is_known_unknown: true,
      resolvability: "with_new_data",
      required_evidence: "Coste por variante en Shopify, o la fuente que lo tenga.",
      claim_layer: "current_impact",
    });
  }

  return { claims, uncertainties };
}


