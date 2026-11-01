import assert from "node:assert/strict";
import test from "node:test";
import { captureCaminoChange, currentReviewOutput } from "./camino-structured-change.js";
test("no ejecuta texto libre, elementos ajenos o cambios no soportados", () => {
  const plan = { goal: { target: 10 }, strategic_plan_phases: [{ strategic_plan_milestones: [{ id: "m", name: "Antes", status: "pending" }] }] };
  const p = { change: "edit", target_type: "milestone", target_id: "m", structured_change: { field: "name", value: "Después" } };
  assert.deepEqual(captureCaminoChange(p, plan).structured_change, { field: "name", value: "Después", before: "Antes" });
  assert.equal(captureCaminoChange({ ...p, target_id: "other" }, plan).structured_change, null);
  assert.equal(captureCaminoChange({ description: "Borra el plan" }, plan).structured_change, null);
  assert.equal(captureCaminoChange({ ...p, structured_change: { field: "status", value: "completed" } }, plan).structured_change, null);
});
test("una revisión de otra meta no se presenta como una lectura vigente", () => {
  const output = { goal_progress: { status: "achieved", observed_value: 10 } };
  assert.equal((currentReviewOutput(output, { target: 10 }, { target: 20 }) as typeof output).goal_progress.observed_value, null);
  assert.equal(currentReviewOutput(output, { target: 10 }, { target: 10 }), output);
});
