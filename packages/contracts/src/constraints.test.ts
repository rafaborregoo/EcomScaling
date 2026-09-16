import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateConstraintsDependencies, type ConstraintsDependenciesInputLike } from "./constraints.js";

const base: ConstraintsDependenciesInputLike = {
  assessment_id: "constraints:1",
  business_id: "org-1",
  as_of: "2026-09-16T12:00:00.000Z",
  system_objective: { statement: "Aumentar contribution rentable", source_refs: ["decision-context:1"] },
  constraints: [{ candidate_ref: "case-1", capability: "INVENTORY", role: "PRIMARY", horizon: "CURRENT", status: "HYPOTHESIZED", binding_evidence: ["stockout blocks hero SKU orders"], demand_on_capacity: 100, available_capacity: 80, saturation_share: 1, queue_or_backlog: 20, throughput_blocked: "hero SKU orders", release_value: "unknown", falsifier: "orders remain unchanged after replenishment", confidence: "MEDIUM", source_refs: ["inventory:1"] }],
  dependencies: [{ upstream_ref: "case-2", downstream_ref: "case-1", dependency_type: "SUPPLY", relation: "BLOCKER", strength: "HARD", certainty: "CONFIRMED", minimum_prerequisite: "inventory available for hero SKU", alternative_paths: [], redundancy: "NONE", switching_lead_time_days: 14, slack_days: 0, critical_path: true, parallelism: "PARALLEL_PARTIAL", shared_resource: null, control: "INFLUENCEABLE", explanation: "Supply arrival is required before inventory can serve orders", source_refs: ["supplier:1"] }],
  source_refs: ["inventory:1", "supplier:1"],
};

test("P05 separa constraint primario de dependencia y no produce ranking", () => {
  const result = evaluateConstraintsDependencies(base);
  assert.equal(result.constraint_map.current_primary, "case-1");
  assert.equal(result.dependency_graph[0]?.relation, "BLOCKER");
  assert.ok(!("priority" in result));
  assert.ok(!("rank" in result));
  assert.ok(!("score" in result));
});

test("P05 no identifica un constraint sin objetivo de sistema", () => {
  const result = evaluateConstraintsDependencies({ ...base, assessment_id: "constraints:2", system_objective: null });
  assert.equal(result.constraint_map.current_primary, null);
  assert.ok(result.unresolved_unknowns.includes("system_objective"));
  assert.ok(result.reason_codes.includes("OBJECTIVE.MISSING"));
});

test("P05 exige evidencia vinculada y falsifier para un primary", () => {
  assert.throws(() => evaluateConstraintsDependencies({
    ...base,
    assessment_id: "constraints:3",
    constraints: [{ ...base.constraints[0]!, binding_evidence: [], falsifier: "" }],
  }), /constraints_input_invalid/);
});

test("P05 conserva conflicto de recurso distinto de dependencia causal", () => {
  const result = evaluateConstraintsDependencies({ ...base, assessment_id: "constraints:4", dependencies: [{ ...base.dependencies[0]!, relation: "RESOURCE_CONFLICT", dependency_type: "RESOURCE", strength: "MODERATE", critical_path: false, shared_resource: "engineering" }] });
  assert.equal(result.dependency_graph[0]?.relation, "RESOURCE_CONFLICT");
  assert.equal(result.dependency_graph[0]?.shared_resource, "engineering");
});
