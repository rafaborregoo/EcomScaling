import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runCaminoWeeklyReviewAgent } from "./ai-runtime.js";
import type { AuthContext } from "./auth-context.js";

const env = loadApiEnv(process.env);
const logger = createLogger("eval-a19-weekly-review");
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tag = `${Date.now()}`;
const email = `eval-a19-review-${tag}@ecomscaling.test`;

function fakeAuthContext(organizationId: string, userId: string): AuthContext {
  return {
    user: { id: userId, email },
    profile: {
      id: userId,
      full_name: "A19 review eval",
      avatar_url: null,
      platform_role: "platform_admin",
      is_active: true,
    },
    memberships: [{ organization_id: organizationId, role: "owner", accessSource: "membership", organization: null }],
    subscriptions: [],
  };
}

async function main() {
  let userId: string | null = null;
  let organizationId: string | null = null;
  try {
    const { data: userResult, error: userError } = await admin.auth.admin.createUser({
      email,
      password: `Eval-A19-${tag}!`,
      email_confirm: true,
    });
    if (userError || !userResult.user) throw new Error(`eval_user_create_failed:${userError?.message}`);
    const createdUserId = userResult.user.id;
    userId = createdUserId;

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ display_name: `TEST A19 weekly review ${tag}`, slug: `eval-a19-review-${tag}`, status: "active" })
      .select("id")
      .single();
    if (orgError || !org) throw new Error(`eval_org_create_failed:${orgError?.message}`);
    const createdOrganizationId = org.id;
    organizationId = createdOrganizationId;

    const { data: plan, error: planError } = await admin
      .from("strategic_plans")
      .insert({
        organization_id: createdOrganizationId,
        name: "TEST A19: validar avance y evidencia del camino",
        description: "Plan sintético para comprobar revisión semanal y propuestas revisables.",
        status: "active",
        version: 1,
        starts_on: new Date().toISOString().slice(0, 10),
        horizon_months: 6,
        goal: {
          metric_key: "net_sales",
          baseline_value: null,
          target_value: null,
          monthly_targets: [],
        },
        created_by: createdUserId,
      })
      .select("id")
      .single();
    if (planError || !plan) throw new Error(`eval_plan_create_failed:${planError?.message}`);

    const result = await runCaminoWeeklyReviewAgent(
      env,
      fakeAuthContext(createdOrganizationId, createdUserId),
      createdOrganizationId,
    );
    if (!result.ok) {
      console.log(JSON.stringify({ ok: false, error: result.error, detail: "detail" in result ? result.detail : null }));
      process.exitCode = 1;
      return;
    }

    if ("skipped" in result && result.skipped) {
      console.log(JSON.stringify({ ok: true, skipped: result.reason }));
      return;
    }

    const data = result.data as { run_id?: string; output_id?: string; output?: unknown; usage?: unknown };
    const runId = data.run_id;
    const [{ data: persistedReview }, { data: persistedPlan }] = await Promise.all([
      admin.from("strategic_plan_weekly_reviews")
        .select("id, status, output_id, review_week_start")
        .eq("plan_id", plan.id).maybeSingle(),
      admin.from("strategic_plans")
        .select("status, version")
        .eq("id", plan.id).maybeSingle(),
    ]);
    let judgment: Record<string, unknown> | null = null;
    let job: Record<string, unknown> | null = null;
    if (runId) {
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        const [judgmentResult, jobResult] = await Promise.all([
          admin.from("agent_run_judgments")
            .select("status, overall_score, rubric_version, error_code, estimated_cost_usd, latency_ms, result")
            .eq("agent_run_id", runId).maybeSingle(),
          admin.from("agent_judge_jobs")
            .select("status, attempts, max_attempts, last_error")
            .eq("agent_run_id", runId).maybeSingle(),
        ]);
        const row = judgmentResult.data as (Record<string, unknown> & { result?: { criteria?: unknown[]; summary?: string } | null }) | null;
        judgment = row
          ? { ...row, criteria: row.result?.criteria ?? null, summary: row.result?.summary ?? null, result: undefined }
          : null;
        job = jobResult.data as Record<string, unknown> | null;
        if (judgment || (job && ["completed", "failed"].includes(String(job.status)))) break;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }

    console.log(JSON.stringify({
      ok: true,
      plan_id: plan.id,
      persisted_review: persistedReview ?? null,
      plan_after_review: persistedPlan ?? null,
      run_id: runId ?? null,
      output_id: data.output_id ?? null,
      generation_usage: data.usage ?? null,
      output: data.output ?? null,
      persisted_judgment: judgment,
      judge_job: job,
    }));
  } finally {
    if (organizationId) {
      const { error } = await admin.from("organizations").delete().eq("id", organizationId);
      if (error) logger.error("eval_org_cleanup_failed", { error: error.message.slice(0, 180) });
    }
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) logger.error("eval_user_cleanup_failed", { error: error.message.slice(0, 180) });
    }
  }
}

await main();
