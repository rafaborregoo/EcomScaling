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
 * ACTUALIZADO 2026-09-05, tras correr este test por primera vez contra un
 * proyecto aislado (hasta entonces `test:remote` estaba bloqueado por no haber
 * ninguno). Tres rutas -- editar, dar de baja y restaurar la propia
 * organizacion -- devolvian 200 al owner y el test exigia 403. No era una
 * regresion: es autoservicio deliberado (decision de producto 2026-09-05), y la
 * baja ya nacia reversible con 30 dias de purga diferida. Lo que se corrigio
 * fue el test, no el codigo.
 *
 * El limite se movio, no desaparecio: esas tres rutas siguen cerradas a
 * cualquiera que no sea el OWNER, y eso es lo que se prueba ahora con un
 * segundo usuario `manager` de la misma organizacion. Las demas rutas
 * (miembros, asignaciones, acceso) siguen siendo exclusivas de platform_admin.
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
const TEST_PASSWORD = "Sqo04-Privilege-Escalation-P4ssword-9!";
const FAKE_RESOURCE_ID = "00000000-0000-0000-0000-000000000000";

let app: FastifyInstance;
let orgId = "";
let ownerUserId = "";
let ownerAccessToken = "";
// Segundo usuario de la MISMA organizacion, con rol `manager`. Desde que el
// owner puede darse de baja solo (decision de producto 2026-09-05), el control
// que hay que probar ya no es "ningun usuario normal puede", sino "solo el
// OWNER puede": un manager con acceso legitimo a la organizacion no puede
// cerrar la empresa ni renombrarla.
let managerAccessToken = "";

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

  // --- Manager de la misma organizacion ---
  const managerEmail = `sqo04-privilege-escalation-manager-${RUN_TAG}@ecomscaling.test`;
  const { data: managerCreated, error: managerCreateError } =
    await admin.auth.admin.createUser({
      email: managerEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

  if (managerCreateError || !managerCreated.user) {
    throw new Error(
      `No se pudo crear el manager de prueba: ${managerCreateError?.message}`,
    );
  }

  const { error: managerMemberError } = await admin
    .from("organization_members")
    .insert({
      organization_id: orgId,
      user_id: managerCreated.user.id,
      role: "manager",
    });

  if (managerMemberError) {
    throw new Error(
      `No se pudo crear la membership del manager: ${managerMemberError.message}`,
    );
  }

  const { data: managerSession, error: managerSignInError } =
    await anon.auth.signInWithPassword({
      email: managerEmail,
      password: TEST_PASSWORD,
    });

  if (managerSignInError || !managerSession.session) {
    throw new Error(
      `No se pudo iniciar sesion como manager: ${managerSignInError?.message}`,
    );
  }
  managerAccessToken = managerSession.session.access_token;

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

// --- Baja y edicion de la propia organizacion: autoservicio del OWNER -------
//
// Decision de producto (2026-09-05): el owner de una tienda puede darse de baja
// solo, restaurar la baja y editar su organizacion, sin pasar por
// platform_admin. Antes este bloque exigia 403 en las tres rutas; el test
// contradecia al codigo (`requirePlatformAdminOrStoreOwner`) y a la propia
// funcion de baja, que ya nace con 30 dias de purga diferida y restauracion --
// es decir, pensada para ser reversible.
//
// Lo que este bloque protege AHORA no es "nadie puede", es "solo el owner
// puede": el limite se movio, no desaparecio. Las rutas van en orden de ciclo
// de vida (renombrar -> baja -> restaurar) porque comparten la organizacion.

// El limite nuevo. Un manager tiene acceso legitimo a la organizacion (pasa
// `requireOrganizationAccess`), asi que si el guard mirara solo "membership" en
// vez de "membership con rol owner", cerraria la empresa cualquiera del equipo.
const OWNER_ONLY_ROUTES: Array<{
  method: "PATCH" | "POST" | "DELETE";
  path: (organizationId: string) => string;
  body?: Record<string, unknown>;
  expectedError: string;
  label: string;
}> = [
  {
    method: "DELETE",
    path: (id) => `/v1/consultant/organizations/${id}`,
    expectedError: "platform_admin_or_owner_required",
    label: "DELETE consultant/organizations/:organizationId",
  },
  {
    // Restaurar NO es autoservicio: `restoreOrganization` sigue en
    // `requirePlatformAdmin`, asi que aqui el manager cae por rol de
    // plataforma, no por no ser owner. Deshacer una baja es hoy cosa de Rafa
    // (ver el test PENDIENTE DE DECISION al final del fichero).
    method: "POST",
    path: (id) => `/v1/consultant/organizations/${id}/restore`,
    expectedError: "platform_admin_required",
    label: "POST consultant/organizations/:organizationId/restore",
  },
  {
    // Solo el `status` -- suspender, cancelar -- sigue siendo owner-only. La
    // identidad (nombre, zona horaria, moneda) se abrio a quien opera el
    // cliente a proposito: ver `updateOrganization` en consultant.ts. Ese caso
    // tiene sus dos tests justo debajo.
    method: "PATCH",
    path: (id) => `/v1/consultant/organizations/${id}`,
    body: { status: "suspended" },
    expectedError: "platform_admin_or_owner_required",
    label: "PATCH consultant/organizations/:organizationId (status)",
  },
];

for (const route of OWNER_ONLY_ROUTES) {
  test(`${route.label}: un manager de la organizacion NO puede ejecutarla, solo el owner`, async () => {
    const response = await app.inject({
      method: route.method,
      url: route.path(orgId),
      headers: { authorization: `Bearer ${managerAccessToken}` },
      payload: route.body ?? {},
    });

    assert.equal(
      response.statusCode,
      403,
      `se esperaba 403 (${route.expectedError}), se obtuvo ${response.statusCode}: ${response.body}`,
    );

    const parsedBody = JSON.parse(response.body);
    assert.equal(parsedBody.error, route.expectedError);
  });
}

// La otra mitad de la decision: la identidad de la tienda SI la puede corregir
// quien la opera. Estaba en el codigo con su motivo escrito (un consultor tenia
// que pedirle a Rafa algo tan basico como arreglar la moneda) pero el test se
// habia quedado en la version vieja, cuando todo el PATCH era owner-only. Nadie
// lo noto porque esta suite no llegaba a ejecutarse.
test("PATCH consultant/organizations/:organizationId: un manager SI puede corregir la identidad", async () => {
  const response = await app.inject({
    method: "PATCH",
    url: `/v1/consultant/organizations/${orgId}`,
    headers: { authorization: `Bearer ${managerAccessToken}` },
    payload: { display_name: "Nombre corregido por el manager" },
  });

  assert.equal(
    response.statusCode,
    200,
    `la identidad no es owner-only, se obtuvo ${response.statusCode}: ${response.body}`,
  );
  assert.equal(
    JSON.parse(response.body).organization.display_name,
    "Nombre corregido por el manager",
  );
});

// Borrar/restaurar una tienda dejo de ser exclusivo de platform_admin: el
// consultor asignado tambien puede. Un owner sin rol consultor/platform_admin
// sigue sin poder -- ahora con error "consultant_access_required" (falla el
// chequeo de rol antes que el de asignacion).
const CONSULTANT_OR_ADMIN_ONLY_ROUTES: Array<{
  method: "GET" | "PUT" | "PATCH" | "POST" | "DELETE";
  path: (organizationId: string) => string;
  label: string;
}> = [
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
];

for (const route of CONSULTANT_OR_ADMIN_ONLY_ROUTES) {
  test(`${route.label}: un owner sin rol consultor/platform_admin no puede ejecutar esta accion, ni sobre su propia organizacion`, async () => {
    const response = await app.inject({
      method: route.method,
      url: route.path(orgId),
      headers: { authorization: `Bearer ${ownerAccessToken}` },
      payload: {},
    });

    assert.equal(
      response.statusCode,
      403,
      `se esperaba 403 (consultant_access_required), se obtuvo ${response.statusCode}: ${response.body}`,
    );

    const parsedBody = JSON.parse(response.body);
    assert.equal(parsedBody.error, "consultant_access_required");
  });
}

// --- Autoservicio del owner: va AL FINAL a proposito -----------------------
//
// Este bloque deja la organizacion en `pending_deletion`, y
// `private.is_active_org_member()` exige `o.status in ('onboarding','active')`.
// A partir de ahi la RLS esconde la membership de TODOS los miembros y
// cualquier ruta corta con 409 `membership_missing`. Si estos tests corrieran
// antes, los de arriba fallarian con 409 en vez de con su 403 real -- que es
// justo lo que pasaba y lo que hacia ruido en la primera ejecucion.

test("el owner puede renombrar su propia organizacion sin ser platform_admin", async () => {
  const response = await app.inject({
    method: "PATCH",
    url: `/v1/consultant/organizations/${orgId}`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: { display_name: `SQO-04 renombrada ${RUN_TAG}` },
  });

  assert.equal(
    response.statusCode,
    200,
    `el owner deberia poder editar su organizacion, se obtuvo ${response.statusCode}: ${response.body}`,
  );
});

test("el owner puede darse de baja solo, y la baja difiere la purga 30 dias", async () => {
  const baja = await app.inject({
    method: "DELETE",
    url: `/v1/consultant/organizations/${orgId}`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: {},
  });

  assert.equal(
    baja.statusCode,
    200,
    `el owner deberia poder darse de baja, se obtuvo ${baja.statusCode}: ${baja.body}`,
  );
  const bajaBody = JSON.parse(baja.body);
  assert.equal(bajaBody.status, "pending_deletion");
  // La baja no borra nada en el momento: sin ventana de purga diferida, un
  // autoservicio destructivo se lleva la tienda de un solo clic.
  assert.ok(
    bajaBody.scheduled_purge_at,
    "la baja debe programar la purga, no borrar en el momento",
  );
});

test("PENDIENTE DE DECISION: tras darse de baja, el owner ya no puede restaurarla el mismo", async () => {
  // Comportamiento REAL de hoy, fijado aqui para que se vea y no se pierda:
  // `is_active_org_member()` solo reconoce miembros de organizaciones
  // 'onboarding'/'active', asi que en cuanto la baja marca 'pending_deletion'
  // el owner deja de ser miembro a ojos de la RLS y /restore le responde 409
  // `membership_missing`. La ventana de 30 dias existe, pero el owner no puede
  // usarla: deshacer la baja exige hoy un platform_admin.
  //
  // Es la consecuencia directa de abrir la baja al autoservicio (2026-09-05) y
  // NO se ha arreglado porque tocarlo significa cambiar la regla de
  // aislamiento de tenants, que es la pieza mas delicada del sistema. Si se
  // decide que la baja tambien se deshace sola, este test cambia a 200.
  const restore = await app.inject({
    method: "POST",
    url: `/v1/consultant/organizations/${orgId}/restore`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
    payload: {},
  });

  assert.equal(restore.statusCode, 409);
  assert.equal(JSON.parse(restore.body).error, "membership_missing");
});
