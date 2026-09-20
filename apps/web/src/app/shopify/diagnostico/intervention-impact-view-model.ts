export type ImpactCandidateRow = {
  candidate_id: string;
  disposition?: string;
  primary_effect?: string;
  impact_trace?: { mechanism_refs?: string[]; leading_indicator_refs?: string[]; business_outcome_refs?: string[]; economic_outcome_refs?: string[] };
  magnitude_qualitative?: string;
  time_to_signal?: string;
  durability?: string;
  reason_codes?: string[];
  unknowns?: string[];
};

export type ImpactRunRow = { disposition: string; candidate_count: number; primary_priority_candidate_id?: string | null; unresolved_unknowns?: string[]; result?: { candidate_evaluations?: ImpactCandidateRow[] } };

export function interventionImpactViewModel(run: ImpactRunRow | null | undefined) {
  const candidates = run?.result?.candidate_evaluations ?? [];
  return { disposition: run?.disposition ?? "SIN_EVALUACION", candidateCount: run?.candidate_count ?? candidates.length, primary: run?.primary_priority_candidate_id ?? null, unknowns: run?.unresolved_unknowns ?? [], candidates };
}
