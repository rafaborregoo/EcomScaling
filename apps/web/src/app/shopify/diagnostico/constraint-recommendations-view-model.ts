export type ConstraintRecommendationCandidate = {
  candidate_id: string;
  desired_intervention?: string;
  binding_constraint?: string;
  critical_constraint?: string;
  recommended_mode?: string;
  feasibility_disposition?: string;
  timing_fit?: string;
  best_feasible_recommendation?: string;
  minimum_viable_intervention?: string | null;
  alternative_mechanism?: string | null;
  enabling_recommendation?: string | null;
  deferred_action?: string;
  activation_trigger?: string;
  expected_outcome_adjustment?: string;
  feasibility_confidence?: string;
  next_constraint_to_monitor?: string;
  rationale?: string[];
  unresolved_unknowns?: string[];
};
export type ConstraintRecommendationRun = { disposition: string; candidate_count: number; unresolved_unknowns?: string[]; result?: { candidate_evaluations?: ConstraintRecommendationCandidate[] } };

export function constraintRecommendationViewModel(run: ConstraintRecommendationRun | null | undefined) {
  const candidates = (run?.result?.candidate_evaluations ?? []).map((candidate) => ({
    ...candidate,
    criticalConstraint: candidate.critical_constraint ?? candidate.binding_constraint ?? "No declarada",
    bestFeasible: candidate.best_feasible_recommendation ?? "No declarada",
    deferredAction: candidate.deferred_action ?? "No declarada",
    nextConstraint: candidate.next_constraint_to_monitor ?? "No declarada",
  }));
  return { disposition: run?.disposition ?? "SIN_EVALUACION", candidateCount: run?.candidate_count ?? candidates.length, unknowns: run?.unresolved_unknowns ?? [], candidates };
}

export function recommendationTone(mode: string) {
  if (mode === "BLOCKED_BY_HARD_CONSTRAINT") return "danger" as const;
  if (["VALIDATE_CONSTRAINT", "WAIT_PREPARE", "PROTECT_SUCCESS_CAPACITY"].includes(mode)) return "warn" as const;
  if (["REALLOCATE", "SUBSTITUTE_MECHANISM", "RESEQUENCE"].includes(mode)) return "brand" as const;
  return mode === "PROCEED_WITH_ADAPTATION" ? "success" as const : "neutral" as const;
}
