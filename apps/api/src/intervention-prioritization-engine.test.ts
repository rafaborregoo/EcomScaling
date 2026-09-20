import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInterventionPrioritizationContext,
  candidateInputFromPrioritizationSources,
} from "./intervention-prioritization-engine.js";

const template = {
  template_id: "f7-priority",
  template_version: "1",
  domain_extension: {
    prioritization: {
      bottleneck_relation: "BOTTLENECK",
      active_damage: "FALSE",
      expected_impact: "HIGH",
      evidence_quality: "HIGH",
      urgency: "HIGH",
      time_to_value: "FAST",
      effort: "LOW",
      risk: "LOW",
      reversibility: "HIGH",
      dependency_status: "READY",
      learning_value: "MEDIUM",
      resource_fit: "TRUE",
      guardrail_status: "PASS",
      strategic_fit: "HIGH",
      intervention_state: "VALIDATED",
    },
  },
  problem_refs: ["problem:checkout"],
  source_refs: ["playbook:f7-priority"],
} as any;

test("F7.03 context is tenant-bound and retains upstream lineage", () => {
  const context = buildInterventionPrioritizationContext(
    "org-a",
    {
      id: "matching-1",
      context_id: "matching-context-1",
      decision_cycle_id: "f7-p02:org-a:2026-09-18",
      result: { matched_candidate_ids: ["f7-priority@1"] },
      source_refs: ["matching-source"],
    },
    { id: "eligibility-1", source_refs: ["eligibility-source"] },
    "2026-09-18T10:00:00.000Z",
  );

  assert.equal(context.business_id, "org-a");
  assert.equal(context.decision_cycle_id, "f7-p02:org-a:2026-09-18");
  assert.ok(context.source_refs.includes("matching-source"));
  assert.ok(context.source_refs.includes("eligibility-source"));
});

test("F7.03 candidate mapping keeps qualitative fields and upstream statuses", () => {
  const context = buildInterventionPrioritizationContext(
    "org-a",
    { id: "matching-1", result: {} },
    { id: "eligibility-1" },
    "2026-09-18T10:00:00.000Z",
  );
  const candidate = candidateInputFromPrioritizationSources(
    template,
    context,
    { candidate_id: "f7-priority@1", disposition: "MATCHED", source_refs: ["match-candidate"] },
    { candidate_id: "f7-priority@1", disposition: "ELIGIBLE_NOW", source_refs: ["eligibility-candidate"] },
  );

  assert.equal(candidate.matched_disposition, "MATCHED");
  assert.equal(candidate.eligibility_disposition, "ELIGIBLE_NOW");
  assert.equal(candidate.bottleneck_relation, "BOTTLENECK");
  assert.equal(candidate.time_to_value, "FAST");
  assert.ok(candidate.source_refs.includes("match-candidate"));
  assert.ok(candidate.source_refs.includes("eligibility-candidate"));
});
