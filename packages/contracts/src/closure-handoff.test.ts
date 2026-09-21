import assert from "node:assert/strict";
import test from "node:test";
import { evaluateClosureHandoff, type ClosureHandoffInput } from "./closure-handoff.js";

const base = (overrides: Partial<ClosureHandoffInput> = {}): ClosureHandoffInput => ({ organization_id: "org-1", intervention_id: "int-1", recommendation_id: "rec-1", output_id: "out-1", expected_state: "Tarea aplicada", actual_state: "Tarea aplicada y verificada", active_actions: 0, critical_unknown: false, verification_status: "VERIFIED", open_critical_incident: false, recovery_active: false, cleanup_complete: true, residual_risk_known: true, residual_risk_accepted: true, residual_risk_owner: null, handoff_required: false, handoff_status: "NOT_REQUIRED", task_summary: { total: 1, completed: 1, active: 0, blocked: 0 }, source_refs: ["agent_outputs"], known_unknowns: [], close_requested: true, ...overrides });

test("F8.16 cierra solo con gate completo y conserva el resultado observado", () => {
  const result = evaluateClosureHandoff(base());
  assert.equal(result.closure_state, "CLOSED");
  assert.equal(result.closure_gate, true);
  assert.equal(result.operational_outcome, "SUCCESS");
  assert.equal(result.final_state_snapshot.actual, "Tarea aplicada y verificada");
});

test("F8.16 no cierra con acciones activas ni ownership pendiente", () => {
  const result = evaluateClosureHandoff(base({ active_actions: 1, task_summary: { total: 1, completed: 0, active: 1, blocked: 0 }, handoff_required: true, handoff_status: "REQUESTED" }));
  assert.equal(result.closure_state, "COMPLETED");
  assert.equal(result.closure_gate, false);
  assert.deepEqual(result.blockers.sort(), ["active_actions", "handoff_not_accepted"]);
});

test("F8.16 distingue ejecución parcial de éxito completo", () => {
  const result = evaluateClosureHandoff(base({ verification_status: "PARTIALLY_VERIFIED", task_summary: { total: 2, completed: 1, active: 0, blocked: 1 } }));
  assert.equal(result.operational_outcome, "PARTIAL_SUCCESS");
  assert.equal(result.closure_state, "CLOSED");
});
