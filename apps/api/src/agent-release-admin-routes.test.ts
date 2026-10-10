import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyInstance } from "fastify";
import { loadApiEnv } from "@e-nora/config";
import { buildApp } from "./server.js";

const env = loadApiEnv(process.env);
const expectedTestRef = process.env.SUPABASE_TEST_PROJECT_REF;
const actualProjectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0];
if (!expectedTestRef || actualProjectRef !== expectedTestRef || expectedTestRef === process.env.SUPABASE_PRODUCTION_PROJECT_REF) {
  throw new Error("agent_release_route_test_refused_outside_isolated_test_project");
}

const admin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const runTag = `${Date.now()}`;
const email = `agent-release-routes-${runTag}@ecomscaling.test`;
const password = `Agent-Release-${runTag}-P4ssword!`;

let app: FastifyInstance;
let userId = "";
let accessToken = "";
let platformAdminId = "";
let platformAdminAccessToken = "";
let authenticatedSupabase: SupabaseClient | undefined;
let organizationId = "";

before(async () => {
  const { data: organization, error: organizationError } = await admin.from("organizations")
    .insert({
      display_name: `Agent Release Route Test ${runTag}`,
      slug: `agent-release-route-test-${runTag}`,
      status: "active",
    })
    .select("id")
    .single();
  if (organizationError || !organization) {
    throw new Error(`release_route_test_org_create_failed:${organizationError?.message}`);
  }
  organizationId = organization.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`release_route_test_user_create_failed:${error?.message}`);
  userId = data.user.id;

  const { error: profileError } = await admin.from("profiles")
    .update({ platform_role: "consultant", is_active: true })
    .eq("id", userId);
  if (profileError) throw new Error(`release_route_test_profile_update_failed:${profileError.message}`);

  const { error: membershipError } = await admin.from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      role: "member",
      is_active: true,
      joined_at: new Date().toISOString(),
    });
  if (membershipError) throw new Error(`release_route_test_membership_create_failed:${membershipError.message}`);

  const { error: subscriptionError } = await admin.from("service_subscriptions")
    .insert({ organization_id: organizationId, plan_code: "agent-release-route-test", status: "active" });
  if (subscriptionError) throw new Error(`release_route_test_subscription_create_failed:${subscriptionError.message}`);

  const publishable = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: signInError } = await publishable.auth.signInWithPassword({ email, password });
  if (signInError || !session.session) throw new Error(`release_route_test_sign_in_failed:${signInError?.message}`);
  accessToken = session.session.access_token;

  const adminEmail = `agent-release-admin-${runTag}@ecomscaling.test`;
  const { data: adminUser, error: adminUserError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: `Agent-Release-Admin-${runTag}-P4ssword!`,
    email_confirm: true,
  });
  if (adminUserError || !adminUser.user) throw new Error(`release_route_test_admin_create_failed:${adminUserError?.message}`);
  platformAdminId = adminUser.user.id;
  const { error: adminProfileError } = await admin.from("profiles")
    .update({ is_platform_staff: true, is_active: true })
    .eq("id", platformAdminId);
  if (adminProfileError) throw new Error(`release_route_test_admin_profile_failed:${adminProfileError.message}`);
  const { error: adminMembershipError } = await admin.from("organization_members")
    .insert({ organization_id: organizationId, user_id: platformAdminId, role: "member", is_active: true, joined_at: new Date().toISOString() });
  if (adminMembershipError) throw new Error(`release_route_test_admin_membership_failed:${adminMembershipError.message}`);
  const { data: adminSession, error: adminSignInError } = await publishable.auth.signInWithPassword({
    email: adminEmail,
    password: `Agent-Release-Admin-${runTag}-P4ssword!`,
  });
  if (adminSignInError || !adminSession.session) throw new Error(`release_route_test_admin_sign_in_failed:${adminSignInError?.message}`);
  platformAdminAccessToken = adminSession.session.access_token;
  authenticatedSupabase = publishable;

  app = await buildApp();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  if (platformAdminId) await admin.auth.admin.deleteUser(platformAdminId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (organizationId) await admin.from("organizations").delete().eq("id", organizationId);
});

test("release candidate endpoints reject unauthenticated requests", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/admin/agent-release-candidates" });
  assert.equal(response.statusCode, 401, response.body);
});

test("blind judge dataset endpoints require platform admin authentication", async () => {
  const anonymous = await app.inject({ method: "GET", url: "/v1/admin/agent-judge-dataset/cases?split=holdout" });
  assert.equal(anonymous.statusCode, 401, anonymous.body);
  const headers = { authorization: `Bearer ${accessToken}` };
  const consultantRead = await app.inject({ method: "GET", url: "/v1/admin/agent-judge-dataset/cases?split=holdout", headers });
  assert.equal(consultantRead.statusCode, 403, consultantRead.body);
  const consultantCreate = await app.inject({ method: "POST", url: "/v1/admin/agent-judge-dataset/cases", headers, payload: {} });
  assert.equal(consultantCreate.statusCode, 403, consultantCreate.body);
});

test("consultants cannot inspect, evaluate or promote agent release candidates", async () => {
  const headers = { authorization: `Bearer ${accessToken}` };
  const candidates = await app.inject({
    method: "GET",
    url: "/v1/admin/agent-release-candidates",
    headers,
  });
  assert.equal(candidates.statusCode, 403, candidates.body);

  const evaluate = await app.inject({
    method: "POST",
    url: "/v1/admin/agent-release-candidates/00000000-0000-4000-8000-000000000001/evaluate-offline",
    headers,
  });
  assert.equal(evaluate.statusCode, 403, evaluate.body);

  const promote = await app.inject({
    method: "POST",
    url: "/v1/admin/agent-release-candidates/00000000-0000-4000-8000-000000000001/promote",
    headers,
  });
  assert.equal(promote.statusCode, 403, promote.body);
});

test("platform admin can persist a corrected judge label through the feedback RPC", async () => {
  const { data: version, error: versionError } = await admin.from("agent_versions")
    .select("id, agent_definitions!inner(code)")
    .eq("agent_definitions.code", "a01_analista_llamadas")
    .eq("is_active", true)
    .limit(1)
    .single();
  if (versionError || !version) throw new Error(`judge_feedback_test_version_missing:${versionError?.message}`);

  const { data: run, error: runError } = await admin.from("agent_runs")
    .insert({
      organization_id: organizationId,
      agent_version_id: version.id,
      actor_user_id: userId,
      trigger_type: "manual",
      objective: "Isolated judge feedback route test",
      status: "succeeded",
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error(`judge_feedback_test_run_create_failed:${runError?.message}`);

  const judgmentId = randomUUID();
  const { error: judgmentError } = await admin.from("agent_run_judgments").insert({
    id: judgmentId,
    organization_id: organizationId,
    agent_run_id: run.id,
    agent_code: "a01_analista_llamadas",
    artifact_kind: "agent_output",
    idempotency_key: `feedback-route-test-${run.id}`,
    rubric_version: "judge-rubrics-test",
    status: "review",
    overall_score: 2,
    result: { criteria: [{ criterion_id: "factuality", score: 2, status: "evaluable" }] },
    provider: "openai",
    model: "gpt-6-luna",
    input_fingerprint: "test-fingerprint",
  });
  if (judgmentError) throw new Error(`judge_feedback_test_judgment_create_failed:${judgmentError.message}`);

  const requestId = randomUUID();
  const response = await app.inject({
    method: "POST",
    url: `/v1/organizations/${organizationId}/ai/runs/${run.id}/judgments/${judgmentId}/feedback`,
    headers: { authorization: `Bearer ${platformAdminAccessToken}` },
    payload: {
      criterion_id: "factuality",
      decision: "corrected",
      reason_code: "accuracy",
      corrected_status: "evaluable",
      corrected_score: 4,
      request_id: requestId,
    },
  });
  assert.equal(response.statusCode, 201, response.body);
  const result = response.json();
  assert.equal(result.corrected_status, "evaluable");
  assert.equal(result.corrected_score, 4);

  const replay = await app.inject({
    method: "POST",
    url: `/v1/organizations/${organizationId}/ai/runs/${run.id}/judgments/${judgmentId}/feedback`,
    headers: { authorization: `Bearer ${platformAdminAccessToken}` },
    payload: {
      criterion_id: "factuality",
      decision: "corrected",
      reason_code: "accuracy",
      corrected_status: "evaluable",
      corrected_score: 4,
      request_id: requestId,
    },
  });
  assert.equal(replay.statusCode, 201, replay.body);
  assert.equal(replay.json().id, result.id);

  const invalid = await app.inject({
    method: "POST",
    url: `/v1/organizations/${organizationId}/ai/runs/${run.id}/judgments/${judgmentId}/feedback`,
    headers: { authorization: `Bearer ${platformAdminAccessToken}` },
    payload: {
      criterion_id: "factuality",
      decision: "corrected",
      reason_code: "accuracy",
      corrected_status: "evaluable",
      request_id: randomUUID(),
    },
  });
  assert.equal(invalid.statusCode, 400, invalid.body);

  const { data: stored, error: storedError } = await admin.from("agent_judgment_feedback")
    .select("corrected_status, corrected_score")
    .eq("id", result.id)
    .single();
  if (storedError || !stored) throw new Error(`judge_feedback_test_read_failed:${storedError?.message}`);
  assert.deepEqual(stored, { corrected_status: "evaluable", corrected_score: 4 });

  const legacyRequestId = randomUUID();
  if (!authenticatedSupabase) throw new Error("judge_feedback_legacy_client_missing");
  const { data: legacyFeedbackId, error: legacyFeedbackError } = await authenticatedSupabase.rpc(
    "record_agent_judgment_feedback",
    {
      p_judgment_id: judgmentId,
      p_agent_run_id: run.id,
      p_organization_id: organizationId,
      p_criterion_id: "factuality",
      p_decision: "corrected",
      p_reason_code: "accuracy",
      p_note: "Legacy client without a score field",
      p_request_id: legacyRequestId,
    },
  );
  if (legacyFeedbackError) throw new Error(`judge_feedback_legacy_rpc_failed:${legacyFeedbackError.message}`);
  assert.equal(typeof legacyFeedbackId, "string");
  const { data: legacyStored, error: legacyStoredError } = await admin.from("agent_judgment_feedback")
    .select("corrected_status, corrected_score")
    .eq("id", legacyFeedbackId)
    .single();
  if (legacyStoredError || !legacyStored) throw new Error(`judge_feedback_legacy_read_failed:${legacyStoredError?.message}`);
  assert.deepEqual(legacyStored, { corrected_status: null, corrected_score: null });
});

