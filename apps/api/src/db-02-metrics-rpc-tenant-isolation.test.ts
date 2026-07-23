/**
 * DB-02: gap listado como "falta solo RPC/Storage si se llegan a usar" --
 * confirmado que si se usan (Storage no, cero referencias en el codigo; RPC
 * si, 7 funciones SQL de metricas mas `agent_sql_gateway`/`knowledge_search`,
 * ya cubiertas por AI-03/DB-11). Ninguna de las funciones de metricas de
 * Shopify (`shopify_sales_summary`, `shopify_financial_summary`, etc.) tenia
 * un test que confirmara que son `security invoker` de verdad y que la RLS de
 * `shopify_order_facts` las protege -- ambas se llaman con el cliente
 * `createUserScopedClient` (el JWT del usuario, no service_role,
 * `shopify-metrics.ts`), asi que si la RLS fallara, un `target_organization_id`
 * ajeno pasado a mano devolveria datos reales de otra organizacion.
 *
 * Este test llama a ambas funciones **directamente por RPC, con el cliente
 * del usuario de la organizacion A**, pidiendo explicitamente los datos de la
 * organizacion B (`target_organization_id = orgB`) -- el mismo patron que
 * `be-07-sql-gateway-tenant-isolation.test.ts` para el SQL Gateway, aplicado
 * aqui a las funciones de metricas que si estan en produccion hoy (a
 * diferencia del gateway, que es para agentes IA).
 *
 * Ampliado 2026-07-23: las otras 5 funciones de metricas
 * (`shopify_top_products`, `shopify_stock_summary`, `shopify_margin_summary`,
 * `shopify_stock_risk_products`, `meta_spend_summary`) quedaban listadas como
 * "comparten el patron pero no probadas individualmente" -- se sembraron
 * productos/variantes/inventario/costes de B (para top_products, stock,
 * margin, stock_risk) y una cuenta+insight de Meta de B (para
 * meta_spend_summary), y se repite el mismo ataque: el usuario de A pide
 * `target_organization_id = orgB` y se confirma que RLS corta el dato real.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/
 * SUPABASE_PUBLISHABLE_KEY. Ejecutar con `npm run test -w @ecomscaling/api`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";

const env = loadApiEnv(process.env);

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `${Date.now()}`;
const TEST_PASSWORD = "Db02-Rpc-Tenant-Isolation-P4ss-9!";
const PERIOD_START = "2020-01-01T00:00:00Z";
const PERIOD_END = "2030-01-01T00:00:00Z";

let orgA = "";
let orgB = "";
let storeBId = "";
let productBId = "";
let orderBIds: string[] = [];
let ownerAUserId = "";
let ownerAClient: SupabaseClient;

before(async () => {
  const { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .insert([
      { display_name: `DB-02 RPC Isolation Org A ${RUN_TAG}`, slug: `db02-rpc-isolation-org-a-${RUN_TAG}`, status: "active" },
      { display_name: `DB-02 RPC Isolation Org B ${RUN_TAG}`, slug: `db02-rpc-isolation-org-b-${RUN_TAG}`, status: "active" },
    ])
    .select("id, slug");

  if (orgsError || !orgs || orgs.length !== 2) {
    throw new Error(`No se pudieron crear las organizaciones de prueba: ${orgsError?.message}`);
  }
  orgA = orgs.find((org) => org.slug.startsWith("db02-rpc-isolation-org-a"))!.id;
  orgB = orgs.find((org) => org.slug.startsWith("db02-rpc-isolation-org-b"))!.id;

  // Suscripcion activa para A: shopify_financial_summary depende de
  // shopify_order_facts, cuya RLS exige can_access_org, que a su vez exige
  // has_valid_subscription (mismo hallazgo real que en BE-01).
  const { error: subscriptionError } = await admin
    .from("service_subscriptions")
    .insert({ organization_id: orgA, plan_code: "db02-rpc-isolation-test", status: "active" });
  if (subscriptionError) {
    throw new Error(`No se pudo crear la suscripcion de prueba: ${subscriptionError.message}`);
  }

  const email = `db02-rpc-isolation-owner-a-${RUN_TAG}@ecomscaling.test`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`No se pudo crear el usuario de prueba: ${createError?.message}`);
  }
  ownerAUserId = created.user.id;

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ organization_id: orgA, user_id: ownerAUserId, role: "owner" });
  if (memberError) {
    throw new Error(`No se pudo crear la membership de prueba: ${memberError.message}`);
  }

  ownerAClient = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: signInError } = await ownerAClient.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInError || !session.session) {
    throw new Error(`No se pudo iniciar sesion como el usuario de prueba: ${signInError?.message}`);
  }

  // Datos reales de la organizacion B, que el usuario de A nunca deberia ver.
  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .insert({ organization_id: orgB, provider: "shopify", provider_account_id: `db02-rpc-isolation-b-${RUN_TAG}.myshopify.com`, status: "connected" })
    .select("id")
    .single();
  if (connectionError || !connection) {
    throw new Error(`No se pudo crear la conexion de prueba: ${connectionError?.message}`);
  }

  const { data: store, error: storeError } = await admin
    .from("shopify_stores")
    .insert({
      organization_id: orgB,
      connection_id: connection.id,
      external_shop_id: `db02-rpc-isolation-shop-b-${RUN_TAG}`,
      myshopify_domain: `db02-rpc-isolation-b-${RUN_TAG}.myshopify.com`,
      shop_name: `DB-02 RPC Isolation Store B ${RUN_TAG}`,
    })
    .select("id")
    .single();
  if (storeError || !store) {
    throw new Error(`No se pudo crear la tienda de prueba: ${storeError?.message}`);
  }
  storeBId = store.id;

  const { data: orders, error: ordersError } = await admin
    .from("shopify_order_facts")
    .insert(
      Array.from({ length: 5 }, (_, index) => ({
        organization_id: orgB,
        store_id: storeBId,
        external_order_id: `db02-rpc-isolation-order-${RUN_TAG}-${index}`,
        order_name: `#DB02-${index}`,
        financial_status: "paid",
        currency_code: "EUR",
        gross_sales: 200,
        discounts: 0,
        refunds: 0,
        net_sales: 200,
        current_total_price: 200,
        total_items: 1,
        is_test_order: false,
        processed_at: "2025-06-01T00:00:00Z",
        external_created_at: "2025-06-01T00:00:00Z",
      })),
    )
    .select("id");
  if (ordersError || !orders) {
    throw new Error(`No se pudieron sembrar pedidos de la organizacion B: ${ordersError?.message}`);
  }
  orderBIds = orders.map((order) => order.id);

  // Producto/variante/inventario reales de B, para shopify_top_products,
  // shopify_stock_summary, shopify_margin_summary y shopify_stock_risk_products.
  const { data: product, error: productError } = await admin
    .from("shopify_products")
    .insert({
      organization_id: orgB,
      store_id: storeBId,
      external_product_id: `db02-rpc-isolation-product-${RUN_TAG}`,
      title: `DB-02 RPC Isolation Product ${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();
  if (productError || !product) {
    throw new Error(`No se pudo crear el producto de prueba: ${productError?.message}`);
  }
  productBId = product.id;

  const { data: variant, error: variantError } = await admin
    .from("shopify_variants")
    .insert({
      organization_id: orgB,
      product_id: productBId,
      external_variant_id: `db02-rpc-isolation-variant-${RUN_TAG}`,
      current_price: 200,
    })
    .select("id")
    .single();
  if (variantError || !variant) {
    throw new Error(`No se pudo crear la variante de prueba: ${variantError?.message}`);
  }

  const { data: inventoryItem, error: inventoryItemError } = await admin
    .from("shopify_inventory_items")
    .insert({
      organization_id: orgB,
      variant_id: variant.id,
      external_inventory_item_id: `db02-rpc-isolation-inv-item-${RUN_TAG}`,
      sku: `DB02-SKU-${RUN_TAG}`,
      tracked: true,
      current_unit_cost: 50,
      cost_currency_code: "EUR",
    })
    .select("id")
    .single();
  if (inventoryItemError || !inventoryItem) {
    throw new Error(`No se pudo crear el inventory item de prueba: ${inventoryItemError?.message}`);
  }

  const { error: productCostError } = await admin.from("product_costs").insert({
    organization_id: orgB,
    inventory_item_id: inventoryItem.id,
    unit_cost: 50,
    currency_code: "EUR",
    source: "manual",
    valid_from: "2020-01-01",
  });
  if (productCostError) {
    throw new Error(`No se pudo crear el coste de producto de prueba: ${productCostError.message}`);
  }

  const { data: location, error: locationError } = await admin
    .from("shopify_locations")
    .insert({
      organization_id: orgB,
      store_id: storeBId,
      external_location_id: `db02-rpc-isolation-location-${RUN_TAG}`,
      name: `DB-02 RPC Isolation Location ${RUN_TAG}`,
    })
    .select("id")
    .single();
  if (locationError || !location) {
    throw new Error(`No se pudo crear la ubicacion de prueba: ${locationError?.message}`);
  }

  const { error: stockError } = await admin.from("shopify_inventory_current_state").insert({
    organization_id: orgB,
    inventory_item_id: inventoryItem.id,
    location_id: location.id,
    available_quantity: 42,
    on_hand_quantity: 42,
  });
  if (stockError) {
    throw new Error(`No se pudo sembrar el stock de prueba: ${stockError.message}`);
  }

  const { error: orderItemsError } = await admin.from("shopify_order_items").insert(
    orderBIds.map((orderId, index) => ({
      organization_id: orgB,
      order_id: orderId,
      product_id: productBId,
      variant_id: variant.id,
      external_line_item_id: `db02-rpc-isolation-line-${RUN_TAG}-${index}`,
      title: `DB-02 RPC Isolation Product ${RUN_TAG}`,
      quantity_original: 1,
      quantity_current: 1,
      unit_price: 200,
      original_line_total: 200,
      current_line_total: 200,
    })),
  );
  if (orderItemsError) {
    throw new Error(`No se pudieron sembrar las lineas de pedido de prueba: ${orderItemsError.message}`);
  }

  // Cuenta e insight de Meta reales de B, para meta_spend_summary.
  const { data: metaConnection, error: metaConnectionError } = await admin
    .from("integration_connections")
    .insert({ organization_id: orgB, provider: "meta_ads", provider_account_id: `db02-rpc-isolation-meta-${RUN_TAG}`, status: "connected" })
    .select("id")
    .single();
  if (metaConnectionError || !metaConnection) {
    throw new Error(`No se pudo crear la conexion de Meta de prueba: ${metaConnectionError?.message}`);
  }

  const { data: adAccount, error: adAccountError } = await admin
    .from("meta_ad_accounts")
    .insert({
      organization_id: orgB,
      connection_id: metaConnection.id,
      external_ad_account_id: `db02-rpc-isolation-adaccount-${RUN_TAG}`,
      account_name: `DB-02 RPC Isolation Ad Account ${RUN_TAG}`,
    })
    .select("id")
    .single();
  if (adAccountError || !adAccount) {
    throw new Error(`No se pudo crear la cuenta publicitaria de prueba: ${adAccountError?.message}`);
  }

  const { data: insightRow, error: insightRowError } = await admin
    .from("meta_insight_rows_daily")
    .insert({
      organization_id: orgB,
      ad_account_id: adAccount.id,
      level: "ad",
      external_entity_id: `db02-rpc-isolation-ad-${RUN_TAG}`,
      metric_date: "2025-06-01",
      spend: 100,
      impressions: 1000,
      clicks: 50,
    })
    .select("id")
    .single();
  if (insightRowError || !insightRow) {
    throw new Error(`No se pudo crear la fila de insight de Meta de prueba: ${insightRowError?.message}`);
  }

  const { error: actionMetricError } = await admin.from("meta_insight_action_metrics").insert({
    organization_id: orgB,
    insight_row_id: insightRow.id,
    metric_name: "actions",
    action_type: "purchase",
    value: 5,
  });
  if (actionMetricError) {
    throw new Error(`No se pudo crear la metrica de accion de Meta de prueba: ${actionMetricError.message}`);
  }
});

after(async () => {
  if (ownerAUserId) {
    await admin.auth.admin.deleteUser(ownerAUserId);
  }
  if (orgA || orgB) {
    await admin.from("organizations").delete().in("id", [orgA, orgB].filter(Boolean));
  }
});

test("shopify_sales_summary con target_organization_id=B llamado por un usuario de A no devuelve las ventas reales de B", async () => {
  const { data, error } = await ownerAClient.rpc("shopify_sales_summary", {
    target_organization_id: orgB,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
  });

  assert.equal(error, null);
  const row = (data as Array<{ orders_count: number; net_sales: number }>)[0];
  assert.ok(row, "la funcion deberia devolver una fila (agregacion sobre cero filas visibles)");
  assert.equal(Number(row.orders_count), 0, "no deberia contar los 5 pedidos reales de B");
  assert.equal(Number(row.net_sales), 0, "no deberia sumar las ventas reales de B (5 x 200 EUR)");
});

test("shopify_financial_summary con target_organization_id=B llamado por un usuario de A no devuelve datos financieros reales de B", async () => {
  const { data, error } = await ownerAClient.rpc("shopify_financial_summary", {
    target_organization_id: orgB,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    target_store_id: null,
  });

  assert.equal(error, null);
  const row = (data as Array<{ orders_count: number; net_sales: number; has_settings: boolean }>)[0];
  assert.ok(row, "la funcion deberia devolver una fila (agregacion sobre cero filas visibles)");
  assert.equal(Number(row.orders_count), 0, "no deberia contar los pedidos reales de B");
  assert.equal(Number(row.net_sales), 0, "no deberia sumar las ventas reales de B");
});

test("shopify_top_products con target_organization_id=B llamado por un usuario de A no devuelve el producto real de B", async () => {
  const { data, error } = await ownerAClient.rpc("shopify_top_products", {
    target_organization_id: orgB,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    result_limit: 10,
    target_store_id: null,
  });

  assert.equal(error, null);
  const rows = data as Array<{ product_id: string; revenue: number }>;
  assert.equal(rows.length, 0, "no deberia devolver ninguna fila (el producto real de B existe pero es invisible)");
});

test("shopify_stock_summary con target_organization_id=B llamado por un usuario de A no devuelve el stock real de B", async () => {
  const { data, error } = await ownerAClient.rpc("shopify_stock_summary", {
    target_organization_id: orgB,
    low_stock_threshold: 5,
    target_store_id: null,
  });

  assert.equal(error, null);
  const row = (data as Array<{ tracked_items: number; total_available: number }>)[0];
  assert.ok(row, "la funcion deberia devolver una fila (agregacion sobre cero filas visibles)");
  assert.equal(Number(row.tracked_items), 0, "no deberia contar el item de inventario real de B");
  assert.equal(Number(row.total_available), 0, "no deberia sumar las 42 unidades reales de B");
});

test("shopify_margin_summary con target_organization_id=B llamado por un usuario de A no devuelve el margen real de B", async () => {
  const { data, error } = await ownerAClient.rpc("shopify_margin_summary", {
    target_organization_id: orgB,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    target_store_id: null,
  });

  assert.equal(error, null);
  const row = (data as Array<{ revenue: number; cogs: number }>)[0];
  assert.ok(row, "la funcion deberia devolver una fila (agregacion sobre cero filas visibles)");
  assert.equal(Number(row.revenue), 0, "no deberia sumar los 1000 EUR reales de ingresos de B (5 lineas x 200 EUR)");
  assert.equal(Number(row.cogs), 0, "no deberia sumar el coste real de B");
});

test("shopify_stock_risk_products con target_organization_id=B llamado por un usuario de A no devuelve el producto en riesgo real de B", async () => {
  const { data, error } = await ownerAClient.rpc("shopify_stock_risk_products", {
    target_organization_id: orgB,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    target_store_id: null,
  });

  assert.equal(error, null);
  const rows = data as Array<{ product_id: string }>;
  assert.equal(rows.length, 0, "no deberia devolver el producto real de B (5 unidades vendidas, 42 en stock)");
});

test("meta_spend_summary con target_organization_id=B llamado por un usuario de A no devuelve el gasto real de B", async () => {
  const { data, error } = await ownerAClient.rpc("meta_spend_summary", {
    target_organization_id: orgB,
    period_start: "2020-01-01",
    period_end: "2030-01-01",
  });

  assert.equal(error, null);
  const rows = data as Array<{ spend: number; purchases: number }> | null;
  const row = rows?.[0];
  if (row) {
    assert.equal(Number(row.spend), 0, "no deberia sumar los 100 EUR reales de gasto de B");
    assert.equal(Number(row.purchases), 0, "no deberia contar las 5 compras reales de B");
  }
  // Si no hay fila (agregacion con `group by` sobre cero filas puede no
  // devolver ninguna), tambien es un resultado seguro: no hay dato real de B.
});

test("control positivo: el mismo usuario si ve datos reales (aunque vacios) al pedir su propia organizacion", async () => {
  const { data, error } = await ownerAClient.rpc("shopify_sales_summary", {
    target_organization_id: orgA,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
  });

  assert.equal(error, null);
  const row = (data as Array<{ orders_count: number }>)[0];
  assert.ok(row, "un miembro real de la organizacion deberia poder ejecutar la funcion sobre su propia org sin error");
  assert.equal(Number(row.orders_count), 0, "A no tiene pedidos propios sembrados en este test, 0 es el resultado correcto (no un bloqueo)");
});
