import assert from "node:assert/strict";
import { test } from "node:test";
import {
  costPerRun,
  closedAgentsCost,
  plannedRunsPerDay,
  totals,
  type SimModel,
} from "./cost-sim";

test("una tienda cuenta ámbitos de A04 y conserva el panel independiente de A02", () => {
  assert.equal(plannedRunsPerDay("a04_generador_tareas", 1), 2);
  assert.equal(plannedRunsPerDay("a04_generador_tareas", 0), 0);
  assert.equal(plannedRunsPerDay("a02_monitor_negocio", 4.33, 2), 6.33);
  assert.equal(plannedRunsPerDay("otro_agente", 1), 1);
});

const sonnet: SimModel = {
  id: "s",
  label: "S",
  input: 2,
  output: 10,
  cache_read: 0.2,
};

test("el acumulado deja A01 pendiente hasta indicar reuniones", () => {
  const rows = [{ code: "a01_analista_llamadas", profile: { input_total: 10000, cache_read: 0, output: 1000 }, model: sonnet, runsPerDay: 0 }, { code: "a04_generador_tareas", profile: { input_total: 10000, cache_read: 0, output: 1000 }, model: sonnet, runsPerDay: 2 }];
  const pending = closedAgentsCost(rows, null);
  assert.equal(pending.complete, false);
  assert.equal(pending.agents[0]?.monthly, null);
  assert.equal(Number(pending.partial.toFixed(4)), 1.8);
  const complete = closedAgentsCost(rows, 10);
  assert.equal(complete.complete, true);
  assert.equal(Number(complete.partial.toFixed(4)), 2.1);
});

test("Sol usa caché al 5%, tarifa larga solo sobre 272K y la referencia de 60 minutos", () => {
  const sol: SimModel = {
    id: "gpt-6.1-sol",
    label: "Sol",
    input: 2,
    output: 10,
    cache_read: 0.1,
    long_context_threshold: 272000,
    long_input_multiplier: 2,
    long_output_multiplier: 1.5,
  };
  assert.equal(
    costPerRun({ input_total: 39533, cache_read: 0, output: 2496 }, sol),
    0.104026,
  );
  assert.equal(
    costPerRun({ input_total: 272000, cache_read: 72000, output: 1000 }, sol),
    0.4172,
  );
  assert.equal(
    costPerRun({ input_total: 300000, cache_read: 100000, output: 1000 }, sol),
    0.835,
  );
});

test("la cache leida se cobra a su precio y no como entrada nueva", () => {
  // 1M de entrada total, 800k de ellos de cache; 100k de salida.
  const cost = costPerRun(
    { input_total: 1_000_000, cache_read: 800_000, output: 100_000 },
    sonnet,
  );
  assert.equal(
    Number(cost.toFixed(4)),
    Number((0.2 * 2 + 0.8 * 0.2 + 0.1 * 10).toFixed(4)),
  );
});

test("totales por dia y por mes", () => {
  const profile = { input_total: 10_000, cache_read: 0, output: 1_000 };
  const t = totals([{ code: "a", profile, model: sonnet, runsPerDay: 2 }]);
  assert.equal(Number(t.perDay.toFixed(6)), 0.06);
  assert.equal(Number(t.perMonth.toFixed(4)), 1.8);
  assert.equal(t.inputPerMonth, 600_000);
});
