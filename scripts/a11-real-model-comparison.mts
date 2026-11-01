import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { klaviyoEmailJsonSchema, klaviyoEmailGenerationOutputSchema, metaAdsJsonSchema, metaAdsOutputSchema, instagramPostJsonSchema, instagramPostOutputSchema, toAnthropicCompatibleOutputSchema, sanitizeGeneratedEmailHtml } from "../packages/ai/src/index.js";
import { buildAgentTools, CONSULTANT_ASSIGNMENT_PROMPT, loadConsultantAssignmentBlock } from "../apps/api/src/ai-runtime.js";
import { loadMarketingCreativeContext } from "../apps/api/src/marketing-creative-context.js";
import { marketingCreativeRequestSchema, marketingCreativeGuidance, marketingProductVisionImages, MARKETING_CREATIVE_METHOD_VERSION } from "../apps/api/src/marketing-creative-method.js";
import { marketingDraftStorageFields } from "../apps/api/src/marketing-draft-storage.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";

const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const org = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", store = "5e84efa9-6e7f-4759-8b87-22119401bd81", connection = "836364d9-1e29-4273-be44-29f73a53722a", owner = "ead62983-1938-4da6-af8f-13cb64d8cd3e";
const batch = "a11-real-2026-11-01-v1", dir = resolve(`.e-nora-test-lab/${batch}`);
const models = [
  { id: "claude-haiku-5-5", label: "Haiku", provider: "anthropic" }, { id: "claude-sonnet-5-5", label: "Sonnet", provider: "anthropic" }, { id: "claude-opus-5-5", label: "Opus", provider: "anthropic" },
  { id: "gpt-6-luna", label: "Luna", provider: "openai" }, { id: "gpt-6.1-sol", label: "Sol", provider: "openai" }, { id: "gpt-6.1-terra", label: "Terra", provider: "openai" },
];
const hash = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const uuid = (value: string) => { const h = hash(value); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
await mkdir(dir, { recursive: true });
let report: any;
try { report = JSON.parse(await readFile(`${dir}/report.json`, "utf8")); } catch (error: any) { if (error.code !== "ENOENT") throw error; }
if (!report) {
  const membership = await db.from("organization_members").select("role").eq("organization_id", org).eq("user_id", owner).eq("is_active", true).single();
  assert.ifError(membership.error); assert.equal(membership.data?.role, "owner");
  const version = await db.from("agent_versions").select("id,version,prompt_code,prompt_version,model,allowed_tools,approval_mode,agent_definitions!inner(code)").eq("agent_definitions.code", "a11_generador_marketing").eq("is_active", true).order("created_at", { ascending: false }).limit(1).single();
  assert.ifError(version.error); assert.ok(version.data);
  const prompt = await db.from("prompt_versions").select("content").eq("code", version.data.prompt_code).eq("version", version.data.prompt_version).single(); assert.ifError(prompt.error); assert.ok(prompt.data);
  const connectors = await db.from("integration_connections").select("connector_id").eq("organization_id", org).eq("status", "connected"); assert.ifError(connectors.error);
  const assignment = await loadConsultantAssignmentBlock(db, org);
  const productIds = ["84078332-b745-4405-9693-4f123024ab34", "f1557789-ff68-437f-8cc0-f6bb5395da23"];
  const brief = "Presenta The Collection Snowboard: Hydrogen como producto protagonista y Selling Plans Ski Wax como complemento opcional. Audiencia propuesta: personas adultas interesadas en snowboard; no hay segmento confirmado. Usa los nombres, precios, moneda, URLs y fotos exactos del catálogo. Español de España, voz elegante y señorial de E-NORA. No existe pack ni descuento confirmado. Sin urgencia, escasez, testimonios, atributos técnicos o beneficios no verificados. No inventes contacto, logo o garantía. Un argumento principal y CTA con destino real. Producto bien visible y texto legible en móvil. La imagen 1 corresponde al snowboard y la 2 a la cera. No añadas recursos visuales externos. Los datos de inventario no están verificados. Pieza nueva para revisión, sin publicar ni enviar.";
  const cases = [];
  for (const channel of ["email_klaviyo", "meta_ads", "instagram_organic"]) for (const mode of ["original", "guided"]) {
    const request = marketingCreativeRequestSchema.parse({ creative_mode: mode, product_ids: productIds });
    const context = await loadMarketingCreativeContext(db, org, store, `${brief} ${mode === "guided" ? "Presentación de producto, fotografía editorial, ritual y kit" : ""}`, request);
    assert.equal(context.products.length, 2);
    const images = marketingProductVisionImages(context.products, [], true); assert.equal(images.length, 2, "Both products must have actual photos");
    const assets = [];
    for (const [index, image] of images.entries()) {
      const path = resolve(dir, `product-${index}.jpg`);
      let bytes: Buffer;
      try { bytes = await readFile(path); } catch {
        const response = await fetch(image.url, { signal: AbortSignal.timeout(20000), redirect: "error" }); assert.equal(response.status, 200);
        assert.ok((response.headers.get("content-type") ?? "").startsWith("image/")); bytes = Buffer.from(await response.arrayBuffer());
        assert.ok(bytes.length > 100 && bytes.length < 5_000_000); await writeFile(path, bytes);
      }
      assets.push({ path, url: image.url, sha256: hash(bytes), mime: "image/jpeg" });
    }
    const runId = uuid(`${batch}:${channel}:${mode}`);
    const prepared = buildAgentTools(env, db, runId, org, version.data.allowed_tools, prompt.data.content, store, (connectors.data ?? []).map((row) => row.connector_id), ["client_visible"], { actorUserId: owner, approvalMode: version.data.approval_mode as any });
    const system = `${prepared.systemPrompt}\n\n${CONSULTANT_ASSIGNMENT_PROMPT}\n\n${marketingCreativeGuidance("create", channel)}`;
    const channelBrief = channel === "email_klaviyo" ? "Email comercial: HTML de tablas responsive con estilos inline, composición editorial completa, imágenes reales y CTA. No ocultes la pieza en creative_notes; el HTML debe ser utilizable. Si falta el destino de baja, señala el requisito pendiente sin inventarlo." : channel === "meta_ads" ? "Anuncio estático 4:5. El contrato nativo contiene copy y creative_notes: concreta composición, foto, jerarquía, posición, tamaños y texto sobreimpreso. No afirmes que has producido un PNG." : "Publicación estática de Instagram. Caption y creative_brief deben definir una composición 4:5 realizable, sin confundir instrucciones con imagen terminada. No propongas un vídeo sin producirlo.";
    const blocks = [{ label: "Brief del consultor", data: { channel, content_type: "campaign", brief: `${brief}\n${channelBrief}`, creative_method: { version: MARKETING_CREATIVE_METHOD_VERSION, ...request }, store_id: connection } }, ...context.blocks, assignment];
    const input = { run_id: runId, agent_code: "a11_generador_marketing", agent_version: version.data.version, organization_id: org, actor_user_id: owner, trigger_type: "manual", objective: `Generar borrador de marketing para ${channel} de tipo campaign`, allowed_tools: [], approval_mode: version.data.approval_mode };
    const schema = channel === "email_klaviyo" ? klaviyoEmailJsonSchema : channel === "meta_ads" ? metaAdsJsonSchema : instagramPostJsonSchema;
    const caseId = `${channel}-${mode}`;
    await writeFile(`${dir}/${caseId}.schema.json`, JSON.stringify(schema));
    cases.push({ id: caseId, channel, mode, system, input, blocks, assets, prompt_hash: hash(system), context_hash: hash(blocks), schema_hash: hash(schema), brief: `${brief}\n${channelBrief}` });
  }
  report = { batch, organization_id: org, store_id: store, connection_id: connection, owner: "borregorafa99@gmail.com", environment: "TEST", created_at: new Date().toISOString(), prompt_version: version.data.prompt_version, method_version: MARKETING_CREATIVE_METHOD_VERSION, models, cases, results: [], limitations: ["Simulación CLI con contexto real precargado; sin herramientas externas, envío ni publicación.", "Mismas imágenes y bytes para los seis modelos; caché, sobrecarga y transporte de CLI pueden diferir de API.", "Meta e Instagram entregan copy/dirección visual con el contrato actual; no generan un PNG terminado.", "Codex puede no informar el ID servido: se distingue modelo solicitado de verificado.", "Estimaciones API USD sobre uso CLI; no son facturas. Sin frecuencia mensual inventada."] };
}
assert.equal(report.batch, batch); assert.equal(report.cases.length, 6); assert.equal(report.models.length, 6);
let writes = Promise.resolve();
const save = () => { const contents = JSON.stringify(report, null, 2); writes = writes.then(async () => { await writeFile(`${dir}/report.tmp`, contents); await rename(`${dir}/report.tmp`, `${dir}/report.json`); }); return writes; };
await save();
if (process.argv.includes("--prepare-only")) { console.log(JSON.stringify({ prepared: report.cases.length, models: models.length, images_per_case: 2, directory: dir })); process.exit(0); }
const cliEnv = { ...process.env };
for (const key of Object.keys(cliEnv)) if (/^(ANTHROPIC_|OPENAI_|CODEX_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|SUPABASE_|NEXT_PUBLIC_|STRIPE_|META_|SHOPIFY_|KLAVIYO_)/.test(key)) delete cliEnv[key];
delete cliEnv.CLAUDECODE;
const cwd = resolve(tmpdir(), batch); await mkdir(cwd, { recursive: true });
const claude = resolve(homedir(), ".local/bin/claude.exe");
const invoke = (program: string, args: string[], input: string) => new Promise<{ stdout: string; stderr: string; exit: number | null }>((done) => {
  const child = spawn(program, args, { cwd, env: cliEnv, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }); let stdout = "", stderr = "", ended = false;
  const stop = () => { if (child.pid) try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch { child.kill(); } };
  const timer = setTimeout(() => { stderr += "\nCLI timeout after 300 seconds"; stop(); }, 300000);
  child.stdout.on("data", (data) => { stdout += data; if (stdout.length > 4_000_000) stop(); }); child.stderr.on("data", (data) => { stderr = (stderr + data).slice(-10000); });
  const finish = (exit: number | null) => { if (ended) return; ended = true; clearTimeout(timer); done({ stdout, stderr, exit }); };
  child.once("error", (error) => { stderr += error.message; finish(-1); }); child.once("close", finish); child.stdin.on("error", () => {}); child.stdin.end(input);
});
const modelFilter = process.argv.find((arg) => arg.startsWith("--model="))?.slice(8);
const caseFilter = process.argv.find((arg) => arg.startsWith("--case="))?.slice(7);
async function runModel(model: typeof models[number]) {
  for (const c of report.cases) {
    if (caseFilter && c.id !== caseFilter) continue;
    const previous = report.results.find((row: any) => row.model_id === model.id && row.case_id === c.id);
    if (previous && previous.status !== "running" && !process.argv.includes("--retry-failed")) continue;
    if (previous?.status === "completed") continue;
    const row: any = { case_id: c.id, model_id: model.id, model_label: model.label, provider: model.provider, status: "running", started_at: new Date().toISOString(), usage: { input: null, cached: null, cache_creation: null, output: null }, requested_model: model.id, actual_model: null, model_verified: false };
    if (previous) report.results.splice(report.results.indexOf(previous), 1, row); else report.results.push(row);
    await save(); console.log(JSON.stringify({ started: c.id, model: model.id }));
    const prompt = `CONTEXTO Y ENCARGO VERIFICADOS\n${JSON.stringify({ input: c.input, blocks: c.blocks })}\nLas imágenes adjuntas corresponden en orden a los productos del catálogo. No uses herramientas, red ni archivos adicionales: el paquete ya contiene los datos. Devuelve solo el JSON del contrato. No atribuyas rendimiento comercial al historial editorial.`;
    const schema = JSON.parse(await readFile(`${dir}/${c.id}.schema.json`, "utf8"));
    const args = model.provider === "anthropic" ? ["-p", "--model", model.id, "--output-format", "json", "--input-format", "stream-json", "--tools", "", "--safe-mode", "--strict-mcp-config", "--no-session-persistence", "--system-prompt", c.system, "--json-schema", JSON.stringify(toAnthropicCompatibleOutputSchema(schema))] : ["exec", "--ignore-user-config", "--disable", "shell_tool", "--disable", "unified_exec", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "--model", model.id, "-c", 'model_reasoning_effort="medium"', "--output-schema", `${dir}/${c.id}.schema.json`, ...c.assets.flatMap((asset: any) => ["--image", asset.path]), "--json", "-"];
    const content = [{ type: "text", text: prompt }, ...await Promise.all(c.assets.map(async (asset: any) => ({ type: "image", source: { type: "base64", media_type: asset.mime, data: (await readFile(asset.path)).toString("base64") } })))];
    const start = Date.now(); const result = await invoke(model.provider === "anthropic" ? claude : "codex", args, model.provider === "anthropic" ? JSON.stringify({ type: "user", message: { role: "user", content }, parent_tool_use_id: null, session_id: "default" }) + "\n" : `${c.system}\n\n${prompt}`);
    row.duration_ms = Date.now() - start;
    await writeFile(`${dir}/${c.id}.${model.id}.receipt.json`, JSON.stringify(result));
    let failure = result.exit === 0 ? "" : result.stderr.slice(-1800) || "CLI returned an error";
    if (model.provider === "anthropic") {
      let parsed: any; try { parsed = JSON.parse(result.stdout); } catch { failure ||= "Claude output was not JSON"; }
      row.raw_response = parsed?.structured_output ? JSON.stringify(parsed.structured_output) : parsed?.result ?? "";
      const served = Object.keys(parsed?.modelUsage ?? {}); row.actual_model = served.length === 1 ? parsed.modelUsage[served[0]!].canonicalModel ?? served[0] : null; row.model_verified = row.actual_model === model.id;
      if (parsed?.usage) row.usage = { input: parsed.usage.input_tokens ?? null, cached: parsed.usage.cache_read_input_tokens ?? null, cache_creation: parsed.usage.cache_creation_input_tokens ?? null, output: parsed.usage.output_tokens ?? null };
      row.provider_reported_cost = parsed?.total_cost_usd ?? null; if (parsed?.is_error) failure ||= row.raw_response;
    } else {
      const events = result.stdout.split(/\r?\n/).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
      row.raw_response = events.filter((e: any) => e.type === "item.completed" && e.item?.type === "agent_message").map((e: any) => e.item.text).join("\n");
      const completed = events.find((e: any) => e.type === "turn.completed");
      if (completed?.usage) row.usage = { input: completed.usage.input_tokens ?? null, cached: completed.usage.cached_input_tokens ?? null, cache_creation: completed.usage.cache_write_input_tokens ?? 0, output: completed.usage.output_tokens ?? null };
      if (!completed) failure ||= events.findLast((e: any) => e.type === "turn.failed" || e.type === "error")?.error?.message ?? "Codex turn did not complete";
      if (events.some((e: any) => e.type === "item.completed" && !["agent_message", "reasoning"].includes(e.item?.type))) failure ||= "Unexpected Codex tool use; excluded from controlled comparison";
    }
    const parsed = parseOutput(row.raw_response ?? "");
    const contract = c.channel === "email_klaviyo" ? klaviyoEmailGenerationOutputSchema : c.channel === "meta_ads" ? metaAdsOutputSchema : instagramPostOutputSchema;
    const valid = contract.safeParse(parsed);
    row.checks = { json_valid: Boolean(parsed), native_contract: valid.success, images_transmitted: c.assets.length, prompt_hash: c.prompt_hash, context_hash: c.context_hash };
    if (!valid.success) failure ||= `Native contract rejected: ${valid.error.message.slice(0,1200)}`;
    row.status = failure ? "failed" : "completed"; row.error = failure || null; row.finished_at = new Date().toISOString(); row.price = calculateLabApiPrice(model.id, row.usage);
    await save(); console.log(JSON.stringify({ finished: c.id, model: model.id, status: row.status, duration_ms: row.duration_ms, error: row.error?.slice(0,150), price: row.price }));
  }
}
if (!process.argv.includes("--persist-only")) await Promise.all(models.filter((m) => !modelFilter || m.id === modelFilter).map(runModel));
await save();
console.log(JSON.stringify({ results: report.results.length, completed: report.results.filter((r: any) => r.status === "completed").length, failed: report.results.filter((r: any) => r.status === "failed").length, report: `${dir}/report.json` }));
