export type PortfolioCandidate = {
  candidate_id: string;
  role?: string;
  selection_status?: string;
  sequence_position?: string;
  role_reason?: string;
  intervention?: string;
  expected_outcome?: string;
  shared_resources?: string[];
  dependencies?: string[];
};
export type RecommendationPortfolioRun = {
  disposition: string;
  candidate_count?: number;
  primary_candidate_id?: string | null;
  unresolved_unknowns?: string[];
  result?: {
    primary_candidate_id?: string | null;
    portfolio_feasibility?: string;
    portfolio_risk?: string;
    portfolio_narrative?: string;
    active_candidate_ids?: string[];
    deferred_candidate_ids?: string[];
    excluded_candidate_ids?: string[];
    explicit_exclusions?: string[];
    sequence?: string[];
    conditional_branches?: string[];
    aggregate_resource_load?: string[];
    candidate_evaluations?: PortfolioCandidate[];
  };
};

export function recommendationPortfolioViewModel(run: RecommendationPortfolioRun | null | undefined) {
  const candidates = run?.result?.candidate_evaluations ?? [];
  return {
    disposition: run?.disposition ?? "SIN_EVALUACION",
    candidateCount: run?.candidate_count ?? candidates.length,
    primaryCandidateId: run?.primary_candidate_id ?? run?.result?.primary_candidate_id ?? null,
    portfolioFeasibility: run?.result?.portfolio_feasibility ?? "UNKNOWN",
    portfolioRisk: run?.result?.portfolio_risk ?? "UNKNOWN",
    narrative: run?.result?.portfolio_narrative ?? "No hay narrativa de cartera disponible.",
    activeCandidates: candidates.filter((candidate) => candidate.selection_status === "ACTIVE"),
    deferredCandidates: candidates.filter((candidate) => candidate.selection_status === "DEFERRED"),
    excludedCandidates: candidates.filter((candidate) => candidate.selection_status === "EXCLUDED"),
    sequence: run?.result?.sequence ?? [],
    conditionalBranches: run?.result?.conditional_branches ?? [],
    aggregateResourceLoad: run?.result?.aggregate_resource_load ?? [],
    explicitExclusions: run?.result?.explicit_exclusions ?? [],
    unknowns: run?.unresolved_unknowns ?? [],
  };
}

export function portfolioRoleTone(role: string) {
  if (role === "PRIMARY") return "brand" as const;
  if (role === "ENABLING" || role === "SUPPORTING") return "success" as const;
  if (role === "DEFERRED") return "warn" as const;
  if (role === "EXCLUDED") return "danger" as const;
  return "neutral" as const;
}
