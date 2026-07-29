/**
 * DB-04: el criterio de cierre "webhooks repetidos quedan registrados sin
 * ejecutar dos veces el mismo efecto" estaba cubierto solo por el indice
 * unico de `private.webhook_events.fingerprint` en el schema, sin ningun
 * test que confirmara el comportamiento real bajo concurrencia -- dos
 * webhooks identicos llegando al mismo tiempo (reintento real de Shopify tras
 * un timeout, no solo secuencial). Este test dispara dos peticiones
 * concurrentes identicas contra `handleShopifyWebhookRequest` y confirma que
 * el efecto de negocio se aplica una sola vez, apoyandose en que la
 * constraint unica de Postgres serializa las dos inserciones (garantia de la
 * base de datos, no de la logica de aplicacion).
 *
 * Usa el topic `customers/data_request` (handler no-op) para probar la
 * deduplicacion sin arriesgar efectos secundarios sobre datos de negocio
 * reales -- lo que se prueba es el pipeline comun (HMAC -> resolucion de
 * conexion -> insert con fingerprint -> despacho), no un handler concreto.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/
 * SHOPIFY_API_SECRET. Ejecutar con `npm run test -w @ecomscaling/api`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";
import { handleShopifyWebhookRequest } from "./shopify-webhook-handler.js";

const env = loadApiEnv(process.env);

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `${Date.now()}`;
const SHOP_DOMAIN = `db04-idempotency-test-${RUN_TAG}.myshopify.com`;

let orgId = "";

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `DB-04 Idempotency Test ${RUN_TAG}`,
      slug: `db04-idempotency-test-${RUN_TAG}`,
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
      provider_account_id: SHOP_DOMAIN,
      status: "connected",
    })
    .select("id")
    .single();

  if (connectionError || !connection) {
    throw new Error(`No se pudo crear la conexion de prueba: ${connectionError?.message}`);
  }

  // resolveConnectionContext (shopify-webhook-handler.ts) exige tambien una
  // fila en shopify_stores enlazada a la conexion -- sin esto cualquier
  // webhook para esta tienda de prueba se ignoraria como "unknown_connection".
  const { error: storeError } = await admin.from("shopify_stores").insert({
    organization_id: orgId,
    connection_id: connection.id,
    external_shop_id: `db04-test-shop-${RUN_TAG}`,
    myshopify_domain: SHOP_DOMAIN,
    shop_name: `DB-04 Idempotency Test Store ${RUN_TAG}`,
  });

  if (storeError) {
    throw new Error(`No se pudo crear la tienda de prueba: ${storeError.message}`);
  }
});

after(async () => {
  if (orgId) {
    await admin.from("organizations").delete().eq("id", orgId);
  }
});

test("dos webhooks identicos concurrentes solo se procesan una vez (idempotencia real, no solo secuencial)", async () => {
  const payload = JSON.stringify({
    shop_id: 1,
    shop_domain: SHOP_DOMAIN,
    orders_requested: [],
    customer: { id: 999999, email: "test@example.com" },
  });
  const rawBody = Buffer.from(payload, "utf8");
  const hmac = crypto.createHmac("sha256", env.SHOPIFY_API_SECRET).update(rawBody).digest("base64");

  const headers = {
    "x-shopify-hmac-sha256": hmac,
    "x-shopify-shop-domain": SHOP_DOMAIN,
    "x-shopify-topic": "customers/data_request",
    "x-shopify-webhook-id": `db04-test-${RUN_TAG}`,
  };

  const [resultA, resultB] = await Promise.all([
    handleShopifyWebhookRequest(env, headers, rawBody),
    handleShopifyWebhookRequest(env, headers, rawBody),
  ]);

  const statuses = [resultA.body.status, resultB.body.status].sort();
  assert.deepEqual(
    statuses,
    ["duplicate", "processed"],
    `se esperaba exactamente un "processed" y un "duplicate", se obtuvo: ${JSON.stringify(statuses)}`,
  );

  const fingerprint = crypto.createHash("sha256").update(rawBody.toString("utf8")).digest("hex");
  const { data: events, error: eventsError } = await admin
    .schema("private")
    .from("webhook_events")
    .select("id, status")
    .eq("fingerprint", fingerprint)
    .eq("provider", "shopify");

  assert.equal(eventsError, null);
  assert.equal(events?.length, 1, "debe existir exactamente una fila de webhook_events para el mismo fingerprint");
  assert.equal(events?.[0]?.status, "processed");
});

// SQO-04 (gap real cerrado 2026-07-29, fila 4 de la matriz de amenazas): la
// idempotencia de recepcion ya estaba probada arriba, pero nada confirmaba
// que un HMAC incorrecto (firma manipulada o secret equivocado) se rechazara
// antes de tocar la base de datos -- la unica barrera real entre "cualquiera
// que sepa la URL del webhook" y "un payload arbitrario procesado como si
// viniera de Shopify".
test("rechaza un webhook con HMAC invalido antes de tocar la base de datos", async () => {
  const payload = JSON.stringify({
    shop_id: 1,
    shop_domain: SHOP_DOMAIN,
    orders_requested: [],
    customer: { id: 888888, email: "invalid-hmac@example.com" },
  });
  const rawBody = Buffer.from(payload, "utf8");
  const wrongHmac = crypto.createHmac("sha256", "clave-que-no-es-el-secret-real").update(rawBody).digest("base64");

  const headers = {
    "x-shopify-hmac-sha256": wrongHmac,
    "x-shopify-shop-domain": SHOP_DOMAIN,
    "x-shopify-topic": "customers/data_request",
    "x-shopify-webhook-id": `db04-invalid-hmac-${RUN_TAG}`,
  };

  const result = await handleShopifyWebhookRequest(env, headers, rawBody);

  assert.equal(result.statusCode, 401);
  assert.equal(result.body.error, "invalid_hmac");

  const fingerprint = crypto.createHash("sha256").update(rawBody.toString("utf8")).digest("hex");
  const { data: events, error: eventsError } = await admin
    .schema("private")
    .from("webhook_events")
    .select("id")
    .eq("fingerprint", fingerprint)
    .eq("provider", "shopify");

  assert.equal(eventsError, null);
  assert.equal(events?.length, 0, "un HMAC invalido no debe insertar fila alguna en webhook_events");
});
