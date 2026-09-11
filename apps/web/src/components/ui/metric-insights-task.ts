/**
 * Lo que un agente opina sobre UNA metrica concreta. Es la misma forma que ya
 * tiene un `finding` de packages/ai (title/severity/evidence) mas los pasos y
 * la marca de "esto no se puede olvidar" -- de ahi saldra el dia que se
 * conecte al agente de verdad; hoy la card se lo pasa a mano.
 */
export type MetricInsight = {
  id: string;
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  /** Por que lo dice: la cifra concreta, no una generalidad. */
  evidence: string;
  /** Que hacer, en orden. Van a la descripcion de la tarea tal cual. */
  steps: string[];
  /** El agente cree que esto merece tarea: llega premarcado. */
  needsTask?: boolean;
};

// El contador de la card solo cuenta lo que pide algo. Con seis hallazgos
// informativos sobre ROAS el numero deja de significar nada y se ignora para
// siempre; los informativos siguen dentro del panel, sin gritar desde fuera.
const COUNTS: ReadonlySet<MetricInsight["severity"]> = new Set([
  "medium",
  "high",
  "critical",
]);

export function insightBadgeCount(insights: MetricInsight[]) {
  return insights.filter((insight) => COUNTS.has(insight.severity)).length;
}

/**
 * Redacta la tarea con el contexto de TODO lo seleccionado, no de un hallazgo.
 * Es el motivo de que la seleccion sea multiple: dos avisos sobre la misma
 * metrica suelen ser la misma tarea, y por separado se hacen dos veces mal.
 */
export function composeTask(
  metricLabel: string,
  insights: MetricInsight[],
): { title: string; description: string } {
  const title =
    insights.length === 1
      ? insights[0].title
      : `${metricLabel}: ${insights.length} puntos a revisar`;
  const contexto = insights
    .map((insight) => `- ${insight.title}: ${insight.evidence}`)
    .join("\n");
  const pasos = insights
    .flatMap((insight) => insight.steps)
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n");
  return {
    title,
    description: `Contexto (${metricLabel}):\n${contexto}\n\nPasos:\n${pasos}`,
  };
}
