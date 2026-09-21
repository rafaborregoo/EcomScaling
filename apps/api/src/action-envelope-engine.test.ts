import { test } from "node:test";
import assert from "node:assert/strict";
import { actionEnvelopeInputFromSources } from "./action-envelope-engine.js";

test("action envelope se deriva con límites conservadores del plan", () => {
  const input = actionEnvelopeInputFromSources("org-1", { context_id: "ctx", input_envelope: { scope: { in_scope: ["checkout"], out_of_scope: ["paid-media"] }, actions: [{ id: "a1", target: "checkout", change: "read_before_write" }], budgets: { max_actions: 1 } }, result: { source_refs: ["plan-ref"] } }, { result: { source_refs: ["readiness-ref"] } });
  assert.deepEqual(input.in_scope, ["checkout"]); assert.deepEqual(input.allowed_action_types, ["READ", "PREPARE"]); assert.ok(input.forbidden_action_types.includes("DELETE")); assert.equal(input.plan[0]?.tenant_id, "org-1"); assert.equal(input.plan[0]?.action_type, "READ");
});
