import assert from "node:assert/strict";
import { test } from "node:test";
import { costPerRun, totals, type SimModel } from "./cost-sim";

const sonnet: SimModel = { id: "s", label: "S", input: 2, output: 10, cache_read: 0.2 };

test("la cache leida se cobra a su precio y no como entrada nueva", () => {
  // 1M de entrada total, 800k de ellos de cache; 100k de salida.
  const cost = costPerRun({ input_total: 1_000_000, cache_read: 800_000, output: 100_000 }, sonnet);
  assert.equal(Number(cost.toFixed(4)), Number((0.2 * 2 + 0.8 * 0.2 + 0.1 * 10).toFixed(4)));
});

test("totales por dia y por mes", () => {
  const profile = { input_total: 10_000, cache_read: 0, output: 1_000 };
  const t = totals([{ code: "a", profile, model: sonnet, runsPerDay: 2 }]);
  assert.equal(Number(t.perDay.toFixed(6)), 0.06);
  assert.equal(Number(t.perMonth.toFixed(4)), 1.8);
  assert.equal(t.inputPerMonth, 600_000);
});
