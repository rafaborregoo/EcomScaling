import test from "node:test";
import assert from "node:assert/strict";
import { continuousLearningViewModel } from "./continuous-learning-view-model";
test("learning view model keeps the latest assessment per block", () => {
  const model = continuousLearningViewModel([{ block_code: "9.12", status: "WAITING_FOR_EVIDENCE", gate: false }, { block_code: "9.12", status: "READY", gate: true }, { block_code: "9.01", status: "BLOCKED", gate: false }]);
  assert.equal(model.items.length, 2); assert.equal(model.ready, 0); assert.equal(model.blocked, 1);
});
