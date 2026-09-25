/**
 * BE-01/Q-008 (cerrado 2026-07-28, ver ADR-0012): antes de esto, una
 * membership sintetica de platform_admin/consultant (sin fila real en
 * organization_members) tenia exactamente la misma forma que una membership
 * real -- `accessSource` lo hace explicito. Este test confirma que
 * `resolveAuthContext` etiqueta correctamente los 3 origenes posibles contra
 * el Supabase remoto real (no solo por lectura de codigo).
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/
 * SUPABASE_PUBLISHABLE_KEY. Ejecutar con `npm run test:remote -w @e-nora/api` en un proyecto aislado.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { resolveAuthContext, isAuthContextError } from "./auth-context.js";

const env = loadApiEnv(process.env);

const admin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

const RUN_TAG = `${Date.now()}`;
const TEST_PASSWORD = "Be01-AccessSource-Test-P4ss-9!";

let orgId = "";
let ownerUserId = "";
let consultantUserId = "";
let adminUserId = "";
let ownerAccessToken = "";
let consultantAccessToken = "";
let adminAccessToken = "";

async function signIn(email: string): Promise<string> {
  const anon: SupabaseClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: session, error } = await anon.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error || !session.session) {
    throw new Error(
      `No se pudo iniciar sesion como ${email}: ${error?.message}`,
    );
  }
  return session.session.access_token;
}

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `BE-01 AccessSource Test ${RUN_TAG}`,
      slug: `be01-access-source-test-${RUN_TAG}`,
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

  const ownerEmail = `be01-access-owner-${RUN_TAG}@ecomscaling.test`;
  const { data: owner, error: ownerError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (ownerError || !owner.user) {
    throw new Error(
      `No se pudo crear el owner de prueba: ${ownerError?.message}`,
    );
  }
  ownerUserId = owner.user.id;

  const consultantEmail = `be01-access-consultant-${RUN_TAG}@ecomscaling.test`;
  const { data: consultant, error: consultantError } =
    await admin.auth.admin.createUser({
      email: consultantEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
  if (consultantError || !consultant.user) {
    throw new Error(
      `No se pudo crear el consultor de prueba: ${consultantError?.message}`,
    );
  }
  consultantUserId = consultant.user.id;
  await admin
    .from("profiles")
    .update({ platform_role: "consultant" })
    .eq("id", consultantUserId);

  const adminEmail = `be01-access-admin-${RUN_TAG}@ecomscaling.test`;
  const { data: adminUser, error: adminError } =
    await admin.auth.admin.createUser({
      email: adminEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
  if (adminError || !adminUser.user) {
    throw new Error(
      `No se pudo crear el platform_admin de prueba: ${adminError?.message}`,
    );
  }
  adminUserId = adminUser.user.id;
  await admin
    .from("profiles")
    .update({ platform_role: "platform_admin" })
    .eq("id", adminUserId);

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: ownerUserId, role: "owner" });
  if (memberError) {
    throw new Error(
      `No se pudo crear la membership de prueba: ${memberError.message}`,
    );
  }

  const { error: subscriptionError } = await admin
    .from("service_subscriptions")
    .insert({
      organization_id: orgId,
      plan_code: "be01-access-source-test",
      status: "active",
    });
  if (subscriptionError) {
    throw new Error(
      `No se pudo crear la suscripcion de prueba: ${subscriptionError.message}`,
    );
  }

  const { error: assignmentError } = await admin
    .from("consultant_assignments")
    .insert({
      organization_id: orgId,
      consultant_user_id: consultantUserId,
      is_primary: true,
      is_active: true,
    });
  if (assignmentError) {
    throw new Error(
      `No se pudo asignar el consultor de prueba: ${assignmentError.message}`,
    );
  }

  ownerAccessToken = await signIn(ownerEmail);
  consultantAccessToken = await signIn(consultantEmail);
  adminAccessToken = await signIn(adminEmail);
});

after(async () => {
  for (const userId of [ownerUserId, consultantUserId, adminUserId]) {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
  if (orgId) {
    await admin.from("organizations").delete().eq("id", orgId);
  }
});

test("una membership real tiene accessSource membership", async () => {
  const result = await resolveAuthContext(env, `Bearer ${ownerAccessToken}`);
  assert.equal(isAuthContextError(result), false, JSON.stringify(result));
  if (isAuthContextError(result)) return;

  const membership = result.context.memberships.find(
    (item) => item.organization_id === orgId,
  );
  assert.ok(
    membership,
    "se esperaba encontrar la membership de la organizacion de prueba",
  );
  assert.equal(membership!.accessSource, "membership");
});

test("un consultor sin membership real tiene accessSource consultant_assignment", async () => {
  const result = await resolveAuthContext(
    env,
    `Bearer ${consultantAccessToken}`,
  );
  assert.equal(isAuthContextError(result), false, JSON.stringify(result));
  if (isAuthContextError(result)) return;

  const membership = result.context.memberships.find(
    (item) => item.organization_id === orgId,
  );
  assert.ok(
    membership,
    "se esperaba una membership virtual para el consultor asignado",
  );
  assert.equal(membership!.accessSource, "consultant_assignment");
});

test("un platform_admin sin membership real tiene accessSource platform_admin", async () => {
  const result = await resolveAuthContext(env, `Bearer ${adminAccessToken}`);
  assert.equal(isAuthContextError(result), false, JSON.stringify(result));
  if (isAuthContextError(result)) return;

  const membership = result.context.memberships.find(
    (item) => item.organization_id === orgId,
  );
  assert.ok(
    membership,
    "se esperaba una membership virtual para platform_admin",
  );
  assert.equal(membership!.accessSource, "platform_admin");
});
