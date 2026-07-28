/**
 * BE-01: gap listado sin ningun test -- "un cliente que fuerza organizationId
 * de otra org" en la ruta de un endpoint de negocio. Distinto de los tests de
 * RLS (`rls-tenant-isolation.test.ts`), que llaman a Supabase directamente:
 * esto ejercita la capa de autorizacion en Node/rutas del backend, que es la
 * que realmente ve el usuario final (RLS es la segunda linea de defensa, no
 * la primera). Levanta el servidor Fastify real con `buildApp()` y usa
 * `app.inject` (sin puerto real, pero mismo pipeline de rutas/hooks/handlers
 * que produccion) con un usuario autenticado de verdad que pertenece solo a
 * la organizacion A, pidiendo endpoints de negocio con el organizationId de
 * la organizacion B en el path.
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
const TEST_PASSWORD = "Be01-Cross-Tenant-P4ssword-9!";

let app: FastifyInstance;
let orgA = "";
let orgB = "";
let ownerAUserId = "";
let ownerAAccessToken = "";

before(async () => {
  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .insert([
      { display_name: `BE-01 Cross-Tenant Org A ${RUN_TAG}`, slug: `be01-cross-tenant-org-a-${RUN_TAG}`, status: "active" },
      { display_name: `BE-01 Cross-Tenant Org B ${RUN_TAG}`, slug: `be01-cross-tenant-org-b-${RUN_TAG}`, status: "active" },
    ])
    .select("id, slug");

  if (orgsError || !orgs || orgs.length !== 2) {
    throw new Error(`No se pudieron crear las organizaciones de prueba: ${orgsError?.message}`);
  }
  orgA = orgs.find((org) => org.slug.startsWith("be01-cross-tenant-org-a"))!.id;
  orgB = orgs.find((org) => org.slug.startsWith("be01-cross-tenant-org-b"))!.id;

  const email = `be01-cross-tenant-owner-a-${RUN_TAG}@ecomscaling.test`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(`No se pudo crear el usuario de prueba: ${createError?.message}`);
  }
  ownerAUserId = created.user.id;

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ organization_id: orgA, user_id: ownerAUserId, role: "owner" });

  if (memberError) {
    throw new Error(`No se pudo crear la membership de prueba: ${memberError.message}`);
  }

  // private.has_valid_subscription exige una suscripcion 'trial'/'active' para
  // que private.can_access_org devuelva true -- sin esto, RLS bloquea incluso
  // al dueño real de su propia organizacion (encontrado al correr este test:
  // el fixture inicial no la creaba y devolvia 409 membership_missing incluso
  // para la org propia, no solo para la ajena).
  const { error: subscriptionError } = await admin.from("service_subscriptions").insert({
    organization_id: orgA,
    plan_code: "be01-cross-tenant-test",
    status: "active",
  });

  if (subscriptionError) {
    throw new Error(`No se pudo crear la suscripcion de prueba: ${subscriptionError.message}`);
  }

  const anon: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({ email, password: TEST_PASSWORD });

  if (signInError || !session.session) {
    throw new Error(`No se pudo iniciar sesion como el usuario de prueba: ${signInError?.message}`);
  }
  ownerAAccessToken = session.session.access_token;

  app = await buildApp();
  await app.ready();
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (ownerAUserId) {
    await admin.auth.admin.deleteUser(ownerAUserId);
  }
  if (orgA || orgB) {
    await admin.from("organizations").delete().in("id", [orgA, orgB].filter(Boolean));
  }
});

const CROSS_TENANT_ROUTES: Array<{ method: "GET"; path: (organizationId: string) => string; label: string }> = [
  { method: "GET", path: (id) => `/v1/organizations/${id}/shopify/overview`, label: "shopify/overview" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/shopify/connections`, label: "shopify/connections" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/integrations`, label: "integrations" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/operations`, label: "operations" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/financial-config`, label: "financial-config" },
  // BE-01 (2026-07-28): ampliado de 5 a 13 endpoints con control positivo --
  // ninguno de estos dispara una llamada real a un LLM (a diferencia de
  // ai/monitor, ai/task-planner, ai/stock-planner, ai/knowledge-manager, ver
  // CROSS_TENANT_DENIAL_ONLY_ROUTES abajo), asi que el control positivo
  // (organizacion propia) es barato y rapido de correr en cada PR.
  { method: "GET", path: (id) => `/v1/organizations/${id}/shopify/metrics`, label: "shopify/metrics" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/shopify/product-costs`, label: "shopify/product-costs" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/meta/metrics`, label: "meta/metrics" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/strategic-plan`, label: "strategic-plan" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/ai/runs`, label: "ai/runs" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/knowledge/documents`, label: "knowledge/documents" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/calls`, label: "calls" },
  {
    method: "GET",
    path: (id) => `/v1/organizations/${id}/consultant-chat/conversations`,
    label: "consultant-chat/conversations",
  },
];

// Estos SI disparan una ejecucion real de agente (llamada real al proveedor
// LLM, coste real) cuando no hay un diagnostico cacheado -- que es siempre el
// caso para una organizacion de test recien creada. Solo se prueba el rechazo
// cross-tenant (barato, `requireMembership` corta antes de invocar el
// modelo); no se anade el control positivo para no gastar dinero/tiempo real
// en cada corrida de CI, mismo criterio que los evals de AI-06 ("no correr en
// cada PR").
const CROSS_TENANT_DENIAL_ONLY_ROUTES: Array<{ method: "GET"; path: (organizationId: string) => string; label: string }> = [
  { method: "GET", path: (id) => `/v1/organizations/${id}/ai/monitor`, label: "ai/monitor" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/ai/task-planner`, label: "ai/task-planner" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/ai/stock-planner`, label: "ai/stock-planner" },
  { method: "GET", path: (id) => `/v1/organizations/${id}/ai/knowledge-manager`, label: "ai/knowledge-manager" },
];

for (const route of CROSS_TENANT_ROUTES) {
  test(`${route.label}: un miembro de org A no puede leer datos de org B forzando el organizationId en el path`, async () => {
    const response = await app.inject({
      method: route.method,
      url: route.path(orgB),
      headers: { authorization: `Bearer ${ownerAAccessToken}` },
    });

    assert.equal(
      response.statusCode,
      403,
      `se esperaba 403 (organization_access_denied), se obtuvo ${response.statusCode}: ${response.body}`,
    );

    const body = JSON.parse(response.body);
    assert.equal(body.error, "organization_access_denied");
  });

  test(`${route.label}: el mismo usuario si puede leer su propia organizacion (control positivo, confirma que el 403 de arriba es autorizacion, no un bug generico)`, async () => {
    const response = await app.inject({
      method: route.method,
      url: route.path(orgA),
      headers: { authorization: `Bearer ${ownerAAccessToken}` },
    });

    assert.notEqual(
      response.statusCode,
      403,
      `un miembro real de la organizacion no deberia recibir 403 en su propia org: ${response.body}`,
    );
  });
}

for (const route of CROSS_TENANT_DENIAL_ONLY_ROUTES) {
  test(`${route.label}: un miembro de org A no puede leer datos de org B forzando el organizationId en el path`, async () => {
    const response = await app.inject({
      method: route.method,
      url: route.path(orgB),
      headers: { authorization: `Bearer ${ownerAAccessToken}` },
    });

    assert.equal(
      response.statusCode,
      403,
      `se esperaba 403 (organization_access_denied), se obtuvo ${response.statusCode}: ${response.body}`,
    );

    const body = JSON.parse(response.body);
    assert.equal(body.error, "organization_access_denied");
  });
}
