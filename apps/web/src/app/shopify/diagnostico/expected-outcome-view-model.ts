export type ExpectedOutcomeRun = {
  disposition: string;
  scope?: string;
  unresolved_unknowns?: string[];
  result?: Partial<{
    causal_thesis: string; recommendation: string; mechanism_outcome: string[]; behavior_system_outcome: string[]; business_outcome: string[]; strategic_outcome: string[]; direction: string; magnitude: string; outcome_confidence: string; outcome_horizon: string; direct_outcome: string[]; indirect_outcome: string[]; known_downside: string[]; primary_success_criterion: string; mechanism_evidence: string[]; guardrails: string[]; materiality: string; baseline_counterfactual: string; incrementality: string; economic_meaning: string; sustainability: string; repeatability: string; scalability: string; durability: string; adoption_fidelity: string; maintenance_cost: string; failure_evidence: string[]; ambiguous_evidence: string[]; scale_criterion: string; continue_criterion: string; stop_criterion: string; rollback_criterion: string; evaluation_level: string; completion_condition: string; graduation_condition: string; quality_flags: string[]; execution_authorized: false;
  }>;
};

const text = (value: string | undefined, fallback = "No declarado") => value || fallback;
const list = (value: string[] | undefined) => value?.filter(Boolean) ?? [];

export function expectedOutcomeViewModel(run: ExpectedOutcomeRun | null | undefined) {
  const result = run?.result;
  return {
    disposition: run?.disposition ?? "SIN_EVALUACION", scope: text(run?.scope, "Todas las recomendaciones"), causalThesis: text(result?.causal_thesis, "No hay tesis causal disponible."), recommendation: text(result?.recommendation), mechanismOutcome: list(result?.mechanism_outcome), behaviorSystemOutcome: list(result?.behavior_system_outcome), businessOutcome: list(result?.business_outcome), strategicOutcome: list(result?.strategic_outcome), direction: text(result?.direction), magnitude: text(result?.magnitude), confidence: text(result?.outcome_confidence), horizon: text(result?.outcome_horizon), directOutcome: list(result?.direct_outcome), indirectOutcome: list(result?.indirect_outcome), knownDownside: list(result?.known_downside), primarySuccessCriterion: text(result?.primary_success_criterion), mechanismEvidence: list(result?.mechanism_evidence), guardrails: list(result?.guardrails), materiality: text(result?.materiality), baselineCounterfactual: text(result?.baseline_counterfactual), incrementality: text(result?.incrementality), economicMeaning: text(result?.economic_meaning), sustainability: text(result?.sustainability), repeatability: text(result?.repeatability), scalability: text(result?.scalability), durability: text(result?.durability), adoptionFidelity: text(result?.adoption_fidelity), maintenanceCost: text(result?.maintenance_cost), failureEvidence: list(result?.failure_evidence), ambiguousEvidence: list(result?.ambiguous_evidence), scaleCriterion: text(result?.scale_criterion), continueCriterion: text(result?.continue_criterion), stopCriterion: text(result?.stop_criterion), rollbackCriterion: text(result?.rollback_criterion), evaluationLevel: text(result?.evaluation_level), completionCondition: text(result?.completion_condition), graduationCondition: text(result?.graduation_condition), qualityFlags: list(result?.quality_flags), unknowns: list(run?.unresolved_unknowns), executionAuthorized: false as const,
  };
}

export function expectedOutcomeTone(disposition: string) { if (disposition === "OUTCOME_CRITERIA_AVAILABLE") return "success" as const; if (disposition === "VALIDATION_REQUIRED") return "warn" as const; return "neutral" as const; }
