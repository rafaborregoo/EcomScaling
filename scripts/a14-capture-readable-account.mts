import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { getMedicionMetaDiagnostic, runOperativaMetaAgent } from "../apps/api/src/ai-runtime.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { buildA14OperationalOutputContract } from "../packages/ai/src/index.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult, redact } from "./ai-model-lab-core.js";
const env = loadApiEnv(process.env); assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", ownerId = "ead62983-1938-4da6-af8f-13cb64d8cd3e", storeId = "5e84efa9-6e7f-4759-8b87-22119401bd81";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`, caseId = `a14_operativa_meta:real-store-runtime-2026-11-05-readable-account${""}`;
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8"))); assert.ok(!report.active_batch);
if (report.cases.some((row) => row.id === caseId)) { console.log(JSON.stringify({ already_captured: caseId })); process.exit(0); }
const checked = async (query: any) => { const value = await query; assert.ifError(value.error); return value.data; };
const user = await db.auth.admin.getUserById(ownerId); assert.equal(user.data.user?.email, "borregorafa99@gmail.com");
const [org, profile, member, subscriptions, store, version] = await Promise.all([
  checked(db.from("organizations").select("id,display_name,slug,status,timezone,currency_code,kind").eq("id", orgId).single()),
  checked(db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("id", ownerId).single()),
  checked(db.from("organization_members").select("organization_id,role").eq("organization_id", orgId).eq("user_id", ownerId).single()),
  checked(db.from("service_subscriptions").select("id,organization_id,plan_code,status,starts_at,ends_at").eq("organization_id", orgId)),
  checked(db.from("shopify_stores").select("connection_id").eq("organization_id", orgId).eq("id", storeId).single()),
  checked(db.from("agent_versions").select("prompt_version,agent_definitions!inner(code)").eq("agent_definitions.code", "a14_operativa_meta").eq("is_active", true).single()),
]);
const context: AuthContext = { user: { id: ownerId }, profile, memberships: [{ ...member, organization: org, accessSource: "membership" }], subscriptions };
const measurement = await getMedicionMetaDiagnostic(env, context, orgId, store.connection_id); assert.ok(measurement.ok, JSON.stringify(measurement));
let captured: any = null;
const result = await runOperativaMetaAgent(env, context, orgId, { enforceManualRefreshCap: false, activityDigest: `cli-capture:${caseId}`, beforeModel: async (prepared) => {
  captured = { runId: prepared.runId, system: prepared.systemPrompt, input: prepared.input, context: { snapshot: prepared.contextBlocks }, tools: prepared.tools.map((tool) => tool.name) };
  throw new Error("CLI_CONTEXT_CAPTURE_ONLY_NO_MODEL_API_CALL");
} }, store.connection_id);
assert.ok(captured, JSON.stringify(result)); assert.ok(!result.ok);
await checked(db.from("agent_runs").update({ deployment_version: "cli-lab:a14-context-capture-2026-11-05-readable-account", execution_mode: "shadow", stop_reason: "context_capture_only", estimated_cost_usd: null }).eq("id", captured.runId).eq("organization_id", orgId));
const system = captured.system + "\n\nSIMULACIÓN CLI A14: mismo contexto preparado por el runtime, sin herramientas dinámicas ni escrituras. No afirmes nuevas consultas ni acciones ejecutadas. No inventes datos ausentes. Devuelve exclusivamente el contrato JSON. Las propuestas quedan pendientes de revisión humana.";
const input = redact({ ...captured.input, context: captured.context });
assert.equal(input.context.snapshot.find((block: any) => block.label.startsWith("Veredicto determinista A24"))?.data.status, "unknown", "Revisar el contrato A14 para la cobertura nueva antes de registrar otra tanda");
const prompt = JSON.stringify(input), contextHash = hash(input), promptHash = hash(system), schemaFile = "a14-real-runtime-2026-11-05-readable-account.schema.json", contract = buildA14OperationalOutputContract("unknown");
await writeFile(`${dir}/${schemaFile}`, JSON.stringify(contract.jsonSchema, null, 2));
await writeFile(`${dir}/a14_operativa_meta.${contextHash}.${promptHash}.input.json`, JSON.stringify({ system, input, prompt }, null, 2));
const base = report.cases.find((row) => row.agent_code === "a14_operativa_meta"); assert.ok(base);
const models = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "gpt-6-luna", "gpt-6.1-sol", "gpt-6.1-terra"];
report.cases.push({ ...base, id: caseId, model_ids: models, label: "A14 · contexto runtime de E-NORA Demo · 05/11/2026", source: "snapshot_replay", store_id: storeId, source_run_id: captured.runId, snapshot_at: new Date().toISOString(), prompt_hash: promptHash, context_hash: contextHash, prompt_version: version.prompt_version, context_labels: captured.context.snapshot.map((row: any) => row.label), allowed_tools: captured.tools, input_characters: system.length + prompt.length, timeout_ms: 300000, schema_file: schemaFile, schema_hash: hash(contract.jsonSchema), limitations: ["Contexto del runtime real de esta tienda TEST; contiene datos de demostración, no resultados de un negocio real.", "Mismo snapshot y contrato en seis modelos sin Astra; una respuesta por modelo.", "Sin herramientas dinámicas, API pagada, cambios en Shopify ni tareas creadas. Codex puede no confirmar el ID servido.", "No se sustituye un coste, intervalo o moneda desconocidos por cero ni se acepta como hecho una hipótesis histórica."] });
report.results.push(...models.map((model) => pendingResult(caseId, model))); report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
console.log(JSON.stringify({ case_id: caseId, source_run_id: captured.runId, blocks: captured.context.snapshot.length, input_characters: system.length + prompt.length, models }));
