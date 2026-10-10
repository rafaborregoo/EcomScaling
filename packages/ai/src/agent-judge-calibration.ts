import { AGENT_EVAL_AGENT_CODES, type EvalAgentCode } from "./agent-eval-catalog.js";
import { AGENT_JUDGE_RUBRICS } from "./agent-judge.js";

export type JudgeGoldCriterionLabel = {
  criterion_id: string;
  score: number | null;
  status: "evaluable" | "no_evaluable";
  critical_failure: boolean;
};

export type JudgeGoldCase = {
  case_id: string;
  agent_code: EvalAgentCode;
  split: "development" | "calibration" | "holdout";
  provenance: "synthetic" | "anonymized_production";
  adjudication: {
    reviewer_ids: readonly string[];
    resolution: "agreement" | "adjudicated" | "pending";
    adjudicator_id?: string;
  };
  labels: readonly JudgeGoldCriterionLabel[];
};

export type JudgeCalibrationCaseResult = {
  case_id: string;
  agent_code: EvalAgentCode;
  criteria: readonly JudgeGoldCriterionLabel[];
};

export type JudgeCalibrationThresholds = {
  minimumHoldoutCasesPerAgent: number;
  minimumCriticalPositiveCasesPerAgent: number;
  minimumCriticalNegativeCasesPerAgent: number;
  minimumStatusAgreement: number;
  minimumWithinOneScoreRate: number;
  minimumCriticalRecall: number;
  maximumFalseCriticalRate: number;
};

export type JudgeAgentCalibration = {
  agent_code: EvalAgentCode;
  cases: number;
  criterion_labels: number;
  critical_positive_cases: number;
  critical_negative_cases: number;
  status_agreement: number | null;
  within_one_score_rate: number | null;
  mean_absolute_score_error: number | null;
  critical_recall: number | null;
  false_critical_rate: number | null;
  allowed: boolean;
  reasons: string[];
};

export type JudgeCalibrationReport = {
  dataset_version: string;
  split: "calibration" | "holdout";
  holdout_only: boolean;
  allowed: boolean;
  agents: Record<EvalAgentCode, JudgeAgentCalibration>;
};

const isScore = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 4;

function validateLabelSet(
  caseId: string,
  agentCode: EvalAgentCode,
  labels: readonly JudgeGoldCriterionLabel[],
): void {
  const rubric = AGENT_JUDGE_RUBRICS[agentCode];
  const actualIds = labels.map((label) => label.criterion_id);
  const expectedIds = rubric.map((criterion) => criterion.id);
  if (new Set(actualIds).size !== actualIds.length
    || actualIds.length !== expectedIds.length
    || expectedIds.some((id) => !actualIds.includes(id))) {
    throw new Error(`judge_calibration_criterion_set_mismatch:${caseId}`);
  }
  const criticalIds = new Set(rubric.filter((criterion) => criterion.critical).map((criterion) => criterion.id));
  for (const label of labels) {
    if (label.status === "evaluable" ? !isScore(label.score) : label.score !== null) {
      throw new Error(`judge_calibration_invalid_score:${caseId}:${label.criterion_id}`);
    }
    if (label.critical_failure && (!criticalIds.has(label.criterion_id) || label.status !== "evaluable" || (label.score ?? 4) > 1)) {
      throw new Error(`judge_calibration_invalid_critical_label:${caseId}:${label.criterion_id}`);
    }
  }
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/**
 * Evaluates the judge only against frozen, double-reviewed holdout labels.
 * Synthetic fixtures can exercise this calculation, but callers must keep
 * their provenance visible and must not treat them as production gold.
 */
export function evaluateAgentJudgeHoldout({
  datasetVersion,
  split = "holdout",
  goldCases,
  judgeResults,
  thresholds,
  requiredAgentCodes = AGENT_EVAL_AGENT_CODES,
  allowSyntheticCases = false,
}: {
  datasetVersion: string;
  split?: "calibration" | "holdout";
  goldCases: readonly JudgeGoldCase[];
  judgeResults: readonly JudgeCalibrationCaseResult[];
  thresholds: JudgeCalibrationThresholds;
  requiredAgentCodes?: readonly EvalAgentCode[];
  /** Only enabled by unit tests; release calibration must use approved cases. */
  allowSyntheticCases?: boolean;
}): JudgeCalibrationReport {
  if (!datasetVersion.trim()) throw new Error("judge_calibration_dataset_version_required");
  if (!Number.isInteger(thresholds.minimumHoldoutCasesPerAgent) || thresholds.minimumHoldoutCasesPerAgent < 1
    || !Number.isInteger(thresholds.minimumCriticalPositiveCasesPerAgent) || thresholds.minimumCriticalPositiveCasesPerAgent < 1
    || !Number.isInteger(thresholds.minimumCriticalNegativeCasesPerAgent) || thresholds.minimumCriticalNegativeCasesPerAgent < 1) {
    throw new Error("judge_calibration_minimum_cases_invalid");
  }
  const caseFloorKeys = new Set(["minimumHoldoutCasesPerAgent", "minimumCriticalPositiveCasesPerAgent", "minimumCriticalNegativeCasesPerAgent"]);
  for (const [key, value] of Object.entries(thresholds).filter(([key]) => !caseFloorKeys.has(key))) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`judge_calibration_threshold_invalid:${key}`);
  }

  const goldById = new Map<string, JudgeGoldCase>();
  for (const gold of goldCases) {
    if (gold.provenance === "synthetic" && !allowSyntheticCases) {
      throw new Error(`judge_calibration_synthetic_case_not_allowed:${gold.case_id}`);
    }
    if (gold.split !== split) throw new Error(`judge_calibration_split_mismatch:${gold.case_id}:${split}`);
    if (gold.adjudication.resolution === "pending" || gold.adjudication.reviewer_ids.length < 2
      || new Set(gold.adjudication.reviewer_ids).size < 2) {
      throw new Error(`judge_calibration_case_not_double_reviewed:${gold.case_id}`);
    }
    if (gold.adjudication.resolution === "adjudicated"
      && (!gold.adjudication.adjudicator_id || gold.adjudication.reviewer_ids.includes(gold.adjudication.adjudicator_id))) {
      throw new Error(`judge_calibration_adjudicator_required:${gold.case_id}`);
    }
    validateLabelSet(gold.case_id, gold.agent_code, gold.labels);
    if (goldById.has(gold.case_id)) throw new Error(`judge_calibration_duplicate_case:${gold.case_id}`);
    goldById.set(gold.case_id, gold);
  }

  const resultsById = new Map<string, JudgeCalibrationCaseResult>();
  for (const result of judgeResults) {
    if (resultsById.has(result.case_id)) throw new Error(`judge_calibration_duplicate_result:${result.case_id}`);
    validateLabelSet(result.case_id, result.agent_code, result.criteria);
    resultsById.set(result.case_id, result);
  }

  const agents = {} as Record<EvalAgentCode, JudgeAgentCalibration>;
  let allAllowed = true;
  for (const agentCode of AGENT_EVAL_AGENT_CODES) {
    const reasons: string[] = [];
    const cases = [...goldById.values()].filter((gold) => gold.agent_code === agentCode);
    if (!requiredAgentCodes.includes(agentCode)) {
      agents[agentCode] = {
        agent_code: agentCode, cases: cases.length, criterion_labels: 0,
        critical_positive_cases: 0, critical_negative_cases: 0,
        status_agreement: null, within_one_score_rate: null, mean_absolute_score_error: null,
        critical_recall: null, false_critical_rate: null, allowed: true, reasons: ["not_required_for_this_gate"],
      };
      continue;
    }
    if (cases.length < thresholds.minimumHoldoutCasesPerAgent) reasons.push(`holdout_cases_below_minimum:${cases.length}<${thresholds.minimumHoldoutCasesPerAgent}`);
    const criticalPositiveCases = cases.filter((gold) => gold.labels.some((label) => label.critical_failure)).length;
    const criticalNegativeCases = cases.length - criticalPositiveCases;
    if (criticalPositiveCases < thresholds.minimumCriticalPositiveCasesPerAgent) reasons.push(`critical_positive_cases_below_minimum:${criticalPositiveCases}<${thresholds.minimumCriticalPositiveCasesPerAgent}`);
    if (criticalNegativeCases < thresholds.minimumCriticalNegativeCasesPerAgent) reasons.push(`critical_negative_cases_below_minimum:${criticalNegativeCases}<${thresholds.minimumCriticalNegativeCasesPerAgent}`);

    let compared = 0;
    let statusMatches = 0;
    let numericCompared = 0;
    let withinOne = 0;
    let absoluteError = 0;
    let goldCritical = 0;
    let foundCritical = 0;
    let nonCriticalPredictions = 0;
    let falseCritical = 0;
    for (const gold of cases) {
      const result = resultsById.get(gold.case_id);
      if (!result || result.agent_code !== agentCode) {
        reasons.push(`judge_result_missing:${gold.case_id}`);
        continue;
      }
      const resultByCriterion = new Map(result.criteria.map((criterion) => [criterion.criterion_id, criterion]));
      for (const goldLabel of gold.labels) {
        const judged = resultByCriterion.get(goldLabel.criterion_id)!;
        compared += 1;
        if (goldLabel.status === judged.status) statusMatches += 1;
        if (goldLabel.status === "evaluable" && judged.status === "evaluable" && goldLabel.score !== null && judged.score !== null) {
          const error = Math.abs(goldLabel.score - judged.score);
          numericCompared += 1;
          absoluteError += error;
          if (error <= 1) withinOne += 1;
        }
        if (goldLabel.critical_failure) {
          goldCritical += 1;
          if (judged.critical_failure) foundCritical += 1;
        } else {
          nonCriticalPredictions += 1;
          if (judged.critical_failure) falseCritical += 1;
        }
      }
    }
    const metrics = {
      status_agreement: rate(statusMatches, compared),
      within_one_score_rate: rate(withinOne, numericCompared),
      mean_absolute_score_error: rate(absoluteError, numericCompared),
      critical_recall: rate(foundCritical, goldCritical),
      false_critical_rate: rate(falseCritical, nonCriticalPredictions),
    };
    if (metrics.status_agreement === null || metrics.status_agreement < thresholds.minimumStatusAgreement) reasons.push("status_agreement_below_minimum");
    if (metrics.within_one_score_rate === null || metrics.within_one_score_rate < thresholds.minimumWithinOneScoreRate) reasons.push("within_one_score_rate_below_minimum");
    if (metrics.critical_recall === null || metrics.critical_recall < thresholds.minimumCriticalRecall) reasons.push("critical_recall_below_minimum");
    if (metrics.false_critical_rate === null || metrics.false_critical_rate > thresholds.maximumFalseCriticalRate) reasons.push("false_critical_rate_above_maximum");
    const allowed = reasons.length === 0;
    allAllowed &&= allowed;
    agents[agentCode] = {
      agent_code: agentCode, cases: cases.length, criterion_labels: compared,
      critical_positive_cases: criticalPositiveCases,
      critical_negative_cases: criticalNegativeCases,
      ...metrics, allowed, reasons,
    };
  }
  for (const result of judgeResults) {
    if (!goldById.has(result.case_id)) throw new Error(`judge_calibration_result_without_gold:${result.case_id}`);
  }
  return { dataset_version: datasetVersion, split, holdout_only: split === "holdout", allowed: allAllowed, agents };
}
