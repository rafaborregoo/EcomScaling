import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import { selectKlaviyoConversionMetric } from "./klaviyo.js";
import { parseKlaviyoWebhook, verifyKlaviyoWebhookSignature } from "./klaviyo-webhooks.js";
import { registerShopifyWebhooks, SHOPIFY_WEBHOOK_TOPICS, shopifyWebhookCallbackUrl } from "./shopify-webhooks.js";
import { shopifyWebhookRetryAt } from "./shopify-webhook-handler.js";

test("Klaviyo verifies the exact raw body plus HTTP timestamp and rejects tampering/replay", () => {
  const body = Buffer.from('{"data": []}');
  const timestamp = "Mon, 26 Oct 2026 10:00:00 GMT";
  const now = Date.parse(timestamp);
  const signature = createHmac("sha256", "test-secret").update(body).update(timestamp).digest("hex");
  assert.equal(verifyKlaviyoWebhookSignature(body, timestamp, signature, "test-secret", now), true);
  assert.equal(verifyKlaviyoWebhookSignature(Buffer.from('{"data":[]}'), timestamp, signature, "test-secret", now), false);
  assert.equal(verifyKlaviyoWebhookSignature(body, timestamp, signature, "test-secret", now + 300001), false);
  assert.equal(verifyKlaviyoWebhookSignature(body, timestamp, "z".repeat(64), "test-secret", now), false);
  assert.equal(verifyKlaviyoWebhookSignature(body, undefined, signature, "test-secret", now), false);
});

test("Klaviyo preserves identifiers only and rejects malformed/oversized batches", () => {
  const event = { external_id: "event-1", topic: "event:klaviyo.opened_email", payload: { email: "private@example.com" } };
  const encode = (data: unknown) => Buffer.from(JSON.stringify({ data, meta: { klaviyo_account_id: "account-1", klaviyo_webhook_id: "hook-1" } }));
  assert.deepEqual(parseKlaviyoWebhook(encode([event])), { accountId: "account-1", webhookId: "hook-1", events: [{ id: "event-1", topic: event.topic }] });
  assert.equal(parseKlaviyoWebhook(encode([])), null);
  assert.equal(parseKlaviyoWebhook(encode(Array(1001).fill(event))), null);
  assert.equal(parseKlaviyoWebhook(encode([null])), null);
  assert.equal(parseKlaviyoWebhook(Buffer.from("invalid")), null);
});

test("webhook retry delay grows but stays bounded at one hour", () => {
  const now = 1_000_000;
  const first = Date.parse(shopifyWebhookRetryAt(1, now)) - now;
  assert.ok(first > 0);
  assert.ok(Date.parse(shopifyWebhookRetryAt(2, now)) - now > first);
  assert.equal(Date.parse(shopifyWebhookRetryAt(16, now)) - now, 3_600_000);
});

test("Shopify keeps OAuth local while using a public webhook origin", () => {
  assert.equal(shopifyWebhookCallbackUrl("http://localhost:4000/v1/shopify/oauth/callback", "https://events.example.com"), "https://events.example.com/v1/shopify/webhooks");
});

test("Shopify heals missing subscriptions and moves old callback URLs without creating duplicates", async (t) => {
  const callback = "https://events.example.com/v1/shopify/webhooks";
  const calls: Array<{ query: string; variables: Record<string, unknown> }> = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(String(init.body));
    calls.push(request);
    if (request.query.includes("IntegrationWebhooks")) return Response.json({ data: { webhookSubscriptions: {
      nodes: SHOPIFY_WEBHOOK_TOPICS.slice(0, -1).map((topic, index) => ({ id: `gid://shopify/WebhookSubscription/${index}`, topic: topic.graphqlTopic, uri: index === 0 ? "https://old.example.com/webhooks" : callback })),
      pageInfo: { hasNextPage: false, endCursor: null },
    } } });
    if (request.query.includes("IntegrationWebhookUpdate")) return Response.json({ data: { webhookSubscriptionUpdate: { userErrors: [] } } });
    return Response.json({ data: { webhookSubscriptionCreate: { webhookSubscription: { id: "new" }, userErrors: [] } } });
  });
  const result = await registerShopifyWebhooks("test.myshopify.com", "test-token", callback);
  assert.equal(result.status, "healthy");
  assert.equal(result.confirmed, SHOPIFY_WEBHOOK_TOPICS.length);
  assert.equal(calls.length, 3);
  assert.equal(calls[1]?.variables.id, "gid://shopify/WebhookSubscription/0");
});

test("Shopify records HTTPS registration failures instead of reporting a healthy subscription", async () => {
  const result = await registerShopifyWebhooks("test.myshopify.com", "test-token", "http://localhost:4000/v1/shopify/webhooks");
  assert.equal(result.status, "failed");
  assert.equal(result.confirmed, 0);
  assert.ok(result.failures.length);
});

test("Klaviyo metric selection scopes both reads and writes to the chosen account", async (t) => {
  const org = "11111111-1111-4111-8111-111111111111";
  const chosen = "22222222-2222-4222-8222-222222222222";
  const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only" } as LoadedApiEnv;
  const context: AuthContext = { user: { id: "test-user" }, profile: { id: "test-user", full_name: null, avatar_url: null, platform_role: "member", is_active: true }, memberships: [
    { organization_id: org, accessSource: "membership", role: "owner", organization: { id: org, display_name: "Test", slug: "test", status: "active", timezone: "UTC", currency_code: "EUR", kind: "client" } },
  ], subscriptions: [] };
  const calls: Array<{ url: URL; method: string }> = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (method !== "GET") return new Response(null, { status: 204 });
    if (url.pathname.endsWith("/klaviyo_accounts")) {
      assert.equal(url.searchParams.get("organization_id"), `eq.${org}`);
      const account = { id: "chosen-account", connection_id: chosen, conversion_metric_id: null };
      return Response.json(url.searchParams.get("connection_id") === `eq.${chosen}` ? [account] : [account, { ...account, id: "other-account" }]);
    }
    assert.equal(url.pathname.endsWith("/klaviyo_metrics"), true);
    assert.equal(url.searchParams.get("account_id"), "eq.chosen-account");
    return Response.json(url.searchParams.get("external_metric_id") === "eq.chosen-metric"
      ? { external_metric_id: "chosen-metric", name: "Placed Order" } : null);
  });
  const ambiguous = await selectKlaviyoConversionMetric(env, context, org, "chosen-metric");
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) assert.equal(ambiguous.statusCode, 409);
  const foreign = await selectKlaviyoConversionMetric(env, context, org, "foreign-metric", "klaviyo", chosen);
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.equal(foreign.statusCode, 404);
  assert.equal(calls.some((call) => call.method === "PATCH"), false);
  const selected = await selectKlaviyoConversionMetric(env, context, org, "chosen-metric", "klaviyo", chosen);
  assert.equal(selected.ok, true);
  const write = calls.find((call) => call.method === "PATCH")!;
  assert.equal(write.url.searchParams.get("id"), "eq.chosen-account");
  assert.equal(write.url.searchParams.get("organization_id"), `eq.${org}`);
});
