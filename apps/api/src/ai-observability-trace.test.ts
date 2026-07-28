/**
 * AI-12 (Observability & tracing): antes reconstruir una ejecucion de agente
 * (pasos, herramientas, snapshots de contexto, consultas SQL) exigia
 * consultar 4 tablas a mano. `getAgentRunTrace` las consolida en una sola
 * respuesta, restringida a consultor/platform_admin (mismo criterio que
 * `agent_context_snapshots`/`agent_query_runs`, que ya limitan su RLS a ese
 * rol). Levanta el servidor Fastify real con `buildApp()` (mismo pipeline de
 * rutas/hooks que produccion) con usuarios autenticados de verdad.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/
 * SUPABASE_PUBLISHABLE_KEY. Ejecutar con `npm run test -w @ecomscaling/api`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyInstance } from "fastify";
import { loadApiEnv } from "@ecomscaling/config";
import { buildApp } from "./server.js";

const env = loadApiEnv(process.env);

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `${Date.now()}`;
const TEST_PASSWORD = "Ai12-Trace-Test-P4ssword-9!";

let app: FastifyInstance;
let orgId = "";
let ownerUserId = "";
let consultantUserId = "";
let ownerAccessToken = "";
let consultantAccessToken = "";
let runId = "";

async function signIn(email: string): Promise<string> {
  const anon: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error } = await anon.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error || !session.session) {
    throw new Error(`No se pudo iniciar sesion como ${email}: ${error?.message}`);
  }
  return session.session.access_token;
}

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ display_name: `AI-12 Trace Test ${RUN_TAG}`, slug: `ai12-trace-test-${RUN_TAG}`, status: "active" })
    .select("id")
    .single();
  if (orgError || !org) {
    throw new Error(`No se pudo crear la organizacion de prueba: ${orgError?.message}`);
  }
  orgId = org.id;

  const ownerEmail = `ai12-trace-owner-${RUN_TAG}@ecomscaling.test`;
  const { data: owner, error: ownerError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (ownerError || !owner.user) {
    throw new Error(`No se pudo crear el owner de prueba: ${ownerError?.message}`);
  }
  ownerUserId = owner.user.id;

  const consultantEmail = `ai12-trace-consultant-${RUN_TAG}@ecomscaling.test`;
  const { data: consultant, error: consultantError } = await admin.auth.admin.createUser({
    email: consultantEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (consultantError || !consultant.user) {
    throw new Error(`No se pudo crear el consultor de prueba: ${consultantError?.message}`);
  }
  consultantUserId = consultant.user.id;
  await admin.from("profiles").update({ platform_role: "consultant" }).eq("id", consultantUserId);

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: ownerUserId, role: "owner" });
  if (memberError) {
    throw new Error(`No se pudo crear la membership de prueba: ${memberError.message}`);
  }

  const { error: subscriptionError } = await admin.from("service_subscriptions").insert({
    organization_id: orgId,
    plan_code: "ai12-trace-test",
    status: "active",
  });
  if (subscriptionError) {
    throw new Error(`No se pudo crear la suscripcion de prueba: ${subscriptionError.message}`);
  }

  const { error: assignmentError } = await admin.from("consultant_assignments").insert({
    organization_id: orgId,
    consultant_user_id: consultantUserId,
    is_primary: true,
    is_active: true,
  });
  if (assignmentError) {
    throw new Error(`No se pudo asignar el consultor de prueba: ${assignmentError.message}`);
  }

  const { data: agentVersion, error: agentVersionError } = await admin
    .from("agent_versions")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (agentVersionError || !agentVersion) {
    throw new Error(`No se encontro una version de agente activa para el test: ${agentVersionError?.message}`);
  }

  const { data: run, error: runError } = await admin
    .from("agent_runs")
    .insert({
      organization_id: orgId,
      agent_version_id: agentVersion.id,
      actor_user_id: consultantUserId,
      trigger_type: "manual",
      objective: "Run de prueba AI-12 trace",
      status: "succeeded",
    })
    .select("id")
    .single();
  if (runError || !run) {
    throw new Error(`No se pudo crear el run de prueba: ${runError?.message}`);
  }
  runId = run.id;

  const [stepResult, toolCallResult, snapshotResult, queryRunResult] = await Promise.all([
    admin.from("agent_run_steps").insert({
      run_id: runId,
      organization_id: orgId,
      position: 1,
      step_type: "model_response",
      summary: "Paso de prueba",
      duration_ms: 120,
    }),
    admin.from("agent_tool_calls").insert({
      run_id: runId,
      organization_id: orgId,
      tool_name: "sql_select",
      is_error: false,
      duration_ms: 80,
    }),
    admin.from("agent_context_snapshots").insert({
      run_id: runId,
      organization_id: orgId,
      context_level: "C1",
      snapshot: { label: "Contexto de prueba" },
    }),
    admin.from("agent_query_runs").insert({
      run_id: runId,
      organization_id: orgId,
      sql_text: "select 1",
      rows_returned: 1,
      duration_ms: 5,
      was_rejected: false,
    }),
  ]);

  for (const [label, result] of [
    ["step", stepResult],
    ["tool_call", toolCallResult],
    ["snapshot", snapshotResult],
    ["query_run", queryRunResult],
  ] as const) {
    if (result.error) {
      throw new Error(`No se pudo sembrar ${label} de prueba: ${result.error.message}`);
    }
  }

  ownerAccessToken = await signIn(ownerEmail);
  consultantAccessToken = await signIn(consultantEmail);

  app = await buildApp();
  await app.ready();
});

after(async () => {
  if (app) {
    await app.close();
  }
  for (const userId of [ownerUserId, consultantUserId]) {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
  if (orgId) {
    await admin.from("organizations").delete().eq("id", orgId);
  }
});

test("un cliente (no consultor/platform_admin) no puede ver la traza de un agent_run", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/v1/organizations/${orgId}/ai/runs/${runId}/trace`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });

  assert.equal(response.statusCode, 403, response.body);
  const body = JSON.parse(response.body);
  assert.equal(body.error, "trace_access_denied");
});

test("el consultor asignado si ve la traza completa (run + pasos + herramientas + contexto + SQL)", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/v1/organizations/${orgId}/ai/runs/${runId}/trace`,
    headers: { authorization: `Bearer ${consultantAccessToken}` },
  });

  assert.equal(response.statusCode, 200, response.body);
  const body = JSON.parse(response.body) as {
    run: { id: string; status: string };
    steps: unknown[];
    tool_calls: unknown[];
    context_snapshots: unknown[];
    query_runs: unknown[];
  };

  assert.equal(body.run.id, runId);
  assert.equal(body.run.status, "succeeded");
  assert.equal(body.steps.length, 1);
  assert.equal(body.tool_calls.length, 1);
  assert.equal(body.context_snapshots.length, 1);
  assert.equal(body.query_runs.length, 1);
});

test("un runId que no existe de verdad devuelve 404, no una traza vacia", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/v1/organizations/${orgId}/ai/runs/00000000-0000-0000-0000-000000000000/trace`,
    headers: { authorization: `Bearer ${consultantAccessToken}` },
  });

  assert.equal(response.statusCode, 404, response.body);
  const body = JSON.parse(response.body);
  assert.equal(body.error, "agent_run_not_found");
});
