import { createClient } from "@supabase/supabase-js";
import {
  contextInputSchema,
  fingerprintDecisionContextInput,
} from "@e-nora/contracts";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any;
}

function consultantAccess(context: AuthContext, organizationId: string) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) return { ok: false as const, statusCode: 403, error: "consultant_only" };
  if (context.profile.platform_role !== "platform_admin" && !context.memberships.some((membership) => membership.organization_id === organizationId)) return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  return { ok: true as const };
}

export async function listConsultantDecisionContexts(env: ApiEnv, authorization: string, context: AuthContext) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) return { ok: false as const, statusCode: 403, error: "consultant_only" };
  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token) as any;
  const { data, error } = await supabase.from("decision_contexts").select("id, organization_id, decision_context_id, as_of, evaluated_at, context_status, context_confidence, primary_objective_kind, primary_objective_statement, unresolved_unknowns, reason_codes, source_lineage_refs, result").order("evaluated_at", { ascending: false }).limit(100);
  if (error) return { ok: false as const, statusCode: 500, error: "decision_contexts_load_failed", detail: error.message };
  return { ok: true as const, data: { contexts: data ?? [] } };
}

export async function createConsultantDecisionContextDeclaration(env: ApiEnv, context: AuthContext, body: unknown) {
  const raw = body as Record<string, unknown>;
  const organizationId = typeof raw?.business_id === "string" ? raw.business_id : "";
  const access = consultantAccess(context, organizationId);
  if (access.ok === false) return access;
  const parsed = contextInputSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, statusCode: 400, error: "invalid_decision_context", detail: parsed.error.flatten() };
  const input = parsed.data;
  const supabase = createServiceClient(env);
  const fingerprint = fingerprintDecisionContextInput(input);
  const { data, error } = await supabase.from("decision_context_declarations").upsert({
    organization_id: organizationId,
    created_by: context.user.id,
    input_fingerprint: fingerprint,
    input_envelope: input,
    source_lineage_refs: input.source_lineage_refs,
  }, { onConflict: "organization_id,input_fingerprint" }).select("id, input_fingerprint, declared_at").single();
  if (error || !data) return { ok: false as const, statusCode: 500, error: "decision_context_save_failed", detail: error?.message };
  return { ok: true as const, data };
}
