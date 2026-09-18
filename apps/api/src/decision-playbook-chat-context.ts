import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsultantChatContextBlock = {
  label: string;
  data: unknown;
};

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
  const [diagnosticCaseResult, diagnosticOutputResult, robustnessResult, temporalResult, contextResult, outputResult, playbookResult, eligibilityResult, matchingResult] = await Promise.all([
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
  return blocks;
}
