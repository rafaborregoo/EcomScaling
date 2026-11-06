import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { buildLeanOutputContract } from "../packages/ai/src/index.js";
import { A18_MODEL_DECISION } from "../packages/contracts/src/ai-model-decisions.js";
import { parseOutput } from "./ai-model-lab-core.js";
const env = loadApiEnv(process.env); assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const dir = ".e-nora-test-lab/ai-models", report = JSON.parse(await readFile(`${dir}/report.json`, "utf8"));
const caseId = "a18_plan_mensual:real-store-runtime-2026-11-06-monthly-v3", marker = "cli-lab:a18-monthly-2026-11-06-v3";
const scenario = report.cases.find((row: any) => row.id === caseId); assert.ok(scenario);
const result = report.results.find((row: any) => row.case_id === caseId && row.model_id === A18_MODEL_DECISION.model && row.status === "completed"); assert.ok(result);
const original = buildLeanOutputContract(["findings", "recommendations"]).schema.parse(parseOutput(result.raw_response));
const approval = original.proposed_writes.length > 0;
const output = { ...original, approval_required: approval, warnings: [...original.warnings, "Simulación CLI con datos TEST de demostración. No se han ejecutado herramientas dinámicas ni creado tareas; esta lectura permite revisar el modelo seleccionado."] };
const source = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const org = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", store = "5e84efa9-6e7f-4759-8b87-22119401bd81", owner = "ead62983-1938-4da6-af8f-13cb64d8cd3e";
const checked = async (query: any) => { const response = await query; assert.ifError(response.error); return response.data; };
const shop = await checked(db.from("shopify_stores").select("connection_id").eq("organization_id", org).eq("id", store).single());
const user = await db.auth.admin.getUserById(owner); assert.equal(user.data.user?.email, "borregorafa99@gmail.com");
const version = await checked(db.from("agent_versions").select("id,agent_definitions!inner(code)").eq("agent_definitions.code", "a18_plan_mensual").eq("is_active", true).single());
await checked(db.from("agent_versions").update({ model: A18_MODEL_DECISION.model }).eq("id", version.id));
// NULL usa 1/27 del diseño sin redondear a 0,17 en la columna numeric(6,2).
// El modelo cerrado se resuelve en la política compartida, sin duplicarlo en
// el override heredado (cuya restricción SQL no admite Sonnet 5.5).
await checked(db.from("platform_ai_agent_settings").upsert({ agent_code: "a18_plan_mensual", model: null, runs_per_day: null }, { onConflict: "agent_code" }));
const existing = await checked(db.from("agent_runs").select("id").eq("organization_id", org).eq("deployment_version", marker).maybeSingle());
const runId = existing?.id ?? randomUUID(), now = new Date().toISOString();
if (!existing) await checked(db.from("agent_runs").insert({ id: runId, organization_id: org, store_id: store, agent_version_id: version.id, actor_user_id: owner, trigger_type: "manual", status: "succeeded", execution_mode: "shadow", lookback_days: 90,
  objective: "A18 · Comparación de seis modelos con contexto runtime TEST, serie mensual, histórico de noventa días y backlog. Simulación CLI sin API pagada ni escrituras externas.", time_range: source.input.time_range, provider: A18_MODEL_DECISION.provider, model: result.model_id,
  input_tokens: result.usage.input, output_tokens: result.usage.output, cache_read_tokens: result.usage.cached, cache_creation_tokens: result.usage.cache_creation, estimated_cost_usd: null, cost_basis: null, latency_ms: result.duration_ms, started_at: now, finished_at: now, prompt_code: "a18_plan_mensual_system", prompt_version: scenario.prompt_version, deployment_version: marker, stop_reason: "cli_simulation" }));
const snapshot = await checked(db.from("agent_context_snapshots").select("run_id").eq("run_id", runId).eq("context_level", "C2").maybeSingle());
if (!snapshot) await checked(db.from("agent_context_snapshots").insert({ run_id: runId, organization_id: org, context_level: "C2", snapshot: { blocks: source.input.context.snapshot, period: source.input.time_range, source_run_id: scenario.source_run_id, execution_source: "cli_simulation", served_model_verified: result.model_verified, original_output: original } }));
const saved = await checked(db.from("agent_outputs").select("id").eq("run_id", runId).eq("organization_id", org).maybeSingle());
if (!saved) await checked(db.from("agent_outputs").insert({ run_id: runId, organization_id: org, schema_version: "v1", output, approval_required: approval, status: approval ? "pending_approval" : "published" }));
const checks = [];
for (const [role, email] of [["cliente", "borregorafa99@gmail.com"], ["consultor", "rafael@noraapp.es"]]) {
  const link = await db.auth.admin.generateLink({ type: "magiclink", email: email! }); assert.ifError(link.error);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token }); assert.ifError(login.error); assert.ok(login.data.session);
  try {
    const response = await fetch(`http://localhost:${env.API_PORT}/v1/organizations/${org}/ai/plan/month?days=90&connectionId=${shop.connection_id}`, { headers: { authorization: `Bearer ${login.data.session.access_token}` } });
    const body: any = await response.json(); assert.equal(response.status, 200, JSON.stringify(body)); assert.equal(body.run_id, runId); assert.deepEqual(body.output, output);
    checks.push({ role, run_id: runId, output_id: body.output_id, same_output: true, proposals: body.output.proposed_writes.length, status: body.output_status });
  } finally { await client.auth.signOut({ scope: "local" }); }
}
const page = await fetch("http://localhost:3001/tareas"); assert.equal(page.status, 200);
await mkdir(".e-nora-test-lab/a18-real-2026-11-06", { recursive: true });
const receipt = { at: new Date().toISOString(), case_id: caseId, primary: A18_MODEL_DECISION.model, fallback: A18_MODEL_DECISION.fallbackModel, checks, page_status: page.status, href: "/tareas#plan-mensual", visual_review: "not_performed", no_tasks_created: true, no_external_writes: true };
await writeFile(".e-nora-test-lab/a18-real-2026-11-06/visibility.json", JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));


