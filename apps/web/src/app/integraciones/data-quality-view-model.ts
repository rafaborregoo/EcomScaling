/**
 * FASE 3 / D01 — de la evaluacion de calidad a lo que se lee en pantalla.
 *
 * Aparte del componente por el mismo motivo que `store-view-model.ts`: aqui
 * estan las decisiones, y las decisiones se prueban sin montar React.
 *
 * LA DECISION DE FONDO: **la etiqueta dice lo que el fallo le hace al
 * diagnostico, no lo buena que es la fuente**. "Fiabilidad baja" obliga al
 * consultor a traducir; "bloquea el diagnostico" ya esta traducido. Es
 * literalmente la columna `downstream_effect` del contrato de D01, que existe
 * para eso (apartado 17).
 */

export type DataQualityIssueView = {
  id: string;
  issue_type: string;
  description: string;
  severity: string;
  material: boolean;
  downstream_effect: "none" | "degraded" | "blocked";
  client_actionable: boolean;
  detected_at: string;
};

export type DataQualitySource = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  store_id: string | null;
  source: string;
  dataset: string;
  freshness: string;
  coverage: number | null;
  missingness: string | null;
  period_settlement: string;
  reliability: string;
  degradation_reasons: string[];
  last_sync_at: string | null;
  assessed_at: string;
  issues: DataQualityIssueView[];
};

export type VerdictTone = "neutral" | "brand" | "success" | "warn" | "danger";

/** Que le hace esta fuente al diagnostico. Es lo primero que se lee de la fila. */
export function downstreamVerdict(source: {
  issues: { downstream_effect: string }[];
}): { label: string; tone: VerdictTone } {
  if (source.issues.some((i) => i.downstream_effect === "blocked")) {
    return { label: "Bloquea el diagnóstico", tone: "danger" };
  }
  if (source.issues.some((i) => i.downstream_effect === "degraded")) {
    return { label: "Lo degrada", tone: "warn" };
  }
  return { label: "Apto", tone: "success" };
}

const FRESHNESS_LABEL: Record<string, string> = {
  real_time: "en tiempo real",
  fresh: "al día",
  delayed: "con retraso",
  stale: "obsoleto",
  severely_stale: "muy obsoleto",
  unknown: "frescura sin determinar",
};

const SETTLEMENT_LABEL: Record<string, string> = {
  open: "periodo aún abierto",
  partially_settled: "periodo recién cerrado",
  settled: "periodo cerrado",
  unknown: "cierre sin determinar",
};

/**
 * La segunda linea: los hechos que sostienen el veredicto, sin jerga.
 *
 * La cobertura solo aparece cuando se pudo medir. Escribir "100%" donde no hay
 * denominador es exactamente el guardrail 32 al reves, y en pantalla mentiria
 * mas que en la tabla: nadie audita un porcentaje que parece bueno.
 */
export function sourceFacts(source: {
  freshness: string;
  coverage: number | null;
  period_settlement: string;
}): string {
  const partes = [FRESHNESS_LABEL[source.freshness] ?? source.freshness];

  if (source.coverage != null) {
    const pct = Math.round(source.coverage * 100);
    partes.push(pct === 100 ? "sin huecos" : `${pct}% del periodo cubierto`);
  }

  partes.push(SETTLEMENT_LABEL[source.period_settlement] ?? source.period_settlement);
  return partes.join(" · ");
}
