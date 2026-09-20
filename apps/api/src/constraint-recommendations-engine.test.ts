import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConstraintRecommendationContext,
  candidateInputFromConstraintSources,
} from "./constraint-recommendations-engine.js";

const template = {
  template_id: "scale@1",
  template_version: "1",
  source_refs: ["template:constraints"],
  domain_extension: {
    constraints: {
      desired_intervention: "Aumentar adquisición validada",
      required_resources: ["cash", "creative"],
      constraints: [{ name: "creative capacity", type: "soft", duration: "temporary", status: "ACTIVE", slack: "limited", granularity: "channel", controllability: "controllable", severity: "moderate", classification: "scarcity", evidence: ["creative:queue"] }],
      binding_constraint: "creative capacity",
      scope_reduction_options: ["Empezar por el canal con mejor evidencia"],
      success_capacity: "READY",
      current_recommendation: "Aumentar adquisición",
      deferred_action: "Ampliar el resto de canales",
      activation_trigger: "Capacidad creativa disponible",
      expected_outcome: "Más pedidos rentables en un canal",
    },
  },
} as any;

test("F7.11 context preserves upstream identity and source lineage", () => {
  const context = buildConstraintRecommendationContext("org-a", { context_id: "ctx", decision_cycle_id: "cycle", primary_priority_candidate_id: "scale@1", source_refs: ["upstream:1"] }, "2026-09-20T10:00:00.000Z");
  assert.equal(context.business_id, "org-a");
  assert.equal(context.as_of, "2026-09-20T00:00:00.000Z");
  assert.ok(context.source_refs.includes("f7-p11.v1"));
});

test("F7.11 maps only explicit tenant constraints and carries upstream evidence", () => {
  const context = buildConstraintRecommendationContext("org-a", {}, "2026-09-20T10:00:00.000Z");
  const input = candidateInputFromConstraintSources(template, context, {
    candidate_id: "scale@1",
    desired_intervention: "Upstream candidate",
    source_refs: ["candidate:1"],
  });
  assert.equal(input.binding_constraint, "creative capacity");
  assert.equal(input.constraints[0]?.name, "creative capacity");
  assert.equal(input.desired_intervention, "Aumentar adquisición validada");
  assert.ok(input.source_refs.includes("candidate:1"));
  assert.ok(input.source_refs.includes("template:constraints"));
});
