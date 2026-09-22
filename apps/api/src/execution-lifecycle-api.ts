import { LIFECYCLE_COMMANDS, type LifecycleCommand } from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { applyLifecycleCommand } from "./execution-lifecycle-engine.js";

type ApiEnv = { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string };

const consultant = (context: AuthContext) =>
  ["consultant", "platform_admin"].includes(context.profile.platform_role);

export async function listConsultantExecutionLifecycleStates(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId?: string,
) {
  if (!consultant(context)) return { ok: false as const, statusCode: 403, error: "consultant_only" };
  if (!organizationId) return { ok: true as const, data: { states: [] } };
  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length)) as any;
  const { data, error } = await supabase
    .from("execution_lifecycle_states")
    .select(
      "id, organization_id, intervention_id, context_id, state, why, plan_version, last_event_at, allowed_commands, prohibited_commands, blocking_conditions, next_states, material_write_allowed, inconsistencies, result, source_refs, evaluated_at",
    )
    .eq("organization_id", organizationId)
    .order("evaluated_at", { ascending: false })
    .limit(50);
  if (error) return { ok: false as const, statusCode: 500, error: "execution_lifecycle_load_failed", detail: error.message };
  return { ok: true as const, data: { states: data ?? [] } };
}

export async function listConsultantExecutionLifecycleTransitions(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId?: string,
  interventionId?: string,
) {
  if (!consultant(context)) return { ok: false as const, statusCode: 403, error: "consultant_only" };
  if (!organizationId || !interventionId) return { ok: true as const, data: { transitions: [] } };
  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length)) as any;
  const { data, error } = await supabase
    .from("execution_lifecycle_transitions")
    .select("id, command, decision, from_state, to_state, actor_id, plan_version, material_write_allowed, blocking_condition, reasons, event_at")
    .eq("organization_id", organizationId)
    .eq("intervention_id", interventionId)
    .order("event_at", { ascending: false })
    .limit(50);
  if (error) return { ok: false as const, statusCode: 500, error: "execution_lifecycle_transitions_load_failed", detail: error.message };
  return { ok: true as const, data: { transitions: data ?? [] } };
}

/**
 * Applies a lifecycle command. The write goes through the service role, so the
 * caller's right to act is checked here and then again, as actor authority,
 * inside the state machine (ADR-0006 punto 7).
 */
export async function applyConsultantLifecycleCommand(
  env: LoadedApiEnv & ApiEnv,
  authorization: string,
  context: AuthContext,
  body: { organizationId?: string; interventionId?: string; command?: string; planVersion?: number },
) {
  if (!consultant(context)) return { ok: false as const, statusCode: 403, error: "consultant_only" };
  const { organizationId, interventionId, command } = body;
  if (!organizationId || !interventionId || !command) {
    return { ok: false as const, statusCode: 400, error: "organization_intervention_and_command_required" };
  }
  if (!LIFECYCLE_COMMANDS.includes(command as LifecycleCommand)) {
    return { ok: false as const, statusCode: 400, error: "unknown_lifecycle_command" };
  }

  // Membership check: being a consultant is not being this organization's
  // consultant. The user-scoped client answers that under RLS.
  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length)) as any;
  const { data: organization, error: membershipError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  if (membershipError) {
    return { ok: false as const, statusCode: 500, error: "membership_check_failed", detail: membershipError.message };
  }
  if (!organization) return { ok: false as const, statusCode: 403, error: "organization_not_assigned" };

  try {
    const result = await applyLifecycleCommand(env, organizationId, interventionId, command as LifecycleCommand, {
      actorId: context.profile.id,
      actorAuthorized: true,
      planVersion: typeof body.planVersion === "number" ? body.planVersion : 0,
    });
    return { ok: true as const, data: result };
  } catch (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "lifecycle_command_failed",
      detail: error instanceof Error ? error.message : "unknown",
    };
  }
}
