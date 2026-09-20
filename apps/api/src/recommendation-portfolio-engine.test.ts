import assert from "node:assert/strict";
import test from "node:test";
import { buildRecommendationPortfolioContext, candidateInputFromPortfolioSources } from "./recommendation-portfolio-engine.js";

const template = {
  template_id: "acquisition@1",
  template_version: "1",
  source_refs: ["template:f7-p12"],
  domain_extension: { portfolio: {
    strategic_objective: "Proteger economía",
    dominant_priority: "acquisition@1",
    current_wip: "one active initiative",
    available_capacity: "focused capacity",
    shared_resources: ["paid_media"],
    management_attention: "focused",
    aggregate_capacity: "FEASIBLE",
    current_portfolio_complexity: "LOW",
    current_risk_state: "CONTAINED",
    evidence_quality: "SUPPORTED",
    timing_context: "NOW",
    candidate_overrides: {
      "acquisition@1": { desired_role: "PRIMARY", status: "ACTIVE_OPTION", entry_reason: "Dominant priority" },
    },
  } },
} as any;

test("F7.12 context preserves upstream identity and lineage", () => {
  const context = buildRecommendationPortfolioContext("org-a", { context_id: "ctx:p11", decision_cycle_id: "cycle:p11", primary_priority_candidate_id: "acquisition@1", source_refs: ["upstream:p11"] }, "2026-09-20T10:00:00.000Z");
  assert.equal(context.business_id, "org-a");
  assert.equal(context.as_of, "2026-09-20T00:00:00.000Z");
  assert.ok(context.source_refs.includes("f7-p12.v1"));
});

test("F7.12 maps the upstream feasible recommendation and explicit portfolio metadata", () => {
  const context = buildRecommendationPortfolioContext("org-a", {}, "2026-09-20T10:00:00.000Z");
  const input = candidateInputFromPortfolioSources(template, context, {
    candidate_id: "acquisition@1",
    desired_intervention: "Reasignar adquisición",
    best_feasible_recommendation: "Reasignar al canal validado",
    binding_constraint: "creative capacity",
    feasibility_disposition: "FEASIBLE_WITH_ADAPTATION",
    source_refs: ["candidate:p11"],
  });
  assert.equal(input.candidate_id, "acquisition@1");
  assert.equal(input.intervention, "Reasignar al canal validado");
  assert.equal(input.desired_role, "PRIMARY");
  assert.ok(input.source_refs.includes("candidate:p11"));
  assert.ok(input.source_refs.includes("template:f7-p12"));
});
