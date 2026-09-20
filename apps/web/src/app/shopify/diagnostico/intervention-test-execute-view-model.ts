export type TestExecuteCandidateRow = {
  candidate_id: string;
  candidate_intervention?: string;
  recommended_mode?: string;
  rationale?: string[];
  hypothesis?: string;
  learning_question?: string;
  primary_outcome?: string;
  guardrail_outcomes?: string[];
  measurement_requirement?: string;
  exposure_mode?: string;
  pilot_scope?: string;
  observation_requirement?: string;
  observation_state?: string;
  evidence_reuse?: string;
  transferability_caveat?: string;
  experiment_cost?: string;
  experimentability?: string;
  contamination?: string[];
  decision_after_result?: string[];
  unresolved_unknowns?: string[];
  reason_codes?: string[];
  execution_authorized?: boolean;
};
export type TestExecuteRunRow = { disposition: string; candidate_count: number; primary_priority_candidate_id?: string | null; unresolved_unknowns?: string[]; result?: { candidate_evaluations?: TestExecuteCandidateRow[] } };
export function interventionTestExecuteViewModel(run: TestExecuteRunRow | null | undefined) { const candidates = run?.result?.candidate_evaluations ?? []; return { disposition: run?.disposition ?? "SIN_EVALUACION", candidateCount: run?.candidate_count ?? candidates.length, primary: run?.primary_priority_candidate_id ?? null, unknowns: run?.unresolved_unknowns ?? [], candidates }; }
