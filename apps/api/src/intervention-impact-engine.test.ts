import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInterventionImpactContext,
  candidateInputFromImpactSources,
} from "./intervention-impact-engine.js";

const template = {
  template_id: "f7-impact",
  template_version: "1",
  domain_extension: {
    impact: {
      primary_effect: "restore checkout completion",
      leading_indicator_refs: ["signal:checkout-errors"],
      business_outcome_refs: ["kpi:conversion-rate"],
      economic_outcome_refs: ["economic:contribution"],
      scope: "device:mobile",
      magnitude_qualitative: "MATERIAL",
      time_to_signal: "FAST",
      time_to_full_value: "MEDIUM",
      durability: "ONGOING",
      estimate_basis: "OBSERVED",
      quantitative_support: false,
      incrementality: "INCREMENTAL",
      counterfactual_present: true,
      assumptions: ["tracking stable"],
      guardrail_status: "PASS",
    },
  },
  expected_effects: ["restore checkout completion"],
  source_refs: ["playbook:f7-impact"],
} as any;

test("F7.04 context preserves the F7.03 primary and tenant lineage", () => {
  const context = buildInterventionImpactContext(
    "org-a",
    {
      id: "priority-1",
      context_id: "impact-context-1",
      decision_cycle_id: "f7-p03:org-a:2026-09-19",
      primary_priority_candidate_id: "f7-impact@1",
      source_refs: ["priority-source"],
    },
    "2026-09-19T10:00:00.000Z",
  );
  assert.equal(context.business_id, "org-a");
  assert.equal(context.primary_priority_candidate_id, "f7-impact@1");
  assert.ok(context.source_refs.includes("priority-source"));
});

test("F7.04 maps causal mechanism and explicit impact metadata without inventing numbers", () => {
  const context = buildInterventionImpactContext("org-a", { id: "priority-1", source_refs: [] }, "2026-09-19T10:00:00.000Z");
  const input = candidateInputFromImpactSources(
    template,
    context,
    { candidate_id: "f7-impact@1", priority_tier: "NOW", source_refs: ["priority-candidate"] },
    { candidate_id: "f7-impact@1", causal_chain: { mechanism_refs: ["mechanism:checkout"] }, source_refs: ["matching-candidate"] },
  );
  assert.deepEqual(input.mechanism_refs, ["mechanism:checkout"]);
  assert.deepEqual(input.leading_indicator_refs, ["signal:checkout-errors"]);
  assert.equal(input.magnitude_value, null);
  assert.ok(input.source_refs.includes("priority-candidate"));
  assert.ok(input.source_refs.includes("matching-candidate"));
});
