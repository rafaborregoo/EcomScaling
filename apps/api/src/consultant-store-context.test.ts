import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import { getMetaMetrics } from "./meta-metrics.js";
import { getKlaviyoEmailReport } from "./klaviyo.js";
import { getDailyWorkbench } from "./consultant-workbench-api.js";

const env = { SUPABASE_URL: "https://audit.invalid", SUPABASE_PUBLISHABLE_KEY: "test-only", SUPABASE_SERVICE_ROLE_KEY: "test-only", INTEGRATION_FEATURE_FLAGS: "meta_ads,klaviyo" } as LoadedApiEnv;
const context: AuthContext = { user: { id: "consultant" }, profile: { id: "consultant", full_name: null, avatar_url: null, platform_role: "consultant", is_active: true }, memberships: [{ organization_id: "client", role: "manager", accessSource: "consultant_assignment", organization: null }], subscriptions: [] };

async function fixture(respond: (url: URL, body: Record<string, unknown>) => unknown) {
  const server = createServer(async (request, reply) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString("utf8");
      const value = respond(new URL(request.url ?? "/", "http://fixture"), body ? JSON.parse(body) : {});
      reply.setHeader("Content-Type", "application/json");
      reply.end(JSON.stringify(value));
    } catch (error) {
      reply.statusCode = 400;
      reply.end(JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { env: { ...env, SUPABASE_URL: `http://127.0.0.1:${address.port}` }, close: () => { server.closeAllConnections(); server.close(); } };
}

test("the consultant desk reads phases and milestones from the selected store's active plan", async (t) => {
  const planQueries: URL[] = [];
  const db = await fixture((url) => {
    const table = url.pathname.split("/").at(-1);
    if (table === "consultant_assignments") return [{ organization_id: "client", consultant_user_id: "consultant" }];
    if (table === "organizations") return [{ id: "client", display_name: "Client", slug: "client", status: "active", timezone: "UTC", currency_code: "EUR", kind: "client" }];
    if (table === "shopify_stores") return url.searchParams.get("select") === "id" ? { id: "store-b" } : [{ currency_code: "EUR" }];
    if (table === "strategic_plans") {
      planQueries.push(url);
      assert.equal(url.searchParams.get("store_id"), "eq.store-b");
      assert.equal(url.searchParams.get("status"), "eq.active");
      return [{ id: "plan-b", shopify_stores: { connection_id: "connection-b", shop_name: "Store B" } }];
    }
    if (table === "strategic_plan_phases") {
      assert.equal(url.searchParams.get("plan_id"), "eq.plan-b");
      return [{ id: "phase-b", name: "Phase B", status: "active", position: 1 }];
    }
    if (table === "strategic_plan_milestones" && url.searchParams.has("phase_id")) {
      assert.equal(url.searchParams.get("phase_id"), "in.(phase-b)");
      return [{ id: "milestone-b", phase_id: "phase-b", name: "Milestone B", status: "pending", target_date: "2026-11-01" }];
    }
    return [];
  });
  t.after(db.close);
  const result = await getDailyWorkbench(db.env, "Bearer test-only", context, { organizationId: "client", connectionId: "connection-b" });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(planQueries.length, 1);
  if (result.ok && "client" in result.data) {
    assert.equal(result.data.client.camino?.store_name, "Store B");
    assert.equal(result.data.client.camino?.phase_name, "Phase B");
    assert.equal(result.data.client.camino?.next_milestone?.id, "milestone-b");
  } else assert.fail("Missing client desk");
});

for (const provider of ["Meta", "Klaviyo"]) {
  const load = (testEnv: LoadedApiEnv, connectionId: string) => provider === "Meta"
    ? getMetaMetrics(testEnv, "Bearer test-only", context, "client", "30", connectionId)
    : getKlaviyoEmailReport(testEnv, context, "client", "30", connectionId);

  test(`${provider} denies a foreign client before reading its store`, async (t) => {
    let reads = 0;
    const db = await fixture(() => { reads++; return null; });
    t.after(db.close);
    const foreign = { ...context, memberships: [] };
    const result = provider === "Meta" ? await getMetaMetrics(db.env, "Bearer test-only", foreign, "client", "30", "connection-b") : await getKlaviyoEmailReport(db.env, foreign, "client", "30", "connection-b");
    assert.equal(result.ok, false);
    assert.equal(reads, 0);
  });

  test(`${provider} never broadens an unknown selected store to client totals`, async (t) => {
    let queries = 0;
    const db = await fixture((url) => {
      queries++;
      assert.ok(url.pathname.endsWith("/shopify_stores"));
      return null;
    });
    t.after(db.close);
    const result = await load(db.env, "missing-connection");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "store_scope_unavailable");
    assert.equal(queries, 1);
  });

  test(`${provider} preserves the selected store in every metrics RPC`, async (t) => {
    const requested: string[] = [];
    const db = await fixture((url, body) => {
      if (url.pathname.endsWith("/shopify_stores")) return { id: "store-b" };
      if (url.pathname.endsWith("/klaviyo_accounts")) {
        assert.equal(url.searchParams.get("store_id"), "eq.store-b");
        return [{ id: "account-b", currency_code: "EUR" }];
      }
      if (url.pathname.includes("/rpc/")) {
        assert.equal(body.target_store_id, "store-b");
        requested.push(url.pathname);
      }
      return [];
    });
    t.after(db.close);
    const result = await load(db.env, "connection-b");
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(requested.length >= 3);
  });
}
