import assert from "node:assert/strict";
import test from "node:test";
import { buildRecommendationCommunicationContext, recommendationCommunicationInputFromSources } from "./recommendation-communication-engine.js";

test("F7.18 conserva el contexto tenant y no rellena hechos no declarados", () => {
  const context = buildRecommendationCommunicationContext("org-1", { context_id: "ctx-1", decision_cycle_id: "cycle-1", source_refs: ["upstream"] }, "2026-09-20T12:34:00.000Z");
  const input = recommendationCommunicationInputFromSources(null, context, { result: { recommendation_confidence: "MEDIUM", main_uncertainty: "scope" }, source_refs: ["confidence"] }, {});
  assert.equal(input.business_id, "org-1");
  assert.equal(input.context_id, "ctx-1");
  assert.equal(input.current_confidence, "MEDIUM");
  assert.equal(input.main_uncertainty, "scope");
  assert.deepEqual(input.fact_evidence, []);
  assert.ok(input.source_refs.includes("f7-p18.v1"));
});

test("F7.18 consume la configuración declarada sin cambiar el tenant", () => {
  const context = buildRecommendationCommunicationContext("org-1", {}, "2026-09-20T12:34:00.000Z");
  const input = recommendationCommunicationInputFromSources({
    template_id: "checkout", template_version: 1, lifecycle: "ACTIVE", domain_extension: {
      recommendation_communication: {
        recommendation: "Fix checkout", reason: "Payment is the bottleneck", why_now: "It is active now",
        expected_outcome: "If fixed, checkout completion should recover", main_uncertainty: "Payment scope",
        fact_evidence: ["Observed error"], success_signal: "Completion recovers", next_decision: "Continue if signal holds",
      },
    },
  } as never, context, { result: {} }, {});
  assert.equal(input.recommendation, "Fix checkout");
  assert.deepEqual(input.fact_evidence, ["Observed error"]);
  assert.equal(input.business_id, "org-1");
});
