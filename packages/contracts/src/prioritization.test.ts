import assert from "node:assert/strict";
import test from "node:test";

import {
  DECISION_VALIDITIES,
  GATE_RESULTS,
  PRIORITIZATION_RUN_STATUSES,
  evaluatePrioritizationRun,
  fingerprintPrioritizationInput,
  prioritizationResultSchema,
} from "./prioritization.js";

const base = () => ({
  prioritization_run_id: "run-1",
  business_id: "org-1",
  analysis_snapshot_id: "snapshot-1",
  created_at: "2026-09-16T10:00:00.000Z",
  decision_as_of: "2026-09-15T23:59:59.000Z",
  schema_version: "p0.v1",
  decision_policy_version: "policy.v1",
  diagnostic_refs: ["diagnosis-1"],
  decision_context_ref: "context-1",
  candidate_set_ref: "candidate-set-1",
  evaluation_time: "2026-09-16T10:00:00.000Z",
  candidates: [{ candidate_id: "candidate-1", candidate_type: "PROBLEM" as const }],
});

test("P0: un input completo llega a READY sin inventar un ranking", () => {
  const result = evaluatePrioritizationRun(base());

  assert.equal(result.run_status, "READY");
  assert.equal(result.decision_validity, "VALID_WITH_LIMITATIONS");
  assert.deepEqual(result.unresolved_unknowns, []);
  assert.equal(result.candidate_evaluation_refs?.length ?? 0, 0);
  assert.equal(result.rule_trace_refs.length, 1);
});

test("P0: falta contexto impide READY y no se rellena con growth", () => {
  const result = evaluatePrioritizationRun({ ...base(), decision_context_ref: null });

  assert.equal(result.run_status, "INPUT_INCOMPLETE");
  assert.equal(result.decision_validity, "INSUFFICIENT_INFORMATION");
  assert.ok(result.abstention_reason_codes.includes("INPUT.MISSING_REQUIRED"));
  assert.ok(result.unresolved_unknowns.includes("decision_context"));
});

test("P0: un hard gate UNKNOWN permanece UNKNOWN", () => {
  const result = evaluatePrioritizationRun({
    ...base(),
    gates: [{ gate_id: "NO_CRITICAL_CONTEXT_CONTRADICTION", result: "UNKNOWN" as const }],
  });

  assert.equal(result.run_status, "INPUT_INCOMPLETE");
  assert.equal(result.gates[0]?.result, "UNKNOWN");
  assert.ok(result.unresolved_unknowns.includes("NO_CRITICAL_CONTEXT_CONTRADICTION"));
});

test("P0: un hard gate FAIL no puede ser compensado por un impacto alto", () => {
  const result = evaluatePrioritizationRun({
    ...base(),
    gates: [{ gate_id: "LEGAL", result: "FAIL" as const }],
    material_values: { value_at_risk: 999999 },
  });

  assert.equal(result.run_status, "ABSTAINED");
  assert.equal(result.decision_validity, "REQUIRES_VALIDATION");
  assert.ok(result.abstention_reason_codes.includes("GATE.HARD_FAIL"));
});

test("P0: UNKNOWN no es cero, false, LOW ni N/A", () => {
  assert.deepEqual(GATE_RESULTS, ["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"]);
  assert.ok(!GATE_RESULTS.includes("LOW" as never));
  assert.ok(!GATE_RESULTS.includes("0" as never));
});

test("P0: NOT_APPLICABLE requiere regla de aplicabilidad", () => {
  const invalid = prioritizationResultSchema.safeParse({
    ...evaluatePrioritizationRun(base()),
    gates: [{ gate_id: "LEGAL", result: "NOT_APPLICABLE" }],
  });
  const valid = prioritizationResultSchema.safeParse({
    ...evaluatePrioritizationRun(base()),
    gates: [{ gate_id: "LEGAL", result: "NOT_APPLICABLE", applicability_rule_ref: "rule-legal-na" }],
  });

  assert.equal(invalid.success, false);
  assert.equal(valid.success, true);
});

test("P0: un fallo técnico termina en FAILED, no en ABSTAINED", () => {
  const result = evaluatePrioritizationRun({ ...base(), technical_error: "db unavailable" });

  assert.equal(result.run_status, "FAILED");
  assert.equal(result.decision_validity, "INVALID");
  assert.deepEqual(result.abstention_reason_codes, []);
  assert.ok(result.warnings.includes("ENGINE.TECHNICAL_FAILURE"));
});

test("P0: candidate fuera del set es rechazado", () => {
  const result = evaluatePrioritizationRun({
    ...base(),
    candidate_evaluation_refs: [{ candidate_id: "candidate-foreign", candidate_type: "RISK" }],
  });

  assert.equal(result.run_status, "ABSTAINED");
  assert.equal(result.decision_validity, "NO_VALID_CANDIDATES");
  assert.ok(result.abstention_reason_codes.includes("INPUT.CANDIDATE_OUTSIDE_SET"));
  assert.equal(result.candidate_evaluation_refs?.length ?? 0, 0);
});

test("P0: candidate set vacío permite abstenerse explícitamente", () => {
  const result = evaluatePrioritizationRun({ ...base(), candidates: [] });

  assert.equal(result.run_status, "ABSTAINED");
  assert.equal(result.decision_validity, "NO_VALID_CANDIDATES");
  assert.ok(result.abstention_reason_codes.includes("DECISION.NO_VALID_CANDIDATES"));
});

test("P0: same input + same rules produce el mismo fingerprint", () => {
  const input = base();
  assert.equal(
    fingerprintPrioritizationInput(input),
    fingerprintPrioritizationInput({ ...input, metadata: { request_id: "irrelevant" } }),
  );
});

test("P0: 0 sigue siendo un valor conocido en la entrada material", () => {
  const input = { ...base(), material_values: { value_at_risk: 0 } };
  assert.notEqual(fingerprintPrioritizationInput(input), fingerprintPrioritizationInput({ ...base(), material_values: {} }));
});

test("P0: rank y priority tier son campos distintos", () => {
  const parsed = prioritizationResultSchema.safeParse({
    ...evaluatePrioritizationRun(base()),
    run_status: "COMPLETED",
    decision_validity: "VALID",
    candidate_evaluation_refs: [{
      candidate_id: "candidate-1",
      candidate_type: "PROBLEM",
      rank: 1,
      priority_tier: "P1",
      classification: "immediate_attention",
      decision_confidence: "SUFFICIENT_TO_DECIDE",
      why_now: "Hay daño actual soportado.",
      why_before: "No existe otro candidato evaluado por encima.",
    }],
    rule_trace_refs: ["trace-1"],
    source_lineage_refs: ["lineage-1"],
  });

  assert.equal(parsed.success, true);
});

test("P0: ABSTAINED exige reason codes y FAILED no puede disfrazarse", () => {
  const abstained = prioritizationResultSchema.safeParse({
    ...evaluatePrioritizationRun({ ...base(), candidates: [] }),
    abstention_reason_codes: [],
  });
  const failed = prioritizationResultSchema.safeParse({
    ...evaluatePrioritizationRun({ ...base(), technical_error: "timeout" }),
    run_status: "ABSTAINED",
  });

  assert.equal(abstained.success, false);
  assert.equal(failed.success, false);
});

test("P0: los catálogos exponen los estados constitucionales", () => {
  assert.deepEqual(PRIORITIZATION_RUN_STATUSES, [
    "CREATED", "INPUT_INCOMPLETE", "READY", "EVALUATING", "COMPLETED",
    "ABSTAINED", "INVALIDATED", "FAILED",
  ]);
  assert.ok(DECISION_VALIDITIES.includes("STALE"));
});
