/**
 * FASE 3 / D06 — del sintoma a lo que se lee en pantalla.
 *
 * Aparte del componente, como el de `D01` y el de `D02`: aqui estan las
 * decisiones, y las decisiones se prueban sin montar React.
 *
 * LA DECISION DE FONDO, y es la unica que importa en esta pantalla: **un
 * sintoma se lee como una causa si no se le pone freno**. "Caida de ventas
 * netas · confianza media" puesto en una tarjeta bonita se convierte en la
 * cabeza del consultor en "ya se lo que pasa" antes de llegar a la llamada. Por
 * eso aqui:
 *
 *   - la confianza no se dice como nota, se dice como **para que sirve** --
 *     "sirve para investigar, no para concluir";
 *   - la coherencia no se pinta como cinco casillas, se pinta como la frase que
 *     explica por que esas senales estan juntas;
 *   - lo que contradice se ensena igual de grande que lo que apoya (guardrail
 *     13), porque ver solo lo que encaja es como se cierra un diagnostico falso;
 *   - `often_cooccurs` se traduce a "coinciden en el tiempo" y **nunca** a nada
 *     que suene a causa (guardrail 18).
 */

export type SymptomSignalView = {
  role: string;
  id?: string;
  metric?: string;
  direction?: string;
  magnitude_relative?: number | null;
  window_start?: string;
  window_end?: string;
};

export type SymptomEvidenceView = {
  source_kind: string;
  stance: string;
  observation: string;
  representativeness: string | null;
  sample_size: number | null;
};

export type SymptomRelationView = {
  from_symptom_id: string;
  to_symptom_id: string;
  relation: string;
  rationale: string | null;
};

export type SymptomView = {
  id: string;
  organization_name: string | null;
  symptom_family: string;
  canonical_type: string;
  label: string;
  valence: string;
  capability: string | null;
  scope: string;
  scope_detail: Record<string, unknown>;
  diagnostic_depth: string;
  process_position: string | null;
  time_role: string | null;
  persistence: string;
  recurrence_count: number;
  same_time_window: boolean;
  compatible_scope: boolean;
  compatible_direction: boolean;
  known_relationship: boolean;
  sufficient_signal_quality: boolean;
  coherence_relationship: string | null;
  confidence: string;
  data_confidence: string;
  context_reviewed: boolean;
  parent_symptom_id: string | null;
  previous_symptom_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  signals: SymptomSignalView[];
  evidence: SymptomEvidenceView[];
  relations: SymptomRelationView[];
};

export type SymptomTone = "neutral" | "brand" | "success" | "warn" | "danger";

/**
 * La valencia, que es contextual por guardrail 21.
 *
 * `mixed` no es "un poco malo": es que el patron apunta a dos sitios a la vez,
 * y decirlo asi es lo que impide resumirlo en una flecha.
 */
export function valenceLabel(valence: string): { label: string; tone: SymptomTone } {
  switch (valence) {
    case "negative":
      return { label: "Negativo", tone: "danger" };
    case "positive":
      return { label: "Positivo", tone: "success" };
    case "mixed":
      return { label: "Mixto", tone: "warn" };
    default:
      return { label: "Neutro", tone: "neutral" };
  }
}

/**
 * La confianza dicha como lo que permite hacer, no como nota.
 *
 * Es la diferencia entre "media" --que cada uno interpreta como quiere-- y
 * "sirve para investigar, no para concluir", que es una instruccion.
 */
export function confidenceLabel(confidence: string): {
  label: string;
  detail: string;
  tone: SymptomTone;
} {
  switch (confidence) {
    case "high":
      return {
        label: "Patrón sólido",
        detail: "Las señales son coherentes, el dato aguanta y D02 revisó el contexto.",
        tone: "success",
      };
    case "medium":
      return {
        label: "Sirve para investigar",
        detail: "Hay relación declarada entre las señales, pero falta algo para afirmarlo del todo.",
        tone: "warn",
      };
    case "insufficient_data":
      return {
        label: "Sin dato suficiente",
        detail: "D01 no da por utilizable el dato que lo sostiene.",
        tone: "danger",
      };
    default:
      return {
        label: "Indicio, nada más",
        detail: "No hay coherencia suficiente para tratarlo como patrón. Es un punto de partida.",
        tone: "neutral",
      };
  }
}

const RELACION_EN_PALABRAS: Record<string, string> = {
  mathematical: "una relación aritmética",
  funnel: "un mismo embudo",
  functional: "un input compartido",
  economic: "una relación económica",
  operational: "una relación operativa",
  temporal: "una relación temporal declarada",
};

/**
 * Por que estas senales estan juntas, en frases.
 *
 * Los cinco factores del paso 4 son booleanos en la tabla y serian cinco
 * casillas en pantalla. Cinco casillas no se leen; una frase por lo que falta,
 * si. Y lo que falta es lo unico que hay que mirar: lo que se cumple no cambia
 * ninguna decision.
 */
export function coherenceReasons(symptom: SymptomView): string[] {
  const razones: string[] = [];

  if (symptom.known_relationship && symptom.coherence_relationship) {
    razones.push(
      `Las señales están unidas por ${RELACION_EN_PALABRAS[symptom.coherence_relationship] ?? symptom.coherence_relationship}.`,
    );
  } else {
    razones.push(
      "Nadie ha declarado una relación entre estas métricas: coinciden, que no es lo mismo.",
    );
  }

  if (!symptom.compatible_direction) {
    razones.push("Sus componentes se mueven en sentidos opuestos, así que el patrón no es limpio.");
  }
  if (!symptom.sufficient_signal_quality) {
    razones.push("La calidad de la señal no da para afirmar con fuerza.");
  }
  if (!symptom.context_reviewed) {
    razones.push("D02 todavía no ha contextualizado este movimiento.");
  }

  return razones;
}

/**
 * Cuanto lleva pasando, que es una pregunta distinta de cuantas veces ha pasado.
 *
 * Confundirlas cambia el diagnostico: uno vuelve, el otro nunca se fue.
 */
export function persistenceLabel(symptom: SymptomView, now: Date = new Date()): string {
  const dias = Math.max(
    0,
    Math.floor((now.getTime() - new Date(symptom.first_seen_at).getTime()) / 86_400_000),
  );

  if (symptom.persistence === "chronic") {
    return `Crónico · abierto desde hace ${dias} día${dias === 1 ? "" : "s"}`;
  }
  if (symptom.persistence === "recurring") {
    return `Recurrente · ${symptom.recurrence_count}ª vez`;
  }
  if (dias === 0) return "Detectado hoy por primera vez";
  return `Abierto desde hace ${dias} día${dias === 1 ? "" : "s"}`;
}

/**
 * Donde pasa.
 *
 * Guardrail 24: un sintoma local no se esconde porque el agregado este estable,
 * y por tanto la pantalla tiene que decir donde, no dejarlo en "el negocio".
 */
export function scopeLabel(symptom: SymptomView): string {
  if (symptom.scope === "business") return "Todo el negocio";
  const detalle = Object.entries(symptom.scope_detail ?? {})
    .filter(([clave]) => clave !== "store_id")
    .map(([, valor]) => String(valor))
    .filter(Boolean);
  return detalle.length > 0 ? detalle.join(" · ") : symptom.scope;
}

/**
 * El papel de una senal dentro del sintoma.
 *
 * `contradicting` es el unico que importa de verdad: es la evidencia que el
 * guardrail 13 obliga a conservar, y en pantalla tiene que verse, no esconderse
 * detras de un icono gris.
 */
export function signalRoleLabel(role: string): { label: string; tone: SymptomTone } {
  switch (role) {
    case "required":
      return { label: "La sostiene", tone: "brand" };
    case "contradicting":
      return { label: "La contradice", tone: "danger" };
    case "neutral":
      return { label: "Neutra", tone: "neutral" };
    default:
      return { label: "La apoya", tone: "neutral" };
  }
}

/**
 * Las relaciones candidatas, en palabras que no son causales.
 *
 * Guardrail 18: `may_precede` no es "causa". Si alguna vez alguien traduce esto
 * por "provoca", el bloque entero deja de servir.
 */
export function relationLabel(relation: string): string {
  switch (relation) {
    case "may_precede":
      return "suele aparecer antes que";
    case "may_follow":
      return "suele aparecer después que";
    case "often_cooccurs":
      return "coincide en el tiempo con";
    default:
      return "está relacionado con";
  }
}

/**
 * El arbol: cada padre con lo que lo descompone debajo.
 *
 * Un sintoma huerfano --cuyo padre no esta en la lista-- se muestra arriba en
 * vez de desaparecer. Esconder una fila porque falta otra es la peor forma de
 * fallar en una pantalla de diagnostico.
 */
export function buildSymptomTree(
  symptoms: SymptomView[],
): { symptom: SymptomView; children: SymptomView[] }[] {
  const ids = new Set(symptoms.map((s) => s.id));
  const raices = symptoms.filter((s) => !s.parent_symptom_id || !ids.has(s.parent_symptom_id));
  return raices.map((symptom) => ({
    symptom,
    children: symptoms.filter((s) => s.parent_symptom_id === symptom.id),
  }));
}
