import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_JUDGE_RUBRICS, evaluateAgentJudgeHoldout, type JudgeGoldCase, type JudgeCalibrationCaseResult } from "./index.js";

const code = "a01_analista_llamadas" as const;
const thresholds = {
  minimumHoldoutCasesPerAgent: 1,
  minimumCriticalPositiveCasesPerAgent: 1,
  minimumCriticalNegativeCasesPerAgent: 1,
  minimumStatusAgreement: 0.95,
  minimumWithinOneScoreRate: 0.95,
  minimumCriticalRecall: 1,
  maximumFalseCriticalRate: 0.02,
};

function example(missCritical = false): { gold: JudgeGoldCase; judged: JudgeCalibrationCaseResult } {
  const rubric = AGENT_JUDGE_RUBRICS[code];
  const criticalId = rubric.find((criterion) => criterion.critical)!.id;
  const labels = rubric.map((criterion) => ({
    criterion_id: criterion.id,
    score: criterion.id === criticalId ? 1 : 4,
    status: "evaluable" as const,
    critical_failure: criterion.id === criticalId,
  }));
  const predictions = labels.map((label) => ({
    ...label,
    critical_failure: missCritical ? false : label.critical_failure,
  }));
  return {
    gold: {
    case_id: "a01-critical-transcript-invention-001",
      agent_code: code,
      split: "holdout",
      provenance: "synthetic",
      adjudication: { reviewer_ids: ["reviewer-a", "reviewer-b"], resolution: "agreement" },
    labels,
    },
    judged: { case_id: "a01-critical-transcript-invention-001", agent_code: code, criteria: predictions },
  };
}

function neutralCase(gold: JudgeGoldCase, judged: JudgeCalibrationCaseResult) {
  const caseId = `${gold.case_id}-negative`;
  return {
    gold: { ...gold, case_id: caseId, labels: gold.labels.map((label) => ({ ...label, score: 4, critical_failure: false })) },
    judged: { ...judged, case_id: caseId, criteria: judged.criteria.map((label) => ({ ...label, score: 4, critical_failure: false })) },
  };
}

test("gold holdout calibration computes per-agent agreement and critical safety rates", () => {
  const { gold, judged } = example();
  const neutral = neutralCase(gold, judged);
  const report = evaluateAgentJudgeHoldout({
    datasetVersion: "judge-gold-test.v1",
    goldCases: [gold, neutral.gold],
    judgeResults: [judged, neutral.judged],
    thresholds,
    requiredAgentCodes: [code],
    allowSyntheticCases: true,
  });
  assert.equal(report.allowed, true);
  assert.equal(report.split, "holdout");
  assert.equal(report.holdout_only, true);
  assert.equal(report.agents[code].status_agreement, 1);
  assert.equal(report.agents[code].critical_recall, 1);
  assert.equal(report.agents[code].false_critical_rate, 0);
  assert.equal(report.agents[code].critical_positive_cases, 1);
  assert.equal(report.agents[code].critical_negative_cases, 1);
  assert.equal(report.agents["a02_monitor_negocio"].allowed, true);
});

test("holdout gate blocks a missed critical label and missing per-agent sample coverage", () => {
  const { gold, judged } = example(true);
  const neutral = neutralCase(gold, judged);
  const report = evaluateAgentJudgeHoldout({
    datasetVersion: "judge-gold-test.v1",
    goldCases: [gold, neutral.gold],
    judgeResults: [judged, neutral.judged],
    thresholds: { ...thresholds, minimumCriticalNegativeCasesPerAgent: 2 },
    requiredAgentCodes: [code, "a02_monitor_negocio"],
    allowSyntheticCases: true,
  });
  assert.equal(report.allowed, false);
  assert.ok(report.agents[code].reasons.includes("critical_recall_below_minimum"));
  assert.ok(report.agents[code].reasons.includes("critical_negative_cases_below_minimum:1<2"));
  assert.ok(report.agents["a02_monitor_negocio"].reasons.includes("holdout_cases_below_minimum:0<1"));
});

test("calibration refuses unreviewed, wrong-split and incomplete rubric data", () => {
  const { gold, judged } = example();
  assert.throws(() => evaluateAgentJudgeHoldout({
    datasetVersion: "v1", goldCases: [{ ...gold, adjudication: { reviewer_ids: ["only-one"], resolution: "pending" } }],
    judgeResults: [judged], thresholds, requiredAgentCodes: [code], allowSyntheticCases: true,
  }), /case_not_double_reviewed/);
  assert.throws(() => evaluateAgentJudgeHoldout({
    datasetVersion: "v1", goldCases: [{ ...gold, split: "calibration" }],
    judgeResults: [judged], thresholds, requiredAgentCodes: [code], allowSyntheticCases: true,
  }), /split_mismatch/);
  assert.throws(() => evaluateAgentJudgeHoldout({
    datasetVersion: "v1", goldCases: [{ ...gold, labels: gold.labels.slice(1) }],
    judgeResults: [judged], thresholds, requiredAgentCodes: [code], allowSyntheticCases: true,
  }), /criterion_set_mismatch/);
  assert.throws(() => evaluateAgentJudgeHoldout({
    datasetVersion: "v1", goldCases: [gold], judgeResults: [judged],
    thresholds, requiredAgentCodes: [code],
  }), /synthetic_case_not_allowed/);
});

test("calibration split can be evaluated repeatedly without becoming a holdout certification", () => {
  const { gold, judged } = example();
  const neutral = neutralCase(gold, judged);
  const report = evaluateAgentJudgeHoldout({
    datasetVersion: "judge-calibration-test.v1",
    split: "calibration",
    goldCases: [{ ...gold, split: "calibration" }, { ...neutral.gold, split: "calibration" }],
    judgeResults: [judged, neutral.judged],
    thresholds,
    requiredAgentCodes: [code],
    allowSyntheticCases: true,
  });
  assert.equal(report.allowed, true);
  assert.equal(report.split, "calibration");
  assert.equal(report.holdout_only, false);
});
