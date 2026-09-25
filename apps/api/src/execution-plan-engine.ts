import { createClient } from "@supabase/supabase-js";
import { evaluateExecutionPlan, fingerprintPlaybookInput, type ExecutionPlanInput, type ExecutionPlanResult } from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";

const SOURCE = "f8-p03.v1";
type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
const text = (value: unknown, fallback = "UNKNOWN") => typeof value === "string" && value.trim() ? value : fallback;
function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }

export function executionPlanInputFromSources(organizationId: string, communicationRow: unknown, outcomeRow: unknown = {}, hitlRow: unknown = {}): ExecutionPlanInput {
  const communication = record(communicationRow); const communicationResult = record(communication.result); const outcome = record(record(outcomeRow).result); const hitl = record(hitlRow);
  const recommendation = text(communication.primary_recommendation, text(communicationResult.recommendation, "Validar recomendación"));
  const sequence = strings(communicationResult.sequence); const steps = sequence.length ? sequence : [recommendation];
  const actions = steps.map((step, index) => ({ id: `action-${index + 1}`, title: step, target: text(communicationResult.scope, "recommendation-scope"), change: index === 0 ? "read_before_write" : "prepare_reversible_change", expected_result: index === 0 ? text(outcome.current_baseline, "baseline verificable") : text(outcome.primary_success_criterion, "resultado verificable"), rationale: text(communicationResult.reason, "la recomendación requiere una secuencia explícita"), owner: "tenant-configured-owner", current_state: text(outcome.current_baseline), desired_state: text(outcome.primary_success_criterion, "estado verificable"), status: "PLANNED" as const, reversible: true, requires_approval: index > 0 }));
  const dependencies = actions.slice(1).map((action, index) => ({ from_action_id: actions[index]!.id, to_action_id: action.id, type: "HARD" as const, reason: strings(communicationResult.dependencies)[index] ?? "safe ordering" }));
  const approvalRequired = hitl.approval_gate === true || ["APPROVAL_REQUIRED", "ESCALATION_REQUIRED", "HUMAN_ONLY"].includes(text(hitl.disposition, "APPROVAL_REQUIRED"));
  const approvalState = hitl.approval_state === "APPROVED" ? "APPROVED" : approvalRequired ? "PENDING" : "NOT_REQUIRED";
  return {
    context_id: text(communication.context_id, `execution-plan:${organizationId}`), business_id: organizationId, decision_cycle_id: text(communication.decision_cycle_id, "unknown-cycle"), recommendation_id: text(communicationResult.recommendation_id, text(communication.id, "unknown-recommendation")), execution_intent: `Preparar la recomendación sin ejecutar: ${recommendation}`, objective: text(outcome.primary_success_criterion, recommendation),
    scope: { in_scope: [text(communicationResult.scope, "recommendation-scope")], out_of_scope: ["direct_tool_execution", "automatic_publication"], constraints: strings(communicationResult.constraints) }, actions, dependencies,
    preconditions: ["source recommendation is current", "target resolved before write"], postconditions: [text(outcome.primary_success_criterion, "result is observable")], invariants: ["execution_authorized remains false", "no hidden or orphan action"],
    checkpoints: [{ id: "checkpoint-human-approval", kind: "HUMAN", description: "Revisar el alcance y la aprobación antes de cualquier cambio.", required: approvalRequired }], milestones: [{ id: "milestone-plan", action_ids: actions.map((action) => action.id), description: "Secuencia mínima verificable" }],
    rollout: { mode: "HYBRID", phases: ["shadow", "pilot"], shadow: true, canary: false }, temporal_controls: { observation_window: text(outcome.outcome_horizon, "contextual"), cooldown: "tenant-configured", cadence: "tenant-configured", execution_window: "tenant-configured", maintenance_window: "tenant-configured" },
    budgets: { max_actions: Math.max(actions.length, 1), max_changes: actions.length, max_retries: 1, max_loss: "tenant-configured" }, success_criteria: [text(outcome.primary_success_criterion, "observable result")], failure_criteria: [text(communicationResult.invalidating_condition, "invalidating condition")], stop_criteria: ["guardrail violated"], hold_criteria: ["evidence insufficient"], continue_criteria: ["success signal remains valid"], scale_criteria: ["repeatability demonstrated"], rollback_criteria: ["previous state better and recoverable"],
    mode: "HYBRID", environment: "UNKNOWN", approval: { required: approvalRequired, status: approvalState, approved_scope: approvalRequired && approvalState === "APPROVED" ? text(hitl.action_id, null as unknown as string) : null }, source_refs: [...new Set([SOURCE, "recommendation_communication_runs", "expected_outcome_runs", "hitl_approval_assessment_runs", ...strings(communication.source_refs), ...strings(communicationResult.source_refs), ...strings(outcome.source_refs)])], unresolved_unknowns: [...new Set([...strings(communication.unresolved_unknowns), ...strings(communicationResult.unresolved_unknowns), ...strings(outcome.unresolved_unknowns)])],
  };
}

async function persist(supabase: any, organizationId: string, input: ExecutionPlanInput, result: ExecutionPlanResult) {
  const fingerprint = fingerprintPlaybookInput(input); const existing = await supabase.from("execution_plan_runs").select("id, plan_status").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`execution_plan_lookup_failed: ${existing.error.message}`); if (existing.data) return existing.data;
  const inserted = await supabase.from("execution_plan_runs").insert({ organization_id: organizationId, context_id: result.context_id, decision_cycle_id: result.decision_cycle_id, recommendation_id: result.recommendation_id, as_of: result.evaluated_at, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, plan_version: result.plan_version, plan_status: result.plan_status, execution_intent: result.execution_intent, objective: result.objective, ordered_action_ids: result.ordered_action_ids, critical_path: result.critical_path, input_envelope: input, result, blockers: result.blockers, unresolved_unknowns: result.unresolved_unknowns, source_refs: result.source_refs }).select("id, plan_status").single();
  if (inserted.error || !inserted.data) throw new Error(`execution_plan_write_failed: ${inserted.error?.message ?? "no row"}`); return inserted.data;
}

export async function runExecutionPlanEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [communicationResult, outcomeResult, hitlResult] = await Promise.all([
    supabase.from("recommendation_communication_runs").select("id, context_id, decision_cycle_id, primary_recommendation, source_refs, unresolved_unknowns, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("expected_outcome_runs").select("result, source_refs, unresolved_unknowns").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("hitl_approval_assessment_runs").select("action_id, disposition, approval_gate, approval_state, source_refs").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const loaded of [communicationResult, outcomeResult, hitlResult]) if (loaded.error) throw new Error(`execution_plan_input_load_failed: ${loaded.error.message}`);
  if (!communicationResult.data) return { organization_id: organizationId, assessment_id: null, plan_status: "BLOCKED", blockers: ["recommendation_context_missing"] };
  const input = executionPlanInputFromSources(organizationId, communicationResult.data, outcomeResult.data, hitlResult.data); const result = evaluateExecutionPlan(input); const stored = await persist(supabase, organizationId, input, result);
  return { organization_id: organizationId, assessment_id: stored.id, plan_status: result.plan_status, ordered_action_ids: result.ordered_action_ids, blockers: result.blockers };
}

export async function runExecutionPlanEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`execution_plan_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 }; for (const organization of loaded.data ?? []) { summary.organizations += 1; try { const result = await runExecutionPlanEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += result.assessment_id ? 1 : 0; } catch { summary.failed += 1; } } return summary;
}
