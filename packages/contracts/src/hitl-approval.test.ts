import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHitlApproval, type HitlApprovalInput } from "./hitl-approval.js";

const base = (overrides: Partial<HitlApprovalInput> = {}): HitlApprovalInput => ({
  context_id: "ctx-8-02", business_id: "org-1", decision_cycle_id: "cycle-8-02", action_id: "action-1", action_type: "marketing_write", action_description: "Publicar el cambio propuesto", domain: "marketing", proposer_id: "ai", requested_autonomy: "PREPARE", is_material: true, risk: "HIGH", impact: "Mejorar conversión", financial_exposure: "MEDIUM", customer_exposure: "LOW", blast_radius: "NARROW", reversibility: "REVERSIBLE", sensitivity: "LOW", uncertainty: "MEDIUM", novelty: "KNOWN", policy: { autonomy_level: "PREPARE", autonomy_ceiling: "APPROVAL_GATED", approval_requirement: "APPROVAL", approval_granularity: "ACTION", required_approver_type: "consultant", required_approval_tier: "tenant", dual_approval_required: false, human_only: false, fail_closed: true, pre_approval: null, review_timing: "BEFORE", intervention_ownership: "SHARED" }, existing_approval: null, source_refs: ["f8.02"], unresolved_unknowns: [], ...overrides,
});

test("F8.02 bloquea una acción material hasta aprobación válida", () => {
  const result = evaluateHitlApproval(base(), "2026-09-20T12:00:00.000Z");
  assert.equal(result.disposition, "APPROVAL_REQUIRED");
  assert.equal(result.approval_gate, true);
  assert.equal(result.approval_state, "PENDING");
  assert.equal(result.execution_state, "BLOCKED");
  assert.equal(result.execution_authorized, false);
});

test("F8.02 conserva separados approval y execution cuando existe aprobación", () => {
  const result = evaluateHitlApproval(base({ existing_approval: { approval_id: "approval-1", state: "APPROVED", approved_scope: "action-1", approved_version: "v2", conditions: [], valid_until: "2026-09-21T12:00:00.000Z", approved_at: "2026-09-20T11:00:00.000Z", freshness_ok: true, authority_valid: true, revoked: false, approver_type: "consultant", approver_id: "user-1" } }), "2026-09-20T12:00:00.000Z");
  assert.equal(result.approval_state, "APPROVED");
  assert.equal(result.approval_freshness, "CURRENT");
  assert.equal(result.execution_state, "BLOCKED");
  assert.equal(result.execution_authorized, false);
});

test("F8.02 reduce autonomía si falta contexto crítico", () => {
  const result = evaluateHitlApproval(base({ action_description: "UNKNOWN", uncertainty: "UNKNOWN", unresolved_unknowns: [] }), "2026-09-20T12:00:00.000Z");
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.equal(result.autonomy_level, "APPROVAL_GATED");
  assert.ok(result.unresolved_unknowns.includes("action_description"));
  assert.ok(result.unresolved_unknowns.includes("uncertainty"));
});

test("F8.02 respeta human-only aunque haya una aprobación genérica", () => {
  const result = evaluateHitlApproval(base({ policy: { ...base().policy, human_only: true, autonomy_ceiling: "HUMAN_ONLY", approval_requirement: "HUMAN_ONLY" }, existing_approval: null }), "2026-09-20T12:00:00.000Z");
  assert.equal(result.disposition, "HUMAN_ONLY");
  assert.equal(result.approval_requirement, "HUMAN_ONLY");
  assert.equal(result.escalation_required, true);
});
