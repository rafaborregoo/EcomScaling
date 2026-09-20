import assert from "node:assert/strict";
import test from "node:test";
import {
  f7MatchingAssessmentsFromRows,
  f7PrioritizationAssessmentsFromRows,
  f7ImpactAssessmentsFromRows,
  f7FeasibilityAssessmentsFromRows,
  f7RiskAssessmentsFromRows,
  f7SequencingAssessmentsFromRows,
  f7TestExecuteAssessmentsFromRows,
  f7IntensityAssessmentsFromRows,
  f7MaturityAssessmentsFromRows,
  f7ConstraintAssessmentsFromRows,
  f7PortfolioAssessmentsFromRows,
  f7DynamicDecisionAssessmentsFromRows,
  f7RestraintDecisionAssessmentsFromRows,
  f7ExpectedOutcomeAssessmentsFromRows,
  f7RecommendationConfidenceAssessmentsFromRows,
  f7RecommendationCommunicationAssessmentsFromRows,
  f8HitlApprovalAssessmentsFromRows,
  latestAiAssessments,
  latestPlaybookAssessments,
} from "./ai-playbook-insights-api.js";

test("el feed F7.12 solo publica una cartera que requiere validacion", () => {
  const result = f7PortfolioAssessmentsFromRows([
    { disposition: "PORTFOLIO_AVAILABLE" },
    { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["aggregate_capacity"], reason_codes: ["PORTFOLIO.PRIMARY_OR_CAPACITY_REQUIRES_VALIDATION"] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_12_PORTFOLIO");
});

test("el feed F7.13 solo publica decisiones que requieren validacion", () => {
  const result = f7DynamicDecisionAssessmentsFromRows([
    { disposition: "DECISIONS_AVAILABLE" },
    { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["intervention_fidelity:checkout@1"], reason_codes: ["DYNAMIC.EVIDENCE_INCOMPLETE"] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_13_DYNAMIC_DECISION");
});

test("el feed F7.14 solo publica restraint decisions que requieren validacion", () => {
  const result = f7RestraintDecisionAssessmentsFromRows([{ disposition: "DECISION_AVAILABLE" }, { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["problem_materiality"], reason_codes: ["RESTRAINT.DECISION_CRITICAL_CONTEXT_UNKNOWN"] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_14_RESTRAINT_DECISION");
});

test("el feed F7.15 solo publica outcomes que requieren validacion", () => {
  const result = f7ExpectedOutcomeAssessmentsFromRows([{ disposition: "OUTCOME_CRITERIA_AVAILABLE" }, { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["current_baseline"], reason_codes: ["OUTCOME.CONTEXT_INCOMPLETE"] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_15_EXPECTED_OUTCOME");
});

test("el feed F7.17 solo publica confianza que requiere validacion", () => {
  const result = f7RecommendationConfidenceAssessmentsFromRows([{ disposition: "CONFIDENCE_AVAILABLE" }, { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["evidence_integrity"], reason_codes: ["CONFIDENCE.EVIDENCE_INVALID"] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_17_RECOMMENDATION_CONFIDENCE");
});

test("el feed F7.18 solo publica comunicación que requiere validación", () => {
  const result = f7RecommendationCommunicationAssessmentsFromRows([{ disposition: "COMMUNICATION_AVAILABLE" }, { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["main_uncertainty"], reason_codes: ["COMMUNICATION.DECISION_CONTEXT_UNKNOWN"] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_18_RECOMMENDATION_COMMUNICATION");
});

test("el feed F7.11 filtra recomendaciones bajo restricciones no disponibles", () => {
  const result = f7ConstraintAssessmentsFromRows([
    { disposition: "CONSTRAINT_RECOMMENDATIONS_AVAILABLE" },
    { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["binding_constraint"], reason_codes: ["CONSTRAINT.BINDING_REQUIRES_VALIDATION"] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_11_CONSTRAINTS");
});

test("el feed F7.10 filtra recomendaciones sin contexto suficiente", () => {
  const result = f7MaturityAssessmentsFromRows([
    { disposition: "MATURITY_RECOMMENDATIONS_AVAILABLE" },
    { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["maturity_profile"], reason_codes: ["MATURITY.READINESS_UNKNOWN"] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_10_MATURITY");
});

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

test("el feed F7.04 solo enseña impactos que requieren validación", () => {
  const result = f7ImpactAssessmentsFromRows([
    { disposition: "IMPACTS_AVAILABLE" },
    { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["counterfactual"], reason_codes: ["IMPACT.MECHANISM_MISSING"] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_04_IMPACT");
});

test("el feed F7.05 solo enseña factibilidad que requiere validación", () => {
  const result = f7FeasibilityAssessmentsFromRows([{ disposition: "FEASIBILITY_AVAILABLE" }, { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["developer:capacity"], reason_codes: ["RESOURCE.CONTEXT_UNKNOWN"] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_05_FEASIBILITY");
});

test("el feed F7.06 solo ensena riesgo que requiere validacion", () => {
  const result = f7RiskAssessmentsFromRows([{ disposition: "RISK_ASSESSMENTS_AVAILABLE" }, { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["reversibility"], reason_codes: ["REVERSIBILITY.UNKNOWN"] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_06_RISK");
});

test("el feed F7.07 solo enseña secuencias que requieren validación", () => {
  const result = f7SequencingAssessmentsFromRows([{ disposition: "SEQUENCES_AVAILABLE" }, { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["sequence_steps"], reason_codes: ["SEQUENCE.PATH_MISSING"] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_07_SEQUENCING");
});

test("el feed F7.08 solo enseña modos que requieren revisión", () => {
  const result = f7TestExecuteAssessmentsFromRows([
    { disposition: "DECISIONS_AVAILABLE", result: { candidate_evaluations: [{ recommended_mode: "DIRECT_EXECUTION" }] } },
    { disposition: "DECISIONS_AVAILABLE", result: { candidate_evaluations: [{ recommended_mode: "TEST" }] }, reason_codes: ["DECISION.TEST_LEARNING_VALUE"] },
    { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["measurement_capability"] },
  ]);
  assert.equal(result.length, 2);
  assert.ok(result.every((item) => item.domain === "F7_08_TEST_EXECUTE"));
});

test("el feed F7.09 solo enseña intensidad que requiere revisión", () => {
  const result = f7IntensityAssessmentsFromRows([{ disposition: "INTENSITY_PROFILES_AVAILABLE" }, { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["observability"], reason_codes: ["OBSERVABILITY.LIMITED"] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_09_INTENSITY");
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

test("el feed F7.03 solo enseña prioridades que requieren validación", () => {
  const result = f7PrioritizationAssessmentsFromRows([
    { disposition: "PRIORITY_AVAILABLE" },
    { disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["impact"], reason_codes: ["PRIORITY.ABSTAINED"] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F7_03_PRIORITIZATION");
});
