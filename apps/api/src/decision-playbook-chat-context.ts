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
    as_of: text(item.as_of, "unknown_date"),
  };
}

export function buildDecisionPlaybookContextBlocks(input: {
  decisionContext?: unknown;
  decisionOutput?: unknown;
  playbookRuns?: unknown[];
}): ConsultantChatContextBlock[] {
  const blocks: ConsultantChatContextBlock[] = [];
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
      "F5 PLAYBOOKS (catálogo evaluado; solo ACTIVE y aplicables pueden sostener una recomendación)",
    data: playbooks.length
      ? playbooks.map(summarizePlaybookRun)
      : "sin_evaluaciones_actuales; no inventar una estrategia ni una intervención",
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
  const [contextResult, outputResult, playbookResult] = await Promise.all([
    supabase
      .from("decision_contexts")
      .select(
        "as_of, context_status, context_confidence, primary_objective_kind, primary_objective_statement, unresolved_unknowns, reason_codes, result",
      )
      .eq("organization_id", organizationId)
      .is("invalidated_at", null)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("decision_outputs")
      .select("candidate_ref, as_of, decision_status, reason_codes, result")
      .eq("organization_id", organizationId)
      .order("assessed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("playbook_framework_runs")
      .select(
        "domain, disposition, candidate_count, selected_instance_id, as_of, unresolved_unknowns, reason_codes, source_refs, result",
      )
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(20),
  ]);

  const blocks = buildDecisionPlaybookContextBlocks({
    decisionContext: contextResult.error ? undefined : contextResult.data,
    decisionOutput: outputResult.error ? undefined : outputResult.data,
    playbookRuns: playbookResult.error ? [] : playbookResult.data ?? [],
  });
  if (contextResult.error) {
    blocks[0] = unavailableBlock(
      blocks[0]?.label ?? "F4 CONTEXTO DE DECISIÓN",
    );
  }
  if (outputResult.error) {
    blocks[1] = unavailableBlock(blocks[1]?.label ?? "F4 SALIDA DECISIONAL");
  }
  if (playbookResult.error) {
    blocks[2] = unavailableBlock(blocks[2]?.label ?? "F5 PLAYBOOKS");
  }
  return blocks;
}
