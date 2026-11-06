import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { buildA13OperationalOutputContract } from "../packages/ai/src/index.js";
import { A13_MODEL_DECISION } from "../packages/contracts/src/ai-model-decisions.js";
import { parseOutput } from "./ai-model-lab-core.js";
const env = loadApiEnv(process.env); assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const dir = ".e-nora-test-lab/ai-models", report = JSON.parse(await readFile(`${dir}/report.json`, "utf8"));
const caseId = "a13_operativa_shopify:real-store-runtime-2026-11-03-calendar", marker = "cli-lab:a13-real-store-2026-11-03";
const scenario = report.cases.find((row: any) => row.id === caseId); assert.ok(scenario);
const result = report.results.find((row: any) => row.case_id === caseId && row.model_id === A13_MODEL_DECISION.model && row.status === "completed"); assert.ok(result);
const original = buildA13OperationalOutputContract().schema.parse(parseOutput(result.raw_response)); assert.equal(original.proposed_writes.length, 0);
const output = { ...original, approval_required: false, warnings: [...original.warnings, "La cuenta TEST contiene datos de demostración; no representan resultados comerciales reales."] };
const source = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const org = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", store = "5e84efa9-6e7f-4759-8b87-22119401bd81", owner = "ead62983-1938-4da6-af8f-13cb64d8cd3e", connection = "836364d9-1e29-4273-be44-29f73a53722a";
const checked = async (query: any) => { const value = await query; assert.ifError(value.error); return value.data; };
const user = await db.auth.admin.getUserById(owner); assert.equal(user.data.user?.email, "borregorafa99@gmail.com");
await checked(db.from("organization_members").select("role").eq("organization_id", org).eq("user_id", owner).eq("is_active", true).single());
const existing = await checked(db.from("agent_runs").select("id").eq("organization_id", org).eq("deployment_version", marker).maybeSingle());
let runId = existing?.id;
if (!runId) {
  const version = await checked(db.from("agent_versions").select("id,agent_definitions!inner(code)").eq("agent_definitions.code", "a13_operativa_shopify").eq("is_active", true).single());
  runId = randomUUID(); const now = new Date().toISOString();
  await checked(db.from("agent_runs").insert({ id: runId, organization_id: org, store_id: store, agent_version_id: version.id, actor_user_id: owner, trigger_type: "manual", status: "succeeded", execution_mode: "shadow", lookback_days: 30,
    objective: "A13 · seis modelos con contexto runtime TEST, progreso mensual corregido y tareas existentes. Sol principal, Terra fallback. Simulación CLI, sin API pagada ni escrituras Shopify.", time_range: source.input.time_range, provider: "openai", model: result.model_id,
    input_tokens: result.usage.input, output_tokens: result.usage.output, cache_read_tokens: result.usage.cached, cache_creation_tokens: result.usage.cache_creation, estimated_cost_usd: null, cost_basis: null, latency_ms: result.duration_ms, started_at: now, finished_at: now, prompt_code: "a13_operativa_shopify_system", prompt_version: scenario.prompt_version, deployment_version: marker, stop_reason: "cli_simulation" }));
}
const snapshot = await checked(db.from("agent_context_snapshots").select("run_id").eq("run_id", runId).eq("context_level", "C2").maybeSingle());
if (!snapshot) await checked(db.from("agent_context_snapshots").insert({ run_id: runId, organization_id: org, context_level: "C2", snapshot: { blocks: source.input.context.snapshot, period: source.input.time_range, source_run_id: scenario.source_run_id, execution_source: "cli_simulation", served_model_verified: result.model_verified, original_output: original } }));
const existingOutput = await checked(db.from("agent_outputs").select("id").eq("run_id", runId).eq("organization_id", org).maybeSingle());
if (!existingOutput) await checked(db.from("agent_outputs").insert({ run_id: runId, organization_id: org, schema_version: "v1", output, approval_required: false, status: "published" }));
const digest = await db.rpc("organization_activity_digest", { target_organization_id: org }); assert.ifError(digest.error);
if (typeof digest.data === "string") await checked(db.from("agent_runs").update({ activity_digest: digest.data }).eq("id", runId).eq("organization_id", org));
const checks = [];
for (const [role, email] of [["cliente", "borregorafa99@gmail.com"], ["consultor", "rafael@noraapp.es"]]) {
  const link = await db.auth.admin.generateLink({ type: "magiclink", email: email! }); assert.ifError(link.error);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token }); assert.ifError(login.error); assert.ok(login.data.session);
  try {
    const response = await fetch(`http://localhost:${env.API_PORT}/v1/organizations/${org}/ai/operativa-shopify?connectionId=${connection}`, { headers: { authorization: `Bearer ${login.data.session.access_token}` } }); const body: any = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body)); assert.equal(body.run_id, runId); assert.deepEqual(body.output, output);
    checks.push({ role, same_output: true, run_id: runId, output_id: body.output_id, findings: body.output.findings.length, tasks: body.output.proposed_writes.length, status: body.output_status });
  } finally { await client.auth.signOut({ scope: "local" }); }
}
const page = await fetch("http://localhost:3001/shopify"); assert.equal(page.status, 200);
const receipt = { checked_at: new Date().toISOString(), case_id: caseId, primary: A13_MODEL_DECISION.model, fallback: A13_MODEL_DECISION.fallbackModel, checks, href: "/shopify#shop-pendiente", page_status: page.status, visual_review: "not_performed", no_tasks_created: true, no_shopify_writes: true };
await writeFile(".e-nora-test-lab/a13-real-2026-11-03/visibility.json", JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
