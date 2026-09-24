import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsultantChatContextBlock = {
  label: string;
  data: unknown;
};

export type ConsultantChatHistoryEntry = {
  role: string;
  content: string;
};

/**
 * Compone el contexto completo que recibe el Copiloto.
 *
 * La vista y el historial explican la pregunta; las restricciones y los
 * snapshots F3-F9 aportan evidencia estructurada. Mantener esta composición
 * en una función pura evita que el endpoint de chat pueda olvidar una fase
 * aunque el cargador de snapshots siga funcionando por separado.
 */
export function buildConsultantChatContextBlocks(input: {
  view: unknown | null;
  history: readonly ConsultantChatHistoryEntry[];
  constraintBlocks: readonly ConsultantChatContextBlock[];
  decisionPlaybookBlocks: readonly ConsultantChatContextBlock[];
}): ConsultantChatContextBlock[] {
  return [
    ...(input.view
      ? [
          {
            label:
              "Vista actual del consultor en el panel (contexto de la pregunta, no es una fuente de datos verificada)",
            data: input.view,
          },
        ]
      : []),
    ...(input.history.length > 0
      ? [
          {
            label: "Conversacion previa (mas reciente al final)",
            data: input.history.map((entry) => ({
              role: entry.role,
              content: entry.content,
            })),
          },
        ]
      : []),
    ...input.constraintBlocks,
    ...input.decisionPlaybookBlocks,
  ];
}

type Row = Record<string, unknown>;

function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 20)
    : [];
}

function text(value: unknown, fallback = "UNKNOWN"): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function tenantRows(value: unknown, organizationId: string): unknown[] {
  return Array.isArray(value)
    ? value.filter((row) => record(row).organization_id === organizationId)
    : [];
}

function tenantRow(value: unknown, organizationId: string): unknown | undefined {
  return record(value).organization_id === organizationId ? value : undefined;
}

function triStateFacts(value: unknown): Row {
  return Object.fromEntries(
    Object.entries(record(value))
      .filter(([, item]) => item === "TRUE" || item === "FALSE" || item === "UNKNOWN")
      .slice(0, 80),
  );
}

export function summarizeDecisionContext(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  return {
    status: text(item.context_status ?? result.context_status),
    confidence: text(item.context_confidence ?? result.context_confidence),
    primary_objective_kind: text(
      item.primary_objective_kind ?? result.primary_objective_kind,
      "not_declared",
    ),
    primary_objective_statement: text(
      item.primary_objective_statement ?? result.primary_objective_statement,
      "not_declared",
    ),
    unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    as_of: text(item.as_of, "unknown_date"),
  };
}

export function summarizeDecisionOutput(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  return {
    status: text(item.decision_status ?? result.decision_status),
    decision_type: text(result.decision_type, "UNKNOWN"),
    confidence: text(result.decision_confidence),
    diagnosis_confidence: text(result.diagnosis_confidence),
    causal_confidence: text(result.causal_confidence),
    candidate_ref: text(item.candidate_ref, "unknown_candidate"),
    rationale: text(result.rationale, "not_declared"),
    rank: typeof result.rank === "number" ? result.rank : null,
    tradeoffs: strings(result.tradeoffs),
    critical_assumptions: strings(result.critical_assumptions),
    unknowns: strings(result.unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    evidence_refs: strings(result.evidence_refs),
    review_trigger: text(result.review_trigger, "not_declared"),
    as_of: text(item.as_of, "unknown_date"),
  };
}

export function summarizePlaybookRun(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  const selected = record(result.selected_instance);
  const envelope = record(item.input_envelope);
  const context = record(envelope.context);
  return {
    domain: text(item.domain),
    disposition: text(item.disposition),
    candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : 0,
    selected_instance_id:
      typeof item.selected_instance_id === "string" ? item.selected_instance_id : null,
    selected_playbook_id:
      typeof selected.playbook_id === "string" ? selected.playbook_id : null,
    selected_intervention_type: text(selected.intervention_type, "not_selected"),
    validation_requirements: strings(selected.validation_requirements),
    stop_conditions: strings(selected.stop_conditions),
    unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    source_refs: strings(item.source_refs ?? result.source_refs),
    context_facts: triStateFacts(context.facts),
    context_evidence_refs: strings(context.evidence_refs),
    context_source_versions: strings(context.source_versions),
    context_as_of: text(context.as_of, "unknown_date"),
    as_of: text(item.as_of, "unknown_date"),
  };
}

export function summarizeDiagnosticOutput(row: unknown): Row {
  const item = record(row);
  return {
    case_id: text(item.case_id, "unknown_case"),
    status: text(item.finalization_status ?? item.status),
    completeness: text(item.completeness_status),
    confidence: text(item.confidence),
    confidence_language: text(item.confidence_language),
    blocking_components: strings(item.blocking_components),
    missing_components: strings(item.missing_components),
    diagnostic_summary: text(item.diagnostic_summary, "not_declared"),
    limitation_summary: text(item.limitation_summary, "not_declared"),
    confidence_summary: text(item.confidence_summary, "not_declared"),
    data_gap_summary: text(item.data_gap_summary, "not_declared"),
    manual_review_required: item.manual_review_required === true,
    handoff_ready: item.handoff_ready === true,
    failure_kind: text(item.failure_kind, "none"),
    degraded: item.degraded === true,
    evaluated_at: text(item.evaluated_at, "unknown_date"),
  };
}

export function summarizeDiagnosticCase(row: unknown): Row {
  const item = record(row);
  return {
    case_id: text(item.id, "unknown_case"),
    store_id: typeof item.store_id === "string" ? item.store_id : null,
    target_metric: text(item.target_metric, "not_declared"),
    target_question: text(item.target_question, "not_declared"),
    scope: text(item.scope, "not_declared"),
    granularity: text(item.granularity),
    status: text(item.status),
    finding: text(item.finding, "unknown"),
    diagnosis_type: text(item.diagnosis_type, "unknown"),
    primary_issue: text(item.primary_issue, "not_declared"),
    root_cause: text(item.root_cause, "not_declared"),
    limiting_constraint: text(item.limiting_constraint, "not_declared"),
    severity: text(item.severity),
    trajectory: text(item.trajectory),
    confidence: text(item.confidence),
    summary: text(item.summary, "not_declared"),
    limitations: strings(item.limitations),
    data_quality: record(item.data_quality),
    as_of: text(item.updated_at, "unknown_date"),
  };
}

export function summarizeDiagnosticRobustness(row: unknown): Row {
  const item = record(row);
  return {
    status: text(item.survival_status),
    false_diagnosis_risk: text(item.false_diagnosis_risk),
    robustness: text(item.robustness),
    diagnosis_stability: text(item.diagnosis_stability),
    confidence_before: text(item.confidence_before),
    confidence_after: text(item.confidence_after),
    revision_triggered: item.revision_triggered === true,
    reopened_blocks: strings(item.reopened_blocks),
    remaining_limitations: text(item.remaining_limitations, "not_declared"),
    required_evidence: text(item.red_team_required_evidence, "not_declared"),
    reviewed_at: text(item.reviewed_at, "unknown_date"),
  };
}

export function summarizeTemporalDiagnosis(row: unknown): Row {
  const item = record(row);
  return {
    current_state: text(item.current_state),
    trajectory: text(item.trajectory),
    short_term_trajectory: text(item.short_term_trajectory),
    medium_term_trajectory: text(item.medium_term_trajectory),
    long_term_trajectory: text(item.long_term_trajectory),
    temporal_sufficiency: text(item.temporal_sufficiency),
    baseline_status: text(item.baseline_status),
    trajectory_confidence: text(item.trajectory_confidence),
    limitations: text(item.limitations, "not_declared"),
    assessed_at: text(item.assessed_at, "unknown_date"),
  };
}

export function summarizeInterventionEligibilityRun(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations)
    ? result.candidate_evaluations.slice(0, 50).map((candidate) => {
      const value = record(candidate);
      return {
        candidate_id: text(value.candidate_id, "unknown_candidate"),
        disposition: text(value.disposition),
        conditions: strings(value.conditions),
        blockers: strings(value.blockers),
        unknowns: strings(value.unresolved_unknowns),
        reason_codes: strings(value.reason_codes),
      };
    })
    : [];
  return {
    disposition: text(item.disposition ?? result.disposition),
    candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length,
    eligible_count: typeof item.eligible_count === "number" ? item.eligible_count : 0,
    candidates,
    unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    source_refs: strings(item.source_refs ?? result.source_refs),
    as_of: text(item.as_of, "unknown_date"),
    selection: "none; F7.01 no prioriza ni elige candidatos",
  };
}

export function summarizeInterventionMatchingRun(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations)
    ? result.candidate_evaluations.slice(0, 50).map((candidate) => {
      const value = record(candidate);
      const chain = record(value.causal_chain);
      return {
        candidate_id: text(value.candidate_id, "unknown_candidate"),
        disposition: text(value.disposition),
        causal_chain: {
          problem_refs: strings(chain.problem_refs),
          driver_refs: strings(chain.driver_refs),
          cause_refs: strings(chain.cause_refs),
          mechanism_refs: strings(chain.mechanism_refs),
          lever_refs: strings(chain.lever_refs),
        },
        supporting_signal_refs: strings(value.supporting_signal_refs),
        disconfirming_signal_refs: strings(value.disconfirming_signal_refs),
        discriminating_evidence_refs: strings(value.discriminating_evidence_refs),
        unknowns: strings(value.unresolved_unknowns),
        reason_codes: strings(value.reason_codes),
      };
    })
    : [];
  return {
    disposition: text(item.disposition ?? result.disposition),
    candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length,
    matched_count: typeof item.matched_count === "number" ? item.matched_count : 0,
    candidates,
    matched_candidate_ids: strings(result.matched_candidate_ids),
    unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    source_refs: strings(item.source_refs ?? result.source_refs),
    as_of: text(item.as_of, "unknown_date"),
    selection: "none; F7.02 no prioriza ni elige candidatos",
  };
}

export function summarizeInterventionPrioritizationRun(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations)
    ? result.candidate_evaluations.slice(0, 50).map((candidate) => {
      const value = record(candidate);
      return {
        candidate_id: text(value.candidate_id, "unknown_candidate"),
        priority_tier: text(value.priority_tier),
        reason_codes: strings(value.reason_codes),
        unknowns: strings(value.unresolved_unknowns),
      };
    })
    : [];
  return {
    disposition: text(item.disposition ?? result.disposition),
    candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length,
    primary_priority_candidate_id: text(item.primary_priority_candidate_id ?? result.primary_priority_candidate_id),
    candidates,
    unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    source_refs: strings(item.source_refs ?? result.source_refs),
    as_of: text(item.as_of, "unknown_date"),
    execution_authorized: false,
    selection: "primary priority only; F7.03 no autoriza ejecución",
  };
}

export function summarizeInterventionImpactRun(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations)
    ? result.candidate_evaluations.slice(0, 50).map((candidate) => {
      const value = record(candidate);
      const trace = record(value.impact_trace);
      return {
        candidate_id: text(value.candidate_id, "unknown_candidate"),
        disposition: text(value.disposition),
        primary_effect: text(value.primary_effect),
        impact_trace: {
          mechanism_refs: strings(trace.mechanism_refs),
          leading_indicator_refs: strings(trace.leading_indicator_refs),
          business_outcome_refs: strings(trace.business_outcome_refs),
          economic_outcome_refs: strings(trace.economic_outcome_refs),
        },
        magnitude_qualitative: text(value.magnitude_qualitative),
        magnitude_value: typeof value.magnitude_value === "number" ? value.magnitude_value : null,
        time_to_signal: text(value.time_to_signal),
        durability: text(value.durability),
        estimate_basis: text(value.estimate_basis),
        incrementality: text(value.incrementality),
        secondary_effects: strings(value.secondary_effects),
        negative_effects: strings(value.negative_effects),
        tradeoffs: strings(value.tradeoffs),
        assumptions: strings(value.assumptions),
        unknowns: strings(value.unresolved_unknowns),
        reason_codes: strings(value.reason_codes),
      };
    })
    : [];
  return {
    disposition: text(item.disposition ?? result.disposition),
    candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length,
    primary_priority_candidate_id: text(item.primary_priority_candidate_id ?? result.primary_priority_candidate_id),
    candidates,
    unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    source_refs: strings(item.source_refs ?? result.source_refs),
    as_of: text(item.as_of, "unknown_date"),
    execution_authorized: false,
    selection: "expected impact only; F7.04 no garantiza resultado ni autoriza ejecucion",
  };
}

export function summarizeInterventionFeasibilityRun(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations)
    ? result.candidate_evaluations.slice(0, 50).map((candidate) => {
      const value = record(candidate);
      const trace = record(value.resource_trace);
      const cost = record(value.cost_profile);
      const effort = record(value.effort_profile);
      return {
        candidate_id: text(value.candidate_id, "unknown_candidate"),
        disposition: text(value.disposition),
        resource_trace: { required_resources: strings(trace.required_resources), available_resources: strings(trace.available_resources), bottleneck_resources: strings(trace.bottleneck_resources), capability_gaps: strings(trace.capability_gaps), contention_refs: strings(trace.contention_refs) },
        cost_profile: { direct: text(cost.direct), recurring: text(cost.recurring), maintenance: text(cost.maintenance), opportunity: text(cost.opportunity), numeric_amounts: [] },
        effort_profile: { complexity: text(effort.complexity), workload: text(effort.workload), coordination: text(effort.coordination) },
        time_requirement: record(value.time_requirement),
        success_capacity: record(value.success_capacity),
        adaptations: Array.isArray(value.adaptations) ? value.adaptations.slice(0, 20) : [],
        alternatives: Array.isArray(value.alternatives) ? value.alternatives.slice(0, 20) : [],
        recurring_burden: strings(value.recurring_burden),
        reversibility: text(value.reversibility),
        unknowns: strings(value.unresolved_unknowns),
        reason_codes: strings(value.reason_codes),
      };
    })
    : [];
  return { disposition: text(item.disposition ?? result.disposition), candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length, primary_priority_candidate_id: text(item.primary_priority_candidate_id ?? result.primary_priority_candidate_id), candidates, unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), reason_codes: strings(item.reason_codes ?? result.reason_codes), source_refs: strings(item.source_refs ?? result.source_refs), as_of: text(item.as_of, "unknown_date"), execution_authorized: false, selection: "resource feasibility only; F7.05 no contrata, compra, asigna ni autoriza ejecucion" };
}

export function summarizeInterventionRiskRun(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations)
    ? result.candidate_evaluations.slice(0, 50).map((candidate) => {
      const value = record(candidate);
      const radius = record(value.blast_radius);
      const reversal = record(value.reversibility_profile);
      const cost = record(value.cost_of_error);
      const trace = record(value.risk_trace);
      return {
        candidate_id: text(value.candidate_id, "unknown_candidate"),
        disposition: text(value.disposition),
        upside: strings(value.potential_upside),
        downside: strings(value.potential_downside),
        exposure: { scope: strings(radius.scope), level: text(radius.level) },
        reversibility: reversal,
        cost_of_error: cost,
        failure_modes: strings(value.failure_modes),
        inaction_risk: strings(value.inaction_risk ?? trace.inaction_risk),
        recommended_commitment: text(value.recommended_commitment),
        de_risking_actions: strings(value.de_risking_actions ?? trace.de_risking),
        risk_tradeoff: record(value.risk_tradeoff),
        unknowns: strings(value.unresolved_unknowns),
        reason_codes: strings(value.reason_codes),
      };
    })
    : [];
  return {
    disposition: text(item.disposition ?? result.disposition),
    candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length,
    primary_priority_candidate_id: text(item.primary_priority_candidate_id ?? result.primary_priority_candidate_id),
    candidates,
    unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    source_refs: strings(item.source_refs ?? result.source_refs),
    as_of: text(item.as_of, "unknown_date"),
    execution_authorized: false,
    selection: "risk review only; F7.06 no calcula risk score ni autoriza ejecucion",
  };
}

export function summarizeInterventionSequencingRun(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations)
    ? result.candidate_evaluations.slice(0, 50).map((candidate) => {
      const value = record(candidate);
      const path = record(value.decision_path);
      return {
        candidate_id: text(value.candidate_id, "unknown_candidate"),
        disposition: text(value.disposition),
        strategic_intervention: text(value.strategic_intervention),
        prerequisites: Array.isArray(value.prerequisites) ? value.prerequisites.slice(0, 30) : [],
        blockers: strings(value.current_blockers),
        sequence_steps: Array.isArray(value.sequence_steps) ? value.sequence_steps.slice(0, 30) : [],
        gates: Array.isArray(value.gates) ? value.gates.slice(0, 30) : [],
        now: strings(path.now),
        why_first: strings(path.why_first),
        then: strings(path.then),
        if_branches: strings(path.if_branches),
        if_not_branches: strings(path.if_not_branches),
        parallel: strings(path.parallel),
        not_yet: strings(path.not_yet),
        wait: strings(path.wait),
        exit_conditions: strings(path.exit_conditions),
        unknowns: strings(value.unresolved_unknowns),
        reason_codes: strings(value.reason_codes),
      };
    })
    : [];
  return {
    disposition: text(item.disposition ?? result.disposition),
    candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length,
    primary_priority_candidate_id: text(item.primary_priority_candidate_id ?? result.primary_priority_candidate_id),
    candidates,
    unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    source_refs: strings(item.source_refs ?? result.source_refs),
    as_of: text(item.as_of, "unknown_date"),
    execution_authorized: false,
    selection: "decision path only; F7.07 no crea tareas, fechas, owners ni autoriza ejecucion",
  };
}

export function summarizeInterventionTestExecuteRun(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations)
    ? result.candidate_evaluations.slice(0, 50).map((candidate) => {
      const value = record(candidate);
      const path = record(value.decision_path);
      const outcome = record(value.outcome_interpretation);
      return {
        candidate_id: text(value.candidate_id, "unknown_candidate"),
        candidate_intervention: text(value.candidate_intervention),
        recommended_mode: text(value.recommended_mode),
        rationale: strings(value.rationale),
        hypothesis: text(value.hypothesis),
        learning_question: text(value.learning_question),
        primary_outcome: text(value.primary_outcome),
        guardrail_outcomes: strings(value.guardrail_outcomes),
        measurement_requirement: text(value.measurement_requirement),
        exposure_mode: text(value.exposure_mode),
        pilot_scope: text(value.pilot_scope),
        observation_requirement: text(value.observation_requirement),
        observation_state: text(value.observation_state),
        evidence_reuse: text(value.evidence_reuse),
        transferability_caveat: text(value.transferability_caveat),
        experiment_cost: text(value.experiment_cost),
        experimentability: text(value.experimentability),
        contamination: strings(value.contamination),
        decision_after_result: strings(value.decision_after_result),
        why_now: strings(path.why_now),
        why_not_direct: strings(path.why_not_direct),
        why_not_test: strings(path.why_not_test),
        preconditions: strings(path.preconditions),
        after_result: strings(path.after_result),
        handoff: strings(path.handoff),
        positive: strings(outcome.positive),
        negative: strings(outcome.negative),
        inconclusive: strings(outcome.inconclusive),
        unknowns: strings(value.unresolved_unknowns),
        reason_codes: strings(value.reason_codes),
      };
    })
    : [];
  return {
    disposition: text(item.disposition ?? result.disposition),
    candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length,
    primary_priority_candidate_id: text(item.primary_priority_candidate_id ?? result.primary_priority_candidate_id),
    candidates,
    unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    source_refs: strings(item.source_refs ?? result.source_refs),
    as_of: text(item.as_of, "unknown_date"),
    execution_authorized: false,
    selection: "mode decision only; F7.08 no lanza tests, cambia produccion ni autoriza ejecucion",
  };
}

export function summarizeInterventionIntensityRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.slice(0, 50).map((candidate) => { const value = record(candidate); const path = record(value.decision_path); return { candidate_id: text(value.candidate_id, "unknown_candidate"), selected_intervention: text(value.selected_intervention), recommended_mode: text(value.recommended_mode), magnitude: text(value.magnitude), scope: text(value.scope), velocity: text(value.velocity), duration: text(value.duration), bet_size: text(value.bet_size), minimum_effective_exposure: text(value.minimum_effective_exposure), maximum_safe_exposure: text(value.maximum_safe_exposure), current_limiter: text(value.current_limiter), ramp_logic: strings(value.ramp_logic), observation_requirement: text(value.observation_requirement), escalation_condition: strings(value.escalation_condition), reduction_condition: strings(value.reduction_condition), strategic_meaning_shift: text(value.strategic_meaning_shift), why_this_size: strings(path.why_this_size), limiter: strings(path.limiter), next_observation: strings(path.next_observation), if_improves: strings(path.if_improves), if_deteriorates: strings(path.if_deteriorates), if_capacity_tightens: strings(path.if_capacity_tightens), handoff: strings(path.handoff), unknowns: strings(value.unresolved_unknowns), reason_codes: strings(value.rationale) }; }) : [];
  return { disposition: text(item.disposition ?? result.disposition), candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length, primary_priority_candidate_id: text(item.primary_priority_candidate_id ?? result.primary_priority_candidate_id), candidates, unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), reason_codes: strings(item.reason_codes ?? result.reason_codes), source_refs: strings(item.source_refs ?? result.source_refs), as_of: text(item.as_of, "unknown_date"), execution_authorized: false, selection: "intensity profile only; F7.09 no fija porcentajes, presupuestos ni autoriza ejecucion" };
}

export function summarizeMaturityRecommendationRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.slice(0, 50).map((candidate) => { const value = record(candidate); return { candidate_id: text(value.candidate_id, "unknown_candidate"), selected_intervention: text(value.selected_intervention), functional_maturity: text(value.functional_maturity), recommended_mode: text(value.recommended_mode), complexity_decision: text(value.complexity_decision), timing_fit: text(value.timing_fit), current_recommendation: text(value.current_recommendation), deferred_recommendation: text(value.deferred_recommendation), not_yet_reason: text(value.not_yet_reason), missing_capability: text(value.missing_capability), capability_building_recommendation: text(value.capability_building_recommendation), maturity_unlock: strings(value.maturity_unlock), evidence_standard: text(value.evidence_standard), unknowns: strings(value.unresolved_unknowns), reason_codes: strings(value.rationale) }; }) : [];
  return { disposition: text(item.disposition ?? result.disposition), candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length, primary_priority_candidate_id: text(item.primary_priority_candidate_id ?? result.primary_priority_candidate_id), candidates, unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), reason_codes: strings(item.reason_codes ?? result.reason_codes), source_refs: strings(item.source_refs ?? result.source_refs), as_of: text(item.as_of, "unknown_date"), execution_authorized: false, selection: "maturity-adjusted recommendation only; F7.10 no puntúa madurez, no usa revenue/tooling como proxy y no autoriza ejecución" };
}

export function summarizeConstraintRecommendationRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.slice(0, 50).map((candidate) => { const value = record(candidate); return { candidate_id: text(value.candidate_id, "unknown_candidate"), desired_intervention: text(value.desired_intervention), binding_constraint: text(value.binding_constraint), recommended_mode: text(value.recommended_mode), feasibility_disposition: text(value.feasibility_disposition), timing_fit: text(value.timing_fit), best_feasible_recommendation: text(value.best_feasible_recommendation), minimum_viable_intervention: text(value.minimum_viable_intervention), alternative_mechanism: text(value.alternative_mechanism), enabling_recommendation: text(value.enabling_recommendation), deferred_action: text(value.deferred_action), activation_trigger: text(value.activation_trigger), expected_outcome_adjustment: text(value.expected_outcome_adjustment), feasibility_confidence: text(value.feasibility_confidence), next_constraint_to_monitor: text(value.next_constraint_to_monitor), unknowns: strings(value.unresolved_unknowns), reason_codes: strings(value.rationale) }; }) : [];
  return { disposition: text(item.disposition ?? result.disposition), candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length, primary_priority_candidate_id: text(item.primary_priority_candidate_id ?? result.primary_priority_candidate_id), candidates, unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), reason_codes: strings(item.reason_codes ?? result.reason_codes), source_refs: strings(item.source_refs ?? result.source_refs), as_of: text(item.as_of, "unknown_date"), execution_authorized: false, selection: "constraint-adjusted recommendation only; F7.11 no asigna recursos, no cambia budgets/capacidad y no autoriza ejecución" };
}

export function summarizeRecommendationPortfolioRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  const candidates = Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.slice(0, 50).map((candidate) => { const value = record(candidate); return { candidate_id: text(value.candidate_id, "unknown_candidate"), role: text(value.role), selection_status: text(value.selection_status), role_reason: text(value.role_reason), sequence_position: text(value.sequence_position), intervention: text(value.intervention), expected_outcome: text(value.expected_outcome), shared_resources: strings(value.shared_resources), dependencies: strings(value.dependencies), unknowns: strings(value.unresolved_unknowns), reason_codes: strings(value.rationale) }; }) : [];
  return { disposition: text(item.disposition ?? result.disposition), candidate_count: typeof item.candidate_count === "number" ? item.candidate_count : candidates.length, primary_candidate_id: text(item.primary_candidate_id ?? result.primary_candidate_id), dominant_priority: text(result.dominant_priority), strategic_objective: text(result.strategic_objective), portfolio_feasibility: text(result.portfolio_feasibility), portfolio_risk: text(result.portfolio_risk), portfolio_narrative: text(result.portfolio_narrative), active_candidate_ids: strings(result.active_candidate_ids), deferred_candidate_ids: strings(result.deferred_candidate_ids), excluded_candidate_ids: strings(result.excluded_candidate_ids), explicit_exclusions: strings(result.explicit_exclusions), sequence: strings(result.sequence), conditional_branches: strings(result.conditional_branches), aggregate_resource_load: strings(result.aggregate_resource_load), candidates, unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), reason_codes: strings(item.reason_codes ?? result.reason_codes), source_refs: strings(item.source_refs ?? result.source_refs), as_of: text(item.as_of, "unknown_date"), execution_authorized: false, selection: "portfolio roles and sequencing only; F7.12 no optimiza, no asigna recursos, no fija WIP y no autoriza ejecucion" };
}

export function summarizeDynamicDecisionRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  const units = Array.isArray(result.unit_decisions) ? result.unit_decisions.slice(0, 50).map((unit) => { const value = record(unit); return { unit_id: text(value.unit_id, "unknown_unit"), decision: text(value.decision), decision_qualifiers: strings(value.decision_qualifiers), decision_scope: text(value.decision_scope), rationale: text(value.rationale), why_not_alternatives: strings(value.why_not_alternatives), current_exposure_recommendation: text(value.current_exposure_recommendation), scale_direction: text(value.scale_direction), scale_limit: text(value.scale_limit), stop_scope: text(value.stop_scope), rollback_target: text(value.rollback_target), fix_forward_alternative: text(value.fix_forward_alternative), observation_focus: strings(value.observation_focus), next_evidence_needed: strings(value.next_evidence_needed), decision_trigger: text(value.decision_trigger), resource_reallocation_implication: text(value.resource_reallocation_implication), portfolio_consequence: text(value.portfolio_consequence), learning_capture: text(value.learning_capture), decision_confidence: text(value.decision_confidence), unknowns: strings(value.unresolved_unknowns), quality_flags: strings(value.quality_flags) }; }) : [];
  return { disposition: text(item.disposition ?? result.disposition), overall_decision: text(item.overall_decision ?? result.overall_decision), unit_count: typeof item.unit_count === "number" ? item.unit_count : units.length, units, stop_unit_ids: strings(result.stop_unit_ids), continue_unit_ids: strings(result.continue_unit_ids), scale_unit_ids: strings(result.scale_unit_ids), rollback_unit_ids: strings(result.rollback_unit_ids), next_evidence_needed: strings(result.next_evidence_needed), portfolio_implications: strings(result.portfolio_implications), learning_capture: strings(result.learning_capture), unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), reason_codes: strings(item.reason_codes ?? result.reason_codes), source_refs: strings(item.source_refs ?? result.source_refs), as_of: text(item.as_of, "unknown_date"), execution_authorized: false, selection: "decision update only; F7.13 no monitoriza, no hace rollback, no cambia budgets y no autoriza ejecucion" };
}

export function summarizeRestraintDecisionRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  return { disposition: text(item.disposition ?? result.disposition), decision: text(item.decision ?? result.decision), scope: text(item.scope ?? result.scope), rationale: text(result.rationale), what_we_know: strings(result.what_we_know), what_we_do_not_know: strings(result.what_we_do_not_know), what_not_to_change: strings(result.what_not_to_change), wait_reason: text(result.wait_reason), review_condition: text(result.review_condition), future_trigger: strings(result.future_trigger), decision_critical_question: text(result.decision_critical_question), evidence_needed: strings(result.evidence_needed), evidence_path: strings(result.evidence_path), completion_condition: text(result.completion_condition), action_after_evidence: strings(result.action_after_evidence), cost_of_delay_consideration: text(result.cost_of_delay_consideration), confidence_limitation: text(result.confidence_limitation), status_quo_assessment: text(result.status_quo_assessment), action_risk: text(result.action_risk), inaction_risk: text(result.inaction_risk), decision_sufficiency: text(result.decision_sufficiency), information_value: text(result.information_value), collection_cost: text(result.collection_cost), delay_cost: text(result.delay_cost), portfolio_consequence: text(result.portfolio_consequence), learning_capture: text(result.learning_capture), unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), reason_codes: strings(item.reason_codes ?? result.reason_codes), source_refs: strings(item.source_refs ?? result.source_refs), as_of: text(item.as_of, "unknown_date"), execution_authorized: false, selection: "restraint decision only; F7.14 no monitoriza, no investiga automáticamente, no programa revisiones y no ejecuta cambios" };
}

export function summarizeExpectedOutcomeRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  return { disposition: text(item.disposition ?? result.disposition), scope: text(item.scope ?? result.scope), causal_thesis: text(result.causal_thesis), recommendation: text(result.recommendation), mechanism_outcome: strings(result.mechanism_outcome), behavior_system_outcome: strings(result.behavior_system_outcome), business_outcome: strings(result.business_outcome), strategic_outcome: strings(result.strategic_outcome), direction: text(result.direction), magnitude: text(result.magnitude), outcome_confidence: text(result.outcome_confidence), outcome_horizon: text(result.outcome_horizon), direct_outcome: strings(result.direct_outcome), indirect_outcome: strings(result.indirect_outcome), known_downside: strings(result.known_downside), primary_success_criterion: text(result.primary_success_criterion), mechanism_evidence: strings(result.mechanism_evidence), guardrails: strings(result.guardrails), materiality: text(result.materiality), baseline_counterfactual: text(result.baseline_counterfactual), incrementality: text(result.incrementality), economic_meaning: text(result.economic_meaning), sustainability: text(result.sustainability), repeatability: text(result.repeatability), scalability: text(result.scalability), durability: text(result.durability), adoption_fidelity: text(result.adoption_fidelity), maintenance_cost: text(result.maintenance_cost), failure_evidence: strings(result.failure_evidence), ambiguous_evidence: strings(result.ambiguous_evidence), scale_criterion: text(result.scale_criterion), continue_criterion: text(result.continue_criterion), stop_criterion: text(result.stop_criterion), rollback_criterion: text(result.rollback_criterion), evaluation_level: text(result.evaluation_level), completion_condition: text(result.completion_condition), graduation_condition: text(result.graduation_condition), quality_flags: strings(result.quality_flags), unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), reason_codes: strings(item.reason_codes ?? result.reason_codes), source_refs: strings(item.source_refs ?? result.source_refs), as_of: text(item.as_of, "unknown_date"), execution_authorized: false, selection: "expected outcome and criteria only; F7.15 no monitoriza, no evalua KPIs automaticamente, no emite alertas y no ejecuta cambios" };
}

export function summarizeRecommendationConfidenceRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  return { disposition: text(item.disposition ?? result.disposition), scope: text(item.scope ?? result.scope), recommendation: text(result.recommendation), diagnosis_confidence: text(result.diagnosis_confidence), cause_confidence: text(result.cause_confidence), recommendation_confidence: text(result.recommendation_confidence), mechanism_confidence: text(result.mechanism_confidence), impact_direction_confidence: text(result.impact_direction_confidence), impact_magnitude_confidence: text(result.impact_magnitude_confidence), risk_confidence: text(result.risk_confidence), attribution_confidence: text(result.attribution_confidence), execution_confidence: text(result.execution_confidence), temporal_confidence: text(result.temporal_confidence), durability_confidence: text(result.durability_confidence), scale_confidence: text(result.scale_confidence), transferability_confidence: text(result.transferability_confidence), main_confidence_driver: text(result.main_confidence_driver), main_uncertainty: text(result.main_uncertainty), contradictory_evidence: strings(result.contradictory_evidence), confidence_rationale: text(result.confidence_rationale), commitment_scope: text(result.commitment_scope), commitment_magnitude: text(result.commitment_magnitude), commitment_velocity: text(result.commitment_velocity), commitment_duration: text(result.commitment_duration), recommendation_form: text(result.recommendation_form), action_implication: text(result.action_implication), layer_update: text(result.layer_update), layer_update_effect: text(result.layer_update_effect), evidence_integrity: text(result.evidence_integrity), transfer_context: text(result.transfer_context), quality_flags: strings(result.quality_flags), unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), reason_codes: strings(item.reason_codes ?? result.reason_codes), source_refs: strings(item.source_refs ?? result.source_refs), as_of: text(item.as_of, "unknown_date"), execution_authorized: false, selection: "confidence calibration only; F7.17 no percentages, no score, no automatic update and no execution" };
}

export function summarizeRecommendationCommunicationRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  return { disposition: text(item.disposition ?? result.disposition), scope: text(item.scope ?? result.scope), primary_recommendation: text(item.primary_recommendation ?? result.primary_recommendation), reason: text(result.reason), why_now: text(result.why_now), what_not_to_do: strings(result.what_not_to_do), expected_outcome: text(result.expected_outcome), main_risk: text(result.main_risk), main_uncertainty: text(result.main_uncertainty), priority_role: text(result.priority_role), recommendation_strength: text(result.recommendation_strength), recommendation_stage: text(result.recommendation_stage), value_type: text(result.value_type), temporary_or_structural: text(result.temporary_or_structural), audience: text(result.audience), confidence_language: text(result.confidence_language), fact_evidence: strings(result.fact_evidence), inference_evidence: strings(result.inference_evidence), strongest_evidence: strings(result.strongest_evidence), conflicting_evidence: strings(result.conflicting_evidence), success_signal: text(result.success_signal), invalidating_condition: text(result.invalidating_condition), next_decision: text(result.next_decision), sequence: strings(result.sequence), dependencies: strings(result.dependencies), constraints: strings(result.constraints), commitment_scope: text(result.commitment_scope), commitment_magnitude: text(result.commitment_magnitude), commitment_velocity: text(result.commitment_velocity), commitment_duration: text(result.commitment_duration), action_implication: text(result.action_implication), quality_flags: strings(result.quality_flags), unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), reason_codes: strings(item.reason_codes ?? result.reason_codes), source_refs: strings(item.source_refs ?? result.source_refs), as_of: text(item.as_of, "unknown_date"), execution_authorized: false, selection: "solo comunicación; F7.18 comprime decisión, no ejecuta ni autoriza cambios" };
}

export function summarizeHitlApprovalRun(row: unknown): Row {
  const item = record(row);
  const result = record(item.result);
  return {
    action_id: text(item.action_id ?? result.action_id),
    disposition: text(item.disposition ?? result.disposition),
    autonomy_level: text(item.autonomy_level ?? result.autonomy_level),
    approval_requirement: text(item.approval_requirement ?? result.approval_requirement),
    approval_gate: item.approval_gate === true || result.approval_gate === true,
    approval_state: text(item.approval_state ?? result.approval_state),
    approval_freshness: text(result.approval_freshness),
    execution_state: text(item.execution_state ?? result.execution_state),
    escalation_required: result.escalation_required === true,
    escalation_reasons: strings(result.escalation_reasons),
    required_approver_type: text(result.required_approver_type),
    required_approval_tier: text(result.required_approval_tier),
    approval_scope: text(result.approval_scope),
    unresolved_unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    reason_codes: strings(item.reason_codes ?? result.reason_codes),
    source_refs: strings(item.source_refs ?? result.source_refs),
    as_of: text(item.as_of, "unknown_date"),
    execution_authorized: false,
    selection: "HITL F8.02 decide supervisión y gate; nunca confunde aprobación con ejecución",
  };
}

export function summarizeClosureHandoffRun(row: unknown): Row {
  const item = record(row); const result = record(item.result); const finalState = record(item.final_state_snapshot ?? result.final_state_snapshot);
  return {
    intervention_id: text(item.intervention_id ?? result.intervention_id), recommendation_id: text(item.recommendation_id ?? result.recommendation_id),
    closure_state: text(item.closure_state ?? result.closure_state), closure_gate: item.closure_gate === true || result.closure_gate === true,
    operational_outcome: text(item.operational_outcome ?? result.operational_outcome), verification_status: text(item.verification_status ?? result.verification_status),
    closure_quality: text(item.closure_quality ?? result.closure_quality), outcome_maturity: text(item.outcome_maturity ?? result.outcome_maturity),
    expected_state: text(finalState.expected), actual_state: text(finalState.actual), handoff_status: text(item.handoff_status ?? result.handoff_status),
    blockers: strings(item.blockers ?? result.blockers), unresolved_unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), source_refs: strings(item.source_refs ?? result.source_refs),
    as_of: text(item.as_of, "unknown_date"), execution_authorized: false,
    selection: "F8.16 cierre observado; no confundir CLOSED con éxito de negocio ni outcome maduro con causalidad demostrada",
  };
}

export function summarizeContinuousLearningRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  return {
    block_code: text(item.block_code ?? result.block_code), experience_id: text(item.experience_id ?? result.experience_id),
    status: text(item.status ?? result.status), classification: text(item.classification ?? result.classification), confidence: text(item.confidence ?? result.confidence),
    gate: item.gate === true || result.gate === true, rationale: strings(item.rationale ?? result.rationale), learning: strings(item.learning ?? result.learning),
    next_evidence_needed: strings(item.next_evidence_needed ?? result.next_evidence_needed), unresolved_unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns),
    source_refs: strings(item.source_refs ?? result.source_refs), evaluated_at: text(item.evaluated_at ?? result.evaluated_at),
    selection: "F9 learning: experience trazable y outcome clasificado; no convertir evidencia insuficiente en recomendación ni autorización",
  };
}

export function summarizeExecutionPlanRun(row: unknown): Row {
  const item = record(row); const result = record(item.result);
  return {
    recommendation_id: text(item.recommendation_id ?? result.recommendation_id), plan_status: text(item.plan_status ?? result.plan_status), plan_version: item.plan_version ?? result.plan_version,
    execution_intent: text(item.execution_intent ?? result.execution_intent), objective: text(item.objective ?? result.objective), ordered_action_ids: strings(item.ordered_action_ids ?? result.ordered_action_ids), critical_path: strings(item.critical_path ?? result.critical_path),
    blockers: strings(item.blockers ?? result.blockers), unresolved_unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), source_refs: strings(item.source_refs ?? result.source_refs), execution_authorized: false,
    selection: "F8.03 plan verificable; no confundir plan listo con aprobación ni aprobación con ejecución",
  };
}
export function summarizeReadinessRun(row: unknown): Row { const item = record(row); const result = record(item.result); return { plan_id: text(item.plan_id ?? result.plan_id), action_id: text(item.action_id ?? result.action_id), scope: text(item.scope ?? result.scope), readiness_decision: text(item.readiness_decision ?? result.readiness_decision), dimensions: result.dimensions ?? {}, blocking_reasons: strings(item.blocking_reasons ?? result.blocking_reasons), remediation_actions: result.remediation_actions ?? [], revalidate_required: result.revalidate_required === true, stale: result.stale === true, safe_state: text(result.safe_state), unresolved_unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), execution_authorized: false, selection: "F8.04 readiness; un plan válido no implica estar listo ni autoriza ejecución" }; }

export function summarizeActionEnvelopeRun(row: unknown): Row { const item = record(row); const result = record(item.result); return { context_id: text(item.context_id ?? result.context_id), zone: text(item.envelope_zone ?? result.zone), violations: strings(item.violations ?? result.violations), warnings: strings(item.warnings ?? result.warnings), covered_action_ids: strings(result.covered_action_ids), remaining_capacity: result.remaining_capacity ?? {}, envelope_fresh: result.envelope_fresh === true, scope_expansion_required: result.scope_expansion_required === true, alternatives: strings(result.alternatives), unresolved_unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), execution_authorized: false, selection: "F8.05 action envelope; el alcance efectivo limita el plan y no concede autoridad de ejecución" }; }
/** Las filas llegan de la mas reciente a la mas antigua: una por etapa. */
function latestPerStage(rows: unknown[]): unknown[] { const seen = new Set<string>(); return rows.filter((row) => { const stage = String(record(row).stage ?? ""); if (seen.has(stage)) return false; seen.add(stage); return true; }); }

export function summarizeExecutionSupervisionRun(row: unknown): Row { const item = record(row); const result = record(item.result); return { block: text(result.block), stage: text(item.stage ?? result.stage), decision: text(item.decision ?? result.decision), block_decision: text(result.block_decision), why: text(result.why), blockers: strings(item.blockers ?? result.blockers), warnings: strings(item.warnings ?? result.warnings), next_actions: strings(result.next_actions), unknowns: strings(item.unresolved_unknowns ?? result.unresolved_unknowns), execution_authorized: false, selection: "F8 supervisión por bloque: la decisión propia de cada bloque (block_decision) y su motivo; no autoriza ejecución ni afirma que algo se haya ejecutado" }; }

export function buildDecisionPlaybookContextBlocks(input: {
  decisionContext?: unknown;
  decisionOutput?: unknown;
  playbookRuns?: unknown[];
  diagnosticCases?: unknown[];
  diagnosticOutputs?: unknown[];
  robustnessReviews?: unknown[];
  temporalDiagnoses?: unknown[];
  interventionEligibilityRuns?: unknown[];
  interventionMatchingRuns?: unknown[];
  interventionPrioritizationRuns?: unknown[];
  interventionImpactRuns?: unknown[];
  interventionFeasibilityRuns?: unknown[];
  interventionRiskRuns?: unknown[];
  interventionSequencingRuns?: unknown[];
  interventionTestExecuteRuns?: unknown[];
  interventionIntensityRuns?: unknown[];
  maturityRecommendationRuns?: unknown[];
  constraintRecommendationRuns?: unknown[];
  recommendationPortfolioRuns?: unknown[];
  dynamicDecisionRuns?: unknown[];
  restraintDecisionRuns?: unknown[];
  expectedOutcomeRuns?: unknown[];
  recommendationConfidenceRuns?: unknown[];
  recommendationCommunicationRuns?: unknown[];
  hitlApprovalRuns?: unknown[];
  closureHandoffRuns?: unknown[];
  executionPlanRuns?: unknown[];
  readinessRuns?: unknown[];
  actionEnvelopeRuns?: unknown[];
  executionSupervisionRuns?: unknown[];
  continuousLearningRuns?: unknown[];
}): ConsultantChatContextBlock[] {
  const blocks: ConsultantChatContextBlock[] = [];
  const diagnosticOutputs = input.diagnosticOutputs ?? [];
  const diagnosticCases = input.diagnosticCases ?? [];
  const robustnessByCase = new Map(
    (input.robustnessReviews ?? [])
      .map((row) => [text(record(row).case_id, ""), row] as const)
      .filter(([caseId]) => Boolean(caseId)),
  );
  const temporalByCase = new Map(
    (input.temporalDiagnoses ?? [])
      .map((row) => [text(record(row).case_id, ""), row] as const)
      .filter(([caseId]) => Boolean(caseId)),
  );
  blocks.push({
    label:
      "F3 DIAGNÓSTICO (salida versionada; no es una causa, prioridad ni autorización de acción)",
    data: {
      cases: diagnosticCases.length
        ? diagnosticCases.map(summarizeDiagnosticCase)
        : "sin_casos_diagnosticos_actuales; no inventar alcance ni causa",
      outputs: diagnosticOutputs.length
        ? diagnosticOutputs.map((row) => {
          const caseId = text(record(row).case_id, "");
          const robustness = robustnessByCase.get(caseId);
          const temporal = temporalByCase.get(caseId);
          return {
            output: summarizeDiagnosticOutput(row),
            adversarial_review: robustness
              ? summarizeDiagnosticRobustness(robustness)
              : "sin_revision_adversarial_actual; no inventar supervivencia",
            temporal_review: temporal
              ? summarizeTemporalDiagnosis(temporal)
              : "sin_revision_temporal_actual; no inventar trayectoria",
          };
        })
        : "sin_salidas_diagnosticas_actuales; no inventar diagnostico ni causa",
    },
  });
  if (input.decisionContext) {
    blocks.push({
      label:
        "F4 CONTEXTO DE DECISIÓN (snapshot estructurado; no es una orden ni sustituye evidencia actual)",
      data: summarizeDecisionContext(input.decisionContext),
    });
  } else {
    blocks.push({
      label: "F4 CONTEXTO DE DECISIÓN",
      data: "sin_snapshot_actual; no inventar objetivo, horizonte ni restricciones",
    });
  }
  if (input.decisionOutput) {
    blocks.push({
      label:
        "F4 SALIDA DECISIONAL (usar estado, motivos y unknowns; respetar ABSTAIN/VALIDATION_REQUIRED)",
      data: summarizeDecisionOutput(input.decisionOutput),
    });
  } else {
    blocks.push({
      label: "F4 SALIDA DECISIONAL",
      data: "sin_salida_actual; no presentar una prioridad como validada",
    });
  }
  const playbooks = input.playbookRuns ?? [];
  blocks.push({
    label:
      "F5/F6 PLAYBOOKS, BENCHMARKS Y GUARDRAILS (catálogo evaluado; solo ACTIVE y aplicables pueden sostener una recomendación)",
    data: playbooks.length
      ? playbooks.map(summarizePlaybookRun)
      : "sin_evaluaciones_actuales; no inventar una estrategia ni una intervención",
  });
  const eligibilityRuns = input.interventionEligibilityRuns ?? [];
  blocks.push({
    label:
      "F7.01 ELEGIBILIDAD (filtro de candidatos; no es prioridad ni autorización de ejecución)",
    data: eligibilityRuns.length
      ? eligibilityRuns.map(summarizeInterventionEligibilityRun)
      : "sin_evaluaciones_de_elegibilidad; no inventar candidatos ni condiciones",
  });
  const matchingRuns = input.interventionMatchingRuns ?? [];
  blocks.push({
    label:
      "F7.02 MATCHING (cadena causal de candidatos; no es prioridad ni autorizacion de ejecucion)",
    data: matchingRuns.length
      ? matchingRuns.map(summarizeInterventionMatchingRun)
      : "sin_evaluaciones_de_matching; no inventar encaje causal ni candidatos",
  });
  const prioritizationRuns = input.interventionPrioritizationRuns ?? [];
  blocks.push({
    label:
      "F7.03 PRIORIZACIÓN (prioridad principal cualitativa; no es autorización de ejecución)",
    data: prioritizationRuns.length
      ? prioritizationRuns.map(summarizeInterventionPrioritizationRun)
      : "sin_evaluaciones_de_priorizacion; no inventar una prioridad entre intervenciones",
  });
  const impactRuns = input.interventionImpactRuns ?? [];
  blocks.push({
    label: "F7.04 IMPACTO ESPERADO (expectativa trazable; no es garantía ni autorización de ejecución)",
    data: impactRuns.length
      ? impactRuns.map(summarizeInterventionImpactRun)
      : "sin_evaluaciones_de_impacto_esperado; no inventar impacto, magnitud ni resultado",
  });
  const feasibilityRuns = input.interventionFeasibilityRuns ?? [];
  blocks.push({
    label: "F7.05 FACTIBILIDAD (recursos, coste y esfuerzo separados; no es presupuesto ni autorización)",
    data: feasibilityRuns.length
      ? feasibilityRuns.map(summarizeInterventionFeasibilityRun)
      : "sin_evaluaciones_de_factibilidad; no inventar capacidad, coste, esfuerzo ni bottleneck",
  });
  const riskRuns = input.interventionRiskRuns ?? [];
  blocks.push({
    label: "F7.06 RIESGO Y REVERSIBILIDAD (ejes cualitativos separados; no es score ni autorizacion)",
    data: riskRuns.length
      ? riskRuns.map(summarizeInterventionRiskRun)
      : "sin_evaluaciones_de_riesgo; no inventar downside, exposicion, reversibilidad ni coste del error",
  });
  const sequencingRuns = input.interventionSequencingRuns ?? [];
  blocks.push({
    label: "F7.07 SECUENCIACIÓN Y DEPENDENCIAS (camino condicional; no es plan de tareas ni autorización)",
    data: sequencingRuns.length
      ? sequencingRuns.map(summarizeInterventionSequencingRun)
      : "sin_evaluaciones_de_secuenciacion; no inventar prerequisites, blockers, gates ni parallel tracks",
  });
  const testExecuteRuns = input.interventionTestExecuteRuns ?? [];
  blocks.push({
    label: "F7.08 TEST VS EXECUTE (modo cualitativo; no lanza experimentos ni autoriza ejecución)",
    data: testExecuteRuns.length
      ? testExecuteRuns.map(summarizeInterventionTestExecuteRun)
      : "sin_evaluaciones_de_test_vs_execute; no inventar modo, hipotesis, evidencia ni autorizacion",
  });
  const intensityRuns = input.interventionIntensityRuns ?? [];
  blocks.push({
    label: "F7.09 INTENSIDAD (magnitude/scope/velocity/duration; no es presupuesto ni autorización)",
    data: intensityRuns.length
      ? intensityRuns.map(summarizeInterventionIntensityRun)
      : "sin_evaluaciones_de_intensidad; no inventar magnitud, scope, velocity, duration ni limiter",
  });
  const maturityRecommendationRuns = input.maturityRecommendationRuns ?? [];
  blocks.push({
    label: "F7.10 RECOMENDACIONES POR MADUREZ (now/later y capability previa; no es score ni autorización)",
    data: maturityRecommendationRuns.length
      ? maturityRecommendationRuns.map(summarizeMaturityRecommendationRun)
      : "sin_evaluaciones_de_madurez; no inventar readiness, capability faltante ni complejidad absorbible",
  });
  const constraintRecommendationRuns = input.constraintRecommendationRuns ?? [];
  blocks.push({
    label: "F7.11 RECOMENDACIONES BAJO RESTRICCIONES (binding constraint y acción factible; no es allocator ni autorización)",
    data: constraintRecommendationRuns.length
      ? constraintRecommendationRuns.map(summarizeConstraintRecommendationRun)
      : "sin_evaluaciones_de_restricciones; no inventar binding constraint, capacidad de éxito ni adaptación",
  });
  const recommendationPortfolioRuns = input.recommendationPortfolioRuns ?? [];
  blocks.push({
    label: "F7.12 PORTAFOLIO DE RECOMENDACIONES (roles, cartera minima y diferidos; no es optimizer ni autorizacion)",
    data: recommendationPortfolioRuns.length
      ? recommendationPortfolioRuns.map(summarizeRecommendationPortfolioRun)
      : "sin_evaluaciones_de_portafolio; no inventar Primary, roles, capacidad agregada ni exclusiones",
  });
  const dynamicDecisionRuns = input.dynamicDecisionRuns ?? [];
  blocks.push({
    label: "F7.13 STOP / CONTINUE / SCALE / ROLLBACK (actualización de decisión; no ejecuta cambios)",
    data: dynamicDecisionRuns.length
      ? dynamicDecisionRuns.map(summarizeDynamicDecisionRun)
      : "sin_evaluaciones_de_decision_dinamica; no inventar outcome, fidelidad, rollback ni readiness",
  });
  const restraintDecisionRuns = input.restraintDecisionRuns ?? [];
  blocks.push({
    label: "F7.14 NO-ACTION / WAIT / GATHER EVIDENCE (decisión de exposición; no ejecuta cambios)",
    data: restraintDecisionRuns.length
      ? restraintDecisionRuns.map(summarizeRestraintDecisionRun)
      : "sin_evaluaciones_de_restraint_decision; no inventar timing, coste de espera, frontera de decisión ni evidencia necesaria",
  });
  const expectedOutcomeRuns = input.expectedOutcomeRuns ?? [];
  blocks.push({
    label: "F7.15 EXPECTED OUTCOME Y SUCCESS CRITERIA (tesis y criterios observables; no monitoriza)",
    data: expectedOutcomeRuns.length
      ? expectedOutcomeRuns.map(summarizeExpectedOutcomeRun)
      : "sin_evaluaciones_de_expected_outcome; no inventar magnitud, criterio de éxito, guardrail o readiness de escala",
  });
  const recommendationConfidenceRuns = input.recommendationConfidenceRuns ?? [];
  blocks.push({
    label: "F7.17 CONFIANZA CALIBRADA (dimensiones separadas; no es score ni autorización)",
    data: recommendationConfidenceRuns.length
      ? recommendationConfidenceRuns.map(summarizeRecommendationConfidenceRun)
      : "sin_evaluaciones_de_confianza; no inventar certeza, score, porcentaje ni compromiso",
  });
  const recommendationCommunicationRuns = input.recommendationCommunicationRuns ?? [];
  blocks.push({
    label: "F7.18 COMUNICACIÓN DE RECOMENDACIONES (decisión primero; no es ejecución ni autorización)",
    data: recommendationCommunicationRuns.length
      ? recommendationCommunicationRuns.map(summarizeRecommendationCommunicationRun)
      : "sin_evaluaciones_de_comunicacion; no inventar recomendación principal, why now, outcome, riesgo ni siguiente decisión",
  });
  const hitlApprovalRuns = input.hitlApprovalRuns ?? [];
  blocks.push({
    label: "F8.02 HITL Y APROBACIÓN (gate y autonomía; no es ejecución)",
    data: hitlApprovalRuns.length
      ? hitlApprovalRuns.map(summarizeHitlApprovalRun)
      : "sin_evaluaciones_hitl; no inventar autoridad, aprobación, autonomía ni permiso de ejecución",
  });
  const closureHandoffRuns = input.closureHandoffRuns ?? [];
  blocks.push({
    label: "F8.16 CIERRE, HANDOFF Y RESULTADO (estado observado; no es ejecución ni éxito de negocio)",
    data: closureHandoffRuns.length
      ? closureHandoffRuns.map(summarizeClosureHandoffRun)
      : "sin_evaluaciones_de_cierre; no inventar estado final, verificación, handoff, outcome ni aprendizaje",
  });
  const executionPlanRuns = input.executionPlanRuns ?? [];
  blocks.push({
    label: "F8.03 PLAN DE EJECUCIÓN (secuencia, controles y dependencias; no es ejecución)",
    data: executionPlanRuns.length
      ? executionPlanRuns.map(summarizeExecutionPlanRun)
      : "sin_planes_de_ejecucion; no inventar acciones, secuencia, readiness ni autorización",
  });
  const readinessRuns = input.readinessRuns ?? [];
  blocks.push({ label: "F8.04 READINESS Y PRECONDICIONES (barrera antes de ejecutar)", data: readinessRuns.length ? readinessRuns.map(summarizeReadinessRun) : "sin_evaluaciones_de_readiness; no inventar condiciones, frescura, autorización ni entorno" });
  const actionEnvelopeRuns = input.actionEnvelopeRuns ?? [];
  blocks.push({ label: "F8.05 ACTION ENVELOPE (alcance, límites y autoridad separada)", data: actionEnvelopeRuns.length ? actionEnvelopeRuns.map(summarizeActionEnvelopeRun) : "sin_evaluaciones_de_action_envelope; no inventar alcance, herramientas, límites ni autoridad" });
  const executionSupervisionRuns = input.executionSupervisionRuns ?? [];
  blocks.push({ label: "F8.06-F8.17 SUPERVISIÓN DE EJECUCIÓN (capabilities, guardrails, lifecycle y evidencia)", data: executionSupervisionRuns.length ? latestPerStage(executionSupervisionRuns).map(summarizeExecutionSupervisionRun) : "sin_evaluaciones_de_supervision; no inventar tools, estados, incidentes, recovery, verificación ni reporting" });
  const continuousLearningRuns = input.continuousLearningRuns ?? [];
  blocks.push({ label: "F9 APRENDIZAJE CONTINUO (experiencia, evidencia, outcome y gates; no es autorización de ejecución)", data: continuousLearningRuns.length ? continuousLearningRuns.map(summarizeContinuousLearningRun) : "sin_evaluaciones_de_learning; no inventar outcome, causalidad, confianza ni conocimiento reutilizable" });
  return blocks;
}

function unavailableBlock(label: string): ConsultantChatContextBlock {
  return {
    label,
    data: "no_disponible; no completar por inferencia y pedir validación si es relevante",
  };
}

export async function loadDecisionPlaybookContextBlocks(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ConsultantChatContextBlock[]> {
  const [diagnosticCaseResult, diagnosticOutputResult, robustnessResult, temporalResult, contextResult, outputResult, playbookResult, eligibilityResult, matchingResult, prioritizationResult, impactResult, feasibilityResult, riskResult, sequencingResult, testExecuteResult, intensityResult, maturityRecommendationResult, constraintRecommendationResult, recommendationPortfolioResult, dynamicDecisionResult, restraintDecisionResult, expectedOutcomeResult, recommendationConfidenceResult, recommendationCommunicationResult, hitlApprovalResult, closureHandoffResult, executionPlanResult, readinessResult, actionEnvelopeResult, executionSupervisionResult, continuousLearningResult] = await Promise.all([
    supabase
      .from("diagnostic_cases")
      .select(
        "organization_id, id, store_id, target_metric, target_question, scope, granularity, status, finding, diagnosis_type, primary_issue, root_cause, limiting_constraint, severity, trajectory, confidence, summary, limitations, data_quality, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("diagnostic_outputs")
      .select(
        "organization_id, case_id, status, completeness_status, blocking_components, missing_components, finalization_status, diagnostic_summary, limitation_summary, confidence_summary, data_gap_summary, confidence, confidence_language, failure_kind, degraded, manual_review_required, handoff_ready, evaluated_at",
      )
      .eq("organization_id", organizationId)
      .eq("is_current", true)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("diagnostic_robustness")
      .select(
        "organization_id, case_id, review_status, false_diagnosis_risk, survival_status, robustness, diagnosis_stability, confidence_before, confidence_after, revision_triggered, reopened_blocks, remaining_limitations, red_team_required_evidence, reviewed_at",
      )
      .eq("organization_id", organizationId)
      .eq("review_status", "current")
      .order("reviewed_at", { ascending: false })
      .limit(100),
    supabase
      .from("temporal_diagnoses")
      .select(
        "organization_id, case_id, assessment_status, current_state, trajectory, short_term_trajectory, medium_term_trajectory, long_term_trajectory, temporal_sufficiency, baseline_status, trajectory_confidence, limitations, assessed_at",
      )
      .eq("organization_id", organizationId)
      .eq("assessment_status", "current")
      .order("assessed_at", { ascending: false })
      .limit(100),
    supabase
      .from("decision_contexts")
      .select(
        "organization_id, as_of, context_status, context_confidence, primary_objective_kind, primary_objective_statement, unresolved_unknowns, reason_codes, result",
      )
      .eq("organization_id", organizationId)
      .is("invalidated_at", null)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("decision_outputs")
      .select("organization_id, candidate_ref, as_of, decision_status, reason_codes, result")
      .eq("organization_id", organizationId)
      .order("assessed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("playbook_framework_runs")
      .select(
        "organization_id, domain, disposition, candidate_count, selected_instance_id, as_of, unresolved_unknowns, reason_codes, source_refs, input_envelope, result",
      )
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("intervention_eligibility_runs")
      .select(
        "organization_id, disposition, candidate_count, eligible_count, as_of, unresolved_unknowns, reason_codes, source_refs, result",
      )
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("intervention_matching_runs")
      .select(
        "organization_id, disposition, candidate_count, matched_count, as_of, unresolved_unknowns, reason_codes, source_refs, result",
      )
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("intervention_prioritization_runs")
      .select("organization_id, disposition, candidate_count, primary_priority_candidate_id, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("intervention_impact_runs")
      .select("organization_id, disposition, candidate_count, primary_priority_candidate_id, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("intervention_feasibility_runs")
      .select("organization_id, disposition, candidate_count, primary_priority_candidate_id, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("intervention_risk_runs")
      .select("organization_id, disposition, candidate_count, primary_priority_candidate_id, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("intervention_sequencing_runs")
      .select("organization_id, disposition, candidate_count, primary_priority_candidate_id, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("intervention_test_execute_runs")
      .select("organization_id, disposition, candidate_count, primary_priority_candidate_id, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("intervention_intensity_runs")
      .select("organization_id, disposition, candidate_count, primary_priority_candidate_id, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("maturity_recommendation_runs")
      .select("organization_id, disposition, candidate_count, primary_priority_candidate_id, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("constraint_recommendation_runs")
      .select("organization_id, disposition, candidate_count, primary_priority_candidate_id, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("recommendation_portfolio_runs")
      .select("organization_id, disposition, candidate_count, primary_candidate_id, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("dynamic_decision_runs")
      .select("organization_id, disposition, unit_count, overall_decision, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("restraint_decision_runs")
      .select("organization_id, disposition, decision, scope, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("expected_outcome_runs")
      .select("organization_id, disposition, scope, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("recommendation_confidence_runs")
      .select("organization_id, disposition, scope, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("recommendation_communication_runs")
      .select("organization_id, disposition, scope, primary_recommendation, as_of, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("hitl_approval_assessment_runs")
      .select("organization_id, action_id, as_of, evaluated_at, disposition, autonomy_level, approval_requirement, approval_state, approval_gate, execution_state, unresolved_unknowns, reason_codes, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("execution_closure_runs")
      .select("organization_id, intervention_id, recommendation_id, as_of, evaluated_at, closure_state, closure_gate, operational_outcome, verification_status, closure_quality, outcome_maturity, handoff_status, final_state_snapshot, blockers, unresolved_unknowns, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase
      .from("execution_plan_runs")
      .select("organization_id, recommendation_id, plan_version, plan_status, execution_intent, objective, ordered_action_ids, critical_path, blockers, unresolved_unknowns, source_refs, evaluated_at, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
    supabase.from("readiness_assessment_runs").select("organization_id, plan_id, action_id, scope, readiness_decision, blocking_reasons, unresolved_unknowns, source_refs, evaluated_at, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(20),
    supabase.from("action_envelope_runs").select("organization_id, context_id, business_id, envelope_version, envelope_zone, violations, warnings, unresolved_unknowns, source_refs, evaluated_at, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(20),
    supabase.from("execution_supervision_runs").select("organization_id, context_id, plan_id, action_id, stage, decision, blockers, warnings, unresolved_unknowns, source_refs, evaluated_at, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(100),
    supabase.from("continuous_learning_runs").select("organization_id, block_code, experience_id, evaluated_at, status, classification, confidence, gate, rationale, learning, next_evidence_needed, unresolved_unknowns, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(120),
  ]);

  const blocks = buildDecisionPlaybookContextBlocks({
    diagnosticCases: diagnosticCaseResult.error
      ? []
      : tenantRows(diagnosticCaseResult.data, organizationId),
    diagnosticOutputs: diagnosticOutputResult.error
      ? []
      : tenantRows(diagnosticOutputResult.data, organizationId),
    robustnessReviews: robustnessResult.error
      ? []
      : tenantRows(robustnessResult.data, organizationId),
    temporalDiagnoses: temporalResult.error
      ? []
      : tenantRows(temporalResult.data, organizationId),
    decisionContext: contextResult.error
      ? undefined
      : tenantRow(contextResult.data, organizationId),
    decisionOutput: outputResult.error
      ? undefined
      : tenantRow(outputResult.data, organizationId),
    playbookRuns: playbookResult.error
      ? []
      : tenantRows(playbookResult.data, organizationId),
    interventionEligibilityRuns: eligibilityResult.error
      ? []
      : tenantRows(eligibilityResult.data, organizationId),
    interventionMatchingRuns: matchingResult.error
      ? []
      : tenantRows(matchingResult.data, organizationId),
    interventionPrioritizationRuns: prioritizationResult.error
      ? []
      : tenantRows(prioritizationResult.data, organizationId),
    interventionImpactRuns: impactResult.error
      ? []
      : tenantRows(impactResult.data, organizationId),
    interventionFeasibilityRuns: feasibilityResult.error
      ? []
      : tenantRows(feasibilityResult.data, organizationId),
    interventionRiskRuns: riskResult.error
      ? []
      : tenantRows(riskResult.data, organizationId),
    interventionSequencingRuns: sequencingResult.error
      ? []
      : tenantRows(sequencingResult.data, organizationId),
    interventionTestExecuteRuns: testExecuteResult.error
      ? []
      : tenantRows(testExecuteResult.data, organizationId),
    interventionIntensityRuns: intensityResult.error
      ? []
      : tenantRows(intensityResult.data, organizationId),
    maturityRecommendationRuns: maturityRecommendationResult.error
      ? []
      : tenantRows(maturityRecommendationResult.data, organizationId),
    constraintRecommendationRuns: constraintRecommendationResult.error
      ? []
      : tenantRows(constraintRecommendationResult.data, organizationId),
    recommendationPortfolioRuns: recommendationPortfolioResult.error
      ? []
      : tenantRows(recommendationPortfolioResult.data, organizationId),
    dynamicDecisionRuns: dynamicDecisionResult.error
      ? []
      : tenantRows(dynamicDecisionResult.data, organizationId),
    restraintDecisionRuns: restraintDecisionResult.error
      ? []
      : tenantRows(restraintDecisionResult.data, organizationId),
    expectedOutcomeRuns: expectedOutcomeResult.error
      ? []
      : tenantRows(expectedOutcomeResult.data, organizationId),
    recommendationConfidenceRuns: recommendationConfidenceResult.error
      ? []
      : tenantRows(recommendationConfidenceResult.data, organizationId),
    recommendationCommunicationRuns: recommendationCommunicationResult.error
      ? []
      : tenantRows(recommendationCommunicationResult.data, organizationId),
    hitlApprovalRuns: hitlApprovalResult.error
      ? []
      : tenantRows(hitlApprovalResult.data, organizationId),
    closureHandoffRuns: closureHandoffResult.error
      ? []
      : tenantRows(closureHandoffResult.data, organizationId),
    executionPlanRuns: executionPlanResult.error
      ? []
      : tenantRows(executionPlanResult.data, organizationId),
    readinessRuns: readinessResult.error ? [] : tenantRows(readinessResult.data, organizationId),
    actionEnvelopeRuns: actionEnvelopeResult.error ? [] : tenantRows(actionEnvelopeResult.data, organizationId),
    executionSupervisionRuns: executionSupervisionResult.error ? [] : tenantRows(executionSupervisionResult.data, organizationId),
    continuousLearningRuns: continuousLearningResult.error ? [] : tenantRows(continuousLearningResult.data, organizationId),
  });
  if (diagnosticCaseResult.error || diagnosticOutputResult.error || robustnessResult.error || temporalResult.error) {
    blocks[0] = unavailableBlock(
      "F3 DIAGNÓSTICO",
    );
  }
  if (contextResult.error) {
    blocks[1] = unavailableBlock(
      blocks[1]?.label ?? "F4 CONTEXTO DE DECISIÓN",
    );
  }
  if (outputResult.error) {
    blocks[2] = unavailableBlock(blocks[2]?.label ?? "F4 SALIDA DECISIONAL");
  }
  if (playbookResult.error) {
    blocks[3] = unavailableBlock(
      blocks[3]?.label ?? "F5/F6 PLAYBOOKS, BENCHMARKS Y GUARDRAILS",
    );
  }
  if (eligibilityResult.error) {
    blocks[4] = unavailableBlock(
      blocks[4]?.label ?? "F7.01 ELEGIBILIDAD",
    );
  }
  if (matchingResult.error) {
    blocks[5] = unavailableBlock(
      blocks[5]?.label ?? "F7.02 MATCHING",
    );
  }
  if (prioritizationResult.error) {
    blocks[6] = unavailableBlock(
      blocks[6]?.label ?? "F7.03 PRIORIZACIÓN",
    );
  }
  if (impactResult.error) {
    blocks[7] = unavailableBlock(blocks[7]?.label ?? "F7.04 IMPACTO ESPERADO");
  }
  if (feasibilityResult.error) {
    blocks[8] = unavailableBlock(blocks[8]?.label ?? "F7.05 FACTIBILIDAD");
  }
  if (riskResult.error) {
    blocks[9] = unavailableBlock(blocks[9]?.label ?? "F7.06 RIESGO Y REVERSIBILIDAD");
  }
  if (sequencingResult.error) {
    blocks[10] = unavailableBlock(blocks[10]?.label ?? "F7.07 SECUENCIACIÓN Y DEPENDENCIAS");
  }
  if (testExecuteResult.error) {
    blocks[11] = unavailableBlock(blocks[11]?.label ?? "F7.08 TEST VS EXECUTE");
  }
  if (intensityResult.error) {
    blocks[12] = unavailableBlock(blocks[12]?.label ?? "F7.09 INTENSIDAD");
  }
  if (maturityRecommendationResult.error) {
    blocks[13] = unavailableBlock(blocks[13]?.label ?? "F7.10 RECOMENDACIONES POR MADUREZ");
  }
  if (constraintRecommendationResult.error) {
    blocks[14] = unavailableBlock(blocks[14]?.label ?? "F7.11 RECOMENDACIONES BAJO RESTRICCIONES");
  }
  if (recommendationPortfolioResult.error) {
    blocks[15] = unavailableBlock(blocks[15]?.label ?? "F7.12 PORTAFOLIO DE RECOMENDACIONES");
  }
  if (dynamicDecisionResult.error) {
    blocks[16] = unavailableBlock(blocks[16]?.label ?? "F7.13 STOP / CONTINUE / SCALE / ROLLBACK");
  }
  if (restraintDecisionResult.error) {
    blocks[17] = unavailableBlock(blocks[17]?.label ?? "F7.14 NO-ACTION / WAIT / GATHER EVIDENCE");
  }
  if (expectedOutcomeResult.error) {
    blocks[18] = unavailableBlock(blocks[18]?.label ?? "F7.15 EXPECTED OUTCOME Y SUCCESS CRITERIA");
  }
  if (recommendationConfidenceResult.error) {
    blocks[19] = unavailableBlock(blocks[19]?.label ?? "F7.17 CONFIANZA CALIBRADA");
  }
  if (recommendationCommunicationResult.error) {
    blocks[20] = unavailableBlock(blocks[20]?.label ?? "F7.18 COMUNICACIÓN DE RECOMENDACIONES");
  }
  if (hitlApprovalResult.error) {
    blocks[21] = unavailableBlock(blocks[21]?.label ?? "F8.02 HITL Y APROBACIÓN");
  }
  if (closureHandoffResult.error) {
    blocks[22] = unavailableBlock(blocks[22]?.label ?? "F8.16 CIERRE, HANDOFF Y RESULTADO");
  }
  if (executionPlanResult.error) {
    blocks[23] = unavailableBlock("F8.03 PLAN DE EJECUCIÓN");
  }
  if (readinessResult.error) {
    blocks[24] = unavailableBlock("F8.04 READINESS Y PRECONDICIONES");
  }
  if (actionEnvelopeResult.error) {
    blocks[25] = unavailableBlock("F8.05 ACTION ENVELOPE");
  }
  if (executionSupervisionResult.error) {
    blocks[26] = unavailableBlock("F8.06-F8.17 SUPERVISIÓN DE EJECUCIÓN");
  }
  if (continuousLearningResult.error) {
    blocks[27] = unavailableBlock("F9 APRENDIZAJE CONTINUO");
  }
  return blocks;
}
