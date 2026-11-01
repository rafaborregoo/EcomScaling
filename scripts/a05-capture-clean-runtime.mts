import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { runCampaignStrategist, buildAgentTools } from "../apps/api/src/ai-runtime.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { EMAIL_CAMPAIGN_PLANNING_GUIDANCE } from "../apps/api/src/email-campaign-pipeline.js";
import { campaignPlanJsonSchema } from "../packages/ai/src/index.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult, redact } from "./ai-model-lab-core.js";

const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04";
const ownerId = "ead62983-1938-4da6-af8f-13cb64d8cd3e";
const storeId = "5e84efa9-6e7f-4759-8b87-22119401bd81";
const dir = ".e-nora-test-lab/ai-models";
const reportPath = `${dir}/report.json`;
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(reportPath, "utf8")));
assert.ok(!report.active_batch, "no active lab batch");
const caseId = "a05_estrategia_campanas:clean-runtime-2026-10-31";
assert.ok(!report.cases.some((row) => row.id === caseId), "case already captured");
const checked = async (query: any) => { const result = await query; assert.ifError(result.error); return result.data; };
const owner = await db.auth.admin.getUserById(ownerId);
assert.equal(owner.data.user?.email, "borregorafa99@gmail.com");
const [org, profile, member, subscriptions, store, version] = await Promise.all([
  checked(db.from("organizations").select("id,display_name,slug,status,timezone,currency_code,kind").eq("id", orgId).single()),
  checked(db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("id", ownerId).single()),
  checked(db.from("organization_members").select("organization_id,role").eq("organization_id", orgId).eq("user_id", ownerId).single()),
  checked(db.from("service_subscriptions").select("id,organization_id,plan_code,status,starts_at,ends_at").eq("organization_id", orgId)),
  checked(db.from("shopify_stores").select("id,connection_id,is_active").eq("organization_id", orgId).eq("id", storeId).single()),
  checked(db.from("agent_versions").select("id,allowed_tools,approval_mode,prompt_code,prompt_version,agent_definitions!inner(code)").eq("agent_definitions.code", "a05_estrategia_campanas").eq("is_active", true).single()),
]);
assert.equal(org.display_name, "Prueba Borrego");
assert.equal(store.is_active, true);
const context: AuthContext = { user: { id: ownerId }, profile, memberships: [{ ...member, organization: org, accessSource: "membership" }], subscriptions };
const marker = `cli-context-capture:a05-clean:${randomUUID()}`;
let captured: any = null;
const result = await runCampaignStrategist(env, context, orgId, "custom", store.connection_id, {
  activityDigest: marker, enforceManualRefreshCap: false,
  beforeModel: async () => {
    const run = await checked(db.from("agent_runs").select("id,objective,time_range,lookback_days").eq("organization_id", orgId).eq("activity_digest", marker).single());
    const snapshot = await checked(db.from("agent_context_snapshots").select("snapshot").eq("run_id", run.id).single());
    const prompt = await checked(db.from("prompt_versions").select("content").eq("code", version.prompt_code).eq("version", version.prompt_version).single());
    const connectors = await checked(db.from("integration_connections").select("provider").eq("organization_id", orgId).in("status", ["connected", "syncing"]));
    const prepared = buildAgentTools(env, db, run.id, orgId, version.allowed_tools, prompt.content, storeId,
      ["core", ...connectors.map((row: any) => row.provider === "meta_ads" ? "meta" : row.provider)], ["client_visible"], { actorUserId: ownerId, approvalMode: version.approval_mode });
    const blocks = snapshot.snapshot.blocks;
    const start = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
    const end = new Date().toISOString().slice(0, 10);
    const requests: Array<[string, Record<string, unknown>]> = [
      ["get_shopify_product_catalog", { limit: 30 }], ["get_brand_profile", {}],
      ["klaviyo_performance_summary", { period_start: start, period_end: end }],
      ["klaviyo_measurement_health", {}],
      ["klaviyo_deliverability_health", { period_start: start, period_end: end }],
    ];
    const pipeline = blocks.find((block: any) => block.label.startsWith("Operación de email"))?.data;
    for (const campaign of pipeline?.campaigns ?? []) {
      if (campaign.operational_state === "sent" && campaign.messages?.[0]?.id) {
        requests.push(["klaviyo_email_content", { message_id: campaign.messages[0].id, account_id: campaign.account_id }]); break;
      }
    }
    for (const [name, args] of requests) {
      const tool = prepared.tools.find((item) => item.name === name);
      if (!tool) { blocks.push({ label: `Lectura adicional no disponible: ${name}`, data: { status: "unavailable" } }); continue; }
      const data = await tool.execute(args);
      blocks.push({ label: `Lectura real adicional preparada por el arnés (no elegida por el modelo): ${name}`, data });
      if (name === "get_shopify_product_catalog") {
        const next = (data as any)?.next_cursor;
        if (next) blocks.push({ label: "Segunda página del catálogo actual, preparada por el arnés", data: await tool.execute({ limit: 30, cursor: next }) });
      }
    }
    captured = { run, blocks, system: prepared.systemPrompt + "\n\n" + EMAIL_CAMPAIGN_PLANNING_GUIDANCE, allowed: prepared.tools.map((tool) => tool.name) };
    await checked(db.from("agent_context_snapshots").update({ snapshot: { ...snapshot.snapshot, blocks, execution_source: "cli_context_capture", tool_selection: "harness_preselected" } }).eq("run_id", run.id));
    throw new Error("CLI_CONTEXT_CAPTURE_ONLY_NO_MODEL_API_CALL");
  },
}, "Tras la limpieza autorizada de borradores y planificación de NORA, prepara una nueva planificación de email de dos meses para esta tienda: 01/11/2026–31/12/2026. Usa histórico, marca, productos actuales, estado de Klaviyo y conocimiento disponible. Razona una cadencia útil; considera alternativas sin descuento y no dupliques campañas que aún existan en Klaviyo. Cada propuesta debe tener propósito, audiencia y brief propios. Separa condiciones de preparación de bloqueos reales del canal. No ejecutar envíos ni publicar.", { startDate: "2026-11-01", endDate: "2026-12-31", market: "ES" });
assert.ok(captured, JSON.stringify(result));
assert.ok(!result.ok && result.detail?.includes("CLI_CONTEXT_CAPTURE_ONLY"), "provider call must be prevented");
await checked(db.from("agent_runs").update({ deployment_version: "cli-lab:a05-clean-context-capture", execution_mode: "shadow", stop_reason: "context_capture_only", estimated_cost_usd: null, activity_digest: "Preparación real de contexto y lecturas de herramientas por el arnés. Detenido antes del modelo; no es llamada API LLM ni prueba de selección de herramientas por el modelo." }).eq("id", captured.run.id));
const system = captured.system + "\n\nMODO SIMULACIÓN CLI: usa solo los bloques adjuntos. Las herramientas de dominio ya han sido ejecutadas por el arnés y se identifican como tales. No afirmes que elegiste o ejecutaste herramientas, ni una búsqueda RAG que no figure disponible. Devuelve solo el JSON nativo A05. Toda programación propuesta es un borrador sujeto a validaciones; no se ha autorizado ningún envío.";
const input = redact({ agent_code: "a05_estrategia_campanas", objective: captured.run.objective, time_range: captured.run.time_range, context: { snapshot: captured.blocks } });
const contextHash = hash(input);
const promptHash = hash(system);
const prompt = JSON.stringify(input);
const schemaFile = "a05-clean-runtime.schema.json";
await writeFile(`${dir}/${schemaFile}`, JSON.stringify(campaignPlanJsonSchema, null, 2));
await writeFile(`${dir}/a05_estrategia_campanas.${contextHash}.${promptHash}.input.json`, JSON.stringify({ system, input, prompt }, null, 2));
const base = report.cases.find((row) => row.id === "a05_estrategia_campanas:real-store-two-months-v2-2026-11");
assert.ok(base);
report.cases.push({ ...base, id: caseId, model_ids: ["gpt-6.1-sol"], source: "snapshot_replay", source_run_id: captured.run.id,
  snapshot_at: new Date().toISOString(), label: "A05 · nueva planificación tras limpieza NORA · contexto runtime 31/10/2026", context_hash: contextHash, prompt_hash: promptHash,
  prompt_version: `${version.prompt_version}+email-pipeline`, context_labels: captured.blocks.map((block: any) => block.label), allowed_tools: captured.allowed,
  limitations: ["Simulación de Sol por CLI. Contexto preparado por el runtime real con consultas actuales de TEST y lecturas adicionales ejecutadas por el arnés; no valida selección dinámica de herramientas por el modelo.", "No se invoca API LLM ni se envía/publica nada. El histórico y las campañas externas de Klaviyo se conservan.", "Codex JSONL no acredita el ID del modelo servido; se registra el modelo solicitado y model_verified=false.", "Una propuesta condicional no acredita consentimiento, inventario futuro, audiencia final o URL aprobada."],
  input_characters: system.length + prompt.length, timeout_ms: 600000, schema_file: schemaFile, schema_hash: hash(campaignPlanJsonSchema),
  campaign_benchmark: { scenario: "post_cleanup_real_runtime_email_pipeline", reference_hash: hash({ orgId, storeId, contextHash }) },
});
report.results.push(pendingResult(caseId, "gpt-6.1-sol"));
report.updated_at = new Date().toISOString();
await writeFile(`${reportPath}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2));
await rename(`${reportPath}.tmp`, reportPath);
console.log(JSON.stringify({ case_id: caseId, capture_run_id: captured.run.id, context_blocks: captured.blocks.length, input_characters: system.length + prompt.length, model: "gpt-6.1-sol" }));
