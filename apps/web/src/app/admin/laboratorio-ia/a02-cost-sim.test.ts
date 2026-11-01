import assert from "node:assert/strict";
import { test } from "node:test";
import {
  a02ColdUsage,
  a02OperatingCosts,
  a02OperatingPlan,
  type MonitorOperation,
} from "./a02-cost-sim";
import type { AiModelLabReport } from "@e-nora/contracts";

const operation: MonitorOperation = {
  design_client_runs_per_day: 4.33,
  saved_client_runs_per_day: null,
  cadences: [
    { lookback_days: 7, min_run_age_hours: 24 },
    { lookback_days: 30, min_run_age_hours: 56 },
    { lookback_days: 90, min_run_age_hours: 168 },
  ],
  panel_min_run_age_hours: 8,
  ticks_per_day: 2,
  org_daily_run_cap: 12,
};

test("sin descuento de caché entre pasadas: GPT incluye esos tokens; Claude vuelve a escribirlos", () => {
  const usage = { input: 1000, cached: 400, cache_creation: 200, output: 50 };
  assert.deepEqual(a02ColdUsage("gpt-6.1-sol", usage), { ...usage, cached: 0 });
  assert.deepEqual(a02ColdUsage("claude-haiku-5-5", usage), {
    ...usage,
    cached: 0,
    cache_creation: 600,
  });
});

test("A02 incluye cliente completo, tienda, ventanas 7/90 y dos lecturas del consultor", () => {
  const plan = a02OperatingPlan(operation, 1, true);
  assert.ok(Math.abs(plan.client - (8 / 2.5 + 1 + 1 / 7)) < 1e-10);
  assert.equal(plan.panel, 2);
  assert.ok(Math.abs(plan.total - 6.342857142857143) < 1e-10);
  assert.equal(a02OperatingPlan(operation, 1, false).panel, 0);
});
test("A02 con varias tiendas añade cachés de panel y no recorta demanda para ocultar cupos", () => {
  const plan = a02OperatingPlan(operation, 3, true);
  assert.equal(plan.panel, 8);
  assert.ok(plan.total > operation.org_daily_run_cap);
  assert.equal(plan.rows.find((row) => row.id === "client-7")?.scopes, 1);
  assert.equal(plan.rows.find((row) => row.id === "client-30-meta")?.scopes, 4);
});
test("el ajuste positivo escala dashboards, no acelera panel; cero desactiva ambos", () => {
  const faster = a02OperatingPlan(
    { ...operation, saved_client_runs_per_day: 8.66 },
    1,
    true,
  );
  assert.ok(faster.client > a02OperatingPlan(operation, 1, true).client);
  assert.equal(faster.panel, 2);
  assert.equal(
    a02OperatingPlan({ ...operation, saved_client_runs_per_day: 0 }, 1, true)
      .total,
    0,
  );
});
test("pondera el precio de cada vista y añade clientes, días y reserva sin inventar precios ausentes", () => {
  const report = {
    models: [{ id: "gpt-6.1-sol", label: "Sol" }],
    cases: ["overview", "shopify", "meta", "klaviyo", "panel"].map((view) => ({
      id: view,
      monitor_benchmark: { dashboard_scope: view },
    })),
    results: ["overview", "shopify", "meta", "klaviyo", "panel"].map(
      (view) => ({
        case_id: view,
        model_id: "gpt-6.1-sol",
        status: "completed",
        usage: {
          input: view === "panel" ? 2000 : 1000,
          cached: 0,
          cache_creation: 0,
          output: 0,
        },
      }),
    ),
  } as unknown as AiModelLabReport;
  const plan = a02OperatingPlan(operation, 1, true);
  const cost = a02OperatingCosts(report, plan, 2, 10)[0]!;
  assert.ok(cost.available);
  if (!cost.available) return;
  assert.ok(
    Math.abs(
      cost.monthlyLow -
        (plan.client * 0.002 + plan.panel * 0.004) * 30 * 2 * 1.1,
    ) < 1e-10,
  );
  assert.equal(
    a02OperatingCosts({ ...report, results: [] }, plan, 1, 0)[0]?.available,
    false,
  );
});
