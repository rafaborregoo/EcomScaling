/** F3/D14: empaquetado, validación y versionado de la salida diagnóstica. */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { finalizeDiagnosticOutput, type DiagnosticOutputEvidenceInput } from "@ecomscaling/contracts";
import { createLogger } from "@ecomscaling/observability";
import { type LoadedApiEnv } from "@ecomscaling/config";

const logger = createLogger("diagnostic-output-engine");
function createServiceClient(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }

type CaseRow = { id: string; organization_id: string; store_id: string | null; target_metric: string; status: string; scope: string; data_quality: unknown; confidence: string | null; target_question: string };
const modelVersion = "d14-deterministic-1";
const rulesVersion = "f3-d14-1";
const contractVersion = "f3-d14";

function confidence(value: string | null): "high" | "medium" | "low" | "insufficient_data" { return value === "high" || value === "medium" || value === "low" ? value : "insufficient_data"; }
function claimLayer(kind: string | null): DiagnosticOutputEvidenceInput["claimLayer"] { return kind === "root_cause" || kind === "why" ? "root_cause" : kind === "symptom" ? "symptom" : kind === "signal" ? "signal" : "what"; }
function dataGate(value: unknown) { return typeof value === "object" && value != null && !Object.values(value as Record<string, unknown>).includes("insufficient_data"); }

async function loadInput(supabase: any, row: CaseRow) {
  const [rootResult, constraintResult, severityResult, robustnessResult, temporalResult, hypothesisResult, evidenceResult, contextResult, claimsResult, currentResult] = await Promise.all([
    supabase.from("root_causes").select("id, statement, status").eq("case_id", row.id).order("updated_at", { ascending: false }).limit(1),
    supabase.from("business_constraints").select("id, statement, status").eq("case_id", row.id).order("updated_at", { ascending: false }).limit(1),
    supabase.from("severity_assessments").select("id, overall_severity, summary").eq("case_id", row.id).eq("assessment_status", "current").limit(1),
    supabase.from("diagnostic_robustness").select("id, false_diagnosis_risk, robustness").eq("case_id", row.id).eq("review_status", "current").limit(1),
    supabase.from("temporal_diagnoses").select("id, trajectory, onset_estimated_at").eq("case_id", row.id).eq("assessment_status", "current").limit(1),
    supabase.from("diagnostic_hypotheses").select("id, status").eq("case_id", row.id).limit(100),
    supabase.from("diagnostic_evidence").select("id, code, observation, observation_kind, source, source_system, metric, period_start, period_end, reliability, contradiction_strength").eq("case_id", row.id).limit(200),
    supabase.from("context_assessments").select("id").eq("case_id", row.id).order("assessed_at", { ascending: false }).limit(1),
    supabase.from("claim_confidence").select("claim_layer, confidence_level, completeness, limitations").eq("case_id", row.id).order("assessed_at", { ascending: false }).limit(100),
    supabase.from("diagnostic_outputs").select("id, version, status, root_cause_id, constraint_id, severity_assessment_id, robustness_id, temporal_diagnosis_id").eq("case_id", row.id).eq("is_current", true).maybeSingle(),
  ]);
  for (const result of [rootResult, constraintResult, severityResult, robustnessResult, temporalResult, hypothesisResult, evidenceResult, contextResult, claimsResult, currentResult]) if (result.error) throw new Error(`diagnostic_output_input_load_failed: ${result.error.message}`);
  const rootCause = rootResult.data?.[0] ?? null;
  const constraint = constraintResult.data?.[0] ?? null;
  const severity = severityResult.data?.[0] ?? null;
  const robustness = robustnessResult.data?.[0] ?? null;
  const temporal = temporalResult.data?.[0] ?? null;
  const claims = claimsResult.data ?? [];
  const overall = claims.find((claim: any) => claim.claim_layer === "overall") ?? claims[0];
  const evidence: DiagnosticOutputEvidenceInput[] = (evidenceResult.data ?? []).map((item: any) => ({
    claim: item.observation, claimLayer: claimLayer(item.observation_kind), source: item.source_system ?? item.source ?? "diagnostic_evidence", sourceRef: `${item.source ?? "case"}:${item.code ?? item.id}`, metric: item.metric ?? row.target_metric, reliability: item.reliability === "high" || item.reliability === "medium" || item.reliability === "low" ? item.reliability : "unknown", stance: ["material", "decisive"].includes(item.contradiction_strength) ? "contradicting" : "supporting",
  }));
  if (rootCause) evidence.push({ claim: rootCause.statement, claimLayer: "root_cause", source: "root_causes", sourceRef: `root_causes:${rootCause.id}`, reliability: "medium", stance: "supporting" });
  return { rootCause, constraint, severity, robustness, temporal, hypotheses: hypothesisResult.data ?? [], evidence, current: currentResult.data ?? null, confidence: confidence(overall?.confidence_level ?? row.confidence), dataQualityValid: dataGate(row.data_quality), contextValid: (contextResult.data ?? []).length > 0 };
}

async function persist(supabase: any, row: CaseRow, input: Awaited<ReturnType<typeof loadInput>>) {
  const current = input.current;
  if (current && current.root_cause_id === input.rootCause?.id && current.constraint_id === input.constraint?.id && current.severity_assessment_id === input.severity?.id && current.robustness_id === input.robustness?.id && current.temporal_diagnosis_id === input.temporal?.id) return { changed: false as const, finalized: current.status === "confirmed" };
  const outputId = randomUUID();
  const snapshotId = randomUUID();
  const traceId = randomUUID();
  const built = finalizeDiagnosticOutput({ outputId, caseId: row.id, organizationId: row.organization_id, target: row.target_metric, status: row.status === "open" ? "investigating" : "investigating", confidence: input.confidence, snapshotId, rootCause: input.rootCause, constraint: input.constraint, severity: input.severity, robustness: input.robustness, temporal: input.temporal, hypotheses: input.hypotheses, evidence: input.evidence, dataQualityValid: input.dataQualityValid, contextValid: input.contextValid, modelVersion, rulesVersion, contractVersion, traceId });
  const { error: snapshotError } = await supabase.from("diagnostic_snapshots").insert({ id: snapshotId, organization_id: row.organization_id, case_id: row.id, as_of: built.snapshot.as_of, source_versions: { signals: "current", diagnosis: "current" }, data_ranges: { scope: row.scope }, normalization_version: "f3-normalization-1", metric_definition_versions: { [row.target_metric]: "current" }, knowledge_refs: [], rules_version: rulesVersion, model_version: modelVersion, prompt_version: "none", known_issues: built.snapshot.reproducibility_limitations ?? null, reproducible: built.snapshot.reproducible, snapshot_available: built.snapshot.snapshot_available, sources_resolvable: built.snapshot.sources_resolvable, rules_version_available: built.snapshot.rules_version_available, knowledge_refs_resolvable: built.snapshot.knowledge_refs_resolvable, model_metadata_available: built.snapshot.model_metadata_available, reproducibility_limitations: built.snapshot.reproducibility_limitations ?? null });
  if (snapshotError) throw new Error(`diagnostic_snapshot_write_failed: ${snapshotError.message}`);
  if (current) {
    const { error } = await supabase.from("diagnostic_outputs").update({ is_current: false, superseded_by: outputId, supersession_reason: "Nueva evaluación material de componentes de Fase 3." }).eq("id", current.id);
    if (error) throw new Error(`diagnostic_output_supersede_failed: ${error.message}`);
  }
  const { error: outputError } = await supabase.from("diagnostic_outputs").insert({ id: outputId, organization_id: row.organization_id, case_id: row.id, store_id: row.store_id, version: Number(current?.version ?? 0) + 1, is_current: true, supersedes: current?.id ?? null, status: built.output.status, completeness_status: built.output.completeness_status, missing_components: built.output.missing_components, blocking_components: built.output.blocking_components, data_gate_valid: built.output.data_gate_valid, context_valid: built.output.context_valid, stage_valid: built.output.stage_valid, hypothesis_review_completed: built.output.hypothesis_review_completed, root_cause_condition_satisfied: built.output.root_cause_condition_satisfied, confounder_review_completed: built.output.confounder_review_completed, severity_computed: built.output.severity_computed, confidence_calibrated: built.output.confidence_calibrated, temporal_review_completed: built.output.temporal_review_completed, traceability_complete: built.output.traceability_complete, validation_passed: built.output.validation_passed, phase_boundary_respected: built.output.phase_boundary_respected, finalization_status: built.output.finalization_status, root_cause_id: input.rootCause?.id ?? null, constraint_id: input.constraint?.id ?? null, severity_assessment_id: input.severity?.id ?? null, robustness_id: input.robustness?.id ?? null, temporal_diagnosis_id: input.temporal?.id ?? null, snapshot_id: snapshotId, diagnostic_summary: built.output.diagnostic_summary ?? null, limitation_summary: built.output.limitation_summary ?? null, confidence_summary: built.output.confidence_summary ?? null, data_gap_summary: built.output.data_gap_summary ?? null, confidence: built.output.confidence, confidence_language: built.output.confidence_language, user_summary: built.output.user_summary ?? null, what_we_know: `Métrica ${row.target_metric}; evidencia registrada y referencias de D09-D13 disponibles.`, what_we_dont_know: built.output.data_gap_summary ?? "No hay huecos adicionales declarados.", visibility: "admin", degraded: built.output.degraded, manual_review_required: built.output.manual_review_required, manual_review_reason: built.output.manual_review_reason ?? null, handoff_ready: built.output.handoff_ready, contract_version: contractVersion, rules_version: rulesVersion, model_version: modelVersion, prompt_version: "none", trace_id: traceId });
  if (outputError) throw new Error(`diagnostic_output_write_failed: ${outputError.message}`);
  if (built.evidence.length) {
    const { error } = await supabase.from("diagnostic_output_evidence").insert(built.evidence.map((item) => ({ organization_id: row.organization_id, output_id: outputId, claim: item.claim, claim_layer: item.claim_layer, source: item.source, source_ref: item.source_ref, metric: item.metric ?? null, reliability: item.reliability, transformations: item.transformations ?? null, stance: item.stance, snapshot_ref: snapshotId })));
    if (error) throw new Error(`diagnostic_output_evidence_write_failed: ${error.message}`);
  }
  const { error: validationError } = await supabase.from("diagnostic_validations").insert(built.validations.map((item) => ({ organization_id: row.organization_id, output_id: outputId, validator: item.validator, result: item.result, message: item.message ?? null, blocking: item.blocking })));
  if (validationError) throw new Error(`diagnostic_validation_write_failed: ${validationError.message}`);
  if (!current || current.status !== built.output.status) {
    const { error } = await supabase.from("diagnostic_transitions").insert({ organization_id: row.organization_id, case_id: row.id, output_id: outputId, from_status: current?.status ?? null, to_status: built.output.status, actor: "validator", reason: "La salida ha sido evaluada por el gate de finalización de D14.", evidence_ref: snapshotId });
    if (error) throw new Error(`diagnostic_transition_write_failed: ${error.message}`);
  }
  return { changed: true as const, finalized: built.output.finalization_status === "finalized_valid", outputId, validations: built.validations.length, evidence: built.evidence.length };
}

export async function runDiagnosticOutputEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const { data: cases, error } = await supabase.from("diagnostic_cases").select("id, organization_id, store_id, target_metric, status, scope, data_quality, confidence, target_question").eq("organization_id", organizationId).in("status", ["open", "investigating"]);
  if (error) throw new Error(`diagnostic_cases_load_failed: ${error.message}`);
  const summary = { cases: 0, outputs: 0, finalized: 0, unchanged: 0, validations: 0, evidence: 0 };
  for (const row of (cases ?? []) as CaseRow[]) { summary.cases += 1; const result = await persist(supabase, row, await loadInput(supabase, row)); if (!result.changed) summary.unchanged += 1; else { summary.outputs += 1; summary.finalized += result.finalized ? 1 : 0; summary.validations += result.validations; summary.evidence += result.evidence; } }
  return summary;
}

export async function runDiagnosticOutputEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);
  const { data: organizations, error } = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (error) throw new Error(`organizations_load_failed: ${error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, cases: 0, outputs: 0, finalized: 0, unchanged: 0, validations: 0, evidence: 0 };
  for (const organization of organizations ?? []) { summary.organizations += 1; try { const result = await runDiagnosticOutputEngine(env, organization.id as string); summary.succeeded += 1; summary.cases += result.cases; summary.outputs += result.outputs; summary.finalized += result.finalized; summary.unchanged += result.unchanged; summary.validations += result.validations; summary.evidence += result.evidence; } catch (engineError) { summary.failed += 1; logger.error("diagnostic_output_engine_org_failed", { organization_id: organization.id, error: engineError instanceof Error ? engineError.message : String(engineError) }); } }
  return summary;
}
