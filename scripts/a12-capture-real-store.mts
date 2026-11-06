import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { runEmailAnalystAgent } from "../apps/api/src/ai-runtime.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { agentOutputJsonSchema } from "../packages/ai/src/index.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult, redact } from "./ai-model-lab-core.js";
const env = loadApiEnv(process.env);
assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", ownerId = "ead62983-1938-4da6-af8f-13cb64d8cd3e", storeId = "5e84efa9-6e7f-4759-8b87-22119401bd81";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`, caseId = `a12_analista_email:real-store-runtime-2026-11-02${process.argv.includes("--normalized") ? "-normalized" : ""}`;
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
assert.ok(!report.active_batch);
if (report.cases.some((row) => row.id === caseId)) { console.log(JSON.stringify({ already_captured: caseId })); process.exit(0); }
const checked = async (query: any) => { const result = await query; assert.ifError(result.error); return result.data; };
const user = await db.auth.admin.getUserById(ownerId); assert.equal(user.data.user?.email, "borregorafa99@gmail.com");
const [org, profile, member, subscriptions, store, version] = await Promise.all([
  checked(db.from("organizations").select("id,display_name,slug,status,timezone,currency_code,kind").eq("id", orgId).single()),
  checked(db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("id", ownerId).single()),
  checked(db.from("organization_members").select("organization_id,role").eq("organization_id", orgId).eq("user_id", ownerId).single()),
  checked(db.from("service_subscriptions").select("id,organization_id,plan_code,status,starts_at,ends_at").eq("organization_id", orgId)),
  checked(db.from("shopify_stores").select("connection_id").eq("organization_id", orgId).eq("id", storeId).single()),
  checked(db.from("agent_versions").select("prompt_version,agent_definitions!inner(code)").eq("agent_definitions.code", "a12_analista_email").eq("is_active", true).single()),
]);
const context: AuthContext = { user: { id: ownerId }, profile, memberships: [{ ...member, organization: org, accessSource: "membership" }], subscriptions };
let captured: any = null;
const result = await runEmailAnalystAgent(env, context, orgId, store.connection_id, { enforceManualRefreshCap: false, activityDigest: `cli-capture:${caseId}`, beforeModel: async (prepared) => {
  captured = { runId: prepared.runId, system: prepared.systemPrompt, input: prepared.input, context: { snapshot: prepared.contextBlocks }, tools: prepared.tools.map((tool) => tool.name) };
  throw new Error("CLI_CONTEXT_CAPTURE_ONLY_NO_MODEL_API_CALL");
} });
assert.ok(captured, JSON.stringify(result)); assert.ok(!result.ok);
await checked(db.from("agent_runs").update({ deployment_version: "cli-lab:a12-context-capture-2026-11-02", execution_mode: "shadow", stop_reason: "context_capture_only", estimated_cost_usd: null }).eq("id", captured.runId).eq("organization_id", orgId));
const system = captured.system + "\n\nSIMULACIÓN CLI A12: contexto real preparado por el runtime. No tienes herramientas de dominio ni permiso de escritura. No afirmes nuevas consultas, tareas creadas o cambios en Klaviyo. No inventes datos ausentes. Devuelve exclusivamente el contrato JSON adjunto. Las propuestas son pendientes, no tareas ejecutadas.";
const input = redact({ ...captured.input, context: captured.context }) as any;
// These are aggregate counts, not email addresses; keep the runtime coverage intact.
for (let index = 0; index < captured.context.snapshot.length; index++) {
  const original = captured.context.snapshot[index]?.data?.catalog;
  const clean = input.context.snapshot[index]?.data?.catalog;
  for (const key of ["emails_que_conocemos", "emails_sin_cuerpo"]) if (clean && typeof original?.[key] === "number") clean[key] = original[key];
}
const prompt = JSON.stringify(input), contextHash = hash(input), promptHash = hash(system), schemaFile = "a12-real-runtime-2026-11-02.schema.json";
const contract = { jsonSchema: agentOutputJsonSchema };
await writeFile(`${dir}/${schemaFile}`, JSON.stringify(contract.jsonSchema, null, 2));
await writeFile(`${dir}/a12_analista_email.${contextHash}.${promptHash}.input.json`, JSON.stringify({ system, input, prompt }, null, 2));
const base = report.cases.find((row) => row.agent_code === "a12_analista_email"); assert.ok(base);
const models = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "gpt-6-luna", "gpt-6.1-sol", "gpt-6.1-terra"];
report.cases.push({ ...base, id: caseId, model_ids: models, label: "A12 · contexto real Klaviyo · octubre vs septiembre · 02/11/2026", source: "snapshot_replay", store_id: storeId, source_run_id: captured.runId, snapshot_at: new Date().toISOString(), prompt_hash: promptHash, context_hash: contextHash, prompt_version: version.prompt_version, context_labels: captured.context.snapshot.map((row: any) => row.label), allowed_tools: captured.tools, input_characters: system.length + prompt.length, timeout_ms: 300000, schema_file: schemaFile, schema_hash: hash(contract.jsonSchema), limitations: ["Datos reales de la cuenta TEST y contexto completo del runtime; algunos datos de demostración no representan actividad comercial real.", "Compara octubre completo con septiembre completo, sin confundir noviembre parcial con un mes finalizado.", "Mismo snapshot en seis modelos sin Astra, una respuesta por modelo. Sin llamadas a herramientas ni API pagada.", "No crea tareas ni modifica Klaviyo. El ID servido por Codex puede no confirmarse."] });
report.results.push(...models.map((model) => pendingResult(caseId, model))); report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
console.log(JSON.stringify({ case_id: caseId, source_run_id: captured.runId, blocks: captured.context.snapshot.length, input_characters: system.length + prompt.length, labels: captured.context.snapshot.map((row: any) => row.label), models }));
