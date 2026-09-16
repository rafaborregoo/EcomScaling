/**
 * FASE 3 / D08 — Generador y contraste de hipotesis.
 *
 * Fuentes: `02-contratos-IA/d08-requisitos-contrato-hipotesis.md` (26 apartados),
 * `04-policies-guardrails/d08-guardrails-hipotesis.md` (60 guardrails),
 * `05-experience-learning/d08-historial-y-calibracion-de-hipotesis.md`,
 * `06-tenant-context/d08-contexto-motor-hipotesis.md`.
 *
 * D07 deja ramas que sobreviven. D08 las convierte en hipotesis explicitas y las
 * somete a prueba. Sigue sin decidir la causa raiz (guardrail 45, eso es D09) ni
 * producir accion ni prioridad (25).
 *
 * ESTO NO DEFINE UNA SEGUNDA HIPOTESIS. `hypothesisSchema` de D00 es la misma
 * entidad en su version minima; aqui se extiende. Dos definiciones de H1 acaban
 * diciendo cosas distintas sobre H1.
 *
 * La mitad de los guardrails de este bloque describen el mismo error con
 * disfraces: quedarse con la primera explicacion que encaja. Por eso casi todas
 * las reglas de abajo miran lo que NO se hizo -- que alternativas no se
 * probaron, que evidencia en contra no se busco, que fuente se conto dos veces.
 */
import { z } from "zod";

import {
  type DiagnosticInvariantViolation,
  HYPOTHESIS_STATUSES,
  hypothesisSchema,
} from "./diagnostics.js";
import { SYMPTOM_FAMILIES } from "./symptoms.js";

/** Apartado 2. */
export const HYPOTHESIS_TYPES = [
  "direct_cause",
  "contributory_cause",
  "root_cause_candidate",
  "contextual_explanation",
  "data_quality_explanation",
  "structural_explanation",
  "external_explanation",
  "interaction_hypothesis",
] as const;

/** Los tipos que afirman causalidad y por tanto exigen ruta causal en D07 (guardrail 19). */
export const CAUSAL_HYPOTHESIS_TYPES = [
  "direct_cause",
  "contributory_cause",
  "root_cause_candidate",
] as const;

/** Apartado 10. `challenger` existe porque el guardrail 12 lo exige vivo. */
export const HYPOTHESIS_ROLES = ["primary", "secondary", "alternative", "challenger"] as const;

/** Apartado 11. `insufficient` no es un fracaso: el guardrail 35 lo prefiere al teatro. */
export const HYPOTHESIS_CONFIDENCE = ["high", "medium", "low", "insufficient"] as const;

/** Apartado 13, separado de la confianza por el guardrail 6. */
export const EXPLANATORY_COVERAGE = ["full", "partial", "minimal", "unknown"] as const;

/** Apartado 20. */
export const UNCERTAINTY_KINDS = ["data", "model", "context", "causal"] as const;

/** Apartado 19. */
export const CAUSE_TIMING = ["acute", "structural"] as const;
export const CAUSE_DEPTH = ["immediate", "underlying"] as const;

/**
 * Guardrail 5, hecho vocabulario. **No observado no es observado ausente.**
 * `not_observed` significa que nadie ha mirado; `observed_absent`, que se miro y
 * no estaba. Confundirlos es como una hipotesis sobrevive a una comprobacion que
 * nunca se hizo.
 */
export const OBSERVATION_KINDS = ["observed_present", "observed_absent", "not_observed"] as const;

export const EVIDENCE_FRESHNESS = ["fresh", "aging", "stale", "unknown"] as const;

/** Los estados en los que la hipotesis se esta afirmando hacia fuera. */
export const ASSERTIVE_STATUSES = ["supported", "most_likely", "confirmed"] as const;

export const engineHypothesisFields = z.object({
  hypothesis_id: z.string().min(1),
  code: z.string().min(1).max(8),
  statement: z.string().min(1),
  hypothesis_type: z.enum(HYPOTHESIS_TYPES).default("contextual_explanation"),
  family: z.enum(SYMPTOM_FAMILIES).optional(),
  target_node_id: z.string().optional(),
  /** La ruta de D07. Guardrail 19: sin ella no hay hipotesis causal. */
  source_path_id: z.string().optional(),
  scope: z.string().default("business"),

  status: z.enum(HYPOTHESIS_STATUSES).default("untested"),
  rejection_reason: z.string().optional(),
  confidence: z.enum(HYPOTHESIS_CONFIDENCE).default("insufficient"),
  /** Guardrail 2: el prior no es la conclusion, por eso es otra columna. */
  prior_plausibility: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
  explanatory_coverage: z.enum(EXPLANATORY_COVERAGE).default("unknown"),
  unexplained_residual_material: z.boolean().default(false),

  root_cause_candidate: z.boolean().default(false),
  cause_timing: z.enum(CAUSE_TIMING).optional(),
  cause_depth: z.enum(CAUSE_DEPTH).optional(),

  relative_role: z.enum(HYPOTHESIS_ROLES).optional(),
  separation: z.enum(["high", "low", "unknown"]).default("unknown"),
  uncertainty_kinds: z.array(z.enum(UNCERTAINTY_KINDS)).default([]),

  falsification_condition: z.string().optional(),
  why_it_wins: z.string().optional(),
  why_alternatives_lose: z.string().optional(),
  proposing_agent: z.string().optional(),
});

export const engineHypothesisSchema = engineHypothesisFields
  // Guardrail 19: sin ruta causal valida, la candidata se descarta.
  .refine(
    (h) =>
      !(CAUSAL_HYPOTHESIS_TYPES as readonly string[]).includes(h.hypothesis_type) ||
      h.source_path_id != null,
    { message: "Una hipotesis causal necesita una ruta de D07 (guardrail 19)." },
  )
  // Guardrail 32: confirmar tiene que costar.
  .refine(
    (h) =>
      h.status !== "confirmed" ||
      (h.confidence === "high" && h.falsification_condition != null && h.separation === "high"),
    { message: "CONFIRMED debe ser raro y caro (guardrails 32 y 60)." },
  )
  // Guardrails 12 y 34.
  .refine(
    (h) =>
      h.confidence !== "high" || (h.separation === "high" && h.why_alternatives_lose != null),
    { message: "Confianza alta exige separacion y saber por que pierden las otras." },
  )
  // Guardrails 57 a 60.
  .refine(
    (h) =>
      h.relative_role !== "primary" ||
      (h.why_it_wins != null &&
        h.why_alternatives_lose != null &&
        h.falsification_condition != null),
    { message: "La hipotesis primaria explica por que gana, por que pierden las otras y que la falsaria." },
  )
  // Guardrail 36.
  .refine((h) => h.explanatory_coverage !== "full" || !h.unexplained_residual_material, {
    message: "No hay explicacion completa con residual material (guardrail 36).",
  })
  // Guardrail 37.
  .refine(
    (h) => h.hypothesis_type !== "contributory_cause" || h.explanatory_coverage !== "full",
    { message: "Una causa parcial se queda parcial (guardrail 37)." },
  )
  // Guardrails 4 y 17.
  .refine((h) => !h.root_cause_candidate || h.falsification_condition != null, {
    message: "Una candidata a raiz tiene que decir que la falsaria (guardrails 4 y 17).",
  });

export type EngineHypothesis = z.infer<typeof engineHypothesisSchema>;

export const hypothesisEvidenceSchema = z.object({
  evidence_id: z.string().min(1),
  hypothesis_id: z.string().min(1),
  relation: z.enum(["supports", "contradicts", "discriminates", "inconclusive"]),
  source_system: z.string().optional(),
  observation_kind: z.enum(OBSERVATION_KINDS).default("observed_present"),
  independent: z.boolean().default(false),
  reliability: z.enum(["high", "medium", "low"]).optional(),
  freshness: z.enum(EVIDENCE_FRESHNESS).default("unknown"),
});

export type HypothesisEvidence = z.infer<typeof hypothesisEvidenceSchema>;

export const diagnosticTestSchema = z
  .object({
    test_id: z.string().min(1),
    hypothesis_id: z.string().min(1),
    diagnostic_question: z.string().min(1),
    expected_if_true: z.string().min(10),
    expected_if_false: z.string().min(10),
    information_gain: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
    cost: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
    availability: z
      .enum(["available", "needs_user", "needs_integration", "unavailable", "unknown"])
      .default("unknown"),
    mode: z.enum(["passive", "active"]).default("passive"),
    status: z.enum(["proposed", "running", "done", "skipped", "blocked"]).default("proposed"),
  })
  // Guardrails 46 y 47: primero el dato del sistema. No se le pregunta al
  // usuario algo que ya esta guardado.
  .refine((t) => t.availability !== "available" || t.mode === "passive", {
    message: "No se le pide al usuario un dato que ya esta en el sistema (guardrails 46 y 47).",
  });

export type DiagnosticTest = z.infer<typeof diagnosticTestSchema>;

export type HypothesisCheckInput = {
  hypotheses: EngineHypothesis[];
  evidence?: HypothesisEvidence[];
  tests?: DiagnosticTest[];
  /** Nodos que son metricas de resultado, para el guardrail 43. */
  outcomeNodeIds?: string[];
};

/**
 * Las reglas que miran el conjunto: que alternativas se barajaron, que evidencia
 * en contra se busco, que fuente se conto dos veces.
 */
export function checkHypothesisInvariants(
  input: HypothesisCheckInput,
): DiagnosticInvariantViolation[] {
  const violations: DiagnosticInvariantViolation[] = [];
  const evidence = input.evidence ?? [];
  const tests = input.tests ?? [];
  const outcomes = new Set(input.outcomeNodeIds ?? []);
  const asertivas = new Set<string>(ASSERTIVE_STATUSES);

  const afirmadas = input.hypotheses.filter((h) => asertivas.has(h.status));

  // Guardrails 1, 9 y 10: la primera causa plausible no es un diagnostico.
  if (afirmadas.length > 0 && input.hypotheses.length === 1) {
    violations.push({
      rule: "primera_plausible_no_es_diagnostico",
      source: "D08 guardrails 1, 9 y 10",
      message:
        "Se afirma una explicacion sin haber barajado ninguna alternativa. La primera causa plausible no es un diagnostico.",
    });
  }

  for (const h of input.hypotheses) {
    const suya = evidence.filter((e) => e.hypothesis_id === h.hypothesis_id);
    const aFavor = suya.filter((e) => e.relation === "supports");
    const enContra = suya.filter((e) => e.relation === "contradicts");
    const susTests = tests.filter((t) => t.hypothesis_id === h.hypothesis_id);

    // Guardrails 13 y 14: buscar activamente evidencia en contra.
    if (asertivas.has(h.status) && suya.length > 0 && enContra.length === 0) {
      const buscoContraste = susTests.some((t) => t.status === "done");
      if (!buscoContraste) {
        violations.push({
          rule: "sesgo_de_confirmacion",
          source: "D08 guardrails 13 y 14",
          message: `"${h.code}" se afirma habiendo recogido solo evidencia a favor y sin ningun test ejecutado que pudiera contradecirla.`,
        });
      }
    }

    // Guardrails 21 y 22: dos lecturas del mismo sitio no son dos fuentes.
    if (h.confidence === "high" && aFavor.length >= 2) {
      const sistemas = new Set(
        aFavor.map((e) => e.source_system).filter((s): s is string => Boolean(s)),
      );
      if (sistemas.size === 1 && !aFavor.some((e) => e.independent)) {
        violations.push({
          rule: "fuentes_no_independientes",
          source: "D08 guardrails 21 y 22",
          message: `"${h.code}" apoya su confianza alta en ${aFavor.length} evidencias que salen todas de "${[...sistemas][0]}".`,
        });
      }
    }

    // Guardrail 5: lo que nadie ha mirado no contradice nada.
    const noObservadaQueContradice = suya.filter(
      (e) => e.observation_kind === "not_observed" && e.relation === "contradicts",
    );
    if (noObservadaQueContradice.length > 0) {
      violations.push({
        rule: "no_observado_no_es_ausencia",
        source: "D08 guardrail 5 y principio 5",
        message: `"${h.code}" usa como contradiccion algo que no se ha llegado a observar. No haber mirado no es haber visto que no pasa.`,
      });
    }

    // Guardrail 25: la evidencia rancia se degrada, no se ignora.
    if (asertivas.has(h.status) && aFavor.length > 0 && aFavor.every((e) => e.freshness === "stale")) {
      violations.push({
        rule: "evidencia_rancia_no_sostiene",
        source: "D08 guardrail 25",
        message: `"${h.code}" se sostiene solo en evidencia marcada como rancia.`,
      });
    }

    // Guardrails 23 y 24: si dos fuentes fiables se contradicen, no se fuerza
    // la resolucion.
    if (h.status === "confirmed") {
      const contradiccionFiable = enContra.some((e) => e.reliability === "high");
      if (contradiccionFiable) {
        violations.push({
          rule: "conflicto_no_se_fuerza",
          source: "D08 guardrails 23 y 24",
          message: `"${h.code}" se da por confirmada con evidencia fiable que la contradice sin resolver.`,
        });
      }
    }

    // Guardrail 43: no quedarse en una metrica de resultado como candidata a raiz.
    if (h.root_cause_candidate && h.target_node_id && outcomes.has(h.target_node_id)) {
      violations.push({
        rule: "downstream_no_es_raiz",
        source: "D08 guardrail 43",
        message: `"${h.code}" propone como candidata a raiz una metrica de resultado. Eso es donde se ve el problema, no de donde viene.`,
      });
    }

    // Guardrails 51 y 52: que lo proponga un agente especializado no es evidencia.
    if (h.proposing_agent && ["high", "medium"].includes(h.confidence) && suya.length === 0) {
      violations.push({
        rule: "agente_no_es_evidencia",
        source: "D08 guardrails 51 y 52",
        message: `"${h.code}" gana confianza sin una sola evidencia: lo unico que la sostiene es que la propuso ${h.proposing_agent}.`,
      });
    }

    // Guardrails 48 y 49: la evidencia barata y con mas informacion, primero.
    const pendienteCaro = susTests.find(
      (t) => t.status === "proposed" && t.cost === "high" && t.mode === "active",
    );
    const pendienteBarato = susTests.find(
      (t) =>
        t.status === "proposed" &&
        t.mode === "passive" &&
        t.cost === "low" &&
        t.information_gain === "high",
    );
    if (pendienteCaro && pendienteBarato) {
      violations.push({
        rule: "evidencia_barata_primero",
        source: "D08 guardrails 48 y 49",
        message: `"${h.code}" propone un test caro e intrusivo teniendo pendiente uno pasivo, barato y mas informativo.`,
      });
    }
  }

  // Guardrail 12: mientras haya incertidumbre material, el challenger vive.
  const hayIncertidumbre = input.hypotheses.some(
    (h) => asertivas.has(h.status) && h.confidence !== "high",
  );
  if (
    hayIncertidumbre &&
    input.hypotheses.length > 1 &&
    !input.hypotheses.some((h) => h.relative_role === "challenger" || h.relative_role === "alternative")
  ) {
    violations.push({
      rule: "challenger_retirado_pronto",
      source: "D08 guardrail 12",
      message:
        "Se afirma una explicacion con incertidumbre material y ninguna hipotesis queda como alternativa o challenger.",
    });
  }

  // Guardrails 41 y 42: dos formas de decir lo mismo no son dos hipotesis.
  const vistas = new Map<string, string>();
  for (const h of input.hypotheses) {
    if (!asertivas.has(h.status) && h.status !== "under_test") continue;
    const clave = `${h.hypothesis_type}|${h.target_node_id ?? ""}|${h.scope}`;
    const previa = vistas.get(clave);
    if (previa) {
      violations.push({
        rule: "doble_conteo",
        source: "D08 guardrails 41 y 42",
        message: `"${h.code}" y "${previa}" son la misma hipotesis contada dos veces (mismo tipo, target y scope).`,
      });
    } else {
      vistas.set(clave, h.code);
    }
  }

  return violations;
}

/** Puente explicito con D00: toda hipotesis del motor es una hipotesis del caso. */
export function toCaseHypothesis(h: EngineHypothesis) {
  return hypothesisSchema.parse({
    code: h.code,
    statement: h.statement,
    status: h.status,
    rejection_reason: h.rejection_reason ?? null,
  });
}

// ---------------------------------------------------------------------------
// EL MOTOR (apartados 2 a 25)
// ---------------------------------------------------------------------------
//
// Todo lo que sigue es puro: entran las rutas que dejo D07 y sale un conjunto de
// hipotesis explicitas con su test siguiente. La parte sucia vive en
// `apps/api/src/hypothesis-engine.ts`.
//
// LA DECISION QUE ORDENA EL RESTO: **D08 no elige, D08 enumera y descarta**. El
// guardrail 1 dice que la primera causa plausible no es un diagnostico, y el 12
// que mientras haya incertidumbre material el challenger sigue vivo. Un motor
// que devolviera "la explicacion es X" estaria rompiendo los dos a la vez. Este
// devuelve todas, con el estado de cada una y **por que** las descartadas lo
// estan -- que es la parte que nadie guarda y la que evita repetir la misma
// busqueda el mes que viene.
//
// Y LA SEGUNDA, QUE ES LA QUE APORTA DE VERDAD: **siempre que una ruta pase por
// una metrica observada sin validar, se emite ademas la hipotesis de que no haya
// pasado nada**. Un fallo de tracking mueve las sesiones sin mover el negocio.
// Esa explicacion no sale de ninguna ruta causal --no la hay-- y es la unica que
// puede tumbar a todas las demas de golpe. Es el challenger del guardrail 12, y
// por eso lo escribe el motor y no se deja a que alguien se acuerde.

/** Una ruta de D07, aplanada con lo que D08 necesita de ella. */
export type PathForHypothesis = {
  path_id: string;
  target_node_id: string;
  target_label: string;
  status: "supported" | "contradicted" | "untested" | "partial";
  missing_evidence: readonly string[];
  next_evidence: string | null;
  /**
   * El nodo mas rio arriba de la cadena: **de quien habla la hipotesis**.
   *
   * Es este, y no el target del caso, el que va a `diagnostic_hypotheses.
   * target_node_id`. Lo confirma el guardrail 43: la regla comprueba que una
   * candidata a raiz no apunte a una metrica de resultado, y eso solo tiene
   * sentido si la columna guarda la **causa propuesta** y no el sintoma. Poner
   * ahi el target del caso hace ademas que todas las ramas parezcan la misma
   * hipotesis contada N veces, y el invariante `doble_conteo` lo canta.
   */
  origin_node_id: string;
  origin_code: string;
  origin_label: string;
  /** Si alguien vigila esa metrica. Ver la cabecera del motor de D07. */
  origin_measured: boolean;
  /** Si el origen sale del tracking y no del registro. */
  origin_is_observed_metric: boolean;
  capability: string | null;
  /**
   * Los nodos intermedios entre el origen y el target, en orden.
   *
   * Sin esto la frase miente cuando la cadena tiene mas de un paso: "las ventas
   * estan en las sesiones, que entran en su formula" es falso -- las sesiones
   * entran en la formula de los **pedidos**, y los pedidos en la de las ventas.
   * Aplanar la cadena convierte una explicacion de dos saltos en una relacion
   * directa que nadie ha declarado.
   */
  mediator_labels: readonly string[];
  /** Los encajes del paso mas rio arriba. */
  temporal_fit: string;
  scope_fit: string;
  magnitude_fit: string;
  /** De la arista mas rio arriba. */
  relation_type: string;
  edge_evidence_level: string;
  all_mathematical: boolean;
  evidence: readonly { stance: string; observation: string }[];
};

export type HypothesisTestDraft = {
  diagnostic_question: string;
  required_data: string | null;
  expected_if_true: string;
  expected_if_false: string;
  information_gain: "high" | "medium" | "low" | "unknown";
  cost: "high" | "medium" | "low" | "unknown";
  latency: "high" | "medium" | "low" | "unknown";
  availability: "available" | "needs_user" | "needs_integration" | "unavailable" | "unknown";
  intrusiveness: "none" | "low" | "medium" | "high" | "unknown";
  mode: "passive" | "active";
};

export type HypothesisDraft = {
  code: string;
  statement: string;
  hypothesis_type: (typeof HYPOTHESIS_TYPES)[number];
  source_path_id: string | null;
  target_node_id: string | null;
  family: (typeof SYMPTOM_FAMILIES)[number] | null;
  status: string;
  rejection_reason: string | null;
  confidence: (typeof HYPOTHESIS_CONFIDENCE)[number];
  prior_plausibility: "high" | "medium" | "low" | "unknown";
  explanatory_coverage: (typeof EXPLANATORY_COVERAGE)[number];
  unexplained_residual_material: boolean;
  residual_note: string | null;
  root_cause_candidate: boolean;
  relative_role: (typeof HYPOTHESIS_ROLES)[number] | null;
  separation: "high" | "low" | "unknown";
  uncertainty_kinds: (typeof UNCERTAINTY_KINDS)[number][];
  temporal_fit: string;
  scope_fit: string;
  magnitude_fit: string;
  mechanism_fit: string;
  falsification_condition: string | null;
  limitations: string | null;
  evidence: {
    relation: "supports" | "contradicts" | "discriminates" | "inconclusive";
    observation: string;
    observation_kind: (typeof OBSERVATION_KINDS)[number];
    directness: "direct" | "indirect" | "proxy";
    specificity: "specific" | "ambiguous" | "unknown";
    freshness: (typeof EVIDENCE_FRESHNESS)[number];
    source_system: string;
  }[];
  test: HypothesisTestDraft | null;
};

export type HypothesisEngineInput = {
  caseId: string;
  targetMetric: string;
  scope: string;
  paths: readonly PathForHypothesis[];
};

/**
 * El prior de la hipotesis sale del **nivel de evidencia declarado en la
 * arista**, no de lo bien que encaje con el caso.
 *
 * Guardrail 2: el prior no es la conclusion. Son dos columnas distintas justo
 * para que "esto suele pasar" no se lea como "esto esta pasando". Mezclarlas es
 * como se acaba afirmando que una tienda tiene un problema porque el libro dice
 * que suele ocurrir.
 */
export function priorFromEdge(evidenceLevel: string): "high" | "medium" | "low" | "unknown" {
  switch (evidenceLevel) {
    case "deterministic":
      return "high";
    case "strongly_established":
    case "common_mechanism":
      return "medium";
    case "plausible":
      return "low";
    default:
      return "unknown";
  }
}

/**
 * Cuanto explica, que **no** es cuanto nos fiamos (guardrail 6).
 *
 * Y nunca `full`: aunque el factor de cuenta del movimiento entero, por que se
 * movio el factor sigue sin explicarse. El residual siempre es material aqui, y
 * el check `cobertura_vs_residual` no dejaria decir otra cosa.
 */
export function coverageFromMagnitude(
  magnitudeFit: string,
): (typeof EXPLANATORY_COVERAGE)[number] {
  if (magnitudeFit === "sufficient") return "partial";
  if (magnitudeFit === "partial") return "minimal";
  return "unknown";
}

/** El estado del caso, traducido al vocabulario de D00. */
export function statusFromPath(status: PathForHypothesis["status"]): string {
  switch (status) {
    case "contradicted":
      return "contradicted";
    case "untested":
      return "untested";
    default:
      return "under_test";
  }
}

/**
 * Que la falsaria, dicho como una comprobacion y no como una intencion.
 *
 * Es el campo mas util de la tabla y el que el esquema exige para cualquier
 * candidata a raiz: una hipotesis que no dice que la tumbaria no se puede
 * comprobar, y una que no se puede comprobar no se puede descartar nunca.
 */
export function falsificationFor(path: PathForHypothesis): string {
  if (path.all_mathematical) {
    return `Que "${path.origin_label}" no se haya movido en la ventana del caso: si la serie esta plana, este factor no explica nada de lo que paso con "${path.target_label}".`;
  }
  return `Que "${path.origin_label}" se haya movido sin que "${path.target_label}" le siguiera en algun periodo comparable: el mecanismo declarado dejaria de sostenerse.`;
}

function porDonde(path: PathForHypothesis): string {
  return path.mediator_labels.length > 0
    ? `, a traves de ${path.mediator_labels.map((m) => `"${m}"`).join(" y ")}`
    : "";
}

function enunciado(path: PathForHypothesis): string {
  const via = porDonde(path);
  if (path.status === "untested") {
    return `El movimiento de "${path.target_label}" podria venir de "${path.origin_label}"${via}, pero nadie lo mide: la rama no se puede ni confirmar ni descartar.`;
  }
  if (path.all_mathematical) {
    return `El movimiento de "${path.target_label}" viene de "${path.origin_label}"${via}, por la cadena de formulas que los une. Por que se movio "${path.origin_label}" sigue sin explicarse.`;
  }
  return `"${path.origin_label}" movio a "${path.target_label}"${via} por el mecanismo declarado en el grafo.`;
}

function motivoDelDescarte(path: PathForHypothesis): string {
  const enContra = path.evidence.find((e) => e.stance === "contradicting");
  return (
    enContra?.observation ??
    `La ruta hacia "${path.target_label}" quedo contradicha al comprobarla contra el caso.`
  );
}

/**
 * El siguiente test de una hipotesis (apartados 21 a 25).
 *
 * DOS REGLAS DEL ESQUEMA MANDAN AQUI. La primera: no se le pregunta a nadie algo
 * que ya esta guardado (guardrails 46 y 47), y el check
 * `no_preguntar_lo_que_ya_hay` lo impone -- si el dato esta `available`, el test
 * es `passive` y punto. La segunda: la prediccion tiene que ser util, asi que hay
 * que decir **que se veria si es verdad y que si es mentira**. Un test cuyo
 * resultado encaja con las dos cosas no discrimina nada.
 */
export function testFor(path: PathForHypothesis): HypothesisTestDraft | null {
  if (path.status === "contradicted") return null;

  if (!path.origin_measured) {
    return {
      diagnostic_question: `¿Como se ha movido "${path.origin_label}" en la ventana del caso?`,
      required_data: `Una serie diaria de "${path.origin_label}" para el periodo analizado.`,
      expected_if_true: `La serie se mueve en el mismo sentido que "${path.target_label}" y en una magnitud compatible con la relacion declarada.`,
      expected_if_false: `La serie se mantiene plana o se mueve al reves, y entonces esta rama queda descartada como el resto.`,
      information_gain: "high",
      cost: "unknown",
      latency: "unknown",
      // No es que haya que preguntarle a nadie: es que falta conectar la fuente.
      availability: "needs_integration",
      intrusiveness: "none",
      mode: "passive",
    };
  }

  return {
    diagnostic_question: `¿Que se movio antes o a la vez que "${path.origin_label}" y podria explicarlo?`,
    required_data: `El contexto declarado del periodo y los confusores de D02 para la ventana del caso.`,
    expected_if_true: `Aparece un cambio declarado --campana, precio, stock, temporada-- que precede al movimiento de "${path.origin_label}" y encaja con su magnitud.`,
    expected_if_false: `No hay ningun cambio declarado en la ventana, y entonces el movimiento sigue sin explicacion aunque su localizacion sea correcta.`,
    information_gain: "medium",
    cost: "low",
    latency: "low",
    // El contexto de D02 ya esta guardado: preguntarlo fuera seria pedir algo
    // que la plataforma tiene.
    availability: "available",
    intrusiveness: "none",
    mode: "passive",
  };
}

/**
 * De las rutas de D07 a hipotesis explicitas.
 *
 * Una por ruta, mas la del tracking cuando toca. Ninguna sale afirmada: el
 * maximo es `under_test`, porque ninguna ruta de D07 llega hoy a soportada y
 * afirmar por encima de lo que sostiene la capa de abajo es justo lo que el
 * techo de D11 impide.
 */
export function generateHypotheses(input: HypothesisEngineInput): HypothesisDraft[] {
  const salida: HypothesisDraft[] = [];

  const vivas = input.paths.filter((p) => p.status !== "contradicted").length;
  // Guardrail 12 y apartado 10: con varias explicaciones en pie y ninguna
  // separada de las demas, la separacion es baja. Decirlo `unknown` seria
  // suavizar un hecho conocido.
  const separacion: "high" | "low" | "unknown" = vivas > 1 ? "low" : "unknown";

  input.paths.forEach((path, i) => {
    const estado = statusFromPath(path.status);
    const incertidumbres: (typeof UNCERTAINTY_KINDS)[number][] = ["causal"];
    if (!path.origin_measured) incertidumbres.push("data");
    if (path.origin_is_observed_metric) incertidumbres.push("data");

    salida.push({
      code: `H${i + 1}`,
      statement: enunciado(path),
      // Una descomposicion aritmetica da cuenta de una parte y nunca del todo:
      // `contributory_cause` lo dice, y el check `parcial_sigue_parcial` impide
      // que alguien le suba la cobertura despues.
      hypothesis_type: path.all_mathematical ? "contributory_cause" : "direct_cause",
      source_path_id: path.path_id,
      target_node_id: path.origin_node_id,
      family: (SYMPTOM_FAMILIES as readonly string[]).includes(path.capability ?? "")
        ? (path.capability as (typeof SYMPTOM_FAMILIES)[number])
        : null,
      status: estado,
      rejection_reason: estado === "contradicted" ? motivoDelDescarte(path) : null,
      // Guardrail 35: `insufficient` no es un fracaso, es la respuesta cuando no
      // hay con que. Y ninguna pasa de `low`: la evidencia disponible es
      // co-movimiento.
      confidence: path.status === "untested" ? "insufficient" : "low",
      prior_plausibility: priorFromEdge(path.edge_evidence_level),
      explanatory_coverage: coverageFromMagnitude(path.magnitude_fit),
      unexplained_residual_material: true,
      residual_note: `Aunque "${path.origin_label}" de cuenta del movimiento, por que se movio "${path.origin_label}" sigue sin explicarse. Eso es residual, y es material.`,
      // Guardrail 43: un factor de la formula es donde se ve el problema, no de
      // donde viene. Ninguna de estas es candidata a raiz.
      root_cause_candidate: false,
      relative_role: input.paths.length > 1 ? "alternative" : null,
      separation: separacion,
      uncertainty_kinds: [...new Set(incertidumbres)],
      temporal_fit: path.temporal_fit,
      scope_fit: path.scope_fit,
      magnitude_fit: path.magnitude_fit,
      // Una identidad aritmetica no tiene mecanismo que encaje: es una
      // definicion. El eje no aplica, y `unknown` no afirma nada -- mismo
      // criterio que D11 con `explanatory_coverage`. Decir que "encaja" seria
      // contar la formula como si explicara.
      mechanism_fit: path.all_mathematical ? "unknown" : "untested",
      falsification_condition: falsificationFor(path),
      limitations:
        path.missing_evidence.length > 0 ? path.missing_evidence.join(" ") : null,
      evidence: path.evidence.map((e) => ({
        relation:
          e.stance === "contradicting"
            ? ("contradicts" as const)
            : ("supports" as const),
        observation: e.observation,
        observation_kind: "observed_present" as const,
        // Una co-ocurrencia de series es indirecta y ambigua, y decirlo aqui es
        // lo que impide que cuente como si fuera una medicion del mecanismo.
        directness: "indirect" as const,
        specificity: "ambiguous" as const,
        freshness: "fresh" as const,
        source_system: "shopify",
      })),
      test: testFor(path),
    });

    // Guardrail 5, y el error que mas veces se cuela: lo que nadie ha mirado no
    // contradice nada. La rama sin serie deja su hueco como `not_observed` e
    // `inconclusive`, no como una contradiccion.
    if (!path.origin_measured) {
      salida[salida.length - 1]?.evidence.push({
        relation: "inconclusive",
        observation: `Nadie mide "${path.origin_label}" en la ventana del caso.`,
        observation_kind: "not_observed",
        directness: "indirect",
        specificity: "unknown",
        freshness: "unknown",
        source_system: "plataforma",
      });
    }
  });

  // El challenger que tumba a todas: que no haya pasado nada y sea la medida.
  const porTracking = input.paths.filter((p) => p.origin_is_observed_metric);
  if (porTracking.length > 0) {
    const nombres = [...new Set(porTracking.map((p) => p.origin_label))].join(", ");
    salida.push({
      code: `H${input.paths.length + 1}`,
      statement: `Puede que no haya caido nada: ${nombres} salen del tracking de la tienda, y un fallo de medida las mueve sin que se mueva el negocio.`,
      hypothesis_type: "data_quality_explanation",
      // No es causal, asi que no necesita ruta -- y no la tiene, porque no hay
      // ninguna. Esa es justamente la razon de escribirla a mano.
      source_path_id: null,
      target_node_id: null,
      family: "data",
      status: "untested",
      confidence: "insufficient",
      rejection_reason: null,
      prior_plausibility: "unknown",
      explanatory_coverage: "unknown",
      unexplained_residual_material: true,
      residual_note:
        "Si la medida esta rota, no hay nada que explicar y todas las demas hipotesis sobran. Si no lo esta, esta no explica nada.",
      root_cause_candidate: false,
      // Guardrail 12: mientras haya incertidumbre material, esta sigue viva.
      relative_role: "challenger",
      separation: separacion,
      uncertainty_kinds: ["data"],
      temporal_fit: "untested",
      scope_fit: "untested",
      magnitude_fit: "untested",
      mechanism_fit: "untested",
      falsification_condition: `Que una fuente independiente --el registro de pedidos, la facturacion del anunciante-- confirme el mismo movimiento: si dos sistemas distintos lo ven, no es la medida.`,
      limitations:
        "Nadie ha validado la medicion de estas metricas contra una fuente independiente.",
      evidence: [
        {
          relation: "inconclusive",
          observation: `La medicion de ${nombres} no se ha validado contra ninguna fuente independiente.`,
          observation_kind: "not_observed",
          directness: "indirect",
          specificity: "unknown",
          freshness: "unknown",
          source_system: "plataforma",
        },
      ],
      test: {
        diagnostic_question: `¿El movimiento de ${nombres} se ve tambien en una fuente que no dependa del tracking?`,
        required_data:
          "El mismo periodo medido desde el registro de pedidos y desde la facturacion del anunciante.",
        expected_if_true:
          "Las fuentes independientes NO ven el movimiento, y entonces lo que cambio fue la medida y no el negocio.",
        expected_if_false:
          "Las fuentes independientes ven el mismo movimiento, y entonces la medida esta bien y el problema es real.",
        information_gain: "high",
        cost: "low",
        latency: "low",
        availability: "available",
        intrusiveness: "none",
        mode: "passive",
      },
    });
  }

  return salida;
}
