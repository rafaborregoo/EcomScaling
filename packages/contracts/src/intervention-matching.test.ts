import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInterventionMatching,
  evaluateInterventionMatchingSet,
  type InterventionMatchingInput,
} from "./intervention-matching.js";

function input(overrides: Partial<InterventionMatchingInput> = {}): InterventionMatchingInput {
  return {
    candidate_id: "candidate-a",
    problem_refs: ["problem:cvr"],
    candidate_problem_refs: ["problem:cvr"],
    driver_refs: ["driver:checkout"],
    candidate_driver_refs: ["driver:checkout"],
    cause_refs: ["cause:mobile-friction"],
    candidate_cause_refs: ["cause:mobile-friction"],
    mechanism_refs: ["mechanism:checkout-completion"],
    candidate_mechanism_refs: ["mechanism:checkout-completion"],
    lever_refs: ["lever:mobile-checkout"],
    candidate_lever_refs: ["lever:mobile-checkout"],
    causal_coherence: "TRUE",
    supporting_signal_refs: ["signal:mobile-drop"],
    disconfirming_signal_refs: [],
    discriminating_evidence_refs: [],
    functional_type: "CORRECTIVE",
    intervention_family: "CRO",
    scope_refs: ["device:mobile"],
    temporal_horizon: "IMMEDIATE",
    unresolved_unknowns: [],
    evidence_refs: ["diagnostic:1"],
    source_refs: ["playbook:f7-candidate"],
    ...overrides,
  };
}

test("matching necesita una historia causal completa y devuelve el trazado", () => {
  const result = evaluateInterventionMatching(input());
  assert.equal(result.disposition, "MATCHED");
  assert.deepEqual(result.causal_chain, {
    problem_refs: ["problem:cvr"],
    driver_refs: ["driver:checkout"],
    cause_refs: ["cause:mobile-friction"],
    mechanism_refs: ["mechanism:checkout-completion"],
    lever_refs: ["lever:mobile-checkout"],
  });
  assert.equal(result.selected, false);
});

test("matching no convierte una etiqueta de problema en una tactica", () => {
  const result = evaluateInterventionMatching(input({
    candidate_mechanism_refs: [],
    candidate_lever_refs: [],
    causal_coherence: "UNKNOWN",
  }));
  assert.equal(result.disposition, "INSUFFICIENT_EVIDENCE");
  assert.ok(result.unresolved_unknowns.includes("mechanism_refs"));
  assert.ok(result.unresolved_unknowns.includes("controllable_lever_refs"));
});

test("un problema distinto descarta el candidato sin priorizar otros", () => {
  const result = evaluateInterventionMatching(input({
    candidate_problem_refs: ["problem:acquisition"],
  }));
  assert.equal(result.disposition, "NO_CAUSAL_MATCH");
  assert.equal(result.selected, false);
});

test("el conjunto conserva alternativas y nunca elige una", () => {
  const result = evaluateInterventionMatchingSet({
    context_id: "matching-context:org-a",
    business_id: "org-a",
    decision_cycle_id: "f7-p02:org-a",
    candidates: [
      input({ candidate_id: "candidate-a" }),
      input({ candidate_id: "candidate-b", causal_coherence: "UNKNOWN" }),
    ],
    evaluated_at: "2026-09-18T10:00:00.000Z",
  });
  assert.equal(result.disposition, "MATCHES_AVAILABLE");
  assert.deepEqual(result.matched_candidate_ids, ["candidate-a"]);
  assert.equal(result.selected_candidate_id, null);
  assert.equal(result.candidate_evaluations.length, 2);
});
