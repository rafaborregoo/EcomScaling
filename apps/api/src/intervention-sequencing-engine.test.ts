import assert from "node:assert/strict";
import test from "node:test";
import { buildInterventionSequencingContext, candidateInputFromSequencingSources } from "./intervention-sequencing-engine.js";

const template = {
  template_id: "scale-checkout",
  template_version: "1",
  domain_extension: {
    sequencing: {
      strategic_intervention: "Scale mobile checkout acquisition",
      intended_outcome: "Increase completed orders safely",
      business_mode: "growth",
      prerequisites: [{ dependency_id: "tracking-ready", description: "Tracking reliable", category: "data", requirement: "HARD", status: "READY", blocking: false, source_refs: ["source:tracking"], unlocks: ["scale-checkout@1"] }],
      sequence_steps: [{ step_id: "step-now", kind: "NOW", action: "Confirm tracking", why_first: "Protects learning", prerequisite_ids: [], gate_ids: ["gate-1"], next_ids: ["scale-checkout@1"], if_condition: "tracking reliable", if_not_condition: "tracking unreliable", wait_for: "none", exit_condition: "tracking validated", source_refs: ["source:tracking"] }, { step_id: "step-next", kind: "THEN", action: "Scale checkout", why_first: "Uses validated signal", prerequisite_ids: ["tracking-ready"], gate_ids: ["gate-1"], next_ids: [], if_condition: "tracking reliable", if_not_condition: "repair tracking", wait_for: "none", exit_condition: "stop on guardrail", source_refs: ["source:scale"] }],
      gates: [{ gate_id: "gate-1", condition: "tracking reliable", if_true: "scale-checkout@1", if_false: "repair-tracking", wait_required: false, exit_condition: "tracking validated", guardrail_status: "PASS", source_refs: ["source:tracking"] }],
      critical_path: ["tracking-ready", "scale-checkout@1"], guardrails: ["monitor errors"], guardrail_status: "PASS", parallel_tracks: [], not_yet: [], wait_conditions: [], exit_conditions: ["stop on guardrail"], current_blockers: [], resource_context: ["developer available"], risk_context: ["limited exposure"], evidence_context: ["checkout evidence"], lead_times: [], current_experiments: [],
    },
  },
  source_refs: ["playbook:f7-sequencing"],
} as any;

test("F7.07 context preserves primary and upstream lineage", () => {
  const context = buildInterventionSequencingContext("org-a", { context_id: "ctx", decision_cycle_id: "cycle", primary_priority_candidate_id: "scale-checkout@1", source_refs: ["priority:1"] }, { source_refs: ["impact:1"] }, { source_refs: ["feasibility:1"] }, { source_refs: ["risk:1"] }, "2026-09-19T10:00:00.000Z");
  assert.equal(context.business_id, "org-a");
  assert.equal(context.primary_priority_candidate_id, "scale-checkout@1");
  assert.ok(context.source_refs.includes("risk:1"));
});

test("F7.07 maps explicit sequence metadata without inventing parallel work", () => {
  const context = buildInterventionSequencingContext("org-a", { context_id: "ctx", source_refs: [] }, {}, {}, {}, "2026-09-19T10:00:00.000Z");
  const input = candidateInputFromSequencingSources(template, context, { candidate_id: "scale-checkout@1", priority_tier: "NOW", disposition: "NOW", source_refs: ["priority:candidate"] }, { candidate_id: "scale-checkout@1", disposition: "RISK_ACCEPTABLE_WITH_GUARDRAILS", source_refs: ["risk:candidate"] });
  assert.equal(input.strategic_intervention, "Scale mobile checkout acquisition");
  assert.equal(input.sequence_steps.length, 2);
  assert.deepEqual(input.parallel_tracks, []);
  assert.ok(input.source_refs.includes("risk:candidate"));
});
