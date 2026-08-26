import assert from "node:assert/strict";
import test from "node:test";
import { mapWithConcurrency } from "./meta-sync.js";

test("mapWithConcurrency limita I/O y conserva el orden de entrada", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, item === 1 ? 15 : 2));
    active -= 1;
    return item * 10;
  });

  assert.deepEqual(result, [10, 20, 30, 40, 50]);
  assert.equal(peak, 2);
  assert.equal(active, 0);
});

test("mapWithConcurrency no crea workers para una colección vacía", async () => {
  let called = false;
  const result = await mapWithConcurrency([], 3, async () => {
    called = true;
    return "unexpected";
  });

  assert.deepEqual(result, []);
  assert.equal(called, false);
});
