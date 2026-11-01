import assert from "node:assert/strict";
import test, { after, before, type TestContext } from "node:test";
import { createServer } from "node:http";
import type { LoadedApiEnv } from "@e-nora/config";
import { type AccessSource, type AuthContext } from "./auth-context.js";
import { listMetaCreativeLibrary } from "./meta-creative-library.js";
import { getShopifyCatalogDiscount, getShopifyCatalogProduct, listShopifyCatalogDiscounts, listShopifyCatalogProducts, listShopifyInventory } from "./shopify-catalog.js";
import { approveAndApplyShopifyDiscountProposal, createShopifyDiscountProposal, listShopifyDiscountProposals } from "./shopify-discount-proposals.js";
import { getMarketingKlaviyoCampaignClicks, getMarketingKlaviyoTemplateHtml, getMarketingKlaviyoWorkspace } from "./marketing-klaviyo.js";

const org = "00000000-0000-4000-8000-000000000001";
const connection = "00000000-0000-4000-8000-000000000002";
const entity = "00000000-0000-4000-8000-000000000003";
const env = { SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_PUBLISHABLE_KEY: "fixture-public", SUPABASE_SERVICE_ROLE_KEY: "fixture-service" } as LoadedApiEnv;
let requests: URL[] = [];
let responder: (url: URL, init?: RequestInit) => unknown = () => [];
const server = createServer(async (request, reply) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const url = new URL(request.url ?? "/", env.SUPABASE_URL);
  requests.push(url);
  const payload = responder(url, { method: request.method ?? "GET", body: Buffer.concat(chunks).toString("utf8") });
  reply.setHeader("Content-Type", "application/json");
  if (payload instanceof Response) {
    reply.statusCode = payload.status;
    reply.end(await payload.text());
  } else reply.end(JSON.stringify(payload));
});
before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function context(role = "owner", accessSource: AccessSource = "membership"): AuthContext {
  return {
    user: { id: "user-1" },
    profile: { id: "user-1", full_name: null, avatar_url: null, platform_role: accessSource === "consultant_assignment" ? "consultant" : "user", is_active: true },
    memberships: [{ organization_id: org, role, accessSource, organization: { id: org, display_name: "Fixture", slug: "fixture", kind: "client", status: "active", timezone: "UTC", currency_code: "EUR" } }],
    subscriptions: [{ id: "sub-1", organization_id: org, plan_code: "fixture", status: "active", starts_at: null, ends_at: null }],
  };
}

function intercept(_t: TestContext, response: (url: URL, init?: RequestInit) => unknown = () => []) {
  requests = [];
  responder = response;
  return requests;
}

const draft = { connection_id: connection, idempotency_key: entity, code: "FIXTURE10", title: "Fixture", discount_type: "percentage", value: 10 };
type Result = { ok: boolean; statusCode?: number; error?: string };
const operations: Array<[string, (auth: AuthContext) => Promise<Result>]> = [
  ["products", (auth) => listShopifyCatalogProducts(env, "Bearer fixture", auth, org, {})],
  ["inventory", (auth) => listShopifyInventory(env, "Bearer fixture", auth, org, {})],
  ["discounts", (auth) => listShopifyCatalogDiscounts(env, "Bearer fixture", auth, org, {})],
  ["product detail", (auth) => getShopifyCatalogProduct(env, "Bearer fixture", auth, org, entity, {})],
  ["discount detail", (auth) => getShopifyCatalogDiscount(env, "Bearer fixture", auth, org, entity, {})],
  ["Meta library", (auth) => listMetaCreativeLibrary(env, "Bearer fixture", auth, org, {})],
  ["Klaviyo workspace", (auth) => getMarketingKlaviyoWorkspace(env, auth, org, {})],
  ["Klaviyo template", (auth) => getMarketingKlaviyoTemplateHtml(env, auth, org, "template-1")],
  ["Klaviyo clicks", (auth) => getMarketingKlaviyoCampaignClicks(env, auth, org, "campaign-1")],
  ["discount draft", (auth) => createShopifyDiscountProposal(env, auth, org, connection, draft)],
  ["discount proposal list", (auth) => listShopifyDiscountProposals(env, auth, org, connection)],
  ["discount approval", (auth) => approveAndApplyShopifyDiscountProposal(env, auth, org, entity)],
];

for (const [name, run] of operations) {
  test(`${name}: denies foreign, suspended, expired and store-only contexts before querying data`, async (t) => {
    const requests = intercept(t);
    const foreign = context();
    foreign.memberships = [];
    const suspended = context();
    suspended.memberships[0]!.organization!.status = "suspended";
    const expired = context();
    expired.subscriptions[0]!.status = "expired";
    const storeOnly = context();
    storeOnly.storeMemberships = storeOnly.memberships;
    storeOnly.memberships = [];
    for (const [auth, error] of [
      [foreign, "organization_access_denied"], [suspended, "organization_not_operational"],
      [expired, "subscription_not_active"], [storeOnly, "store_scope_required"],
    ] as const) {
      const result = await run(auth);
      assert.equal(result.ok, false);
      assert.equal(result.statusCode, 403);
      assert.equal(result.error, error);
    }
    assert.equal(requests.length, 0, "denied actors must not reach privileged queries");
  });
}

test("Meta library allows operational owners, managers, viewers and assigned consultants to read", async (t) => {
  intercept(t);
  for (const auth of [context("owner"), context("manager"), context("viewer"), context("manager", "consultant_assignment")]) {
    assert.equal((await listMetaCreativeLibrary(env, "Bearer fixture", auth, org, {})).ok, true);
  }
});

test("discount approval and proposals reject viewers and consultant assignments before reading the proposal", async (t) => {
  const requests = intercept(t);
  for (const auth of [context("viewer"), context("manager", "consultant_assignment"), context("owner", "platform_admin")]) {
    for (const [, run] of operations.filter(([name]) => name.startsWith("discount ") && name !== "discount detail")) {
      const result = await run(auth);
      assert.equal(result.statusCode, 403);
      assert.equal(result.error, "shopify_discount_write_access_denied");
    }
  }
  assert.equal(requests.length, 0);
});

test("real owners and managers can list proposals only within the requested organization and store", async (t) => {
  const calls = intercept(t, (url) => {
    if (url.pathname.endsWith("/shopify_stores")) return { id: entity, organization_id: org, connection_id: connection, is_active: true };
    if (url.pathname.endsWith("/integration_connections")) return { id: connection, provider: "shopify", provider_account_id: "fixture.myshopify.com", status: "connected", scopes: [] };
    return [];
  });
  for (const role of ["owner", "manager"]) {
    const result = await listShopifyDiscountProposals(env, context(role), org, connection);
    assert.equal(result.ok, true);
  }
  for (const url of calls) assert.equal(url.searchParams.get("organization_id"), `eq.${org}`);
  const proposalQueries = calls.filter((url) => url.pathname.endsWith("/shopify_discount_proposals"));
  assert.equal(proposalQueries.length, 2);
  for (const url of proposalQueries) assert.equal(url.searchParams.get("store_id"), `eq.${entity}`);
});

test("Klaviyo rejects an explicit missing store instead of broadening to the organization", async (t) => {
  const requests = intercept(t, (url) => url.pathname.endsWith("/shopify_stores") ? null : []);
  const result = await getMarketingKlaviyoWorkspace(env, context(), org, { connectionId: connection });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.statusCode, 404);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.searchParams.get("organization_id"), `eq.${org}`);
  assert.equal(requests[0]?.searchParams.get("is_active"), "eq.true");
});

test("Klaviyo store query errors stop before account queries", async (t) => {
  const requests = intercept(t, () => new Response(JSON.stringify({ code: "42501", message: "fixture denied" }), { status: 403 }));
  const result = await getMarketingKlaviyoWorkspace(env, context(), org, { connectionId: connection });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.statusCode, 503);
  assert.equal(requests.length, 1);
});

test("Klaviyo preserves an explicit valid store in downstream summaries", async (t) => {
  const args: Array<Record<string, unknown>> = [];
  intercept(t, (url, init) => {
    if (url.pathname.endsWith("/shopify_stores")) return { id: entity, shop_name: "Fixture" };
    if (url.pathname.includes("/rpc/")) args.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return [];
  });
  const result = await getMarketingKlaviyoWorkspace(env, context(), org, { connectionId: connection });
  assert.equal(result.ok, true);
  assert.equal(args[0]?.target_store_id, entity);
});

test("Klaviyo requires a store selection when several accounts are available", async (t) => {
  intercept(t, (url) => url.pathname.endsWith("/klaviyo_accounts") ? [{ id: "a" }, { id: "b" }] : []);
  const result = await getMarketingKlaviyoWorkspace(env, context(), org, {});
  assert.equal(result.ok, false);
  if (!result.ok) { assert.equal(result.statusCode, 409); assert.equal(result.error, "klaviyo_store_selection_required"); }
});
