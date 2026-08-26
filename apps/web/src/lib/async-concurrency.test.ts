import assert from "node:assert/strict";
import test from "node:test";
import { mapWithConcurrency } from "./async-concurrency.js";

test("limita concurrencia y conserva el orden", async () => {
  let active = 0;
  let peak = 0;
  const values = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return item * 2;
  });

  assert.deepEqual(values, [2, 4, 6, 8, 10]);
  assert.equal(peak, 2);
});

test("rechaza límites inválidos", async () => {
  await assert.rejects(mapWithConcurrency([], 0, async () => 1), /invalid/);
});
