import test from "node:test";
import assert from "node:assert/strict";
import { F9_BLOCK_CODES } from "@ecomscaling/contracts";
import { F9_RUNTIME_PROFILES, learningInputFromSources } from "./continuous-learning-engine.js";

test("F9 runtime has an explicit profile for every real block", () => {
  assert.equal(Object.keys(F9_RUNTIME_PROFILES).length, F9_BLOCK_CODES.length);
  for (const code of F9_BLOCK_CODES) {
    assert.ok(F9_RUNTIME_PROFILES[code].steps.length >= 8, code);
  }
  assert.equal((F9_RUNTIME_PROFILES as Record<string, unknown>)["9.21"], undefined);
});
test("experience input keeps the real F8 closure and its unknowns", () => {
  const input = learningInputFromSources("9.12", "org-1", {
    id: "closure-1", intervention_id: "int-1", recommendation_id: "rec-1", output_id: "out-1", as_of: "2026-09-21T00:00:00.000Z", evaluated_at: "2026-09-21T01:00:00.000Z",
    closure_state: "COMPLETED", operational_outcome: "INCONCLUSIVE", verification_status: "UNKNOWN", outcome_maturity: "INCOMPLETE", blockers: ["verification_unknown"], unresolved_unknowns: ["verification"], source_refs: ["f8"], input_envelope: {}, result: { final_state_snapshot: { expected: "done", actual: "unknown" } },
  }, { id: "out-1", output: { expected_state: "done" } });
  assert.equal(input.experience_id, "closure-1");
  assert.equal(input.observed_outcome.operational_outcome, "INCONCLUSIVE");
  assert.ok(input.unresolved_unknowns.includes("verification"));
  assert.ok(input.source_refs.includes("execution_closure_runs"));
});
