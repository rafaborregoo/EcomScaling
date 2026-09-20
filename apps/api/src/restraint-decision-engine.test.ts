import assert from "node:assert/strict";
import test from "node:test";
import { buildRestraintDecisionContext, restraintDecisionInputFromSources } from "./restraint-decision-engine.js";

test("F7.14 conserva identidad upstream y fecha diaria", () => {
  const context = buildRestraintDecisionContext("org-a", { context_id: "ctx:p13", decision_cycle_id: "cycle:p13", source_refs: ["dynamic:p13"] }, "2026-09-20T10:00:00.000Z");
  assert.equal(context.business_id, "org-a");
  assert.equal(context.as_of, "2026-09-20T00:00:00.000Z");
  assert.equal(context.decision_cycle_id, "cycle:p13");
  assert.ok(context.source_refs.includes("f7-p14.v1"));
});

test("F7.14 consume solo contexto explícito y deja unknown lo que no está declarado", () => {
  const context = buildRestraintDecisionContext("org-a", {}, "2026-09-20T10:00:00.000Z");
  const input = restraintDecisionInputFromSources({
    template_id: "checkout", template_version: "1", domain_extension: { restraint_decision: { unit_overrides: { "checkout@1": { problem_materiality: "MATERIAL", signal_quality: "REPRESENTATIVE", decision_critical_uncertainty: "Incrementality", evidence_path_options: ["analytics"] } } } },
  } as any, context, { unit_id: "checkout@1", decision: "CONTINUE", rationale: "Observe", source_refs: ["dynamic:unit"], reversibility: "REVERSIBLE", headroom: "AVAILABLE" });
  assert.equal(input.problem_materiality, "MATERIAL");
  assert.equal(input.signal_quality, "REPRESENTATIVE");
  assert.equal(input.decision_critical_uncertainty, "Incrementality");
  assert.equal(input.current_state, "UNKNOWN");
  assert.ok(input.source_refs.includes("f7-p14.v1"));
});
