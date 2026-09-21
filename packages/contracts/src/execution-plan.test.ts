import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateExecutionPlan, type ExecutionPlanInput } from "./execution-plan.js";

const base: ExecutionPlanInput = {
  context_id: "ctx-1", business_id: "org-1", decision_cycle_id: "cycle-1", recommendation_id: "rec-1",
  execution_intent: "Validar la mejora de conversión con cambios reversibles.", objective: "Mejorar conversión sin ampliar exposición.",
  scope: { in_scope: ["checkout"], out_of_scope: ["paid media"], constraints: ["sin cambios irreversibles"] },
  actions: [
    { id: "inspect", title: "Inspeccionar checkout", target: "checkout", change: "medir fricción", expected_result: "baseline disponible", rationale: "necesario antes de escribir", owner: "consultant", current_state: "unknown", desired_state: "baseline conocido", status: "PLANNED", reversible: true, requires_approval: false },
    { id: "pilot", title: "Preparar piloto", target: "checkout", change: "proponer copy alternativo", expected_result: "piloto listo", rationale: "validar mecanismo", owner: "consultant", current_state: "baseline conocido", desired_state: "piloto revisable", status: "PLANNED", reversible: true, requires_approval: true },
  ],
  dependencies: [{ from_action_id: "inspect", to_action_id: "pilot", type: "HARD", reason: "el piloto necesita baseline" }],
  preconditions: ["baseline disponible"], postconditions: ["piloto verificable"], invariants: ["no publicar automáticamente"],
  checkpoints: [{ id: "cp-1", kind: "TECHNICAL", description: "validar baseline", required: true }], milestones: [{ id: "m-1", action_ids: ["inspect"], description: "baseline" }],
  rollout: { mode: "HYBRID", phases: ["shadow", "pilot"], shadow: true, canary: true },
  temporal_controls: { observation_window: "7d", cooldown: "24h", cadence: "daily", execution_window: "business-hours", maintenance_window: "none" },
  budgets: { max_actions: 5, max_changes: 2, max_retries: 1, max_loss: "bounded" },
  success_criteria: ["baseline y piloto verificables"], failure_criteria: ["daño material"], stop_criteria: ["guardrail incumplido"], hold_criteria: ["evidencia insuficiente"], continue_criteria: ["criterio primario estable"], scale_criteria: ["repeatability demonstrated"], rollback_criteria: ["previous state better"],
  mode: "HYBRID", environment: "TEST", approval: { required: true, status: "PENDING", approved_scope: null },
  source_refs: ["recommendation_communication_runs"], unresolved_unknowns: [],
};

test("construye una secuencia segura y marca aprobación sin autorizar ejecución", () => {
  const result = evaluateExecutionPlan(base, "2026-09-20T12:00:00.000Z");
  assert.equal(result.plan_status, "READY_WITH_APPROVAL");
  assert.deepEqual(result.ordered_action_ids, ["inspect", "pilot"]);
  assert.deepEqual(result.critical_path, ["inspect", "pilot"]);
  assert.equal(result.execution_authorized, false);
  assert.equal(result.validation.approval, "REQUIRED");
});

test("bloquea ciclos, referencias huérfanas y acciones duplicadas", () => {
  const invalid = { ...base, actions: [base.actions[0]!, { ...base.actions[0]! }], dependencies: [{ from_action_id: "inspect", to_action_id: "missing", type: "HARD" as const, reason: "x" }] };
  const result = evaluateExecutionPlan(invalid);
  assert.equal(result.plan_status, "INVALID");
  assert.ok(result.blockers.includes("duplicate_action_id"));
  assert.ok(result.blockers.includes("orphan_dependency"));
});

test("pasa a bloqueado si hay unknowns o el presupuesto es insuficiente", () => {
  const result = evaluateExecutionPlan({ ...base, unresolved_unknowns: ["baseline"], budgets: { ...base.budgets, max_actions: 1 } });
  assert.equal(result.plan_status, "BLOCKED");
  assert.ok(result.blockers.includes("unresolved_unknowns"));
  assert.ok(result.blockers.includes("action_budget_exceeded"));
});
