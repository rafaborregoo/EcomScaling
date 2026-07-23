/**
 * DB-04: "sin locking documentado para refresh de tokens concurrente" era un
 * gap listado sin ningun test -- distinto del caso de webhooks, ya probado en
 * db-04-webhook-idempotency.test.ts. `getValidShopifyAccessToken`
 * (shopify-token-store.ts) evita que dos procesos refresquen el mismo token a
 * la vez con un claim optimista: un UPDATE condicionado a
 * `expires_at = <valor leido>` y (`refresh_locked_at` nulo o mas viejo que
 * CLAIM_STALE_MS), que solo devuelve fila si gana la carrera -- la garantia
 * real es que Postgres serializa dos UPDATE concurrentes sobre la misma fila,
 * no un lock de aplicacion.
 *
 * No se prueba `getValidShopifyAccessToken` completo porque el siguiente paso
 * tras ganar el claim llama a la API real de Shopify para refrescar el token
 * (no hay libreria de mocking HTTP en este paquete y no hay credenciales de
 * sandbox en este entorno) -- se prueba directamente la primitiva de claim
 * (mismo patron de query, misma tabla) disparando dos UPDATE concurrentes
 * contra el Supabase remoto real y confirmando que solo uno gana.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. Ejecutar
 * con `npm run test -w @ecomscaling/api`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";

const env = loadApiEnv(process.env);

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `${Date.now()}`;
const CREDENTIAL_KIND = "shopify_offline_access_token";
const EXPIRES_AT = new Date(Date.now() + 60_000).toISOString();

let orgId = "";
let connectionId = "";

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `DB-04 Token Claim Test ${RUN_TAG}`,
      slug: `db04-token-claim-test-${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(`No se pudo crear la organizacion de prueba: ${orgError?.message}`);
  }
  orgId = org.id;

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .insert({
      organization_id: orgId,
      provider: "shopify",
      provider_account_id: `db04-token-claim-test-${RUN_TAG}.myshopify.com`,
      status: "connected",
    })
    .select("id")
    .single();

  if (connectionError || !connection) {
    throw new Error(`No se pudo crear la conexion de prueba: ${connectionError?.message}`);
  }
  connectionId = connection.id;

  const { error: credentialError } = await admin
    .schema("private")
    .from("integration_credentials")
    .insert({
      connection_id: connectionId,
      credential_kind: CREDENTIAL_KIND,
      encrypted_payload: "test-payload-not-real-ciphertext",
      encryption_key_version: "v1",
      expires_at: EXPIRES_AT,
      refresh_token_expires_at: null,
      refresh_locked_at: null,
    });

  if (credentialError) {
    throw new Error(`No se pudo crear la credencial de prueba: ${credentialError.message}`);
  }
});

after(async () => {
  if (orgId) {
    await admin.from("organizations").delete().eq("id", orgId);
  }
});

async function attemptClaim() {
  const claimStaleBefore = new Date(Date.now() - 20_000).toISOString();
  const { data, error } = await admin
    .schema("private")
    .from("integration_credentials")
    .update({ refresh_locked_at: new Date().toISOString() })
    .eq("connection_id", connectionId)
    .eq("credential_kind", CREDENTIAL_KIND)
    .eq("expires_at", EXPIRES_AT)
    .or(`refresh_locked_at.is.null,refresh_locked_at.lt.${claimStaleBefore}`)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`claim_failed: ${error.message}`);
  }

  return data !== null;
}

test("dos claims concurrentes de refresh sobre la misma credencial: exactamente uno gana", async () => {
  const [wonA, wonB] = await Promise.all([attemptClaim(), attemptClaim()]);

  assert.deepEqual(
    [wonA, wonB].sort(),
    [false, true],
    `se esperaba que exactamente un claim ganara, se obtuvo: [${wonA}, ${wonB}]`,
  );
});

test("un claim ya tomado y fresco bloquea un tercer intento inmediato", async () => {
  const won = await attemptClaim();
  assert.equal(won, false, "el claim ya esta tomado por el test anterior y todavia no es stale (CLAIM_STALE_MS=20s)");
});
