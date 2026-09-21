import assert from "node:assert/strict";
import test from "node:test";
import { closureInputFromSources } from "./closure-handoff-engine.js";

test("F8.16 runtime enlaza tareas materializadas con la salida aprobada", () => {
  const input = closureInputFromSources("org-1", { id: "out-1", run_id: "run-1", output: { expected_state: "Aplicada", verification_status: "VERIFIED" } }, [
    { id: "task-1", status: "completed", metadata: { agent_output_id: "out-1" } },
    { id: "task-2", status: "pending", metadata: { agent_output_id: "other" } },
  ]);
  assert.equal(input.task_summary.total, 1);
  assert.equal(input.task_summary.completed, 1);
  assert.equal(input.active_actions, 0);
  assert.equal(input.intervention_id, "run-1");
});
