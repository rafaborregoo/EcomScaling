import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";

const env = loadApiEnv(process.env);
assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const org = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", owner = "ead62983-1938-4da6-af8f-13cb64d8cd3e";
const id = "a4e3a30e-1346-5490-af88-d3d684e71dc1", connection = "836364d9-1e29-4273-be44-29f73a53722a";
const member = await db.from("organization_members").select("role").eq("organization_id", org).eq("user_id", owner).eq("is_active", true).single(); assert.ifError(member.error); assert.equal(member.data?.role, "owner");
const loaded = await db.from("marketing_content_drafts").select("*").eq("organization_id", org).eq("id", id).single(); assert.ifError(loaded.error);
const draft = loaded.data!;
assert.equal(draft.created_by, owner); assert.equal(draft.request.store_id, connection); assert.equal(draft.request.channel, "email_klaviyo");
assert.equal(draft.status, "draft"); assert.equal(draft.scheduled_for, null); assert.ok(draft.html.includes("cdn.shopify.com"));
if (draft.request.ai_lab) {
  assert.equal(draft.request.ai_lab.batch, "a11-specialists-2026-11-02-v1");
  const dir = ".e-nora-test-lab/a11-specialists-2026-11-02-v1";
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/before-content-placement.json`, JSON.stringify(draft, null, 2));
  const { ai_lab, lab_original_output, specialist_pipeline, ...request } = draft.request;
  const update = await db.from("marketing_content_drafts").update({
    template_name: "Hydrogen · Una tabla protagonista", request,
    warnings: draft.warnings.filter((warning: string) => !warning.startsWith("Piloto de subagentes:")),
  }).eq("organization_id", org).eq("id", id).eq("version", draft.version).select("*").single(); assert.ifError(update.error);
}
const current = await db.from("marketing_content_drafts").select("*").eq("organization_id", org).eq("id", id).single(); assert.ifError(current.error);
const history = await db.from("marketing_content_draft_versions").select("snapshot").eq("organization_id", org).eq("draft_id", id).eq("version", current.data!.version).maybeSingle(); assert.ifError(history.error);
if (history.data?.snapshot.template_name !== current.data!.template_name) {
  const updated = await db.from("marketing_content_drafts").update({ version: current.data!.version + 1 }).eq("organization_id", org).eq("id", id).eq("version", current.data!.version).select("*").single(); assert.ifError(updated.error);
  const version = await db.from("marketing_content_draft_versions").insert({ draft_id: id, organization_id: org, version: updated.data!.version, change_type: "manual", edited_by: owner, snapshot: updated.data }); assert.ifError(version.error);
}
const checks = [];
for (const [role, email] of [["cliente", "borregorafa99@gmail.com"], ["consultor", "rafael@noraapp.es"]]) {
  const link = await db.auth.admin.generateLink({ type: "magiclink", email: email! }); assert.ifError(link.error);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token }); assert.ifError(login.error); assert.ok(login.data.session);
  try {
    const response = await fetch(`http://localhost:${env.API_PORT}/v1/organizations/${org}/marketing/drafts?connectionId=${connection}`, { headers: { authorization: `Bearer ${login.data.session.access_token}` } });
    assert.equal(response.status, 200); const body: any = await response.json();
    const visible = body.drafts.find((row: any) => row.id === id); assert.ok(visible, "Created email must appear in the ordinary content list");
    assert.equal(visible.template_name, "Hydrogen · Una tabla protagonista"); assert.ok(!visible.request.ai_lab); assert.equal(visible.status, "draft");
    assert.ok(body.drafts.every((row: any) => !row.request?.ai_lab), "Experiments should not clutter ordinary content");
    checks.push({ role, visible: true, title: visible.template_name, normal_content_list: true });
  } finally { await client.auth.signOut({ scope: "local" }); }
}
console.log(JSON.stringify({ id, checks, href: `/marketing?section=crear&draft=${id}`, sent: false }));
