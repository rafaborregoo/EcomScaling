/**
 * BE-01: ultimo gap listado en la auditoria del 2026-07-28 -- los endpoints
 * de escritura menores (PATCH status de tarea/alerta/hito, comentarios de
 * tarea) estaban auditados por lectura (todos usan `requireMembership`/
 * `assertCanManagePlan` antes de tocar el recurso) pero sin test de
 * integracion dedicado. Mismo patron que
 * `be-01-cross-tenant-route-manipulation.test.ts`: servidor Fastify real
 * (`buildApp()` + `app.inject`), usuario real que solo pertenece a la
 * organizacion A, pidiendo estos endpoints con el organizationId de la
 * organizacion B en el path. El id del recurso (taskId/alertId/milestoneId)
 * es un UUID inexistente a proposito -- las 4 funciones cortan por
 * organizacion antes de buscar el recurso, asi que el 403 confirma que el
 * chequeo de organizacion corre primero, no que el recurso no exista.
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
const TEST_PASSWORD = "Be01-Cross-Tenant-Write-P4ssword-9!";
const FAKE_RESOURCE_ID = "00000000-0000-0000-0000-000000000000";

let app: FastifyInstance;
let orgA = "";
let orgB = "";
let ownerAUserId = "";
let ownerAAccessToken = "";

before(async () => {
  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .insert([
      {
        display_name: `BE-01 Cross-Tenant Write Org A ${RUN_TAG}`,
        slug: `be01-cross-tenant-write-org-a-${RUN_TAG}`,
        status: "active",
      },
      {
        display_name: `BE-01 Cross-Tenant Write Org B ${RUN_TAG}`,
        slug: `be01-cross-tenant-write-org-b-${RUN_TAG}`,
        status: "active",
      },
    ])
    .select("id, slug");

  if (orgsError || !orgs || orgs.length !== 2) {
    throw new Error(
      `No se pudieron crear las organizaciones de prueba: ${orgsError?.message}`,
    );
  }
  orgA = orgs.find((org) =>
    org.slug.startsWith("be01-cross-tenant-write-org-a"),
  )!.id;
  orgB = orgs.find((org) =>
    org.slug.startsWith("be01-cross-tenant-write-org-b"),
  )!.id;

  const email = `be01-cross-tenant-write-owner-a-${RUN_TAG}@ecomscaling.test`;
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
  ownerAUserId = created.user.id;

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ organization_id: orgA, user_id: ownerAUserId, role: "owner" });

  if (memberError) {
    throw new Error(
      `No se pudo crear la membership de prueba: ${memberError.message}`,
    );
  }

  const { error: subscriptionError } = await admin
    .from("service_subscriptions")
    .insert({
      organization_id: orgA,
      plan_code: "be01-cross-tenant-write-test",
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
    await admin
      .from("organizations")
      .delete()
      .in("id", [orgA, orgB].filter(Boolean));
  }
});

const CROSS_TENANT_WRITE_ROUTES: Array<{
  method: "PATCH" | "POST";
  path: (organizationId: string) => string;
  body: Record<string, unknown>;
  label: string;
}> = [
  {
    method: "PATCH",
    path: (id) => `/v1/organizations/${id}/tasks/${FAKE_RESOURCE_ID}/status`,
    body: { status: "done" },
    label: "tasks/:taskId/status",
  },
  {
    method: "POST",
    path: (id) => `/v1/organizations/${id}/tasks/${FAKE_RESOURCE_ID}/comments`,
    body: { body: "comentario cross-tenant" },
    label: "tasks/:taskId/comments",
  },
  {
    method: "PATCH",
    path: (id) => `/v1/organizations/${id}/alerts/${FAKE_RESOURCE_ID}/status`,
    body: { status: "acknowledged" },
    label: "alerts/:alertId/status",
  },
  {
    method: "PATCH",
    path: (id) =>
      `/v1/organizations/${id}/milestones/${FAKE_RESOURCE_ID}/status`,
    body: { status: "completed" },
    label: "milestones/:milestoneId/status",
  },
  {
    method: "PATCH",
    path: (id) => `/v1/organizations/${id}/milestones/${FAKE_RESOURCE_ID}`,
    body: { name: "hito cross-tenant" },
    label: "milestones/:milestoneId (edit)",
  },
  {
    method: "PATCH",
    path: (id) =>
      `/v1/organizations/${id}/strategic-plan/phases/${FAKE_RESOURCE_ID}`,
    body: { name: "fase cross-tenant" },
    label: "strategic-plan/phases/:phaseId (edit)",
  },
  {
    method: "POST",
    path: (id) =>
      `/v1/organizations/${id}/milestones/${FAKE_RESOURCE_ID}/tasks`,
    body: { title: "tarea cross-tenant" },
    label: "milestones/:milestoneId/tasks (create)",
  },
  {
    method: "POST",
    path: (id) =>
      `/v1/organizations/${id}/strategic-plan/${FAKE_RESOURCE_ID}/phases`,
    body: { name: "fase cross-tenant" },
    label: "strategic-plan/:planId/phases (create)",
  },
  {
    method: "POST",
    path: (id) =>
      `/v1/organizations/${id}/strategic-plan/phases/${FAKE_RESOURCE_ID}/milestones`,
    body: { name: "hito cross-tenant" },
    label: "strategic-plan/phases/:phaseId/milestones (create)",
  },
];

for (const route of CROSS_TENANT_WRITE_ROUTES) {
  test(`${route.label}: un miembro de org A no puede escribir sobre org B forzando el organizationId en el path`, async () => {
    const response = await app.inject({
      method: route.method,
      url: route.path(orgB),
      headers: { authorization: `Bearer ${ownerAAccessToken}` },
      payload: route.body,
    });

    assert.equal(
      response.statusCode,
      403,
      `se esperaba 403 (organization_access_denied), se obtuvo ${response.statusCode}: ${response.body}`,
    );

    const parsedBody = JSON.parse(response.body);
    assert.equal(parsedBody.error, "organization_access_denied");
  });
}
