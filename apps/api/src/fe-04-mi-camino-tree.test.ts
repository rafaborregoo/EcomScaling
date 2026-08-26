/**
 * FE-04 / Mi Camino: cierra los gaps reales que tenia el modulo -- los hitos
 * y fases no se podian editar despues de crear el plan, y crear una tarea
 * "con contexto de a que hito pertenece" exigia dos llamadas (crear la tarea
 * en /tasks y luego enlazarla en /milestones/:id/tasks). Test de integracion
 * real (servidor Fastify + Supabase remoto, sin mocks) para los tres
 * endpoints nuevos: PATCH fase, PATCH hito, POST tarea-y-enlace en un paso.
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
const TEST_PASSWORD = "Fe04-Mi-Camino-Tree-P4ssword-9!";

let app: FastifyInstance;
let organizationId = "";
let ownerUserId = "";
let ownerAccessToken = "";
let planId = "";
let phaseId = "";
let milestoneId = "";

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `FE-04 Mi Camino Tree Org ${RUN_TAG}`,
      slug: `fe04-mi-camino-tree-org-${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(
      `No se pudo crear la organizacion de prueba: ${orgError?.message}`,
    );
  }
  organizationId = org.id;

  const email = `fe04-mi-camino-tree-owner-${RUN_TAG}@ecomscaling.test`;
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

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: ownerUserId,
      role: "owner",
    });

  if (memberError) {
    throw new Error(
      `No se pudo crear la membership de prueba: ${memberError.message}`,
    );
  }

  const { error: subscriptionError } = await admin
    .from("service_subscriptions")
    .insert({
      organization_id: organizationId,
      plan_code: "fe04-mi-camino-tree-test",
      status: "active",
    });

  if (subscriptionError) {
    throw new Error(
      `No se pudo crear la suscripcion de prueba: ${subscriptionError.message}`,
    );
  }

  const { data: plan, error: planError } = await admin
    .from("strategic_plans")
    .insert({
      organization_id: organizationId,
      name: "Plan de prueba",
      version: 1,
      status: "active",
      created_by: ownerUserId,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    throw new Error(
      `No se pudo crear el plan de prueba: ${planError?.message}`,
    );
  }
  planId = plan.id;

  const { data: phase, error: phaseError } = await admin
    .from("strategic_plan_phases")
    .insert({
      organization_id: organizationId,
      plan_id: planId,
      name: "Fase original",
      position: 1,
      status: "active",
    })
    .select("id")
    .single();

  if (phaseError || !phase) {
    throw new Error(
      `No se pudo crear la fase de prueba: ${phaseError?.message}`,
    );
  }
  phaseId = phase.id;

  const { data: milestone, error: milestoneError } = await admin
    .from("strategic_plan_milestones")
    .insert({
      organization_id: organizationId,
      phase_id: phaseId,
      name: "Hito original",
      position: 1,
      status: "pending",
    })
    .select("id")
    .single();

  if (milestoneError || !milestone) {
    throw new Error(
      `No se pudo crear el hito de prueba: ${milestoneError?.message}`,
    );
  }
  milestoneId = milestone.id;

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
  if (organizationId) {
    await admin.from("organizations").delete().eq("id", organizationId);
  }
});

test("PATCH strategic-plan/phases/:phaseId edita nombre y descripcion de una fase existente", async () => {
  const response = await app.inject({
    method: "PATCH",
    url: `/v1/organizations/${organizationId}/strategic-plan/phases/${phaseId}`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: { name: "Fase renombrada", description: "Descripcion nueva" },
  });

  assert.equal(response.statusCode, 200, response.body);

  const { data: phase } = await admin
    .from("strategic_plan_phases")
    .select("name, description")
    .eq("id", phaseId)
    .single();
  assert.equal(phase?.name, "Fase renombrada");
  assert.equal(phase?.description, "Descripcion nueva");
});

test("PATCH milestones/:milestoneId edita nombre, descripcion y fecha objetivo de un hito existente", async () => {
  const response = await app.inject({
    method: "PATCH",
    url: `/v1/organizations/${organizationId}/milestones/${milestoneId}`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: {
      name: "Hito renombrado",
      description: "Nueva descripcion",
      targetDate: "2026-12-01",
    },
  });

  assert.equal(response.statusCode, 200, response.body);

  const { data: milestone } = await admin
    .from("strategic_plan_milestones")
    .select("name, description, target_date")
    .eq("id", milestoneId)
    .single();
  assert.equal(milestone?.name, "Hito renombrado");
  assert.equal(milestone?.description, "Nueva descripcion");
  assert.equal(milestone?.target_date, "2026-12-01");
});

test("POST milestones/:milestoneId/tasks crea la tarea y la enlaza al hito en un solo paso, con contexto de plan", async () => {
  const response = await app.inject({
    method: "POST",
    url: `/v1/organizations/${organizationId}/milestones/${milestoneId}/tasks`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: {
      title: "Tarea creada desde Mi Camino",
      description: "Contexto del hito",
      priority: "high",
    },
  });

  assert.equal(response.statusCode, 201, response.body);
  const body = JSON.parse(response.body) as { id: string; title: string };
  assert.equal(body.title, "Tarea creada desde Mi Camino");

  const { data: task } = await admin
    .from("tasks")
    .select("source, priority, organization_id")
    .eq("id", body.id)
    .single();
  assert.equal(task?.source, "strategic_plan");
  assert.equal(task?.priority, "high");
  assert.equal(task?.organization_id, organizationId);

  const { data: link } = await admin
    .from("milestone_task_links")
    .select("id")
    .eq("milestone_id", milestoneId)
    .eq("task_id", body.id)
    .maybeSingle();
  assert.ok(link, "la tarea creada debe quedar enlazada al hito");
});

test("GET strategic-plan devuelve el titulo real de las tareas enlazadas a cada hito, no solo el id", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/v1/organizations/${organizationId}/strategic-plan`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });

  assert.equal(response.statusCode, 200, response.body);
  const body = JSON.parse(response.body) as {
    plan: {
      strategic_plan_phases: Array<{
        strategic_plan_milestones: Array<{
          milestone_task_links: Array<{ tasks: { title: string } | null }>;
        }>;
      }>;
    };
  };

  const links = body.plan.strategic_plan_phases.flatMap((phase) =>
    phase.strategic_plan_milestones.flatMap(
      (milestone) => milestone.milestone_task_links,
    ),
  );
  assert.ok(
    links.some((link) => link.tasks?.title === "Tarea creada desde Mi Camino"),
    "la respuesta debe incluir el titulo real de la tarea enlazada",
  );
});

test("POST strategic-plan/:planId/phases crea una fase nueva con created_by, y GET la devuelve con origen 'client'", async () => {
  const createResponse = await app.inject({
    method: "POST",
    url: `/v1/organizations/${organizationId}/strategic-plan/${planId}/phases`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: {
      name: "Fase anadida por el cliente",
      description: "creada a mano",
    },
  });

  assert.equal(createResponse.statusCode, 201, createResponse.body);
  const created = JSON.parse(createResponse.body) as { id: string };

  const { data: phaseRow } = await admin
    .from("strategic_plan_phases")
    .select("created_by, status, position")
    .eq("id", created.id)
    .single();
  assert.equal(phaseRow?.created_by, ownerUserId);
  assert.equal(phaseRow?.status, "pending");

  const getResponse = await app.inject({
    method: "GET",
    url: `/v1/organizations/${organizationId}/strategic-plan`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });
  const body = JSON.parse(getResponse.body) as {
    plan: {
      strategic_plan_phases: Array<{
        id: string;
        created_by_origin: string | null;
      }>;
    };
  };
  const newPhase = body.plan.strategic_plan_phases.find(
    (phase) => phase.id === created.id,
  );
  assert.equal(
    newPhase?.created_by_origin,
    "client",
    "el owner de prueba no es consultor/admin, su origen debe ser 'client'",
  );
});

test("POST strategic-plan/phases/:phaseId/milestones crea un hito nuevo con created_by y position incremental", async () => {
  const createResponse = await app.inject({
    method: "POST",
    url: `/v1/organizations/${organizationId}/strategic-plan/phases/${phaseId}/milestones`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: { name: "Hito anadido por el cliente" },
  });

  assert.equal(createResponse.statusCode, 201, createResponse.body);
  const created = JSON.parse(createResponse.body) as { id: string };

  const { data: milestoneRow } = await admin
    .from("strategic_plan_milestones")
    .select("created_by, position")
    .eq("id", created.id)
    .single();
  assert.equal(milestoneRow?.created_by, ownerUserId);
  assert.ok(
    (milestoneRow?.position ?? 0) > 1,
    "la position debe ser incremental respecto al hito sembrado",
  );
});
