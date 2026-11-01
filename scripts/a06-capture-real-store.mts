import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { runStockPlannerAgent } from "../apps/api/src/ai-runtime.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { agentOutputJsonSchema } from "../packages/ai/src/index.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult, redact } from "./ai-model-lab-core.js";
const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", ownerId = "ead62983-1938-4da6-af8f-13cb64d8cd3e", storeId = "5e84efa9-6e7f-4759-8b87-22119401bd81";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`, caseId = "a06_planificador_stock:real-store-runtime-2026-10-31";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
assert.ok(!report.active_batch && !report.cases.some((row) => row.id === caseId));
const checked = async (query: any) => { const result = await query; assert.ifError(result.error); return result.data; };
const user = await db.auth.admin.getUserById(ownerId); assert.equal(user.data.user?.email, "borregorafa99@gmail.com");
const [org, profile, member, subscriptions, store, version] = await Promise.all([
  checked(db.from("organizations").select("id,display_name,slug,status,timezone,currency_code,kind").eq("id", orgId).single()),
  checked(db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("id", ownerId).single()),
  checked(db.from("organization_members").select("organization_id,role").eq("organization_id", orgId).eq("user_id", ownerId).single()),
  checked(db.from("service_subscriptions").select("id,organization_id,plan_code,status,starts_at,ends_at").eq("organization_id", orgId)),
  checked(db.from("shopify_stores").select("connection_id").eq("organization_id", orgId).eq("id", storeId).single()),
  checked(db.from("agent_versions").select("prompt_version,agent_definitions!inner(code)").eq("agent_definitions.code", "a06_planificador_stock").eq("is_active", true).single()),
]);
const context: AuthContext = { user: { id: ownerId }, profile, memberships: [{ ...member, organization: org, accessSource: "membership" }], subscriptions };
let captured: any = null;
const result = await runStockPlannerAgent(env, context, orgId, store.connection_id, 30, { enforceManualRefreshCap: false,
  activityDigest: "cli-context-capture:a06-real-store-2026-10-31", beforeModel: async (prepared) => {
    captured = { runId: prepared.runId, system: prepared.systemPrompt, input: prepared.input, context: { snapshot: prepared.contextBlocks }, tools: prepared.tools.map((tool) => tool.name) };
    throw new Error("CLI_CONTEXT_CAPTURE_ONLY_NO_MODEL_API_CALL");
  } });
assert.ok(captured, JSON.stringify(result));
assert.ok(!result.ok && result.detail?.includes("CLI_CONTEXT_CAPTURE_ONLY"));
await checked(db.from("agent_runs").update({ deployment_version: "cli-lab:a06-real-context-capture", execution_mode: "shadow", stop_reason: "context_capture_only", estimated_cost_usd: null,
  activity_digest: "Contexto real A06 capturado antes de la llamada LLM. Sin API LLM ni tareas creadas. Comparación CLI con seis modelos." }).eq("id", captured.runId));
const system = captured.system + "\n\nSIMULACIÓN CLI A06: el contexto adjunto es el preparado por el runtime para la tienda seleccionada. No tienes herramientas de dominio en esta simulación ni permiso de escribir. No afirmes nuevas consultas, compras o tareas ejecutadas. Usa solo estos bloques y devuelve el contrato JSON completo. Se contrastan los mismos datos en seis modelos; no se inventan datos ausentes.";
const input = redact({ ...captured.input, context: captured.context });
const prompt = JSON.stringify(input), contextHash = hash(input), promptHash = hash(system), schemaFile = "a06-real-runtime.schema.json";
await writeFile(`${dir}/${schemaFile}`, JSON.stringify(agentOutputJsonSchema, null, 2));
await writeFile(`${dir}/a06_planificador_stock.${contextHash}.${promptHash}.input.json`, JSON.stringify({ system, input, prompt }, null, 2));
const base = report.cases.find((row) => row.agent_code === "a06_planificador_stock" && row.schema_file); assert.ok(base);
const models = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "gpt-6-luna", "gpt-6.1-sol", "gpt-6.1-terra"];
report.cases.push({ ...base, id: caseId, model_ids: models, label: "A06 · contexto runtime real · E-NORA Demo · 31/10/2026", source: "snapshot_replay", store_id: storeId, source_run_id: captured.runId,
  snapshot_at: new Date().toISOString(), prompt_hash: promptHash, context_hash: contextHash, prompt_version: `${version.prompt_version}+periodic-pending-dedupe`,
  context_labels: captured.context.snapshot.map((row: any) => row.label), allowed_tools: captured.tools, input_characters: system.length + prompt.length,
  timeout_ms: 600000, schema_file: schemaFile, schema_hash: hash(agentOutputJsonSchema), stock_benchmark: { scenario: "real_store_runtime_2026_10_31", reference_hash: hash(input) },
  limitations: ["Contexto preparado por el runtime real, con 30 días de ventas, doce semanas cuando están disponibles, inventario actual, niveles, histórico de tareas y propuestas pendientes. No es un escenario sintético nuevo.", "Los productos y pedidos de esta cuenta TEST incluyen datos de demostración; no equivalen a demanda de un negocio real.", "CLI sin herramientas dinámicas ni escrituras. Se compara planificación textual, no compras, creación de tareas ni latencia API.", "Una respuesta por modelo. Codex JSONL no acredita el ID servido. Astra excluido."] });
report.results.push(...models.map((model) => pendingResult(caseId, model)));
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
console.log(JSON.stringify({ case_id: caseId, source_run_id: captured.runId, blocks: captured.context.snapshot.length, input_characters: system.length + prompt.length, models }));
