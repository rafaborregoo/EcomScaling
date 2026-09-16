import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTemporalUrgency, temporalUrgencyResultSchema, type TemporalUrgencyInputLike } from "./temporal-urgency.js";

function base(): TemporalUrgencyInputLike {
  return { assessment_id: "assessment-1", business_id: "business-1", candidate_ref: "case-1", as_of: "2026-09-16T10:00:00.000Z", trajectory: "ACCELERATING", current_state: "DAMAGING", time_to_damage: { earliest_days: 1, base_days: 2, latest_days: 3 }, damage_velocity: "ACCELERATING", cost_of_delay: "MATERIAL", intervention_window: { opens_at: "2026-09-16T10:00:00.000Z", closes_at: "2026-09-16T12:00:00.000Z" }, decision_deadline: { at: "2026-09-16T11:00:00.000Z", type: "HARD" }, decision_lead_time_days: 0.01, execution_lead_time_days: 0.01, result_latency_days: 0, time_to_irreversibility_days: 1, recoverability: "PARTIAL", reversibility: "REVERSIBLE", temporal_dependencies: [], evidence_as_of: "2026-09-16T09:00:00.000Z", freshness_requirement_hours: 24, source_refs: ["diagnostic-1"] };
}

test("P03 no confunde deadline con prioridad: solo evalúa sensibilidad temporal", () => {
  const result = evaluateTemporalUrgency({ ...base(), decision_lead_time_days: 0.1 });
  assert.equal(result.temporal_assessment, "TIME_CRITICAL");
  assert.equal("priority" in result, false);
  assert.equal("rank" in result, false);
});

test("P03 conserva UNKNOWN cuando no hay timing accionable", () => {
  const result = evaluateTemporalUrgency({ ...base(), time_to_damage: null, intervention_window: null, decision_deadline: null, trajectory: "UNKNOWN" });
  assert.equal(result.temporal_assessment, "UNKNOWN");
  assert.ok(result.unresolved_unknowns.includes("timing"));
});

test("P03 no inventa precisión y degrada evidencia stale", () => {
  const result = evaluateTemporalUrgency({ ...base(), evidence_as_of: "2026-09-10T09:00:00.000Z", freshness_requirement_hours: 1 });
  assert.equal(result.temporal_confidence, "VALIDATION_REQUIRED");
  assert.ok(result.reason_codes.includes("EVIDENCE.STALE"));
  assert.equal(temporalUrgencyResultSchema.safeParse(result).success, true);
});

test("P03 exige lead times separados y conserva dependencias", () => {
  const result = evaluateTemporalUrgency({ ...base(), decision_lead_time_days: null, temporal_dependencies: [{ dependency_id: "dep-1", relation: "MUST_FINISH_BEFORE", predecessor_ref: "case-2", successor_ref: "case-1", slack_days: null, source_refs: ["plan-1"] }] });
  assert.equal(result.total_response_time_days, null);
  assert.ok(result.unresolved_unknowns.includes("total_response_time"));
  assert.equal(result.temporal_dependencies.length, 1);
});
