import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeShopifyReturnReason,
  mapShopifyFulfillmentLineItems,
  safeWebhookPayload,
} from "./shopify-webhook-handler.js";
import { SHOPIFY_WEBHOOK_TOPICS } from "./shopify-webhooks.js";

test("normalizes only Shopify's declared return reason enum", () => {
  assert.equal(normalizeShopifyReturnReason("SIZE_TOO_SMALL"), "SIZE_TOO_SMALL");
  assert.equal(normalizeShopifyReturnReason("CUSTOMER_NOTE_WITH_EMAIL@example.com"), null);
  assert.equal(normalizeShopifyReturnReason(null), null);
});

test("links returned Shopify line IDs only to the exact local fulfillment", () => {
  const links = mapShopifyFulfillmentLineItems([
    { id: "gid://shopify/Fulfillment/1", fulfillmentLineItems: { nodes: [{ id: "gid://shopify/FulfillmentLineItem/10" }] } },
    { id: "gid://shopify/Fulfillment/2", fulfillmentLineItems: { nodes: [{ id: "gid://shopify/FulfillmentLineItem/20" }] } },
  ], new Map([["gid://shopify/Fulfillment/2", "local-2"]]));

  assert.equal(links.get("gid://shopify/FulfillmentLineItem/20"), "local-2");
  assert.equal(links.has("gid://shopify/FulfillmentLineItem/10"), false);
  assert.equal(links.has("unknown-line"), false);
});

test("redacts return webhook payloads before durable event storage", () => {
  const sanitized = safeWebhookPayload("returns/request", {
    id: 123,
    admin_graphql_api_id: "gid://shopify/Return/123",
    customer: { email: "private@example.com" },
    returnReasonNote: "Customer-entered text",
    return_line_items: [{ customerNote: "do not persist" }],
  });

  assert.deepEqual(sanitized, {
    id: 123,
    admin_graphql_api_id: "gid://shopify/Return/123",
  });
  assert.equal("customer" in sanitized, false);
  assert.equal("returnReasonNote" in sanitized, false);
});

test("keeps existing webhook payloads unchanged for unrelated topics", () => {
  const payload = { id: 7, order_id: 10 };
  assert.equal(safeWebhookPayload("orders/updated", payload), payload);
});

test("registers each Shopify return lifecycle topic", () => {
  const registered = new Set<string>(SHOPIFY_WEBHOOK_TOPICS.map((topic) => topic.restTopic));
  for (const topic of [
    "returns/request", "returns/approve", "returns/process", "returns/close",
    "returns/update", "returns/cancel", "returns/decline", "returns/reopen",
  ]) assert.equal(registered.has(topic), true, `${topic} must be subscribed`);
});
