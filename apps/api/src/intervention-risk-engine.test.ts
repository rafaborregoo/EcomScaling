import assert from "node:assert/strict";
import test from "node:test";
import { buildInterventionRiskContext, candidateInputFromRiskSources } from "./intervention-risk-engine.js";

const template = {
  template_id: "f7-risk",
  template_version: "1",
  domain_extension: {
    risk: {
      intervention: "Fix mobile checkout error",
      intended_outcome: "Recover checkout completion",
      commitment_level: "LIMITED",
      exposure: "Mobile traffic only",
      potential_upside: ["Recover checkouts"],
      potential_downside: ["Deployment regression"],
      evidence_strength: "DIRECT_EVIDENCE",
      reversibility_profile: { can_revert: "TRUE", reversal_delay: "minutes", reversal_cost: "LIMITED", residual_damage: "UNKNOWN" },
      blast_radius: { scope: ["mobile traffic"], level: "LIMITED", concentration: [], dependencies: [] },
      inaction_risk: ["Continued checkout loss"],
      action_risk: ["Regression"],
      guardrails: { hard_veto: false, status: "PASS", refs: ["guardrail:checkout"] },
      observability: { monitoring_available: "TRUE", detection_speed: "FAST", feedback_loop: "AVAILABLE", measurement_quality: "GOOD" },
      risk_capacity: "MODERATE",
      failure_modes: ["negative effect"],
      scenarios: { downside_case: "No improvement", base_case: "Recovery", upside_case: "More completion", tail_risk: "Customer harm" },
      cost_of_error: { severity: "LIMITED", action: "LIMITED", delay: "MATERIAL", failure: "MATERIAL", rollback: "LIMITED", residual: "UNKNOWN" },
      recommended_commitment: "LIMITED_TEST",
      de_risking_actions: ["Monitor and rollback"],
      risk_tradeoff: { accepted: ["Short deploy risk"], avoided: ["Full exposure"], introduced: [], transferred: [] },
      decision_conditions: ["Expand after evidence"],
    },
  },
  source_refs: ["playbook:f7-risk"],
} as any;

test("F7.06 context keeps tenant and F7.03 lineage", () => {
  const context = buildInterventionRiskContext("org-a", { context_id: "ctx", decision_cycle_id: "cycle", primary_priority_candidate_id: "fix@1", source_refs: ["priority:1"] }, { source_refs: ["impact:1"] }, { source_refs: ["feasibility:1"] }, "2026-09-19T10:00:00.000Z");
  assert.equal(context.business_id, "org-a");
  assert.equal(context.primary_priority_candidate_id, "fix@1");
  assert.ok(context.source_refs.includes("priority:1"));
});

test("F7.06 maps explicit risk metadata and keeps numeric claims unsupported", () => {
  const context = buildInterventionRiskContext("org-a", { context_id: "ctx", source_refs: [] }, {}, {}, "2026-09-19T10:00:00.000Z");
  const input = candidateInputFromRiskSources(template, context, { candidate_id: "fix@1", priority_tier: "NOW", disposition: "SUPPORTED_QUALITATIVE", source_refs: ["impact:candidate"] }, { candidate_id: "fix@1", disposition: "FEASIBLE_NOW", source_refs: ["feasibility:candidate"] });
  assert.deepEqual(input.potential_upside, ["Recover checkouts"]);
  assert.equal(input.risk_capacity, "MODERATE");
  assert.equal(input.quantitative_support, false);
  assert.ok(input.source_refs.includes("impact:candidate"));
  assert.ok(input.source_refs.includes("feasibility:candidate"));
});
