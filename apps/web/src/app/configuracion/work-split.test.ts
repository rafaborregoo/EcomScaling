import assert from "node:assert/strict";
import test from "node:test";
import { toPercentages } from "./work-split";

test("dos socios al mismo peso son mitad y mitad", () => {
  // El caso del emparejamiento recien hecho: los dos caen en el default 100.
  assert.deepEqual(toPercentages([100, 100]), [50, 50]);
});

test("peso 0 no recibe nada", () => {
  assert.deepEqual(toPercentages([100, 0]), [100, 0]);
});

test("los pesos que ya suman 100 se leen tal cual", () => {
  assert.deepEqual(toPercentages([70, 30]), [70, 30]);
});

test("el redondeo cuadra a 100 aunque no salga exacto", () => {
  // Tres al 33 suman 99: sin ajuste la pantalla diria que sobra un 1% sin dueño.
  const percentages = toPercentages([100, 100, 100]);
  assert.equal(
    percentages.reduce((sum, value) => sum + value, 0),
    100,
  );
  assert.deepEqual(percentages, [34, 33, 33]);
});

test("nadie con peso: nadie recibe, sin dividir por cero", () => {
  assert.deepEqual(toPercentages([0, 0]), [0, 0]);
  assert.deepEqual(toPercentages([]), []);
});
