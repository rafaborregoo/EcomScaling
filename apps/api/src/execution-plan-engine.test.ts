import { test } from "node:test";
import assert from "node:assert/strict";
import { executionPlanInputFromSources } from "./execution-plan-engine.js";

test("F8.03 convierte la comunicación, outcome y HITL en plan sin herramienta ni ejecución", () => {
  const input = executionPlanInputFromSources("org-1", {
    id: "communication-1", context_id: "ctx-1", decision_cycle_id: "cycle-1", primary_recommendation: "Validar checkout", source_refs: ["communication"],
    result: { recommendation: "Validar checkout", reason: "Hay fricción", expected_outcome: "Baseline verificable", sequence: ["medir", "preparar piloto"], dependencies: ["medir antes de pilotar"], constraints: ["sin publicación automática"], success_signal: "checkout medido", unresolved_unknowns: [] },
  }, { id: "outcome-1", result: { current_baseline: "unknown", primary_success_criterion: "checkout estable", causal_thesis: "La fricción reduce conversión", source_refs: ["outcome"] } }, { id: "hitl-1", disposition: "APPROVAL_REQUIRED", approval_gate: true, approval_state: "PENDING", source_refs: ["hitl"] });
  assert.equal(input.actions.length, 2);
  assert.equal(input.actions[0]?.id, "action-1");
  assert.equal(input.dependencies[0]?.from_action_id, "action-1");
  assert.equal(input.approval.required, true);
  assert.equal(input.environment, "UNKNOWN");
});
