import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { classifyFulfillmentEventReason } from "./shopify-sync.js";

test("A22 classifies only explicit delivery event evidence and returns no source message", () => {
  assert.deepEqual(classifyFulfillmentEventReason("IN_TRANSIT", "Customs clearance hold"), {
    reason_code: "customs_hold",
    reason_confidence: 0.98,
  });
  assert.deepEqual(classifyFulfillmentEventReason("IN_TRANSIT", "Dirección incorrecta"), {
    reason_code: "address_issue",
    reason_confidence: 0.95,
  });
  assert.deepEqual(classifyFulfillmentEventReason("ATTEMPTED_DELIVERY", null), {
    reason_code: "delivery_attempt",
    reason_confidence: 0.99,
  });
  assert.deepEqual(classifyFulfillmentEventReason("IN_TRANSIT", "Package still in transit"), {
    reason_code: "unknown",
    reason_confidence: 0,
  });
});

test("A22 persists normalized reason schema, not raw carrier text or location PII", () => {
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20261115730000_a22_fulfillment_events_routes.sql", import.meta.url),
    "utf8",
  );
  const table = migration.split("create table if not exists public.shopify_fulfillment_events")[1]?.split("create index")[0] ?? "";
  assert.match(table, /reason_code/);
  assert.match(table, /reason_confidence/);
  assert.doesNotMatch(table, /message|address1|city|province|zip|latitude|longitude/i);
  assert.match(migration, /shipping_country_code/);
  assert.match(migration, /shipping_region_code/);
  assert.match(migration, /event_coverage_pct/);
  assert.match(migration, /sample_reliable/);
});

test("A22 selects only due events in SQL so complete rows cannot starve later fulfillments", () => {
  const claimMigration = readFileSync(
    new URL("../../../supabase/migrations/20261115740000_a22_fulfillment_event_claims.sql", import.meta.url),
    "utf8",
  );
  const source = readFileSync(new URL("./shopify-sync.ts", import.meta.url), "utf8");
  assert.match(claimMigration, /shopify_fulfillment_event_candidates/);
  assert.match(claimMigration, /s\.status = 'partial'/);
  assert.match(claimMigration, /s\.last_attempt_at <= now\(\) - interval '30 minutes'/);
  assert.match(claimMigration, /f\.delivered_at is null/);
  assert.match(claimMigration, /order by s\.last_attempt_at asc nulls first/);
  assert.match(source, /\.rpc\(\s*"shopify_fulfillment_event_candidates"/);
  assert.doesNotMatch(source, /\.from\("shopify_fulfillments"\)[\s\S]{0,300}\.limit\(300\)/);
});

test("A22 opens deduplicated exceptions and preserves them through partial event reads", () => {
  const lifecycle = readFileSync(
    new URL("../../../supabase/migrations/20261115750000_a22_delivery_exception_lifecycle.sql", import.meta.url),
    "utf8",
  );
  const source = readFileSync(new URL("./shopify-sync.ts", import.meta.url), "utf8");
  assert.match(lifecycle, /shopify_delivery_exceptions_open_once_idx/);
  assert.match(lifecycle, /shopify_fulfillment_event_sync_state/);
  assert.match(lifecycle, /v_event_sync_status = 'complete'/);
  assert.match(lifecycle, /v_delivered_at is not null/);
  assert.match(lifecycle, /only delivery is\s+-- treated as a reliable resolution/i);
  assert.match(lifecycle, /shopify_open_delivery_exceptions/);
  assert.doesNotMatch(lifecycle, /create table if not exists public\.shopify_delivery_exceptions \([\s\S]{0,900}(message|address1|tracking_number|email)/i);
  assert.match(source, /rpc\(\s*"refresh_shopify_delivery_exception"/);
});

test("A22 exception/event evidence grants members read-only database access", () => {
  const permissions = readFileSync(
    new URL("../../../supabase/migrations/20261115760000_a22_delivery_evidence_permissions.sql", import.meta.url),
    "utf8",
  );
  assert.match(permissions, /revoke all on table[\s\S]*from public, anon, authenticated/i);
  assert.match(permissions, /grant select on table[\s\S]*to authenticated/i);
  assert.match(permissions, /grant all on table[\s\S]*to service_role/i);
});

test("A22 Shopify insights reads a bounded, tenant/store-scoped queue and exposes safe action context", () => {
  const api = readFileSync(new URL("./shopify-insights.ts", import.meta.url), "utf8");
  const ui = readFileSync(
    new URL("../../web/src/app/shopify/insights-sections.tsx", import.meta.url),
    "utf8",
  );

  assert.match(api, /from\("shopify_delivery_exceptions"\)[\s\S]{0,320}\.eq\("organization_id", organizationId\)[\s\S]{0,150}\.eq\("status", "open"\)[\s\S]{0,150}\.limit\(50\)/);
  assert.match(api, /fulfillmentsQuery = fulfillmentsQuery\.eq\("store_id", storeId\)/);
  assert.match(api, /ordersQuery = ordersQuery\.eq\("store_id", storeId\)/);
  assert.match(api, /select\("id, order_name"\)/);
  assert.match(api, /shopify_connection_not_found/);
  assert.match(ui, /No hay incidencias abiertas en los envíos sincronizados/);
  assert.match(ui, /No equivale a que no haya envíos afectados/);
  assert.match(ui, /DELIVERY_NEXT_ACTIONS/);
  assert.doesNotMatch(api, /select\([^\n]*(?:email|phone|address|tracking_numbers)/i);
});
