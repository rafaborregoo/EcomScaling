/**
 * FASE 3 / D07 — de las rutas causales a lo que se lee en pantalla.
 *
 * LA DECISION DE FONDO, y es contraria a la intuicion: **las rutas contradichas
 * van primero**. Lo normal seria enterrarlas al final y subir la que mejor
 * encaja. Hoy eso seria justo al reves de lo util: ninguna ruta esta soportada,
 * y lo unico que el bloque sabe de verdad es donde **no** esta el problema. "Las
 * ventas cayeron y los pedidos, que se vigilan, no se movieron" descarta media
 * busqueda de un golpe. Eso va arriba.
 *
 * Y LA SEGUNDA: **"sin probar" no se pinta como "descartada"**. Son los dos
 * estados que el ojo confunde y el unico que importa distinguir aqui. Una rama
 * contradicha se miro; una sin probar es que nadie mide esa metrica. Tratarlas
 * igual en pantalla deshace en un color lo que el motor separa en dos columnas.
 *
 * Ningun ranking, ninguna puntuacion, ninguna "ruta mas probable". El guardrail
 * 48 dice que D07 no prioriza, y ordenar por confianza lo haria por la puerta de
 * atras: quien lee el primero de una lista entiende que es el bueno.
 */

export type CausalTone = "neutral" | "brand" | "success" | "warn" | "danger";

export type CausalNodeView = {
  id: string;
  code: string;
  label: string;
  node_type: string;
  capability: string | null;
  observability: string;
  measurement_layer: string;
  organization_id: string | null;
};

export type CausalEdgeView = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  edge_kind: string;
  relation_type: string;
  expected_sign: string;
  mechanism: string | null;
  diagnostic_rationale: string | null;
  conditions: string | null;
  expected_lag_days: number | null;
  strength: string;
  evidence_level: string;
  knowledge_source: string;
  organization_id: string | null;
};

export type CausalEvidenceView = {
  id: string;
  evidence_level: string;
  stance: string;
  observation: string;
};

export type CausalStepView = {
  id: string;
  edge_id: string;
  step_order: number;
  case_support: string;
  cause_onset: string | null;
  effect_onset: string | null;
  observed_lag_days: number | null;
  temporal_fit: string;
  scope_fit: string;
  magnitude_fit: string;
  cause_role: string | null;
  contribution_note: string | null;
  is_mediator: boolean;
  evidence: CausalEvidenceView[];
};

export type CausalPathView = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  case_id: string;
  target_node_id: string;
  status: string;
  path_confidence: string;
  missing_evidence: string[];
  confounders_reviewed: boolean;
  measurement_validated: boolean;
  next_evidence: string | null;
  updated_at: string;
  steps: CausalStepView[];
};

/**
 * El orden de lectura: lo que descarta, lo que queda en pie, lo que nadie miro.
 *
 * No es por confianza, y esa es la decision. Ver la cabecera del fichero.
 */
const ORDEN_ESTADO: Record<string, number> = {
  contradicted: 0,
  partial: 1,
  supported: 2,
  untested: 3,
};

export function sortPaths(paths: CausalPathView[]): CausalPathView[] {
  return [...paths].sort((a, b) => {
    const diferencia = (ORDEN_ESTADO[a.status] ?? 9) - (ORDEN_ESTADO[b.status] ?? 9);
    return diferencia !== 0 ? diferencia : a.id.localeCompare(b.id);
  });
}

/**
 * El estado de la ruta, dicho como lo que significa.
 *
 * `untested` es el que mas cuidado necesita: en cualquier otra pantalla seria
 * gris de "no aplica", y aqui es una pregunta abierta sin nadie que la conteste.
 */
export function pathStatusLabel(status: string): { label: string; hint: string; tone: CausalTone } {
  switch (status) {
    case "contradicted":
      return {
        label: "Descartada",
        hint: "Se miro y no encaja: por aqui no es.",
        tone: "danger",
      };
    case "supported":
      return {
        label: "Sostenida",
        hint: "Encaja en tiempo, alcance y magnitud, y no quedan huecos.",
        tone: "success",
      };
    case "partial":
      return {
        label: "En pie, con huecos",
        hint: "Encaja en lo que se ha podido comprobar, y falta lo que pone abajo.",
        tone: "warn",
      };
    default:
      return {
        label: "Sin comprobar",
        hint: "Nadie ha mirado esto. No es lo mismo que haberlo descartado.",
        tone: "neutral",
      };
  }
}

/** Nunca un porcentaje: el esquema no guarda ninguno y aqui no se inventa. */
export function confidenceLabel(level: string): { label: string; tone: CausalTone } {
  switch (level) {
    case "high":
      return { label: "Confianza alta", tone: "success" };
    case "medium":
      return { label: "Confianza media", tone: "brand" };
    case "low":
      return { label: "Confianza baja", tone: "warn" };
    default:
      return { label: "Sin dato suficiente", tone: "neutral" };
  }
}

const RELACION_EN_PALABRAS: Record<string, string> = {
  mathematical: "es parte de la formula de",
  mechanistic: "actua sobre",
  behavioral: "cambia el comportamiento en",
  economic: "mueve economicamente a",
  operational: "condiciona operativamente a",
  technical: "afecta tecnicamente a",
  structural: "estructura a",
  temporal: "precede a",
  contextual: "contextualiza a",
  limits: "limita a",
  requires: "es requisito de",
  interaction: "actua junto a otras sobre",
};

export function relationPhrase(relation: string): string {
  return RELACION_EN_PALABRAS[relation] ?? relation;
}

/**
 * Como se lee un eslabon: "Pedidos es parte de la formula de Ventas netas".
 *
 * La frase se compone con los dos nodos y la relacion **declarada**, no con una
 * plantilla de "causa". `mathematical` dice "es parte de la formula" a proposito:
 * el guardrail 4 dice que el linaje descompone y no explica, y la pantalla no va
 * a decir "causa" donde el esquema dice "aritmetica".
 */
export function stepSentence(
  step: CausalStepView,
  edges: readonly CausalEdgeView[],
  nodes: readonly CausalNodeView[],
): string {
  const edge = edges.find((e) => e.id === step.edge_id);
  if (!edge) return "Relacion desconocida";
  const origen = nodes.find((n) => n.id === edge.from_node_id)?.label ?? "algo";
  const destino = nodes.find((n) => n.id === edge.to_node_id)?.label ?? "algo";
  return `${origen} ${relationPhrase(edge.relation_type)} ${destino}`;
}

/**
 * Los tres encajes, solo cuando restan.
 *
 * Mismo criterio que el mapa de sintomas, la salud por capacidad y la confianza:
 * lo que se cumple no cambia ninguna decision. Lo que falla o no se ha mirado,
 * si.
 */
export function failingFits(step: CausalStepView): { axis: string; verdict: string; tone: CausalTone }[] {
  const salida: { axis: string; verdict: string; tone: CausalTone }[] = [];

  if (step.temporal_fit === "contradicted") {
    salida.push({
      axis: "Tiempo",
      verdict: "el efecto empezo antes que la causa",
      tone: "danger",
    });
  } else if (step.temporal_fit !== "fits") {
    salida.push({ axis: "Tiempo", verdict: "sin comprobar", tone: "neutral" });
  }

  if (step.scope_fit === "incompatible") {
    salida.push({ axis: "Alcance", verdict: "no se solapan", tone: "danger" });
  } else if (step.scope_fit !== "compatible") {
    salida.push({ axis: "Alcance", verdict: "sin comprobar", tone: "neutral" });
  }

  if (step.magnitude_fit === "insufficient") {
    salida.push({ axis: "Magnitud", verdict: "se movio al reves", tone: "danger" });
  } else if (step.magnitude_fit === "partial") {
    salida.push({ axis: "Magnitud", verdict: "solo da cuenta de una parte", tone: "warn" });
  } else if (step.magnitude_fit !== "sufficient") {
    salida.push({ axis: "Magnitud", verdict: "sin formula que lo mida", tone: "neutral" });
  }

  return salida;
}

/** Agrupa por caso, conservando el orden de lectura dentro de cada uno. */
export function groupByCase(
  paths: CausalPathView[],
): { caseId: string; paths: CausalPathView[] }[] {
  const porCaso = new Map<string, CausalPathView[]>();
  for (const path of paths) {
    porCaso.set(path.case_id, [...(porCaso.get(path.case_id) ?? []), path]);
  }
  return [...porCaso.entries()].map(([caseId, lista]) => ({
    caseId,
    paths: sortPaths(lista),
  }));
}

/**
 * Solo los nodos que se pueden usar como extremo de una arista declarada.
 *
 * El grafo global mas lo propio de esa tienda. Un nodo de **otra** tienda no
 * aparece ni aunque la API lo devolviera: una arista entre organizaciones no
 * tiene sentido y el esquema no la admite.
 */
export function declarableNodes(
  nodes: readonly CausalNodeView[],
  organizationId: string | null,
): CausalNodeView[] {
  return nodes
    .filter((n) => n.organization_id == null || n.organization_id === organizationId)
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}
