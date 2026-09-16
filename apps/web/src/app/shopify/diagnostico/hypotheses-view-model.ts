/**
 * FASE 3 / D08 — de las hipotesis a lo que se lee en pantalla.
 *
 * LA DECISION DE FONDO: **lo descartado se ensena, no se esconde**. Una lista de
 * explicaciones normalmente oculta las que ya no valen. Aqui son medio bloque:
 * "los pedidos no lo explican, y este es el motivo" es un resultado, y tirarlo
 * garantiza que dentro de un mes alguien repita la misma busqueda. Se separan de
 * las vivas y se ponen al final con el motivo delante, no se filtran.
 *
 * Y LA SEGUNDA: **el challenger se pinta aparte y arriba**. "Puede que no haya
 * caido nada y sea el tracking" no es una hipotesis mas de la lista: si es
 * cierta, las demas sobran. Mezclarla entre iguales la convierte en una nota al
 * pie de algo que puede tumbarlo todo.
 *
 * Ningun orden por probabilidad y ninguna marcada como la buena. El guardrail 1
 * dice que la primera causa plausible no es un diagnostico, y una lista ordenada
 * por confianza lo afirma sin decirlo.
 */

export type HypothesisTone = "neutral" | "brand" | "success" | "warn" | "danger";

export type HypothesisEvidenceView = {
  relation: string;
  observation?: string;
  observation_kind?: string;
  directness?: string;
  specificity?: string;
  freshness?: string;
  source_system?: string;
};

export type HypothesisTestView = {
  id: string;
  diagnostic_question: string;
  required_data: string | null;
  expected_if_true: string;
  expected_if_false: string;
  information_gain: string;
  cost: string;
  latency: string;
  availability: string;
  intrusiveness: string;
  mode: string;
  status: string;
};

export type HypothesisView = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  case_id: string;
  code: string;
  statement: string;
  hypothesis_type: string;
  source_path_id: string | null;
  target_node_id: string | null;
  family: string | null;
  status: string;
  rejection_reason: string | null;
  confidence: string;
  prior_plausibility: string;
  explanatory_coverage: string;
  unexplained_residual_material: boolean;
  residual_note: string | null;
  root_cause_candidate: boolean;
  relative_role: string | null;
  separation: string;
  uncertainty_kinds: string[];
  temporal_fit: string;
  scope_fit: string;
  magnitude_fit: string;
  mechanism_fit: string;
  falsification_condition: string | null;
  limitations: string | null;
  updated_at: string;
  test: HypothesisTestView | null;
  evidence: HypothesisEvidenceView[];
};

const DESCARTADAS = ["contradicted", "invalidated"];

/**
 * Las tres pilas de la pantalla: lo que puede tumbarlo todo, lo que sigue en
 * pie, y lo que ya se cayo.
 *
 * El challenger primero **aunque sea el ultimo que escribio el motor**: si es
 * cierto, lo demas sobra, y leerlo despues de estudiar cinco explicaciones es
 * leerlo tarde.
 */
export function splitHypotheses(hypotheses: HypothesisView[]): {
  challenger: HypothesisView[];
  vivas: HypothesisView[];
  descartadas: HypothesisView[];
} {
  return {
    challenger: hypotheses.filter(
      (h) => h.relative_role === "challenger" && !DESCARTADAS.includes(h.status),
    ),
    vivas: hypotheses.filter(
      (h) => h.relative_role !== "challenger" && !DESCARTADAS.includes(h.status),
    ),
    descartadas: hypotheses.filter((h) => DESCARTADAS.includes(h.status)),
  };
}

export function statusLabel(status: string): { label: string; tone: HypothesisTone } {
  switch (status) {
    case "contradicted":
    case "invalidated":
      return { label: "Descartada", tone: "danger" };
    case "under_test":
      return { label: "En comprobación", tone: "warn" };
    case "confirmed":
      return { label: "Confirmada", tone: "success" };
    case "most_likely":
    case "supported":
      return { label: "Sostenida", tone: "success" };
    case "inconclusive":
      return { label: "Sin resolver", tone: "neutral" };
    default:
      return { label: "Sin comprobar", tone: "neutral" };
  }
}

/**
 * El prior y la confianza se dicen por separado, siempre.
 *
 * Guardrail 2: "esto suele pasar" y "esto esta pasando" son dos cosas, y una
 * pantalla que las funda en un solo indicador reintroduce por la puerta de atras
 * el error que el esquema separa en dos columnas. Una relacion deterministica
 * tiene prior alto y puede tener confianza baja en este caso concreto.
 */
export function priorLabel(prior: string): string {
  switch (prior) {
    case "high":
      return "La relación es de las que casi siempre se cumplen";
    case "medium":
      return "La relación es un mecanismo común";
    case "low":
      return "La relación es plausible y poco más";
    default:
      return "No se sabe cómo de habitual es esta relación";
  }
}

export function confidenceLabel(confidence: string): { label: string; tone: HypothesisTone } {
  switch (confidence) {
    case "high":
      return { label: "Confianza alta en este caso", tone: "success" };
    case "medium":
      return { label: "Confianza media en este caso", tone: "brand" };
    case "low":
      return { label: "Confianza baja en este caso", tone: "warn" };
    default:
      return { label: "Sin evidencia suficiente", tone: "neutral" };
  }
}

export function coverageLabel(coverage: string): string | null {
  switch (coverage) {
    case "full":
      return "Explicaría todo el movimiento";
    case "partial":
      return "Explicaría una parte del movimiento";
    case "minimal":
      return "Explicaría solo una porción pequeña";
    default:
      return null;
  }
}

/**
 * De donde sale el dato que despejaría esto.
 *
 * Guardrail 47, y el error mas caro de la pantalla: mandar al consultor a
 * molestar al cliente por algo que la plataforma ya tiene. `available` y
 * `needs_integration` piden acciones distintas de personas distintas, y verse
 * iguales las confunde.
 */
export function availabilityLabel(availability: string): { label: string; tone: HypothesisTone } {
  switch (availability) {
    case "available":
      return { label: "El dato ya está en la plataforma", tone: "success" };
    case "needs_integration":
      return { label: "Falta conectar la fuente", tone: "warn" };
    case "needs_user":
      return { label: "Hay que preguntárselo al cliente", tone: "brand" };
    case "unavailable":
      return { label: "No hay forma de conseguirlo hoy", tone: "danger" };
    default:
      return { label: "No se sabe de dónde saldría", tone: "neutral" };
  }
}

const TIPO_EN_PALABRAS: Record<string, string> = {
  direct_cause: "Causa directa",
  contributory_cause: "Causa parcial",
  root_cause_candidate: "Candidata a causa de fondo",
  contextual_explanation: "Explicación por contexto",
  data_quality_explanation: "Puede que sea la medición",
  structural_explanation: "Explicación estructural",
  external_explanation: "Causa externa",
  interaction_hypothesis: "Varias cosas a la vez",
};

export function typeLabel(type: string): string {
  return TIPO_EN_PALABRAS[type] ?? type;
}

/**
 * Lo que no se ha llegado a mirar, separado de lo que apoya o contradice.
 *
 * Guardrail 5 en pantalla: `not_observed` no es evidencia de nada, y ponerlo en
 * la misma lista que lo observado hace que cuente como si lo fuera.
 */
export function splitEvidence(evidence: HypothesisEvidenceView[]): {
  mirada: HypothesisEvidenceView[];
  huecos: HypothesisEvidenceView[];
} {
  return {
    mirada: evidence.filter((e) => e.observation_kind !== "not_observed"),
    huecos: evidence.filter((e) => e.observation_kind === "not_observed"),
  };
}

/** Agrupa por caso, conservando el orden de lectura dentro de cada uno. */
export function groupByCase(
  hypotheses: HypothesisView[],
): { caseId: string; hypotheses: HypothesisView[] }[] {
  const porCaso = new Map<string, HypothesisView[]>();
  for (const h of hypotheses) {
    porCaso.set(h.case_id, [...(porCaso.get(h.case_id) ?? []), h]);
  }
  return [...porCaso.entries()].map(([caseId, lista]) => ({
    caseId,
    // Por codigo, que es el orden en que las escribio el motor. **No por
    // confianza**: ordenar por confianza es decir cual es la buena.
    hypotheses: [...lista].sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true })),
  }));
}

/**
 * Si el conjunto permite distinguir unas de otras.
 *
 * Que no sepamos separarlas es un hecho conocido y se dice. Una pantalla que
 * ensena cinco explicaciones sin avisar de que ninguna se distingue de las
 * demas invita a quedarse con la primera.
 */
export function separationWarning(hypotheses: HypothesisView[]): string | null {
  const vivas = hypotheses.filter((h) => !DESCARTADAS.includes(h.status));
  if (vivas.length < 2) return null;
  if (vivas.some((h) => h.separation === "high")) return null;
  return `Hay ${vivas.length} explicaciones en pie y nada las separa todavía: la evidencia de hoy encaja con todas.`;
}
