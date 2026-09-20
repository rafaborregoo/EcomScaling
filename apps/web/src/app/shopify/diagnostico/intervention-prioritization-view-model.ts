export type PrioritizationCandidateRow = {
  candidate_id: string;
  priority_tier?: string;
  reason_codes: string[];
  unresolved_unknowns: string[];
};

export type PrioritizationRunRow = {
  disposition: string;
  candidate_count: number;
  primary_priority_candidate_id?: string | null;
  unresolved_unknowns?: string[];
  result?: { candidate_evaluations?: PrioritizationCandidateRow[] };
};

export function interventionPrioritizationViewModel(run: PrioritizationRunRow | null | undefined) {
  const candidates = run?.result?.candidate_evaluations ?? [];
  return {
    disposition: run?.disposition ?? "SIN_EVALUACION",
    candidateCount: run?.candidate_count ?? candidates.length,
    primary: run?.primary_priority_candidate_id ?? null,
    unknowns: run?.unresolved_unknowns ?? [],
    candidates,
  };
}
