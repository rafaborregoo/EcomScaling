import { z } from "zod";
import type { LoadedApiEnv } from "@e-nora/config";
import { createServiceClient } from "./ai-runtime.js";
import { createUserScopedClient, requireOperationalOrganization, type AuthContext } from "./auth-context.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const agentJudgeFeedbackInputSchema = z.object({
  criterion_id: z.string().min(1).max(100),
  decision: z.enum(["agree", "incorrect", "not_applicable", "corrected"]),
  reason_code: z.enum(["accuracy", "missing_evidence", "wrong_scope", "not_actionable", "duplicate", "other"]).nullable().optional(),
  note: z.string().trim().max(1200).nullable().optional(),
  corrected_status: z.enum(["evaluable", "no_evaluable"]).nullable().optional(),
  corrected_score: z.number().int().min(0).max(4).nullable().optional(),
  request_id: z.string().regex(UUID),
}).strict().superRefine((input, context) => {
  if (input.decision !== "agree" && !input.reason_code) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason_code"], message: "reason_code_required_for_disagreement" });
  }
  if (input.reason_code === "other" && !input.note?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "note_required_for_other_reason" });
  }
  if (input.decision === "corrected") {
    if (input.corrected_status === "evaluable" && input.corrected_score == null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["corrected_score"], message: "corrected_score_required" });
    }
    if (input.corrected_status === "no_evaluable" && input.corrected_score != null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["corrected_score"], message: "no_evaluable_score_must_be_null" });
    }
    if (!input.corrected_status) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["corrected_status"], message: "corrected_status_required" });
    }
  } else if (input.corrected_status != null || input.corrected_score != null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["corrected_status"], message: "correction_only_allowed_for_corrected_decision" });
  }
});

export async function submitAgentJudgeFeedback(
  env: Pick<LoadedApiEnv, "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_SERVICE_ROLE_KEY">,
  authorization: string,
  auth: AuthContext,
  organizationId: string,
  runId: string,
  judgmentId: string,
  rawInput: unknown,
) {
  const access = requireOperationalOrganization(auth, organizationId);
  if (!access.ok) return access;
  if (!["consultant", "platform_admin"].includes(auth.profile.platform_role)) {
    return { ok: false as const, statusCode: 403, error: "judge_feedback_access_denied" };
  }
  if (!UUID.test(runId) || !UUID.test(judgmentId)) {
    return { ok: false as const, statusCode: 404, error: "agent_judgment_not_found" };
  }
  const parsed = agentJudgeFeedbackInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, statusCode: 400, error: "invalid_agent_judge_feedback", detail: parsed.error.issues[0]?.message };
  }
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return { ok: false as const, statusCode: 401, error: "missing_bearer_token" };

  // Read through the service client only after the caller's membership/role
  // checks, and bind the feedback to this exact run and organization.
  const service = createServiceClient(env as LoadedApiEnv) as any;
  const { data: judgment, error: judgmentError } = await service
    .from("agent_run_judgments")
    .select("id, agent_code, result")
    .eq("id", judgmentId)
    .eq("agent_run_id", runId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (judgmentError) return { ok: false as const, statusCode: 500, error: "agent_judgment_load_failed" };
  if (!judgment) return { ok: false as const, statusCode: 404, error: "agent_judgment_not_found" };
  const criteria = Array.isArray(judgment.result?.criteria) ? judgment.result.criteria : [];
  if (!criteria.some((criterion: { criterion_id?: unknown }) => criterion.criterion_id === parsed.data.criterion_id)) {
    return { ok: false as const, statusCode: 400, error: "judge_feedback_criterion_not_in_rubric" };
  }

  const userClient = createUserScopedClient(env as LoadedApiEnv, bearer) as any;
  const { data: feedbackId, error } = await userClient.rpc("record_agent_judgment_feedback", {
    p_judgment_id: judgmentId,
    p_agent_run_id: runId,
    p_organization_id: organizationId,
    p_criterion_id: parsed.data.criterion_id,
    p_decision: parsed.data.decision,
    p_reason_code: parsed.data.reason_code ?? null,
    p_note: parsed.data.note ?? null,
    p_corrected_status: parsed.data.corrected_status ?? null,
    p_corrected_score: parsed.data.corrected_score ?? null,
    p_request_id: parsed.data.request_id,
  });
  if (error) {
    const missing = error.code === "42501";
    return { ok: false as const, statusCode: missing ? 403 : 500, error: missing ? "judge_feedback_access_denied" : "agent_judge_feedback_write_failed" };
  }
  if (typeof feedbackId !== "string") return { ok: false as const, statusCode: 500, error: "agent_judge_feedback_write_failed" };
  return {
    ok: true as const,
    data: {
      id: feedbackId,
      judgment_id: judgmentId,
      criterion_id: parsed.data.criterion_id,
      decision: parsed.data.decision,
      reason_code: parsed.data.reason_code ?? null,
      note: parsed.data.note ?? null,
      corrected_status: parsed.data.corrected_status ?? null,
      corrected_score: parsed.data.corrected_score ?? null,
      created_at: new Date().toISOString(),
    },
  };
}
