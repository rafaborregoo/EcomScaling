import { createClient } from "@supabase/supabase-js";
import { evaluateClosureHandoff, fingerprintPlaybookInput, type ClosureHandoffInput, type ClosureHandoffResult } from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";

const SOURCE = "f8-p16.v1";
type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
const text = (value: unknown, fallback = "UNKNOWN") => typeof value === "string" && value.trim() ? value : fallback;
const bool = (value: unknown, fallback = false) => typeof value === "boolean" ? value : fallback;
const number = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }

export function closureInputFromSources(organizationId: string, outputRow: unknown, tasks: unknown[], now = new Date().toISOString()): ClosureHandoffInput {
  const outputRowValue = record(outputRow); const output = record(outputRowValue.output);
  const outputId = text(outputRowValue.id, "unknown-output");
  const linked = tasks.filter((task) => text(record(record(task).metadata).agent_output_id, "") === outputId).map(record);
  const statuses = linked.map((task) => text(task.status, "pending"));
  const completed = statuses.filter((status) => status === "completed").length;
  const active = statuses.filter((status) => ["pending", "in_progress"].includes(status)).length;
  const blocked = statuses.filter((status) => ["ignored", "cancelled"].includes(status)).length;
  const verification = text(output.verification_status, active > 0 ? "UNKNOWN" : completed > 0 && blocked === 0 ? "VERIFIED" : "INCONCLUSIVE").toUpperCase();
  const handoffRequired = bool(output.handoff_required);
  const handoffStatus = text(output.handoff_status, handoffRequired ? "REQUESTED" : "NOT_REQUIRED").toUpperCase();
  const expected = text(output.expected_state, text(output.expected_outcome, "Estado esperado no declarado"));
  const actual = active > 0 ? `Quedan ${active} acción(es) activas.` : linked.length ? `${completed} acción(es) completadas; ${blocked} cancelada(s) o ignorada(s).` : "No hay acciones materializadas.";
  return {
    organization_id: organizationId, intervention_id: text(outputRowValue.run_id, outputId), recommendation_id: text(output.recommendation_id, text(outputRowValue.run_id, outputId)), output_id: outputId,
    expected_state: expected, actual_state: actual, active_actions: active, critical_unknown: bool(output.critical_unknown),
    verification_status: ["VERIFIED", "PARTIALLY_VERIFIED", "FAILED", "INCONCLUSIVE", "UNKNOWN"].includes(verification) ? verification as ClosureHandoffInput["verification_status"] : "UNKNOWN",
    open_critical_incident: bool(output.open_critical_incident), recovery_active: bool(output.recovery_active), cleanup_complete: output.cleanup_complete !== false,
    residual_risk_known: output.residual_risk_known !== false, residual_risk_accepted: output.residual_risk_accepted !== false, residual_risk_owner: typeof output.residual_risk_owner === "string" ? output.residual_risk_owner : null,
    handoff_required: handoffRequired, handoff_status: ["NOT_REQUIRED", "REQUESTED", "ACCEPTED", "REJECTED", "FAILED", "COMPLETE"].includes(handoffStatus) ? handoffStatus as ClosureHandoffInput["handoff_status"] : "REQUESTED",
    task_summary: { total: linked.length, completed, active, blocked }, source_refs: [...new Set([SOURCE, "agent_outputs", "tasks", ...strings(output.source_refs)])], known_unknowns: strings(output.known_unknowns), close_requested: output.close_requested !== false,
  };
}

async function persist(supabase: any, organizationId: string, input: ClosureHandoffInput, result: ClosureHandoffResult) {
  const fingerprint = fingerprintPlaybookInput(input);
  const existing = await supabase.from("execution_closure_runs").select("id, closure_state, closure_gate").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`closure_handoff_lookup_failed: ${existing.error.message}`);
  if (existing.data) return existing.data;
  const inserted = await supabase.from("execution_closure_runs").insert({ organization_id: organizationId, intervention_id: result.intervention_id, recommendation_id: result.recommendation_id, output_id: result.output_id, as_of: result.evaluated_at, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, closure_state: result.closure_state, closure_gate: result.closure_gate, operational_outcome: result.operational_outcome, verification_status: result.verification_status, closure_quality: result.closure_quality, outcome_maturity: result.outcome_maturity, handoff_status: result.handoff_status, input_envelope: input, result, final_state_snapshot: result.final_state_snapshot, unresolved_unknowns: result.unresolved_unknowns, blockers: result.blockers, source_refs: result.learning_package.source_refs }).select("id, closure_state, closure_gate").single();
  if (inserted.error || !inserted.data) throw new Error(`closure_handoff_write_failed: ${inserted.error?.message ?? "no row"}`);
  return inserted.data;
}

export async function runClosureHandoffEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const outputResult = await supabase.from("agent_outputs").select("id, run_id, output, status, created_at").eq("organization_id", organizationId).in("status", ["approved", "published", "rejected"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (outputResult.error) throw new Error(`closure_handoff_output_load_failed: ${outputResult.error.message}`);
  if (!outputResult.data) return { organization_id: organizationId, assessment_id: null, closure_state: "COMPLETED", closure_gate: false, operational_outcome: "NOT_EXECUTED" };
  const taskResult = await supabase.from("tasks").select("id, status, metadata, title, completed_at, updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(500);
  if (taskResult.error) throw new Error(`closure_handoff_task_load_failed: ${taskResult.error.message}`);
  const input = closureInputFromSources(organizationId, outputResult.data, taskResult.data ?? []);
  const result = evaluateClosureHandoff(input);
  const stored = await persist(supabase, organizationId, input, result);
  return { organization_id: organizationId, assessment_id: stored.id, closure_state: result.closure_state, closure_gate: result.closure_gate, operational_outcome: result.operational_outcome, blockers: result.blockers };
}

export async function runClosureHandoffEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`closure_handoff_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 }; for (const organization of loaded.data ?? []) { summary.organizations += 1; try { const result = await runClosureHandoffEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += result.assessment_id ? 1 : 0; } catch { summary.failed += 1; } } return summary;
}
