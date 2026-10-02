import type { SupabaseClient } from "@supabase/supabase-js";

export type KlaviyoStoreLink = {
  storeId: string | null;
  storeScopeAvailable: boolean;
};

function isMissingStoreScopeColumn(message: string) {
  return message.includes("store_id") && (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

/**
 * Keeps an explicit account→Shopify-store assignment across syncs. For the
 * common one-store setup, the relationship is unambiguous and can be created
 * automatically. Multi-store organizations must use the store-scope screen.
 */
export async function resolveKlaviyoStoreLink(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    connectionId: string;
    externalAccountId: string;
  },
): Promise<KlaviyoStoreLink> {
  const accountResult = await supabase
    .from("klaviyo_accounts")
    .select("store_id")
    .eq("organization_id", input.organizationId)
    .eq("connection_id", input.connectionId)
    .eq("external_account_id", input.externalAccountId)
    .maybeSingle();

  if (accountResult.error) {
    if (isMissingStoreScopeColumn(accountResult.error.message)) {
      return { storeId: null, storeScopeAvailable: false };
    }
    throw new Error(`klaviyo_store_link_read_failed:${accountResult.error.message}`);
  }

  const existingStoreId = accountResult.data?.store_id as string | null | undefined;
  if (existingStoreId) {
    return { storeId: existingStoreId, storeScopeAvailable: true };
  }

  const storesResult = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("organization_id", input.organizationId)
    .limit(2);
  if (storesResult.error) {
    throw new Error(`klaviyo_shopify_store_lookup_failed:${storesResult.error.message}`);
  }

  const stores = storesResult.data ?? [];
  return {
    storeId: stores.length === 1 ? stores[0]?.id ?? null : null,
    storeScopeAvailable: true,
  };
}
