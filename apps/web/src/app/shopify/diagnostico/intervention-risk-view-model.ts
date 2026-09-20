export type RiskCandidateRow = {
  candidate_id: string;
  disposition?: string;
  potential_upside?: string[];
  potential_downside?: string[];
  blast_radius?: { scope?: string[]; level?: string };
  reversibility_profile?: { can_revert?: string; reversal_delay?: string; reversal_cost?: string; residual_damage?: string };
  cost_of_error?: { severity?: string; action?: string; delay?: string; failure?: string; rollback?: string; residual?: string };
  failure_modes?: string[];
  de_risking_actions?: string[];
  risk_trace?: { exposure?: string[]; inaction_risk?: string[]; de_risking?: string[] };
  unresolved_unknowns?: string[];
  reason_codes?: string[];
};
export type RiskRunRow = { disposition: string; candidate_count: number; primary_priority_candidate_id?: string | null; unresolved_unknowns?: string[]; result?: { candidate_evaluations?: RiskCandidateRow[] } };
export function interventionRiskViewModel(run: RiskRunRow | null | undefined) { const candidates = run?.result?.candidate_evaluations ?? []; return { disposition: run?.disposition ?? "SIN_EVALUACION", candidateCount: run?.candidate_count ?? candidates.length, primary: run?.primary_priority_candidate_id ?? null, unknowns: run?.unresolved_unknowns ?? [], candidates }; }
