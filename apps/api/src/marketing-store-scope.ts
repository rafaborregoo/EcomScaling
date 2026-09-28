export type MarketingStoreScope =
  | { ok: true; storeId: string | null; storeLabel: string }
  | { ok: false; statusCode: 404 | 503; error: string; detail?: string };

/** A selected store is an exact scope claim; never silently widen it to the org. */
export function resolveMarketingStoreScope(
  connectionId: string | null | undefined,
  lookup: {
    data: { id: string; shop_name: string } | null;
    error?: { message: string } | null;
  },
): MarketingStoreScope {
  if (!connectionId) {
    return {
      ok: true,
      storeId: null,
      storeLabel: "todas las tiendas de la organización",
    };
  }
  if (lookup.error) {
    return {
      ok: false,
      statusCode: 503,
      error: "marketing_store_scope_unavailable",
      detail: lookup.error.message,
    };
  }
  if (!lookup.data) {
    return { ok: false, statusCode: 404, error: "marketing_store_not_found" };
  }
  return {
    ok: true,
    storeId: lookup.data.id,
    storeLabel: `la tienda "${lookup.data.shop_name}"`,
  };
}
