import assert from "node:assert/strict";
import { test } from "node:test";
import { initialSizes, resizeSizes, toPercent } from "./resizable";

test("tamaños en %, rem y px pasan a % del grupo", () => {
  assert.equal(toPercent("25%", 0), 25);
  assert.equal(toPercent(40, 0), 40);
  assert.equal(toPercent("26rem", 1664), 25);
  assert.equal(toPercent("320px", 1280), 25);
  assert.equal(toPercent("26rem", 0), undefined);
});

test("el reparto inicial suma 100: lo que sobra va a los paneles sin tamaño", () => {
  assert.deepEqual(initialSizes([{}, { defaultSize: "26rem" }], 1664), [75, 25]);
  assert.deepEqual(initialSizes([{ defaultSize: 30 }, { defaultSize: 30 }], 1000), [50, 50]);
});

test("arrastrar respeta el mínimo y el máximo de los dos paneles", () => {
  const limits = [{ min: 0, max: 100 }, { min: 20, max: 50 }];
  assert.deepEqual(resizeSizes([75, 25], 0, -10, limits), [65, 35]);
  assert.deepEqual(resizeSizes([75, 25], 0, -40, limits), [50, 50]);
  assert.deepEqual(resizeSizes([75, 25], 0, 40, limits), [80, 20]);
  assert.deepEqual(resizeSizes([75, 25], 1, 5, limits), [75, 25]);
});
