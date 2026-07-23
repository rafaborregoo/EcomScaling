/**
 * DB-00: el criterio de cierre declara "`private` no es accesible por `anon`
 * ni `authenticated`" pero no habia ninguna prueba que lo confirmara -- solo
 * la migracion (`20260715123324_db_00_infraestructura.sql`) hace
 * `revoke all on schema private from anon/authenticated`. Este test verifica
 * ese privilegio contra el Supabase remoto real, no un mock, intentando leer
 * `private.webhook_events` (tabla real de INT-00) con las mismas credenciales
 * que usaria un cliente/atacante externo.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/
 * SUPABASE_PUBLISHABLE_KEY apuntando al proyecto remoto. Ejecutar con
 * `npm run test -w @ecomscaling/api`.
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
const TEST_PASSWORD = "Db00-Test-P4ssword-9!";
const TEST_EMAIL = `db00test-${RUN_TAG}@ecomscaling.test`;

let testUserId = "";
let authenticatedClient: SupabaseClient;

before(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  }

  testUserId = data.user.id;
  authenticatedClient = anonClient();

  const { error: signInError } = await authenticatedClient.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    throw new Error(`No se pudo iniciar sesion como el usuario de prueba: ${signInError.message}`);
  }
});

after(async () => {
  if (testUserId) {
    await admin.auth.admin.deleteUser(testUserId);
  }
});

test("un cliente sin sesion (anon) no puede leer el schema private", async () => {
  const { data, error } = await anonClient().schema("private").from("webhook_events").select("id").limit(1);

  assert.equal(data, null);
  assert.ok(error, "se esperaba un error de permisos, no una respuesta vacia exitosa");
});

test("un usuario autenticado normal no puede leer el schema private", async () => {
  const { data, error } = await authenticatedClient
    .schema("private")
    .from("webhook_events")
    .select("id")
    .limit(1);

  assert.equal(data, null);
  assert.ok(error, "se esperaba un error de permisos, no una respuesta vacia exitosa");
});

test("service_role (backend) si puede leer el schema private -- confirma que el aislamiento es de rol, no una tabla rota", async () => {
  const { error } = await admin.schema("private").from("webhook_events").select("id").limit(1);

  assert.equal(error, null);
});
