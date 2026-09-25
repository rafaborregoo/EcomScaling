import { createClient } from "@supabase/supabase-js";
import { evaluateTemporalUrgency, type TemporalUrgencyInputLike, type TemporalUrgencyResult } from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("temporal-urgency-engine");
function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }
type DiagnosisRow = { id: string; case_id: string; organization_id: string; current_state: string; trajectory: string; velocity: string; acceleration: string; assessed_at?: string | null };

function state(value: string): TemporalUrgencyInputLike["current_state"] { if (["critical", "disaster", "bad", "fragile"].includes(value)) return "DAMAGING"; if (value === "unknown") return "UNKNOWN"; return "NO_DAMAGE"; }
function trajectory(value: string): TemporalUrgencyInputLike["trajectory"] { if (value === "rapidly_deteriorating" || value === "deteriorating") return "ACCELERATING"; if (value === "stable") return "STABLE"; if (value === "new_regime") return "THRESHOLD_OR_CLIFF"; return "UNKNOWN"; }
function buildInput(row: DiagnosisRow, now = new Date().toISOString()): TemporalUrgencyInputLike { return { assessment_id: `p03:${row.id}`, business_id: row.organization_id, candidate_ref: row.case_id, as_of: now, current_state: state(row.current_state), trajectory: trajectory(row.trajectory), time_to_damage: null, damage_velocity: row.velocity === "unknown" ? "UNKNOWN" : row.acceleration === "accelerating" ? "ACCELERATING" : row.velocity === "very_slow" || row.velocity === "slow" ? "SLOW" : "MODERATE", cost_of_delay: "UNKNOWN", intervention_window: null, decision_deadline: null, time_to_irreversibility_days: null, decision_lead_time_days: null, execution_lead_time_days: null, result_latency_days: null, recoverability: "UNKNOWN", reversibility: "UNKNOWN", temporal_dependencies: [], evidence_as_of: row.assessed_at ?? null, freshness_requirement_hours: null, source_refs: [row.id, row.case_id] }; }

export async function persistTemporalUrgencyAssessment(env: LoadedApiEnv, result: TemporalUrgencyResult, temporalDiagnosisId?: string | null) {
  const supabase = service(env);
  const { data: existing, error: lookupError } = await supabase.from("temporal_urgency_assessments").select("id, temporal_assessment, temporal_confidence").eq("organization_id", result.business_id).eq("input_fingerprint", result.input_fingerprint ?? "").maybeSingle();
  if (lookupError) throw new Error(`temporal_urgency_lookup_failed: ${lookupError.message}`);
  if (existing) return existing;
  const { data, error } = await supabase.from("temporal_urgency_assessments").insert({ organization_id: result.business_id, candidate_ref: result.candidate_ref, temporal_diagnosis_id: temporalDiagnosisId ?? null, as_of: result.as_of, assessed_at: result.evaluated_at ?? new Date().toISOString(), input_fingerprint: result.input_fingerprint, temporal_assessment: result.temporal_assessment, temporal_confidence: result.temporal_confidence, total_response_time_days: result.total_response_time_days, input_envelope: result, result, unresolved_unknowns: result.unresolved_unknowns, reason_codes: result.reason_codes, source_refs: result.source_refs }).select("id, temporal_assessment, temporal_confidence").single();
  if (error || !data) throw new Error(`temporal_urgency_write_failed: ${error?.message ?? "no row"}`);
  return data;
}

export async function runTemporalUrgencyEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const { data, error } = await supabase.from("temporal_diagnoses").select("id, case_id, organization_id, current_state, trajectory, velocity, acceleration, assessed_at").eq("organization_id", organizationId).eq("assessment_status", "current").order("assessed_at", { ascending: false });
  if (error) throw new Error(`temporal_urgency_diagnoses_load_failed: ${error.message}`);
  const results = [];
  for (const row of (data ?? []) as DiagnosisRow[]) { const result = evaluateTemporalUrgency(buildInput(row)); const stored = await persistTemporalUrgencyAssessment(env, result, row.id); results.push({ ...stored, candidate_ref: result.candidate_ref, unresolved_unknowns: result.unresolved_unknowns }); }
  return { organization_id: organizationId, assessments: results.length, results };
}

export async function runTemporalUrgencyEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env);
  const { data: organizations, error } = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (error) throw new Error(`temporal_urgency_organizations_load_failed: ${error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const row of organizations ?? []) { summary.organizations += 1; try { const result = await runTemporalUrgencyEngine(env, row.id as string); summary.succeeded += 1; summary.assessments += result.assessments; } catch (error) { summary.failed += 1; logger.error("temporal_urgency_org_failed", { organization_id: row.id, error: error instanceof Error ? error.message : String(error) }); } }
  return summary;
}

export { buildInput };
