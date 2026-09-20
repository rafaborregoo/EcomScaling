import assert from "node:assert/strict";
import test from "node:test";
import { buildInterventionTestExecuteContext, candidateInputFromTestExecuteSources } from "./intervention-test-execute-engine.js";

const template = { template_id: "checkout", template_version: "1", source_refs: ["template:f7-p08"], domain_extension: { test_execute: { candidate_intervention: "Improve checkout form", known_defect: "NOT_CONFIRMED", evidence_strength: "qualitative", evidence_sufficiency: "INSUFFICIENT", remaining_uncertainty: ["mechanism"], decision_relevance: "YES", downside: ["friction"], reversibility: ["flag"], blast_radius: ["checkout"], cost_of_error: ["moderate"], cost_of_delay: ["opportunity"], value_of_learning: ["prioritization"], measurement_capability: "READY", traffic_volume: "sufficient", resources: ["developer"], existing_evidence: ["recordings"], context_similarity: "HIGH", guardrails: ["contribution"], guardrail_status: "PASS", urgency: "MEDIUM", current_experiments: [], business_priority: ["checkout"], economics_screen: "PLAUSIBLE", testability: "HIGH", implementation_fidelity: "READY", contamination: [], segment_relevance: ["mobile"], primary_outcome: "completed checkout", guardrail_outcomes: ["contribution"], measurement_requirement: "validated checkout events", hypothesis: "If errors are clearer because recovery is easier, completed checkout improves while contribution remains acceptable", learning_question: "Does clearer recovery improve checkout?", decision_after_result: ["expand", "modify", "stop"], exposure_mode: "limited segment", pilot_scope: "mobile", observation_requirement: "conversion lag", observation_state: "NOT_APPLICABLE", evidence_reuse: "recordings", transferability_caveat: "desktop differs", experiment_cost: "moderate", experimentability: "HIGH", execution_uncertainty: "LOW", intervention_scale: "SMALL", experiment_type: "COMPONENT", sequence_handoff: ["Hypothesis -> Limited Exposure -> Evidence -> Gate"] } } } as any;

test("F7.08 context preserves sequencing lineage and tenant", () => {
  const context = buildInterventionTestExecuteContext("org-a", { context_id: "ctx", decision_cycle_id: "cycle", primary_priority_candidate_id: "checkout@1", source_refs: ["sequence:1"] }, "2026-09-19T10:00:00.000Z");
  assert.equal(context.business_id, "org-a");
  assert.equal(context.primary_priority_candidate_id, "checkout@1");
  assert.ok(context.source_refs.includes("f7-p08.v1"));
});

test("F7.08 maps explicit experiment metadata without authorizing execution", () => {
  const context = buildInterventionTestExecuteContext("org-a", {}, "2026-09-19T10:00:00.000Z");
  const input = candidateInputFromTestExecuteSources(template, context, { candidate_id: "checkout@1", strategic_intervention: "Improve checkout", source_refs: ["sequence:candidate"], unresolved_unknowns: [] });
  assert.equal(input.candidate_intervention, "Improve checkout form");
  assert.equal(input.experiment_type, "COMPONENT");
  assert.ok(input.source_refs.includes("sequence:candidate"));
});
