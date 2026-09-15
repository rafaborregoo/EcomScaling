/**
 * FASE 3 / D10 — del impacto medido a lo que se lee en pantalla.
 *
 * LA DECISION DE FONDO: **una cifra grande se lee como una gravedad si nadie lo
 * impide**. "-2.400 EUR" puesto solo en una tarjeta se convierte en "esto es lo
 * urgente" antes de que nadie haya decidido que lo sea, y D10 no decide eso: los
 * guardrails 3, 46, 47 y 48 dicen que el orden de ataque es F4, y el apartado 29
 * que la fuente **no define formula de severidad ni umbral de cuota**.
 *
 * Por eso aqui:
 *
 *   - la cifra **nunca va sola**: va con su base y su cuota, porque el mismo
 *     incidente es un 3 % del revenue y un 30 % de la contribucion (guardrails
 *     15 a 18), y sin base no significa nada;
 *   - se dice en voz alta que **es una estimacion**, no una medicion: la perdida
 *     es la diferencia contra un baseline, y un baseline es un modelo;
 *   - la severidad `unknown` se escribe como **lo que falta para poder decirla**,
 *     no como un hueco;
 *   - las evaluaciones **no se ordenan por cuanto dinero**. Ordenarlas por
 *     importe es exactamente la prioridad que el bloque no tiene.
 */

export type SeverityTone = "neutral" | "brand" | "success" | "warn" | "danger";

export type MeasurementView = {
  dimension: string;
  dimension_severity: string;
  nature: string;
  timing: string;
  evidence_type: string;
  quantification: string;
  metric: string | null;
  value: number | null;
  value_low: number | null;
  value_high: number | null;
  unit: string | null;
  period_start: string | null;
  period_end: string | null;
  method: string | null;
  assumptions: string | null;
  impact_confidence: string;
  note: string | null;
};

export type ExposureView = {
  denominator: string;
  denominator_value: number | null;
  denominator_note: string | null;
  exposure_share: number | null;
  affected_segment: string | null;
  is_chosen_denominator: boolean;
  confidence: string;
  rationale: string | null;
};

export type SeverityView = {
  id: string;
  organization_name: string | null;
  case_id: string;
  target: string;
  scope: string;
  acute_severity: string;
  cumulative_severity: string;
  forward_risk_severity: string;
  structural_severity: string;
  overall_severity: string;
  cause_confidence: string;
  impact_confidence: string;
  severity_confidence: string;
  trajectory: string;
  velocity: string;
  recurrence: string;
  measurement_compromised: boolean;
  material_exposure: boolean;
  escalation_signal: string;
  summary: string | null;
  limitations: string | null;
  assessed_at: string;
  measurements: MeasurementView[];
  exposures: ExposureView[];
};

const DENOMINADOR_EN_PALABRAS: Record<string, string> = {
  revenue: "la facturación del periodo",
  contribution: "la contribución del periodo",
  spend: "la inversión del periodo",
  orders: "los pedidos del periodo",
  customers: "los clientes del periodo",
  traffic: "las sesiones del periodo",
  inventory_value: "el valor del inventario",
  other: "otra base",
};

export function denominatorLabel(denominator: string): string {
  return DENOMINADOR_EN_PALABRAS[denominator] ?? denominator;
}

/**
 * La cifra, con su unidad y sin adornos.
 *
 * Un rango se escribe como rango (guardrail 24): convertirlo en su punto medio
 * es inventar una precision que nadie tiene.
 */
export function amountText(measurement: MeasurementView): string | null {
  const unidad = measurement.unit ? ` ${measurement.unit}` : "";

  if (measurement.quantification === "range") {
    if (measurement.value_low == null || measurement.value_high == null) return null;
    return `entre ${measurement.value_low.toLocaleString("es-ES")} y ${measurement.value_high.toLocaleString("es-ES")}${unidad}`;
  }
  if (measurement.value == null) return null;
  return `${measurement.value.toLocaleString("es-ES")}${unidad}`;
}

/**
 * Como de firme es esa cifra, dicho como lo que permite hacer.
 *
 * `exact` solo se puede decir sobre algo observado con el periodo cerrado, y el
 * esquema lo obliga. Lo demas se dice estimacion, porque lo es.
 */
export function quantificationLabel(measurement: MeasurementView): {
  label: string;
  tone: SeverityTone;
} {
  switch (measurement.quantification) {
    case "exact":
      return { label: "Cifra cerrada", tone: "brand" };
    case "range":
      return { label: "Rango", tone: "warn" };
    case "estimated":
      return { label: "Estimación", tone: "warn" };
    case "directional":
      return { label: "Solo dirección", tone: "neutral" };
    default:
      return { label: "Sin cuantificar", tone: "neutral" };
  }
}

/**
 * La cuota sobre la base elegida, que es la unica que juzga.
 *
 * Devuelve `null` cuando no hay base elegida o la cuota no significa nada (una
 * perdida en dinero sobre un recuento de pedidos, por ejemplo). Inventar un
 * porcentaje ahi seria justo lo que el guardrail 16 viene a impedir.
 */
export function chosenShare(assessment: SeverityView): {
  share: number;
  denominator: string;
  rationale: string | null;
} | null {
  const elegida = assessment.exposures.find((e) => e.is_chosen_denominator);
  if (!elegida || elegida.exposure_share == null) return null;
  return {
    share: elegida.exposure_share,
    denominator: denominatorLabel(elegida.denominator),
    rationale: elegida.rationale,
  };
}

/**
 * Por que la severidad sale `unknown`.
 *
 * Es el texto principal de la tarjeta, no una nota al pie. Sin el, un
 * `unknown` se lee como "el sistema no sabe hacer su trabajo" cuando lo que
 * dice es "nadie ha definido a partir de que cuota esto es grave".
 */
export function severityAbsenceReason(assessment: SeverityView): string | null {
  const todasDesconocidas = [
    assessment.acute_severity,
    assessment.cumulative_severity,
    assessment.forward_risk_severity,
    assessment.structural_severity,
    assessment.overall_severity,
  ].every((s) => s === "unknown");

  if (!todasDesconocidas) return null;
  return "La gravedad no se puntúa: nadie ha definido a partir de qué cuota esto es grave en esta tienda, y un umbral inventado se leería como si lo estuviera.";
}

/**
 * Las tres confianzas, que son tres juicios distintos (apartado 27).
 *
 * Verlas juntas es el punto: se puede saber muy bien cuanto se movio el dinero y
 * no tener ni idea de por que (guardrail 13). Colapsarlas en una sola cifra
 * borraria exactamente esa diferencia.
 */
export function confidenceRow(assessment: SeverityView): {
  label: string;
  value: string;
  tone: SeverityTone;
}[] {
  const tono = (v: string): SeverityTone =>
    v === "high" ? "success" : v === "medium" ? "brand" : v === "low" ? "warn" : "neutral";
  const palabra = (v: string) =>
    v === "high" ? "alta" : v === "medium" ? "media" : v === "low" ? "baja" : "insuficiente";

  return [
    { label: "En la cifra", value: palabra(assessment.impact_confidence), tone: tono(assessment.impact_confidence) },
    { label: "En la causa", value: palabra(assessment.cause_confidence), tone: tono(assessment.cause_confidence) },
    { label: "En la gravedad", value: palabra(assessment.severity_confidence), tone: tono(assessment.severity_confidence) },
  ];
}

/**
 * El orden de la lista.
 *
 * Por fecha de evaluacion, **no por importe**. Ordenar por cuanto dinero es
 * pintar la prioridad que los guardrails 3, 46, 47 y 48 dejan fuera de este
 * bloque: un HIGH puede ir antes que un CRITICAL segun esfuerzo y momento, y eso
 * es F4.
 */
export function sortAssessments(assessments: SeverityView[]): SeverityView[] {
  return [...assessments].sort((a, b) => {
    const diferencia =
      new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime();
    return diferencia !== 0 ? diferencia : a.id.localeCompare(b.id);
  });
}
