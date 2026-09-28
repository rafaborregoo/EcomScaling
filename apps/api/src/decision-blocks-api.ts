// Lectura para el consultor de los bloques F4 4.06-4.12 (ver decision-blocks-engine.ts).
// Una ruta por bloque, como antes; lo comun esta en `listBlock`.
import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string };

async function listBlock(env: ApiEnv, authorization: string, context: AuthContext, table: string, columns: string, errorKey: string) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) {
    return { ok: false as const, statusCode: 403, error: "consultant_only" };
  }
  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length)) as any;
  const { data, error } = await supabase.from(table).select(columns).order("assessed_at", { ascending: false }).limit(300);
  if (error) return { ok: false as const, statusCode: 500, error: `${errorKey}_load_failed`, detail: error.message };
  return { ok: true as const, data: { assessments: data ?? [] } };
}

const block = (table: string, columns: string, errorKey: string) => (env: ApiEnv, authorization: string, context: AuthContext) =>
  listBlock(env, authorization, context, table, columns, errorKey);

export const listConsultantFeasibility = block("decision_feasibility_assessments", "id, organization_id, candidate_ref, as_of, feasibility_assessment, unresolved_unknowns, reason_codes, result", "feasibility");
export const listConsultantRisk = block("decision_risk_assessments", "id,organization_id,candidate_ref,as_of,risk_assessment,unresolved_unknowns,reason_codes,result", "risk");
export const listConsultantAllocation = block("decision_allocation_assessments", "id,organization_id,candidate_ref,as_of,allocation_assessment,unresolved_unknowns,reason_codes,result", "allocation");
export const listConsultantStrategicFit = block("decision_strategic_fit_assessments", "id,organization_id,candidate_ref,as_of,strategic_assessment,unresolved_unknowns,reason_codes,result", "strategic_fit");
export const listConsultantRanking = block("decision_rankings", "id,organization_id,as_of,ranking_status,unresolved_unknowns,reason_codes,result", "ranking");
export const listConsultantPortfolio = block("decision_portfolio_assessments", "id,organization_id,as_of,portfolio_status,unresolved_unknowns,reason_codes,result", "portfolio");
export const listConsultantDecisionOutputs = block("decision_outputs", "id,organization_id,candidate_ref,as_of,decision_status,reason_codes,result", "decision_output");
