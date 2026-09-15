/**
 * FASE 3 / D02 — de la lectura contextual a lo que se lee en pantalla.
 *
 * Aparte del componente, como `store-view-model.ts` y el de `D01`: aqui estan
 * las decisiones y las decisiones se prueban sin montar React.
 *
 * LA DECISION DE FONDO, y es la misma que en `D01` llevada un paso mas: la
 * pantalla dice **que significa el movimiento**, no como se llama internamente.
 * "mix_shift" no le dice nada a nadie; "cambio el peso de los segmentos, no su
 * rendimiento" es la frase que el consultor puede llevarse a la llamada.
 *
 * Y dice tambien lo que la lectura NO permite afirmar, porque una comparacion
 * que no se sostiene y una que si se sostiene se parecen mucho en una tabla.
 */

export type MixSegmentView = {
  dimension: string;
  segment: string;
  weight_before: number;
  weight_after: number;
  performance_before: number | null;
  performance_after: number | null;
};

export type ContextReading = {
  id: string;
  organization_name: string | null;
  target_metric: string | null;
  target_question: string | null;
  scope: string;
  comparability: string;
  comparability_reasons: string[];
  aggregate_interpretation: string;
  context_sufficient: boolean;
  missing_context: string[];
  critical_unknowns: string[];
  primary_factors: string[];
  baseline_type: string | null;
  baseline_period_start: string | null;
  baseline_period_end: string | null;
  analysis_period_start: string | null;
  analysis_period_end: string | null;
  assessed_at: string;
  mix: MixSegmentView[];
};

export type ReadingTone = "neutral" | "brand" | "success" | "warn" | "danger";

/**
 * Que significa el movimiento, en la frase que el consultor usaria.
 *
 * `undetermined` no es un fallo ni un "no se": es el resultado correcto cuando
 * no hay descomposicion con la que responder, y se dice asi para que nadie lo
 * confunda con "no pasa nada".
 */
export function interpretationLabel(interpretation: string): {
  label: string;
  detail: string;
  tone: ReadingTone;
} {
  switch (interpretation) {
    case "performance_change":
      return {
        label: "Cambió el rendimiento",
        detail: "El movimiento ocurre dentro de los segmentos, no en sus pesos.",
        tone: "warn",
      };
    case "mix_shift":
      return {
        label: "Cambió la composición",
        detail:
          "Cada segmento rinde parecido; lo que cambió es cuánto pesa cada uno. Buscar un deterioro aquí es buscar algo que no pasó.",
        tone: "brand",
      };
    case "mixed":
      return {
        label: "Las dos cosas",
        detail:
          "Unas dimensiones apuntan a rendimiento y otras a composición. Las dos pueden ser ciertas.",
        tone: "warn",
      };
    default:
      return {
        label: "Sin determinar",
        detail:
          "No hay descomposición con la que separar rendimiento de composición. No es que no pase nada: es que todavía no se puede decir.",
        tone: "neutral",
      };
  }
}

/** Si la comparacion aguanta. Es lo que decide si lo de arriba se puede creer. */
export function comparabilityLabel(comparability: string): {
  label: string;
  tone: ReadingTone;
} {
  switch (comparability) {
    case "comparable":
      return { label: "Comparación válida", tone: "success" };
    case "not_comparable":
      return { label: "No se puede comparar", tone: "danger" };
    default:
      return { label: "Comparación limitada", tone: "warn" };
  }
}

/**
 * El movimiento de un segmento, en puntos porcentuales de peso.
 *
 * En puntos y no en porcentaje de variacion a proposito: pasar del 5% al 10%
 * de peso es "+5 puntos", y decir "+100%" sobre un peso es la clase de cifra
 * que impresiona y no informa.
 */
export function weightShift(segment: MixSegmentView): string {
  const puntos = (segment.weight_after - segment.weight_before) * 100;
  const signo = puntos > 0 ? "+" : "";
  return `${signo}${puntos.toFixed(1)} pts`;
}

/**
 * Si el rendimiento del segmento se movio de verdad.
 *
 * El umbral existe porque sin el, cualquier decimal se pinta como un cambio y
 * la tabla deja de distinguir lo que importa. 1% es el ruido tipico de un AOV
 * entre dos semanas; queda a la vista para poder calibrarlo.
 */
export const RUIDO_RENDIMIENTO = 0.01;

export function performanceMoved(segment: MixSegmentView): boolean {
  if (segment.performance_before == null || segment.performance_after == null) return false;
  if (segment.performance_before === 0) return segment.performance_after !== 0;
  return (
    Math.abs(segment.performance_after - segment.performance_before) /
      Math.abs(segment.performance_before) >
    RUIDO_RENDIMIENTO
  );
}
