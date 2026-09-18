import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export async function listConsultantMeasurementExperimentationRuns(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) {
    return { ok: false as const, statusCode: 403, error: "consultant_only" };
  }
  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length)) as any;
  const { data, error } = await supabase
    .from("playbook_framework_runs")
    .select("id, organization_id, context_id, decision_cycle_id, as_of, evaluated_at, domain, disposition, candidate_count, selected_instance_id, unresolved_unknowns, reason_codes, source_refs, input_envelope, result")
    .eq("domain", "MEASUREMENT_EXPERIMENTATION")
    .order("evaluated_at", { ascending: false })
    .limit(300);
  if (error) return { ok: false as const, statusCode: 500, error: "measurement_experimentation_load_failed", detail: error.message };
  return { ok: true as const, data: { assessments: data ?? [] } };
}
