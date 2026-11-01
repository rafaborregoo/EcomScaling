// Disposable TEST-only order, used to verify an already open dashboard without reloading it.
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { invalidateIntegrationData } from "../apps/api/dist/src/integration-data-cache.js";

const env = loadApiEnv(process.env);
if (!env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh")) throw new Error("TEST environment required");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const statePath = "tmp/integrations-implementation/live-verification.json";
if (process.argv[2] === "cleanup") {
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  for (const result of [
    await db.from("shopify_order_facts").delete().eq("organization_id", state.organizationId).eq("external_order_id", state.orderGid),
    await db.schema("private").from("webhook_events").delete().eq("connection_id", state.connectionId).eq("external_event_id", state.eventId),
  ]) if (result.error) throw result.error;
  await invalidateIntegrationData(env.REDIS_URL, state.organizationId);
  const receipt = await db.from("integration_changes").update({ changed_at: new Date().toISOString() }).eq("connection_id", state.connectionId);
  if (receipt.error) throw receipt.error;
  writeFileSync(statePath, JSON.stringify({ ...state, cleaned: true }, null, 2));
  console.log(JSON.stringify({ cleaned: true }));
} else {
  if (existsSync(statePath) && !JSON.parse(readFileSync(statePath, "utf8")).cleaned) throw new Error("Clean up the previous verification first");
  const connectionId = process.argv[2];
  const connection = await db.from("integration_connections").select("organization_id,provider_account_id").eq("id", connectionId).eq("provider", "shopify").single();
  if (connection.error) throw connection.error;
  const now = new Date().toISOString();
  const id = Date.now() * 10;
  const eventId = `live-verification-${randomUUID()}`;
  const state = { organizationId: connection.data.organization_id, connectionId, orderGid: `gid://shopify/Order/${id}`, eventId, cleaned: false };
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  const body = JSON.stringify({ id, name: "#LIVE-VERIFICATION", tags: "e-nora-disposable-verification", test: false,
    created_at: now, processed_at: now, updated_at: now, currency: "EUR", financial_status: "paid", subtotal_price: "0.01", total_price: "0.01", total_tax: "0", total_discounts: "0",
    line_items: [{ id: id + 1, title: "Disposable live-update verification", quantity: 1, current_quantity: 1, price: "0.01", total_discount: "0" }] });
  const started = Date.now();
  const response = await fetch("http://127.0.0.1:4000/v1/shopify/webhooks", { method: "POST", headers: {
    "content-type": "application/json", "x-shopify-shop-domain": connection.data.provider_account_id, "x-shopify-topic": "orders/create", "x-shopify-webhook-id": eventId,
    "x-shopify-hmac-sha256": createHmac("sha256", env.SHOPIFY_API_SECRET).update(body).digest("base64"),
  }, body });
  if (!response.ok) throw new Error(`delivery failed: ${response.status}`);
  const ackMs = Date.now() - started;
  for (let attempt = 0; attempt < 60; attempt++) {
    const event = await db.schema("private").from("webhook_events").select("status,error_message").eq("external_event_id", eventId).single();
    if (event.error) throw event.error;
    if (event.data.status === "processed") { console.log(JSON.stringify({ acknowledged_ms: ackMs, applied_ms: Date.now() - started, eventId })); break; }
    if (attempt === 59) throw new Error(`worker timeout: ${event.data.error_message}`);
    await setTimeout(500);
  }
}
process.exit(0);
