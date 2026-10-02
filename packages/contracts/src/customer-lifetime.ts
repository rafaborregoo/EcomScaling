/**
 * LTV, payback y churn: lo decidido el 2026-09-24 y la unica cuenta que no
 * vive en SQL (el payback, que cruza la curva con el CAC).
 *
 * - LTV sobre margen de contribucion, horizonte principal 365 dias. Si falta
 *   el coste de alguna linea, la contribucion es null y se dice "sin coste";
 *   el ingreso por cliente se muestra al lado, nunca en su lugar.
 * - Churn: cliente sin comprar en 180 dias.
 * - Payback: primer hito de la curva (30/60/90/180/365) en que la contribucion
 *   acumulada por cliente de la cohorte cubre el CAC de esa misma cohorte.
 */

export const LTV_HORIZON_DAYS = 365;
export const CHURN_DAYS = 180;
export const LIFETIME_MILESTONES = [30, 60, 90, 180, 365] as const;

export type LifetimeMilestone = {
  milestone_days: number;
  cohort_customers: number;
  avg_revenue: number | null;
  avg_contribution: number | null;
  items_without_cost: number;
  cohort_cac: number | null;
  lines_with_exact_metrics?: number;
  lines_with_estimated_metrics?: number;
  lines_without_metrics?: number;
  net_metrics_coverage_available?: boolean;
};

export type Payback =
  | { status: "PAID_BACK"; days: number }
  | { status: "NOT_WITHIN_HORIZON" }
  | {
      status: "UNKNOWN";
      reason:
        | "sin_cohorte"
        | "sin_coste"
        | "sin_cobertura"
        | "sin_cac"
        | "cohorte_inmadura"
        | "currency_incompatible"
        | "currency_unknown";
    };

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Normaliza filas de la RPC (numeric llega como string). */
export function parseLifetimeRows(rows: unknown): LifetimeMilestone[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row: any) => {
    const coverageAvailable = [
      row.lines_with_exact_metrics,
      row.lines_with_estimated_metrics,
      row.lines_without_metrics,
    ].every((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
    const linesWithoutMetrics = coverageAvailable ? Number(row.lines_without_metrics) : undefined;
    const netMetricsComplete = coverageAvailable && linesWithoutMetrics === 0;
    return {
      milestone_days: Number(row.milestone_days),
      cohort_customers: Number(row.cohort_customers ?? 0),
      avg_revenue: netMetricsComplete ? num(row.avg_revenue) : null,
      avg_contribution: netMetricsComplete ? num(row.avg_contribution) : null,
      items_without_cost: Number(row.items_without_cost ?? 0),
      cohort_cac: num(row.cohort_cac),
      ...(coverageAvailable
        ? {
            lines_with_exact_metrics: Number(row.lines_with_exact_metrics),
            lines_with_estimated_metrics: Number(row.lines_with_estimated_metrics),
            lines_without_metrics: linesWithoutMetrics!,
          }
        : {}),
      net_metrics_coverage_available: coverageAvailable,
    };
  });
}

export function paybackFromCurve(curve: LifetimeMilestone[]): Payback {
  const matured = curve.filter((m) => m.cohort_customers > 0).sort((a, b) => a.milestone_days - b.milestone_days);
  if (!matured.length) return { status: "UNKNOWN", reason: "sin_cohorte" };
  const withNetCoverage = matured.filter(
    (m) => m.net_metrics_coverage_available === true && m.lines_without_metrics === 0,
  );
  if (!withNetCoverage.length) return { status: "UNKNOWN", reason: "sin_cobertura" };
  const withCost = withNetCoverage.filter((m) => m.avg_contribution !== null);
  if (!withCost.length) {
    return matured.some((m) => (m.lines_without_metrics ?? 0) > 0)
      ? { status: "UNKNOWN", reason: "sin_cobertura" }
      : { status: "UNKNOWN", reason: "sin_coste" };
  }
  const comparable = withCost.filter((m) => m.cohort_cac !== null);
  if (!comparable.length) return { status: "UNKNOWN", reason: "sin_cac" };
  const hit = comparable.find((m) => m.avg_contribution! >= m.cohort_cac!);
  if (hit) return { status: "PAID_BACK", days: hit.milestone_days };
  // Solo se afirma "no recupera en un año" si el hito de 365 existe y no llega.
  return comparable.some((m) => m.milestone_days === LTV_HORIZON_DAYS)
    ? { status: "NOT_WITHIN_HORIZON" }
    : { status: "UNKNOWN", reason: "cohorte_inmadura" };
}

/** El hito mas largo con cohorte madura: el LTV que de verdad se puede afirmar. */
export function longestMaturedMilestone(curve: LifetimeMilestone[]): LifetimeMilestone | null {
  return [...curve].filter((m) => m.cohort_customers > 0).sort((a, b) => b.milestone_days - a.milestone_days)[0] ?? null;
}
