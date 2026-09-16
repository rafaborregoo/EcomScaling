/**
 * FASE 3 / D11 — de la confianza por capa a lo que se lee en pantalla.
 *
 * LA DECISION DE FONDO: **las capas se ensenan juntas y en orden, nunca
 * resumidas**. Un caso con senal, sintoma e impacto medido parece un
 * diagnostico cerrado; ponerle al lado "por que: no puede determinarse" es lo
 * unico que impide leerlo asi. Si la pantalla mostrara una sola confianza
 * media, esa frase desapareceria justo cuando mas falta hace.
 *
 * Y la segunda: **cada nivel tiene su formula de lenguaje**, no un sinonimo
 * elegante (guardrails 43 a 46). "Es compatible con" y "la explicacion mas
 * probable es" no dicen lo mismo, y esa diferencia es lo que separa una
 * hipotesis de una conclusion. La pantalla usa las frases, no las etiquetas.
 *
 * Ningun porcentaje, en ningun sitio. El esquema garantiza que no cabe un
 * numero; esto garantiza que tampoco se inventa uno al pintarlo.
 */

export type ConfidenceTone = "neutral" | "brand" | "success" | "warn" | "danger";

export type DimensionView = {
  dimension: string;
  rating: string;
  reason: string;
};

export type CapView = {
  cap_source: string;
  capped_level: string;
  reason: string;
};

export type ClaimView = {
  id: string;
  organization_name: string | null;
  case_id: string;
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
  assessed_at: string;
  dimensions: DimensionView[];
  caps: CapView[];
};

export type UncertaintyView = {
  id: string;
  case_id: string;
  claim_id: string | null;
  uncertainty_type: string;
  description: string;
  materiality: string;
  is_known_unknown: boolean;
  resolvability: string;
  required_evidence: string | null;
};

/**
 * El orden de lectura de las capas.
 *
 * De lo que se mide a lo que se concluye. **No es alfabetico ni por confianza**:
 * es el orden en que se construye un diagnostico, y leerlo al reves es empezar
 * por la conclusion.
 */
export const LAYER_ORDER = [
  "measurement",
  "what",
  "where",
  "signal",
  "symptom",
  "current_impact",
  "future_impact",
  "severity",
  "forecast",
  "why",
  "root_cause",
  "constraint",
  "overall",
] as const;

const CAPA_EN_PALABRAS: Record<string, string> = {
  measurement: "¿Me puedo fiar del dato?",
  what: "¿Qué se movió?",
  where: "¿Dónde pasa?",
  signal: "¿La señal se sostiene?",
  symptom: "¿Qué patrón forman?",
  current_impact: "¿Cuánto ha costado?",
  future_impact: "¿Cuánto puede costar?",
  severity: "¿Cómo de grave es?",
  forecast: "¿Hacia dónde va?",
  why: "¿Por qué pasa?",
  root_cause: "¿Cuál es la causa de fondo?",
  constraint: "¿Qué le está limitando?",
  overall: "¿Se puede concluir el caso?",
};

export function layerQuestion(layer: string): string {
  return CAPA_EN_PALABRAS[layer] ?? layer;
}

/**
 * Las capas de un caso, en orden de lectura.
 *
 * Las que el motor no escribio simplemente no salen: una capa ausente no es lo
 * mismo que una capa desconocida, y ensenar un hueco donde no hay fila seria
 * inventarse una afirmacion que nadie hizo.
 */
export function sortLayers(claims: ClaimView[]): ClaimView[] {
  const posicion = (capa: string) => {
    const i = (LAYER_ORDER as readonly string[]).indexOf(capa);
    return i === -1 ? LAYER_ORDER.length : i;
  };
  return [...claims].sort((a, b) => posicion(a.claim_layer) - posicion(b.claim_layer));
}

/** Agrupa por caso, conservando el orden de capa dentro de cada uno. */
export function groupByCase(claims: ClaimView[]): { caseId: string; claims: ClaimView[] }[] {
  const porCaso = new Map<string, ClaimView[]>();
  for (const claim of claims) {
    porCaso.set(claim.case_id, [...(porCaso.get(claim.case_id) ?? []), claim]);
  }
  return [...porCaso.entries()].map(([caseId, lista]) => ({
    caseId,
    claims: sortLayers(lista),
  }));
}

/**
 * El nivel, dicho con la formula de su guardrail.
 *
 * `label` es la etiqueta corta para el badge; `phrase` es como empieza la frase
 * si alguien la escribe. **Cambiar la frase es descalibrar el lenguaje**, y es
 * el fallo que el bloque entero existe para impedir.
 */
export function confidenceLabel(level: string): {
  label: string;
  phrase: string;
  tone: ConfidenceTone;
} {
  switch (level) {
    case "high":
      return { label: "Alta", phrase: "la evidencia sostiene con solidez que", tone: "success" };
    case "medium":
      return { label: "Media", phrase: "la explicación más probable es que", tone: "brand" };
    case "low":
      return { label: "Baja", phrase: "es compatible con que", tone: "warn" };
    default:
      return { label: "Sin dato suficiente", phrase: "no puede determinarse si", tone: "neutral" };
  }
}

/**
 * Como se sabe lo que se sabe.
 *
 * Observado, derivado, inferido y supuesto no son grados de lo mismo: dicen de
 * donde sale la afirmacion. Una serie medida y una suposicion pueden tener la
 * misma confianza y no valen igual.
 */
export function epistemicLabel(state: string): { label: string; tone: ConfidenceTone } {
  switch (state) {
    case "observed":
      return { label: "Observado", tone: "success" };
    case "derived":
      return { label: "Derivado", tone: "brand" };
    case "inferred":
      return { label: "Inferido", tone: "warn" };
    case "hypothesized":
      return { label: "Supuesto", tone: "warn" };
    case "confirmed":
      return { label: "Confirmado", tone: "success" };
    default:
      return { label: "Desconocido", tone: "neutral" };
  }
}

/**
 * La afirmacion negativa, con sus tres estados.
 *
 * **Es el corazon de toda la fase.** "No lo sé" y "no lo hay" no son lo mismo, y
 * el vocabulario tiene tres casillas justo para que nadie tenga que elegir entre
 * dos que no le valen.
 */
export function negativeClaimLabel(state: string | null): string | null {
  switch (state) {
    case "no_evidence":
      return "No se ha mirado, así que no se sabe. No es lo mismo que no haya nada.";
    case "evidence_of_no_problem":
      return "Se ha mirado y no se ha encontrado nada, con la cobertura declarada.";
    case "evidence_of_stability":
      return "Se ha medido y está estable.";
    default:
      return null;
  }
}

const DIMENSION_EN_PALABRAS: Record<string, string> = {
  data_reliability: "Fiabilidad del dato",
  data_coverage: "Cobertura del dato",
  context_quality: "Calidad del contexto",
  sample_sufficiency: "Tamaño de la muestra",
  temporal_fit: "Encaje temporal",
  scope_fit: "Encaje de alcance",
  mechanism_strength: "Fuerza del mecanismo",
  evidence_consistency: "Consistencia de la evidencia",
  evidence_independence: "Independencia de la evidencia",
  missing_evidence: "Evidencia que falta",
};

export function dimensionLabel(dimension: string): string {
  return DIMENSION_EN_PALABRAS[dimension] ?? dimension;
}

/**
 * Solo las dimensiones que restan.
 *
 * Lo que se cumple no cambia ninguna decision; lo que falla, si. Mismo criterio
 * que el mapa de sintomas y la salud por capacidad.
 */
export function weakDimensions(claim: ClaimView): DimensionView[] {
  return claim.dimensions.filter((d) => ["weak", "absent", "unknown"].includes(d.rating));
}

export function ratingTone(rating: string): ConfidenceTone {
  switch (rating) {
    case "strong":
      return "success";
    case "adequate":
      return "brand";
    case "weak":
      return "warn";
    case "absent":
      return "danger";
    default:
      return "neutral";
  }
}

/**
 * Las incertidumbres que bloquean de verdad.
 *
 * Un `critical_unknown` no es "una duda mas": es lo que impide cerrar el caso, y
 * el esquema no deja escribir uno sin decir a que capa afecta y que lo
 * resolveria. Se separan para que no se pierdan entre las demas.
 */
export function splitUncertainties(uncertainties: UncertaintyView[]): {
  criticas: UncertaintyView[];
  resto: UncertaintyView[];
} {
  return {
    criticas: uncertainties.filter((u) => u.materiality === "critical_unknown"),
    resto: uncertainties.filter((u) => u.materiality !== "critical_unknown"),
  };
}

/** Si esto se puede resolver hoy o hay que esperar a tener datos. */
export function resolvabilityLabel(resolvability: string): string {
  switch (resolvability) {
    case "resolvable_now":
      return "se puede resolver ya";
    case "with_new_data":
      return "hace falta un dato que no tenemos";
    case "over_time":
      return "hace falta que pase el tiempo";
    default:
      return "no tiene solución conocida";
  }
}
