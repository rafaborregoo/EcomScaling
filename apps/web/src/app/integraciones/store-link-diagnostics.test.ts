import assert from "node:assert/strict";
import test from "node:test";
import type { StoreScope } from "./store-scope-model";
import { buildStoreLinkDiagnostics } from "./store-link-diagnostics";

const scope: StoreScope = {
  stores: [
    {
      id: "shopify-store",
      connection_id: "shopify-connection",
      myshopify_domain: "e-nora-demo.myshopify.com",
      shop_name: "E-NORA Demo",
    },
  ],
  klaviyo_accounts: [
    {
      id: "klaviyo-account",
      connection_id: "klaviyo-connection",
      external_account_id: "klaviyo-external",
      account_name: "E-NORA Klaviyo",
      store_id: null,
    },
  ],
  meta_ad_accounts: [
    {
      id: "meta-account",
      connection_id: "meta-connection",
      external_ad_account_id: "act_123",
      account_name: "E-NORA Meta Ads",
      store_id: "shopify-store",
    },
  ],
  store_count: 1,
  unassigned_count: 1,
};

test("provider account exists in E-NORA but no store link is persisted", () => {
  const diagnostics = buildStoreLinkDiagnostics(scope);
  const klaviyo = diagnostics.find((item) => item.id === "klaviyo-account");

  assert.deepEqual(klaviyo, {
    id: "klaviyo-account",
    provider: "Klaviyo",
    accountName: "E-NORA Klaviyo",
    status: "unassigned",
    storeName: null,
  });
});

test("a Meta account with a valid store_id is reported as assigned", () => {
  const meta = buildStoreLinkDiagnostics(scope).find(
    (item) => item.id === "meta-account",
  );

  assert.equal(meta?.status, "assigned");
  assert.equal(meta?.storeName, "E-NORA Demo");
});

test("a persisted link to a deleted store is surfaced as stale", () => {
  const diagnostics = buildStoreLinkDiagnostics({
    ...scope,
    klaviyo_accounts: [
      { ...scope.klaviyo_accounts[0], store_id: "deleted-store" },
    ],
  });

  assert.equal(diagnostics[0]?.status, "stale");
  assert.equal(diagnostics[0]?.storeName, null);
});
