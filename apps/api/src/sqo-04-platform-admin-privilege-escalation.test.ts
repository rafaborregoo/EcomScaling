/**
 * SQO-04, fila 10 de la matriz de amenazas: "elevacion de privilegios
 * (consultor actuando como platform_admin)". El control (`requirePlatformAdmin`
 * en `consultant.ts`, 8 puntos de entrada) estaba verificado solo por lectura
 * de codigo, sin test automatizado -- el riesgo real no es un consultor
 * externo, es cualquier usuario normal (`platform_role = 'user'`, el default
 * de `profiles`) golpeando estas rutas directamente, incluso siendo owner de
 * su propia organizacion. Mismo patron que
 * `be-01-cross-tenant-write-endpoints.test.ts`: servidor Fastify real
 * (`buildApp()` + `app.inject`), usuario real autenticado. Los ids de recurso
 * (connectionId) son UUIDs inexistentes a proposito -- `requirePlatformAdmin`
 * corre antes que cualquier busqueda de recurso u organizacion en las 8
 * funciones (verificado leyendo `consultant.ts`), asi que el 403 confirma que
 * el chequeo de rol corre primero, no que el recurso no exista.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/
 * SUPABASE_PUBLISHABLE_KEY. Ejecutar con `npm run test:remote -w @ecomscaling/api` en un proyecto aislado.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyInstance } from "fastify";
import { loadApiEnv } from "@ecomscaling/config";
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
const TEST_PASSWORD = "Sqo04-Privilege-Escalation-P4ssword-9!";
const FAKE_RESOURCE_ID = "00000000-0000-0000-0000-000000000000";

let app: FastifyInstance;
let orgId = "";
let ownerUserId = "";
let ownerAccessToken = "";

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `SQO-04 Privilege Escalation Org ${RUN_TAG}`,
      slug: `sqo04-privilege-escalation-org-${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(
      `No se pudo crear la organizacion de prueba: ${orgError?.message}`,
    );
  }
  orgId = org.id;

  const email = `sqo04-privilege-escalation-owner-${RUN_TAG}@ecomscaling.test`;
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
  ownerUserId = created.user.id;

  // El default de profiles.platform_role es 'user' (ver db_02 migration) -- no
  // se toca a proposito, es justo el caso que hay que probar: un usuario
  // normal, sin ningun rol especial, que es owner de su propia organizacion.
  const { data: profile } = await admin
    .from("profiles")
    .select("platform_role")
    .eq("id", ownerUserId)
    .maybeSingle();
  assert.equal(
    profile?.platform_role,
    "user",
    "precondicion del test: el usuario debe tener platform_role 'user'",
  );

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: ownerUserId, role: "owner" });

  if (memberError) {
    throw new Error(
      `No se pudo crear la membership de prueba: ${memberError.message}`,
    );
  }

  // private.can_access_org() exige is_active_org_member() Y
  // has_valid_subscription() -- sin esto, RLS deja la lectura de
  // organization_members vacia y resolveAuthContext corta con 409
  // membership_missing antes de llegar a requirePlatformAdmin (descubierto
  // corriendo este mismo test: los 8 casos fallaban con 409, no 403).
  const { error: subscriptionError } = await admin
    .from("service_subscriptions")
    .insert({
      organization_id: orgId,
      plan_code: "sqo04-privilege-escalation-test",
      status: "active",
    });

  if (subscriptionError) {
    throw new Error(
      `No se pudo crear la suscripcion de prueba: ${subscriptionError.message}`,
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
      `No se pudo iniciar sesion como el usuario de prueba: ${signInError?.message}`,
    );
  }
  ownerAccessToken = session.session.access_token;

  app = await buildApp();
  await app.ready();
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (ownerUserId) {
    await admin.auth.admin.deleteUser(ownerUserId);
  }
  if (orgId) {
    await admin.from("organizations").delete().eq("id", orgId);
  }
});

const PLATFORM_ADMIN_ONLY_ROUTES: Array<{
  method: "GET" | "PUT" | "PATCH" | "POST" | "DELETE";
  path: (organizationId: string) => string;
  body?: Record<string, unknown>;
  label: string;
}> = [
  {
    method: "GET",
    path: (id) => `/v1/consultant/organizations/${id}/access`,
    label: "GET consultant/organizations/:organizationId/access",
  },
  {
    method: "PUT",
    path: (id) => `/v1/consultant/organizations/${id}/members`,
    body: { user_id: FAKE_RESOURCE_ID, role: "manager", is_active: true },
    label: "PUT consultant/organizations/:organizationId/members",
  },
  {
    method: "PUT",
    path: (id) => `/v1/consultant/organizations/${id}/assignments`,
    body: {
      consultant_user_id: FAKE_RESOURCE_ID,
      is_primary: true,
      is_active: true,
    },
    label: "PUT consultant/organizations/:organizationId/assignments",
  },
  {
    method: "DELETE",
    path: (id) =>
      `/v1/consultant/organizations/${id}/stores/${FAKE_RESOURCE_ID}`,
    label:
      "DELETE consultant/organizations/:organizationId/stores/:connectionId",
  },
  {
    method: "POST",
    path: (id) =>
      `/v1/consultant/organizations/${id}/stores/${FAKE_RESOURCE_ID}/restore`,
    label:
      "POST consultant/organizations/:organizationId/stores/:connectionId/restore",
  },
  {
    method: "DELETE",
    path: (id) => `/v1/consultant/organizations/${id}`,
    label: "DELETE consultant/organizations/:organizationId",
  },
  {
    method: "POST",
    path: (id) => `/v1/consultant/organizations/${id}/restore`,
    label: "POST consultant/organizations/:organizationId/restore",
  },
  {
    method: "PATCH",
    path: (id) => `/v1/consultant/organizations/${id}`,
    body: { display_name: "Intento de elevacion de privilegios" },
    label: "PATCH consultant/organizations/:organizationId",
  },
];

for (const route of PLATFORM_ADMIN_ONLY_ROUTES) {
  test(`${route.label}: un owner sin platform_role platform_admin no puede ejecutar esta accion, ni sobre su propia organizacion`, async () => {
    const response = await app.inject({
      method: route.method,
      url: route.path(orgId),
      headers: { authorization: `Bearer ${ownerAccessToken}` },
      payload: route.body ?? {},
    });

    assert.equal(
      response.statusCode,
      403,
      `se esperaba 403 (platform_admin_required), se obtuvo ${response.statusCode}: ${response.body}`,
    );

    const parsedBody = JSON.parse(response.body);
    assert.equal(parsedBody.error, "platform_admin_required");
  });
}
