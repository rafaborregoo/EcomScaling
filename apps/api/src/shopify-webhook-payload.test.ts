import assert from "node:assert/strict";
import test from "node:test";
import { parseShopifyWebhookPayload } from "./shopify-webhook-handler.js";

test("acepta un payload JSON objeto de Shopify", () => {
  assert.deepEqual(
    parseShopifyWebhookPayload(Buffer.from('{"id":123,"topic":"orders/create"}')),
    { id: 123, topic: "orders/create" },
  );
});

test("rechaza JSON malformado sin lanzar una excepcion", () => {
  assert.equal(parseShopifyWebhookPayload(Buffer.from("{malformed")), null);
});

test("rechaza arrays y valores JSON que no representan un webhook", () => {
  assert.equal(parseShopifyWebhookPayload(Buffer.from("[]")), null);
  assert.equal(parseShopifyWebhookPayload(Buffer.from("null")), null);
  assert.equal(parseShopifyWebhookPayload(Buffer.from('"payload"')), null);
});
