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
let financialSettingsB = "";
let fixedExpenseB = "";
let connectionB = "";
let syncRunB = "";
let internalTaskA = "";
let internalTaskHistoryA = "";
let draftPlanA = "";
let activePlanA = "";

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

  // SQO-00 (gap identificado 2026-07-20: "solo 3 dominios probados
  // organizations/tasks/alerts, falta configuracion financiera y
  // conexiones"). Datos privados de orgB para probar que orgA no los ve.
  const { data: financialRow, error: financialError } = await admin
    .from("organization_financial_settings")
    .insert({ organization_id: orgB, currency_code: "EUR", payment_fee_pct: 2.5, vat_pct: 21 })
    .select("id")
    .single();
  if (financialError || !financialRow) {
    throw new Error(`No se pudo crear la configuracion financiera de prueba: ${financialError?.message}`);
  }
  financialSettingsB = financialRow.id;

  const { data: expenseRow, error: expenseError } = await admin
    .from("fixed_expenses")
    .insert({ organization_id: orgB, name: "Alquiler almacen", amount: 500 })
    .select("id")
    .single();
  if (expenseError || !expenseRow) {
    throw new Error(`No se pudo crear el gasto fijo de prueba: ${expenseError?.message}`);
  }
  fixedExpenseB = expenseRow.id;

  const { data: connectionRow, error: connectionError } = await admin
    .from("integration_connections")
    .insert({ organization_id: orgB, provider: "shopify", status: "connected" })
    .select("id")
    .single();
  if (connectionError || !connectionRow) {
    throw new Error(`No se pudo crear la conexion de prueba: ${connectionError?.message}`);
  }
  connectionB = connectionRow.id;

  const { data: syncRunRow, error: syncRunError } = await admin
    .from("integration_sync_runs")
    .insert({
      connection_id: connectionB,
      organization_id: orgB,
      provider: "shopify",
      sync_type: "manual",
      idempotency_key: `rls-test-${RUN_TAG}`,
    })
    .select("id")
    .single();
  if (syncRunError || !syncRunRow) {
    throw new Error(`No se pudo crear el sync run de prueba: ${syncRunError?.message}`);
  }
  syncRunB = syncRunRow.id;

  // FE-03 (gap encontrado 2026-07-22): tarea interna del consultor en orgA
  // (is_visible_to_client = false) con una entrada en task_status_history,
  // para probar que el cliente no ve ni la tarea ni su historial.
  const { data: internalTaskRow, error: internalTaskError } = await admin
    .from("tasks")
    .insert({
      organization_id: orgA,
      title: "Tarea interna del consultor",
      source: "manual",
      priority: "low",
      is_visible_to_client: false,
      created_by: consultantA.id,
    })
    .select("id")
    .single();
  if (internalTaskError || !internalTaskRow) {
    throw new Error(`No se pudo crear la tarea interna de prueba: ${internalTaskError?.message}`);
  }
  internalTaskA = internalTaskRow.id;

  const { data: internalTaskHistoryRow, error: internalTaskHistoryError } = await admin
    .from("task_status_history")
    .insert({
      organization_id: orgA,
      task_id: internalTaskA,
      new_status: "in_progress",
      changed_by: consultantA.id,
      reason: "Nota interna del consultor no apta para el cliente",
    })
    .select("id")
    .single();
  if (internalTaskHistoryError || !internalTaskHistoryRow) {
    throw new Error(`No se pudo crear el historial de la tarea interna: ${internalTaskHistoryError?.message}`);
  }
  internalTaskHistoryA = internalTaskHistoryRow.id;

  // FE-03 (gap encontrado 2026-07-22): un plan estrategico en draft no
  // deberia ser visible al cliente todavia, a diferencia de uno activo.
  const { data: plansRows, error: plansError } = await admin
    .from("strategic_plans")
    .insert([
      { organization_id: orgA, name: "Plan en borrador", status: "draft", created_by: consultantA.id },
      { organization_id: orgA, name: "Plan activo", status: "active", created_by: consultantA.id },
    ])
    .select("id, status");
  if (plansError || !plansRows || plansRows.length !== 2) {
    throw new Error(`No se pudieron crear los planes estrategicos de prueba: ${plansError?.message}`);
  }
  draftPlanA = plansRows.find((plan) => plan.status === "draft")!.id;
  activePlanA = plansRows.find((plan) => plan.status === "active")!.id;
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

// DB-02 (gap identificado 2026-07-20: "sin tests de escritura cross-tenant").
// Las 3 tablas de abajo son las unicas donde `authenticated` tiene grant de
// escritura directa (insert/update/all) fuera del propio usuario -- el resto
// de escrituras del producto pasan por el backend con service_role, que ya
// valida organization_id en Node antes de escribir. Aqui se prueba el ultimo
// nivel de defensa (RLS) directamente, sin pasar por el backend.
test("un owner no puede conectar una integracion (Shopify) en otra organizacion", async () => {
  const { data, error } = await ownerA.client
    .from("integration_connections")
    .insert({ organization_id: orgB, provider: "shopify", status: "pending" })
    .select("id");

  // RLS deniega por el WITH CHECK (can_manage_org(orgB) es false para
  // ownerA); segun el driver esto llega como error o como 0 filas insertadas.
  assert.ok(error || (data?.length ?? 0) === 0, "se pudo insertar una conexion en la organizacion de otro cliente");
});

test("un owner no puede renombrar la organizacion de otro cliente", async () => {
  const { data, error } = await ownerA.client
    .from("organizations")
    .update({ display_name: "Hackeado por owner A" })
    .eq("id", orgB)
    .select("id");

  assert.equal(error, null);
  assert.deepEqual(data, [], "el UPDATE no debe afectar ninguna fila de la organizacion de otro cliente");

  const { data: unchanged } = await admin.from("organizations").select("display_name").eq("id", orgB).single();
  assert.notEqual(unchanged?.display_name, "Hackeado por owner A");
});

test("un owner no puede anadirse a si mismo como miembro de otra organizacion", async () => {
  const { data, error } = await ownerA.client
    .from("organization_members")
    .insert({ organization_id: orgB, user_id: ownerA.id, role: "owner", is_active: true })
    .select("id");

  assert.ok(
    error || (data?.length ?? 0) === 0,
    "un cliente pudo auto-otorgarse membresia en la organizacion de otro cliente",
  );
});

// DB-02 (gap: "sin constraint que impida un enlace cross-tenant"). El
// constraint SI existe (trigger `enforce_task_alert_same_org`,
// db_07_alertas_tareas_plan.sql) pero no tenia ningun test que lo confirmara
// -- se prueba con service_role porque `tasks` no tiene policy de INSERT
// para `authenticated` (las tareas las escribe el backend, nunca el cliente).
test("el trigger de integridad rechaza una tarea que enlaza una alerta de otra organizacion", async () => {
  const { error } = await admin.from("tasks").insert({
    organization_id: orgA,
    alert_id: alertB,
    title: "Tarea maliciosa enlazada a alerta de otra org",
    source: "manual",
    priority: "medium",
    is_visible_to_client: true,
    created_by: ownerA.id,
  });

  assert.ok(error, "se esperaba que el trigger enforce_task_alert_same_org rechazara el enlace cross-tenant");
  assert.match(error!.message, /same organization/);
});

// DB-02 (gap: "sin test de organizacion suspendida perdiendo acceso en
// caliente"). `is_active_org_member` exige `status in ('onboarding',
// 'active')`, asi que suspender la organizacion debe cortar el acceso del
// dueño en la siguiente query, sin re-login ni cache de sesion de por medio.
test("un owner pierde acceso a su organizacion en cuanto se suspende (en caliente, sin re-login)", async () => {
  const { error: suspendError } = await admin
    .from("organizations")
    .update({ status: "suspended" })
    .eq("id", orgA);
  assert.equal(suspendError, null);

  try {
    const { data, error } = await ownerA.client.from("organizations").select("id").eq("id", orgA);
    assert.equal(error, null);
    assert.deepEqual(data, [], "el owner sigue viendo su organizacion suspendida");
  } finally {
    await admin.from("organizations").update({ status: "active" }).eq("id", orgA);
  }
});

// DB-02 (gap: "sin test de membresia suspendida perdiendo acceso en
// caliente"). Distinto del caso anterior: aqui la organizacion sigue activa,
// solo se desactiva la membresia de ownerA2 (no afecta a ownerA, que sigue
// activo en la misma organizacion).
// DB-08 (gap: "sin verificacion explicita de acceso cliente antes y despues
// de publicar, mas alla de la policy RLS -- no cubierto por
// rls-tenant-isolation.test.ts todavia").
test("el cliente no ve un resumen de llamada en borrador, pero si en cuanto se publica", async () => {
  const { data: call, error: callError } = await admin
    .from("consulting_calls")
    .insert({
      organization_id: orgA,
      title: "Llamada de prueba DB-08",
      is_visible_to_client: true,
      created_by: platformAdmin.id,
    })
    .select("id")
    .single();
  assert.equal(callError, null);

  const { data: summary, error: summaryError } = await admin
    .from("call_ai_summaries")
    .insert({ call_id: call!.id, organization_id: orgA, summary: "Resumen de prueba", status: "draft" })
    .select("id")
    .single();
  assert.equal(summaryError, null);

  const { data: draftVisible, error: draftError } = await ownerA.client
    .from("call_ai_summaries")
    .select("id")
    .eq("id", summary!.id);
  assert.equal(draftError, null);
  assert.deepEqual(draftVisible, [], "el cliente no debe ver un resumen en borrador");

  const { data: draftVisibleToConsultant } = await consultantA.client
    .from("call_ai_summaries")
    .select("id")
    .eq("id", summary!.id);
  assert.equal(draftVisibleToConsultant?.length, 1, "el consultor asignado si debe ver el borrador");

  await admin.from("call_ai_summaries").update({ status: "published" }).eq("id", summary!.id);

  const { data: publishedVisible, error: publishedError } = await ownerA.client
    .from("call_ai_summaries")
    .select("id")
    .eq("id", summary!.id);
  assert.equal(publishedError, null);
  assert.equal(publishedVisible?.length, 1, "el cliente debe ver el resumen una vez publicado");
});

// BE-01 (gap: "sin test de invalidacion inmediata al suspender una
// consultant_assignment en caliente").
test("un consultor pierde acceso en cuanto se desactiva su asignacion (en caliente, sin re-login)", async () => {
  const { error: deactivateError } = await admin
    .from("consultant_assignments")
    .update({ is_active: false })
    .eq("organization_id", orgA)
    .eq("consultant_user_id", consultantA.id);
  assert.equal(deactivateError, null);

  try {
    const { data, error } = await consultantA.client.from("organizations").select("id").eq("id", orgA);
    assert.equal(error, null);
    assert.deepEqual(data, [], "el consultor sigue viendo la organizacion tras desactivar su asignacion");
  } finally {
    await admin
      .from("consultant_assignments")
      .update({ is_active: true })
      .eq("organization_id", orgA)
      .eq("consultant_user_id", consultantA.id);
  }
});

test("un miembro pierde acceso en cuanto su membresia se desactiva (en caliente, sin re-login)", async () => {
  const { error: deactivateError } = await admin
    .from("organization_members")
    .update({ is_active: false })
    .eq("organization_id", orgA)
    .eq("user_id", ownerA2.id);
  assert.equal(deactivateError, null);

  try {
    const { data, error } = await ownerA2.client.from("organizations").select("id").eq("id", orgA);
    assert.equal(error, null);
    assert.deepEqual(data, [], "el miembro desactivado sigue viendo la organizacion");

    const { data: stillActive } = await ownerA.client.from("organizations").select("id").eq("id", orgA);
    assert.equal(stillActive?.length, 1, "desactivar a ownerA2 no debe afectar el acceso de ownerA");
  } finally {
    await admin
      .from("organization_members")
      .update({ is_active: true })
      .eq("organization_id", orgA)
      .eq("user_id", ownerA2.id);
  }
});

// SQO-00 (gap cerrado 2026-07-22: "solo 3 dominios probados, falta
// configuracion financiera y conexiones"). Las 4 tablas de DB-03 solo tienen
// policy de SELECT para authenticated (using can_access_org) -- ninguna tiene
// grant de insert/update/delete, toda escritura pasa por el backend con
// service_role + chequeo manual de rol (ver ADR-0006, DB-03).
test("un cliente no ve la configuracion financiera de otra organizacion", async () => {
  const { data, error } = await ownerA.client
    .from("organization_financial_settings")
    .select("id")
    .eq("id", financialSettingsB);
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

test("un cliente no ve los gastos fijos de otra organizacion", async () => {
  const { data, error } = await ownerA.client.from("fixed_expenses").select("id").eq("id", fixedExpenseB);
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

test("un cliente no puede insertar configuracion financiera directamente (sin grant, solo backend con service role)", async () => {
  const { data, error } = await ownerA.client
    .from("organization_financial_settings")
    .insert({ organization_id: orgA, currency_code: "EUR" })
    .select("id");
  assert.ok(
    error || (data?.length ?? 0) === 0,
    "un cliente pudo insertar configuracion financiera sin pasar por el backend",
  );
});

// DB-04 (gap: "insert cross-tenant probado, pero no select/update cross-tenant
// de conexiones ni sync runs").
test("un cliente no ve las conexiones de integracion de otra organizacion", async () => {
  const { data, error } = await ownerA.client
    .from("integration_connections")
    .select("id")
    .eq("id", connectionB);
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

test("un owner no puede actualizar la conexion de otra organizacion", async () => {
  const { data, error } = await ownerA.client
    .from("integration_connections")
    .update({ status: "revoked" })
    .eq("id", connectionB)
    .select("id");
  assert.equal(error, null);
  assert.deepEqual(data, [], "el UPDATE no debe afectar la conexion de otro cliente");

  const { data: unchanged } = await admin
    .from("integration_connections")
    .select("status")
    .eq("id", connectionB)
    .single();
  assert.notEqual(unchanged?.status, "revoked");
});

test("un cliente no ve los sync runs de otra organizacion", async () => {
  const { data, error } = await ownerA.client.from("integration_sync_runs").select("id").eq("id", syncRunB);
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

// SQO-00: confirmar que el schema `private` (credenciales cifradas, payloads
// de webhooks) no esta expuesto por PostgREST en absoluto -- proteccion
// independiente de RLS (`supabase/config.toml`: schemas = ["public",
// "graphql_public"]). Si esto alguna vez se expone por error, RLS deja de ser
// la unica linea de defensa para secretos.
// FE-03 (gap encontrado 2026-07-22 documentando la matriz de visibilidad):
// tasks_select_authorized ya ocultaba tareas internas al cliente, pero
// task_status_history_select_authorized solo miraba can_access_org, sin
// mirar is_visible_to_client de la tarea referenciada -- un cliente podia
// consultar el historial de una tarea interna directamente aunque no
// pudiera ver la tarea. Corregido en la migracion
// db_07_task_status_history_visibility_fix.
test("un cliente no ve una tarea interna del consultor", async () => {
  const { data, error } = await ownerA.client.from("tasks").select("id").eq("id", internalTaskA);
  assert.equal(error, null);
  assert.deepEqual(data, []);
});

test("un cliente no ve el historial de estado de una tarea interna del consultor", async () => {
  const { data, error } = await ownerA.client
    .from("task_status_history")
    .select("id")
    .eq("id", internalTaskHistoryA);
  assert.equal(error, null);
  assert.deepEqual(data, [], "el cliente no debe ver el historial de una tarea que no puede ver");
});

test("el consultor asignado SI ve el historial de estado de una tarea interna", async () => {
  const { data, error } = await consultantA.client
    .from("task_status_history")
    .select("id")
    .eq("id", internalTaskHistoryA);
  assert.equal(error, null);
  assert.equal(data?.length, 1);
});

// FE-03 (gap encontrado 2026-07-22): strategic_plans no distinguia por
// status -- un plan en draft era visible al cliente igual que uno activo.
// Corregido en la migracion fe_03_strategic_plans_draft_visibility_fix.
test("un cliente no ve un plan estrategico en borrador, pero si uno activo", async () => {
  const { data: draftVisible, error: draftError } = await ownerA.client
    .from("strategic_plans")
    .select("id")
    .eq("id", draftPlanA);
  assert.equal(draftError, null);
  assert.deepEqual(draftVisible, [], "el cliente no debe ver un plan en borrador");

  const { data: activeVisible, error: activeError } = await ownerA.client
    .from("strategic_plans")
    .select("id")
    .eq("id", activePlanA);
  assert.equal(activeError, null);
  assert.equal(activeVisible?.length, 1, "el cliente si debe ver un plan activo");
});

test("el consultor asignado y el platform_admin SI ven un plan estrategico en borrador", async () => {
  const { data: forConsultant, error: consultantError } = await consultantA.client
    .from("strategic_plans")
    .select("id")
    .eq("id", draftPlanA);
  assert.equal(consultantError, null);
  assert.equal(forConsultant?.length, 1);

  const { data: forAdmin, error: adminError } = await platformAdmin.client
    .from("strategic_plans")
    .select("id")
    .eq("id", draftPlanA);
  assert.equal(adminError, null);
  assert.equal(forAdmin?.length, 1);
});

test("el schema private no esta expuesto via API (integration_credentials)", async () => {
  const { error } = await ownerA.client
    .schema("private")
    .from("integration_credentials")
    .select("id")
    .limit(1);
  assert.ok(error, "el schema private no deberia responder consultas via el cliente publico");
});
