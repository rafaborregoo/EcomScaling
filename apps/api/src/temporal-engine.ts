/** F3/D13: adapta datos observables al motor temporal puro. */
import { createClient } from "@supabase/supabase-js";
import {
  CAPABILITIES,
  evaluateTemporalDiagnosis,
  type CapabilityTimeProfile,
  type TemporalLagInput,
  type TemporalObservation,
} from "@e-nora/contracts";
import { createLogger } from "@e-nora/observability";
import { type LoadedApiEnv } from "@e-nora/config";

const logger = createLogger("temporal-engine");
function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any;
}

type CaseRow = { id: string; organization_id: string; target_metric: string; scope: string; analysis_period_start: string; analysis_period_end: string; confidence: string | null };
const capabilityForMetric: Record<string, (typeof CAPABILITIES)[number]> = {
  net_sales: "finance", revenue: "finance", orders_count: "conversion", conversion_rate: "conversion", cvr: "conversion", cac: "acquisition", cpa: "acquisition", retention: "retention", inventory: "inventory", gross_margin: "unit_economics",
};

function capability(metric: string): (typeof CAPABILITIES)[number] { return capabilityForMetric[metric] ?? "data"; }
function asConfidence(value: string | null): "high" | "medium" | "low" | "insufficient_data" | undefined { return value === "high" || value === "medium" || value === "low" || value === "insufficient_data" ? value : undefined; }

async function loadInput(supabase: any, row: CaseRow) {
  const cap = capability(row.target_metric);
  const [signalsResult, healthResult, profileResult, previousResult, episodesResult] = await Promise.all([
    supabase.from("signals").select("observed_value, baseline_value, window_end, window_start, data_confidence").eq("organization_id", row.organization_id).eq("metric", row.target_metric).lte("window_end", row.analysis_period_end).order("window_end", { ascending: true }).limit(100),
    supabase.from("capability_health").select("health_state, assessed_at").eq("organization_id", row.organization_id).eq("capability", cap).order("assessed_at", { ascending: false }).limit(1),
    supabase.from("capability_time_profiles").select("capability, evaluation_window_hours, minimum_observation_window_hours, expected_lag_hours, settlement_delay_hours, baseline_horizon_days, recurrence_horizon_days, rationale").eq("organization_id", row.organization_id).eq("capability", cap).maybeSingle(),
    supabase.from("temporal_diagnoses").select("*").eq("case_id", row.id).eq("assessment_status", "current").maybeSingle(),
    supabase.from("diagnostic_episodes").select("episode_code, diagnosis_type, started_at, peaked_at, ended_at, same_root_cause_as_previous, same_root_cause_evidence, severity, recovery_time_hours, outcome").eq("case_id", row.id).order("started_at", { ascending: false }).limit(20),
  ]);
  for (const result of [signalsResult, healthResult, profileResult, previousResult, episodesResult]) if (result.error) throw new Error(`temporal_input_load_failed: ${result.error.message}`);
  const { data: paths, error: pathsError } = await supabase.from("causal_paths").select("id").eq("organization_id", row.organization_id).eq("case_id", row.id).limit(50);
  if (pathsError) throw new Error(`temporal_paths_load_failed: ${pathsError.message}`);
  const pathIds = (paths ?? []).map((path: any) => path.id as string);
  const { data: pathSteps, error: pathStepsError } = pathIds.length ? await supabase.from("causal_path_steps").select("edge_id, cause_onset, effect_onset, observed_lag_days, temporal_fit, path_id").in("path_id", pathIds).limit(50) : { data: [], error: null };
  if (pathStepsError) throw new Error(`temporal_path_steps_load_failed: ${pathStepsError.message}`);
  const profile: CapabilityTimeProfile = profileResult.data ? { ...profileResult.data, expected_lag_hours: profileResult.data.expected_lag_hours ?? undefined, settlement_delay_hours: profileResult.data.settlement_delay_hours ?? undefined, baseline_horizon_days: profileResult.data.baseline_horizon_days ?? undefined, recurrence_horizon_days: profileResult.data.recurrence_horizon_days ?? undefined } : { capability: cap, evaluation_window_hours: 168, minimum_observation_window_hours: 72, expected_lag_hours: 24, rationale: "Perfil conservador hasta que la capacidad tenga uno explícito." };
  const observations: TemporalObservation[] = (signalsResult.data ?? []).filter((signal: any) => signal.observed_value != null).map((signal: any) => ({ at: signal.window_end ?? signal.window_start, value: Number(signal.observed_value), baseline: signal.baseline_value == null ? null : Number(signal.baseline_value), source: signal.data_confidence ?? "signals" }));
  const lagInputs: TemporalLagInput[] = (pathSteps ?? []).filter((step: any) => step.cause_onset || step.effect_onset).map((step: any) => ({ edgeId: step.edge_id ?? undefined, causeLabel: `causal_path:${step.path_id}`, effectLabel: row.target_metric, causeTime: step.cause_onset ?? undefined, effectTime: step.effect_onset ?? undefined, expectedLagMinHours: step.observed_lag_days == null ? undefined : Number(step.observed_lag_days) * 0.5 * 24, expectedLagMaxHours: step.observed_lag_days == null ? undefined : Number(step.observed_lag_days) * 1.5 * 24 }));
  return { profile, observations, lagInputs, previous: previousResult.data ?? null, historicalEpisodes: episodesResult.data ?? [], currentState: healthResult.data?.[0]?.health_state ?? "unknown" };
}

async function persist(supabase: any, row: CaseRow, input: Awaited<ReturnType<typeof loadInput>>) {
  const result = evaluateTemporalDiagnosis({ diagnosisId: `runtime-${row.id}`, caseId: row.id, target: row.target_metric, currentState: input.currentState, observations: input.observations, profile: input.profile, previous: input.previous, historicalEpisodes: input.historicalEpisodes, lagInputs: input.lagInputs });
  const current = input.previous;
  if (current && current.trajectory === result.diagnosis.trajectory && current.current_state === result.diagnosis.current_state && current.onset_estimated_at === (result.diagnosis.onset_estimated_at ?? null)) return { changed: false, diagnosisId: current.diagnosis_id, events: 0, lags: 0 };
  if (current) {
    const { error } = await supabase.from("temporal_diagnoses").update({ assessment_status: "superseded" }).eq("id", current.diagnosis_id);
    if (error) throw new Error(`temporal_supersede_failed: ${error.message}`);
  }
  const d = result.diagnosis;
  const { data: inserted, error } = await supabase.from("temporal_diagnoses").insert({
    organization_id: row.organization_id, case_id: row.id, assessment_status: "current", target: d.target, temporal_scope: d.temporal_scope, current_state: d.current_state, trajectory: d.trajectory, short_term_trajectory: d.short_term_trajectory, medium_term_trajectory: d.medium_term_trajectory, long_term_trajectory: d.long_term_trajectory, raw_trajectory: d.raw_trajectory ?? null, context_adjusted_trajectory: d.context_adjusted_trajectory ?? null, onset_estimated_at: d.onset_estimated_at ?? null, onset_range_start: d.onset_range_start ?? null, onset_range_end: d.onset_range_end ?? null, onset_precision: d.onset_precision, source_granularity: d.source_granularity, onset_detection_method: "structured_series_material_deviation", first_observed_at: input.observations[0]?.at ?? null, pre_existing_status: d.pre_existing_status, change_type: d.change_type ?? null, change_point_at: d.change_point_at ?? null, velocity: d.velocity, acceleration: d.acceleration, temporal_sufficiency: d.temporal_sufficiency, persistence: d.persistence, duration_hours: d.duration_hours ?? null, noise_classification: d.noise_classification, trend_confidence: d.trend_confidence, trend_robustness: d.trend_robustness, recurrence_status: d.recurrence_status, recurrence_kind: d.recurrence_kind ?? null, regression_status: d.regression_status, regression_type: d.regression_type ?? null, previous_state: d.previous_state ?? null, previous_stable_period_start: d.previous_stable_period_start ?? null, previous_stable_period_end: d.previous_stable_period_end ?? null, cause_recovery: d.cause_recovery, system_recovery: d.system_recovery, business_impact_recovery: d.business_impact_recovery, recovery_persistence_met: d.recovery_persistence_met, root_cause_lifecycle: d.root_cause_lifecycle ?? null, constraint_lifecycle: d.constraint_lifecycle ?? null, constraint_shifted_to: d.constraint_shifted_to ?? null, maturity_trajectory: d.maturity_trajectory, maturity_structural_loss: d.maturity_structural_loss, maturity_note: d.maturity_note ?? null, baseline_status: d.baseline_status, regime_status: d.regime_status, has_unresolved_incident: d.has_unresolved_incident, regime_sufficient_duration: d.regime_sufficient_duration, regime_stable_behavior: d.regime_stable_behavior, regime_change_understood: d.regime_change_understood, regime_data_quality_high: d.regime_data_quality_high, regime_validation_note: d.regime_validation_note ?? null, comparison_type: d.comparison_type ?? null, temporal_completeness: d.temporal_completeness, history_coverage: d.history_coverage, history_quality: d.history_quality, temporal_gaps: d.temporal_gaps ?? null, onset_confidence: d.onset_confidence, trajectory_confidence: d.trajectory_confidence, regression_confidence: d.regression_confidence, recovery_confidence: d.recovery_confidence, lag_confidence: d.lag_confidence, detected_at: new Date().toISOString(), diagnosed_at: new Date().toISOString(), limitations: d.limitations ?? null,
  }).select("id").single();
  if (error || !inserted) throw new Error(`temporal_diagnosis_write_failed: ${error?.message ?? "no row"}`);
  if (result.lagChecks.length) {
    const { error: lagError } = await supabase.from("temporal_lag_checks").insert(result.lagChecks.map((lag) => ({ organization_id: row.organization_id, diagnosis_id: inserted.id, edge_id: input.lagInputs.find((item) => `${item.causeLabel}:${item.effectLabel}` === lag.lag_check_id.split(":").slice(1).join(":"))?.edgeId ?? null, cause_label: lag.cause_label, effect_label: lag.effect_label, cause_time: lag.cause_time ?? null, effect_time: lag.effect_time ?? null, observed_lag_hours: lag.observed_lag_hours ?? null, expected_lag_min_hours: lag.expected_lag_min_hours ?? null, expected_lag_max_hours: lag.expected_lag_max_hours ?? null, lag_fit: lag.lag_fit, time_basis: lag.time_basis, ingestion_differs: lag.ingestion_differs, note: lag.note ?? null })));
    if (lagError) throw new Error(`temporal_lag_write_failed: ${lagError.message}`);
  }
  if (result.events.length) {
    const { error: eventError } = await supabase.from("temporal_events").upsert(result.events.map((event) => ({ organization_id: row.organization_id, diagnosis_id: inserted.id, event_type: event.event_type, from_state: event.from_state ?? null, to_state: event.to_state ?? null, occurred_at: event.occurred_at, note: event.note })), { onConflict: "diagnosis_id,event_type,from_state,to_state", ignoreDuplicates: true });
    if (eventError) throw new Error(`temporal_event_write_failed: ${eventError.message}`);
  }
  if (result.revision) {
    const { error: revisionError } = await supabase.from("temporal_revisions").insert({ organization_id: row.organization_id, diagnosis_id: inserted.id, as_of: result.revision.as_of, previous_trajectory: result.revision.previous_trajectory ?? null, new_trajectory: result.revision.new_trajectory, previous_onset_at: result.revision.previous_onset_at ?? null, new_onset_at: result.revision.new_onset_at ?? null, revision_reason: result.revision.revision_reason, explanation: result.revision.explanation });
    if (revisionError) throw new Error(`temporal_revision_write_failed: ${revisionError.message}`);
  }
  return { changed: true, diagnosisId: inserted.id as string, events: result.events.length, lags: result.lagChecks.length };
}

export async function runTemporalEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const { data: cases, error } = await supabase.from("diagnostic_cases").select("id, organization_id, target_metric, scope, analysis_period_start, analysis_period_end, confidence").eq("organization_id", organizationId).in("status", ["open", "investigating"]);
  if (error) throw new Error(`diagnostic_cases_load_failed: ${error.message}`);
  const summary = { cases: 0, diagnoses: 0, unchanged: 0, events: 0, lags: 0 };
  for (const row of (cases ?? []) as CaseRow[]) {
    summary.cases += 1;
    const result = await persist(supabase, row, await loadInput(supabase, row));
    if (result.changed) summary.diagnoses += 1; else summary.unchanged += 1;
    summary.events += result.events; summary.lags += result.lags;
  }
  return summary;
}

export async function runTemporalEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);
  const { data: organizations, error } = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (error) throw new Error(`organizations_load_failed: ${error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, cases: 0, diagnoses: 0, unchanged: 0, events: 0, lags: 0 };
  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try { const result = await runTemporalEngine(env, organization.id as string); summary.succeeded += 1; summary.cases += result.cases; summary.diagnoses += result.diagnoses; summary.unchanged += result.unchanged; summary.events += result.events; summary.lags += result.lags; }
    catch (engineError) { summary.failed += 1; logger.error("temporal_engine_org_failed", { organization_id: organization.id, error: engineError instanceof Error ? engineError.message : String(engineError) }); }
  }
  return summary;
}
