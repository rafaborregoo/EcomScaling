import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string };

export async function listConsultantContinuousLearningRuns(env: ApiEnv, authorization: string, context: AuthContext, organizationId?: string) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) return { ok: false as const, statusCode: 403, error: "consultant_only" };
  if (!organizationId) return { ok: true as const, data: { assessments: [] } };
  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length)) as any;
  const { data, error } = await supabase.from("continuous_learning_runs").select("id, organization_id, block_code, experience_id, intervention_id, recommendation_id, output_id, as_of, evaluated_at, status, classification, confidence, gate, rationale, learning, next_evidence_needed, unresolved_unknowns, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).order("block_code", { ascending: true }).limit(120);
  if (error) return { ok: false as const, statusCode: 500, error: "continuous_learning_load_failed", detail: error.message };
  return { ok: true as const, data: { assessments: data ?? [] } };
}
