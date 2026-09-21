import assert from "node:assert/strict";
import test from "node:test";
import { closureHandoffTone, closureHandoffViewModel } from "./closure-handoff-view-model.js";

test("F8.16 muestra estado real, gate y diferencia esperado/actual", () => {
  const model = closureHandoffViewModel({ closure_state: "CLOSED", closure_gate: true, operational_outcome: "SUCCESS", verification_status: "VERIFIED", final_state_snapshot: { expected: "A", actual: "B" } });
  assert.equal(model.closureGate, true); assert.equal(model.expected, "A"); assert.equal(model.actual, "B"); assert.equal(closureHandoffTone(model.outcome), "success");
});
