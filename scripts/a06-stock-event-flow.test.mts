import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadApiEnv } from "../packages/config/src/index.js";
import { createServiceClient } from "../apps/api/src/ai-runtime.js";
import { processA06StockEvent } from "../apps/api/src/a06-stock-events.js";
const env = loadApiEnv(process.env);
if (env.SUPABASE_URL.includes("cthjwpeygpzwdmjkxeqa"))
  throw new Error("Development only");
const db = createServiceClient(env),
  tag = randomUUID();
let orgId: string | null = null,
  calls = 0;
const checks: string[] = [];
async function insert(table: string, value: Record<string, unknown>) {
  const { data, error } = await db
    .from(table)
    .insert(value)
    .select("id")
    .single();
  if (error || !data) throw new Error(`${table}: ${error?.message}`);
  return String(data.id);
}
async function must(result: any) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
try {
  orgId = await insert("organizations", {
    display_name: `Test A06 events ${tag}`,
    slug: `a06-event-test-${tag}`,
    status: "active",
  });
  const connectionId = await insert("integration_connections", {
    organization_id: orgId,
    provider: "shopify",
    status: "connected",
  });
  const storeId = await insert("shopify_stores", {
    organization_id: orgId,
    connection_id: connectionId,
    external_shop_id: tag,
    myshopify_domain: `a06-${tag}.myshopify.com`,
    shop_name: "Test A06 events",
    currency_code: "EUR",
  });
  const locationId = await insert("shopify_locations", {
    organization_id: orgId,
    store_id: storeId,
    external_location_id: tag,
    name: "Test location",
  });
  const productId = await insert("shopify_products", {
    organization_id: orgId,
    store_id: storeId,
    external_product_id: tag,
    title: "Test A06 product",
    status: "ACTIVE",
  });
  const variantId = await insert("shopify_variants", {
    organization_id: orgId,
    store_id: storeId,
    product_id: productId,
    external_variant_id: tag,
  });
  const inventoryId = await insert("shopify_inventory_items", {
    organization_id: orgId,
    store_id: storeId,
    variant_id: variantId,
    external_inventory_item_id: tag,
    tracked: true,
  });
  const levelId = await insert("shopify_inventory_current_state", {
    organization_id: orgId,
    inventory_item_id: inventoryId,
    location_id: locationId,
    available_quantity: 30,
    is_active: true,
  });
  for (let day = 1; day <= 4; day++) {
    const at = new Date(Date.now() - day * 86_400_000).toISOString();
    const orderId = await insert("shopify_order_facts", {
      organization_id: orgId,
      store_id: storeId,
      external_order_id: `${tag}-${day}`,
      currency_code: "EUR",
      financial_status: "paid",
      is_test_order: false,
      processed_at: at,
      external_created_at: at,
      gross_sales: 600,
      net_sales: 600,
      total_items: 30,
    });
    await insert("shopify_order_items", {
      organization_id: orgId,
      order_id: orderId,
      product_id: productId,
      variant_id: variantId,
      external_line_item_id: `${tag}-${day}`,
      title: "Test A06 product",
      quantity_original: 30,
      quantity_current: 30,
      unit_price: 20,
      original_line_total: 600,
      current_line_total: 600,
    });
  }
  await must(
    await db
      .from("a06_stock_event_settings")
      .insert({
        store_id: storeId,
        organization_id: orgId,
        mode: "shadow",
        daily_model_cap: 1,
      }),
  );
  const quantity = async (n: number) =>
    must(
      await db
        .from("shopify_inventory_current_state")
        .update({ available_quantity: n, updated_at: new Date().toISOString() })
        .eq("id", levelId),
    );
  const claim = async () => {
    await must(
      await db
        .from("a06_stock_event_queue")
        .update({ due_at: new Date(Date.now() - 60_000).toISOString() })
        .eq("store_id", storeId),
    );
    const jobs = await must(
      await db.rpc("claim_a06_stock_events", {
        batch_size: 1,
        target_store_id: storeId,
      }),
    );
    const job = jobs.find((item: any) => item.store_id === storeId);
    assert.ok(job);
    return job;
  };
  // Process the exact production policy/SQL path; the callback must never run in shadow.
  await quantity(20);
  await quantity(10);
  const shadow = await processA06StockEvent(
    env,
    db,
    await claim(),
    async () => {
      calls++;
      throw new Error("must_not_run_in_shadow");
    },
  );
  assert.equal(shadow.decision, "would_review");
  assert.equal(calls, 0);
  checks.push(
    "30→20→10 produce una revisión en observación sin llamar al modelo",
  );
  await quantity(4);
  await quantity(30);
  const restored = await processA06StockEvent(
    env,
    db,
    await claim(),
    async () => {
      calls++;
      throw new Error("must_not_run_when_restocked");
    },
  );
  assert.equal(restored.decision, "no_material_change");
  assert.equal(calls, 0);
  checks.push(
    "Una reposición antes de evaluar cancela el riesgo del evento anterior",
  );
  await must(
    await db
      .from("a06_stock_event_settings")
      .update({ mode: "live", cooldown_minutes: 1 })
      .eq("store_id", storeId),
  );
  await quantity(10);
  const live = await processA06StockEvent(
    { ...env, AI_AUTORUN_ENABLED: "true" },
    db,
    await claim(),
    async (event, beforeModel) => {
      await beforeModel();
      calls++;
      assert.equal(event.signals[0]?.reason, "coverage_crossed");
      assert.equal(event.observed_changes[0]?.available_quantity, 10);
      return { ok: true };
    },
  );
  assert.equal(live.decision, "completed");
  assert.equal(calls, 1);
  checks.push(
    "El modo real entrega el motivo y verifica reserva/configuración antes del adaptador de modelo (adaptador simulado)",
  );
  await must(
    await db
      .from("a06_stock_event_queue")
      .update({
        last_model_at: new Date(Date.now() - 2 * 60_000).toISOString(),
      })
      .eq("store_id", storeId),
  );
  await quantity(3);
  const limited = await processA06StockEvent(
    { ...env, AI_AUTORUN_ENABLED: "true" },
    db,
    await claim(),
    async () => {
      calls++;
      return { ok: true };
    },
  );
  assert.equal(limited.decision, "daily_cap");
  assert.equal(calls, 1);
  const deferred = await must(
    await db
      .from("a06_stock_event_queue")
      .select("revision, processed_revision, due_at")
      .eq("store_id", storeId)
      .single(),
  );
  assert.ok(deferred.revision > deferred.processed_revision);
  assert.ok(Date.parse(deferred.due_at) > Date.now());
  checks.push(
    "El cupo limita llamadas y conserva la señal pendiente para reintentar",
  );
  const { count } = await db
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  assert.equal(count, 0);
  checks.push("El piloto no crea tareas sin aprobación");
  console.log(
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        paid_api_calls: 0,
        simulated_model_callbacks: calls,
        cleanup: "fixture removed in finally",
      },
      null,
      2,
    ),
  );
} finally {
  if (orgId) {
    const { error } = await db.from("organizations").delete().eq("id", orgId);
    if (error) throw new Error(`test_fixture_cleanup_failed: ${error.message}`);
  }
}
