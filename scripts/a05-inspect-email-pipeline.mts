import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { loadEmailCampaignPipeline } from "../apps/api/src/email-campaign-pipeline.js";
import { buildAgentTools } from "../apps/api/src/ai-runtime.js";
const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const organizationId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04";
const storeId = "5e84efa9-6e7f-4759-8b87-22119401bd81";
const pipeline = await loadEmailCampaignPipeline(db, organizationId, storeId);
assert.ok("coverage" in pipeline, "pipeline query must return scoped coverage");
assert.equal(pipeline.errors?.length ?? 0, 0, JSON.stringify(pipeline.errors));
assert.equal(pipeline.store_id, storeId);
assert.notEqual(pipeline.status, "unavailable");
const missingStore = await loadEmailCampaignPipeline(db, organizationId, "00000000-0000-0000-0000-000000000000");
assert.equal(missingStore.status, "unavailable", "unknown store must not fall back to organization data");
assert.equal("campaigns" in missingStore, false);
const version = await db.from("agent_versions").select("allowed_tools,approval_mode,agent_definitions!inner(code)")
  .eq("agent_definitions.code", "a05_estrategia_campanas").eq("is_active", true).single();
assert.ifError(version.error);
const connectors = await db.from("integration_connections").select("provider").eq("organization_id", organizationId).in("status", ["connected", "syncing"]);
assert.ifError(connectors.error);
const connected = ["core", ...(connectors.data ?? []).map((row) => row.provider === "meta_ads" ? "meta" : row.provider)];
const declared = buildAgentTools(env, db, "00000000-0000-0000-0000-000000000000", organizationId, version.data!.allowed_tools, "Verification only", storeId, connected, ["client_visible"], { actorUserId: "0aa0090b-2a10-4f1e-881f-bdeb4f52b183", approvalMode: version.data!.approval_mode });
assert.ok(declared.tools.some((tool) => tool.name === "get_email_campaign_pipeline"), "pipeline must be declared to the actual A05 runtime");
assert.ok(declared.tools.some((tool) => tool.name === "klaviyo_entity_performance"), "historical investigation must be declared");
await mkdir(".e-nora-test-lab/ai-models", { recursive: true });
await writeFile(".e-nora-test-lab/ai-models/a05-email-pipeline.json", JSON.stringify(pipeline, null, 2));
console.log(JSON.stringify({ status: pipeline.status, coverage: pipeline.coverage, observed_campaign_counts: pipeline.observed_campaign_counts,
  calendar_returned: pipeline.nora_calendar?.length, drafts_returned: pipeline.nora_drafts?.length, errors: pipeline.errors,
  declared_tools: declared.tools.map((tool) => tool.name), store_isolation: "passed" }, null, 2));
