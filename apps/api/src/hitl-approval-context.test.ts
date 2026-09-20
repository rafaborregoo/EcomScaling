import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionPlaybookContextBlocks, summarizeHitlApprovalRun } from "./decision-playbook-chat-context.js";

test("F8.02 resume para Copiloto el gate y no inventa permiso", () => {
  const summary = summarizeHitlApprovalRun({ action_id: "action-1", disposition: "APPROVAL_REQUIRED", approval_state: "PENDING", approval_gate: true, execution_state: "BLOCKED", result: { autonomy_level: "APPROVAL_GATED", required_approver_type: "finance", escalation_reasons: ["material_action"] } });
  assert.equal(summary.approval_gate, true);
  assert.equal(summary.execution_state, "BLOCKED");
  assert.equal(summary.execution_authorized, false);
  assert.equal(summary.required_approver_type, "finance");
});

test("F8.02 añade un bloque dedicado al contexto del Copiloto", () => {
  const blocks = buildDecisionPlaybookContextBlocks({ hitlApprovalRuns: [{ disposition: "HUMAN_ONLY", approval_gate: true, execution_state: "BLOCKED", result: { autonomy_level: "HUMAN_ONLY" } }] });
  const block = blocks.find((item) => item.label.startsWith("F8.02 HITL"));
  assert.ok(block);
  assert.equal(Array.isArray(block?.data), true);
});
