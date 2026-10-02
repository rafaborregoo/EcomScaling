import type { BulkLine } from "./shopify-bulk.js";

export type ShopifyProductMediaLine = BulkLine & {
  mediaContentType?: string | null;
  alt?: string | null;
  image?: {
    url?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
};

export type ShopifyProductMediaRow = {
  organization_id: string;
  store_id: string;
  product_id: string;
  external_media_id: string;
  media_content_type: "IMAGE";
  source_url: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  position: number;
  is_active: true;
  last_seen_at: string;
  updated_at: string;
};

/** Map Shopify's flattened bulk children to image rows for the local catalog. */
export function buildShopifyProductMediaRows(input: {
  organizationId: string;
  storeId: string;
  syncedAt: string;
  products: readonly Pick<BulkLine, "id">[];
  productIdByExternalId: ReadonlyMap<string, string>;
  mediaByProductExternalId: ReadonlyMap<
    string,
    readonly ShopifyProductMediaLine[]
  >;
}) {
  const rows: ShopifyProductMediaRow[] = [];
  const syncedProductIds: string[] = [];

  for (const product of input.products) {
    const productId = input.productIdByExternalId.get(product.id);
    if (!productId) continue;
    syncedProductIds.push(productId);

    let imagePosition = 0;
    for (const media of input.mediaByProductExternalId.get(product.id) ?? []) {
      const url = media.image?.url?.trim();
      if (media.mediaContentType !== "IMAGE" || !url) continue;

      rows.push({
        organization_id: input.organizationId,
        store_id: input.storeId,
        product_id: productId,
        external_media_id: media.id,
        media_content_type: "IMAGE",
        source_url: url,
        alt_text: media.alt?.trim() || null,
        width: media.image?.width ?? null,
        height: media.image?.height ?? null,
        position: imagePosition++,
        is_active: true,
        last_seen_at: input.syncedAt,
        updated_at: input.syncedAt,
      });
    }
  }

  return { rows, syncedProductIds };
}
