import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { agentOutputSchema } from "../packages/ai/src/index.js";
import { A06_MODEL_DECISION } from "../packages/contracts/src/ai-model-decisions.js";
import { getStockPlannerDiagnostic } from "../apps/api/src/ai-runtime.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { parseOutput } from "./ai-model-lab-core.js";
const env = loadApiEnv(process.env); assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const dir = ".e-nora-test-lab/ai-models", report = JSON.parse(await readFile(`${dir}/report.json`, "utf8"));
const caseId = "a06_planificador_stock:real-store-runtime-2026-10-31", marker = "cli-lab:a06-real-store-2026-10-31";
const scenario = report.cases.find((row: any) => row.id === caseId); assert.ok(scenario);
const result = report.results.find((row: any) => row.case_id === caseId && row.model_id === A06_MODEL_DECISION.model && row.status === "completed"); assert.ok(result);
const output = agentOutputSchema.parse(parseOutput(result.raw_response));
const actualInput = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", storeId = "5e84efa9-6e7f-4759-8b87-22119401bd81";
const checked = async (query: any) => { const value = await query; assert.ifError(value.error); return value.data; };
const org = await checked(db.from("organizations").select("id,display_name,slug,status,timezone,currency_code,kind").eq("id", orgId).single()); assert.equal(org.display_name, "Prueba Borrego");
const store = await checked(db.from("shopify_stores").select("id,connection_id,is_active").eq("id", storeId).eq("organization_id", orgId).single()); assert.equal(store.is_active, true);
const owner = await db.auth.admin.getUserById("ead62983-1938-4da6-af8f-13cb64d8cd3e"); assert.equal(owner.data.user?.email, "borregorafa99@gmail.com");
const previous = await checked(db.from("agent_runs").select("id,agent_outputs!inner(id)").eq("organization_id", orgId).eq("deployment_version", marker).maybeSingle());
let runId = previous?.id;
if (!runId) {
  const version = await checked(db.from("agent_versions").select("id,agent_definitions!inner(code)").eq("agent_definitions.code", "a06_planificador_stock").eq("is_active", true).single());
  runId = randomUUID(); const now = new Date().toISOString();
  await checked(db.from("agent_runs").insert({ id: runId, organization_id: orgId, store_id: storeId, agent_version_id: version.id,
    actor_user_id: "ead62983-1938-4da6-af8f-13cb64d8cd3e", trigger_type: "manual", status: "succeeded", execution_mode: "shadow", lookback_days: 30,
    objective: "SIMULACIÓN CLI A06 con contexto runtime real del 31/10/2026; seis modelos comparados y Haiku conservado. Sin API LLM ni tareas creadas. Referencias de flow inaplicables se conservan como defecto de la respuesta.",
    time_range: actualInput.input.time_range, provider: "anthropic", model: result.actual_model ?? result.model_id,
    input_tokens: Number(result.usage.input ?? 0) + Number(result.usage.cached ?? 0) + Number(result.usage.cache_creation ?? 0), output_tokens: result.usage.output,
    cache_read_tokens: result.usage.cached, cache_creation_tokens: result.usage.cache_creation, estimated_cost_usd: null, cost_basis: null,
    latency_ms: result.duration_ms, started_at: now, finished_at: now, prompt_code: "a06_planificador_stock_system", prompt_version: "v9+pending-dedupe-cli", deployment_version: marker, stop_reason: "cli_simulation" }));
  await checked(db.from("agent_context_snapshots").insert({ run_id: runId, organization_id: orgId, context_level: "C2", snapshot: { blocks: actualInput.input.context.snapshot,
    period: actualInput.input.time_range, source_run_id: scenario.source_run_id, execution_source: "cli_simulation", dynamic_tool_selection_verified: false } }));
  await checked(db.from("agent_outputs").insert({ run_id: runId, organization_id: orgId, schema_version: "v1", output, approval_required: true, status: "pending_approval" }));
  const digest = await db.rpc("organization_activity_digest", { target_organization_id: orgId });
  if (!digest.error && typeof digest.data === "string") await checked(db.from("agent_runs").update({ activity_digest: digest.data }).eq("id", runId));
}
for (const [id, email, kind] of [["ead62983-1938-4da6-af8f-13cb64d8cd3e", "borregorafa99@gmail.com", "client"], ["0aa0090b-2a10-4f1e-881f-bdeb4f52b183", "rafael@noraapp.es", "consultant"]] as const) {
  const user = await db.auth.admin.getUserById(id); assert.equal(user.data.user?.email, email);
  const profile = await checked(db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("id", id).single());
  const member = kind === "client" ? await checked(db.from("organization_members").select("role").eq("organization_id", orgId).eq("user_id", id).single())
    : await checked(db.from("consultant_assignments").select("consultant_user_id").eq("organization_id", orgId).eq("consultant_user_id", id).single());
  assert.ok(member);
  const context: AuthContext = { user: { id }, profile, subscriptions: [], memberships: [{ organization_id: orgId, organization: org,
    role: kind === "client" ? member.role : "consultant", accessSource: kind === "client" ? "membership" : "consultant_assignment" }] };
  const read = await getStockPlannerDiagnostic(env, context, orgId, store.connection_id, 30); assert.ok(read.ok, JSON.stringify(read));
  assert.equal(read.data.run_id, runId); assert.ok(read.data.output);
  const pending = (read.data as any).pending_outputs; assert.ok(Array.isArray(pending));
  assert.ok(pending.some((row: any) => row.output_id === "5da280e0-2588-4e7f-99cc-749075b40fc4"), "old pending proposals must stay visible");
  assert.ok(pending.some((row: any) => row.output_id === read.data.output_id), "new pending proposals must stay visible");
  console.log(JSON.stringify({ viewer: kind, run_id: runId, output_id: read.data.output_id, pending_outputs: pending.length,
    new_tasks: (read.data.output as any).proposed_writes.map((write: any) => write.title) }));
}
