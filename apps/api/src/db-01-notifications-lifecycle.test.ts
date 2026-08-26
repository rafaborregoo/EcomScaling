/**
 * DB-01 (gap real documentado desde el 2026-07-23, cerrado 2026-07-29):
 * `notification_status` nunca se marcaba `read`/`archived` porque no existia
 * ninguna accion de UI ni endpoint que lo hiciera -- las notificaciones se
 * insertaban (alertas nuevas notificadas a owner/manager, ver operations.ts)
 * pero se acumulaban `unread` para siempre. Test de integracion real
 * (servidor Fastify + Supabase remoto, sin mocks): lista, marca-una-como-leida,
 * archiva, marca-todas-como-leidas, y confirma que RLS bloquea leer/escribir
 * la notificacion de otro usuario.
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
const TEST_PASSWORD = "Db01-Notifications-Lifecycle-P4ssword-9!";

let app: FastifyInstance;
let organizationId = "";
let ownerUserId = "";
let ownerAccessToken = "";
let otherUserId = "";
let notificationAId = "";
let notificationBId = "";
let otherUserNotificationId = "";

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `DB-01 Notifications Org ${RUN_TAG}`,
      slug: `db01-notifications-org-${RUN_TAG}`,
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

  const email = `db01-notifications-owner-${RUN_TAG}@ecomscaling.test`;
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

  const otherEmail = `db01-notifications-other-${RUN_TAG}@ecomscaling.test`;
  const { data: createdOther, error: createOtherError } =
    await admin.auth.admin.createUser({
      email: otherEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

  if (createOtherError || !createdOther.user) {
    throw new Error(
      `No se pudo crear el segundo usuario de prueba: ${createOtherError?.message}`,
    );
  }
  otherUserId = createdOther.user.id;

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
      plan_code: "db01-notifications-test",
      status: "active",
    });

  if (subscriptionError) {
    throw new Error(
      `No se pudo crear la suscripcion de prueba: ${subscriptionError.message}`,
    );
  }

  const { data: notifications, error: notificationsError } = await admin
    .from("notifications")
    .insert([
      {
        organization_id: organizationId,
        user_id: ownerUserId,
        type: "alert",
        title: "Alerta A de prueba",
        message: "mensaje A",
      },
      {
        organization_id: organizationId,
        user_id: ownerUserId,
        type: "alert",
        title: "Alerta B de prueba",
        message: "mensaje B",
      },
      {
        organization_id: organizationId,
        user_id: otherUserId,
        type: "alert",
        title: "Alerta de otro usuario",
        message: "no deberia ser visible para el owner de prueba",
      },
    ])
    .select("id, user_id, title");

  if (notificationsError || !notifications) {
    throw new Error(
      `No se pudieron sembrar las notificaciones de prueba: ${notificationsError?.message}`,
    );
  }
  notificationAId = notifications.find(
    (n) => n.title === "Alerta A de prueba",
  )!.id;
  notificationBId = notifications.find(
    (n) => n.title === "Alerta B de prueba",
  )!.id;
  otherUserNotificationId = notifications.find(
    (n) => n.title === "Alerta de otro usuario",
  )!.id;

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
  if (otherUserId) {
    await admin.auth.admin.deleteUser(otherUserId);
  }
  if (organizationId) {
    await admin.from("organizations").delete().eq("id", organizationId);
  }
});

test("GET /v1/notifications devuelve solo las del usuario autenticado, con el conteo de no leidas", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/v1/notifications",
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });

  assert.equal(response.statusCode, 200, response.body);
  const body = JSON.parse(response.body) as {
    notifications: Array<{ id: string; title: string }>;
    unread_count: number;
  };

  assert.equal(body.unread_count, 2);
  const ids = body.notifications.map((n) => n.id);
  assert.ok(ids.includes(notificationAId));
  assert.ok(ids.includes(notificationBId));
  assert.ok(
    !ids.includes(otherUserNotificationId),
    "no debe incluir la notificacion de otro usuario",
  );
});

test("PATCH /v1/notifications/:id/status con 'read' actualiza status y read_at", async () => {
  const response = await app.inject({
    method: "PATCH",
    url: `/v1/notifications/${notificationAId}/status`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: { status: "read" },
  });

  assert.equal(response.statusCode, 200, response.body);

  const { data: notification } = await admin
    .from("notifications")
    .select("status, read_at")
    .eq("id", notificationAId)
    .single();
  assert.equal(notification?.status, "read");
  assert.ok(notification?.read_at, "read_at debe quedar seteado");
});

test("PATCH /v1/notifications/:id/status con 'archived' saca la notificacion del listado por defecto", async () => {
  const patchResponse = await app.inject({
    method: "PATCH",
    url: `/v1/notifications/${notificationBId}/status`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: { status: "archived" },
  });
  assert.equal(patchResponse.statusCode, 200, patchResponse.body);

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/notifications",
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });
  const body = JSON.parse(listResponse.body) as {
    notifications: Array<{ id: string }>;
  };
  assert.ok(
    !body.notifications.some((n) => n.id === notificationBId),
    "una notificacion archivada no debe aparecer en el listado por defecto",
  );

  const listAllResponse = await app.inject({
    method: "GET",
    url: "/v1/notifications?status=all",
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });
  const bodyAll = JSON.parse(listAllResponse.body) as {
    notifications: Array<{ id: string }>;
  };
  assert.ok(
    bodyAll.notifications.some((n) => n.id === notificationBId),
    "status=all si debe incluir las archivadas",
  );
});

test("PATCH /v1/notifications/:id/status sobre la notificacion de otro usuario devuelve 404 (RLS bloquea el update)", async () => {
  const response = await app.inject({
    method: "PATCH",
    url: `/v1/notifications/${otherUserNotificationId}/status`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: { status: "read" },
  });

  assert.equal(response.statusCode, 404, response.body);

  const { data: notification } = await admin
    .from("notifications")
    .select("status")
    .eq("id", otherUserNotificationId)
    .single();
  assert.equal(
    notification?.status,
    "unread",
    "la notificacion del otro usuario no debe haber cambiado",
  );
});

test("POST /v1/notifications/read-all marca todas las no leidas del usuario como leidas", async () => {
  const { data: fresh, error } = await admin
    .from("notifications")
    .insert({
      organization_id: organizationId,
      user_id: ownerUserId,
      type: "alert",
      title: "Alerta C de prueba",
      message: "mensaje C",
    })
    .select("id")
    .single();
  if (error || !fresh) {
    throw new Error(
      `No se pudo sembrar la notificacion adicional: ${error?.message}`,
    );
  }

  const response = await app.inject({
    method: "POST",
    url: "/v1/notifications/read-all",
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });

  assert.equal(response.statusCode, 200, response.body);

  const { data: notification } = await admin
    .from("notifications")
    .select("status")
    .eq("id", fresh.id)
    .single();
  assert.equal(notification?.status, "read");

  const { data: otherNotification } = await admin
    .from("notifications")
    .select("status")
    .eq("id", otherUserNotificationId)
    .single();
  assert.equal(
    otherNotification?.status,
    "unread",
    "read-all no debe tocar notificaciones de otro usuario",
  );
});
