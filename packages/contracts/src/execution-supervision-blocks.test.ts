/**
 * F8: un test por regla central de cada bloque. Cada bloque tiene los suyos:
 * la correccion del 2026-09-22 senalo que el esqueleto compartido tenia un test
 * para doce bloques.
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionSnapshot, SnapshotCapability } from "./execution-snapshot.js";
import { evaluateExecutionFramework } from "./execution-framework.js";
import { evaluateExecutabilityAuthorization } from "./executability-authorization.js";
import { evaluateExecutionCapabilities } from "./execution-capabilities.js";
import { evaluateSafeExecution } from "./safe-execution.js";
import { evaluateExecutionMonitoring } from "./execution-monitoring.js";
import { evaluateExecutionGuardrails, mostProtective } from "./execution-guardrails.js";
import { evaluateExecutionIncidents } from "./execution-incidents.js";
import { evaluateRollbackRecovery } from "./rollback-recovery.js";
import { evaluateOverrideEscalation } from "./override-escalation.js";
import { evaluateExecutionConcurrency } from "./execution-concurrency.js";
import { evaluateExecutionVerification } from "./execution-verification.js";
import { evaluateExecutionReporting } from "./execution-reporting.js";
import { evaluateSupervisionBlocks } from "./execution-supervision.js";

const AS_OF = "2026-09-24T10:00:00.000Z";

const read: SnapshotCapability = { name: "sql_query", permission: "read", status: "implemented_partial", connector: "core", connector_connected: true, requires_idempotency_key: false };
const dryRun: SnapshotCapability = { name: "dry_run_write", permission: "propose", status: "implemented_partial", connector: "core", connector_connected: true, requires_idempotency_key: false };
const plannedWrite: SnapshotCapability = { name: "shopify_update_product", permission: "write", status: "planned", connector: "shopify", connector_connected: true, requires_idempotency_key: true };
const liveWrite: SnapshotCapability = { ...plannedWrite, status: "implemented_partial" };

function snap(over: Partial<ExecutionSnapshot> = {}): ExecutionSnapshot {
  return {
    organization_id: "org-1",
    as_of: AS_OF,
    plan: {
      id: "plan-1",
      status: "READY_WITH_APPROVAL",
      version: 1,
      environment: "PRODUCTION",
      actions: [
        { id: "action-1", title: "Leer precio actual", target: "product-9", change: "read_before_write", current_state: "29 EUR", desired_state: "29 EUR", reversible: true, requires_approval: false },
        { id: "action-2", title: "Preparar cambio de titulo", target: "product-9", change: "prepare_reversible_change", current_state: "Titulo A", desired_state: "Titulo B", reversible: true, requires_approval: true },
      ],
      success_criteria: ["CTR del producto sube"],
      stop_criteria: ["guardrail violated"],
      hold_criteria: ["evidence insufficient"],
      rollback_criteria: ["previous state better"],
      postconditions: ["el titulo es Titulo B"],
      invariants: ["no tenant crossing"],
      observation_window: "14 dias",
      max_actions: 2,
      max_retries: 1,
      evaluated_at: AS_OF,
    },
    readiness: { decision: "READY", blocking_reasons: [], stale: false, revalidate_required: false, evaluated_at: AS_OF },
    envelope: { zone: "INSIDE", violations: [], remaining_actions: 2, fresh: true, scope_expansion_required: false },
    approval: {
      disposition: "APPROVAL_REQUIRED", approval_state: "APPROVED", approval_freshness: "CURRENT", revocation_status: "ACTIVE",
      approval_valid_until: null, escalation_required: false, escalation_reasons: [], escalation_target: "consultor",
      autonomy_level: "APPROVAL_GATED", required_approver_type: "consultor",
    },
    lifecycle: null,
    capabilities: [read, dryRun, plannedWrite],
    other_interventions: [],
    closure: null,
    source_refs: ["test"],
    unresolved_unknowns: [],
    ...over,
  };
}

const running = (state = "RUNNING", last = AS_OF) => ({
  intervention_id: "plan-1", state, last_event_at: last, inconsistencies: [], allowed_commands: ["PAUSE", "ABORT", "ESCALATE"],
  transitions: [{ command: "START", decision: "ACCEPTED", from_state: "READY", to_state: "RUNNING", reasons: [], event_at: AS_OF }],
});

// --- invariante comun ---------------------------------------------------------

test("F8: ningun bloque autoriza ejecucion, en ningun escenario", () => {
  for (const s of [snap(), snap({ plan: null }), snap({ lifecycle: running("UNKNOWN") })]) {
    for (const r of evaluateSupervisionBlocks(s)) {
      assert.equal(r.execution_authorized, false, r.block);
      assert.equal(r.deterministic, true);
    }
  }
  assert.equal(evaluateSupervisionBlocks(snap()).length, 12);
});

// --- 8.00 ---------------------------------------------------------------------

test("8.00: sin ejecutar y con todo cubierto, la intervencion esta READY", () => {
  const r = evaluateExecutionFramework(snap());
  assert.equal(r.block_decision, "READY");
  assert.equal(r.payload.missing_step, null);
});

test("8.00: ejecutar sin aprobacion es secuencia rota, no un paso pendiente", () => {
  const r = evaluateExecutionFramework(snap({ approval: { ...snap().approval!, approval_state: "PENDING" }, lifecycle: running() }));
  assert.equal(r.block_decision, "SEQUENCE_BROKEN");
  assert.deepEqual(r.payload.skipped_steps, ["autorizacion"]);
  assert.equal(r.payload.safe_state, "ESCALATE");
});

test("8.00: readiness caducado es context drift y bloquea la siguiente accion", () => {
  const r = evaluateExecutionFramework(snap({ readiness: { ...snap().readiness!, stale: true } }));
  assert.equal(r.block_decision, "BLOCKED");
  assert.equal(r.payload.context_drift, true);
  assert.equal(r.payload.safe_state, "BLOCK_NEXT_ACTION");
});

// --- 8.01 ---------------------------------------------------------------------

test("8.01: sin tool de escritura implementada, se prepara pero no se ejecuta (handoff manual)", () => {
  const r = evaluateExecutabilityAuthorization(snap());
  assert.equal(r.payload.may_prepare, true);
  assert.equal(r.payload.may_execute, false);
  assert.equal(r.payload.execution_mode, "manual");
  assert.equal(r.payload.handoff_required, true);
  assert.ok(r.payload.blocking_reasons.includes("capability_missing"));
  assert.equal(r.payload.candidate_for_execution, false);
});

test("8.01: acceso, permiso y autoridad no se funden: aprobacion caducada no autoriza", () => {
  const r = evaluateExecutabilityAuthorization(snap({ capabilities: [read, liveWrite], approval: { ...snap().approval!, approval_freshness: "UNKNOWN" } }));
  assert.equal(r.payload.authorization, "AUTHORIZATION_UNCERTAIN");
  assert.equal(r.payload.may_execute, false);
});

test("8.01: con capacidad, autoridad vigente, readiness y envelope es candidata", () => {
  const r = evaluateExecutabilityAuthorization(snap({ capabilities: [read, liveWrite] }));
  assert.equal(r.block_decision, "EXECUTABLE");
  assert.equal(r.payload.candidate_for_execution, true);
  assert.equal(r.payload.execution_mode, "assisted");
});

// --- 8.06 ---------------------------------------------------------------------

test("8.06: escrituras solo planeadas -> PREPARE_ONLY, con el hueco nombrado", () => {
  const r = evaluateExecutionCapabilities(snap());
  assert.equal(r.block_decision, "PREPARE_ONLY");
  assert.equal(r.payload.write_tools_implemented, 0);
  assert.match(r.payload.gaps[0]!, /solo planeadas/);
});

test("8.06: una tool implementada con el conector caido no es capacidad disponible", () => {
  const r = evaluateExecutionCapabilities(snap({ capabilities: [read, { ...liveWrite, connector_connected: false }] }));
  assert.equal(r.payload.actions[1]?.availability, "CONNECTOR_DOWN");
  assert.notEqual(r.block_decision, "COVERED");
});

test("8.06: least privilege elige la tool de menor permiso para leer", () => {
  const r = evaluateExecutionCapabilities(snap({ capabilities: [read, liveWrite] }));
  assert.equal(r.payload.actions[0]?.selected_tool, "sql_query");
  assert.equal(r.block_decision, "COVERED");
});

// --- 8.07 ---------------------------------------------------------------------

test("8.07: pre-commit completo sin operacion de proveedor -> PREPARE_ONLY", () => {
  assert.equal(evaluateSafeExecution(snap()).block_decision, "PREPARE_ONLY");
});

test("8.07: sin estado actual no hay diff ni vuelta atras: bloquea antes del commit", () => {
  const base = snap();
  const plan = { ...base.plan!, actions: [base.plan!.actions[0]!, { ...base.plan!.actions[1]!, current_state: "UNKNOWN" }] };
  const r = evaluateSafeExecution(snap({ plan, capabilities: [read, liveWrite] }));
  assert.equal(r.block_decision, "BLOCKED_PRECOMMIT");
  assert.equal(r.payload.changes[0]?.diff_previewable, false);
});

test("8.07: un cambio irreversible sin aprobacion explicita es punto de no retorno bloqueado", () => {
  const base = snap();
  const plan = { ...base.plan!, actions: [{ ...base.plan!.actions[1]!, reversible: false }] };
  const r = evaluateSafeExecution(snap({ plan, approval: { ...base.approval!, approval_state: "NOT_REQUIRED" } }));
  assert.equal(r.block_decision, "BLOCKED_PRECOMMIT");
  assert.ok(r.payload.changes[0]?.missing.some((m) => m.includes("no retorno")));
});

test("8.07: un plan que solo lee no tiene cambio que controlar", () => {
  const base = snap();
  assert.equal(evaluateSafeExecution(snap({ plan: { ...base.plan!, actions: [base.plan!.actions[0]!] } })).block_decision, "NO_CHANGES");
});

// --- 8.08 ---------------------------------------------------------------------

test("8.08: sin ejecucion, exige plan de monitorizacion con ventana concreta", () => {
  const base = snap();
  const r = evaluateExecutionMonitoring(snap({ plan: { ...base.plan!, observation_window: "contextual" } }));
  assert.equal(r.block_decision, "NOT_STARTED");
  assert.equal(r.payload.plan_ready, false);
});

test("8.08: observacion caducada durante la ejecucion es BLIND y pausa", () => {
  const r = evaluateExecutionMonitoring(snap({ lifecycle: running("RUNNING", "2026-09-20T10:00:00.000Z") }));
  assert.equal(r.block_decision, "BLIND");
  assert.equal(r.payload.response, "pause");
});

test("8.08: salir del envelope en marcha se aborta", () => {
  const r = evaluateExecutionMonitoring(snap({ lifecycle: running(), envelope: { ...snap().envelope!, zone: "OUTSIDE" } }));
  assert.equal(r.payload.response, "abort");
});

// --- 8.09 ---------------------------------------------------------------------

test("8.09: gana la respuesta mas protectora", () => {
  assert.equal(mostProtective(["HOLD", "STOP", "ESCALATE"]), "STOP");
  assert.equal(mostProtective([]), "CONTINUE");
});

test("8.09: senal ausente en un guardrail duro no es CLEAR: fail closed", () => {
  const r = evaluateExecutionGuardrails(snap({ readiness: null }));
  assert.equal(r.block_decision, "HOLD");
  assert.ok(r.payload.triggered.includes("readiness_not_blocked"));
});

test("8.09: todo observado y dentro -> CONTINUE", () => {
  assert.equal(evaluateExecutionGuardrails(snap()).block_decision, "CONTINUE");
});

test("8.09: presupuesto de acciones agotado para los cambios pendientes -> STOP", () => {
  const r = evaluateExecutionGuardrails(snap({ envelope: { ...snap().envelope!, remaining_actions: 0 } }));
  assert.equal(r.block_decision, "STOP");
});

// --- 8.11 ---------------------------------------------------------------------

test("8.11: un bloqueo correcto no es incidente", () => {
  const r = evaluateExecutionIncidents(snap({ readiness: { ...snap().readiness!, decision: "BLOCKED" } }));
  assert.equal(r.block_decision, "BLOCKED_NOT_FAILED");
  assert.equal(r.payload.incident_required, false);
});

test("8.11: resultado desconocido con mutacion abre incidente y congela", () => {
  const r = evaluateExecutionIncidents(snap({ lifecycle: running("UNKNOWN") }));
  assert.equal(r.block_decision, "INCIDENT");
  assert.equal(r.payload.containment, "freeze_and_verify_state");
});

test("8.11: fallo sobre un cambio irreversible es incidente critico", () => {
  const base = snap();
  const plan = { ...base.plan!, actions: [{ ...base.plan!.actions[1]!, reversible: false }] };
  const lifecycle = { ...running("FAILED"), transitions: [{ command: "EXECUTE_STEP", decision: "ACCEPTED", from_state: "RUNNING", to_state: "FAILED", reasons: ["timeout"], event_at: AS_OF }] };
  assert.equal(evaluateExecutionIncidents(snap({ plan, lifecycle })).block_decision, "CRITICAL_INCIDENT");
});

// --- 8.12 ---------------------------------------------------------------------

test("8.12: con estado previo y cambios reversibles, recovery preparado", () => {
  assert.equal(evaluateRollbackRecovery(snap()).block_decision, "PREPARED");
});

test("8.12: un cambio de precio es reversible tecnicamente, no de negocio", () => {
  const base = snap();
  const plan = { ...base.plan!, actions: [{ ...base.plan!.actions[1]!, title: "Bajar precio", change: "prepare_price_change" }] };
  assert.equal(evaluateRollbackRecovery(snap({ plan })).payload.actions[0]?.reversibility, "partially_reversible");
});

test("8.12: fallo sin estado previo -> roll forward; resultado desconocido -> contener", () => {
  const base = snap();
  const plan = { ...base.plan!, actions: [{ ...base.plan!.actions[1]!, current_state: null }] };
  assert.equal(evaluateRollbackRecovery(snap({ plan, lifecycle: running("FAILED") })).payload.strategy, "ROLL_FORWARD");
  assert.equal(evaluateRollbackRecovery(snap({ lifecycle: running("UNKNOWN") })).payload.strategy, "CONTAIN");
});

test("8.12: rollback en orden inverso", () => {
  const base = snap();
  const plan = { ...base.plan!, actions: [base.plan!.actions[1]!, { ...base.plan!.actions[1]!, id: "action-3" }] };
  assert.deepEqual(evaluateRollbackRecovery(snap({ plan })).payload.rollback_order, ["action-3", "action-2"]);
});

// --- 8.13 ---------------------------------------------------------------------

test("8.13: escalar sin destino es vacio de control y bloquea", () => {
  const base = snap();
  const r = evaluateOverrideEscalation(snap({ approval: { ...base.approval!, escalation_required: true, escalation_reasons: ["riesgo alto"], escalation_target: null, required_approver_type: null } }));
  assert.equal(r.block_decision, "ESCALATION_REQUIRED");
  assert.equal(r.decision, "BLOCKED");
});

test("8.13: los overrides disponibles salen de la maquina de estados, no se inventan", () => {
  const r = evaluateOverrideEscalation(snap({ lifecycle: running() }));
  assert.deepEqual(r.payload.available_overrides, ["PAUSE", "ABORT"]);
  assert.equal(r.payload.emergency_stop_available, true);
});

test("8.13: autorizacion revocada en marcha pide persona inmediatamente y pausa mientras", () => {
  const base = snap();
  const r = evaluateOverrideEscalation(snap({ lifecycle: running(), approval: { ...base.approval!, revocation_status: "REVOKED" } }));
  assert.equal(r.payload.urgency, "immediate");
  assert.equal(r.payload.safe_state_while_waiting, "pause");
});

// --- 8.14 ---------------------------------------------------------------------

test("8.14: otra intervencion escribiendo el mismo objeto -> QUEUE (single writer)", () => {
  const r = evaluateExecutionConcurrency(snap({ other_interventions: [{ plan_id: "plan-2", targets: ["product-9", "product-3"], state: "RUNNING" }] }));
  assert.equal(r.block_decision, "QUEUE");
  assert.equal(r.payload.single_writer_respected, false);
});

test("8.14: mismos objetos exactos y planeada -> DUPLICATE; cerrada no compite", () => {
  assert.equal(evaluateExecutionConcurrency(snap({ other_interventions: [{ plan_id: "plan-2", targets: ["product-9"], state: "READY" }] })).block_decision, "DUPLICATE");
  assert.equal(evaluateExecutionConcurrency(snap({ other_interventions: [{ plan_id: "plan-2", targets: ["product-9"], state: "CLOSED" }] })).block_decision, "ADMIT");
});

// --- 8.15 ---------------------------------------------------------------------

test("8.15: COMPLETED sin estado real observado es PENDING, no verificado", () => {
  const r = evaluateExecutionVerification(snap({ lifecycle: running("COMPLETED") }));
  assert.equal(r.block_decision, "PENDING");
  assert.equal(r.payload.gate, "hold");
});

test("8.15: esperado y real distintos es FAILED aunque la tool dijera exito", () => {
  const closure = { closure_state: "COMPLETED", verification_status: "UNKNOWN", expected: "Titulo B", actual: "Titulo A" };
  assert.equal(evaluateExecutionVerification(snap({ lifecycle: running("COMPLETED"), closure })).block_decision, "FAILED");
  assert.equal(evaluateExecutionVerification(snap({ lifecycle: running("COMPLETED"), closure: { ...closure, actual: "titulo b " } })).block_decision, "VERIFIED");
});

test("8.15: un plan sin postcondiciones no es verificable", () => {
  const base = snap();
  assert.equal(evaluateExecutionVerification(snap({ plan: { ...base.plan!, postconditions: [] } })).block_decision, "NOT_VERIFIABLE");
});

// --- 8.17 ---------------------------------------------------------------------

test("8.17: sin ejecutar, ningun informe dice que se hizo algo", () => {
  const s = snap();
  const blocks = evaluateSupervisionBlocks(s).slice(0, -1);
  const r = evaluateExecutionReporting(s, blocks);
  assert.equal(r.checks.find((c) => c.id === "no_false_execution_claim")?.status, "PASS");
  assert.ok(r.payload.not_claimed.includes("No se ha ejecutado ningun cambio."));
});

test("8.17: el informe al cliente no lleva razonamiento interno y pide la decision si hace falta", () => {
  const s = snap({ approval: { ...snap().approval!, approval_state: "PENDING" } });
  const r = evaluateExecutionReporting(s, evaluateSupervisionBlocks(s).slice(0, -1));
  const client = r.payload.reports.find((x) => x.audience === "client")!;
  assert.deepEqual(client.details, []);
  assert.equal(r.block_decision, "DECISION_REQUESTED");
  assert.ok(client.decision_request);
});
