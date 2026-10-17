import { test } from "node:test";
import assert from "node:assert/strict";
import { longestMaturedMilestone, parseLifetimeRows, paybackFromCurve, type LifetimeMilestone } from "./customer-lifetime.js";

const m = (days: number, over: Partial<LifetimeMilestone> = {}): LifetimeMilestone => ({
  milestone_days: days, cohort_customers: 10, avg_revenue: 50, avg_contribution: 10, items_without_cost: 0, cohort_cac: 25,
  net_metrics_coverage_available: true, lines_without_metrics: 0, ...over,
});

test("payback: primer hito en que la contribucion acumulada cubre el CAC de su cohorte", () => {
  const curve = [m(30, { avg_contribution: 10 }), m(90, { avg_contribution: 30 }), m(365, { avg_contribution: 60 })];
  assert.deepEqual(paybackFromCurve(curve), { status: "PAID_BACK", days: 90 });
});

test("payback: sin coste no se inventa margen, y sin gasto no hay CAC", () => {
  assert.deepEqual(paybackFromCurve([m(90, { avg_contribution: null })]), { status: "UNKNOWN", reason: "sin_coste" });
  assert.deepEqual(paybackFromCurve([m(90, { cohort_cac: null })]), { status: "UNKNOWN", reason: "sin_cac" });
  assert.deepEqual(paybackFromCurve([m(90, { cohort_customers: 0 })]), { status: "UNKNOWN", reason: "sin_cohorte" });
});

test("payback: 'no recupera en un año' solo si el hito de 365 existe y no llega", () => {
  assert.deepEqual(paybackFromCurve([m(90, { avg_contribution: 5 }), m(365, { avg_contribution: 20 })]), { status: "NOT_WITHIN_HORIZON" });
  assert.deepEqual(paybackFromCurve([m(90, { avg_contribution: 5 })]), { status: "UNKNOWN", reason: "cohorte_inmadura" });
});

test("las filas de la RPC llegan con numeric como texto y el LTV afirmable es el hito mas largo con cohorte", () => {
  const rows = parseLifetimeRows([
    { milestone_days: 30, cohort_customers: "4", avg_revenue: "40.5", avg_contribution: null, items_without_cost: "2", cohort_cac: null, lines_with_exact_metrics: 3, lines_with_estimated_metrics: 1, lines_without_metrics: 0 },
    { milestone_days: 365, cohort_customers: 0, avg_revenue: null, avg_contribution: null, items_without_cost: 0, cohort_cac: null, lines_with_exact_metrics: 0, lines_with_estimated_metrics: 0, lines_without_metrics: 0 },
  ]);
  assert.equal(rows[0]!.avg_revenue, 40.5);
  assert.equal(rows[0]!.avg_contribution, null);
  assert.equal(longestMaturedMilestone(rows)?.milestone_days, 30);
});
