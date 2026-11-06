import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
const env = loadApiEnv(process.env); assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const org = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", store = "5e84efa9-6e7f-4759-8b87-22119401bd81", connection = "836364d9-1e29-4273-be44-29f73a53722a";
const campaigns = await db.from("klaviyo_campaigns").select("id,name").eq("organization_id", org).limit(100); assert.ifError(campaigns.error);
const inventory = await db.rpc("klaviyo_email_inventory", { target_organization_id: org, target_store_id: store }); assert.ifError(inventory.error);
const dateEnd = new Date(), dateStart = new Date(dateEnd.getTime() - 90 * 86400000);
const report = await db.rpc("klaviyo_email_report", { target_organization_id: org, target_store_id: store, period_start: dateStart.toISOString().slice(0,10), period_end: dateEnd.toISOString().slice(0,10) }); assert.ifError(report.error);
const withBody = (inventory.data ?? []).find((row: any) => row.source === "campaign" && Number(row.body_chars) > 0 && campaigns.data!.some((campaign) => campaign.id === row.parent_id));
const measured = (report.data ?? []).filter((row: any) => row.entity_type === "campaign").sort((a: any,b: any) => b.bucket_month.localeCompare(a.bucket_month))[0];
const target = campaigns.data!.find((campaign) => campaign.id === withBody?.parent_id) ?? campaigns.data!.find((campaign) => campaign.id === measured?.entity_id) ?? campaigns.data![0]; assert.ok(target);
const receipts = [];
let original: any;
for (const [role, email] of [["cliente", "borregorafa99@gmail.com"], ["consultor", "rafael@noraapp.es"]]) {
  const link = await db.auth.admin.generateLink({ type: "magiclink", email: email! }); assert.ifError(link.error);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token }); assert.ifError(login.error); assert.ok(login.data.session);
  try {
    const headers = { authorization: `Bearer ${login.data.session.access_token}` };
    const root = `http://localhost:${env.API_PORT}/v1/organizations/${org}/klaviyo/campaigns/${target.id}/dossier`;
    const response = await fetch(`${root}?connectionId=${connection}`, { headers }); const body: any = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body)); assert.equal(body.campaign.id, target.id); assert.equal(body.store_id, store);
    assert.ok(body.conclusion.summary); assert.ok(Array.isArray(body.messages));
    const comparison = { campaign: body.campaign, metrics: body.metrics, conclusion: body.conclusion, messages: body.messages, reviews: body.reviews };
    if (original) assert.deepEqual(comparison, original); else original = comparison;
    const wrong = await fetch(`${root}?connectionId=11111111-1111-4111-8111-111111111111`, { headers }); assert.equal(wrong.status, 404);
    const denied = await fetch(`http://localhost:${env.API_PORT}/v1/organizations/11111111-1111-4111-8111-111111111111/klaviyo/campaigns/${target.id}/dossier`, { headers }); assert.ok([403,404].includes(denied.status));
    receipts.push({ role, campaign_id: target.id, name: target.name, conclusion: body.conclusion.status, messages: body.messages.length, bodies: body.messages.filter((message: any) => message.html || message.text).length, reviews: body.reviews.length, metrics: body.metric_status, other_store_denied: true, other_org_denied: true });
  } finally { await client.auth.signOut({ scope: "local" }); }
}
const href = `/klaviyo/campanas/${target.id}?organizationId=${org}&connectionId=${connection}`;
const page = await fetch(`http://localhost:3001${href}`); assert.equal(page.status, 200);
const receipt = { checked_at: new Date().toISOString(), href, receipts, page_status: page.status, no_model_calls: true, no_database_writes: true, visual_review: "pending" };
await mkdir(".e-nora-test-lab/email-campaign-dossier-2026-11-03", { recursive: true }); await writeFile(".e-nora-test-lab/email-campaign-dossier-2026-11-03/verification.json", JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
