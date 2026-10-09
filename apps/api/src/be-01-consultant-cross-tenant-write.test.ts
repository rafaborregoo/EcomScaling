/**
 * BE-01: regresion de 3 vulnerabilidades reales encontradas y corregidas
 * 2026-07-28 durante la auditoria de "extender validacion a los endpoints de
 * negocio restantes". Las tres compartian la misma forma de bug: un chequeo
 * de acceso que validaba el ROL de plataforma (consultant/platform_admin)
 * pero no que ESE consultor estuviera asignado a ESA organizacion especifica
 * -- `!membership && !isPrivileged` nunca bloqueaba a un rol privilegiado,
 * sin importar la organizacion. Como varios de estos endpoints escriben (o
 * leen via RPC) con `service_role` (sin RLS), esto permitia a CUALQUIER
 * consultor de la plataforma leer/escribir datos de una organizacion a la
 * que no estaba asignado, con solo conocer su `organizationId`:
 *
 * - `calls.ts` (`requireOrganizationAccess`): creaba llamadas/transcripciones
 *   /resumenes/tareas de cualquier organizacion (service_role, sin RLS).
 * - `knowledge.ts` (`searchKnowledge`): leia memoria `consultant_only` (notas
 *   internas, decisiones sobre IA) de cualquier organizacion via
 *   `knowledge_search` (RPC con service_role, la funcion SQL no verifica
 *   sesion ni RLS por si misma).
 * - `strategic-plans.ts` (`addMilestoneInternalNote`): escribia notas
 *   internas en hitos de cualquier organizacion (service_role, sin RLS).
 *
 * Este test usa un CONSULTOR real (no un owner) asignado solo a la
 * organizacion A, exactamente el actor que explotaba el bug, contra la
 * organizacion B a la que no esta asignado.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/
 * SUPABASE_PUBLISHABLE_KEY. Ejecutar con `npm run test:remote -w @e-nora/api` en un proyecto aislado.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyInstance } from "fastify";
import { loadApiEnv } from "@e-nora/config";
import { buildApp } from "./server.js";

const env = loadApiEnv(process.env);

const admin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

const RUN_TAG = `${Date.now()}`;
const TEST_PASSWORD = "Be01-Consultant-Cross-Tenant-P4ss-9!";

let app: FastifyInstance;
let orgA = "";
let orgB = "";
let consultingOrg = "";
let consultantUserId = "";
let consultantAccessToken = "";

before(async () => {
  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .insert([
      {
        display_name: `BE-01 Consultant XT Org A ${RUN_TAG}`,
        slug: `be01-consultant-xt-a-${RUN_TAG}`,
        status: "active",
      },
      {
        display_name: `BE-01 Consultant XT Org B ${RUN_TAG}`,
        slug: `be01-consultant-xt-b-${RUN_TAG}`,
        status: "active",
      },
      {
        display_name: `BE-01 Consultant XT Consulting ${RUN_TAG}`,
        slug: `be01-consultant-xt-consulting-${RUN_TAG}`,
        kind: "consulting",
        status: "active",
      },
    ])
    .select("id, slug");

  if (orgsError || !orgs || orgs.length !== 3) {
    throw new Error(
      `No se pudieron crear las organizaciones de prueba: ${orgsError?.message}`,
    );
  }
  orgA = orgs.find((org) => org.slug.startsWith("be01-consultant-xt-a"))!.id;
  orgB = orgs.find((org) => org.slug.startsWith("be01-consultant-xt-b"))!.id;
  consultingOrg = orgs.find((org) =>
    org.slug.startsWith("be01-consultant-xt-consulting"),
  )!.id;

  const email = `be01-consultant-xt-${RUN_TAG}@ecomscaling.test`;
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
  if (createError || !created.user) {
    throw new Error(
      `No se pudo crear el usuario de prueba: ${createError?.message}`,
    );
  }
  consultantUserId = created.user.id;
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .update({ platform_role: "consultant" })
    .eq("id", consultantUserId)
    .select("id, platform_role")
    .maybeSingle();
  if (
    profileError ||
    profile?.id !== consultantUserId ||
    profile.platform_role !== "consultant"
  ) {
    throw new Error(
      `No se pudo configurar el perfil consultor de prueba: ${profileError?.message ?? "profile_missing_or_role_not_applied"}`,
    );
  }

  const { error: membershipError } = await admin
    .from("organization_members")
    .insert({
      organization_id: consultingOrg,
      user_id: consultantUserId,
      role: "owner",
      is_active: true,
    });
  if (membershipError) {
    throw new Error(
      `No se pudo anadir el consultor a su consultora de prueba: ${membershipError.message}`,
    );
  }
  const { error: subscriptionError } = await admin
    .from("service_subscriptions")
    .insert({
      organization_id: consultingOrg,
      plan_code: "consultant",
      status: "active",
      starts_at: new Date().toISOString(),
    });
  if (subscriptionError) {
    throw new Error(
      `No se pudo configurar el plan de la consultora de prueba: ${subscriptionError.message}`,
    );
  }

  // Asignado SOLO a orgA -- nunca a orgB, ese es exactamente el escenario del bug.
  const { error: assignmentError } = await admin
    .from("consultant_assignments")
    .insert({
      organization_id: orgA,
      consultant_user_id: consultantUserId,
      consulting_organization_id: consultingOrg,
      is_primary: true,
      is_active: true,
    });
  if (assignmentError) {
    throw new Error(
      `No se pudo asignar el consultor de prueba: ${assignmentError.message}`,
    );
  }

  const anon: SupabaseClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: session, error: signInError } =
    await anon.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signInError || !session.session) {
    throw new Error(
      `No se pudo iniciar sesion como el consultor de prueba: ${signInError?.message}`,
    );
  }
  consultantAccessToken = session.session.access_token;

  const { data: visibleAssignments, error: visibleAssignmentsError } =
    await anon
      .from("consultant_assignments")
      .select("organization_id")
      .eq("consultant_user_id", consultantUserId)
      .eq("is_active", true);
  if (
    visibleAssignmentsError ||
    !visibleAssignments?.some((assignment) => assignment.organization_id === orgA)
  ) {
    throw new Error(
      `El fixture no es visible por RLS para el consultor: ${visibleAssignmentsError?.message ?? "assignment_not_visible"}`,
    );
  }
  const { data: consultantRole, error: consultantRoleError } = await anon.rpc(
    "es_consultor",
  );
  if (consultantRoleError || consultantRole !== true) {
    throw new Error(
      `El proyecto de test no reconoce al usuario como consultor: ${consultantRoleError?.message ?? `es_consultor=${consultantRole}`}`,
    );
  }

  app = await buildApp();
  await app.ready();

  const ownOrganizationAccess = await app.inject({
    method: "GET",
    url: `/v1/consultant/organizations/${orgA}/stores`,
    headers: { authorization: `Bearer ${consultantAccessToken}` },
  });
  if (ownOrganizationAccess.statusCode !== 200) {
    throw new Error(
      `El consultor de prueba debe poder acceder a su organización asignada: ${ownOrganizationAccess.statusCode} ${ownOrganizationAccess.body}`,
    );
  }
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (consultantUserId) {
    await admin.auth.admin.deleteUser(consultantUserId);
  }
  await admin
    .from("organizations")
    .delete()
    .in("id", [orgA, orgB, consultingOrg].filter(Boolean));
});

test("calls.ts: un consultor asignado solo a org A NO puede crear una llamada en org B (bug real corregido)", async () => {
  const response = await app.inject({
    method: "POST",
    url: `/v1/organizations/${orgB}/calls`,
    headers: {
      authorization: `Bearer ${consultantAccessToken}`,
      "content-type": "application/json",
    },
    payload: {
      title: "Llamada creada por consultor no asignado (no deberia existir)",
    },
  });

  assert.equal(
    response.statusCode,
    403,
    `se esperaba 403 organization_access_denied, se obtuvo ${response.statusCode}: ${response.body}`,
  );
  const body = JSON.parse(response.body);
  assert.equal(body.error, "organization_access_denied");

  const { data: leakedCalls } = await admin
    .from("consulting_calls")
    .select("id")
    .eq("organization_id", orgB)
    .eq(
      "title",
      "Llamada creada por consultor no asignado (no deberia existir)",
    );
  assert.equal(
    leakedCalls?.length ?? 0,
    0,
    "no debe haberse creado ninguna llamada en org B",
  );
});

test("knowledge.ts: un consultor asignado solo a org A NO puede buscar/leer memoria de org B (bug real corregido)", async () => {
  const response = await app.inject({
    method: "POST",
    url: `/v1/organizations/${orgB}/knowledge/search`,
    headers: {
      authorization: `Bearer ${consultantAccessToken}`,
      "content-type": "application/json",
    },
    payload: { query: "cualquier cosa" },
  });

  assert.equal(
    response.statusCode,
    403,
    `se esperaba 403 organization_access_denied, se obtuvo ${response.statusCode}: ${response.body}`,
  );
  const body = JSON.parse(response.body);
  assert.equal(body.error, "organization_access_denied");
});

test("strategic-plans.ts: un consultor asignado solo a org A NO puede anadir una nota interna en un hito de org B (bug real corregido)", async () => {
  const response = await app.inject({
    method: "POST",
    url: `/v1/organizations/${orgB}/milestones/00000000-0000-0000-0000-000000000000/internal-notes`,
    headers: {
      authorization: `Bearer ${consultantAccessToken}`,
      "content-type": "application/json",
    },
    payload: {
      body: "Nota escrita por consultor no asignado (no deberia existir)",
    },
  });

  assert.equal(
    response.statusCode,
    403,
    `se esperaba 403 organization_access_denied (antes del lookup de milestone), se obtuvo ${response.statusCode}: ${response.body}`,
  );
  const body = JSON.parse(response.body);
  assert.equal(body.error, "organization_access_denied");
});

test("consultant panel: un consultor asignado solo a org A NO puede listar las tiendas de org B", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/v1/consultant/organizations/${orgB}/stores`,
    headers: { authorization: `Bearer ${consultantAccessToken}` },
  });

  assert.equal(
    response.statusCode,
    403,
    `se esperaba 403 organization_access_denied, se obtuvo ${response.statusCode}: ${response.body}`,
  );
  const body = JSON.parse(response.body);
  assert.equal(body.error, "organization_access_denied");
});

test("control positivo: el mismo consultor SI puede operar sobre su propia organizacion asignada (org A)", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/v1/consultant/organizations/${orgA}/stores`,
    headers: { authorization: `Bearer ${consultantAccessToken}` },
  });

  assert.equal(
    response.statusCode,
    200,
    `un consultor asignado debe poder acceder a su propia organización: ${response.body}`,
  );
});
