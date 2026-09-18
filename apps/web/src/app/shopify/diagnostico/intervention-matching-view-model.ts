export type MatchingCandidateRow = {
  candidate_id: string;
  disposition: string;
  causal_chain: {
    problem_refs: string[];
    driver_refs: string[];
    cause_refs: string[];
    mechanism_refs: string[];
    lever_refs: string[];
  };
  supporting_signal_refs: string[];
  disconfirming_signal_refs: string[];
  discriminating_evidence_refs: string[];
  reason_codes: string[];
  unresolved_unknowns: string[];
};

export type MatchingRunRow = {
  disposition: string;
  candidate_count: number;
  matched_count: number;
  unresolved_unknowns?: string[];
  result?: { candidate_evaluations?: MatchingCandidateRow[] };
};

export function interventionMatchingViewModel(
  run: MatchingRunRow | null | undefined,
) {
  const candidates = run?.result?.candidate_evaluations ?? [];
  return {
    disposition: run?.disposition ?? "SIN_EVALUACION",
    candidateCount: run?.candidate_count ?? candidates.length,
    matchedCount: run?.matched_count ?? 0,
    unknowns: run?.unresolved_unknowns ?? [],
    candidates,
  };
}
