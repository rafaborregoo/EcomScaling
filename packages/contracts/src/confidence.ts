/**
 * FASE 3 / D11 — Confianza e incertidumbre.
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
  /\b(esta claro que|está claro que|es evidente|obviamente|con total seguridad|queda demostrado|no cabe duda)\b/i;

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
