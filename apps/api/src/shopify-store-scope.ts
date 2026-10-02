import type { SupabaseClient } from "@supabase/supabase-js";

export type ShopifyStoreScope =
  | {
      status: "ready";
      storeId: string | null;
      currencyCode: string | null;
      connectionId: string | null;
    }
  | { status: "not_found" }
  | { status: "selection_required" };

/**
 * Monetary Shopify summaries are only valid for one store. Ads, order totals,
 * discounts and refunds can have different currencies or accounting contexts,
 * so an organization-wide sum is not a currency conversion.
 */
export async function resolveShopifyStoreScope(
  client: SupabaseClient,
  organizationId: string,
  connectionId?: string,
): Promise<ShopifyStoreScope> {
  let query = client
    .from("shopify_stores")
    .select("id, currency_code, connection_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  const { data, error } = await query.limit(connectionId ? 1 : 2);
  if (error) throw new Error(`shopify_store_scope_load_failed: ${error.message}`);

  const stores = data ?? [];
  if (connectionId) {
    const store = stores[0];
    return store
      ? {
          status: "ready",
          storeId: store.id,
          currencyCode: store.currency_code?.toUpperCase() ?? null,
          connectionId: store.connection_id,
        }
      : { status: "not_found" };
  }

  if (stores.length > 1) return { status: "selection_required" };
  const store = stores[0];
  return {
    status: "ready",
    storeId: store?.id ?? null,
    currencyCode: store?.currency_code?.toUpperCase() ?? null,
    connectionId: store?.connection_id ?? null,
  };
}
