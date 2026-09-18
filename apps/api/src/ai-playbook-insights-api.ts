import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type PlaybookAssessment = {
  domain: string;
  disposition: string;
  unresolved_unknowns?: string[];
  reason_codes?: string[];
};

export function latestPlaybookAssessments(
  rows: PlaybookAssessment[],
): PlaybookAssessment[] {
  const latest = new Map<string, PlaybookAssessment>();
  for (const row of rows) {
    if (!latest.has(row.domain)) latest.set(row.domain, row);
  }
  return [...latest.values()];
}

export async function listConsultantAiPlaybookInsights(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string | undefined,
) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) {
    return { ok: false as const, statusCode: 403, error: "consultant_only" };
  }
  if (!organizationId) return { ok: true as const, data: { assessments: [] } };

  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length)) as any;
  const { data, error } = await supabase
    .from("playbook_framework_runs")
    .select("domain, disposition, unresolved_unknowns, reason_codes, evaluated_at")
    .eq("organization_id", organizationId)
    .order("evaluated_at", { ascending: false })
    .limit(300);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "ai_playbook_insights_load_failed",
      detail: error.message,
    };
  }

  return {
    ok: true as const,
    data: { assessments: latestPlaybookAssessments((data ?? []) as PlaybookAssessment[]) },
  };
}
