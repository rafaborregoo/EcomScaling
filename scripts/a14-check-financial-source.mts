import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
const env = loadApiEnv(process.env);
assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const result = await db.rpc("shopify_financial_coverage", { target_organization_id: "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", target_store_id: "5e84efa9-6e7f-4759-8b87-22119401bd81", period_start: "2026-10-04T00:00:00.000Z", period_end: "2026-11-02T23:59:59.999Z" });
console.log(JSON.stringify({ error: result.error, has_data: Boolean(result.data) }));
