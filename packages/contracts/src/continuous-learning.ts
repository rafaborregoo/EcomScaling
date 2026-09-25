/**
 * Fase 9: aprendizaje continuo. 9.21 no existe: el indice canonico lo marca
 * como bloque inexistente.
 *
 * Hasta el 2026-09-25 los 40 bloques pasaban por un unico evaluador generico.
 * Ahora cada bloque tiene el suyo (learning-blocks-*.ts) sobre una foto comun
 * (learning-snapshot.ts). Este fichero solo los ordena: primero los que leen
 * datos y despues los que componen a los demas (9.30, 9.31, 9.40, 9.41, 9.00).
 */
import {
  evaluateCausalAttribution,
  evaluateConfounders,
  evaluateEvidenceQuality,
  evaluateEvidenceStrength,
  evaluateExecutionFidelity,
  evaluateExperienceUnit,
  evaluateLearningConfidence,
  evaluateOutcomeClassification,
  evaluateOutcomeMaturity,
} from "./learning-blocks-evidence.js";
import {
  evaluateAutonomyLearning,
  evaluateBenchmarkCalibration,
  evaluateHumanOverride,
  evaluateIncidentLearning,
  evaluateOperationalFriction,
  evaluatePlaybookLearning,
  evaluatePrioritizationLearning,
  evaluateRecommendationLearning,
} from "./learning-blocks-domain.js";
import {
  evaluateAntiLearning,
  evaluateContextualLearning,
  evaluateDangerousFeedbackLoops,
  evaluateDecayDrift,
  evaluateExplorationExploitation,
  evaluateForgettingWithdrawal,
  evaluateGeneralizationBoundary,
  evaluateKnowledgePromotion,
  evaluateLearningContradictions,
  evaluateLearningLoops,
  evaluateLongTermLearning,
  evaluateSupersession,
} from "./learning-blocks-knowledge.js";
import {
  evaluateCohortLearning,
  evaluateExplainableLearning,
  evaluateFrameworkEngine,
  evaluateGlobalVsTenant,
  evaluateLearningGovernance,
  evaluateLearningTraceability,
  evaluateMetaLearning,
  evaluatePrivacyIsolation,
  evaluateStrategicLearning,
  evaluateTransferLearning,
  evaluateUniversalFramework,
} from "./learning-blocks-governance.js";
import { F9_BLOCK_CODES, type F9BlockCode, type LearningBlockResult, type LearningSnapshot } from "./learning-snapshot.js";

export {
  F9_BLOCK_CODES,
  LEARNING_CLASSIFICATIONS,
  LEARNING_CONFIDENCE,
  LEARNING_STATUSES,
  type F9BlockCode,
  type LearningClassification,
  type LearningConfidence,
  type LearningStatus,
} from "./learning-snapshot.js";

const DATA_BLOCKS: Array<(s: LearningSnapshot) => LearningBlockResult> = [
  evaluateExperienceUnit, evaluateExecutionFidelity, evaluateEvidenceQuality, evaluateCausalAttribution,
  evaluateConfounders, evaluateEvidenceStrength, evaluateOutcomeMaturity, evaluateLearningConfidence,
  evaluateGeneralizationBoundary, evaluateContextualLearning, evaluateOutcomeClassification,
  evaluateIncidentLearning, evaluateHumanOverride, evaluateRecommendationLearning, evaluatePrioritizationLearning,
  evaluatePlaybookLearning, evaluateBenchmarkCalibration, evaluateAutonomyLearning, evaluateOperationalFriction,
  evaluateLearningContradictions, evaluateDecayDrift, evaluateExplorationExploitation, evaluateLearningLoops,
  evaluateKnowledgePromotion, evaluateSupersession, evaluateAntiLearning, evaluateDangerousFeedbackLoops,
  evaluateLearningTraceability, evaluateForgettingWithdrawal, evaluateTransferLearning, evaluateCohortLearning,
  evaluateGlobalVsTenant, evaluatePrivacyIsolation, evaluateLongTermLearning, evaluateStrategicLearning,
];

const COMPOSED: Array<(s: LearningSnapshot, r: Map<F9BlockCode, LearningBlockResult>) => LearningBlockResult> = [
  evaluateLearningGovernance, evaluateExplainableLearning, evaluateMetaLearning, evaluateFrameworkEngine, evaluateUniversalFramework,
];

/** Los 40 bloques de F9 sobre una foto, en el orden de F9_BLOCK_CODES. */
export function evaluateLearningBlocks(snapshot: LearningSnapshot): LearningBlockResult[] {
  const results = new Map<F9BlockCode, LearningBlockResult>();
  for (const evaluate of DATA_BLOCKS) {
    const r = evaluate(snapshot);
    results.set(r.block, r);
  }
  for (const evaluate of COMPOSED) {
    const r = evaluate(snapshot, results);
    results.set(r.block, r);
  }
  return F9_BLOCK_CODES.map((code) => {
    const r = results.get(code);
    if (!r) throw new Error(`f9_block_without_evaluator:${code}`);
    return r;
  });
}
