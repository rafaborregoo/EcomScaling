export type MaturityRecommendationCandidate = {
  candidate_id: string;
  selected_intervention?: string;
  functional_maturity?: string;
  recommended_mode?: string;
  complexity_decision?: string;
  timing_fit?: string;
  current_recommendation?: string;
  deferred_recommendation?: string;
  not_yet_reason?: string | null;
  missing_capability?: string | null;
  capability_building_recommendation?: string | null;
  maturity_unlock?: string[];
  evidence_standard?: string;
  rationale?: string[];
  unresolved_unknowns?: string[];
};

export type MaturityRecommendationRun = {
  disposition: string;
  candidate_count: number;
  primary_priority_candidate_id?: string | null;
  unresolved_unknowns?: string[];
  result?: { candidate_evaluations?: MaturityRecommendationCandidate[] };
};

export function maturityRecommendationViewModel(run: MaturityRecommendationRun | null | undefined) {
  const candidates = run?.result?.candidate_evaluations ?? [];
  return { disposition: run?.disposition ?? "SIN_EVALUACION", candidateCount: run?.candidate_count ?? candidates.length, primary: run?.primary_priority_candidate_id ?? null, unknowns: run?.unresolved_unknowns ?? [], candidates };
}

export function recommendationTone(mode: string) {
  if (["BUILD_CAPABILITY_FIRST", "SIMPLIFY", "VALIDATE_CONTEXT"].includes(mode)) return "warn" as const;
  if (["COORDINATE_RESILIENCE", "PROTECT_MARGINAL_ECONOMICS"].includes(mode)) return "brand" as const;
  return mode === "LEARN_VALIDATE" ? "success" as const : "neutral" as const;
}
