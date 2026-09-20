export type FeasibilityCandidateRow = {
  candidate_id: string;
  disposition?: string;
  resource_trace?: { required_resources?: string[]; available_resources?: string[]; bottleneck_resources?: string[]; capability_gaps?: string[]; contention_refs?: string[] };
  cost_profile?: { direct?: string; recurring?: string; maintenance?: string; opportunity?: string };
  effort_profile?: { complexity?: string; workload?: string; coordination?: string };
  adaptations?: Array<{ kind: string; description: string; resource_burden?: string }>;
  alternatives?: Array<{ candidate_id: string; description: string; resource_burden?: string }>;
  reason_codes?: string[];
  unresolved_unknowns?: string[];
};
export type FeasibilityRunRow = { disposition: string; candidate_count: number; primary_priority_candidate_id?: string | null; unresolved_unknowns?: string[]; result?: { candidate_evaluations?: FeasibilityCandidateRow[] } };
export function interventionFeasibilityViewModel(run: FeasibilityRunRow | null | undefined) { const candidates = run?.result?.candidate_evaluations ?? []; return { disposition: run?.disposition ?? "SIN_EVALUACION", candidateCount: run?.candidate_count ?? candidates.length, primary: run?.primary_priority_candidate_id ?? null, unknowns: run?.unresolved_unknowns ?? [], candidates }; }
