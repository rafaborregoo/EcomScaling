import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { compactMetaMeasurementContext, loadMetaMeasurementPages, metaMeasurementEvidenceDetails } from "./meta-measurement-evidence.js";

const window = { target_organization_id: "org-a", target_store_id: "store-a", period_start: "2026-10-01", period_end: "2026-10-20" };
test("A24 collects all mapping pages and preserves the scope on each request", async () => {
  const requests: Record<string, unknown>[] = [];
  const rows = Array.from({ length: 201 }, (_, i) => ({ ad_set_id: String(i).padStart(4, "0"), eligible_ad_set_count: 201, ad_set_rows_truncated: true }));
  const client = { rpc: async (_name: string, args: Record<string, unknown>) => {
    requests.push(args);
    const start = args.after_ad_set_id ? rows.findIndex((row) => row.ad_set_id === args.after_ad_set_id) + 1 : 0;
    return { data: rows.slice(start, start + 100), error: null };
  } } as unknown as SupabaseClient;
  const result = await loadMetaMeasurementPages(client, window, "events");
  assert.equal(result.complete, true);
  assert.equal(result.data.length, 201);
  assert.ok(result.data.every((row) => row.ad_set_rows_truncated === false));
  assert.equal(requests.length, 3);
  assert.ok(requests.every((args) => args.target_store_id === "store-a" && args.target_organization_id === "org-a"));
});

test("A24 detects changed totals and duplicate identities instead of declaring full coverage", async () => {
  for (const rows of [
    [{ ad_set_id: "a", eligible_ad_set_count: 2 }],
    [{ ad_set_id: "a", eligible_ad_set_count: 2 }, { ad_set_id: "a", eligible_ad_set_count: 2 }],
  ]) {
    const client = { rpc: async () => ({ data: rows, error: null }) } as unknown as SupabaseClient;
    const result = await loadMetaMeasurementPages(client, window, "events");
    assert.equal(result.complete, false);
    assert.ok(result.error);
  }
});

test("A24 compacts repeated Shopify totals and exposes the continuation cursor", () => {
  const rows = Array.from({ length: 3 }, (_, i) => ({ ad_set_id: String(i), store_orders_total: 12, store_sessions_total: 100, orders_sync_state: "fresh" }));
  const context = compactMetaMeasurementContext(rows, true, 2);
  assert.equal(context.store_activity?.store_orders_total, 12);
  assert.equal(context.entities.length, 2);
  assert.ok(context.entities.every((row) => !("store_orders_total" in row)));
  assert.equal(context.next_ad_set_id, "1");
  assert.equal(context.coverage.presentation_truncated, true);
});

test("A24 shares observed coverage with the measurement engine and never certifies CAPI", () => {
  const source = (rows: Array<Record<string, unknown>> = []) => ({ available: true, rows });
  const detail = metaMeasurementEvidenceDetails({
    pixels: source(), learning: source(), issues: source(),
    eventMapping: source([{ mapping_status: "mapped_event_observed", orders_sync_state: "fresh", store_orders_total: 12, sessions_sync_state: "stale", store_sessions_total: 500 }]),
  });
  assert.equal(detail.measurement_engine.facts["measurement.orders.observed"], "TRUE");
  assert.notEqual(detail.measurement_engine.facts["measurement.sessions.observed"], "TRUE");
  assert.equal(detail.measurement_engine.quality_state, "UNKNOWN");
  assert.equal(detail.capability_matrix.find((row) => row.capability === "event_deduplication")?.state, "requires_external_verification");
});
