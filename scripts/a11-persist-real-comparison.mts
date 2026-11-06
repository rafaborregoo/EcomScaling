import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { sanitizeGeneratedEmailHtml } from "../packages/ai/src/index.js";
import { reviewMarketingModelOutput } from "../apps/api/src/marketing-model-review.js";
import { marketingDraftStorageFields } from "../apps/api/src/marketing-draft-storage.js";
import { parseOutput } from "./ai-model-lab-core.js";

const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const dir = ".e-nora-test-lab/a11-real-2026-11-02-v4";
const report = JSON.parse(await readFile(`${dir}/report.json`, "utf8"));
assert.equal(report.excluded, undefined); assert.equal(report.owner, "borregorafa99@gmail.com");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const owner = "ead62983-1938-4da6-af8f-13cb64d8cd3e";
const ownerCheck = await db.from("organization_members").select("role").eq("organization_id", report.organization_id).eq("user_id", owner).eq("is_active", true).single(); assert.ifError(ownerCheck.error); assert.equal(ownerCheck.data?.role, "owner");
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const idFor = (caseId: string, model: string) => { const h = createHash("sha256").update(`${report.batch}:${caseId}:${model}`).digest("hex"); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
const manifest = report.cases.flatMap((c: any) => report.models.map((model: any) => {
  const result = report.results.find((row: any) => row.case_id === c.id && row.model_id === model.id);
  return { case_id: c.id, channel: c.channel, mode: c.mode, model_id: model.id, model_label: model.label, status: result?.status ?? "pending", error: result?.error ?? null, raw_response: result?.status === "failed" ? result.raw_response : null, price: result?.price ?? null, duration_ms: result?.duration_ms ?? null, model_verified: result?.model_verified ?? false, draft_id: result?.status === "completed" ? idFor(c.id, model.id) : null };
}));
const ids: string[] = [];
const previousReports = await Promise.all(["v1", "v2", "v3"].map(async (version) => JSON.parse(await readFile(`.e-nora-test-lab/a11-real-2026-11-02-${version}/report.json`, "utf8"))));
const previousRows = previousReports.flatMap((round, index) => round.results.filter((row: any) => index !== 2 || !row.case_id.startsWith("email_klaviyo")));
const auditHistory = { findings: ["Se descartó la primera tanda porque el orden de fotos no coincidía con el indicado en el brief.", "El esquema enviado al modelo omitía límites de longitud exigidos por el backend; se han alineado y comprobado.", "Crear una pieza incluía por defecto tres variantes. Ahora el contador solo se comunica cuando se solicitan ganchos/variantes.", "El histórico normal del agente excluye los borradores de laboratorio, para impedir que una prueba contamine la siguiente.", "El contrato social aún entrega texto y dirección visual, no un creativo compuesto. La comparación no lo presenta como PNG terminado."], baseline_failures: previousReports[1].results.filter((row: any) => row.status === "failed").map((row: any) => ({ case_id: row.case_id, model_id: row.model_id, error: row.error, raw_response: row.raw_response })), previous_known_cost: previousRows.reduce((sum: any, row: any) => ({ low: sum.low + (row.price?.low ?? 0), high: sum.high + (row.price?.high ?? 0) }), { low: 0, high: 0 }), unmeasured_interrupted: previousRows.filter((row: any) => row.status === "running").length };
for (const c of report.cases) for (const result of report.results.filter((row: any) => row.case_id === c.id && row.status === "completed")) {
  const output = parseOutput(result.raw_response) as Record<string, any>; assert.ok(output);
  const products = c.blocks.find((block: any) => block.label === "Productos de la tienda verificados").data.items;
  const audit = reviewMarketingModelOutput(c.channel, output, products);
  const email = c.channel === "email_klaviyo", ig = c.channel === "instagram_organic";
  const title = `[A11 · Comparación real] ${result.model_label} · ${email ? "Email" : ig ? "Instagram" : "Meta"} · ${c.mode === "original" ? "Desde cero" : "Guiado"}`;
  const plainText = email ? output.plain_text : ig ? `${output.caption}\n\n${output.hashtags.map((tag: string) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")}` : output.primary_text;
  const html = sanitizeGeneratedEmailHtml(email ? output.html : `<p>${escape(plainText).replace(/\n/g,"<br>")}</p>`);
  const storage = marketingDraftStorageFields({ preheader: email ? output.preheader : ig ? output.creative_brief : output.description, purpose: output.purpose ?? output.summary, tone: output.tone });
  const id = idFor(c.id, result.model_id); ids.push(id);
  const metadata = { batch: report.batch, case_id: c.id, mode: c.mode, model: result.model_id, model_label: result.model_label, synthetic: false, environment: "TEST", source: "cli_real_store_snapshot", estimated_api_cost_low: result.price?.low ?? null, estimated_api_cost_high: result.price?.high ?? null, cli_duration_ms: result.duration_ms, model_verified: result.model_verified, actual_model: result.actual_model, usage: result.usage, checks: audit.checks, issues: audit.issues, prompt_hash: c.prompt_hash, context_hash: c.context_hash, schema_hash: c.schema_hash, output_hash: createHash("sha256").update(result.raw_response).digest("hex"), products, images: c.assets.map((asset: any) => ({ url: asset.url, product_id: asset.product_id, title: asset.title, sha256: asset.sha256 })), limitations: report.limitations, manifest, verdict: report.verdict ?? null, editorial_review: result.editorial_review ?? null };
  const data = { id, organization_id: report.organization_id, created_by: owner, status: "draft", content_type: "campaign", request: { channel: c.channel, store_id: report.connection_id, brief: c.brief, creative_method: { version: report.method_version, creative_mode: c.mode }, ai_lab: metadata, lab_original_output: output, generated_field_overflow: storage.overflow, ...(email ? { document_schema: "marketing-email-html-v2", design: { version: 2, blocks: [{ id: `generated-${id}`, type: "html", props: { html } }] } } : {}) }, summary: output.summary, template_name: title, subject: (email ? output.subject : ig ? output.title : output.headline).slice(0,255), preheader: storage.preheader, from_name: email ? output.from_name : "E-NORA", reply_to: email ? output.reply_to : null, purpose: storage.purpose, audience: output.audience, locale: output.locale, tone: storage.tone, plain_text: plainText, html, blocks: email ? output.blocks : [{ type: "text", content: plainText, href: null, alt: null }, { type: "button", content: output.call_to_action, href: ig ? null : output.destination_url, alt: null }], personalization_tokens: email ? output.personalization_tokens : [], brand_colors: {}, verbatim_texts: [], compliance_notes: ["Comparación A11 con datos reales de la tienda TEST; revisión humana pendiente. No programar ni enviar.", ...output.compliance_notes], sources: output.sources, confidence: output.confidence, warnings: [...output.warnings, ...audit.issues, ...storage.warnings], scheduled_for: null };
  Object.assign(metadata, { audit_history: auditHistory });
  const existing = await db.from("marketing_content_drafts").select("id,request,version").eq("organization_id", report.organization_id).eq("id", id).maybeSingle(); assert.ifError(existing.error);
  if (!existing.data) {
    const insert = await db.from("marketing_content_drafts").insert(data); assert.ifError(insert.error);
    const saved = await db.from("marketing_content_drafts").select("*").eq("organization_id", report.organization_id).eq("id", id).single(); assert.ifError(saved.error);
    const versions = await db.from("marketing_content_draft_versions").insert({ draft_id: id, organization_id: report.organization_id, version: saved.data!.version, change_type: "generated", edited_by: owner, snapshot: saved.data }); assert.ifError(versions.error);
  } else {
    // Refresh only provenance/review metadata; preserve all human edits and versions.
    const update = await db.from("marketing_content_drafts").update({ request: { ...existing.data.request, ai_lab: metadata } }).eq("organization_id", report.organization_id).eq("id", id).eq("version", existing.data.version).select("id").single(); assert.ifError(update.error);
  }
}
await writeFile(`${dir}/draft-manifest.json`, JSON.stringify({ batch: report.batch, ids, results: manifest, verdict: report.verdict ?? null, checked_at: new Date().toISOString(), href: "/marketing?section=laboratorio" }, null, 2));
console.log(JSON.stringify({ saved_drafts: ids.length, results: manifest.length, completed: manifest.filter((row: any) => row.status === "completed").length, scheduled: 0, href: "/marketing?section=laboratorio" }));
