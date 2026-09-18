import assert from "node:assert/strict";
import test from "node:test";
import {
  f7MatchingAssessmentsFromRows,
  latestAiAssessments,
  latestPlaybookAssessments,
} from "./ai-playbook-insights-api.js";

test("el feed transversal conserva solo el último assessment por dominio", () => {
  const result = latestPlaybookAssessments([
    { domain: "SCALABILITY", disposition: "VALIDATION_REQUIRED" },
    { domain: "SCALABILITY", disposition: "BLOCKED" },
    { domain: "ACQUISITION", disposition: "REASSESS_DIAGNOSIS" },
  ]);

  assert.deepEqual(result, [
    { domain: "SCALABILITY", disposition: "VALIDATION_REQUIRED" },
    { domain: "ACQUISITION", disposition: "REASSESS_DIAGNOSIS" },
  ]);
});

test("el feed F3 solo publica revisiones que el Copiloto debe enseñar", () => {
  const result = latestAiAssessments([
    {
      domain: "F3_D12_ADVERSARIAL",
      disposition: "REASSESS_DIAGNOSIS",
      case_id: "case-1",
      store_id: "store-1",
      reason_codes: ["false_diagnosis_risk_high"],
    },
    {
      domain: "F3_D13_TEMPORAL",
      disposition: "VALIDATION_REQUIRED",
      case_id: "case-2",
      reason_codes: ["trajectory_unknown"],
    },
    {
      domain: "F3_D14_OUTPUT",
      disposition: "VALIDATION_REQUIRED",
      case_id: "case-3",
      reason_codes: ["invalid_output"],
    },
    {
      domain: "F3_D14_OUTPUT",
      disposition: "VALIDATION_REQUIRED",
      case_id: "case-4",
      reason_codes: ["older"],
    },
  ]);

  assert.deepEqual(result.map((item) => item.domain), [
    "F3_D12_ADVERSARIAL",
    "F3_D13_TEMPORAL",
    "F3_D14_OUTPUT",
  ]);
  assert.equal(result[0]?.store_id, "store-1");
});

test("el feed F7.02 solo enseña matching que requiere validación", () => {
  const result = f7MatchingAssessmentsFromRows([
    { disposition: "MATCHES_AVAILABLE", evaluated_at: "2026-09-18T10:00:00.000Z" },
    { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["problem_refs"], reason_codes: ["PROBLEM.UNKNOWN"] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_02_MATCHING");
  assert.equal(result[0]?.disposition, "VALIDATION_REQUIRED");
});
