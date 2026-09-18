import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInterventionMatchingContext,
  candidateInputFromMatchingTemplate,
} from "./intervention-matching-engine.js";

const template = {
  template_id: "f7-match",
  template_version: "1",
  schema_version: "1",
  lifecycle: "ACTIVE" as const,
  domain: "CRO",
  domain_extension: {
    matching: {
      problem_refs: ["decision:1"],
      driver_refs: ["driver:checkout"],
      cause_refs: ["cause:mobile-friction"],
      mechanism_refs: ["mechanism:checkout-completion"],
      lever_refs: ["lever:mobile-checkout"],
      causal_coherence: "TRUE",
      supporting_signal_refs: ["signal:mobile-drop"],
      functional_type: "CORRECTIVE",
      intervention_family: "CRO",
      scope_refs: ["device:mobile"],
      temporal_horizon: "IMMEDIATE",
    },
  },
  name: "Fix mobile checkout",
  purpose: "Restore checkout completion",
  problem_refs: ["decision:1"],
  intent: "Fix the observed mechanism",
  intervention_type: "CORRECTIVE",
  activation_signals: [],
  preconditions: [],
  contraindications: [],
  steps: [{ step_id: "step-1", label: "Fix", stage: "CORRECT" as const, adaptation_policy: "LOCKED" as const }],
  expected_effects: ["checkout completion"],
  validation_requirements: ["validate completion"],
  success_criteria: ["completion restored"],
  failure_criteria: ["completion remains down"],
  stop_conditions: ["new evidence contradicts"],
  reassessment_conditions: [],
  resource_requirements: [],
  dependencies: [],
  intervention_risks: [],
  adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false },
  source_refs: ["playbook:f7-match"],
};

test("F7.02 context is tenant-bound and does not invent a problem", () => {
  const context = buildInterventionMatchingContext(
    "org-a",
    [{ id: "diagnostic-1", finalization_status: "invalid_output" }],
    null,
    "2026-09-18T10:00:00.000Z",
  );
  assert.equal(context.business_id, "org-a");
  assert.deepEqual(context.problem_refs, []);
  assert.match(context.context_id, /org-a/);
});

test("F7.02 candidate mapping preserves explicit causal metadata", () => {
  const context = buildInterventionMatchingContext(
    "org-a",
    [],
    { id: "decision:1", as_of: "2026-09-18T09:00:00.000Z" },
    "2026-09-18T10:00:00.000Z",
  );
  const candidate = candidateInputFromMatchingTemplate(template, context);
  assert.equal(candidate.causal_coherence, "TRUE");
  assert.deepEqual(candidate.candidate_mechanism_refs, ["mechanism:checkout-completion"]);
  assert.deepEqual(candidate.supporting_signal_refs, ["signal:mobile-drop"]);
  assert.deepEqual(candidate.source_refs, ["f3-d14.v1", "f7-p02.v1", "playbook:f7-match"]);
});
