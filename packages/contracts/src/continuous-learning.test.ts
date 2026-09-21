import test from "node:test";
import assert from "node:assert/strict";
import { F9_BLOCK_CODES, evaluateContinuousLearning, type LearningExperienceInput } from "./continuous-learning.js";

const base = (overrides: Partial<LearningExperienceInput> = {}): LearningExperienceInput => ({
  organization_id: "org-1", block_code: "9.12", experience_id: "exp-1", intervention_id: "int-1", recommendation_id: "rec-1", output_id: "out-1",
  business_context: { model: "DTC", market: "ES" }, problem_state: { symptom: "CAC" }, decision_context: { rationale: "test" }, planned_execution: { scope: "tenant" }, actual_execution: { status: "completed" }, environment: { seasonality: "unknown" }, constraints: [], observation_window: { start: "2026-01-01T00:00:00.000Z", end: "2026-01-14T00:00:00.000Z", horizon: "14d" }, expected_outcome: { primary: "CAC", direction: "DOWN" }, observed_outcome: { classification: "POSITIVE", magnitude: 0.1 }, evidence: { measurement_quality: "HIGH", attribution_strength: "HIGH", evidence_strength: "HIGH", sample_sufficient: true, confounders: [], source_refs: ["test"] }, source_refs: ["test"], unresolved_unknowns: [], ...overrides,
});

test("F9 contract covers every real block and excludes the documented non-block 9.21", () => {
  assert.equal(F9_BLOCK_CODES.length, 40);
  assert.ok(F9_BLOCK_CODES.includes("9.01"));
  assert.ok(F9_BLOCK_CODES.includes("9.41"));
  assert.ok(!F9_BLOCK_CODES.includes("9.21" as never));
});

test("positive learning needs evidence and execution, not merely an operational outcome", () => {
  const result = evaluateContinuousLearning(base());
  assert.equal(result.status, "READY");
  assert.equal(result.classification, "POSITIVE");
  assert.equal(result.gate, true);
});

test("SUCCESS operacional sin atribución no se promociona a POSITIVE causal", () => {
  const result = evaluateContinuousLearning(base({ observed_outcome: { operational_outcome: "SUCCESS" }, evidence: { measurement_quality: "UNKNOWN", attribution_strength: "UNKNOWN", evidence_strength: "UNKNOWN", sample_sufficient: false, confounders: [], source_refs: ["closure"] } }));
  assert.equal(result.classification, "INCONCLUSIVE");
  assert.equal(result.status, "WAITING_FOR_EVIDENCE");
  assert.equal(result.gate, false);
});

test("neutral and inconclusive remain distinct", () => {
  const neutral = evaluateContinuousLearning(base({ observed_outcome: { classification: "NEUTRAL" } }));
  const inconclusive = evaluateContinuousLearning(base({ observed_outcome: { classification: "INCONCLUSIVE" } }));
  assert.equal(neutral.classification, "NEUTRAL");
  assert.equal(inconclusive.classification, "INCONCLUSIVE");
  assert.equal(inconclusive.gate, false);
  assert.match(inconclusive.rationale.join(" "), /INCONCLUSIVE/);
});

test("confounders force evidence follow-up and mixed outcomes require review", () => {
  const result = evaluateContinuousLearning(base({ observed_outcome: { classification: "MIXED" }, evidence: { ...base().evidence, confounders: ["pricing_changed"] } }));
  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.equal(result.gate, true);
  assert.ok(result.next_evidence_needed.some((item) => item.includes("confusores")));
});
