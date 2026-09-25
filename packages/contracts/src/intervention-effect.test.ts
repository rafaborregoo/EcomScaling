import { test } from "node:test";
import assert from "node:assert/strict";
import { measureInterventionEffect } from "./intervention-effect.js";

/** Serie diaria desde `from`, con valor `value(i)` en el dia i. */
function serie(from: string, days: number, value: (i: number) => number) {
  const start = Date.parse(from);
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    value: value(i),
  }));
}

test("una subida clara con ventana completa es material, madura y va hacia arriba", () => {
  // 28 dias a ~100 y 28 dias a ~130, con algo de ruido.
  const s = serie("2026-06-01", 56, (i) => (i < 28 ? 100 : 130) + (i % 3) - 1);
  const m = measureInterventionEffect(s, "2026-06-29", "2026-08-15");
  assert.equal(m.pre_days, 28);
  assert.equal(m.post_days, 28);
  assert.equal(m.maturity, "MATURE");
  assert.equal(m.observed_direction, "up");
  assert.ok(Math.abs(m.change_relative! - 0.3) < 0.01);
  assert.equal(m.material, true);
});

test("un cambio que el ruido explica no es material aunque tenga direccion", () => {
  const s = serie("2026-06-01", 56, (i) => (i % 2 === 0 ? 60 : 150) + (i >= 28 ? 8 : 0));
  const m = measureInterventionEffect(s, "2026-06-29", "2026-08-15");
  assert.equal(m.observed_direction, "up");
  assert.equal(m.material, false);
});

test("a los 10 dias es EARLY, con muestra insuficiente y sin materialidad", () => {
  const s = serie("2026-06-01", 38, (i) => (i < 28 ? 100 : 200));
  const m = measureInterventionEffect(s, "2026-06-29", "2026-07-08");
  assert.equal(m.maturity, "EARLY");
  assert.equal(m.post_days, 10);
  assert.equal(m.sample_sufficient, false);
  assert.equal(m.material, false);
});

test("sin dato despues del arranque no hay direccion, no un cero", () => {
  const s = serie("2026-06-01", 28, () => 100);
  const m = measureInterventionEffect(s, "2026-06-29", "2026-07-30");
  assert.equal(m.observed_value, null);
  assert.equal(m.observed_direction, null);
});
