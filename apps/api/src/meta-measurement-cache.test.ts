import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAgentTools } from "./ai-runtime.js";
import { loadMetaMeasurementVerdict } from "./meta-measurement-cache.js";
import { META_MEASUREMENT_VERDICT_VERSION } from "./meta-measurement-verdict.js";

const org = "00000000-0000-4000-8000-000000000001";
const store = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-11-01T12:30:00Z");
const start = new Date("2026-10-02T00:00:00Z");
const end = new Date("2026-10-31T23:59:59.999Z");

function cachedVerdict() {
  return {
    verdict_version: META_MEASUREMENT_VERDICT_VERSION,
    verdict_status: "restricted",
    source_fingerprint: "a".repeat(64),
    evaluated_at: "2026-11-01T12:00:00Z",
    expires_at: "2026-11-01T13:00:00Z",
    verdict: {
      status: "restricted",
      scope: { organization_id: org, store_id: store, account_ids: ["account-b", "account-a"] },
      window: { start: "2026-10-02", end: "2026-10-31", timezone: "UTC", complete_days: true },
    },
  };
}

function fakeClient(options: {
  cache?: unknown;
  accounts?: Array<{ id: string; connection_id?: string | null; last_synced_at?: string | null }>;
  connections?: Array<{ id: string; provider: string; status: string; last_sync_at: string | null; last_error_at: string | null }>;
  cacheError?: boolean;
  accountError?: boolean;
  connectionError?: boolean;
  rpcError?: boolean;
} = {}) {
  const filters: Array<{ table: string; key: string; value: unknown }> = [];
  const rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { filters.push({ table, key, value }); return query; },
        in(key: string, value: unknown) { filters.push({ table, key, value }); return query; },
        gt(key: string, value: unknown) { filters.push({ table, key: `gt:${key}`, value }); return query; },
        lte(key: string, value: unknown) { filters.push({ table, key: `lte:${key}`, value }); return query; },
        async maybeSingle() { return { data: options.cache ?? null, error: options.cacheError ? { message: "unavailable" } : null }; },
        async order() {
          if (table === "integration_connections") return {
            data: options.connections ?? [{ id: "connection-a", provider: "meta_ads", status: "connected", last_sync_at: "2026-11-01T11:59:00Z", last_error_at: null }],
            error: options.connectionError ? { message: "unavailable" } : null,
          };
          return { data: options.accounts ?? ["account-a", "account-b"].map((id) => ({ id, connection_id: "connection-a", last_synced_at: "2026-11-01T11:59:00Z" })), error: options.accountError ? { message: "unavailable" } : null };
        },
        async insert() { return { error: null }; },
      };
      return query;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcs.push({ name, args });
      return { data: options.rpcError ? null : [], error: options.rpcError ? { message: "unavailable" } : null };
    },
  };
  return { client: client as unknown as SupabaseClient, filters, rpcs };
}

test("the shared A24 gate preserves its status and binds tenant, store, dates and version", async () => {
  const { client, filters } = fakeClient({ cache: cachedVerdict() });
  const result = await loadMetaMeasurementVerdict(client, org, store, start, end, now);
  assert.equal(result.status, "restricted");
  assert.ok("provenance" in result);
  for (const table of ["meta_measurement_verdict_cache", "meta_ad_accounts"]) {
    assert.ok(filters.some((f) => f.table === table && f.key === "organization_id" && f.value === org));
    assert.ok(filters.some((f) => f.table === table && f.key === "store_id" && f.value === store));
  }
  assert.ok(filters.some((f) => f.key === "verdict_version" && f.value === META_MEASUREMENT_VERDICT_VERSION));
  assert.ok(filters.some((f) => f.key === "period_start" && f.value === "2026-10-02"));
  assert.ok(filters.some((f) => f.key === "period_end" && f.value === "2026-10-31"));
  for (const status of ["usable_with_attribution_limits", "restricted", "not_assessable", "unknown"]) {
    const cache = cachedVerdict();
    cache.verdict_status = status;
    cache.verdict.status = status;
    const selected = fakeClient({ cache });
    assert.equal((await loadMetaMeasurementVerdict(selected.client, org, store, start, end, now)).status, status);
  }
});

test("the shared A24 gate rejects expired, future, malformed and incompatible cache records", async (t) => {
  const cases = [
    { expires_at: now.toISOString() },
    { evaluated_at: "2026-11-01T12:40:00Z" },
    { expires_at: "2026-11-01T14:00:00Z" },
    { expires_at: "2026-11-01T11:00:00Z" },
    { evaluated_at: "invalid-date" },
    { expires_at: "invalid-date" },
    { source_fingerprint: "unverified" },
    { verdict_version: "a24-measurement-v4" },
    { verdict: [] },
  ];
  for (const [index, patch] of cases.entries()) {
    await t.test(String(index), async () => {
      const { client } = fakeClient({ cache: { ...cachedVerdict(), ...patch } });
      assert.equal((await loadMetaMeasurementVerdict(client, org, store, start, end, now)).status, "unknown");
    });
  }
});

test("the shared A24 gate rejects another organization, store, window or account selection", async (t) => {
  const base = cachedVerdict();
  const cases = [
    { scope: { ...base.verdict.scope, organization_id: "other-org" } },
    { scope: { ...base.verdict.scope, store_id: "other-store" } },
    { scope: { ...base.verdict.scope, account_ids: ["other-account"] } },
    { scope: { ...base.verdict.scope, account_ids: ["account-a", "account-a"] } },
    { scope: { ...base.verdict.scope, account_ids: ["account-a", 1] } },
    { window: { ...base.verdict.window, end: "2026-11-01" } },
    { window: { ...base.verdict.window, timezone: "Europe/Madrid" } },
    { window: { ...base.verdict.window, complete_days: false } },
    { status: "usable_with_attribution_limits" },
  ];
  for (const [index, patch] of cases.entries()) {
    await t.test(String(index), async () => {
      const { client } = fakeClient({ cache: { ...base, verdict: { ...base.verdict, ...patch } } });
      const result = await loadMetaMeasurementVerdict(client, org, store, start, end, now);
      assert.equal(result.status, "unknown");
      assert.ok("reason_codes" in result);
      assert.deepEqual(result.reason_codes, ["scope_or_payload_changed"]);
    });
  }
});

test("the shared gate stays unknown for missing data, read failures and empty selected accounts", async () => {
  for (const options of [{}, { cache: cachedVerdict(), cacheError: true }, { cache: cachedVerdict(), accountError: true }, { cache: cachedVerdict(), accounts: [] }]) {
    const { client } = fakeClient(options);
    assert.equal((await loadMetaMeasurementVerdict(client, org, store, start, end, now)).status, "unknown");
  }
  const { client, filters } = fakeClient({ cache: cachedVerdict() });
  assert.equal((await loadMetaMeasurementVerdict(client, org, null, start, end, now)).status, "unknown");
  assert.equal((await loadMetaMeasurementVerdict(client, org, store, end, start, now)).status, "unknown");
  assert.equal((await loadMetaMeasurementVerdict(client, org, store, new Date(NaN), end, now)).status, "unknown");
  assert.equal(filters.length, 0);
});

test("A09 receives the same scoped gate on complete UTC days even if detail rows are empty", async () => {
  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const first = new Date(utcToday - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const last = new Date(utcToday - 1).toISOString().slice(0, 10);
  const cache = cachedVerdict();
  cache.evaluated_at = new Date(today.getTime() - 1000).toISOString();
  cache.expires_at = new Date(today.getTime() + 60_000).toISOString();
  cache.verdict.window = { start: first, end: last, timezone: "UTC", complete_days: true };
  const sourceTime = new Date(today.getTime() - 2000).toISOString();
  const { client, rpcs } = fakeClient({ cache,
    accounts: ["account-a", "account-b"].map((id) => ({ id, connection_id: "connection-a", last_synced_at: sourceTime })),
    connections: [{ id: "connection-a", provider: "meta_ads", status: "connected", last_sync_at: sourceTime, last_error_at: null }],
  });
  const { tools } = buildAgentTools({} as never, client, org, org, ["meta_delivery_health"], "", store, ["meta"], ["client_visible"], { actorUserId: org, approvalMode: "required_before_publish" });
  const tool = tools.find((entry) => entry.name === "meta_delivery_health");
  assert.ok(tool);
  const output = await tool.execute({}) as { data: { measurement_verdict: { status: string }; window: { start: string; end: string } } };
  assert.equal(output.data.measurement_verdict.status, "restricted");
  assert.deepEqual([output.data.window.start, output.data.window.end], [first, last]);
  assert.ok(rpcs.every((rpc) => rpc.args.target_organization_id === org && rpc.args.target_store_id === store));
  assert.ok(rpcs.every((rpc) => rpc.args.period_start === first && rpc.args.period_end === last));
});

test("A09 cannot query Meta health without a selected store or convert failed reads into healthy data", async () => {
  const { client, rpcs } = fakeClient({ rpcError: true });
  const build = (storeId: string | null) => buildAgentTools({} as never, client, org, org, ["meta_delivery_health"], "", storeId, ["meta"], ["client_visible"], { actorUserId: org, approvalMode: "required_before_publish" });
  for (const storeId of [null, store]) {
    const tool = build(storeId).tools.find((entry) => entry.name === "meta_delivery_health");
    assert.ok(tool);
    const result = await tool.execute({});
    assert.match(JSON.stringify(result), /meta_delivery_health_unavailable/);
    assert.doesNotMatch(JSON.stringify(result), /usable_with_attribution_limits/);
    if (storeId === null) assert.equal(rpcs.length, 0);
  }
});

test("a cached gate is invalidated by newer syncs, revoked connections and missing source coverage", async () => {
  const connection = { id: "connection-a", provider: "meta_ads", status: "connected", last_sync_at: "2026-11-01T11:59:00Z", last_error_at: null as string | null };
  const cases = [
    { connectionError: true },
    { connections: [] },
    { connections: [{ ...connection, status: "revoked" }] },
    { connections: [{ ...connection, provider: "shopify" }] },
    { connections: [{ ...connection, status: "error" }] },
    { connections: [{ ...connection, last_sync_at: "2026-11-01T12:10:00Z" }] },
    { connections: [{ ...connection, last_sync_at: "2026-10-29T12:00:00Z" }] },
    { connections: [{ ...connection, last_error_at: "2026-11-01T12:10:00Z" }] },
    { connections: [{ ...connection, last_error_at: "invalid-date" }] },
    { accounts: ["account-a", "account-b"].map((id) => ({ id, connection_id: null, last_synced_at: "2026-11-01T11:59:00Z" })) },
    { accounts: ["account-a", "account-b"].map((id) => ({ id, connection_id: "connection-a", last_synced_at: "2026-11-01T12:10:00Z" })) },
  ];
  for (const options of cases) {
    const { client } = fakeClient({ cache: cachedVerdict(), ...options });
    const result = await loadMetaMeasurementVerdict(client, org, store, start, end, now);
    assert.equal(result.status, "unknown");
    assert.ok("reason_codes" in result);
    assert.deepEqual(result.reason_codes, ["sources_changed_or_unavailable"]);
  }
});
