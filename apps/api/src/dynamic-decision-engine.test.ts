import assert from "node:assert/strict";
import test from "node:test";
import { buildDynamicDecisionContext, dynamicDecisionInputFromSources } from "./dynamic-decision-engine.js";

test("F7.13 conserva el ciclo upstream y as_of diario", () => {
  const context = buildDynamicDecisionContext("org-a", { context_id: "ctx:p12", decision_cycle_id: "cycle:p12", source_refs: ["portfolio:p12"] }, "2026-09-20T10:00:00.000Z");
  assert.equal(context.business_id, "org-a");
  assert.equal(context.as_of, "2026-09-20T00:00:00.000Z");
  assert.equal(context.decision_cycle_id, "cycle:p12");
  assert.ok(context.source_refs.includes("f7-p13.v1"));
});

test("F7.13 toma la observación declarada por tenant y no inventa outcomes", () => {
  const context = buildDynamicDecisionContext("org-a", {}, "2026-09-20T10:00:00.000Z");
  const input = dynamicDecisionInputFromSources({
    template_id: "checkout",
    template_version: "1",
    domain_extension: {
      dynamic_decision: {
        unit_overrides: {
          "checkout@1": { observed_outcome: "POSITIVE", primary_outcome: "POSITIVE", intervention_fidelity: "CONFIRMED" },
        },
      },
    },
  } as any, context, {
    candidate_id: "checkout@1", intervention: "Optimizar checkout", causal_mechanism: "Reducir fricción", expected_outcome: "Más compras", source_refs: ["portfolio:candidate"],
  });
  assert.equal(input.decision_units[0]?.observed_outcome, "POSITIVE");
  assert.equal(input.decision_units[0]?.primary_outcome, "POSITIVE");
  assert.equal(input.decision_units[0]?.baseline_quality, "UNKNOWN");
  assert.ok(input.source_refs.includes("f7-p13.v1"));
});
