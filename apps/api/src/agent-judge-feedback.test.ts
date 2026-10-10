import assert from "node:assert/strict";
import test from "node:test";
import { agentJudgeFeedbackInputSchema, submitAgentJudgeFeedback } from "./agent-judge-feedback.js";

const base = {
  criterion_id: "factuality",
  request_id: "81000000-0000-4000-8000-000000000001",
};

test("consultant feedback accepts agreement and reasoned corrections", () => {
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({ ...base, decision: "agree" }).success, true);
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({
    ...base, decision: "incorrect", reason_code: "missing_evidence", note: "La fuente citada no cubre este periodo.",
  }).success, true);
});

test("feedback requires a reason for disagreement and a note for other", () => {
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({ ...base, decision: "corrected" }).success, false);
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({ ...base, decision: "not_applicable", reason_code: "other" }).success, false);
});

test("feedback corrections require an explicit evaluability status and valid score", () => {
  const corrected = { ...base, decision: "corrected", reason_code: "accuracy" };
  assert.equal(agentJudgeFeedbackInputSchema.safeParse(corrected).success, false);
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({
    ...corrected, corrected_status: "evaluable", corrected_score: 3,
  }).success, true);
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({
    ...corrected, corrected_status: "evaluable", corrected_score: 5,
  }).success, false);
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({
    ...corrected, corrected_status: "no_evaluable", corrected_score: null,
  }).success, true);
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({
    ...corrected, corrected_status: "no_evaluable", corrected_score: 2,
  }).success, false);
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({
    ...base, decision: "agree", corrected_status: "evaluable", corrected_score: 3,
  }).success, false);
});

test("feedback rejects oversized notes, invalid IDs and extra payload fields", () => {
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({ ...base, decision: "agree", note: "x".repeat(1201) }).success, false);
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({ ...base, decision: "agree", request_id: "not-a-uuid" }).success, false);
  assert.equal(agentJudgeFeedbackInputSchema.safeParse({ ...base, decision: "agree", reviewer_id: "caller-chosen" }).success, false);
});

test("feedback rejects cross-organization and non-consultant callers before reading a judgment", async () => {
  const noMembership = await submitAgentJudgeFeedback(
    {} as never,
    "Bearer token",
    { user: { id: "user-1" }, profile: { platform_role: "consultant" }, memberships: [], subscriptions: [] } as never,
    "00000000-0000-4000-8000-000000000001",
    "81000000-0000-4000-8000-000000000001",
    "81000000-0000-4000-8000-000000000002",
    { ...base, decision: "agree" },
  );
  assert.equal(noMembership.ok, false);
  if (!noMembership.ok) assert.equal(noMembership.error, "organization_access_denied");

  const notConsultant = await submitAgentJudgeFeedback(
    {} as never,
    "Bearer token",
    {
      user: { id: "user-1" }, profile: { platform_role: "client" },
      memberships: [{ organization_id: "00000000-0000-4000-8000-000000000001", organization: { status: "active" } }],
      subscriptions: [],
    } as never,
    "00000000-0000-4000-8000-000000000001",
    "81000000-0000-4000-8000-000000000001",
    "81000000-0000-4000-8000-000000000002",
    { ...base, decision: "agree" },
  );
  assert.equal(notConsultant.ok, false);
  if (!notConsultant.ok) assert.equal(notConsultant.error, "judge_feedback_access_denied");
});
