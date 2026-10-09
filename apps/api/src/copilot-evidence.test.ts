import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CopilotEvidenceReference } from "@e-nora/contracts";
import { resolveCopilotEvidenceReference } from "./copilot-evidence.js";

const reference: CopilotEvidenceReference = {
  kind: "chart_point",
  source: "meta",
  route: "/meta",
  section: "ROAS diario",
  connection_id: null,
  entity: null,
  metric: { key: "meta_roas", date: "2026-10-07" },
  period: { start: "2026-10-01", end: "2026-10-08" },
  period_label: "Últimos 7 días",
  filters: {},
};

function fakeSupabase(observedRows: number): SupabaseClient {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert.equal(name, "meta_performance_daily");
      assert.equal(args.target_organization_id, "tenant-a");
      assert.equal(args.target_store_id, null);
      return { data: [{ bucket_date: "2026-10-07", spend: 100, roas: 2.5 }], error: null };
    },
    from: (table: string) => {
      if (table === "meta_ad_accounts") {
        const query = {
          select: () => query,
          eq: () => query,
          then: (resolve: (value: unknown) => void) => resolve({ data: [{ currency_code: "EUR", raw_data: {} }], error: null }),
        };
        return query;
      }
      assert.equal(table, "meta_insight_rows_daily");
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        then: (resolve: (value: unknown) => void) => resolve({ count: observedRows, error: null }),
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

test("resolves a chart point from tenant-scoped Meta data", async () => {
  const block = await resolveCopilotEvidenceReference({
    env: {} as never,
    supabase: fakeSupabase(3),
    context: {} as never,
    organizationId: "tenant-a",
    storeId: null,
    reference,
  });
  const data = block.data as Record<string, unknown>;
  assert.equal(data.status, "available");
  assert.equal(data.value, 2.5);
  assert.equal(data.source, "meta_performance_daily");
});

test("a generated zero with no source rows is reported as missing data", async () => {
  const block = await resolveCopilotEvidenceReference({
    env: {} as never,
    supabase: fakeSupabase(0),
    context: {} as never,
    organizationId: "tenant-a",
    storeId: null,
    reference,
  });
  const data = block.data as Record<string, unknown>;
  assert.equal(data.status, "no_data");
  assert.equal(data.value, null);
  assert.deepEqual((data.neighboring_days as Array<Record<string, unknown>>)[0]?.status, "no_data");
});

test("a mismatched route cannot trigger a provider query", async () => {
  const block = await resolveCopilotEvidenceReference({
    env: {} as never,
    supabase: { rpc: () => { throw new Error("unexpected query"); } } as unknown as SupabaseClient,
    context: {} as never,
    organizationId: "tenant-a", storeId: null,
    reference: { ...reference, route: "/shopify" },
  });
  assert.equal((block.data as Record<string, unknown>).status, "unavailable");
});
