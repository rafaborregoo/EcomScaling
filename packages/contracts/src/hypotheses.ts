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
