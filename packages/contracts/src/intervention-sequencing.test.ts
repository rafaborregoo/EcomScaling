import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInterventionSequence,
  evaluateInterventionSequenceSet,
  type InterventionSequencingInput,
} from "./intervention-sequencing.js";

function base(overrides: Partial<InterventionSequencingInput> = {}): InterventionSequencingInput {
  return {
    candidate_id: "scale-checkout@1.0.0",
    priority_tier: "NOW",
    strategic_intervention: "Scale mobile checkout acquisition",
    intended_outcome: "Increase completed orders without operational overload",
    priority_disposition: "NOW",
    impact_disposition: "SUPPORTED_QUALITATIVE",
    feasibility_disposition: "FEASIBLE_NOW",
    risk_disposition: "RISK_ACCEPTABLE_WITH_GUARDRAILS",
    prerequisites: [
      { dependency_id: "tracking-ready", description: "Checkout tracking is reliable", category: "data", requirement: "HARD", status: "READY", blocking: false, source_refs: ["source:tracking"], unlocks: ["scale-checkout@1.0.0"] },
    ],
    current_blockers: [],
    resource_context: ["developer available"],
    risk_context: ["mobile exposure limited"],
    evidence_context: ["checkout evidence"],
    lead_times: [],
    business_mode: "growth",
    guardrails: ["monitor checkout errors"],
    guardrail_status: "PASS",
    current_experiments: [],
    critical_path: ["tracking-ready", "scale-checkout@1.0.0"],
    sequence_steps: [
      { step_id: "step-tracking", kind: "NOW", action: "Confirm tracking", why_first: "Protects causal learning", prerequisite_ids: [], gate_ids: ["gate-tracking"], next_ids: ["scale-checkout@1.0.0"], if_condition: "tracking reliable", if_not_condition: "tracking unreliable", wait_for: "none", exit_condition: "tracking validated", source_refs: ["source:tracking"] },
      { step_id: "step-scale", kind: "THEN", action: "Scale mobile checkout", why_first: "Uses validated signal", prerequisite_ids: ["tracking-ready"], gate_ids: ["gate-tracking"], next_ids: [], if_condition: "tracking reliable", if_not_condition: "hold and repair tracking", wait_for: "none", exit_condition: "stop if guardrail breaks", source_refs: ["source:scale"] },
    ],
    gates: [{ gate_id: "gate-tracking", condition: "tracking reliable", if_true: "scale-checkout@1.0.0", if_false: "repair-tracking", wait_required: false, exit_condition: "tracking validated", guardrail_status: "PASS", source_refs: ["source:tracking"] }],
    parallel_tracks: [],
    not_yet: [],
    wait_conditions: [],
    exit_conditions: ["Stop if checkout error guardrail breaks"],
    unresolved_unknowns: [],
    evidence_refs: ["evidence:checkout"],
    source_refs: ["template:f7-sequencing"],
    ...overrides,
  };
}

test("F7.07 conserva la cadena prerequisite -> gate -> next", () => {
  const result = evaluateInterventionSequence(base());
  assert.equal(result.disposition, "SEQUENCE_READY");
  assert.deepEqual(result.sequence_trace.prerequisite_ids, ["tracking-ready"]);
  assert.deepEqual(result.sequence_trace.gate_ids, ["gate-tracking"]);
  assert.equal(result.execution_authorized, false);
});

test("F7.07 bloquea un prerequisite hard no resuelto", () => {
  const result = evaluateInterventionSequence(base({ prerequisites: [{ dependency_id: "cash-ready", description: "Cash buffer available", category: "economic", requirement: "HARD", status: "UNRESOLVED", blocking: true, source_refs: ["source:cash"], unlocks: ["scale-checkout@1.0.0"] }], current_blockers: ["cash-ready"] }));
  assert.equal(result.disposition, "BLOCKED");
  assert.ok(result.reason_codes.includes("DEPENDENCY.HARD_BLOCKER"));
  assert.deepEqual(result.current_blockers, ["cash-ready"]);
});

test("F7.07 no inventa paralelismo y exige validación si falta el camino", () => {
  const result = evaluateInterventionSequence(base({ sequence_steps: [], gates: [], parallel_tracks: [] }));
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.ok(result.unresolved_unknowns.includes("sequence_steps"));
  assert.deepEqual(result.parallel_tracks, []);
});

test("F7.07 conserva primary y no convierte secuencia en ejecución", () => {
  const result = evaluateInterventionSequenceSet({ context_id: "ctx", business_id: "org", decision_cycle_id: "cycle", primary_priority_candidate_id: "scale-checkout@1.0.0", candidates: [base()], evaluated_at: "2026-09-19T00:00:00.000Z" });
  assert.equal(result.disposition, "SEQUENCES_AVAILABLE");
  assert.equal(result.primary_priority_candidate_id, "scale-checkout@1.0.0");
  assert.equal(result.execution_authorized, false);
});
