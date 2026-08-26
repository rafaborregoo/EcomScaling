/**
 * FE-02: el dashboard no tenia comparacion contra el periodo anterior (solo
 * el periodo actual) -- gap declarado explicitamente en
 * roadmap/roadmaps/03-frontend-ux/fases/FE-02-dashboard.md ("Siguiente
 * accion: anadir comparacion contra el periodo anterior a los KPIs
 * principales"). `getShopifyMetrics` (apps/api/src/shopify-metrics.ts) ahora
 * llama las mismas funciones SQL stable ya usadas (`shopify_sales_summary`,
 * `shopify_financial_summary`) para el rango [periodStart - N dias,
 * periodStart), sin agregar nada en Node (regla del CLAUDE.md del repo).
 *
 * Test real de extremo a extremo: servidor Fastify real (`buildApp()` +
 * `app.inject`), usuario real, 3 pedidos reales sembrados hace 3 dias
 * (dentro del periodo "ultimos 7 dias") y 2 pedidos reales sembrados hace 10
 * dias (dentro del periodo anterior de 7 dias, [-14d, -7d)), para confirmar
 * que la comparacion distingue de verdad los dos periodos con datos reales,
 * no solo que el campo existe.
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

const admin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

const RUN_TAG = `${Date.now()}`;
const TEST_PASSWORD = "Fe02-Period-Comparison-P4ssword-9!";

let app: FastifyInstance;
let orgId = "";
let connectionId = "";
let ownerUserId = "";
let ownerAccessToken = "";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `FE-02 Period Comparison ${RUN_TAG}`,
      slug: `fe02-period-comparison-${RUN_TAG}`,
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

  const { error: subscriptionError } = await admin
    .from("service_subscriptions")
    .insert({
      organization_id: orgId,
      plan_code: "fe02-period-comparison-test",
      status: "active",
    });
  if (subscriptionError) {
    throw new Error(
      `No se pudo crear la suscripcion de prueba: ${subscriptionError.message}`,
    );
  }

  const email = `fe02-period-comparison-owner-${RUN_TAG}@ecomscaling.test`;
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
    .insert({ organization_id: orgId, user_id: ownerUserId, role: "owner" });
  if (memberError) {
    throw new Error(
      `No se pudo crear la membership de prueba: ${memberError.message}`,
    );
  }

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .insert({
      organization_id: orgId,
      provider: "shopify",
      provider_account_id: `fe02-period-comparison-${RUN_TAG}.myshopify.com`,
      status: "connected",
    })
    .select("id")
    .single();
  if (connectionError || !connection) {
    throw new Error(
      `No se pudo crear la conexion de prueba: ${connectionError?.message}`,
    );
  }
  connectionId = connection.id;

  const { data: store, error: storeError } = await admin
    .from("shopify_stores")
    .insert({
      organization_id: orgId,
      connection_id: connectionId,
      external_shop_id: `fe02-period-comparison-shop-${RUN_TAG}`,
      myshopify_domain: `fe02-period-comparison-${RUN_TAG}.myshopify.com`,
      shop_name: `FE-02 Period Comparison Store ${RUN_TAG}`,
    })
    .select("id")
    .single();
  if (storeError || !store) {
    throw new Error(
      `No se pudo crear la tienda de prueba: ${storeError?.message}`,
    );
  }
  const storeId = store.id;

  // 3 pedidos hace 3 dias (dentro del periodo actual de 7 dias) y 2 pedidos
  // hace 10 dias (dentro del periodo anterior [-14d, -7d)).
  const { error: currentOrdersError } = await admin
    .from("shopify_order_facts")
    .insert(
      Array.from({ length: 3 }, (_, index) => ({
        organization_id: orgId,
        store_id: storeId,
        external_order_id: `fe02-current-${RUN_TAG}-${index}`,
        order_name: `#FE02-current-${index}`,
        financial_status: "paid",
        currency_code: "EUR",
        gross_sales: 100,
        discounts: 0,
        refunds: 0,
        net_sales: 100,
        current_total_price: 100,
        total_items: 1,
        is_test_order: false,
        processed_at: daysAgo(3),
        external_created_at: daysAgo(3),
      })),
    );
  if (currentOrdersError) {
    throw new Error(
      `No se pudieron sembrar pedidos del periodo actual: ${currentOrdersError.message}`,
    );
  }

  const { error: previousOrdersError } = await admin
    .from("shopify_order_facts")
    .insert(
      Array.from({ length: 2 }, (_, index) => ({
        organization_id: orgId,
        store_id: storeId,
        external_order_id: `fe02-previous-${RUN_TAG}-${index}`,
        order_name: `#FE02-previous-${index}`,
        financial_status: "paid",
        currency_code: "EUR",
        gross_sales: 100,
        discounts: 0,
        refunds: 0,
        net_sales: 100,
        current_total_price: 100,
        total_items: 1,
        is_test_order: false,
        processed_at: daysAgo(10),
        external_created_at: daysAgo(10),
      })),
    );
  if (previousOrdersError) {
    throw new Error(
      `No se pudieron sembrar pedidos del periodo anterior: ${previousOrdersError.message}`,
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

test("shopify/metrics con days=7 distingue el periodo actual (3 pedidos) del anterior (2 pedidos)", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/v1/organizations/${orgId}/shopify/metrics?days=7&connectionId=${connectionId}`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });

  assert.equal(response.statusCode, 200, response.body);
  const body = JSON.parse(response.body);

  assert.equal(
    body.sales.orders_count,
    3,
    "el periodo actual deberia contar los 3 pedidos de hace 3 dias",
  );
  assert.ok(
    body.previous_period,
    "deberia venir un previous_period con days=7",
  );
  assert.equal(
    body.previous_period.sales.orders_count,
    2,
    "el periodo anterior deberia contar los 2 pedidos de hace 10 dias",
  );
  assert.ok(
    new Date(body.previous_period.period.end).getTime() <=
      new Date(body.period.start).getTime(),
    "el periodo anterior no deberia solaparse con el periodo actual",
  );
});

test("shopify/metrics con days=all no devuelve previous_period (no hay periodo anterior bien definido)", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/v1/organizations/${orgId}/shopify/metrics?days=all&connectionId=${connectionId}`,
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });

  assert.equal(response.statusCode, 200, response.body);
  const body = JSON.parse(response.body);

  assert.equal(
    body.sales.orders_count,
    5,
    '"Todo" deberia contar los 5 pedidos sembrados (3 + 2)',
  );
  assert.equal(body.previous_period, null);
});
