import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { updateMetaAssetSelection } from "../apps/api/src/meta.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { assignStoreScope } from "../apps/api/src/store-scope.js";
const env = loadApiEnv(process.env); assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", ownerId = "ead62983-1938-4da6-af8f-13cb64d8cd3e", storeId = "5e84efa9-6e7f-4759-8b87-22119401bd81";
const checked = async (query: any) => { const value = await query; assert.ifError(value.error); return value.data; };
const user = await db.auth.admin.getUserById(ownerId); assert.equal(user.data.user?.email, "borregorafa99@gmail.com");
const [org, profile, member, subscriptions, store] = await Promise.all([
  checked(db.from("organizations").select("id,display_name,slug,status,timezone,currency_code,kind").eq("id", orgId).single()),
  checked(db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("id", ownerId).single()),
  checked(db.from("organization_members").select("organization_id,role").eq("organization_id", orgId).eq("user_id", ownerId).single()),
  checked(db.from("service_subscriptions").select("id,organization_id,plan_code,status,starts_at,ends_at").eq("organization_id", orgId)),
  checked(db.from("shopify_stores").select("connection_id").eq("organization_id", orgId).eq("id", storeId).single()),
]);
const context: AuthContext = { user: { id: ownerId }, profile, memberships: [{ ...member, organization: org, accessSource: "membership" }], subscriptions };
const dir = ".e-nora-test-lab/a14-closeout-2026-11-05";
const evidence = JSON.parse(await readFile(`${dir}/meta-access-alternative.json`, "utf8"));
assert.equal(evidence.targetAccount, "act_1797270924877645"); assert.equal(evidence.account.ok, true); assert.equal(evidence.insights.ok, true);
assert.ok(Date.now() - Date.parse(evidence.checked_at) < 30 * 60 * 1000, "Read access must have been checked recently");
const oldId = "55a9040c-af20-4cfd-b281-04bb3e00b7d4", newId = "5b587a4e-ad4e-4a93-9d2d-828ad1b69817";
const before = await checked(db.from("meta_ad_accounts").select("id,organization_id,connection_id,external_ad_account_id,account_name,store_id,is_active,is_selected").eq("organization_id", orgId).in("id", [oldId,newId]));
assert.equal(before.length, 2); assert.ok(before.every((row: any) => row.connection_id === evidence.connection.id && row.is_active));
assert.ok(before.find((row: any) => row.id === newId).store_id === null || before.find((row: any) => row.id === newId).store_id === storeId);
await mkdir(dir, { recursive: true });
// Preserve the original mapping once; a rerun must not overwrite the rollback evidence.
await writeFile(`${dir}/account-selection-before.json`, JSON.stringify({ authorization: "Usuario delega elegir cuenta para E-NORA Demo", before }, null, 2), { flag: "wx" }).catch((error) => { if (error.code !== "EEXIST") throw error; });
const scoped = await assignStoreScope(env, context, orgId, { meta_ad_accounts: [{ id: oldId, store_id: null }, { id: newId, store_id: storeId }] });
assert.ok(scoped.ok, JSON.stringify(scoped)); assert.equal(scoped.data.failed.length, 0);
const selected = await updateMetaAssetSelection(env, context, orgId, { adAccountIds: [newId] }); assert.ok(selected.ok, JSON.stringify(selected));
const after = await checked(db.from("meta_ad_accounts").select("id,external_ad_account_id,store_id,is_selected").eq("organization_id", orgId).in("id", [oldId,newId]));
assert.equal(after.find((row: any) => row.id === oldId).store_id, null); assert.equal(after.find((row: any) => row.id === oldId).is_selected, false);
assert.equal(after.find((row: any) => row.id === newId).store_id, storeId); assert.equal(after.find((row: any) => row.id === newId).is_selected, true);
await writeFile(`${dir}/account-selection.json`, JSON.stringify({ checked_at: new Date().toISOString(), after, old_history_retained: true, no_external_meta_changes: true }, null, 2));
console.log(JSON.stringify({ selected: newId, store_id: storeId, old_account_unassigned_and_deselected: true }));
