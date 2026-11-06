import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const specialists = process.argv.includes("--specialists");
const dir = specialists ? ".e-nora-test-lab/a11-specialists-2026-11-02-v1" : ".e-nora-test-lab/a11-real-2026-11-02-v4";
const baseline = JSON.parse(await readFile(".e-nora-test-lab/a11-real-2026-11-02-v4/report.json", "utf8"));
const report = { ...baseline, ...JSON.parse(await readFile(`${dir}/report.json`, "utf8")) };
const manifest = JSON.parse(await readFile(`${dir}/draft-manifest.json`, "utf8"));
const ids = specialists ? [manifest.id] : manifest.ids;
const expectedCombinations = specialists ? 1 : 36;
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const receipts: unknown[] = [];
for (const [role, email] of [["cliente", "borregorafa99@gmail.com"], ["consultor", "rafael@noraapp.es"]]) {
  const link = await db.auth.admin.generateLink({ type: "magiclink", email: email! }); assert.ifError(link.error);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token }); assert.ifError(session.error); assert.ok(session.data.session);
  const headers = { authorization: `Bearer ${session.data.session.access_token}` };
  try {
    const path = `http://localhost:${env.API_PORT}/v1/organizations/${report.organization_id}/marketing/drafts`;
    const params = new URLSearchParams({ connectionId: report.connection_id, labBatch: report.batch });
    const response = await fetch(`${path}?${params}`, { headers }); const body: any = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body)); assert.equal(body.drafts.length, ids.length);
    assert.deepEqual(new Set(body.drafts.map((draft: any) => draft.id)), new Set(ids));
    assert.ok(body.drafts.every((draft: any) => draft.request.ai_lab.batch === report.batch && draft.scheduled_for === null));
    assert.equal(body.drafts[0].request.ai_lab.manifest.length, expectedCombinations);
    if (specialists) { assert.equal(body.drafts[0].request.specialist_pipeline.stages.length, 3); assert.equal(body.drafts[0].request.specialist_pipeline.visual_review, "pending"); }
    const details = await fetch(`${path}/${body.drafts[0].id}/versions`, { headers }); assert.equal(details.status, 200);
    const invalid = await fetch(`${path}?${new URLSearchParams({ connectionId: report.connection_id, labBatch: "bad,(batch)" })}`, { headers }); assert.equal(invalid.status, 400);
    const otherTenant = await fetch(`http://localhost:${env.API_PORT}/v1/organizations/11111111-1111-4111-8111-111111111111/marketing/drafts?${params}`, { headers }); assert.ok([403,404].includes(otherTenant.status), `cross-tenant returned ${otherTenant.status}`);
    receipts.push({ role, drafts_visible: body.drafts.length, combinations_visible: expectedCombinations, versions_accessible: true, invalid_batch_rejected: true, other_organization_denied: true });
  } finally { await client.auth.signOut({ scope: "local" }); }
}
const health = await fetch(`http://localhost:${env.API_PORT}/health`); assert.equal(health.status, 200);
const page = await fetch("http://localhost:3001/marketing?section=laboratorio"); assert.equal(page.status, 200);
const receipt = { checked_at: new Date().toISOString(), batch: report.batch, account_checks: receipts, http_page: 200, browser_visual_check: "blocked_by_computer_use_url_verification", no_publications: true };
await writeFile(`${dir}/visibility-receipt.json`, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
