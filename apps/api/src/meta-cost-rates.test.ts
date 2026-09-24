import assert from "node:assert/strict";
import test from "node:test";
import { metaCostRates } from "./meta-insights.js";

test("CPM y CPC salen del gasto, y sin denominador son null, no 0", () => {
  assert.deepEqual(metaCostRates(150, 30000, 600), { cpm: 5, cpc: 0.25 });
  assert.deepEqual(metaCostRates(150, 0, 0), { cpm: null, cpc: null });
});
