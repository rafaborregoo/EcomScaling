import { test } from "node:test";
import assert from "node:assert/strict";
import { executionSupervisionInputFromSources } from "./execution-supervision-engine.js";
test("construye una evaluación por etapa con trazabilidad y tenant", () => { const input = executionSupervisionInputFromSources("org-1", "SAFE_EXECUTION", { id: "plan-1", context_id: "ctx", result: { ordered_action_ids: ["a1"] } }, { readiness_decision: "READY", result: {} }, { envelope_zone: "INSIDE", result: {} }); assert.equal(input.business_id, "org-1"); assert.equal(input.stage, "SAFE_EXECUTION"); assert.ok(input.checks.some((check) => check.id === "read_before_write")); });
