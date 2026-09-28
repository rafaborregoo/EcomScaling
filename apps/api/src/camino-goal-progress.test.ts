import assert from "node:assert/strict";
import test from "node:test";
import { calculateCaminoGoalProgress, type CaminoMetricRead } from "./camino-goal-progress.js";

const now = new Date("2026-10-16T12:00:00.000Z");
const covered = (provider: string) => ({
  availability: "available",
  connections: [{ provider, status: "connected", last_sync_at: "2026-10-16T11:00:00.000Z", last_error_at: null }],
});
const read = (row: Record<string, unknown> | null, error: string | null = null): CaminoMetricRead => ({ row, error });
const emptyRead = read(null);

function baseInput(goal: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    goal,
    planStartedAt: "2026-09-01T12:00:00.000Z",
    planCreatedAt: "2026-09-01T12:00:00.000Z",
    now,
    coverage: covered("shopify"),
    sales: { current: emptyRead, previous: emptyRead },
    financial: { current: emptyRead, previous: emptyRead },
    stock: emptyRead,
    meta: { current: emptyRead, previous: emptyRead },
    ...overrides,
  };
}

const salesGoal = {
  metric_key: "net_sales",
  metric_label: "Ingresos netos",
  unit: "money",
  baseline: 9000,
  baseline_window_days: 90,
  target: 4000,
  target_offset_days: 91,
  target_date: "2026-12-01",
};

test("normaliza flujos mensuales al mismo periodo y calcula el ritmo lineal sin pedirle el estado al LLM", () => {
  const input = baseInput(salesGoal, {
    sales: {
      current: read({ orders_count: 20, net_sales: 820, aov: 41 }),
      previous: read({ orders_count: 18, net_sales: 700, aov: 38.89 }),
    },
  });
  const result = calculateCaminoGoalProgress(input);
  assert.equal(result.measurement_period, "equivalent_monthly");
  assert.equal(result.baseline_value, 3044);
  assert.equal(result.observed_value, 3565.83);
  assert.equal(result.comparison_value, 3044);
  assert.equal(result.status, "on_track");
  assert.equal(result.expected_value, 3514.16);
});

test("marca alcanzado solo cuando la medición observada cumple el target en su base temporal", () => {
  const result = calculateCaminoGoalProgress(baseInput(salesGoal, {
    sales: { current: read({ orders_count: 20, net_sales: 1000, aov: 50 }), previous: read({ orders_count: 18, net_sales: 700, aov: 38.89 }) },
  }));
  assert.equal(result.status, "achieved");
  assert.equal(result.observed_value, 4348.57);
});

test("no confunde query fallida, tienda obsoleta, cero pedidos o baseline legacy sin ventana con progreso cero", () => {
  const noOrders = calculateCaminoGoalProgress(baseInput(salesGoal, {
    sales: { current: read({ orders_count: 0, net_sales: 0, aov: 0 }), previous: emptyRead },
  }));
  assert.equal(noOrders.status, "insufficient_data");
  assert.equal(noOrders.observed_value, null);
  assert.match(noOrders.explanation, /no hay pedidos recientes/i);

  const errored = calculateCaminoGoalProgress(baseInput(salesGoal, {
    sales: { current: read(null, "rpc failed"), previous: emptyRead },
  }));
  assert.equal(errored.status, "insufficient_data");
  assert.equal(errored.observed_value, null);

  const legacy = calculateCaminoGoalProgress(baseInput({ ...salesGoal, baseline_window_days: undefined }, {
    sales: { current: read({ orders_count: 4, net_sales: 120, aov: 30 }), previous: emptyRead },
  }));
  assert.equal(legacy.status, "insufficient_data");
  assert.equal(legacy.observed_value, null);

  const stale = calculateCaminoGoalProgress(baseInput(salesGoal, {
    coverage: { availability: "available", connections: [{ provider: "shopify", status: "connected", last_sync_at: "2026-10-12T00:00:00.000Z" }] },
    sales: { current: read({ orders_count: 4, net_sales: 120, aov: 30 }), previous: emptyRead },
  }));
  assert.equal(stale.status, "insufficient_data");
  assert.equal(stale.observed_value, null);
});

test("beneficio y margen requieren costes configurados y cobertura completa de coste de producto", () => {
  const result = calculateCaminoGoalProgress(baseInput({
    metric_key: "net_profit", metric_label: "Beneficio neto", unit: "money", baseline: 1000,
    baseline_window_days: 90, target: 1200, target_offset_days: 91, target_date: "2026-12-01",
  }, {
    financial: { current: read({ net_profit: 100, net_sales: 300, orders_count: 4, has_settings: true, items_without_cost: 2 }), previous: emptyRead },
  }));
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.observed_value, null);
  assert.match(result.explanation, /productos vendidos sin coste/i);
});

test("ROAS/CAC exigen frescura y al menos cinco días Meta; CAC menor es progreso", () => {
  const goal = { metric_key: "cac", metric_label: "CAC Meta Ads", unit: "money", baseline: 40, baseline_window_days: 90, target: 30, target_offset_days: 91, target_date: "2026-12-01" };
  const lowCoverage = calculateCaminoGoalProgress(baseInput(goal, {
    coverage: covered("meta_ads"),
    meta: { current: read({ cac: 25, purchases: 8, days_with_data: 4 }), previous: emptyRead },
  }));
  assert.equal(lowCoverage.status, "insufficient_data");

  const achieved = calculateCaminoGoalProgress(baseInput(goal, {
    coverage: covered("meta_ads"),
    meta: { current: read({ cac: 25, purchases: 8, days_with_data: 7 }), previous: read({ cac: 39, purchases: 6, days_with_data: 7 }) },
  }));
  assert.equal(achieved.status, "achieved");
  assert.equal(achieved.observed_value, 25);
  assert.equal(achieved.measurement_period, "rolling_7_days");
});

test("cero unidades agotadas es válido solo con inventario monitorizado y sync fresco", () => {
  const result = calculateCaminoGoalProgress(baseInput({
    metric_key: "out_of_stock_items", metric_label: "Productos agotados", unit: "count", baseline: 5,
    target: 0, target_offset_days: 91, target_date: "2026-12-01",
  }, { stock: read({ tracked_items: 28, out_of_stock_items: 0 }) }));
  assert.equal(result.status, "achieved");
  assert.equal(result.observed_value, 0);
  assert.equal(result.measurement_period, "point_in_time");
});
