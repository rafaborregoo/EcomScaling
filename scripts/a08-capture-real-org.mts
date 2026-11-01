import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { runKnowledgeManagerAgent } from "../apps/api/src/ai-runtime.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { buildReadOnlyOutputContract } from "../packages/ai/src/index.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult, redact } from "./ai-model-lab-core.js";
const env = loadApiEnv(process.env); assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", actorId = "0aa0090b-2a10-4f1e-881f-bdeb4f52b183";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`, caseId = "a08_gestor_conocimiento:real-org-methodology-runtime-2026-10-31";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
assert.ok(!report.active_batch && !report.cases.some((row) => row.id === caseId));
const checked = async (query: any) => { const result = await query; assert.ifError(result.error); return result.data; };
const user = await db.auth.admin.getUserById(actorId); assert.equal(user.data.user?.email, "rafael@noraapp.es");
const [org, profile, assignment, subscriptions, version] = await Promise.all([
  checked(db.from("organizations").select("id,display_name,slug,status,timezone,currency_code,kind").eq("id", orgId).single()),
  checked(db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("id", actorId).single()),
  checked(db.from("consultant_assignments").select("consultant_user_id").eq("organization_id", orgId).eq("consultant_user_id", actorId).single()),
  checked(db.from("service_subscriptions").select("id,organization_id,plan_code,status,starts_at,ends_at").eq("organization_id", orgId)),
  checked(db.from("agent_versions").select("prompt_version,agent_definitions!inner(code)").eq("agent_definitions.code", "a08_gestor_conocimiento").eq("is_active", true).single()),
]);
assert.equal(org.display_name, "Prueba Borrego"); assert.ok(assignment);
const context: AuthContext = { user: { id: actorId }, profile, subscriptions, memberships: [{ organization_id: orgId, role: "consultant", organization: org, accessSource: "consultant_assignment" }] };
let captured: any = null;
const result = await runKnowledgeManagerAgent(env, context, orgId, { activityDigest: "cli-context-capture:a08-real-org-2026-10-31", beforeModel: async (prepared) => {
  const catalog = prepared.contextBlocks.find((row) => row.label.startsWith("Catalogo de conocimiento"))?.data as any;
  assert.equal(catalog.coverage_status, "complete", JSON.stringify(catalog));
  assert.ok(catalog.global_documents > 0 && catalog.organization_documents > 0, "authorized global methodology must be included");
  const sourceTitle = catalog.semantic_candidates?.[0]?.source_title ?? catalog.documents?.[0]?.title;
  const tool = prepared.tools.find((row) => row.name === "search_knowledge");
  if (tool && sourceTitle) {
    const data = await tool.execute({ query: String(sourceTitle).slice(0, 500) });
    prepared.contextBlocks.push({ label: "Búsqueda concreta de contraste ejecutada por el arnés antes de la simulación; no seleccionada por el modelo", data });
  }
  captured = { runId: prepared.runId, system: prepared.systemPrompt, input: prepared.input, context: { snapshot: prepared.contextBlocks }, tools: prepared.tools.map((tool) => tool.name), catalog };
  await checked(db.from("agent_context_snapshots").update({ snapshot: { blocks: prepared.contextBlocks, period: prepared.input.time_range,
    execution_source: "cli_context_capture", tool_selection: "harness_preselected" } }).eq("run_id", prepared.runId));
  throw new Error("CLI_CONTEXT_CAPTURE_ONLY_NO_MODEL_API_CALL");
} });
assert.ok(captured, JSON.stringify(result)); assert.ok(!result.ok && result.detail?.includes("CLI_CONTEXT_CAPTURE_ONLY"));
await checked(db.from("agent_runs").update({ deployment_version: "cli-lab:a08-real-context-capture", execution_mode: "shadow", stop_reason: "context_capture_only", estimated_cost_usd: null,
  activity_digest: "A08: contexto real autorizado y una búsqueda de contraste preseleccionada por el arnés. Detenido antes de la API LLM; solo auditoría interna, sin escrituras editoriales." }).eq("id", captured.runId));
const system = captured.system + "\n\nSIMULACIÓN CLI INTERNA A08: recibe el catálogo y contadores reales preparados por runtime, con una lectura concreta de search_knowledge preparada por el arnés cuando esté disponible. No puedes usar herramientas ni afirmar que elegiste o ejecutaste nuevas búsquedas. No hay permiso de crear tareas, modificar ni fusionar documentos. Devuelve solo JSON del contrato de lectura. Usa los contadores y límites reales adjuntos; no inventes carencias ni recurrencia a partir de muestras.";
const input = redact({ ...captured.input, context: captured.context });
const prompt = JSON.stringify(input), contextHash = hash(input), promptHash = hash(system), contract = buildReadOnlyOutputContract(), schemaFile = "a08-real-org-read-only.schema.json";
await writeFile(`${dir}/${schemaFile}`, JSON.stringify(contract.jsonSchema, null, 2));
await writeFile(`${dir}/a08_gestor_conocimiento.${contextHash}.${promptHash}.input.json`, JSON.stringify({ system, input, prompt }, null, 2));
const base = report.cases.find((row) => row.agent_code === "a08_gestor_conocimiento" && row.schema_file); assert.ok(base);
const models = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "gpt-6-luna", "gpt-6.1-sol", "gpt-6.1-terra"];
report.cases.push({ ...base, id: caseId, model_ids: models, label: "A08 · catálogo real y metodología global autorizada · 31/10/2026", source: "snapshot_replay", store_id: null,
  source_run_id: captured.runId, snapshot_at: new Date().toISOString(), prompt_hash: promptHash, context_hash: contextHash,
  prompt_version: `${version.prompt_version}+authorized-methodology-scope`, context_labels: captured.context.snapshot.map((row: any) => row.label), allowed_tools: captured.tools,
  input_characters: system.length + prompt.length, timeout_ms: 600000, schema_file: schemaFile, schema_hash: hash(contract.jsonSchema),
  limitations: ["Snapshot de runtime real: catálogo global autorizado y documentos client_visible de Prueba Borrego, sin notas privadas de organizaciones ni system_only.", "Se capturó una búsqueda real de contraste ejecutada por el arnés. La CLI no valida selección dinámica de herramientas ni escritura de documentos.", "A08 es una auditoría interna de consultor/plataforma y de solo lectura; no debe generar tareas del cliente. Se respetan muestras y fragmentos parciales.", "Una respuesta por modelo, sin Astra. Codex JSONL no acredita el ID servido. Costes CLI solo orientan equivalencias API."] });
report.results.push(...models.map((model) => pendingResult(caseId, model)));
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
await writeFile(`${dir}/a08-real-org-reference.json`, JSON.stringify({ case_id: caseId, source_run_id: captured.runId,
  coverage_status: captured.catalog.coverage_status, total: captured.catalog.total_active_documents, global: captured.catalog.global_documents,
  organization: captured.catalog.organization_documents, indexed: captured.catalog.indexed_documents, sample: captured.catalog.document_sample,
  semantic_candidates: captured.catalog.semantic_candidates.length, gap_signals: captured.catalog.knowledge_gap_signals,
  expectations: ["Distinguir global/organización y la muestra de cobertura total.", "No confirmar duplicados completos con similitud o primer fragmento.", "Sin tareas ni escrituras editoriales.", "No atribuir una búsqueda vacía a falta demostrada de un documento ni a causalidad de decisiones."] }, null, 2));
console.log(JSON.stringify({ case_id: caseId, run_id: captured.runId, blocks: captured.context.snapshot.length, input_characters: system.length + prompt.length,
  documents: captured.catalog.total_active_documents, global: captured.catalog.global_documents, organization: captured.catalog.organization_documents, sample: captured.catalog.document_sample.included_documents }));
