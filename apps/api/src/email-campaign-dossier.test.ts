import test from "node:test";
import assert from "node:assert/strict";
import { getEmailCampaignDossier } from "./email-campaign-dossier.js";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
const org = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", campaign = "4f8061ac-6a08-e2ba-3b58-12955ecae6fd";
const env = { SUPABASE_URL: "https://test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key", INTEGRATION_FEATURE_FLAGS: "klaviyo" } as LoadedApiEnv;
test("unauthorized organization cannot trigger privileged dossier queries", async () => {
  const result = await getEmailCampaignDossier(env, { memberships: [], storeMemberships: [] } as unknown as AuthContext, org, campaign, {});
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.statusCode, 403);
});
test("stale selected connection does not broaden to another store or query its reports", async () => {
  const original = globalThis.fetch; const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input)); requests.push(url.pathname);
    assert.equal(url.searchParams.get("organization_id"), `eq.${org}`);
    const data = url.pathname.endsWith("klaviyo_campaigns") ? [{ id: campaign, account_id: "account", name: "Campaña", status: "sent", send_time: null, external_campaign_id: "remote" }]
      : url.pathname.endsWith("klaviyo_accounts") ? [{ id: "account", store_id: "store", currency_code: "EUR" }]
      : url.pathname.endsWith("shopify_stores") ? [{ id: "store", connection_id: "real-connection", is_active: true }] : assert.fail(`Unexpected query ${url.pathname}`);
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await getEmailCampaignDossier(env, { memberships: [{ organization_id: org }] } as unknown as AuthContext, org, campaign, { connectionId: "wrong-connection" });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.statusCode, 404);
    assert.equal(requests.length, 3);
  } finally { globalThis.fetch = original; }
});
