import assert from "node:assert/strict";
import test from "node:test";
import { f8ClosureHandoffAssessmentsFromRows } from "./ai-playbook-insights-api.js";

test("F8.16 feed publica cierres que requieren lectura consultiva", () => {
  const result = f8ClosureHandoffAssessmentsFromRows([{ closure_state: "COMPLETED", closure_gate: false, operational_outcome: "INCONCLUSIVE", blockers: ["active_actions"] }, { closure_state: "CLOSED", closure_gate: true, operational_outcome: "SUCCESS", handoff_status: "NOT_REQUIRED" }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F8_16_CLOSURE_HANDOFF");
  assert.equal(result[0]?.reason_codes?.[0], "active_actions");
});
