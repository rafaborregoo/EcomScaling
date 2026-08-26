import assert from "node:assert/strict";
import test from "node:test";
import { SHOPIFY_API_VERSION, shopifyGraphql } from "./shopify-client.js";

test("Shopify GraphQL construye el endpoint con la versiÃ³n configurada", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await shopifyGraphql(
      "example.myshopify.com",
      "shopify-token",
      "query { shop { name } }",
      {},
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(
      requestUrl,
      `https://example.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
