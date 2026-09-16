import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDecisionContext,
  decisionContextResultSchema,
  fingerprintDecisionContextInput,
  type DecisionContextInputLike,
} from "./decision-context.js";

function base(): DecisionContextInputLike {
  return {
    decision_context_id: "ctx-1",
    business_id: "business-1",
    as_of: "2026-09-16T10:00:00.000Z",
    schema_version: "p1.v1",
    context_policy_version: "p1-context.v1",
    primary_objective: {
      objective_id: "objective-1",
      kind: "GOAL" as const,
      statement: "Protect contribution while restoring repeatable growth",
      source: "DECLARED" as const,
      rationale: "The operator stated this target for the next quarter.",
      horizon: "next_quarter",
      importance: "high",
      urgency: "medium",
      target_state: "Positive contribution with repeatable acquisition",
      source_refs: ["call-1"],
    },
    secondary_objectives: [],
    declared_objective: "Protect contribution while restoring repeatable growth",
    revealed_objective: null,
    objective_conflicts: [],
    time_horizon: "next_quarter",
    current_constraint_refs: ["constraint-1"],
    guardrails: [],
    resources: { cash: { value: null, state: "UNKNOWN" as const } },
    risk_context: { appetite: "medium", capacity: "UNKNOWN" as const, unresolved: ["cash_capacity"] },
    commitments: [],
    business_stage: { stage: "growth", confidence: "medium" },
    current_state: { source_refs: ["diagnostic-1"] },
    target_state: { statement: "Positive contribution with repeatable acquisition", source_refs: ["objective-1"] },
    gaps: [],
    dependencies: [],
    event_windows: [],
    must_win: [],
    must_not_fail: [],
    source_lineage_refs: ["call-1", "diagnostic-1", "constraint-1"],
  };
}

test("P1 construye un contexto completo sin rankear candidatos", () => {
  const result = buildDecisionContext(base());
  assert.equal(result.context_status, "COMPLETE");
  assert.equal(result.context_confidence, "SUFFICIENT_WITH_LIMITATIONS");
  assert.equal(result.primary_objective?.kind, "GOAL");
  assert.equal("priority_scores" in result, false);
  assert.ok(result.input_fingerprint.startsWith("fnv1a-"));
});

test("P1 no inventa objetivo cuando falta el primary", () => {
  const result = buildDecisionContext({ ...base(), primary_objective: null, declared_objective: null });
  assert.equal(result.context_status, "INCOMPLETE");
  assert.ok(result.unresolved_unknowns.includes("objective_context"));
  assert.ok(result.reason_codes.includes("OBJECTIVE.MISSING_REQUIRED"));
});

test("P1 no acepta una iniciativa como objetivo empresarial", () => {
  const result = buildDecisionContext({
    ...base(),
    primary_objective: {
      objective_id: "objective-1",
      kind: "INITIATIVE" as const,
      statement: "Launch Meta Ads",
      source: "DECLARED" as const,
      rationale: "A tactic is not the business outcome.",
      horizon: "next_quarter",
      importance: "high" as const,
      urgency: "medium" as const,
      target_state: null,
      source_refs: ["call-1"],
    },
  });
  assert.equal(result.context_status, "INCOMPLETE");
  assert.ok(result.reason_codes.includes("OBJECTIVE.NOT_A_GOAL"));
});

test("P1 conserva conflictos y no los aplana en una prioridad", () => {
  const result = buildDecisionContext({
    ...base(),
    objective_conflicts: [{ conflict_id: "conflict-1", statement: "Growth conflicts with cash preservation", objective_refs: ["objective-1", "objective-2"], resolved: false }],
  });
  assert.equal(result.context_status, "CONFLICTING");
  assert.equal(result.context_confidence, "VALIDATION_REQUIRED");
  assert.ok(result.reason_codes.includes("OBJECTIVE.CONFLICT_UNRESOLVED"));
});

test("P1 fingerprint no cambia por metadata ni identidad de transporte", () => {
  const left = fingerprintDecisionContextInput({ ...base(), metadata: { retry: 1 } });
  const right = fingerprintDecisionContextInput({ ...base(), metadata: { retry: 2 }, decision_context_id: "ctx-2", as_of: "2026-09-16T11:00:00.000Z" });
  assert.equal(left, right);
});

test("P1 resultado exige lineage y esquema válido", () => {
  const result = buildDecisionContext(base());
  assert.equal(decisionContextResultSchema.safeParse(result).success, true);
  assert.equal(decisionContextResultSchema.safeParse({ ...result, source_lineage_refs: [] }).success, false);
});
