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
 * Reescrito en F1 del panel del manager (docs/PLAN_PANEL_MANAGER.md). El motor
 * cambio a proposito y estos numeros lo fijan: el ingreso que manda es el de
 * SIN IVA, el envio sale de las reglas por tramo y la inversion en ads se resta
 * del beneficio (antes faltaba y el beneficio salia inflado).
 *
 * Escenario, elegido para que cada termino de la formula sea distinguible del
 * resto (ningun dos terminos suman lo mismo) y para que el prorrateo salga
 * exacto: periodo de 31 dias justos y gasto fijo de 304,40/mes, porque
 * 304,40 / 30,44 = 10,00 por dia.
 *
 * | Entrada                       | Valor                             |
 * | ----------------------------- | --------------------------------- |
 * | Periodo                       | 2025-03-01 → 2025-04-01 (31d)     |
 * | Pedidos                       | 4 × 250 pagados = 1.000           |
 * | IVA por pedido                | 40 → 160 en total                 |
 * | Envio cobrado por pedido      | 10 → 40 en total                  |
 * | Clientes (hash)               | A, A, B, C → 3 clientes nuevos    |
 * | Coste unitario × 4 lineas     | 60 → COGS 240                     |
 * | payment_fee_pct               | 2,50 % (escala 0-100)             |
 * | payment_fee_fixed             | 0,30 por pedido                   |
 * | default_shipping_cost         | 5,00 por pedido                   |
 * | Gasto fijo mensual            | 304,40                            |
 * | Inversion Meta en el periodo  | 100,00                            |
 *
 * | Salida esperada            | Calculo                                    | Valor  |
 * | -------------------------- | ------------------------------------------ | ------ |
 * | net_sales (con IVA)        | 4 × 250                                    |1000,00 |
 * | net_revenue_ex_tax         | 1000 − 160                                 | 840,00 |
 * | gross_margin               | 840 − 240                                  | 600,00 |
 * | payment_fees               | 1000 × 2,5/100 + 4 × 0,30                  |  26,20 |
 * | shipping_costs             | 4 × 5,00 (sin regla que calce)             |  20,00 |
 * | shipping_net               | 40 cobrado − 20 pagado                     |  20,00 |
 * | fixed_costs (prorrateado)  | 304,40 × 31 / 30,44                        | 310,00 |
 * | ads_spend                  | fila de insight de Meta                    | 100,00 |
 * | new_customers              | hashes distintos con 1er pedido dentro     |      3 |
 * | cac_blended                | 100 / 3                                    |  33,33 |
 * | net_profit                 | 840 − 240 − 26,20 − 20 − 310 − 100         | 143,80 |
 * | net_margin_pct             | 143,80 / 840 × 100                         |  17,12 |
 * | break_even_monthly_revenue | 304,40 / ((840−240−26,20−20)/840)          | 461,71 |
 * | aov_ex_tax                 | 840 / 4                                    | 210,00 |
 * | contribution_per_order     | (840 − 240 − 20 − 100) / 4                 | 120,00 |
 * | breakeven_cac_per_order    | (840−240−26,20−20−310) / 4                 |  60,95 |
 * | mbee                       | 60,95 − 25 de CAC real                     |  35,95 |
 * | breakeven_roas             | 840 / 243,80                               |   3,45 |
 *
 * El beneficio bajo de 403,80 a 143,80 exactamente por los dos terminos que
 * faltaban: 160 de IVA que nunca fue tuyo y 100 de publicidad que si pagaste.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.
 * Ejecutar con `npm run test:remote -w @ecomscaling/api` en un proyecto aislado.
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
      // Los hashes se repiten a proposito: A pide dos veces, B y C una. Asi
      // `new_customers` (3) no puede confundirse con `orders_count` (4) y el
      // test demuestra que el conteo sale del primer pedido de cada cliente.
      ["A", "A", "B", "C"].map((customer, index) => ({
        organization_id: orgId,
        store_id: storeId,
        external_order_id: `db03-golden-${RUN_TAG}-${index}`,
        order_name: `#DB03-${index}`,
        customer_reference_hash: `db03-golden-${RUN_TAG}-cliente-${customer}`,
        financial_status: "paid",
        currency_code: "EUR",
        gross_sales: 250,
        discounts: 0,
        refunds: 0,
        net_sales: 250,
        current_total_price: 250,
        current_total_tax: 40,
        current_shipping_price: 10,
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

  // Inversion publicitaria del periodo. Sin esto el termino de ads no se
  // ejercita y el golden no probaria el arreglo principal de F1.
  const { data: metaConnection, error: metaConnectionError } = await admin
    .from("integration_connections")
    .insert({
      organization_id: orgId,
      provider: "meta_ads",
      provider_account_id: `db03-golden-meta-${RUN_TAG}`,
      status: "connected",
    })
    .select("id")
    .single();
  if (metaConnectionError || !metaConnection)
    throw new Error(
      `No se pudo crear la conexion de Meta: ${metaConnectionError?.message}`,
    );

  // store_id apuntando a la tienda: la llamada del golden filtra por tienda, y
  // asi se comprueba de paso que el gasto respeta el alcance por tienda.
  const { data: adAccount, error: adAccountError } = await admin
    .from("meta_ad_accounts")
    .insert({
      organization_id: orgId,
      connection_id: metaConnection.id,
      store_id: storeId,
      external_ad_account_id: `db03-golden-adaccount-${RUN_TAG}`,
      account_name: `DB-03 Golden Ad Account ${RUN_TAG}`,
    })
    .select("id")
    .single();
  if (adAccountError || !adAccount)
    throw new Error(
      `No se pudo crear la cuenta publicitaria: ${adAccountError?.message}`,
    );

  const { error: insightError } = await admin
    .from("meta_insight_rows_daily")
    .insert({
      organization_id: orgId,
      ad_account_id: adAccount.id,
      level: "ad",
      external_entity_id: `db03-golden-ad-${RUN_TAG}`,
      metric_date: "2025-03-15",
      spend: 100,
      impressions: 1000,
      clicks: 50,
    });
  if (insightError)
    throw new Error(
      `No se pudo sembrar el gasto de Meta: ${insightError.message}`,
    );
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
  assert.equal(numeric(row.net_revenue_ex_tax), 840);
  assert.equal(numeric(row.tax_collected), 160);
  assert.equal(numeric(row.shipping_charged), 40);
  assert.equal(numeric(row.cogs), 240);
  assert.equal(numeric(row.gross_margin), 600);
  assert.equal(numeric(row.payment_fees), 26.2);
  assert.equal(numeric(row.shipping_costs), 20);
  assert.equal(numeric(row.shipping_net), 20);
  assert.equal(row.uses_shipping_rules, false);
  // 304,40 × 31 / 30,44: el prorrateo es por dias reales del periodo sobre un
  // mes medio de 30,44 dias, no por mes natural.
  assert.equal(numeric(row.fixed_costs), 310);
  assert.equal(numeric(row.ads_spend), 100);
  assert.equal(numeric(row.new_customers), 3);
  assert.equal(numeric(row.cac_blended), 33.33);
  assert.equal(numeric(row.net_profit), 143.8);
  assert.equal(numeric(row.net_margin_pct), 17.12);
  assert.equal(numeric(row.monthly_fixed_costs), 304.4);
  assert.equal(numeric(row.break_even_monthly_revenue), 461.71);
  assert.equal(row.has_settings, true);
  assert.equal(numeric(row.fixed_expenses_count), 1);
  assert.equal(numeric(row.items_without_cost), 0);
});

test("unit economics por pedido, MBEE y ROAS de break-even", async () => {
  const { data } = await admin.rpc("shopify_financial_summary", {
    target_organization_id: orgId,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    target_store_id: storeId,
  });
  const row = data?.[0];
  assert.ok(row, "la funcion deberia devolver una fila");

  assert.equal(numeric(row.aov_ex_tax), 210);
  assert.equal(numeric(row.cogs_per_order), 60);
  assert.equal(numeric(row.shipping_per_order), 5);
  assert.equal(numeric(row.payment_fee_per_order), 6.55);
  assert.equal(numeric(row.fixed_per_order), 77.5);
  assert.equal(numeric(row.fixed_pct_revenue), 36.9);
  assert.equal(numeric(row.cac_per_order), 25);
  assert.equal(numeric(row.contribution_per_order), 120);

  // Los tres numeros de la banda de ads comparten techo: el CAC de break-even
  // es lo maximo que puedes pagar por pedido sin perder dinero; el MBEE es lo
  // que te sobra frente a el, y el ROAS de break-even es su traduccion a ROAS.
  assert.equal(numeric(row.breakeven_cac_per_order), 60.95);
  assert.equal(
    numeric(row.mbee),
    numeric(row.breakeven_cac_per_order) - numeric(row.cac_per_order),
  );
  assert.equal(numeric(row.mbee), 35.95);
  assert.equal(numeric(row.breakeven_roas), 3.45);
});

test("el IVA sale del pedido, no de vat_pct", async () => {
  // vat_pct esta sembrado al 21% y sigue sin usarse: el impuesto real viene
  // por pedido en current_total_tax (40 de 250, o sea el 16%). Si alguien
  // "arreglara" esto aplicando vat_pct, el ingreso sin IVA seria 1000/1,21 =
  // 826,45 en vez de 840. Este test lo impide.
  const { data } = await admin.rpc("shopify_financial_summary", {
    target_organization_id: orgId,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    target_store_id: storeId,
  });

  assert.equal(numeric(data?.[0]?.net_revenue_ex_tax), 840);
  assert.notEqual(numeric(data?.[0]?.net_revenue_ex_tax), 826.45);
});

test("la serie mensual no puede contradecir al KPI del periodo", async () => {
  // F2: `shopify_financial_monthly` llama a `shopify_financial_summary` mes a
  // mes en vez de reimplementar la formula. Este test es la razon de ser de esa
  // decision: el mes de los pedidos tiene que dar EXACTAMENTE el mismo
  // beneficio que la llamada directa al periodo, porque el grafico de barras y
  // la tarjeta de beneficio se ensenan juntos en la misma pantalla.
  //
  // El periodo golden es marzo de 2025 y `months_back` cuenta hacia atras desde
  // el mes en curso, asi que la distancia se calcula, no se escribe a mano: un
  // 19 literal dejaria de cubrir marzo el mes que viene.
  const orderMonth = new Date(ORDER_DATE);
  const now = new Date();
  const monthsBack =
    (now.getUTCFullYear() - orderMonth.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - orderMonth.getUTCMonth()) +
    1;

  const { data, error } = await admin.rpc("shopify_financial_monthly", {
    target_organization_id: orgId,
    months_back: monthsBack,
    target_store_id: storeId,
  });
  assert.equal(error, null, error?.message);
  assert.equal(data?.length, monthsBack, "una fila por mes pedido");

  const march = data?.find(
    (row: { bucket_month: string }) => row.bucket_month === "2025-03-01",
  );
  assert.ok(march, "marzo de 2025 deberia estar en la serie");
  assert.equal(numeric(march.orders_count), 4);
  assert.equal(numeric(march.net_revenue_ex_tax), 840);
  assert.equal(numeric(march.net_profit), 143.8);
  assert.equal(numeric(march.ads_spend), 100);
  assert.equal(numeric(march.new_customers), 3);

  // Los demas meses estan vacios, no ausentes: el grafico necesita la barra a
  // cero para que se vea el hueco.
  const total = (data ?? []).reduce(
    (acc: number, row: { orders_count: number }) => acc + numeric(row.orders_count),
    0,
  );
  assert.equal(total, 4, "ningun pedido se cuenta en dos meses a la vez");
});

// OJO: este test muta y luego borra el coste sembrado. Va despues de todos los
// que fijan el beneficio del escenario; el unico posterior mira envios, que no
// dependen del COGS. Cualquier test nuevo que dependa del coste va ANTES.
test("el coste manual manda; el de Shopify solo rellena el hueco", async () => {
  // F3b: hasta ahora `shopify_margin_summary` solo leia `product_costs`, y el
  // coste que el cliente pone en Shopify (que el sync ya guarda en
  // `shopify_inventory_items.current_unit_cost`) no llegaba nunca al margen. En
  // produccion eso eran 0 filas de coste y un margen del 77,84% inventado.
  const margin = async () => {
    const { data, error } = await admin.rpc("shopify_margin_summary", {
      target_organization_id: orgId,
      period_start: PERIOD_START,
      period_end: PERIOD_END,
      target_store_id: storeId,
    });
    assert.equal(error, null, error?.message);
    return data?.[0];
  };

  // 1. Con coste fechado distinto del de Shopify (60), manda el fechado.
  const { error: updateError } = await admin
    .from("product_costs")
    .update({ unit_cost: 50 })
    .eq("organization_id", orgId);
  assert.equal(updateError, null, updateError?.message);

  const conCosteManual = await margin();
  assert.equal(numeric(conCosteManual.cogs), 200, "4 lineas x 50, no x 60");
  assert.equal(
    numeric(conCosteManual.items_with_estimated_cost),
    0,
    "ninguna linea va por el respaldo: todas tienen coste fechado",
  );

  // 2. Sin fila fechada, entra el coste que Shopify reporta hoy (60) -- y la
  // salida lo declara como estimado, porque es el coste de HOY aplicado a un
  // pedido de marzo de 2025.
  const { error: deleteError } = await admin
    .from("product_costs")
    .delete()
    .eq("organization_id", orgId);
  assert.equal(deleteError, null, deleteError?.message);

  const conCosteDeShopify = await margin();
  assert.equal(
    numeric(conCosteDeShopify.cogs),
    240,
    "4 lineas x 60 desde current_unit_cost, no 0",
  );
  assert.equal(numeric(conCosteDeShopify.items_without_cost), 0);
  assert.equal(
    numeric(conCosteDeShopify.items_with_estimated_cost),
    4,
    "las 4 lineas van por el respaldo y hay que poder decirlo en pantalla",
  );
});

test("una shipping_cost_rule activa manda sobre default_shipping_cost", async () => {
  // Hasta F1, `shipping_cost_rules` era CRUD-able desde /configuracion y
  // ninguna funcion de metricas la leia: el envio siempre salia de
  // default_shipping_cost × pedidos. Ahora la regla que calza con el importe
  // del pedido gana, y el envio pasa de 5,00 a 7,00 por pedido.
  const { error: ruleError } = await admin.from("shipping_cost_rules").insert({
    organization_id: orgId,
    name: `DB-03 Golden Rule ${RUN_TAG}`,
    cost_per_order: 7,
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
    28,
    "4 pedidos × 7,00 de la regla, no × 5,00 del ajuste por defecto",
  );
  assert.equal(numeric(data?.[0]?.shipping_net), 12, "40 cobrado − 28 pagado");
  assert.equal(data?.[0]?.uses_shipping_rules, true);
});
