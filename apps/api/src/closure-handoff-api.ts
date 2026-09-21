import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string };

export async function listConsultantClosureHandoffRuns(env: ApiEnv, authorization: string, context: AuthContext, organizationId?: string) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) return { ok: false as const, statusCode: 403, error: "consultant_only" };
  if (!organizationId) return { ok: true as const, data: { assessments: [] } };
  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length)) as any;
  const { data, error } = await supabase.from("execution_closure_runs").select("id, organization_id, intervention_id, recommendation_id, output_id, as_of, evaluated_at, closure_state, closure_gate, operational_outcome, verification_status, closure_quality, outcome_maturity, handoff_status, final_state_snapshot, blockers, unresolved_unknowns, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(30);
  if (error) return { ok: false as const, statusCode: 500, error: "closure_handoff_load_failed", detail: error.message };
  return { ok: true as const, data: { assessments: data ?? [] } };
}
