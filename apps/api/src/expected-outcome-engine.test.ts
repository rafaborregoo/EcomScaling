import assert from "node:assert/strict";
import test from "node:test";
import { buildExpectedOutcomeContext, expectedOutcomeInputFromSources } from "./expected-outcome-engine.js";

test("F7.15 conserva la cadena F7.14 y el as_of diario", () => {
  const context = buildExpectedOutcomeContext("org-a", { context_id: "ctx:p14", decision_cycle_id: "cycle:p14", source_refs: ["restraint:p14"] }, "2026-09-20T10:00:00.000Z");
  assert.equal(context.business_id, "org-a");
  assert.equal(context.as_of, "2026-09-20T00:00:00.000Z");
  assert.equal(context.decision_cycle_id, "cycle:p14");
  assert.ok(context.source_refs.includes("f7-p15.v1"));
});

test("F7.15 usa solo campos de outcome declarados por tenant", () => {
  const context = buildExpectedOutcomeContext("org-a", {}, "2026-09-20T10:00:00.000Z");
  const input = expectedOutcomeInputFromSources({ template_id: "checkout", template_version: "1", domain_extension: { expected_outcome: { recommendation: "Improve recovery", cause: "Friction", causal_mechanism: "Reduce friction", primary_success_criterion: "More purchases", mechanism_evidence: ["Less friction"], guardrails: ["Margin intact"] } } } as any, context, { decision: "CONTINUE", scope: "checkout", source_refs: ["restraint:unit"] });
  assert.equal(input.recommendation, "Improve recovery");
  assert.equal(input.causal_mechanism, "Reduce friction");
  assert.deepEqual(input.mechanism_evidence, ["Less friction"]);
  assert.equal(input.current_baseline, "UNKNOWN");
  assert.ok(input.source_refs.includes("f7-p15.v1"));
});
