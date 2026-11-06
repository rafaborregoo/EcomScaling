import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { getMedicionMetaDiagnostic, runOperativaMetaAgent } from "../apps/api/src/ai-runtime.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { loadShopifyFinancialEvidence, financialUtcWindows } from "../apps/api/src/shopify-financial-comparability.js";
import { META_MEASUREMENT_VERDICT_VERSION } from "../apps/api/src/meta-measurement-verdict.js";
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
const measurement = await getMedicionMetaDiagnostic(env, context, orgId, store.connection_id);
assert.ok(measurement.ok, JSON.stringify(measurement));
const window = financialUtcWindows(new Date(), 30);
const financial = await loadShopifyFinancialEvidence(db, orgId, storeId, window.start, window.end);
assert.ifError(financial.financial.error);
const assessment = (measurement.data as any).measurement_assessment;
const cacheWrite = await db.rpc("meta_save_measurement_verdict", { p_verdict: {
  organization_id: orgId, store_id: storeId, period_start: assessment.window.start, period_end: assessment.window.end,
  verdict_version: META_MEASUREMENT_VERDICT_VERSION, verdict_status: assessment.status, verdict: assessment,
  source_fingerprint: assessment.source_fingerprint, evaluated_at: assessment.evaluated_at, expires_at: assessment.expires_at,
} });
let beforeModelCalled = false;
const blockedRun = await runOperativaMetaAgent(env, context, orgId, { beforeModel: async () => { beforeModelCalled = true; throw new Error("NO_PAID_MODEL_CALL_ALLOWED"); } }, store.connection_id);
assert.equal(blockedRun.ok, false);
if (!beforeModelCalled) assert.equal((blockedRun as any).error, "meta_source_not_ready");
const receipt = { checked_at: new Date().toISOString(), organization_id: orgId, store_id: storeId,
  measurement: assessment, financial: financial.comparability, financial_rpc_error: financial.financial.error,
  verdict_cache_write: { data: cacheWrite.data, error: cacheWrite.error },
  a14_blocked_before_model: (blockedRun as any).error, before_model_called: beforeModelCalled,
  no_paid_model_calls: true, no_permission_changes: true, no_meta_writes: true };
await mkdir(".e-nora-test-lab/a14-closeout-2026-11-05", { recursive: true });
await writeFile(".e-nora-test-lab/a14-closeout-2026-11-05/coverage.json", JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ cache: { data: cacheWrite.data, error: cacheWrite.error }, measurement: { status: assessment.status, reason_codes: assessment.reason_codes, sources: assessment.sources }, financial: { status: financial.comparability.status, reasons: financial.comparability.reason_codes, coverage: financial.comparability.coverage } }));
