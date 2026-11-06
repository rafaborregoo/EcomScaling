import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { runMetaSync } from "../apps/api/src/meta-sync.js";
const env = loadApiEnv(process.env); assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const connectionId = "bf821942-5756-4609-8180-23e83c36c9cb", orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04";
const { data, error } = await db.from("meta_ad_accounts").select("id,external_ad_account_id,store_id").eq("organization_id", orgId).eq("connection_id", connectionId).eq("is_active", true).eq("is_selected", true);
assert.ifError(error); assert.equal(data?.length, 1); assert.equal(data[0]?.external_ad_account_id, "act_1797270924877645");
let failure = null;
try { await runMetaSync(env, connectionId, "initial"); } catch (error) { failure = error instanceof Error ? error.message : "sync_failed"; }
const receipt = { checked_at: new Date().toISOString(), connection_id: connectionId, selected: data, failure, no_external_meta_writes: true };
await writeFile(".e-nora-test-lab/a14-closeout-2026-11-05/selected-sync.json", JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
