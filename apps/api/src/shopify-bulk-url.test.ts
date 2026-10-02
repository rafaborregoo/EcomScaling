import assert from "node:assert/strict";
import test from "node:test";
import { forEachBulkResultBatch, validateBulkResultUrl } from "./shopify-bulk.js";

test("acepta únicamente URLs HTTPS firmadas del host de resultados Bulk de Shopify", () => {
  const result = validateBulkResultUrl(
    "https://storage.googleapis.com/shopify/result?signature=test",
  );
  assert.equal(
    result,
    "https://storage.googleapis.com/shopify/result?signature=test",
  );
});

test("rechaza destinos SSRF locales o hosts que no sean el storage oficial", () => {
  for (const value of [
    "http://storage.googleapis.com/shopify/result",
    "https://127.0.0.1/internal",
    "https://localhost/internal",
    "https://evil.example/shopify/result",
    "https://storage.googleapis.com.evil.example/shopify/result",
    "https://user:pass@storage.googleapis.com/shopify/result",
  ]) {
    assert.throws(() => validateBulkResultUrl(value), /bulk_result_url_/);
  }
});

test("rechaza redirecciones al descargar resultados Bulk de Shopify", async () => {
  const previousFetch = globalThis.fetch;
  let redirectMode: RequestRedirect | undefined;
  globalThis.fetch = async (_input, init) => {
    redirectMode = init?.redirect;
    return new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/internal" },
    });
  };

  try {
    await assert.rejects(
      forEachBulkResultBatch(
        "https://storage.googleapis.com/shopify/result?signature=test",
        10,
        () => undefined,
      ),
      /bulk_result_download_failed_302/,
    );
    assert.equal(redirectMode, "error");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
