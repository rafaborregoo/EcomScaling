import assert from "node:assert/strict";
import test from "node:test";
import {
  describeLifecycleState,
  evaluateLifecycleCommand,
  NO_WRITE_STATES,
  type LifecycleContext,
  type LifecycleState,
} from "./execution-lifecycle.js";

function context(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    organization_id: "org-1",
    intervention_id: "int-1",
    current_state: "RUNNING",
    actor_id: "rafa",
    actor_authorized: true,
    approval_valid: true,
    readiness_revalidated: true,
    authority_valid: true,
    state_known: true,
    blocking_reason_resolved: true,
    plan_version: 3,
    command_plan_version: 3,
    event_at: "2026-09-22T10:00:00.000Z",
    last_event_at: "2026-09-22T09:00:00.000Z",
    required_children_terminal: true,
    critical_children_unresolved: false,
    active_actions: 0,
    unknown_critical_actions: 0,
    unresolved_recovery: false,
    handoff_complete: true,
    retry_eligible: true,
    duplicate_execution_detected: false,
    guardrails_clear: true,
    execution_actually_stopped: true,
    ...overrides,
  };
}

test("un estado terminal no acepta comandos ni eventos posteriores", () => {
  for (const current_state of ["CLOSED", "ABORTED"] as const) {
    const result = evaluateLifecycleCommand(context({ current_state }), "EXECUTE_STEP");
    assert.equal(result.decision, "STALE");
    assert.equal(result.to, current_state);
    assert.equal(result.material_write_allowed, false);
  }
});

test("un evento fuera de orden no se aplica", () => {
  const result = evaluateLifecycleCommand(
    context({ event_at: "2026-09-22T08:00:00.000Z", last_event_at: "2026-09-22T09:00:00.000Z" }),
    "PAUSE",
  );
  assert.equal(result.decision, "STALE");
});

test("un comando contra una version de plan vieja es rancio", () => {
  const result = evaluateLifecycleCommand(context({ plan_version: 4, command_plan_version: 3 }), "PAUSE");
  assert.equal(result.decision, "STALE");
});

test("un actor sin autoridad no transiciona nada", () => {
  const result = evaluateLifecycleCommand(context({ actor_authorized: false }), "ABORT");
  assert.equal(result.decision, "REJECTED");
  assert.match(result.blocking_condition ?? "", /autoridad/);
});

test("WAITING_APPROVAL solo pasa a READY con aprobacion valida", () => {
  const base = { current_state: "WAITING_APPROVAL" as const };
  assert.equal(
    evaluateLifecycleCommand(context({ ...base, approval_valid: false }), "APPROVE").decision,
    "REJECTED",
  );
  const ok = evaluateLifecycleCommand(context(base), "APPROVE");
  assert.equal(ok.decision, "ACCEPTED");
  assert.equal(ok.to, "READY");
});

test("arrancar exige aprobacion, readiness, autoridad y estado conocido", () => {
  const base = { current_state: "READY" as const };
  for (const broken of [
    { approval_valid: false },
    { readiness_revalidated: false },
    { authority_valid: false },
    { state_known: false },
  ]) {
    const result = evaluateLifecycleCommand(context({ ...base, ...broken }), "START");
    assert.equal(result.decision, "REJECTED", JSON.stringify(broken));
  }
  assert.equal(evaluateLifecycleCommand(context(base), "START").to, "RUNNING");
});

test("PAUSE no marca PAUSED: pasa por PAUSING hasta confirmar la parada", () => {
  const pausing = evaluateLifecycleCommand(context(), "PAUSE");
  assert.equal(pausing.to, "PAUSING");

  const notStopped = evaluateLifecycleCommand(
    context({ current_state: "PAUSING", execution_actually_stopped: false }),
    "CONFIRM_STOPPED",
  );
  assert.equal(notStopped.decision, "REJECTED");

  const stopped = evaluateLifecycleCommand(context({ current_state: "PAUSING" }), "CONFIRM_STOPPED");
  assert.equal(stopped.to, "PAUSED");
});

test("reanudar exige motivo resuelto, readiness, autoridad y estado conocido", () => {
  const base = { current_state: "PAUSED" as const };
  for (const broken of [
    { blocking_reason_resolved: false },
    { readiness_revalidated: false },
    { authority_valid: false },
    { state_known: false },
  ]) {
    assert.equal(
      evaluateLifecycleCommand(context({ ...base, ...broken }), "RESUME").decision,
      "REJECTED",
      JSON.stringify(broken),
    );
  }
  assert.equal(evaluateLifecycleCommand(context(base), "RESUME").to, "RUNNING");
});

test("desbloquear pasa por revalidacion, no directo a RUNNING", () => {
  const result = evaluateLifecycleCommand(context({ current_state: "BLOCKED" }), "UNBLOCK");
  assert.equal(result.to, "REVALIDATION_REQUIRED");
});

test("reintentar exige elegibilidad, ausencia de duplicado y guardrails limpios", () => {
  const base = { current_state: "FAILED" as const };
  for (const broken of [
    { retry_eligible: false },
    { duplicate_execution_detected: true },
    { guardrails_clear: false },
  ]) {
    assert.equal(
      evaluateLifecycleCommand(context({ ...base, ...broken }), "RETRY").decision,
      "REJECTED",
      JSON.stringify(broken),
    );
  }
  assert.equal(evaluateLifecycleCommand(context(base), "RETRY").to, "RETRYING");
});

test("no se completa con pasos requeridos vivos ni trabajo critico pendiente", () => {
  assert.equal(
    evaluateLifecycleCommand(context({ required_children_terminal: false }), "COMPLETE").decision,
    "REJECTED",
  );
  assert.equal(
    evaluateLifecycleCommand(context({ critical_children_unresolved: true }), "COMPLETE").decision,
    "REJECTED",
  );
  assert.equal(evaluateLifecycleCommand(context(), "COMPLETE").to, "COMPLETED");
});

test("la puerta de cierre exige las cinco condiciones", () => {
  const base = { current_state: "CLOSING" as const };
  for (const broken of [
    { active_actions: 1 },
    { unknown_critical_actions: 1 },
    { unresolved_recovery: true },
    { state_known: false },
    { handoff_complete: false },
  ]) {
    assert.equal(
      evaluateLifecycleCommand(context({ ...base, ...broken }), "CONFIRM_CLOSED").decision,
      "REJECTED",
      JSON.stringify(broken),
    );
  }
  assert.equal(evaluateLifecycleCommand(context(base), "CONFIRM_CLOSED").to, "CLOSED");
});

test("ningun estado sin escritura autoriza una escritura material", () => {
  for (const current_state of NO_WRITE_STATES) {
    const result = evaluateLifecycleCommand(context({ current_state }), "EXECUTE_STEP");
    assert.equal(result.material_write_allowed, false, current_state);
  }
});

test("ejecutar un paso en RUNNING si autoriza escritura y no sale del estado", () => {
  const result = evaluateLifecycleCommand(context(), "EXECUTE_STEP");
  assert.equal(result.decision, "ACCEPTED");
  assert.equal(result.to, "RUNNING");
  assert.equal(result.material_write_allowed, true);
});

test("ejecutar un paso exige estado conocido, guardrails y autoridad", () => {
  for (const broken of [{ state_known: false }, { guardrails_clear: false }, { authority_valid: false }]) {
    const result = evaluateLifecycleCommand(context(broken), "EXECUTE_STEP");
    assert.equal(result.decision, "REJECTED", JSON.stringify(broken));
    assert.equal(result.material_write_allowed, false);
  }
});

test("un comando repetido es idempotente", () => {
  const result = evaluateLifecycleCommand(context({ current_state: "PAUSED" }), "CONFIRM_STOPPED");
  assert.equal(result.decision, "NO_OP");
  assert.equal(result.to, "PAUSED");
});

test("un comando que el estado no admite se rechaza", () => {
  const result = evaluateLifecycleCommand(context({ current_state: "PROPOSED" }), "EXECUTE_STEP");
  assert.equal(result.decision, "REJECTED");
  assert.match(result.blocking_condition ?? "", /PROPOSED no admite/);
});

test("aceptar un handoff no reanuda el trabajo: revalida primero", () => {
  const result = evaluateLifecycleCommand(context({ current_state: "HANDOFF_PENDING" }), "ACCEPT_HANDOFF");
  assert.equal(result.to, "REVALIDATION_REQUIRED");
});

test("revocar la aprobacion durante RUNNING para la ejecucion", () => {
  const result = evaluateLifecycleCommand(context(), "REVOKE_APPROVAL");
  assert.equal(result.to, "PAUSING");
});

test("la vista responde las seis preguntas de la seccion 50", () => {
  const view = describeLifecycleState(context({ current_state: "PAUSED", blocking_reason_resolved: false }));
  assert.equal(view.state, "PAUSED");
  assert.ok(view.why.length > 0);
  assert.ok(!view.allowed_commands.includes("RESUME"));
  assert.ok(view.prohibited_commands.includes("RESUME"));
  assert.ok(view.blocking_conditions.some((reason) => reason.startsWith("RESUME:")));
  assert.ok(view.next_states.includes("ABORTING"));
  assert.equal(view.material_write_allowed, false);
});

test("un estado terminal con acciones activas se marca como inconsistente", () => {
  const view = describeLifecycleState(context({ current_state: "CLOSED", active_actions: 2 }));
  assert.ok(view.inconsistencies.some((item) => item.includes("CLOSED")));
  assert.deepEqual(view.allowed_commands, []);
});

test("un contexto invalido no autoriza nada", () => {
  const result = evaluateLifecycleCommand({ ...context(), organization_id: "" }, "EXECUTE_STEP");
  assert.equal(result.decision, "REJECTED");
  assert.equal(result.material_write_allowed, false);

  const view = describeLifecycleState({ ...context(), intervention_id: "" });
  assert.equal(view.state, "UNKNOWN");
  assert.equal(view.material_write_allowed, false);
});

test("todo estado no terminal declara al menos una salida o una condicion bloqueante", () => {
  const states = NO_WRITE_STATES.filter((state) => state !== "CLOSED" && state !== "ABORTED");
  for (const current_state of states as LifecycleState[]) {
    const view = describeLifecycleState(context({ current_state }));
    assert.ok(
      view.next_states.length > 0 || view.blocking_conditions.length > 0,
      `${current_state} no ofrece salida ni explica por que`,
    );
  }
});
