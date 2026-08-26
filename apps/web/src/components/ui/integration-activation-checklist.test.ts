import assert from "node:assert/strict";
import test from "node:test";
import { getIntegrationActivationGateLabel } from "./integration-activation-state";

test("activation checklist translates known gates and preserves unknown future gates", () => {
  assert.equal(getIntegrationActivationGateLabel("freshnessAvailable"), "Datos actualizados");
  assert.equal(getIntegrationActivationGateLabel("futureGate"), "futureGate");
});
