import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
};

const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 3650;

export async function getMetaMetrics(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  daysInput: string | undefined,
) {
  if (!context.memberships.some((membership) => membership.organization_id === organizationId)) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  }

  let periodDays: number | "all" = DEFAULT_PERIOD_DAYS;
  if (daysInput === "all") {
    periodDays = "all";
  } else if (daysInput) {
    const parsed = Number(daysInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      periodDays = Math.min(MAX_PERIOD_DAYS, Math.floor(parsed));
    }
  }

  const periodEnd = new Date();
  const periodStart =
    periodDays === "all" ? null : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase.rpc("meta_spend_summary", {
    target_organization_id: organizationId,
    period_start: periodStart?.toISOString().slice(0, 10) ?? null,
    period_end: periodEnd.toISOString().slice(0, 10),
  });

  if (error) {
    return { ok: false as const, statusCode: 500, error: "meta_metrics_load_failed", detail: error.message };
  }

  const summary = data?.[0] ?? {
    spend: 0,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    purchase_value: 0,
    roas: null,
    cac: null,
    days_with_data: 0,
  };

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      period: {
        days: periodDays,
        start: periodStart?.toISOString() ?? null,
        end: periodEnd.toISOString(),
      },
      acquisition: summary,
    },
  };
}
