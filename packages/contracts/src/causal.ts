/**
 * FASE 3 / D07 — El grafo causal del ecommerce.
 *
 * Fuentes: `02-contratos-IA/d07-requisitos-contrato-grafo-causal.md` (34 apartados),
 * `04-policies-guardrails/d07-guardrails-causalidad.md` (50 guardrails),
 * `03-runtime/d07-flujo-razonamiento-causal.md` (20 pasos).
 *
 * El primer bloque que puede hablar de causas -- y sigue sin poder decidirlas.
 * D07 produce rutas plausibles con su soporte, sus contradicciones y lo que
 * falta por comprobar. Decidir es D08-D09 (guardrail 46), prescribir es F5+ (47)
 * y priorizar no lo hace nadie aqui (48).
 *
 * Lo que este fichero comprueba es lo que un check de columna no alcanza:
 * reglas que miran la ruta entera, sus pasos, sus rivales y su evidencia.
 */
import { z } from "zod";

import { type DiagnosticInvariantViolation } from "./diagnostics.js";
import { CAPABILITIES } from "./maturity.js";

/** Apartado 1. */
export const CAUSAL_NODE_TYPES = [
  "metric",
  "state",
  "event",
  "contextual",
  "structural",
  "outcome",
] as const;

/** Apartado 2. Guardrails 17 y 18: lo latente y lo externo exigen mas cautela. */
export const NODE_OBSERVABILITY = [
  "directly_observed",
  "derived",
  "latent",
  "external",
] as const;

/** Apartado 31 y guardrails 37-39. */
export const MEASUREMENT_LAYERS = [
  "real_world",
  "measurement_system",
  "observed_metric",
] as const;

/** Apartado 4. `mathematical` es linaje, no causa (guardrail 4). */
export const CAUSAL_RELATION_TYPES = [
  "mathematical",
  "mechanistic",
  "behavioral",
  "economic",
  "operational",
  "technical",
  "structural",
  "temporal",
  "contextual",
  "limits",
  "requires",
  "interaction",
] as const;

/** Apartado 5. */
export const EXPECTED_SIGNS = [
  "positive",
  "negative",
  "non_monotonic",
  "context_dependent",
] as const;

/** Apartado 8. */
export const EDGE_STRENGTHS = ["strong", "moderate", "weak", "context_dependent"] as const;

/** Apartado 9, de mas fuerte a mas debil. */
export const EDGE_EVIDENCE_LEVELS = [
  "deterministic",
  "strongly_established",
  "common_mechanism",
  "plausible",
  "speculative",
] as const;

/** Apartado 10 y guardrail 43: las cinco fuentes se mantienen separadas. */
export const KNOWLEDGE_SOURCES = [
  "system_logic",
  "internal_evidence",
  "external_knowledge",
  "expert_heuristic",
  "tenant_learned",
] as const;

/** Apartado 12. `untested` y `partial` son estados de primera clase. */
export const PATH_STATUS = ["supported", "contradicted", "untested", "partial"] as const;

/** Apartado 17. `contributory` existe porque el guardrail 28 lo exige. */
export const CAUSE_ROLES = ["necessary", "sufficient", "contributory"] as const;

/**
 * Apartado 24. **La jerarquia de evidencia, en orden.**
 *
 * `correlation_only` esta en el catalogo porque existe, no porque valga: el
 * guardrail 16 impide que sostenga confianza alta, y eso lo comprueba
 * `checkCausalInvariants`.
 */
export const CASE_EVIDENCE_LEVELS = [
  "randomized_experiment",
  "natural_experiment",
  "before_after_with_control",
  "temporal_and_mechanistic",
  "multi_source_corroboration",
  "correlation_only",
] as const;

/** Apartado 23. */
export const COUNTERFACTUAL_SOURCES = [
  "unaffected_segment",
  "control_market",
  "other_device",
  "previous_period",
  "natural_experiment",
  "randomized_experiment",
] as const;

/** Un experimento de verdad; lo demas es proxy (guardrail 40). */
export const REAL_EXPERIMENTS = ["randomized_experiment", "natural_experiment"] as const;

export const causalNodeFields = z.object({
  node_id: z.string().min(1),
  code: z.string().min(1),
  label: z.string().min(1),
  node_type: z.enum(CAUSAL_NODE_TYPES),
  capability: z.enum(CAPABILITIES).optional(),
  observability: z.enum(NODE_OBSERVABILITY).default("derived"),
  measurement_layer: z.enum(MEASUREMENT_LAYERS).default("real_world"),
  scope: z.string().default("business"),
  notes: z.string().optional(),
});

export const causalNodeSchema = causalNodeFields
  // Guardrails 12, 14 y 17: si no se observa, hay que decir como se sabe algo de el.
  .refine((n) => !["latent", "external"].includes(n.observability) || n.notes != null, {
    message:
      "Un nodo latente o externo tiene que explicar como se sabe algo de el (guardrails 12, 14 y 17).",
  })
  // Guardrail 13: una recomendacion no es un nodo causal.
  .refine(
    (n) => !/^(do_|should_|increase_|reduce_|launch_|fix_|optimize_)/i.test(n.code),
    { message: "Una recomendacion no es un nodo causal (guardrail 13)." },
  );

export type CausalNode = z.infer<typeof causalNodeSchema>;

export const causalEdgeFields = z.object({
  edge_id: z.string().min(1),
  from_node_id: z.string().min(1),
  to_node_id: z.string().min(1),
  edge_kind: z.enum(["causal", "unvalidated_relation"]).default("causal"),
  relation_type: z.enum(CAUSAL_RELATION_TYPES),
  expected_sign: z.enum(EXPECTED_SIGNS).default("context_dependent"),
  mechanism: z.string().optional(),
  diagnostic_rationale: z.string().optional(),
  conditions: z.string().optional(),
  expected_lag_days: z.number().int().optional(),
  strength: z.enum(EDGE_STRENGTHS).default("context_dependent"),
  evidence_level: z.enum(EDGE_EVIDENCE_LEVELS).default("plausible"),
  knowledge_source: z.enum(KNOWLEDGE_SOURCES).default("system_logic"),
  interaction_group: z.string().optional(),
});

export const causalEdgeSchema = causalEdgeFields
  .refine((e) => e.from_node_id !== e.to_node_id, {
    message: "Una arista necesita dos nodos distintos.",
  })
  // Guardrail 7: sin mecanismo no hay arista causal. Y el 9: un eslogan no es
  // un mecanismo, asi que tiene que decir algo de verdad.
  .refine(
    (e) =>
      e.edge_kind !== "causal" || (e.mechanism != null && e.mechanism.trim().length >= 20),
    { message: "Sin mecanismo no hay arista causal (guardrails 7 y 9)." },
  )
  // Guardrail 10: toda arista tiene que servir para diagnosticar algo.
  .refine((e) => e.edge_kind !== "causal" || e.diagnostic_rationale != null, {
    message: "Una arista causal tiene que declarar para que sirve diagnosticando (guardrail 10).",
  })
  // Guardrail 8: una correlacion no se disfraza de conocimiento establecido.
  .refine(
    (e) =>
      e.edge_kind !== "unvalidated_relation" ||
      (e.evidence_level === "speculative" &&
        ["weak", "context_dependent"].includes(e.strength)),
    { message: "Una correlacion sin mecanismo tiene techo de evidencia (guardrail 8)." },
  )
  // Guardrail 45: la heuristica de experto no domina la evidencia del tenant.
  .refine(
    (e) =>
      e.knowledge_source !== "expert_heuristic" ||
      ["plausible", "speculative", "common_mechanism"].includes(e.evidence_level),
    { message: "Una heuristica de experto no llega a conocimiento establecido (guardrail 45)." },
  );

export type CausalEdge = z.infer<typeof causalEdgeSchema>;

export const causalPathFields = z.object({
  path_id: z.string().min(1),
  target_node_id: z.string().min(1),
  status: z.enum(PATH_STATUS).default("untested"),
  path_confidence: z.enum(["insufficient_data", "low", "medium", "high"]).default("low"),
  missing_evidence: z.array(z.string()).default([]),
  confounders_reviewed: z.boolean().default(false),
  measurement_validated: z.boolean().default(false),
  next_evidence: z.string().optional(),
});

export const causalPathSchema = causalPathFields
  // Guardrails 11 y 39.
  .refine(
    (p) =>
      p.path_confidence !== "high" || (p.confounders_reviewed && p.measurement_validated),
    {
      message:
        "Confianza alta sin revisar confusores ni validar la medicion (guardrails 11 y 39).",
    },
  )
  // Guardrail 50: lo que falta se expone, y con huecos no hay ruta soportada.
  .refine((p) => p.status !== "supported" || p.missing_evidence.length === 0, {
    message: "Una ruta con evidencia pendiente no esta soportada (guardrail 50).",
  })
  .refine(
    (p) =>
      p.status !== "contradicted" ||
      ["insufficient_data", "low"].includes(p.path_confidence),
    { message: "Una ruta contradicha no se afirma a la vez (guardrail 49)." },
  );

export type CausalPath = z.infer<typeof causalPathSchema>;

export const causalPathStepSchema = z.object({
  step_id: z.string().min(1),
  path_id: z.string().min(1),
  edge_id: z.string().min(1),
  step_order: z.number().int().min(1),
  case_support: z.enum(PATH_STATUS).default("untested"),
  temporal_fit: z.enum(["fits", "contradicted", "untested", "unknown"]).default("untested"),
  scope_fit: z.enum(["compatible", "incompatible", "untested", "partial"]).default("untested"),
  magnitude_fit: z
    .enum(["sufficient", "insufficient", "untested", "partial"])
    .default("untested"),
  cause_role: z.enum(CAUSE_ROLES).optional(),
  is_mediator: z.boolean().default(false),
  confounder_id: z.string().optional(),
});

export type CausalPathStep = z.infer<typeof causalPathStepSchema>;

export const causalEvidenceSchema = z
  .object({
    evidence_id: z.string().min(1),
    path_id: z.string().min(1),
    step_id: z.string().optional(),
    evidence_level: z.enum(CASE_EVIDENCE_LEVELS),
    stance: z.enum(["supporting", "contradicting", "inconclusive"]).default("supporting"),
    observation: z.string().min(1),
    counterfactual_source: z.enum(COUNTERFACTUAL_SOURCES).optional(),
    assumptions: z.string().optional(),
    control_comparable: z.boolean().optional(),
  })
  // Guardrails 40, 41 y 42: un proxy contrafactual no es un experimento.
  .refine(
    (e) =>
      e.counterfactual_source == null ||
      (REAL_EXPERIMENTS as readonly string[]).includes(e.counterfactual_source) ||
      (e.assumptions != null && e.control_comparable != null),
    {
      message:
        "Un proxy contrafactual tiene que declarar supuestos y si el control es comparable (guardrails 40-42).",
    },
  );

export type CausalEvidence = z.infer<typeof causalEvidenceSchema>;

export type CausalCheckInput = {
  paths: CausalPath[];
  steps?: CausalPathStep[];
  edges?: CausalEdge[];
  nodes?: CausalNode[];
  evidence?: CausalEvidence[];
};

/** Posicion en la jerarquia del apartado 24: menor indice, mas fuerte. */
export function evidenceRank(level: (typeof CASE_EVIDENCE_LEVELS)[number]): number {
  return CASE_EVIDENCE_LEVELS.indexOf(level);
}

/**
 * Lo que un check de columna no alcanza: reglas que miran la ruta entera, sus
 * pasos, sus rivales y su evidencia.
 */
export function checkCausalInvariants(
  input: CausalCheckInput,
): DiagnosticInvariantViolation[] {
  const violations: DiagnosticInvariantViolation[] = [];
  const steps = input.steps ?? [];
  const edges = input.edges ?? [];
  const nodes = input.nodes ?? [];
  const evidence = input.evidence ?? [];

  const edgePorId = new Map(edges.map((e) => [e.edge_id, e]));
  const nodePorId = new Map(nodes.map((n) => [n.node_id, n]));

  for (const p of input.paths) {
    const sus = steps
      .filter((s) => s.path_id === p.path_id)
      .sort((a, b) => a.step_order - b.step_order);
    const suEvidencia = evidence.filter((e) => e.path_id === p.path_id);
    const apoya = suEvidencia.filter((e) => e.stance === "supporting");
    const susAristas = sus
      .map((s) => edgePorId.get(s.edge_id))
      .filter((e): e is CausalEdge => e != null);

    // Guardrail 16: correlacion sola no genera confianza alta.
    if (
      ["high", "medium"].includes(p.path_confidence) &&
      apoya.length > 0 &&
      apoya.every((e) => e.evidence_level === "correlation_only")
    ) {
      violations.push({
        rule: "correlacion_no_sostiene_confianza",
        source: "D07 guardrails 2 y 16",
        message: `La ruta ${p.path_id} se afirma con confianza ${p.path_confidence} apoyada solo en correlacion.`,
      });
    }

    // Guardrail 4: linaje no es grafo causal. Que revenue = sesiones x CVR x AOV
    // descompone; no explica por que.
    if (
      p.status === "supported" &&
      susAristas.length > 0 &&
      susAristas.every((e) => e.relation_type === "mathematical")
    ) {
      violations.push({
        rule: "linaje_no_es_explicacion",
        source: "D07 guardrail 4",
        message: `La ruta ${p.path_id} es una descomposicion aritmetica presentada como explicacion.`,
      });
    }

    // Guardrail 50: un eslabon sin comprobar es un eslabon debil, y hay que
    // exponerlo en vez de dejar que la confianza de la ruta lo tape.
    if (p.path_confidence === "high") {
      const sinProbar = sus.filter((s) => s.case_support === "untested");
      if (sinProbar.length > 0) {
        violations.push({
          rule: "eslabon_debil_expuesto",
          source: "D07 guardrail 50",
          message: `La ruta ${p.path_id} se afirma con confianza alta con ${sinProbar.length} paso(s) sin comprobar.`,
        });
      }
    }

    // Guardrail 49: preservar rutas rivales. Declarar una soportada mientras
    // todas las alternativas al mismo target siguen sin tocar es elegir la
    // primera que encajo.
    if (p.status === "supported") {
      const rivales = input.paths.filter(
        (o) => o.path_id !== p.path_id && o.target_node_id === p.target_node_id,
      );
      if (rivales.length > 0 && rivales.every((o) => o.status === "untested")) {
        violations.push({
          rule: "rutas_rivales_sin_probar",
          source: "D07 guardrail 49",
          message: `La ruta ${p.path_id} se da por buena con ${rivales.length} ruta(s) rival(es) sin comprobar.`,
        });
      }
    }

    // Guardrails 37-39: no se diagnostica un deterioro del negocio desde una
    // medicion que no se ha validado.
    const pasaPorObservada = sus.some((s) => {
      const e = edgePorId.get(s.edge_id);
      if (!e) return false;
      return [e.from_node_id, e.to_node_id].some(
        (id) => nodePorId.get(id)?.measurement_layer === "observed_metric",
      );
    });
    if (pasaPorObservada && !p.measurement_validated && p.status === "supported") {
      violations.push({
        rule: "medicion_sin_validar_no_diagnostica",
        source: "D07 guardrails 37, 38 y 39",
        message: `La ruta ${p.path_id} pasa por una metrica observada y se da por soportada sin validar la medicion. Un fallo de tracking cambia las compras observadas sin cambiar las compras.`,
      });
    }

    // Guardrail 17: lo latente exige mas evidencia, no la misma.
    const pasaPorLatente = sus.some((s) => {
      const e = edgePorId.get(s.edge_id);
      if (!e) return false;
      return [e.from_node_id, e.to_node_id].some((id) =>
        ["latent", "external"].includes(nodePorId.get(id)?.observability ?? ""),
      );
    });
    if (
      pasaPorLatente &&
      p.path_confidence === "high" &&
      !apoya.some((e) => evidenceRank(e.evidence_level) <= evidenceRank("before_after_with_control"))
    ) {
      violations.push({
        rule: "latente_exige_mas_evidencia",
        source: "D07 guardrails 17 y 18",
        message: `La ruta ${p.path_id} pasa por un nodo latente o externo y se afirma con confianza alta sin evidencia por encima de la corroboracion.`,
      });
    }

    // Apartado 19 y guardrail 31: si dos aristas solo actuan juntas, usar una
    // sin la otra es afirmar que basta por su cuenta.
    for (const arista of susAristas) {
      if (!arista.interaction_group) continue;
      const companeras = edges.filter(
        (o) =>
          o.interaction_group === arista.interaction_group && o.edge_id !== arista.edge_id,
      );
      const faltan = companeras.filter(
        (o) => !susAristas.some((usada) => usada.edge_id === o.edge_id),
      );
      if (faltan.length > 0 && p.status === "supported") {
        violations.push({
          rule: "interaccion_incompleta",
          source: "D07 apartado 19 y guardrail 31",
          message: `La ruta ${p.path_id} usa "${arista.edge_id}" sin las ${faltan.length} arista(s) con las que solo actua en conjunto.`,
        });
        break;
      }
    }

    // Guardrails 33 y 34: un confusor nombrado y no resuelto no puede convivir
    // con un paso dado por bueno.
    for (const s of sus) {
      if (s.confounder_id && s.case_support === "supported") {
        const loAborda = suEvidencia.some((e) => e.step_id === s.step_id);
        if (!loAborda) {
          violations.push({
            rule: "confusor_sin_resolver",
            source: "D07 guardrails 33 y 34",
            message: `El paso ${s.step_id} nombra un confusor candidato y se da por soportado sin evidencia que lo descarte.`,
          });
        }
      }
    }

    // Guardrail 6: coincidir con un evento no es haber sido causado por el.
    for (const s of sus) {
      if (s.case_support !== "supported") continue;
      const e = edgePorId.get(s.edge_id);
      if (e?.relation_type !== "temporal") continue;
      const suya = suEvidencia.filter((x) => x.step_id === s.step_id);
      if (suya.length === 0 || suya.every((x) => x.evidence_level === "correlation_only")) {
        violations.push({
          rule: "coincidir_no_es_causar",
          source: "D07 guardrail 6",
          message: `El paso ${s.step_id} se sostiene solo en que ocurrio a la vez. Coincidir con un evento no es haber sido causado por el.`,
        });
      }
    }
  }

  return violations;
}
