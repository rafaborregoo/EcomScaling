export type MarketingStoreScope =
  | { ok: true; storeId: string | null; storeLabel: string }
  | { ok: false; statusCode: 404 | 409 | 503; error: string; detail?: string };

export type MetaSpecialistStore = {
  id: string;
  shop_name: string;
  connection_id: string;
};

/** A23-A25 compare account-level evidence; implicit multi-store scope is unsafe. */
export function resolveMetaSpecialistStoreScope(
  connectionId: string | null | undefined,
  stores: readonly MetaSpecialistStore[],
  loadError?: string | null,
): MarketingStoreScope {
  if (loadError) {
    return {
      ok: false,
      statusCode: 503,
      error: "marketing_store_scope_unavailable",
      detail: loadError,
    };
  }

  const selected = connectionId
    ? stores.find((store) => store.connection_id === connectionId)
    : stores.length === 1
      ? stores[0]
      : null;

  if (selected) {
    return {
      ok: true,
      storeId: selected.id,
      storeLabel: `la tienda "${selected.shop_name}"`,
    };
  }

  if (!connectionId && stores.length > 1) {
    return { ok: false, statusCode: 409, error: "meta_store_selection_required" };
  }

  return { ok: false, statusCode: 404, error: "marketing_store_not_found" };
}

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
