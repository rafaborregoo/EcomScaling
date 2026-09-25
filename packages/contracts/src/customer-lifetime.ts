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
};

export type Payback =
  | { status: "PAID_BACK"; days: number }
  | { status: "NOT_WITHIN_HORIZON" }
  | { status: "UNKNOWN"; reason: "sin_cohorte" | "sin_coste" | "sin_cac" | "cohorte_inmadura" };

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Normaliza filas de la RPC (numeric llega como string). */
export function parseLifetimeRows(rows: unknown): LifetimeMilestone[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row: any) => ({
    milestone_days: Number(row.milestone_days),
    cohort_customers: Number(row.cohort_customers ?? 0),
    avg_revenue: num(row.avg_revenue),
    avg_contribution: num(row.avg_contribution),
    items_without_cost: Number(row.items_without_cost ?? 0),
    cohort_cac: num(row.cohort_cac),
  }));
}

export function paybackFromCurve(curve: LifetimeMilestone[]): Payback {
  const matured = curve.filter((m) => m.cohort_customers > 0).sort((a, b) => a.milestone_days - b.milestone_days);
  if (!matured.length) return { status: "UNKNOWN", reason: "sin_cohorte" };
  const withCost = matured.filter((m) => m.avg_contribution !== null);
  if (!withCost.length) return { status: "UNKNOWN", reason: "sin_coste" };
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
