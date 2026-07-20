/**
 * SQO-00/SQO-01: tests de aislamiento multi-tenant contra el Supabase remoto
 * real (no un mock). Crea dos organizaciones y varios usuarios de prueba
 * efimeros con la Admin API, firma sesiones reales con la publishable key
 * (para que las policies RLS se evaluen tal cual las evaluaria un usuario),
 * y verifica que nadie ve datos fuera de lo que le corresponde. Limpia todo
 * lo que crea en `after` (organizaciones + usuarios de prueba), no toca datos
 * reales de clientes.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/
 * SUPABASE_PUBLISHABLE_KEY apuntando al proyecto remoto (no hay Supabase
 * local en este entorno). Ejecutar con `npm run test -w @ecomscaling/api`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";

const env = loadApiEnv(process.env);

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

function anonClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const RUN_TAG = `${Date.now()}`;
const TEST_PASSWORD = "Rls-Test-P4ssword-9!";

type TestUser = { id: string; email: string; client: SupabaseClient };

async function createTestUser(label: string): Promise<TestUser> {
  const email = `rlstest-${label}-${RUN_TAG}@ecomscaling.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`No se pudo crear el usuario de prueba ${label}: ${error?.message}`);
  }

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });

  if (signInError) {
    throw new Error(`No se pudo iniciar sesion como ${label}: ${signInError.message}`);
  }

  return { id: data.user.id, email, client };
}

let orgA = "";
let orgB = "";
let ownerA: TestUser;
let ownerA2: TestUser;
let ownerB: TestUser;
let consultantA: TestUser;
let platformAdmin: TestUser;
let taskB = "";
let alertB = "";
let pendingOutputA = "";
let a02VersionId = "";

before(async () => {
  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .insert([
      { display_name: `RLS Test Org A ${RUN_TAG}`, slug: `rls-test-org-a-${RUN_TAG}`, status: "active" },
      { display_name: `RLS Test Org B ${RUN_TAG}`, slug: `rls-test-org-b-${RUN_TAG}`, status: "active" },
    ])
    .select("id, slug");

  if (orgsError || !orgs || orgs.length !== 2) {
    throw new Error(`No se pudieron crear las organizaciones de prueba: ${orgsError?.message}`);
  }

  orgA = orgs.find((org) => org.slug.startsWith("rls-test-org-a"))!.id;
  orgB = orgs.find((org) => org.slug.startsWith("rls-test-org-b"))!.id;

  [ownerA, ownerA2, ownerB, consultantA, platformAdmin] = await Promise.all([
    createTestUser("owner-a"),
    createTestUser("owner-a2"),
    createTestUser("owner-b"),
    createTestUser("consultant-a"),
    createTestUser("platform-admin"),
  ]);

  const [consultantRoleResult, adminRoleResult] = await Promise.all([
    admin.from("profiles").update({ platform_role: "consultant" }).eq("id", consultantA.id),
    admin.from("profiles").update({ platform_role: "platform_admin" }).eq("id", platformAdmin.id),
  ]);

  if (consultantRoleResult.error || adminRoleResult.error) {
    throw new Error(
      `No se pudieron fijar los roles de prueba: ${consultantRoleResult.error?.message ?? adminRoleResult.error?.message}`,
    );
  }

  const { error: membersError } = await admin.from("organization_members").insert([
    { organization_id: orgA, user_id: ownerA.id, role: "owner", is_active: true },
    { organization_id: orgA, user_id: ownerA2.id, role: "owner", is_active: true },
    { organization_id: orgB, user_id: ownerB.id, role: "owner", is_active: true },
  ]);

  if (membersError) {
    throw new Error(`No se pudieron crear memberships de prueba: ${membersError.message}`);
  }

  // can_access_org exige membership activa Y suscripcion valida (trial/active)
  // para un miembro normal (no aplica a consultor asignado ni platform_admin,
  // que acceden por otras clausulas). Sin esto un owner no ve ni su propia org.
  const { error: subscriptionsError } = await admin.from("service_subscriptions").insert([
    { organization_id: orgA, plan_code: "rls-test", status: "active" },
    { organization_id: orgB, plan_code: "rls-test", status: "active" },
  ]);

  if (subscriptionsError) {
    throw new Error(`No se pudieron crear las suscripciones de prueba: ${subscriptionsError.message}`);
  }

  const { error: assignmentError } = await admin.from("consultant_assignments").insert({
    organization_id: orgA,
    consultant_user_id: consultantA.id,
    is_primary: true,
    is_active: true,
  });

  if (assignmentError) {
    throw new Error(`No se pudo asignar el consultor de prueba: ${assignmentError.message}`);
  }

  const { data: taskRow, error: taskError } = await admin
    .from("tasks")
    .insert({
      organization_id: orgB,
      title: "Tarea privada org B",
      source: "manual",
      priority: "medium",
      is_visible_to_client: true,
      created_by: ownerB.id,
    })
    .select("id")
    .single();

  if (taskError || !taskRow) {
    throw new Error(`No se pudo crear la tarea de prueba: ${taskError?.message}`);
  }
  taskB = taskRow.id;

  const { data: alertRow, error: alertError } = await admin
    .from("alerts")
    .insert({
      organization_id: orgB,
      severity: "high",
      title: "Alerta privada org B",
      message: "Alerta de prueba para el test de aislamiento",
    })
    .select("id")
    .single();

  if (alertError || !alertRow) {
    throw new Error(`No se pudo crear la alerta de prueba: ${alertError?.message}`);
  }
  alertB = alertRow.id;

  // Salida IA pendiente de aprobacion en org A: el cliente NO debe verla,
  // el consultor asignado si (criterio AI-00/AI-02).
  const { data: agentVersion, error: agentVersionError } = await admin
    .from("agent_versions")
    .select("id, agent_definitions!inner(code)")
    .eq("agent_definitions.code", "a02_monitor_negocio")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (agentVersionError || !agentVersion) {
    throw new Error(`No se encontro la version del agente A02 para el test: ${agentVersionError?.message}`);
  }
  a02VersionId = agentVersion.id;

  const { data: runRow, error: runError } = await admin
    .from("agent_runs")
    .insert({
      organization_id: orgA,
      agent_version_id: a02VersionId,
      actor_user_id: platformAdmin.id,
      trigger_type: "manual",
      objective: "Run de prueba para el test de aislamiento",
      status: "succeeded",
    })
    .select("id")
    .single();

  if (runError || !runRow) {
    throw new Error(`No se pudo crear el run de prueba: ${runError?.message}`);
  }

  const { data: outputRow, error: outputError } = await admin
    .from("agent_outputs")
    .insert({
      run_id: runRow.id,
      organization_id: orgA,
      output: { answer: "pendiente de aprobacion", findings: [], recommendations: [], sources: [], proposed_writes: [], approval_required: true, confidence: "low", warnings: [] },
      approval_required: true,
      status: "pending_approval",
    })
    .select("id")
    .single();

  if (outputError || !outputRow) {
    throw new Error(`No se pudo crear la salida IA de prueba: ${outputError?.message}`);
  }
  pendingOutputA = outputRow.id;
});

after(async () => {
  // Cascade limpia memberships/tasks/alerts/agent_*/ai_conversations al
  // borrar las organizaciones; solo falta borrar los usuarios de prueba.
  await admin.from("organizations").delete().in("id", [orgA, orgB]);

  for (const user of [ownerA, ownerA2, ownerB, consultantA, platformAdmin]) {
    if (user?.id) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
});

test("un cliente no ve la organizacion de otro cliente", async () => {
  const { data, error } = await ownerA.client.from("organizations").select("id").eq("id", orgB);
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

test("un cliente si ve su propia organizacion", async () => {
  const { data, error } = await ownerA.client.from("organizations").select("id").eq("id", orgA);
  assert.equal(error, null);
  assert.equal(data?.length, 1);
});

test("un cliente no ve tareas de otra organizacion", async () => {
  const { data, error } = await ownerA.client.from("tasks").select("id").eq("id", taskB);
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

test("un cliente no ve alertas de otra organizacion", async () => {
  const { data, error } = await ownerA.client.from("alerts").select("id").eq("id", alertB);
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

test("un consultor solo ve las organizaciones que tiene asignadas", async () => {
  const { data: visibleA } = await consultantA.client.from("organizations").select("id").eq("id", orgA);
  assert.equal(visibleA?.length, 1);

  const { data: visibleB, error } = await consultantA.client.from("organizations").select("id").eq("id", orgB);
  assert.equal(error, null);
  assert.deepEqual(visibleB, []);
});

test("platform_admin ve ambas organizaciones", async () => {
  const { data, error } = await platformAdmin.client
    .from("organizations")
    .select("id")
    .in("id", [orgA, orgB]);
  assert.equal(error, null);
  assert.equal(data?.length, 2);
});

test("un cliente NO ve una salida IA pendiente de aprobacion de su propia organizacion", async () => {
  const { data, error } = await ownerA.client.from("agent_outputs").select("id").eq("id", pendingOutputA);
  assert.equal(error, null);
  assert.deepEqual(data, [], "el cliente no debe ver salidas pending_approval (AI-00/AI-02)");
});

test("el consultor asignado SI ve la salida IA pendiente de aprobacion", async () => {
  const { data, error } = await consultantA.client.from("agent_outputs").select("id").eq("id", pendingOutputA);
  assert.equal(error, null);
  assert.equal(data?.length, 1);
});

test("las conversaciones del copiloto (A09) son privadas por usuario, no por organizacion", async () => {
  // ownerA y ownerA2 son ambos miembros de orgA; una conversacion de ownerA
  // no debe ser visible para ownerA2 aunque compartan organizacion. El
  // usuario normal no tiene grant de insert (solo select): igual que en
  // produccion, la conversacion la crea el backend con service role.
  const { data: conversation, error: insertError } = await admin
    .from("ai_conversations")
    .insert({ organization_id: orgA, user_id: ownerA.id, agent_code: "a09_copiloto_consultor", title: "Test" })
    .select("id")
    .single();

  assert.equal(insertError, null);
  assert.ok(conversation?.id);

  const { data: visibleToOwner, error: ownerError } = await ownerA.client
    .from("ai_conversations")
    .select("id")
    .eq("id", conversation!.id);
  assert.equal(ownerError, null);
  assert.equal(visibleToOwner?.length, 1);

  const { data: visibleToOther, error: otherError } = await ownerA2.client
    .from("ai_conversations")
    .select("id")
    .eq("id", conversation!.id);
  assert.equal(otherError, null);
  assert.deepEqual(visibleToOther, [], "otro miembro de la misma organizacion no debe ver la conversacion");
});

test("un miembro puede ver el consultor asignado a SU organizacion", async () => {
  // Diseno intencional: consultant_assignments_select_authorized permite
  // can_access_org, para que el cliente pueda ver quien es su consultor.
  const { data, error } = await ownerA.client
    .from("consultant_assignments")
    .select("id")
    .eq("organization_id", orgA);
  assert.equal(error, null);
  assert.equal(data?.length, 1);
});

test("un miembro NO puede ver las asignaciones de consultor de otra organizacion", async () => {
  const { data, error } = await ownerB.client
    .from("consultant_assignments")
    .select("id")
    .eq("organization_id", orgA);
  assert.equal(error, null);
  assert.deepEqual(data, []);
});
