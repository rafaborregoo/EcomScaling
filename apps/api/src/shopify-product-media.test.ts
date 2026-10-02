import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShopifyProductMediaRows,
  type ShopifyProductMediaLine,
} from "./shopify-product-media.js";

test("maps ordered product images and skips non-image media", () => {
  const mediaByProduct = new Map<string, ShopifyProductMediaLine[]>([
    [
      "gid://shopify/Product/10",
      [
        {
          id: "gid://shopify/MediaImage/1",
          mediaContentType: "IMAGE",
          alt: " Front view ",
          image: { url: " https://cdn.shopify.com/front.jpg ", width: 640, height: 480 },
        },
        {
          id: "gid://shopify/Video/2",
          mediaContentType: "VIDEO",
          image: null,
        },
        {
          id: "gid://shopify/MediaImage/3",
          mediaContentType: "IMAGE",
          alt: null,
          image: { url: "https://cdn.shopify.com/back.jpg" },
        },
      ],
    ],
  ]);

  const result = buildShopifyProductMediaRows({
    organizationId: "org-1",
    storeId: "store-1",
    syncedAt: "2026-09-30T12:00:00.000Z",
    products: [{ id: "gid://shopify/Product/10" }],
    productIdByExternalId: new Map([["gid://shopify/Product/10", "product-1"]]),
    mediaByProductExternalId: mediaByProduct,
  });

  assert.deepEqual(result.syncedProductIds, ["product-1"]);
  assert.deepEqual(result.rows.map((row) => row.position), [0, 1]);
  assert.equal(result.rows[0]?.source_url, "https://cdn.shopify.com/front.jpg");
  assert.equal(result.rows[0]?.alt_text, "Front view");
  assert.equal(result.rows[1]?.width, null);
});

test("marks products without images as synced so removed images can be retired", () => {
  const result = buildShopifyProductMediaRows({
    organizationId: "org-1",
    storeId: "store-1",
    syncedAt: "2026-09-30T12:00:00.000Z",
    products: [{ id: "gid://shopify/Product/10" }],
    productIdByExternalId: new Map([["gid://shopify/Product/10", "product-1"]]),
    mediaByProductExternalId: new Map(),
  });

  assert.deepEqual(result.syncedProductIds, ["product-1"]);
  assert.deepEqual(result.rows, []);
});
