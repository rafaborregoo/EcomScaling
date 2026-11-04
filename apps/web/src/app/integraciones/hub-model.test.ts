import assert from "node:assert/strict";
import test from "node:test";
import type { IntegrationConnection } from "./shared";
import type { StoreView } from "./store-view-model";
import { buildFixQueue, isOldConnection, klaviyoReceivesStore, latestBlocks, oldConnectionLabel, permissionRows, runHistory } from "./hub-model";

function connection(partial: Partial<IntegrationConnection> & { id: string }): IntegrationConnection {
  return {
    provider_account_id: null,
    provider_account_name: null,
    status: "connected",
    scopes: [],
    api_version: null,
    connected_at: "2026-09-01T00:00:00Z",
    last_sync_at: null,
    last_error_message: null,
    latest_sync: null,
    health: { status: "healthy", lastSyncAt: null },
    activation: { ready: true, missing: [] },
    ...partial,
  };
}

function store(name: string, meta: IntegrationConnection[]): StoreView {
  const view = (provider: "shopify" | "meta_ads" | "klaviyo", connections: IntegrationConnection[]) => ({
    provider,
    name: provider,
    connections,
    status: connections[0]?.health.status ?? "unknown",
    explanation: { label: "", detail: null, fix: null },
    error: null,
    lastSyncAt: null,
    available: true,
    attempt: null,
    target: connections[0] ?? null,
  });
  return {
    connectionId: `${name}-shop`,
    storeId: name,
    name,
    domain: "",
    providers: [view("shopify", [connection({ id: `${name}-shop` })]), view("meta_ads", meta), view("klaviyo", [])],
    severity: 0,
    status: "healthy",
  };
}

test("la cola solo trae lo conectado y roto, lo más grave primero", () => {
  const queue = buildFixQueue(
    [
      store("B", [connection({ id: "m1", health: { status: "stale", reason: "sync_stale", lastSyncAt: null } })]),
      store("A", [connection({ id: "m2", health: { status: "reauthorization_required", reason: "authorization_revoked", lastSyncAt: null } })]),
    ],
    [],
  );
  assert.deepEqual(queue.map((item) => [item.store, item.severity, item.fix]), [
    ["A", "bad", "reconnect"],
    ["B", "warn", "retry"],
  ]);
});

test("Klaviyo recibe la tienda si alguna métrica viene de Shopify", () => {
  assert.equal(klaviyoReceivesStore(null), null);
  assert.equal(klaviyoReceivesStore([{ name: "Opened Email", integration: "Klaviyo" }]), false);
  assert.equal(klaviyoReceivesStore([{ name: "Started Checkout", integration: "Shopify" }]), true);
});

test("historial antiguo a la izquierda y un bloque por scope", () => {
  const runs = [
    { sync_type: "incremental", sync_scope: "orders", status: "failed", records_read: 0, records_written: 0, records_failed: 1, finished_at: null, error_message: "x" },
    { sync_type: "incremental", sync_scope: "catalog", status: "succeeded", records_read: 5, records_written: 5, records_failed: 0, finished_at: null, error_message: null },
    { sync_type: "incremental", sync_scope: "orders", status: "succeeded", records_read: 9, records_written: 9, records_failed: 0, finished_at: null, error_message: null },
  ];
  const conn = connection({ id: "s", recent_syncs: runs });
  assert.deepEqual(runHistory(conn), ["ok", "ok", "fail"]);
  assert.deepEqual(latestBlocks(conn).map((run) => [run.sync_scope, run.status]), [
    ["orders", "failed"],
    ["catalog", "succeeded"],
  ]);
});

test("permisos de Klaviyo dicen cuáles faltan", () => {
  const rows = permissionRows("klaviyo", ["metrics:read", "flows:read"]);
  assert.equal(rows.find((row) => row.scope === "flows:write")?.granted, false);
  assert.equal(rows.find((row) => row.scope === "metrics:read")?.granted, true);
});

test("son antiguas las retiradas y los intentos fallidos, no las que tienen un error con datos", () => {
  assert.equal(isOldConnection(connection({ id: "a", status: "pending_deletion" })), true);
  assert.equal(isOldConnection(connection({ id: "b", status: "disconnected" })), true);
  assert.equal(isOldConnection(connection({ id: "c", status: "error", connected_at: null, last_sync_at: null })), true);
  assert.equal(isOldConnection(connection({ id: "d", status: "error", last_sync_at: "2026-10-01T00:00:00Z" })), false);
  assert.equal(isOldConnection(connection({ id: "e", status: "connected" })), false);
});

test("un intento no enseña su pending:uuid como nombre", () => {
  const row = (account: string) => ({
    provider: "klaviyo",
    name: "Klaviyo",
    connection: connection({ id: "a", provider_account_id: account }),
  });
  assert.equal(oldConnectionLabel(row("pending:eebc8c76")), "Klaviyo");
  assert.equal(oldConnectionLabel(row("WjvTcC")), "WjvTcC");
});
