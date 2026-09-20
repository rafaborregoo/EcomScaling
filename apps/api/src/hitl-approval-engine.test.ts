import assert from "node:assert/strict";
import test from "node:test";
import { buildHitlApprovalContext, hitlApprovalInputFromSources } from "./hitl-approval-engine.js";

test("F8.02 construye contexto tenant y conserva la fecha de negocio", () => {
  const context = buildHitlApprovalContext("org-1", { context_id: "ctx-1", decision_cycle_id: "cycle-1", source_refs: ["upstream"] }, "2026-09-20T12:00:00.000Z");
  assert.equal(context.business_id, "org-1"); assert.equal(context.as_of, "2026-09-20T00:00:00.000Z"); assert.deepEqual(context.source_refs, ["upstream", "f8-p02.v1"]);
});

test("F8.02 convierte una salida con writes en una acción material y gated", () => {
  const context = buildHitlApprovalContext("org-1", {}, "2026-09-20T12:00:00.000Z");
  const input = hitlApprovalInputFromSources(context, { id: "output-1", approval_required: true, output: { title: "Cambiar presupuesto", proposed_writes: [{ table: "campaigns" }] } }, null);
  assert.equal(input.action_id, "output-1"); assert.equal(input.is_material, true); assert.equal(input.requested_autonomy, "APPROVAL_GATED"); assert.equal(input.action_type, "write");
});

test("F8.02 lee una aprobación existente sin tratarla como ejecución", () => {
  const context = buildHitlApprovalContext("org-1", {}, "2026-09-20T12:00:00.000Z");
  const input = hitlApprovalInputFromSources(context, { id: "output-1", approval_required: true, output: { title: "Preparar cambio", proposed_tasks: [] } }, { id: "approval-1", decision: "approved", decided_by: "user-1", decided_at: "2026-09-20T11:00:00.000Z" });
  assert.equal(input.existing_approval?.state, "APPROVED"); assert.equal(input.existing_approval?.approver_id, "user-1");
});
