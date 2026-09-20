import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string };

export async function listConsultantRecommendationCommunicationRuns(env: ApiEnv, authorization: string, context: AuthContext, organizationId?: string) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) return { ok: false as const, statusCode: 403, error: "consultant_only" };
  if (!organizationId) return { ok: true as const, data: { assessments: [] } };
  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length)) as any;
  const { data, error } = await supabase.from("recommendation_communication_runs").select("id, organization_id, context_id, decision_cycle_id, as_of, evaluated_at, disposition, scope, primary_recommendation, unresolved_unknowns, reason_codes, source_refs, input_envelope, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(30);
  if (error) return { ok: false as const, statusCode: 500, error: "recommendation_communication_load_failed", detail: error.message };
  return { ok: true as const, data: { assessments: data ?? [] } };
}
