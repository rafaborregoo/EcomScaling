// Fase 11 (conocimiento/fase-11-executive-ecommerce-diagnosis/03-runtime/11.02):
// ensamblador del diagnostico ejecutivo. Es LECTURA + COMPOSICION: une por id
// lo que ya persisten F3 (D14, D10, D11), F4, F7 y F10, y nunca recalcula
// severidad, confianza, prioridad, impacto ni recomendaciones. La vista es un
// DTO efimero: no hay tabla, ni contrato persistente, ni ledger nuevo.
//
// Joins reales (auditados en el codigo de los motores, no supuestos):
//  - D14 -> caso: diagnostic_outputs.case_id (FK). Severidad, causa, constraint y
//    temporal: ids en la propia fila de D14.
//  - F4.04 decision_impact_assessments.candidate_ref = diagnostic_cases.id.
//  - F4.06-4.12 (decision_outputs, decision_rankings): candidate_ref = caso. Los
//    bloques por candidato evaluan CADA caso abierto (F11.1) y sin casos no
//    escriben: la organizacion no es un candidato. Filas historicas con la
//    organizacion como candidate_ref existen y no se le atribuyen a ningun caso.
//  - F4.00 prioritization_runs: una fila por organizacion; el candidato es
//    diagnostic_outputs.id (otro dominio que F4.03-4.12; el puente es output.case_id).
//    P0 es el contenedor por contrato y no calcula prioridad: `classification`
//    nace de P1-P10, que hoy no corren con datos del tenant. Se lee si existe,
//    nunca se infiere.
//  - F7: corre por organizacion y dia, sin FK a D14. La cadena de intervenciones
//    (matching/eligibility) escribe `diagnosis_refs` = todos los D14 vigentes; la
//    cadena 7.12-7.18 no lee D14. El vinculo se expresa en `link_state`
//    (diagnosis_linked | organization_level | historical | unlinked) y solo
//    diagnosis_linked permite atribuir la recomendacion a un diagnostico.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaminoPlanOutput } from "@e-nora/ai";
import type { CrossChannelMeasurementSet } from "@e-nora/contracts";

type Row = Record<string, unknown>;

// --- Mapeos de presentacion (11.01 §4-§6). Siempre conservan el valor original.

export type Mapped = { raw: string | null; source: string; presentation: string | null };

/** D-family conserva su vocabulario; el agente usa `medium` donde D10 usa `moderate`. */
export function mapSeverity(source: "d_family" | "agent", raw: unknown): Mapped & { visual_bucket: string | null } {
  const value = typeof raw === "string" && raw ? raw : null;
  const presentation = source === "agent" && value === "medium" ? "moderate" : value;
  // Solo para una escala visual comun; `business_threat` sigue siendo su raw_value.
  const visual_bucket = presentation === "business_threat" ? "critical" : presentation;
  return { raw: value, source, presentation, visual_bucket };
}

const CONFIDENCE_PRESENTATION: Record<string, string> = {
  high: "high", medium: "medium", low: "low", insufficient_data: "unknown",
  HIGH: "high", MEDIUM: "medium", LOW: "low", UNKNOWN: "unknown",
};

/** La suficiencia decisional de F4 NO pasa por aqui: se expone aparte. */
export function mapConfidence(source: "d_family" | "agent" | "f4_f7", raw: unknown): Mapped {
  const value = typeof raw === "string" && raw ? raw : null;
  return { raw: value, source, presentation: value ? (CONFIDENCE_PRESENTATION[value] ?? null) : null };
}

// --- Vista

/**
 * Relacion de un run de F7 con ESTE D14 (no crea vocabulario de dominio nuevo: es la vista del enlace).
 * - diagnosis_linked: el run cita este D14 y ninguno mas.
 * - organization_level: el run es de la organizacion (cita a varios D14, o su cadena no nace de D14).
 * - historical: el run es anterior a este D14; no pudo derivarse de el.
 * - unlinked: no hay referencia explicita a este D14 (cita otros, o no cita ninguno donde deberia).
 * Solo diagnosis_linked permite atribuir la recomendacion a este diagnostico.
 */
export type DiagnosisLinkState = "diagnosis_linked" | "organization_level" | "historical" | "unlinked";

export type StageRef = {
  run_id: string;
  disposition: string | null;
  evaluated_at: string | null;
  context_id: string | null;
  decision_cycle_id: string | null;
  link_state: DiagnosisLinkState;
  /** Donde esta la referencia explicita (`diagnosis_refs`, `source_refs`) o null si no hay. */
  link_via: string | null;
  /** Cuantos D14 vigentes cita el run. */
  cited_diagnosis_count: number;
  predates_diagnosis: boolean;
};

export type F7Stage = "matching" | "prioritization" | "portfolio" | "restraint" | "confidence" | "communication" | "expected_outcome";

// Verificado en el codigo: la cadena 7.12-7.18 nace de maturity_recommendation_runs / dynamic_decision_runs, que no leen D14.
// Sin referencia explicita a un D14, esas etapas son de organizacion; las de la cadena de intervenciones (7.01-7.11) deberian citarlo.
const ORG_LEVEL_STAGES: ReadonlySet<F7Stage> = new Set(["portfolio", "restraint", "confidence", "communication", "expected_outcome"]);

export type ExecutiveDiagnosisView = {
  identity: {
    organization_id: string;
    store_id: string | null;
    diagnostic_case_id: string | null;
    diagnostic_output_id: string;
    severity_assessment_id: string | null;
    root_cause_id: string | null;
    constraint_id: string | null;
    temporal_diagnosis_id: string | null;
    prioritization_run_id: string | null;
    decision_output_id: string | null;
    decision_impact_assessment_id: string | null;
    f7_run_ids: Record<string, string | null>;
    expected_outcome_run_id: string | null;
  };
  diagnosis: {
    status: string | null;
    target_metric: string | null;
    primary_issue: string | null;
    root_cause: { id: string | null; statement: string | null; status: string | null; state: "validated" | "hypothesis_state" | "none" };
    limiting_constraint: string | null;
    severity: ReturnType<typeof mapSeverity>;
    confidence: Mapped;
    claim_confidence: { level: string | null; capped_at: string | null; cap_reason: string | null } | null;
    trajectory: string | null;
    hypotheses: Array<{ code: string; statement: string; status: string; rejection_reason: string | null }>;
    user_summary: string | null;
    diagnostic_summary: string | null;
    what_we_know: unknown;
    what_we_dont_know: unknown;
  };
  measured_impact: {
    status: "available" | "unavailable";
    basis: "d10_measured";
    reason: string | null;
    items: Array<Row & { is_observed: boolean }>;
  };
  decision_impact: {
    status: "available" | "unavailable";
    basis: "f4_04_potential_decisional";
    reason: string | null;
    assessment: string | null;
    value_state: string | null;
    value_type: string | null;
    impact_type: string | null;
    quantified: boolean;
    magnitude: unknown;
    scenarios: unknown;
    incrementality: unknown;
    confidence: unknown;
    unresolved_unknowns: unknown;
  };
  priority: {
    status: "available" | "abstained" | "priority_unavailable";
    reason: string | null;
    source: "f4";
    classification: string | null;
    rank: number | null;
    decision_type: string | null;
    /** Suficiencia para decidir (F4). Dimension propia: no es confianza. */
    decision_sufficiency: string | null;
    run_status: string | null;
    decision_validity: string | null;
    abstention_reason_codes: string[];
    unresolved_unknowns: string[];
    link_basis: string | null;
  };
  recommendation: {
    status: "available" | "no_action" | "validation_required" | "unavailable";
    reason: string | null;
    source: "f7";
    primary_candidate_id: string | null;
    /** Relacion del portafolio F7 con ESTE D14. Solo `diagnosis_linked` permite atribuirle la recomendacion. */
    link_state: DiagnosisLinkState;
    attributable_to_diagnosis: boolean;
    restraint: (StageRef & { decision: string | null; rationale: string | null }) | null;
    portfolio: StageRef | null;
    prioritization: (StageRef & { primary_priority_candidate_id: string | null }) | null;
    matching: StageRef | null;
    confidence: StageRef | null;
    communication: (StageRef & { primary_recommendation: string | null }) | null;
  };
  expected_outcome: {
    status: "criteria_available" | "validation_required" | "unavailable";
    kind: "expected_not_observed";
    reason: string | null;
    run: StageRef | null;
    link_state: DiagnosisLinkState;
    attributable_to_diagnosis: boolean;
    recommendation: string | null;
    causal_thesis: string | null;
    direction: string | null;
    magnitude: string | null;
    magnitude_supported: boolean;
    outcome_horizon: string | null;
    primary_success_criterion: string | null;
    outcome_confidence: string | null;
    quality_flags: string[];
    unresolved_unknowns: string[];
    /** Siempre null: no existe outcome observado en el modelo de datos actual. */
    observed_outcome: null;
  };
  evidence_refs: Array<Row & { kind: string }>;
  has_contradicting_evidence: boolean;
  attribution_evidence_refs: Array<{
    metric_id: string;
    source_system: string;
    channel: string;
    attribution_basis: string | null;
    attribution_model: string | null;
    attribution_window: string | null;
    currency_code: string | null;
    revenue_basis: string;
    value_state: string;
    evidence_role: string;
    comparison_status: string | null;
    dependency_pct: number | null;
    dependency_is_incrementality: false;
    limitations: string[];
  }>;
  tenant_context: { status: "available" | "empty"; facts: Record<string, string>; currency_code: string | null };
  limitations: string[];
  data_gaps: Array<{ required_data: string; reason: string; impact_on_diagnosis: string | null; affected_hypothesis: string | null }>;
  validation_state: {
    canonical: boolean;
    finalization_status: string | null;
    validation_passed: boolean | null;
    handoff_ready: boolean | null;
    completeness_status: string | null;
    degraded: boolean | null;
    manual_review_required: boolean | null;
    /** F11 solo prueba composicion; la validacion con datos reales es otra tarea. */
    validation_kind: "technical";
  };
  executive_narrative: { source: "deterministic_template"; text: string; steps: Array<{ step: string; text: string }> };
};

export type ExecutiveDiagnosisSources = {
  output: Row;
  case_row?: Row | null;
  root_cause?: Row | null;
  constraint?: Row | null;
  severity?: Row | null;
  impact_measurements?: Row[];
  claim_confidence?: Row[];
  hypotheses?: Row[];
  evidence?: Row[];
  output_evidence?: Row[];
  data_gaps?: Row[];
  decision_impact?: Row | null;
  prioritization_run?: Row | null;
  ranking?: Row | null;
  decision_output?: Row | null;
  f7?: Partial<Record<F7Stage, Row | null>>;
  /** Ids de todos los D14 vigentes de la organizacion: permiten saber si un run cita a otros diagnosticos. */
  org_output_ids?: string[];
  tenant_facts?: Row[];
  organization_currency?: string | null;
  attribution?: CrossChannelMeasurementSet[];
  load_errors?: string[];
};

const rec = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : []);
const list = (v: unknown): Row[] => (Array.isArray(v) ? v.map(rec) : []);
const uniq = (v: string[]) => [...new Set(v.filter(Boolean))];

/** D14 vigentes que el run cita por id exacto: `diagnosis_refs` (campo de diagnosticos) o cualquier ref de lineage que sea un id de D14 conocido. */
function citedDiagnoses(row: Row, known: ReadonlySet<string>): { ids: Set<string>; via: string | null } {
  const envelope = rec(row.input_envelope);
  const context = rec(envelope.context);
  const explicit = strs(context.diagnosis_refs);
  const lineage = [row.source_refs, rec(row.result).source_refs, context.evidence_refs, envelope.source_refs].flatMap(strs).filter((r) => known.has(r));
  const ids = new Set([...explicit, ...lineage]);
  return { ids, via: explicit.length ? "diagnosis_refs" : lineage.length ? "source_refs" : null };
}

function stageRef(row: Row | null | undefined, s: ExecutiveDiagnosisSources, stage: F7Stage): StageRef | null {
  if (!row) return null;
  const outputId = String(s.output.id);
  const { ids: cited, via } = citedDiagnoses(row, new Set([outputId, ...(s.org_output_ids ?? [])]));
  const evaluatedAt = str(row.evaluated_at);
  const outputAt = str(s.output.evaluated_at);
  const predates = Boolean(evaluatedAt && outputAt && evaluatedAt < outputAt);
  // Una referencia explicita a este D14 gana; despues, que el run sea anterior; despues, lo que cite o deje de citar.
  const link_state: DiagnosisLinkState = cited.has(outputId)
    ? cited.size === 1 ? "diagnosis_linked" : "organization_level"
    : predates ? "historical"
      : cited.size > 0 ? "unlinked"
        : ORG_LEVEL_STAGES.has(stage) ? "organization_level" : "unlinked";
  return {
    run_id: String(row.id),
    disposition: str(row.disposition),
    evaluated_at: evaluatedAt,
    context_id: str(row.context_id),
    decision_cycle_id: str(row.decision_cycle_id),
    link_state,
    link_via: via,
    cited_diagnosis_count: cited.size,
    predates_diagnosis: predates,
  };
}

function resolvePriority(s: ExecutiveDiagnosisSources, caseId: string | null): ExecutiveDiagnosisView["priority"] {
  const outputId = String(s.output.id);
  const run = rec(s.prioritization_run?.result);
  const evaluation = list(run.candidate_evaluation_refs).find((c) => c.candidate_id === outputId) ?? null;
  const rankedCandidate = caseId
    ? list(rec(s.ranking?.result).ranked_candidates).find((c) => c.candidate_ref === caseId) ?? null
    : null;
  // Un decision_output cuyo candidato es la organizacion (fallback del motor) no es de este caso.
  const decision = s.decision_output && caseId && s.decision_output.candidate_ref === caseId ? rec(s.decision_output.result) : null;

  const classification = str(evaluation?.classification);
  const rank = num(evaluation?.rank) ?? num(rankedCandidate?.rank) ?? num(decision?.rank);
  const decisionType = str(decision?.decision_type);
  const base = {
    source: "f4" as const,
    run_status: str(run.run_status) ?? str(s.prioritization_run?.run_status),
    decision_validity: str(run.decision_validity) ?? str(s.prioritization_run?.decision_validity),
    abstention_reason_codes: strs(run.abstention_reason_codes),
    unresolved_unknowns: uniq([...strs(run.unresolved_unknowns), ...strs(decision?.unknowns)]),
    decision_sufficiency: str(evaluation?.decision_confidence) ?? str(decision?.decision_confidence),
    link_basis: evaluation ? "diagnostic_output_id" : rankedCandidate || decision ? "diagnostic_case_id" : null,
  };
  if (classification || rank !== null || (decisionType && decisionType !== "ABSTAIN")) {
    return { ...base, status: "available", reason: null, classification, rank, decision_type: decisionType };
  }
  if (decisionType === "ABSTAIN" || str(s.ranking?.ranking_status) === "ABSTAIN" || str(base.run_status) === "ABSTAINED") {
    return { ...base, status: "abstained", reason: "F4 se abstuvo; no se infiere prioridad", classification: null, rank: null, decision_type: decisionType };
  }
  return {
    ...base,
    status: "priority_unavailable",
    reason: s.prioritization_run || s.ranking || s.decision_output ? "F4 no evaluo este diagnostico" : "sin prioridad F4",
    classification: null,
    rank: null,
    decision_type: decisionType,
  };
}

function resolveRecommendation(s: ExecutiveDiagnosisSources): ExecutiveDiagnosisView["recommendation"] {
  const f7 = s.f7 ?? {};
  const restraintRow = f7.restraint ?? null;
  const restraintResult = rec(restraintRow?.result);
  const restraint = restraintRow
    ? { ...(stageRef(restraintRow, s, "restraint") as StageRef), decision: str(restraintResult.decision), rationale: str(restraintResult.rationale) }
    : null;
  const portfolio = stageRef(f7.portfolio, s, "portfolio");
  const prioritizationRow = f7.prioritization ?? null;
  const prioritization = prioritizationRow
    ? { ...(stageRef(prioritizationRow, s, "prioritization") as StageRef), primary_priority_candidate_id: str(prioritizationRow.primary_priority_candidate_id) }
    : null;
  const communicationRow = f7.communication ?? null;
  const communication = communicationRow
    ? { ...(stageRef(communicationRow, s, "communication") as StageRef), primary_recommendation: str(communicationRow.primary_recommendation) }
    : null;
  const primary = str(f7.portfolio?.primary_candidate_id);
  const common = {
    source: "f7" as const,
    primary_candidate_id: primary,
    link_state: (portfolio?.link_state ?? "unlinked") as DiagnosisLinkState,
    attributable_to_diagnosis: portfolio?.link_state === "diagnosis_linked",
    restraint,
    portfolio,
    prioritization,
    matching: stageRef(f7.matching, s, "matching"),
    confidence: stageRef(f7.confidence, s, "confidence"),
    communication,
  };
  const held = restraint?.disposition === "DECISION_AVAILABLE" && ["NO_ACTION", "WAIT", "GATHER_EVIDENCE"].includes(restraint.decision ?? "");
  if (held) {
    return { ...common, status: "no_action", reason: `F7.14: ${restraint?.decision}${restraint?.rationale ? ` — ${restraint.rationale}` : ""}` };
  }
  if (portfolio?.disposition === "PORTFOLIO_AVAILABLE" && primary) return { ...common, status: "available", reason: null };
  if (portfolio?.disposition === "VALIDATION_REQUIRED" || restraint?.disposition === "VALIDATION_REQUIRED") {
    return { ...common, status: "validation_required", reason: "F7 exige validar antes de recomendar" };
  }
  return { ...common, status: "unavailable", reason: portfolio ? `F7.12: ${portfolio.disposition}` : "sin ejecucion de F7" };
}

function resolveExpectedOutcome(s: ExecutiveDiagnosisSources): ExecutiveDiagnosisView["expected_outcome"] {
  const row = s.f7?.expected_outcome ?? null;
  const result = rec(row?.result);
  const run = stageRef(row, s, "expected_outcome");
  const magnitude = str(result.magnitude);
  const disposition = str(row?.disposition);
  const status =
    disposition === "OUTCOME_CRITERIA_AVAILABLE" ? "criteria_available" : disposition === "VALIDATION_REQUIRED" ? "validation_required" : "unavailable";
  return {
    status,
    kind: "expected_not_observed",
    reason: status === "criteria_available" ? null : row ? `7.15: ${disposition}` : "sin resultado esperado",
    run,
    link_state: run?.link_state ?? "unlinked",
    attributable_to_diagnosis: run?.link_state === "diagnosis_linked",
    recommendation: str(result.recommendation),
    causal_thesis: str(result.causal_thesis),
    direction: str(result.direction),
    magnitude,
    // NOT_DECLARED/UNKNOWN: la cifra no esta soportada, no vale 0.
    magnitude_supported: Boolean(magnitude && !["NOT_DECLARED", "UNKNOWN"].includes(magnitude)),
    outcome_horizon: str(result.outcome_horizon),
    primary_success_criterion: str(result.primary_success_criterion),
    outcome_confidence: str(result.outcome_confidence),
    quality_flags: strs(result.quality_flags),
    unresolved_unknowns: strs(result.unresolved_unknowns),
    observed_outcome: null,
  };
}

function buildEvidence(s: ExecutiveDiagnosisSources): { refs: ExecutiveDiagnosisView["evidence_refs"]; contradicting: boolean } {
  const refs: ExecutiveDiagnosisView["evidence_refs"] = [];
  for (const e of s.evidence ?? []) {
    refs.push({
      kind: "diagnostic_evidence", id: e.id, code: e.code, source: e.source, source_system: e.source_system, metric: e.metric,
      period_start: e.period_start, period_end: e.period_end, reliability: e.reliability, contradiction_strength: e.contradiction_strength,
      observed_at: e.observed_at, freshness: e.freshness,
    });
  }
  for (const e of s.output_evidence ?? []) {
    refs.push({
      kind: "diagnostic_output_evidence", id: e.id, claim_layer: e.claim_layer, claim: e.claim, source: e.source, source_ref: e.source_ref,
      metric: e.metric, period_start: e.period_start, period_end: e.period_end, reliability: e.reliability, stance: e.stance,
    });
  }
  return { refs, contradicting: (s.output_evidence ?? []).some((e) => e.stance === "contradicting") };
}

function buildAttribution(sets: CrossChannelMeasurementSet[] | undefined): ExecutiveDiagnosisView["attribution_evidence_refs"] {
  const refs: ExecutiveDiagnosisView["attribution_evidence_refs"] = [];
  for (const set of sets ?? []) {
    const comparisonByMetric = new Map(set.comparisons.map((c) => [c.metric_id, c]));
    for (const e of [set.economic_anchor, ...set.channel_evidence]) {
      const comparison = comparisonByMetric.get(e.metric_id);
      refs.push({
        metric_id: e.metric_id,
        source_system: e.source_system,
        channel: e.channel,
        attribution_basis: e.attribution_basis,
        attribution_model: e.attribution_model,
        attribution_window: e.attribution_window,
        currency_code: e.currency_code,
        revenue_basis: e.revenue_basis,
        value_state: e.value_state,
        evidence_role: e.evidence_role,
        comparison_status: comparison?.comparison_status ?? null,
        // Relacion credito/ancla; nunca incrementalidad ni causa.
        dependency_pct: comparison?.dependency_pct ?? null,
        dependency_is_incrementality: false,
        limitations: e.limitations,
      });
    }
  }
  return refs;
}

export function composeExecutiveDiagnosisView(s: ExecutiveDiagnosisSources): ExecutiveDiagnosisView {
  const o = s.output;
  const caseId = str(o.case_id);
  const severity = s.severity ?? null;
  const overall = (s.claim_confidence ?? []).find((c) => c.claim_layer === "overall") ?? (s.claim_confidence ?? [])[0] ?? null;
  const rootCause = s.root_cause ?? null;
  const measurements = (s.impact_measurements ?? []).map((m) => ({
    dimension: m.dimension, dimension_severity: m.dimension_severity, nature: m.nature, timing: m.timing, evidence_type: m.evidence_type,
    quantification: m.quantification, metric: m.metric, value: m.value, value_low: m.value_low, value_high: m.value_high, unit: m.unit,
    period_start: m.period_start, period_end: m.period_end, likelihood: m.likelihood,
    is_observed: m.evidence_type === "observed" && m.timing !== "potential" && m.timing !== "projected",
  }));
  const impactResult = rec(s.decision_impact?.result);
  const magnitude = rec(impactResult.magnitude);
  const evidence = buildEvidence(s);
  const validationPassed = typeof o.validation_passed === "boolean" ? o.validation_passed : null;
  const finalization = str(o.finalization_status);
  const gaps = (s.data_gaps ?? []).map((g) => ({
    required_data: String(g.required_data ?? ""), reason: String(g.reason ?? ""),
    impact_on_diagnosis: str(g.impact_on_diagnosis), affected_hypothesis: str(g.affected_hypothesis),
  }));
  const limitations = uniq([
    ...[o.limitation_summary, o.data_gap_summary, o.confidence_summary].flatMap((v) => (typeof v === "string" ? [v] : [])),
    ...strs(o.missing_components).map((c) => `componente ausente: ${c}`),
    ...strs(o.blocking_components).map((c) => `componente bloqueante: ${c}`),
    ...strs(severity?.limitations),
    ...(s.claim_confidence ?? []).flatMap((c) => strs(c.limitations)),
    ...(s.load_errors ?? []).map((e) => `lectura fallida (${e}): pieza tratada como ausente, no como cero`),
  ]);
  const facts: Record<string, string> = {};
  for (const f of s.tenant_facts ?? []) if (str(f.dimension) && str(f.value)) facts[String(f.dimension)] = String(f.value);

  const view: Omit<ExecutiveDiagnosisView, "executive_narrative"> = {
    identity: {
      organization_id: String(o.organization_id),
      store_id: str(o.store_id),
      diagnostic_case_id: caseId,
      diagnostic_output_id: String(o.id),
      severity_assessment_id: str(o.severity_assessment_id),
      root_cause_id: str(o.root_cause_id),
      constraint_id: str(o.constraint_id),
      temporal_diagnosis_id: str(o.temporal_diagnosis_id),
      prioritization_run_id: str(s.prioritization_run?.id),
      decision_output_id: s.decision_output && caseId && s.decision_output.candidate_ref === caseId ? str(s.decision_output.id) : null,
      decision_impact_assessment_id: str(s.decision_impact?.id),
      f7_run_ids: Object.fromEntries(
        (["matching", "prioritization", "portfolio", "restraint", "confidence", "communication"] as const).map((k) => [k, str(s.f7?.[k]?.id)]),
      ),
      expected_outcome_run_id: str(s.f7?.expected_outcome?.id),
    },
    diagnosis: {
      status: str(o.status),
      target_metric: str(s.case_row?.target_metric),
      primary_issue: str(s.case_row?.primary_issue),
      root_cause: {
        id: str(o.root_cause_id),
        statement: str(rootCause?.statement),
        status: str(rootCause?.status),
        state: !rootCause ? "none" : o.root_cause_condition_satisfied === true ? "validated" : "hypothesis_state",
      },
      limiting_constraint: str(s.constraint?.statement),
      severity: mapSeverity("d_family", severity?.overall_severity),
      confidence: mapConfidence("d_family", o.confidence),
      claim_confidence: overall
        ? { level: str(overall.confidence_level), capped_at: str(overall.capped_at), cap_reason: str(overall.cap_reason) }
        : null,
      trajectory: str(severity?.trajectory),
      hypotheses: (s.hypotheses ?? []).map((h) => ({
        code: String(h.code ?? ""), statement: String(h.statement ?? ""), status: String(h.status ?? ""), rejection_reason: str(h.rejection_reason),
      })),
      user_summary: str(o.user_summary),
      diagnostic_summary: str(o.diagnostic_summary),
      what_we_know: o.what_we_know ?? null,
      what_we_dont_know: o.what_we_dont_know ?? null,
    },
    measured_impact: {
      status: measurements.length ? "available" : "unavailable",
      basis: "d10_measured",
      reason: measurements.length ? null : severity ? "D10 sin mediciones de impacto" : "sin evaluacion de severidad D10",
      items: measurements,
    },
    decision_impact: {
      status: s.decision_impact ? "available" : "unavailable",
      basis: "f4_04_potential_decisional",
      reason: s.decision_impact ? null : "sin evaluacion de impacto decisional F4.04",
      assessment: str(s.decision_impact?.impact_assessment),
      value_state: str(impactResult.value_state),
      value_type: str(impactResult.value_type),
      impact_type: str(impactResult.impact_type),
      quantified: num(magnitude.absolute_value) !== null,
      magnitude: impactResult.magnitude ?? null,
      scenarios: impactResult.scenarios ?? null,
      incrementality: impactResult.incrementality ?? null,
      confidence: impactResult.confidence ?? null,
      unresolved_unknowns: s.decision_impact?.unresolved_unknowns ?? null,
    },
    priority: resolvePriority(s, caseId),
    recommendation: resolveRecommendation(s),
    expected_outcome: resolveExpectedOutcome(s),
    evidence_refs: evidence.refs,
    has_contradicting_evidence: evidence.contradicting,
    attribution_evidence_refs: buildAttribution(s.attribution),
    tenant_context: {
      status: Object.keys(facts).length || s.organization_currency ? "available" : "empty",
      facts,
      currency_code: s.organization_currency ?? null,
    },
    limitations,
    data_gaps: gaps,
    validation_state: {
      canonical: finalization === "finalized_valid" && validationPassed === true,
      finalization_status: finalization,
      validation_passed: validationPassed,
      handoff_ready: typeof o.handoff_ready === "boolean" ? o.handoff_ready : null,
      completeness_status: str(o.completeness_status),
      degraded: typeof o.degraded === "boolean" ? o.degraded : null,
      manual_review_required: typeof o.manual_review_required === "boolean" ? o.manual_review_required : null,
      validation_kind: "technical",
    },
  };
  return { ...view, executive_narrative: buildExecutiveNarrative(view) };
}

// --- Narrativa (11.02 §13): solo describe lo que hay en el objeto ensamblado.

const NA = "no disponible";

export function buildExecutiveNarrative(v: Omit<ExecutiveDiagnosisView, "executive_narrative">): ExecutiveDiagnosisView["executive_narrative"] {
  const d = v.diagnosis;
  const steps: Array<{ step: string; text: string }> = [];
  const canonical = v.validation_state.canonical;

  steps.push({
    step: "que_ocurre",
    text:
      (canonical ? "" : "Diagnóstico NO validado (no es certeza). ") +
      (d.user_summary ?? d.diagnostic_summary ?? d.primary_issue ?? `Diagnóstico sobre ${d.target_metric ?? "una métrica sin nombre"}, sin resumen.`),
  });
  steps.push({
    step: "causa",
    text:
      d.root_cause.state === "validated"
        ? `Causa validada: ${d.root_cause.statement ?? NA}.`
        : d.root_cause.state === "hypothesis_state"
          ? `Causa en estado de hipótesis (${d.root_cause.status ?? "sin estado"}): ${d.root_cause.statement ?? NA}. No confirmada.`
          : `Causa raíz: ${NA}. Hipótesis: ${d.hypotheses.length ? d.hypotheses.map((h) => `${h.code} ${h.status}`).join(", ") : "ninguna registrada"}.`,
  });
  steps.push({
    step: "impacto_observado",
    text: v.measured_impact.status === "available"
      ? `Impacto observado (D10): ${v.measured_impact.items.filter((i) => i.is_observed).length} medición(es) observada(s) de ${v.measured_impact.items.length}.`
      : `Impacto observado (D10): ${NA}${v.measured_impact.reason ? ` (${v.measured_impact.reason})` : ""}.`,
  });
  steps.push({
    step: "impacto_potencial",
    text: v.decision_impact.status === "available"
      ? `Impacto potencial (F4.04, escenario, no realizado): ${v.decision_impact.quantified ? "cuantificado" : "sin cuantificar"}; estado ${v.decision_impact.value_state ?? NA}.`
      : `Impacto potencial (F4.04): ${NA}.`,
  });
  const p = v.priority;
  steps.push({
    step: "prioridad",
    text:
      p.status === "available"
        ? `Prioridad F4: ${p.classification ?? p.decision_type ?? NA}${p.rank !== null ? `, posición ${p.rank}` : ""}.`
        : p.status === "abstained"
          ? "Prioridad F4: el sistema se abstuvo; no hay prioridad."
          : `Prioridad F4: ${NA}.`,
  });
  const r = v.recommendation;
  steps.push({
    step: "recomendacion",
    text:
      r.status === "available"
        ? r.attributable_to_diagnosis
          ? `Recomendación F7 construida sobre este diagnóstico: ${r.primary_candidate_id}.`
          : `Recomendación F7 de contexto (${r.link_state}; no atribuible a este diagnóstico): ${r.primary_candidate_id}.`
        : r.status === "no_action"
          ? `Recomendación F7: no actuar todavía — ${r.reason}.`
          : `Recomendación F7: ${NA} (${r.reason}).`,
  });
  const e = v.expected_outcome;
  steps.push({
    step: "resultado_esperado",
    text:
      e.status === "criteria_available"
        ? `Resultado esperado (expectativa, no resultado real${e.attributable_to_diagnosis ? "" : `; ${e.link_state}, no atribuible a este diagnóstico`}): ${e.primary_success_criterion ?? NA}; magnitud ${e.magnitude_supported ? e.magnitude : "no soportada"}.`
        : `Resultado esperado: ${NA}${e.reason ? ` (${e.reason})` : ""}.`,
  });
  const attributed = v.attribution_evidence_refs.filter((a) => a.attribution_basis === "attributed");
  steps.push({
    step: "evidencia",
    text:
      `${v.evidence_refs.length} referencia(s) de evidencia` +
      (v.has_contradicting_evidence ? ", incluida evidencia CONTRADICTORIA conservada" : "") +
      (attributed.length
        ? `; ${attributed.length} cifra(s) atribuida(s) por plataforma (${attributed.map((a) => `${a.source_system} ${a.comparison_status ?? "sin comparar"}`).join(", ")}), que no demuestran causa ni incrementalidad.`
        : "."),
  });
  steps.push({
    step: "incertidumbre",
    text:
      `Confianza: ${d.confidence.presentation ?? NA}${d.claim_confidence?.capped_at ? ` (tope ${d.claim_confidence.capped_at})` : ""}.` +
      ` Huecos de datos: ${v.data_gaps.length}. Limitaciones: ${v.limitations.length ? v.limitations.slice(0, 3).join("; ") : "ninguna registrada"}.`,
  });
  steps.push({
    step: "siguiente_validacion",
    text: v.data_gaps[0]
      ? `Validar: ${v.data_gaps[0].required_data}.`
      : !canonical
        ? "Validar el diagnóstico antes de decidir."
        : v.validation_state.manual_review_required
          ? "Pendiente de revisión manual."
          : "Sin validación pendiente registrada; la exactitud con datos reales sigue sin comprobarse.",
  });
  return { source: "deterministic_template", text: steps.map((s) => s.text).join(" "), steps };
}

// --- Resultado global, con findings de agente separados (11.03 G-ED-001/008).

export type AgentFindingRef = {
  origin: "agent_only";
  validated: false;
  d14_relation: "no_link_available";
  agent_code: string;
  agent_version: string | null;
  produced_at: string | null;
  approval_status: string | null;
  pending_approval: boolean;
  title: string;
  severity: ReturnType<typeof mapSeverity>;
  evidence: string | null;
  area: string | null;
};

export function mapAgentFindings(rows: Row[]): AgentFindingRef[] {
  return rows.flatMap((row) => {
    const run = rec(row.agent_runs);
    const version = rec(run.agent_versions);
    const definition = rec(version.agent_definitions);
    return list(rec(row.output).findings).flatMap((f) =>
      str(f.title)
        ? [{
            origin: "agent_only" as const,
            validated: false as const,
            d14_relation: "no_link_available" as const,
            agent_code: String(definition.code ?? "unknown"),
            agent_version: str(version.version),
            produced_at: str(row.created_at),
            approval_status: str(row.status),
            pending_approval: row.status === "pending_approval",
            title: String(f.title),
            severity: mapSeverity("agent", f.severity),
            evidence: str(f.evidence),
            area: str(f.area),
          }]
        : [],
    );
  });
}

export type ExecutiveDiagnosisResult = {
  status: "ASSEMBLED" | "NO_VALIDATED_DIAGNOSTIC";
  canonical_count: number;
  views: ExecutiveDiagnosisView[];
  agent_findings_unvalidated: AgentFindingRef[];
};

export function composeExecutiveDiagnosis(input: { sources: ExecutiveDiagnosisSources[]; agentRows?: Row[] }): ExecutiveDiagnosisResult {
  const views = input.sources.map(composeExecutiveDiagnosisView);
  const canonical = views.filter((v) => v.validation_state.canonical);
  return {
    // Sin D14 valido no hay diagnostico ejecutivo canonico: los agentes quedan como contexto no validado.
    status: canonical.length ? "ASSEMBLED" : "NO_VALIDATED_DIAGNOSTIC",
    canonical_count: canonical.length,
    views,
    agent_findings_unvalidated: mapAgentFindings(input.agentRows ?? []),
  };
}

// --- Lectura (solo select). Por lotes, sin N+1; un fallo de lectura se anota y la pieza queda ausente.

const AGENT_FINDING_CODES = ["a02_monitor_negocio", "a09_copiloto_consultor"] as const;

export async function loadExecutiveDiagnosisSources(
  supabase: SupabaseClient,
  organizationId: string,
  options: { storeId?: string | null; attribution?: CrossChannelMeasurementSet[] } = {},
): Promise<{ sources: ExecutiveDiagnosisSources[]; agentRows: Row[] }> {
  const errors: string[] = [];
  const read = async <T>(label: string, run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> => {
    try {
      const { data, error } = await run();
      if (error) { errors.push(label); return null; }
      return data;
    } catch { errors.push(label); return null; }
  };

  let outputsQuery = supabase.from("diagnostic_outputs").select("*").eq("organization_id", organizationId).eq("is_current", true);
  if (options.storeId) outputsQuery = outputsQuery.eq("store_id", options.storeId);
  const outputs = (await read("diagnostic_outputs", () =>
    outputsQuery.not("status", "in", "(closed,invalidated)").order("evaluated_at", { ascending: false }).limit(20),
  )) as Row[] | null;
  const agentRows = await loadAgentRows(supabase, organizationId, options.storeId ?? null);
  if (!outputs?.length) return { sources: [], agentRows };

  const outputIds = outputs.map((o) => String(o.id));
  const caseIds = uniq(outputs.map((o) => str(o.case_id) ?? ""));
  const ids = (key: string) => uniq(outputs.map((o) => str(o[key]) ?? ""));
  const latest = (table: string) =>
    read(table, () => supabase.from(table).select("*").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle());
  const many = (table: string, column: string, values: string[]) =>
    values.length ? read(table, () => supabase.from(table).select("*").in(column, values)) : Promise.resolve(null);

  const [cases, rootCauses, constraints, severities, claims, hypotheses, evidence, outputEvidence, gaps, impacts, rankings, decisions, prioritization, tenant, org] =
    await Promise.all([
      many("diagnostic_cases", "id", caseIds),
      many("root_causes", "id", ids("root_cause_id")),
      many("business_constraints", "id", ids("constraint_id")),
      many("severity_assessments", "id", ids("severity_assessment_id")),
      many("claim_confidence", "case_id", caseIds),
      many("diagnostic_hypotheses", "case_id", caseIds),
      many("diagnostic_evidence", "case_id", caseIds),
      many("diagnostic_output_evidence", "output_id", outputIds),
      many("diagnostic_data_gaps", "case_id", caseIds),
      caseIds.length
        ? read("decision_impact_assessments", () =>
            supabase.from("decision_impact_assessments").select("*").eq("organization_id", organizationId).in("candidate_ref", caseIds).order("assessed_at", { ascending: false }))
        : Promise.resolve(null),
      read("decision_rankings", () => supabase.from("decision_rankings").select("*").eq("organization_id", organizationId).order("assessed_at", { ascending: false }).limit(1).maybeSingle()),
      caseIds.length
        ? read("decision_outputs", () =>
            supabase.from("decision_outputs").select("*").eq("organization_id", organizationId).in("candidate_ref", caseIds).order("assessed_at", { ascending: false }))
        : Promise.resolve(null),
      read("prioritization_runs", () => supabase.from("prioritization_runs").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle()),
      read("tenant_context_facts", () => supabase.from("tenant_context_facts").select("dimension, value").eq("organization_id", organizationId).is("effective_to", null)),
      read("organizations", () => supabase.from("organizations").select("currency_code").eq("id", organizationId).maybeSingle()),
    ]);
  const impactsRows = (impacts ?? []) as Row[];
  const severityRows = (severities ?? []) as Row[];
  const impactMeasurements = severityRows.length
    ? (((await read("impact_measurements", () => supabase.from("impact_measurements").select("*").in("assessment_id", severityRows.map((s) => String(s.id))))) ?? []) as Row[])
    : [];
  const [matching, prioritizationF7, portfolio, restraint, confidence, communication, expectedOutcome] = await Promise.all(
    ["intervention_matching_runs", "intervention_prioritization_runs", "recommendation_portfolio_runs", "restraint_decision_runs", "recommendation_confidence_runs", "recommendation_communication_runs", "expected_outcome_runs"].map(latest),
  );

  const byCase = (rows: Row[] | null, key: string, value: string | null) => (rows ?? []).filter((r) => r[key] === value);
  const byId = (rows: Row[] | null, id: string | null) => (rows ?? []).find((r) => r.id === id) ?? null;
  const decisionRows = (decisions ?? []) as Row[];

  const sources = outputs.map((output): ExecutiveDiagnosisSources => {
    const caseId = str(output.case_id);
    return {
      output,
      case_row: byId(cases as Row[] | null, caseId),
      root_cause: byId(rootCauses as Row[] | null, str(output.root_cause_id)),
      constraint: byId(constraints as Row[] | null, str(output.constraint_id)),
      severity: byId(severityRows, str(output.severity_assessment_id)),
      impact_measurements: impactMeasurements.filter((m) => m.assessment_id === output.severity_assessment_id),
      claim_confidence: byCase(claims as Row[] | null, "case_id", caseId),
      hypotheses: byCase(hypotheses as Row[] | null, "case_id", caseId),
      evidence: byCase(evidence as Row[] | null, "case_id", caseId),
      output_evidence: byCase(outputEvidence as Row[] | null, "output_id", String(output.id)),
      data_gaps: byCase(gaps as Row[] | null, "case_id", caseId),
      decision_impact: impactsRows.find((r) => r.candidate_ref === caseId) ?? null,
      prioritization_run: prioritization as Row | null,
      ranking: rankings as Row | null,
      decision_output: decisionRows.find((r) => r.candidate_ref === caseId) ?? null,
      org_output_ids: outputIds,
      f7: { matching, prioritization: prioritizationF7, portfolio, restraint, confidence, communication, expected_outcome: expectedOutcome } as ExecutiveDiagnosisSources["f7"] & {},
      tenant_facts: (tenant ?? []) as Row[],
      organization_currency: str(rec(org).currency_code),
      ...(options.attribution ? { attribution: options.attribution } : {}),
      load_errors: uniq(errors),
    };
  });
  return { sources, agentRows };
}

async function loadAgentRows(supabase: SupabaseClient, organizationId: string, storeId: string | null): Promise<Row[]> {
  try {
    const { data, error } = await supabase
      .from("agent_outputs")
      .select("status, created_at, output, agent_runs!inner(store_id, agent_versions!inner(version, agent_definitions!inner(code)))")
      .eq("organization_id", organizationId)
      .in("agent_runs.agent_versions.agent_definitions.code", [...AGENT_FINDING_CODES])
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) return [];
    // Mismo criterio de scope que loadPriorProposalHistory: tienda concreta y "todas" no se mezclan.
    return ((data ?? []) as Row[]).filter((row) => (rec(row.agent_runs).store_id ?? null) === storeId);
  } catch {
    return [];
  }
}

export async function getExecutiveDiagnosis(
  supabase: SupabaseClient,
  organizationId: string,
  options: { storeId?: string | null; attribution?: CrossChannelMeasurementSet[] } = {},
): Promise<ExecutiveDiagnosisResult> {
  const { sources, agentRows } = await loadExecutiveDiagnosisSources(supabase, organizationId, options);
  return composeExecutiveDiagnosis({ sources, agentRows });
}

// --- Consumidores

/** Bloque de contexto para agentes (11.03 §18): la vista manda, el agente explica. */
export function summarizeExecutiveDiagnosisForAgent(result: ExecutiveDiagnosisResult) {
  return {
    status: result.status,
    reglas: [
      "Usa primero esta vista; la raíz del diagnóstico es D14, no tu salida.",
      "No sobrescribas severidad, confianza, prioridad F4, causa ni resultado esperado.",
      "Una cifra atribuida por plataforma no demuestra causa ni incrementalidad.",
      "Una propuesta pending_approval no es una decisión validada.",
      "Conserva la incertidumbre y las contradicciones; si faltan datos críticos, abstente.",
      "Una recomendación F7 con attributable_to_diagnosis=false es de contexto: no la presentes como derivada de ese diagnóstico ni como su causa.",
      "Tus hallazgos sin correspondencia en D14 son 'agent_only' y no están validados.",
    ],
    diagnosticos: result.views.map((v) => ({
      diagnostic_output_id: v.identity.diagnostic_output_id,
      canonical: v.validation_state.canonical,
      severity: v.diagnosis.severity,
      confidence: v.diagnosis.confidence,
      root_cause: v.diagnosis.root_cause,
      priority: { status: v.priority.status, classification: v.priority.classification, rank: v.priority.rank, decision_type: v.priority.decision_type },
      recommendation: { status: v.recommendation.status, primary_candidate_id: v.recommendation.primary_candidate_id, reason: v.recommendation.reason, link_state: v.recommendation.link_state, attributable_to_diagnosis: v.recommendation.attributable_to_diagnosis },
      expected_outcome: { status: v.expected_outcome.status, kind: v.expected_outcome.kind, link_state: v.expected_outcome.link_state, attributable_to_diagnosis: v.expected_outcome.attributable_to_diagnosis },
      data_gaps: v.data_gaps.length,
      has_contradicting_evidence: v.has_contradicting_evidence,
      narrative: v.executive_narrative.text,
    })),
    findings_de_agente_sin_validar: result.agent_findings_unvalidated.slice(0, 8).map((f) => ({
      agent_code: f.agent_code, title: f.title, severity: f.severity, approval_status: f.approval_status, origin: f.origin,
    })),
  };
}

export async function loadExecutiveDiagnosisContextBlocks(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Array<{ label: string; data: unknown }>> {
  const label = "F11 DIAGNÓSTICO EJECUTIVO ENSAMBLADO (raíz D14; los hallazgos de agente no lo sustituyen; validación técnica, no de negocio real)";
  try {
    const result = await getExecutiveDiagnosis(supabase, organizationId);
    return [{ label, data: summarizeExecutiveDiagnosisForAgent(result) }];
  } catch {
    return [{ label, data: "diagnostico_ejecutivo_no_disponible; no inventar diagnóstico, prioridad ni causa" }];
  }
}

/** Texto de `diagnosis` del Strategic Plan derivado de vistas D14 validas, o null si no hay ninguna. */
export function deriveCaminoDiagnosis(result: ExecutiveDiagnosisResult): { text: string; sources: Array<{ kind: "table"; reference: string; period: null }> } | null {
  const canonical = result.views.filter((v) => v.validation_state.canonical).slice(0, 3);
  if (!canonical.length) return null;
  return {
    text: canonical
      .map((v) => `[D14 ${v.identity.diagnostic_output_id.slice(0, 8)}] ${v.executive_narrative.steps.slice(0, 2).map((s) => s.text).join(" ")} Confianza ${v.diagnosis.confidence.presentation ?? NA}.`)
      .join(" "),
    sources: canonical.map((v) => ({ kind: "table" as const, reference: `diagnostic_outputs:${v.identity.diagnostic_output_id}`, period: null })),
  };
}

/** Sustituye el diagnosis libre del modelo por el derivado; el schema del plan no cambia. */
export function applyExecutiveDiagnosisToCaminoProposal(proposal: CaminoPlanOutput, result: ExecutiveDiagnosisResult): CaminoPlanOutput {
  const derived = deriveCaminoDiagnosis(result);
  if (!derived) return proposal;
  const known = new Set(proposal.sources.map((s) => s.reference));
  return {
    ...proposal,
    diagnosis: derived.text,
    sources: [...proposal.sources, ...derived.sources.filter((s) => !known.has(s.reference))],
    warnings: [...proposal.warnings, "El diagnóstico del plan se deriva del diagnóstico ejecutivo D14; el modelo no lo reinterpretó."],
  };
}
