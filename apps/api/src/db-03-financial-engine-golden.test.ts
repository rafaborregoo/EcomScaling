/**
 * DB-03: golden test numerico del motor financiero.
 *
 * `roadmap/roadmaps/01-base-de-datos/fases/DB-03-configuracion-financiera.md`
 * lista como gap explicito "sin ejemplos numericos completos ni golden tests
 * del motor financiero". Este test fija con numeros exactos que hace hoy
 * `shopify_financial_summary`, para que cualquier cambio futuro en la formula
 * (prorrateo, comisiones, break-even) tenga que ser una decision consciente y
 * no una regresion silenciosa en la ruta del dinero.
 *
 * Escenario, elegido para que cada termino de la formula sea distinguible del
 * resto (ningun dos terminos suman lo mismo) y para que el prorrateo salga
 * exacto: periodo de 31 dias justos y gasto fijo de 304,40/mes, porque
 * 304,40 / 30,44 = 10,00 por dia.
 *
 * | Entrada                       | Valor                       |
 * | ----------------------------- | --------------------------- |
 * | Periodo                       | 2025-03-01 → 2025-04-01 (31d) |
 * | Pedidos                       | 4 × net_sales 250 = 1.000   |
 * | Coste unitario × 4 lineas     | 60 → COGS 240               |
 * | payment_fee_pct               | 2,50 % (escala 0-100)       |
 * | payment_fee_fixed             | 0,30 por pedido             |
 * | default_shipping_cost         | 5,00 por pedido             |
 * | Gasto fijo mensual            | 304,40                      |
 *
 * | Salida esperada            | Calculo                                  | Valor  |
 * | -------------------------- | ---------------------------------------- | ------ |
 * | gross_margin               | 1000 − 240                               | 760,00 |
 * | payment_fees               | 1000 × 2,5/100 + 4 × 0,30                 |  26,20 |
 * | shipping_costs             | 4 × 5,00                                 |  20,00 |
 * | fixed_costs (prorrateado)  | 304,40 × 31 / 30,44                      | 310,00 |
 * | net_profit                 | 760 − 26,20 − 20 − 310                    | 403,80 |
 * | net_margin_pct             | 403,80 / 1000 × 100                       |  40,38 |
 * | break_even_monthly_revenue | 304,40 / ((1000−240−26,20−20)/1000)       | 426,45 |
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.
 * Ejecutar con `npm run test -w @ecomscaling/api`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";

const env = loadApiEnv(process.env);

const admin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const RUN_TAG = `${Date.now()}`;
const PERIOD_START = "2025-03-01T00:00:00Z";
const PERIOD_END = "2025-04-01T00:00:00Z";
const ORDER_DATE = "2025-03-15T12:00:00Z";

let orgId = "";
let storeId = "";

function numeric(value: unknown): number {
  return Number(value);
}

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `DB-03 Golden ${RUN_TAG}`,
      slug: `db03-golden-${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();
  if (orgError || !org)
    throw new Error(`No se pudo crear la organizacion: ${orgError?.message}`);
  orgId = org.id;

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .insert({
      organization_id: orgId,
      provider: "shopify",
      provider_account_id: `db03-golden-${RUN_TAG}.myshopify.com`,
      status: "connected",
    })
    .select("id")
    .single();
  if (connectionError || !connection)
    throw new Error(
      `No se pudo crear la conexion: ${connectionError?.message}`,
    );

  const { data: store, error: storeError } = await admin
    .from("shopify_stores")
    .insert({
      organization_id: orgId,
      connection_id: connection.id,
      external_shop_id: `db03-golden-shop-${RUN_TAG}`,
      myshopify_domain: `db03-golden-${RUN_TAG}.myshopify.com`,
      shop_name: `DB-03 Golden Store ${RUN_TAG}`,
    })
    .select("id")
    .single();
  if (storeError || !store)
    throw new Error(`No se pudo crear la tienda: ${storeError?.message}`);
  storeId = store.id;

  const { data: orders, error: ordersError } = await admin
    .from("shopify_order_facts")
    .insert(
      Array.from({ length: 4 }, (_, index) => ({
        organization_id: orgId,
        store_id: storeId,
        external_order_id: `db03-golden-${RUN_TAG}-${index}`,
        order_name: `#DB03-${index}`,
        financial_status: "paid",
        currency_code: "EUR",
        gross_sales: 250,
        discounts: 0,
        refunds: 0,
        net_sales: 250,
        current_total_price: 250,
        total_items: 1,
        is_test_order: false,
        processed_at: ORDER_DATE,
        external_created_at: ORDER_DATE,
      })),
    )
    .select("id");
  if (ordersError || !orders)
    throw new Error(`No se pudieron sembrar pedidos: ${ordersError?.message}`);

  const { data: product, error: productError } = await admin
    .from("shopify_products")
    .insert({
      organization_id: orgId,
      store_id: storeId,
      external_product_id: `db03-golden-product-${RUN_TAG}`,
      title: `DB-03 Golden Product ${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();
  if (productError || !product)
    throw new Error(`No se pudo crear el producto: ${productError?.message}`);

  const { data: variant, error: variantError } = await admin
    .from("shopify_variants")
    .insert({
      organization_id: orgId,
      product_id: product.id,
      external_variant_id: `db03-golden-variant-${RUN_TAG}`,
      current_price: 250,
    })
    .select("id")
    .single();
  if (variantError || !variant)
    throw new Error(`No se pudo crear la variante: ${variantError?.message}`);

  const { data: inventoryItem, error: inventoryItemError } = await admin
    .from("shopify_inventory_items")
    .insert({
      organization_id: orgId,
      variant_id: variant.id,
      external_inventory_item_id: `db03-golden-inv-${RUN_TAG}`,
      sku: `DB03-SKU-${RUN_TAG}`,
      tracked: true,
      current_unit_cost: 60,
      cost_currency_code: "EUR",
    })
    .select("id")
    .single();
  if (inventoryItemError || !inventoryItem)
    throw new Error(
      `No se pudo crear el inventory item: ${inventoryItemError?.message}`,
    );

  const { error: costError } = await admin.from("product_costs").insert({
    organization_id: orgId,
    inventory_item_id: inventoryItem.id,
    unit_cost: 60,
    currency_code: "EUR",
    source: "manual",
    valid_from: "2020-01-01",
  });
  if (costError)
    throw new Error(`No se pudo crear el coste unitario: ${costError.message}`);

  const { error: itemsError } = await admin.from("shopify_order_items").insert(
    orders.map((order, index) => ({
      organization_id: orgId,
      order_id: order.id,
      product_id: product.id,
      variant_id: variant.id,
      external_line_item_id: `db03-golden-line-${RUN_TAG}-${index}`,
      title: `DB-03 Golden Product ${RUN_TAG}`,
      quantity_original: 1,
      quantity_current: 1,
      refunded_quantity: 0,
      unit_price: 250,
      original_line_total: 250,
      current_line_total: 250,
      discount_total: 0,
    })),
  );
  if (itemsError)
    throw new Error(
      `No se pudieron sembrar lineas de pedido: ${itemsError.message}`,
    );

  const { error: settingsError } = await admin
    .from("organization_financial_settings")
    .insert({
      organization_id: orgId,
      currency_code: "EUR",
      payment_fee_pct: 2.5,
      payment_fee_fixed: 0.3,
      default_shipping_cost: 5,
      vat_pct: 21,
    });
  if (settingsError)
    throw new Error(
      `No se pudo crear la configuracion financiera: ${settingsError.message}`,
    );

  const { error: expenseError } = await admin.from("fixed_expenses").insert({
    organization_id: orgId,
    name: `DB-03 Golden Fixed ${RUN_TAG}`,
    amount: 304.4,
    currency_code: "EUR",
    billing_period: "monthly",
    valid_from: "2020-01-01",
    is_active: true,
  });
  if (expenseError)
    throw new Error(`No se pudo crear el gasto fijo: ${expenseError.message}`);
});

after(async () => {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
});

test("shopify_financial_summary reproduce el caso golden termino a termino", async () => {
  const { data, error } = await admin.rpc("shopify_financial_summary", {
    target_organization_id: orgId,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    target_store_id: storeId,
  });
  assert.equal(error, null, error?.message);

  const row = data?.[0];
  assert.ok(row, "la funcion deberia devolver una fila");

  assert.equal(numeric(row.net_sales), 1000);
  assert.equal(numeric(row.orders_count), 4);
  assert.equal(numeric(row.cogs), 240);
  assert.equal(numeric(row.gross_margin), 760);
  assert.equal(numeric(row.payment_fees), 26.2);
  assert.equal(numeric(row.shipping_costs), 20);
  // 304,40 × 31 / 30,44: el prorrateo es por dias reales del periodo sobre un
  // mes medio de 30,44 dias, no por mes natural.
  assert.equal(numeric(row.fixed_costs), 310);
  assert.equal(numeric(row.net_profit), 403.8);
  assert.equal(numeric(row.net_margin_pct), 40.38);
  assert.equal(numeric(row.monthly_fixed_costs), 304.4);
  assert.equal(numeric(row.break_even_monthly_revenue), 426.45);
  assert.equal(row.has_settings, true);
  assert.equal(numeric(row.fixed_expenses_count), 1);
  assert.equal(numeric(row.items_without_cost), 0);
});

test("el IVA configurado no entra hoy en el beneficio neto", async () => {
  // vat_pct esta sembrado al 21% y validado por CHECK, pero ninguna funcion de
  // metricas lo usa: net_sales de Shopify ya viene sin impuestos. Fijarlo aqui
  // evita que alguien lo "arregle" restandolo otra vez y duplique el descuento.
  const { data } = await admin.rpc("shopify_financial_summary", {
    target_organization_id: orgId,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    target_store_id: storeId,
  });

  assert.equal(numeric(data?.[0]?.net_profit), 403.8);
});

test("una shipping_cost_rule activa no cambia el coste de envio calculado", async () => {
  // Gap real de DB-03: shipping_cost_rules es CRUD-able desde
  // /configuracion pero ninguna funcion de metricas la lee. El envio siempre
  // sale de default_shipping_cost × pedidos. El test fija el comportamiento
  // actual para que la UI no pueda prometer lo contrario sin romper esto.
  const { error: ruleError } = await admin.from("shipping_cost_rules").insert({
    organization_id: orgId,
    name: `DB-03 Golden Rule ${RUN_TAG}`,
    cost_per_order: 99,
    currency_code: "EUR",
    min_order_total: 0,
    valid_from: "2020-01-01",
    is_active: true,
  });
  assert.equal(ruleError, null, ruleError?.message);

  const { data } = await admin.rpc("shopify_financial_summary", {
    target_organization_id: orgId,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    target_store_id: storeId,
  });

  assert.equal(
    numeric(data?.[0]?.shipping_costs),
    20,
    "la regla de 99 por pedido se ignora: sigue mandando default_shipping_cost",
  );
});
