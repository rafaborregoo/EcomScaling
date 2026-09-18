export type EligibilityCandidateRow = {
  candidate_id: string;
  disposition: string;
  reason_codes: string[];
  conditions: string[];
  blockers: string[];
  unresolved_unknowns: string[];
};

export type EligibilityRunRow = {
  disposition: string;
  candidate_count: number;
  eligible_count: number;
  unresolved_unknowns?: string[];
  reason_codes?: string[];
  result?: { candidate_evaluations?: EligibilityCandidateRow[] };
};

export function interventionEligibilityViewModel(
  run: EligibilityRunRow | null | undefined,
) {
  const candidates = run?.result?.candidate_evaluations ?? [];
  return {
    disposition: run?.disposition ?? "SIN_EVALUACION",
    candidateCount: run?.candidate_count ?? candidates.length,
    eligibleCount: run?.eligible_count ?? 0,
    unknowns: run?.unresolved_unknowns ?? [],
    reasons: run?.reason_codes ?? [],
    candidates,
  };
}
