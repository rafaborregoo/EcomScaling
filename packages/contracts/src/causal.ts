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

// ---------------------------------------------------------------------------
// EL MOTOR (pasos 3 a 20 del runtime)
// ---------------------------------------------------------------------------
//
// Todo lo que sigue es puro: entra el grafo declarado, entran las senales de D05
// y sale un conjunto de rutas candidatas hacia un target. La parte sucia --leer
// Supabase, escribir filas-- vive en `apps/api/src/causal-engine.ts`, igual que
// en D01 a D06, D10 y D11.
//
// LA DECISION QUE ORDENA EL RESTO, y es la contribucion real del bloque:
// **una rama sin senal solo esta contradicha si esa metrica se mira**.
//
// Si las ventas caen y los pedidos aguantan, la rama de pedidos esta
// contradicha: se miro y no se movio, luego lo que se hundio es el ticket. Eso
// es un hallazgo. Pero si las ventas caen y no hay senal de `sessions`, la rama
// de sesiones **no** esta contradicha: es que nadie mide las sesiones. Tratar
// las dos igual convierte "no lo se" en "no lo hay" y poda la rama correcta por
// el motivo equivocado. Por eso entra `measuredMetrics`, y por eso es un
// parametro y no una constante.
//
// LO QUE NO HACE. No decide la causa raiz (guardrail 46), no prescribe (47) y no
// ordena (48). Y no inventa umbrales: el encaje de magnitud solo se calcula
// donde hay identidad aritmetica que lo permita, porque ahi el 1 no es un corte
// elegido sino "da cuenta del movimiento entero". Donde no hay identidad, el
// encaje se queda `untested` y se dice.

/** Una senal de D05, con lo que D07 necesita de ella. */
export type SignalForCausal = {
  metric: string;
  direction: "up" | "down" | "flat" | "diverging" | "unstable";
  scope: string;
  window_start: string;
  window_end: string;
  /** Desviacion relativa respecto de lo esperado, cuando D05 la calculo. */
  magnitude_relative: number | null;
};

/** Un nodo del grafo, ya leido de `causal_nodes`. */
export type CausalGraphNode = {
  node_id: string;
  code: string;
  label: string;
  observability: (typeof NODE_OBSERVABILITY)[number];
  measurement_layer: (typeof MEASUREMENT_LAYERS)[number];
};

/** Una arista del grafo, ya leida de `causal_edges`. */
export type CausalGraphEdge = {
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  relation_type: (typeof CAUSAL_RELATION_TYPES)[number];
  expected_sign: (typeof EXPECTED_SIGNS)[number];
  expected_lag_days: number | null;
  edge_kind: "causal" | "unvalidated_relation";
};

export type CausalEngineInput = {
  caseId: string;
  symptomId: string | null;
  /** El codigo de nodo del que se parte (`net_sales`, por ejemplo). */
  targetCode: string;
  targetScope: string;
  nodes: readonly CausalGraphNode[];
  edges: readonly CausalGraphEdge[];
  signals: readonly SignalForCausal[];
  /** Las metricas que alguien vigila de verdad. Ver la cabecera del motor. */
  measuredMetrics: readonly string[];
  /** Profundidad maxima del recorrido hacia arriba (paso 14). */
  maxDepth?: number;
  /**
   * Metricas cuyo sintoma D06 marco como `often_cooccurs` con el del caso.
   * Co-ocurrir no es causar (guardrail 8): no crean aristas, se nombran en
   * cada ruta que no pasa por ellas como rival sin modelar o confusor.
   */
  cooccurringMetrics?: readonly string[];
};

export type CausalStepDraft = {
  edge_id: string;
  step_order: number;
  case_support: (typeof PATH_STATUS)[number];
  cause_onset: string | null;
  effect_onset: string | null;
  observed_lag_days: number | null;
  temporal_fit: "fits" | "contradicted" | "untested" | "unknown";
  scope_fit: "compatible" | "incompatible" | "untested" | "partial";
  magnitude_fit: "sufficient" | "insufficient" | "untested" | "partial";
  cause_role: (typeof CAUSE_ROLES)[number] | null;
  contribution_note: string | null;
  is_mediator: boolean;
};

export type CausalEvidenceDraft = {
  /** Indice del paso al que se engancha, dentro de `steps`. */
  step_index: number;
  evidence_level: (typeof CASE_EVIDENCE_LEVELS)[number];
  stance: "supporting" | "contradicting" | "inconclusive";
  observation: string;
};

export type CausalPathDraft = {
  target_node_id: string;
  status: (typeof PATH_STATUS)[number];
  path_confidence: "insufficient_data" | "low" | "medium" | "high";
  missing_evidence: string[];
  confounders_reviewed: boolean;
  measurement_validated: boolean;
  next_evidence: string | null;
  steps: CausalStepDraft[];
  evidence: CausalEvidenceDraft[];
};

function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (new Date(hasta).getTime() - new Date(desde).getTime()) / 86_400_000,
  );
}

/**
 * Encaje temporal: **solo la flecha del tiempo**.
 *
 * Si el efecto empezo antes que la causa candidata, esa causa no explica el
 * arranque (guardrails 19 y 20) y el paso queda `contradicted`. Si la precede,
 * encaja -- y no se exige inmediatez, porque el guardrail 22 dice lo contrario:
 * un mecanismo con retardo no se descarta por no verse el mismo dia.
 *
 * Lo que **no** se comprueba es si el retardo observado se parece al esperado.
 * Para eso haria falta una tolerancia, la fuente no la da, e inventarla seria
 * decidir por ella. El retardo se guarda en `observed_lag_days` para que se vea.
 */
export function temporalFit(
  causa: SignalForCausal | null,
  efecto: SignalForCausal | null,
): { fit: CausalStepDraft["temporal_fit"]; observed_lag_days: number | null } {
  if (!causa || !efecto) return { fit: "untested", observed_lag_days: null };
  const retardo = diasEntre(causa.window_start, efecto.window_start);
  return {
    fit: retardo >= 0 ? "fits" : "contradicted",
    observed_lag_days: retardo,
  };
}

/**
 * Encaje de scope (apartado 14).
 *
 * Hoy todas las series son de negocio entero, asi que esto casi siempre devuelve
 * `compatible`. No es un acierto: es que **no hay series por canal, mercado ni
 * dispositivo** con las que pudiera fallar. Cuando las haya, una causa de un
 * canal explicando una caida de otro tiene que salir `incompatible`, y el check
 * `causal_path_steps_scope_manda` impide entonces darla por buena.
 */
export function scopeFit(
  causa: SignalForCausal | null,
  efecto: SignalForCausal | null,
): CausalStepDraft["scope_fit"] {
  if (!causa || !efecto) return "untested";
  if (causa.scope === efecto.scope) return "compatible";
  // Lo general puede contener a lo particular; al reves no explica el todo.
  // D05 llama "global" a la serie de negocio entero y el grafo la llama
  // "business": son la misma cosa con dos nombres, y aqui valen las dos.
  const entero = ["business", "global"];
  if (entero.includes(causa.scope) || entero.includes(efecto.scope)) return "partial";
  return "incompatible";
}

/**
 * Encaje de magnitud, **solo donde hay identidad aritmetica**.
 *
 * `net_sales = orders x AOV` permite preguntar de que parte del movimiento da
 * cuenta el factor: la cuota es el movimiento relativo de la causa dividido
 * entre el del efecto. El 1 no es un umbral elegido, es "explica el movimiento
 * entero"; el 0 tampoco, es "se movio al reves y por tanto no lo explica".
 *
 * Donde no hay identidad --la inversion publicitaria y las sesiones-- no hay
 * cuota que calcular, y el encaje se queda `untested`. Poner ahi un corte seria
 * exactamente el umbral inventado que el guardrail 11 de D04 prohibe.
 */
export function magnitudeFit(
  edge: CausalGraphEdge,
  causa: SignalForCausal | null,
  efecto: SignalForCausal | null,
): { fit: CausalStepDraft["magnitude_fit"]; share: number | null } {
  if (edge.relation_type !== "mathematical") return { fit: "untested", share: null };
  const c = causa?.magnitude_relative;
  const e = efecto?.magnitude_relative;
  if (typeof c !== "number" || typeof e !== "number" || e === 0) {
    return { fit: "untested", share: null };
  }
  const cuota = c / e;
  if (cuota <= 0) return { fit: "insufficient", share: cuota };
  return { fit: cuota >= 1 ? "sufficient" : "partial", share: cuota };
}

function soporteDelPaso(
  temporal: CausalStepDraft["temporal_fit"],
  scope: CausalStepDraft["scope_fit"],
  magnitud: CausalStepDraft["magnitude_fit"],
  causaSeMide: boolean,
  hayCausa: boolean,
): (typeof PATH_STATUS)[number] {
  // La regla que da sentido al bloque: se miro y no se movio != no se miro.
  if (!hayCausa) return causaSeMide ? "contradicted" : "untested";
  if (temporal === "contradicted" || magnitud === "insufficient") return "contradicted";
  if (scope === "incompatible") return "partial";
  if (temporal === "fits" && scope === "compatible" && magnitud !== "untested") {
    return "supported";
  }
  return "partial";
}

/**
 * Que dato discriminaria entre esta ruta y sus rivales (paso 19 del runtime).
 *
 * Se nombra **una sola cosa**, la primera que bloquea: una lista de diez
 * pendientes no decide nada, y el objetivo de este campo es decidir que se mide
 * manana.
 */
function siguienteEvidencia(
  pasos: readonly CausalStepDraft[],
  aristas: readonly CausalGraphEdge[],
  porId: ReadonlyMap<string, CausalGraphNode>,
): string {
  // Lo primero es lo que rompio la ruta, no lo que le falta por pulir. Una rama
  // descartada por tiempo tiene una pregunta muy concreta detras --que se movio
  // en los dias en que el efecto ya caia y la causa aun no-- y contestar otra
  // cosa manda a mirar donde no es.
  const fueraDeTiempo = pasos.findIndex((p) => p.temporal_fit === "contradicted");
  if (fueraDeTiempo >= 0) {
    const paso = pasos[fueraDeTiempo];
    const nodo = porId.get(aristas[fueraDeTiempo]?.from_node_id ?? "");
    const dias = Math.abs(paso?.observed_lag_days ?? 0);
    return `Que se movio en los ${dias} dia(s) en que el efecto ya caia y "${nodo?.label ?? "este factor"}" todavia no: ahi esta el arranque, y no es este.`;
  }

  const sinProbar = pasos.findIndex((p) => p.case_support === "untested");
  if (sinProbar >= 0) {
    const nodo = porId.get(aristas[sinProbar]?.from_node_id ?? "");
    return `Una serie diaria de "${nodo?.label ?? "la causa candidata"}": sin ella esta rama no se puede ni confirmar ni descartar.`;
  }
  const parcial = pasos.findIndex((p) => p.magnitude_fit === "partial");
  if (parcial >= 0) {
    const nodo = porId.get(aristas[parcial]?.from_node_id ?? "");
    return `Que explica el resto del movimiento: "${nodo?.label ?? "este factor"}" solo da cuenta de una parte, asi que hay otra causa a la vez.`;
  }
  return "Un contraste contra un segmento no afectado o un periodo de control: hoy la evidencia es co-movimiento, y eso no separa esta ruta de sus rivales.";
}

/**
 * Recorrido hacia atras desde un target (pasos 3 a 18 del runtime).
 *
 * Enumera las cadenas de aristas que llegan al target, evalua cada eslabon
 * contra el caso y **conserva las rivales** (guardrail 49): devolver solo la que
 * mejor encaja seria elegir la primera que cuadro.
 *
 * Poda donde debe: no sigue hacia arriba por un eslabon contradicho ni por uno
 * que nadie ha podido comprobar. Seguir por ahi produce cadenas largas y falsas.
 */
export function exploreCausalPaths(input: CausalEngineInput): CausalPathDraft[] {
  const maxDepth = input.maxDepth ?? 3;
  const porId = new Map(input.nodes.map((n) => [n.node_id, n]));
  const porCodigo = new Map(input.nodes.map((n) => [n.code, n]));
  const senalDe = new Map(input.signals.map((s) => [s.metric, s]));
  const seMide = new Set(input.measuredMetrics);

  const target = porCodigo.get(input.targetCode);
  if (!target) return [];

  const rutas: CausalPathDraft[] = [];

  const evaluar = (arista: CausalGraphEdge, orden: number): CausalStepDraft => {
    const origen = porId.get(arista.from_node_id);
    const destino = porId.get(arista.to_node_id);
    const causa = origen ? (senalDe.get(origen.code) ?? null) : null;
    const efecto = destino ? (senalDe.get(destino.code) ?? null) : null;
    const causaSeMide = origen ? seMide.has(origen.code) : false;

    const { fit: temporal, observed_lag_days } = temporalFit(causa, efecto);
    const scope = scopeFit(causa, efecto);
    const { fit: magnitud, share } = magnitudeFit(arista, causa, efecto);
    const soporte = soporteDelPaso(temporal, scope, magnitud, causaSeMide, causa != null);

    return {
      edge_id: arista.edge_id,
      step_order: orden,
      case_support: soporte,
      cause_onset: causa?.window_start ?? null,
      effect_onset: efecto?.window_start ?? null,
      observed_lag_days,
      temporal_fit: temporal,
      scope_fit: scope,
      magnitude_fit: magnitud,
      // Guardrail 28: lo que solo da cuenta de una parte sigue siendo causa,
      // pero contributoria. Lo que da cuenta del todo no se declara necesario
      // ni suficiente: para eso hace falta un contrafactual, y no lo hay.
      cause_role:
        magnitud === "partial" || magnitud === "insufficient" ? "contributory" : null,
      contribution_note:
        share == null
          ? null
          : `Da cuenta del ${Math.round(share * 100)}% del movimiento del efecto, por la identidad aritmetica que une las dos metricas.`,
      is_mediator: arista.to_node_id !== target.node_id,
    };
  };

  const emitir = (cadena: readonly CausalGraphEdge[]) => {
    // Del mas rio arriba al target, que es como se lee una explicacion.
    const enOrden = [...cadena].reverse();
    const pasos = enOrden.map((arista, i) => evaluar(arista, i + 1));

    const evidencia: CausalEvidenceDraft[] = [];
    const faltan: string[] = [];

    pasos.forEach((paso, i) => {
      const arista = enOrden[i];
      if (!arista) return;
      const origen = porId.get(arista.from_node_id);
      const destino = porId.get(arista.to_node_id);
      if (!origen || !destino) return;

      if (paso.case_support === "untested") {
        faltan.push(
          `Nadie mide "${origen.label}": sin serie no se puede saber si se movio. No es lo mismo que no se haya movido.`,
        );
        return;
      }

      if (paso.cause_onset == null) {
        evidencia.push({
          step_index: i,
          evidence_level: "correlation_only",
          stance: "contradicting",
          observation: `"${origen.label}" se vigila y no emitio senal en la ventana del caso, asi que no explica el movimiento de "${destino.label}".`,
        });
        return;
      }

      // La observacion tiene que decir **por que** contradice, no dejar un texto
      // de apoyo con la etiqueta cambiada. Es el mismo fallo que confundir
      // "descartado" con "sin probar", una capa mas abajo.
      const porQue =
        paso.temporal_fit === "contradicted"
          ? `"${destino.label}" empezo a moverse antes que "${origen.label}", asi que este factor no explica el arranque.`
          : paso.magnitude_fit === "insufficient"
            ? `"${origen.label}" se movio en sentido contrario a "${destino.label}": no da cuenta del movimiento, lo hace mas dificil de explicar.`
            : (paso.contribution_note ??
              `"${origen.label}" y "${destino.label}" se movieron en la misma ventana; la relacion declarada es ${arista.relation_type}.`);

      evidencia.push({
        step_index: i,
        evidence_level: "correlation_only",
        stance: paso.case_support === "contradicted" ? "contradicting" : "supporting",
        observation: porQue,
      });

      // Guardrails 37-39: pasar por una metrica observada sin validar la
      // medicion deja la ruta a merced de un fallo de tracking.
      for (const nodo of [origen, destino]) {
        if (nodo.measurement_layer !== "observed_metric") continue;
        const nota = `"${nodo.label}" es una metrica observada y nadie ha validado que su medicion no este rota: un fallo de tracking la mueve sin que se mueva el negocio.`;
        if (!faltan.includes(nota)) faltan.push(nota);
      }
    });

    // Guardrail 4: el linaje descompone, no explica.
    if (enOrden.every((e) => e.relation_type === "mathematical")) {
      const primero = porId.get(enOrden[0]?.from_node_id ?? "");
      faltan.push(
        `Esta ruta descompone el movimiento, no lo explica: falta por que se movio "${primero?.label ?? "el factor"}".`,
      );
    }

    // Guardrail 11: nadie ha revisado los confusores de D02, y callarlo seria
    // presentar la ruta como mas limpia de lo que esta.
    faltan.push("Los confusores declarados en D02 no se han revisado contra esta ruta.");

    // Las co-ocurrencias de D06 que esta ruta no recorre: algo se movio a la
    // vez y el grafo no dice que tenga que ver. O falta una arista o es un
    // confusor; lo que no se puede es ignorarlo.
    const enRuta = new Set(
      enOrden.flatMap((e) => [porId.get(e.from_node_id)?.code, porId.get(e.to_node_id)?.code]),
    );
    for (const metrica of input.cooccurringMetrics ?? []) {
      if (enRuta.has(metrica) || metrica === input.targetCode) continue;
      const etiqueta = porCodigo.get(metrica)?.label ?? metrica;
      faltan.push(
        `"${etiqueta}" se movio a la vez (D06 los marca como co-ocurrentes) y esta ruta no pasa por el: puede ser una rival sin modelar o un confusor.`,
      );
    }

    const hayContradicho = pasos.some((p) => p.case_support === "contradicted");
    const nadieComprobado = pasos.every((p) => p.case_support === "untested");

    // Nunca `supported`: quedan huecos declarados y el guardrail 50 dice que una
    // ruta con huecos no lo esta. Que hoy ninguna ruta llegue a soportada no es
    // un fallo del motor, es el estado real de la cadena.
    const status: (typeof PATH_STATUS)[number] = hayContradicho
      ? "contradicted"
      : nadieComprobado
        ? "untested"
        : "partial";

    rutas.push({
      target_node_id: target.node_id,
      status,
      // Guardrail 16: la evidencia disponible es co-movimiento, y eso no
      // sostiene ni confianza media.
      path_confidence: status === "untested" ? "insufficient_data" : "low",
      missing_evidence: faltan,
      confounders_reviewed: false,
      measurement_validated: false,
      next_evidence: siguienteEvidencia(pasos, enOrden, porId),
      steps: pasos,
      evidence: evidencia,
    });
  };

  const recorrer = (nodeId: string, cadena: readonly CausalGraphEdge[]) => {
    // Paso 15 del runtime -- "mantener alternativas" -- no es solo conservar
    // rivales del mismo largo: la explicacion corta y bien sostenida es una
    // alternativa a la explicacion larga que la extiende, y las dos compiten
    // por la misma pregunta. Sin esta linea, `exploreCausalPaths` solo llegaba
    // a emitir la cadena cuando ya no quedaba nada mas arriba que explorar --
    // asi que "pedidos explican la mitad, con encaje perfecto" nunca se veia
    // por si sola: se diluia siempre en la extension hacia "sesiones", que
    // nadie mide. Se detecto corriendo D07 encadenado con D09: la conclusion
    // corta llegaba a `unresolved` en vez de `partial_root_cause` porque
    // jamas existia como ruta propia.
    if (cadena.length > 0) emitir(cadena);

    const entrantes = input.edges.filter((e) => e.to_node_id === nodeId);
    if (entrantes.length === 0 || cadena.length >= maxDepth) return;

    for (const arista of entrantes) {
      if (cadena.some((e) => e.edge_id === arista.edge_id)) continue; // sin ciclos
      if (!porId.has(arista.from_node_id)) continue;

      const siguiente = [...cadena, arista];
      const paso = evaluar(arista, cadena.length + 1);

      // Paso 5: no se sigue hacia arriba por una rama podada ni por una que
      // nadie ha comprobado. Lo primero seria perseguir una causa descartada;
      // lo segundo, construir una cadena sobre un eslabon que no existe.
      if (paso.case_support === "contradicted" || paso.case_support === "untested") {
        emitir(siguiente);
        continue;
      }
      recorrer(arista.from_node_id, siguiente);
    }
  };

  recorrer(target.node_id, []);
  return rutas;
}

/**
 * Lo que la pantalla puede declarar: una arista causal propia de una tienda.
 *
 * Tres campos obligatorios y **ninguno es un numero**. El mecanismo, porque sin
 * el no hay arista causal (guardrail 7) y un eslogan no es un mecanismo (9, de
 * ahi los 20 caracteres). Para que sirve diagnosticando, porque una relacion
 * cierta que no distingue nada solo ensucia el grafo (10). Y el signo esperado,
 * porque una relacion sin direccion no se puede contradecir con datos.
 *
 * `strength` es opcional y cae a `context_dependent`: es la respuesta honesta
 * cuando nadie ha medido la fuerza. No hay `evidence_level` ni
 * `knowledge_source` en el formulario -- los pone el servidor en
 * `plausible`/`expert_heuristic`, y el guardrail 45 le pone el techo. Dejar que
 * quien declara elija su propio nivel de evidencia seria dejarle firmar su
 * propio certificado.
 */
export const causalEdgeInputSchema = z.object({
  organization_id: z.string().uuid(),
  from_node_id: z.string().uuid(),
  to_node_id: z.string().uuid(),
  relation_type: z.enum(CAUSAL_RELATION_TYPES),
  expected_sign: z.enum(EXPECTED_SIGNS),
  mechanism: z
    .string()
    .trim()
    .min(20, "Sin mecanismo esto es una correlacion, no una causa (guardrails 7 y 9)."),
  diagnostic_rationale: z
    .string()
    .trim()
    .min(1, "Di para que sirve diagnosticando (guardrail 10)."),
  conditions: z.string().trim().nullish(),
  expected_lag_days: z.number().int().min(0).max(365).nullish(),
  strength: z.enum(EDGE_STRENGTHS).nullish(),
});
