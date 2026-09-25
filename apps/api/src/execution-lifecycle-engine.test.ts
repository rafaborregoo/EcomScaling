import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLifecycleCommand } from "@e-nora/contracts";
import { lifecycleContextFromSources } from "./execution-lifecycle-engine.js";

const actor = { actorId: "rafa", actorAuthorized: true, planVersion: 0, eventAt: "2026-09-22T10:00:00.000Z" };

test("una intervencion sin fila arranca en PROPOSED con estado conocido", () => {
  const context = lifecycleContextFromSources("org-1", "int-1", null, null, null, null, actor);
  assert.equal(context.current_state, "PROPOSED");
  assert.equal(context.state_known, true);
});

test("lo que no se puede establecer se reporta como no establecido, nunca como correcto", () => {
  const context = lifecycleContextFromSources("org-1", "int-1", null, null, null, null, actor);
  assert.equal(context.approval_valid, false);
  assert.equal(context.readiness_revalidated, false);
  assert.equal(context.authority_valid, false);
  assert.equal(context.guardrails_clear, false);
  assert.equal(context.handoff_complete, false);
  // Los negativos peligrosos van al reves: sin dato, se asume lo inseguro.
  assert.equal(context.critical_children_unresolved, true);
  assert.equal(context.unresolved_recovery, true);
  assert.equal(context.duplicate_execution_detected, true);
});

test("sin fuentes, una intervencion no puede arrancar", () => {
  const context = lifecycleContextFromSources(
    "org-1",
    "int-1",
    { state: "READY", plan_version: 0, input_envelope: {} },
    null,
    null,
    null,
    actor,
  );
  assert.equal(evaluateLifecycleCommand(context, "START").decision, "REJECTED");
});

test("con readiness, aprobacion y envelope validos la intervencion arranca", () => {
  const context = lifecycleContextFromSources(
    "org-1",
    "int-1",
    { state: "READY", plan_version: 0, input_envelope: {} },
    { readiness_decision: "READY" },
    { decision: "APPROVED" },
    { envelope_zone: "INSIDE" },
    actor,
  );
  const result = evaluateLifecycleCommand(context, "START");
  assert.equal(result.decision, "ACCEPTED");
  assert.equal(result.to, "RUNNING");
});

test("un envelope fuera de zona invalida la autoridad", () => {
  const context = lifecycleContextFromSources(
    "org-1",
    "int-1",
    { state: "READY", plan_version: 0, input_envelope: {} },
    { readiness_decision: "READY" },
    { decision: "APPROVED" },
    { envelope_zone: "OUTSIDE" },
    actor,
  );
  assert.equal(context.authority_valid, false);
  assert.equal(evaluateLifecycleCommand(context, "START").decision, "REJECTED");
});

test("el ultimo evento aplicado viaja al contexto para descartar los rancios", () => {
  const context = lifecycleContextFromSources(
    "org-1",
    "int-1",
    { state: "RUNNING", plan_version: 0, last_event_at: "2026-09-22T11:00:00.000Z", input_envelope: {} },
    { readiness_decision: "READY" },
    { decision: "APPROVED" },
    { envelope_zone: "INSIDE" },
    actor,
  );
  assert.equal(context.last_event_at, "2026-09-22T11:00:00.000Z");
  assert.equal(evaluateLifecycleCommand(context, "PAUSE").decision, "STALE");
});
