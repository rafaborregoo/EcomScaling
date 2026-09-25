import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateLearningBlocks } from "@ecomscaling/contracts";
import { learningSnapshotFromSources, type LearningSources } from "./continuous-learning-engine.js";

const AS_OF = "2026-09-25T10:00:00.000Z";
const empty: LearningSources = {
  closures: [], plans: [], transitions: [], approvals: [], readiness: [], autonomy: [], prioritization: [], playbooks: [],
  dataQuality: null, contextEvents: [], contextFacts: [], signals: [], expectedOutcomes: 0, priorLearnings: [],
};

const closure = (over: Record<string, unknown> = {}) => ({
  id: "c-1", intervention_id: "int-1", recommendation_id: "rec-1", as_of: "2026-08-10T00:00:00Z", evaluated_at: "2026-08-20T00:00:00Z",
  closure_state: "CLOSED", operational_outcome: "SUCCESS", verification_status: "VERIFIED", outcome_maturity: "MATURE",
  input_envelope: { task_summary: { total: 2, completed: 2, active: 0, blocked: 0 } }, result: {}, final_state_snapshot: { expected: "B", actual: "B" },
  unresolved_unknowns: [], ...over,
});

test("la foto toma el ultimo cierre de cada intervencion y no inventa el efecto de negocio", () => {
  const s = learningSnapshotFromSources("org-1", { ...empty, closures: [closure(), closure({ id: "c-0", evaluated_at: "2026-08-01T00:00:00Z" })], plans: [{ recommendation_id: "rec-1", input_envelope: { actions: [{}, {}] }, evaluated_at: "2026-08-09T00:00:00Z" }] }, AS_OF);
  assert.equal(s.experiences.length, 1);
  assert.equal(s.experiences[0]!.id, "c-1");
  assert.deepEqual(s.experiences[0]!.tasks, { total: 2, completed: 2, blocked: 0 });
  assert.equal(s.experiences[0]!.planned_actions, 2);
  assert.equal(s.experiences[0]!.observed_effect, null);
  assert.equal(s.cross_tenant_sources, 0);
});

test("un rollback en el ciclo de vida marca la experiencia y 9.03 no la da por ejecutada", () => {
  const s = learningSnapshotFromSources("org-1", { ...empty, closures: [closure()], transitions: [{ intervention_id: "int-1", command: "ROLLBACK", to_state: "ROLLED_BACK", event_at: "2026-08-15T00:00:00Z" }] }, AS_OF);
  assert.equal(s.experiences[0]!.rolled_back, true);
  assert.equal(s.experiences[0]!.started_at, "2026-08-15T00:00:00Z");
  assert.equal(evaluateLearningBlocks(s).find((r) => r.block === "9.03")!.block_decision, "NO");
});

test("los aprendizajes previos salen de 9.12 con gate, uno por experiencia, con su contexto", () => {
  const row = (id: string, at: string) => ({ id, experience_id: "c-9", classification: "POSITIVE", confidence: "MEDIUM", evaluated_at: at, result: { payload: { metric: "conversion_rate", direction: "up" } }, input_envelope: { current_context: { main_channel: "email" } } });
  const s = learningSnapshotFromSources("org-1", { ...empty, priorLearnings: [row("a", "2026-09-01T00:00:00Z"), row("b", "2026-09-10T00:00:00Z")] }, AS_OF);
  assert.equal(s.prior_learnings.length, 1);
  assert.equal(s.prior_learnings[0]!.id, "b");
  assert.deepEqual(s.prior_learnings[0]!.context, { main_channel: "email" });
});

test("solo cuentan los hechos de contexto vigentes y las aprobaciones con decision", () => {
  const s = learningSnapshotFromSources("org-1", {
    ...empty,
    contextFacts: [{ dimension: "main_channel", value: "paid_social", effective_to: null }, { dimension: "main_channel", value: "email", effective_to: "2026-01-01" }],
    approvals: [{ decision: "rejected", reason_category: "sin_evidencia", decided_at: "2026-09-20T00:00:00Z" }, { decision: "pending", decided_at: "2026-09-20T00:00:00Z" }],
  }, AS_OF);
  assert.deepEqual(s.current_context, { main_channel: "paid_social" });
  assert.equal(s.approvals.length, 1);
});
