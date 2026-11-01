import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";

const env = loadApiEnv(process.env);
if (!env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh")) throw new Error("This verification is restricted to the E-NORA TEST project");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const tag = randomUUID();
const domain = `delivery-test-${tag}.myshopify.com`;
const base = process.env.DELIVERY_TEST_BASE_URL ?? "http://127.0.0.1:4000";
let organizationId = "";
let connectionId = "";

before(async () => {
  const org = await db.from("organizations").insert({ display_name: `Integration delivery test ${tag}`, slug: `delivery-${tag}`, status: "active" }).select("id").single();
  assert.equal(org.error, null);
  organizationId = org.data!.id;
  const connection = await db.from("integration_connections").insert({ organization_id: organizationId, provider: "shopify", provider_account_id: domain, status: "connected" }).select("id").single();
  assert.equal(connection.error, null);
  connectionId = connection.data!.id;
});
after(async () => {
  if (organizationId) {
    const result = await db.from("organizations").delete().eq("id", organizationId);
    assert.equal(result.error, null);
  }
});

async function send(payload: Record<string, unknown>, eventId: string, valid = true) {
  const body = JSON.stringify(payload);
  return fetch(`${base}/v1/shopify/webhooks`, { method: "POST", headers: {
    "content-type": "application/json", "x-shopify-shop-domain": domain,
    "x-shopify-topic": "orders/updated", "x-shopify-webhook-id": eventId,
    "x-shopify-hmac-sha256": createHmac("sha256", valid ? env.SHOPIFY_API_SECRET : "invalid-test-secret").update(body).digest("base64"),
  }, body, signal: AbortSignal.timeout(15_000) });
}
const payload = { id: 999900000001, name: "#DELIVERY-TEST", test: true,
  created_at: "2026-10-26T10:00:00Z", updated_at: "2026-10-26T11:00:00Z", currency: "EUR",
  financial_status: "paid", total_price: "99.00", subtotal_price: "99.00", total_discounts: "0.00", total_tax: "0.00",
  line_items: [{ id: 999900000002, title: "Integration verification", quantity: 1, current_quantity: 1, price: "99.00", total_discount: "0.00" }],
};
async function until<T>(read: () => Promise<T>, ready: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 35_000;
  while (true) {
    const value = await read();
    if (ready(value)) return value;
    if (Date.now() > deadline) throw new Error(`delivery verification timed out: ${JSON.stringify(value)}`);
    await setTimeout(500);
  }
}

test("rejects invalid signatures and retries initialization instead of dropping the order", async () => {
  assert.equal((await send(payload, `${tag}-invalid`, false)).status, 401);
  assert.equal((await send(payload, `${tag}-initializing`)).status, 503);
  const store = await db.from("shopify_stores").insert({ organization_id: organizationId, connection_id: connectionId, external_shop_id: tag, myshopify_domain: domain, shop_name: "Disposable delivery verification" });
  assert.equal(store.error, null);
});

test("signed HTTP delivery survives duplicate requests and is applied by the real worker", async () => {
  const startedAt = Date.now();
  const first = await send(payload, `${tag}-order`);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).status, "queued");
  assert.ok(Date.now() - startedAt < 5000, "provider acknowledgement exceeded its five-second deadline");
  assert.equal((await (await send(payload, `${tag}-order`)).json()).status, "duplicate");
  const event = await until(async () => {
    const result = await db.schema("private").from("webhook_events").select("status,error_message").eq("connection_id", connectionId).eq("external_event_id", `${tag}-order`).single();
    assert.equal(result.error, null);
    return result.data!;
  }, (row) => row.status === "processed");
  assert.equal(event.error_message, null);
  const order = await db.from("shopify_order_facts").select("id,external_updated_at").eq("organization_id", organizationId).single();
  assert.equal(order.error, null);
  const lines = await db.from("shopify_order_items").select("id").eq("order_id", order.data!.id);
  assert.equal(lines.error, null);
  assert.equal(lines.data!.length, 1);
  const receipt = await db.from("integration_changes").select("revision").eq("connection_id", connectionId).single();
  assert.equal(receipt.error, null);
  assert.ok(receipt.data!.revision > 1);
});

test("a delayed old event cannot overwrite the newer order or add an old line", async () => {
  const response = await send({ ...payload, updated_at: "2026-10-26T10:00:00Z", line_items: [{ id: 999900000003, title: "Stale line", quantity: 9, price: "1.00" }] }, `${tag}-old`);
  assert.equal(response.status, 200);
  await until(async () => (await db.schema("private").from("webhook_events").select("status").eq("connection_id", connectionId).eq("external_event_id", `${tag}-old`).single()).data?.status, (status) => status === "processed");
  const order = await db.from("shopify_order_facts").select("id,external_updated_at").eq("organization_id", organizationId).single();
  assert.equal(Date.parse(order.data!.external_updated_at), Date.parse(payload.updated_at));
  const lines = await db.from("shopify_order_items").select("title").eq("order_id", order.data!.id);
  assert.deepEqual(lines.data?.map((line) => line.title), ["Integration verification"]);
});
