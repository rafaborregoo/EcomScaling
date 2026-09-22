import { createClient } from "@supabase/supabase-js";
import {
  describeLifecycleState,
  evaluateLifecycleCommand,
  type LifecycleCommand,
  type LifecycleContext,
  type LifecycleState,
  type LifecycleTransition,
} from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";

/**
 * F8.10 runtime. Holds the authoritative lifecycle state of each intervention
 * and is the only writer of `execution_lifecycle_states`.
 *
 * The decision itself lives in the pure contract; this file loads the context,
 * calls it, and persists state plus transition evidence. It never decides.
 */

const SOURCE = "f8-p10.v1";

type Row = Record<string, unknown>;

const service = (env: LoadedApiEnv) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;

const bool = (value: unknown, fallback = false) => (typeof value === "boolean" ? value : fallback);
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/**
 * Builds the lifecycle context from the F8 tables that already exist. Anything
 * we cannot establish is reported as not established, never assumed true: a
 * missing readiness row means "not revalidated", not "fine".
 */
export function lifecycleContextFromSources(
  organizationId: string,
  interventionId: string,
  stateRow: Row | null,
  readinessRow: Row | null,
  approvalRow: Row | null,
  envelopeRow: Row | null,
  command: { actorId: string; actorAuthorized: boolean; planVersion: number; eventAt: string },
): LifecycleContext {
  const readinessDecision = typeof readinessRow?.readiness_decision === "string" ? readinessRow.readiness_decision : "";
  const approvalDecision = typeof approvalRow?.decision === "string" ? approvalRow.decision : "";
  const envelopeZone = typeof envelopeRow?.envelope_zone === "string" ? envelopeRow.envelope_zone : "";
  const currentState = (typeof stateRow?.state === "string" ? stateRow.state : "PROPOSED") as LifecycleState;
  const envelope = (stateRow?.input_envelope ?? {}) as Row;

  return {
    organization_id: organizationId,
    intervention_id: interventionId,
    current_state: currentState,
    actor_id: command.actorId,
    actor_authorized: command.actorAuthorized,
    approval_valid: approvalDecision === "APPROVED",
    readiness_revalidated: ["READY", "READY_WITH_CONDITIONS"].includes(readinessDecision),
    authority_valid: ["INSIDE", "INSIDE_WITH_CONDITIONS"].includes(envelopeZone),
    state_known: Boolean(stateRow) || currentState === "PROPOSED",
    blocking_reason_resolved: bool(envelope.blocking_reason_resolved),
    plan_version: count(stateRow?.plan_version),
    command_plan_version: command.planVersion,
    event_at: command.eventAt,
    last_event_at: typeof stateRow?.last_event_at === "string" ? stateRow.last_event_at : null,
    required_children_terminal: bool(envelope.required_children_terminal),
    critical_children_unresolved: bool(envelope.critical_children_unresolved, true),
    active_actions: count(envelope.active_actions),
    unknown_critical_actions: count(envelope.unknown_critical_actions),
    unresolved_recovery: bool(envelope.unresolved_recovery, true),
    handoff_complete: bool(envelope.handoff_complete),
    retry_eligible: bool(envelope.retry_eligible),
    duplicate_execution_detected: bool(envelope.duplicate_execution_detected, true),
    guardrails_clear: bool(envelope.guardrails_clear),
    execution_actually_stopped: bool(envelope.execution_actually_stopped),
  };
}

async function loadSources(supabase: any, organizationId: string, interventionId: string) {
  const [state, readiness, approval, envelope] = await Promise.all([
    supabase
      .from("execution_lifecycle_states")
      .select("state, plan_version, last_event_at, input_envelope")
      .eq("organization_id", organizationId)
      .eq("intervention_id", interventionId)
      .maybeSingle(),
    supabase
      .from("readiness_assessment_runs")
      .select("readiness_decision")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("hitl_approval_assessment_runs")
      .select("decision")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("action_envelope_runs")
      .select("envelope_zone")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const failure = state.error ?? readiness.error ?? approval.error ?? envelope.error;
  if (failure) throw new Error(`lifecycle_input_load_failed: ${failure.message}`);
  return { state: state.data as Row | null, readiness: readiness.data as Row | null, approval: approval.data as Row | null, envelope: envelope.data as Row | null };
}

async function persist(
  supabase: any,
  organizationId: string,
  interventionId: string,
  context: LifecycleContext,
  transition: LifecycleTransition,
  evaluatedAt: string,
) {
  const view = describeLifecycleState({ ...context, current_state: transition.to });

  // The transition log is append-only, and the unique index makes a resent
  // command land on the same row instead of duplicating history.
  const logged = await supabase
    .from("execution_lifecycle_transitions")
    .upsert(
      {
        organization_id: organizationId,
        intervention_id: interventionId,
        command: transition.command,
        decision: transition.decision,
        from_state: transition.from,
        to_state: transition.to,
        actor_id: context.actor_id,
        plan_version: context.plan_version,
        material_write_allowed: transition.material_write_allowed,
        blocking_condition: transition.blocking_condition,
        reasons: transition.reasons,
        evidence: { context, source: SOURCE },
        event_at: context.event_at,
      },
      { onConflict: "organization_id,intervention_id,command,event_at", ignoreDuplicates: true },
    );
  if (logged.error) throw new Error(`lifecycle_transition_write_failed: ${logged.error.message}`);

  // Only an accepted transition moves the authoritative state.
  if (transition.decision !== "ACCEPTED") return { view, moved: false };

  const upserted = await supabase
    .from("execution_lifecycle_states")
    .upsert(
      {
        organization_id: organizationId,
        intervention_id: interventionId,
        context_id: `lifecycle:${organizationId}:${interventionId}`,
        state: transition.to,
        why: view.why,
        plan_version: context.plan_version,
        last_event_at: context.event_at,
        allowed_commands: view.allowed_commands,
        prohibited_commands: view.prohibited_commands,
        blocking_conditions: view.blocking_conditions,
        next_states: view.next_states,
        material_write_allowed: view.material_write_allowed,
        inconsistencies: view.inconsistencies,
        input_envelope: context,
        result: { transition, view },
        source_refs: [SOURCE, "readiness_assessment_runs", "hitl_approval_assessment_runs", "action_envelope_runs"],
        evaluated_at: evaluatedAt,
        updated_at: evaluatedAt,
      },
      { onConflict: "organization_id,intervention_id" },
    );
  if (upserted.error) throw new Error(`lifecycle_state_write_failed: ${upserted.error.message}`);
  return { view, moved: true };
}

/** Applies one command to one intervention and records what happened. */
export async function applyLifecycleCommand(
  env: LoadedApiEnv,
  organizationId: string,
  interventionId: string,
  command: LifecycleCommand,
  actor: { actorId: string; actorAuthorized: boolean; planVersion: number; eventAt?: string },
) {
  const supabase = service(env);
  const evaluatedAt = new Date().toISOString();
  const eventAt = actor.eventAt ?? evaluatedAt;
  const sources = await loadSources(supabase, organizationId, interventionId);
  const context = lifecycleContextFromSources(
    organizationId,
    interventionId,
    sources.state,
    sources.readiness,
    sources.approval,
    sources.envelope,
    { ...actor, eventAt },
  );
  const transition = evaluateLifecycleCommand(context, command);
  const { view, moved } = await persist(supabase, organizationId, interventionId, context, transition, evaluatedAt);
  return { transition, view, moved };
}

/**
 * Recomputes the view of every open intervention without applying a command.
 * This is what the daily workflow calls: it surfaces interventions whose
 * lifecycle has gone inconsistent or has been sitting in a state too long,
 * which is the watchdog of spec section 45.
 */
export async function refreshLifecycleViewsForOrganization(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const evaluatedAt = new Date().toISOString();
  const loaded = await supabase
    .from("execution_lifecycle_states")
    .select("intervention_id, state, plan_version, last_event_at, input_envelope")
    .eq("organization_id", organizationId)
    .not("state", "in", '("CLOSED","ABORTED")');
  if (loaded.error) throw new Error(`lifecycle_states_load_failed: ${loaded.error.message}`);

  let inconsistent = 0;
  for (const row of (loaded.data ?? []) as Row[]) {
    const interventionId = String(row.intervention_id);
    const sources = await loadSources(supabase, organizationId, interventionId);
    const context = lifecycleContextFromSources(
      organizationId,
      interventionId,
      sources.state,
      sources.readiness,
      sources.approval,
      sources.envelope,
      { actorId: "system", actorAuthorized: true, planVersion: count(row.plan_version), eventAt: evaluatedAt },
    );
    const view = describeLifecycleState(context);
    if (view.inconsistencies.length) inconsistent += 1;
    const updated = await supabase
      .from("execution_lifecycle_states")
      .update({
        why: view.why,
        allowed_commands: view.allowed_commands,
        prohibited_commands: view.prohibited_commands,
        blocking_conditions: view.blocking_conditions,
        next_states: view.next_states,
        material_write_allowed: view.material_write_allowed,
        inconsistencies: view.inconsistencies,
        result: { view },
        evaluated_at: evaluatedAt,
        updated_at: evaluatedAt,
      })
      .eq("organization_id", organizationId)
      .eq("intervention_id", interventionId);
    if (updated.error) throw new Error(`lifecycle_view_write_failed: ${updated.error.message}`);
  }
  return { organization_id: organizationId, interventions: (loaded.data ?? []).length, inconsistent };
}

export async function refreshLifecycleViewsForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env);
  const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (loaded.error) throw new Error(`lifecycle_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, interventions: 0, inconsistent: 0 };
  for (const organization of loaded.data ?? []) {
    summary.organizations += 1;
    try {
      const result = await refreshLifecycleViewsForOrganization(env, organization.id as string);
      summary.succeeded += 1;
      summary.interventions += result.interventions;
      summary.inconsistent += result.inconsistent;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
