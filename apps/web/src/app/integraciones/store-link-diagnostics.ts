import type { ScopeAccount, StoreScope } from "./store-scope-model";

export type StoreLinkDiagnostic = {
  id: string;
  provider: "Klaviyo" | "Meta Ads";
  accountName: string;
  status: "assigned" | "unassigned" | "stale";
  storeName: string | null;
};

function diagnoseAccounts(
  accounts: ScopeAccount[],
  provider: StoreLinkDiagnostic["provider"],
  scope: StoreScope,
): StoreLinkDiagnostic[] {
  const storesById = new Map(scope.stores.map((store) => [store.id, store]));

  return accounts.map((account) => {
    const store = account.store_id ? storesById.get(account.store_id) : null;
    const accountName =
      account.account_name ||
      account.external_ad_account_id ||
      account.external_account_id ||
      account.id;

    return {
      id: account.id,
      provider,
      accountName,
      status: store ? "assigned" : account.store_id ? "stale" : "unassigned",
      storeName: store?.shop_name || store?.myshopify_domain || null,
    };
  });
}

/**
 * Reports only what E-NORA has persisted. A provider account can exist here
 * while its store_id is still null; an integration between vendors set up in
 * Shopify/Klaviyo/Meta is separate evidence that this table does not contain.
 */
export function buildStoreLinkDiagnostics(
  scope: StoreScope,
): StoreLinkDiagnostic[] {
  return [
    ...diagnoseAccounts(scope.klaviyo_accounts, "Klaviyo", scope),
    ...diagnoseAccounts(scope.meta_ad_accounts, "Meta Ads", scope),
  ];
}
