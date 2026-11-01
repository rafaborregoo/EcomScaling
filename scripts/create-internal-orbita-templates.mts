import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { internalReferenceEmailTemplates, internalReferenceReviewCriteria } from "./fixtures/internal-reference-email-templates.js";
import { renderInternalEmailTemplate } from "../packages/contracts/src/internal-email-template.js";
import { internalMailingPlaybookDraftSchema } from "../apps/api/src/marketing-playbook.js";
import { saveInternalMailingPlaybookDraft, listInternalMailingPlaybook, getInternalMailingPlaybookEntry } from "../apps/api/src/ai-runtime.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";

const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: admins, error } = await db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("platform_role", "platform_admin").eq("is_active", true).order("id").limit(1);
assert.ifError(error); assert.ok(admins?.[0], "real platform admin required");
const context: AuthContext = { user: { id: admins[0].id }, profile: admins[0], memberships: [], subscriptions: [] };
const dir = ".e-nora-test-lab/marketing-internal-templates"; await mkdir(dir, { recursive: true });
const receipts = [];
const comparisonInputs = [];
for (const preset of internalReferenceEmailTemplates) {
  const creativeContext = {
    when_to_use: preset.objective,
    when_not_to_use: "No implica datos, testimonios ni rendimiento demostrados. Cambiar el ejemplo por contexto verificado antes de entregar una pieza a una tienda.",
    persuasion_principles: ["Un argumento principal", "Jerarquía visual y continuidad de lectura", "Producto y CTA coherentes"],
    cta_guidance: "Una acción principal con destino verificado, sin condiciones comerciales inventadas.",
    risks: ["Copiar la referencia en lugar de adaptarla", "Inventar atributos o condiciones del producto", "Legibilidad insuficiente en móvil"],
    lesson: internalReferenceReviewCriteria.join(". "), ...preset.context,
  };
  const payload = internalMailingPlaybookDraftSchema.parse({ kind: "example", title: preset.title, objective: preset.objective,
    audience_tags: ["diseño", "hogar"], lifecycle_tags: ["presentación", "producto", "plantilla-interna"],
    content: { template: preset.template, raw_html: preset.html, ...creativeContext, sequence_arc: preset.structure,
      visual_direction: preset.template.description, do_not_copy: ["Marcas, fotografías y textos de las capturas originales", "Rótulos superpuestos del vídeo de referencia", "Métricas sociales, reseñas o afirmaciones de salud inventadas"] },
    evidence: { label: "inspiration", confidence: "low", limitations: "Demostración ficticia, sin test comercial ni generación final de A11. Imagen sintética creada para esta biblioteca." },
    source: { type: "internal", reference: preset.source, rights_confirmed: true } });
  const rendered = renderInternalEmailTemplate(preset.html, preset.template);
  for (const variable of preset.template.variables) assert.ok(preset.html.includes(`{{${variable.key}}}`), `unused variable: ${variable.key}`);
  assert.ok(rendered.includes("ÓRBITA") && preset.template.variables.some((field) => field.kind === "image"));
  assert.equal(/\{\{[a-z]/.test(rendered), false);
  assert.equal(/<script|onerror=|onclick=/i.test(rendered), false);
  await writeFile(`${dir}/${preset.template.key}.html`, rendered.replaceAll('src="/marketing-demo/', 'src="http://localhost:3001/marketing-demo/'));
  await writeFile(`${dir}/${preset.template.key}.template.json`, JSON.stringify(payload, null, 2));
  const { data: existing, error: findError } = await db.from("internal_mailing_playbook_entries").select("id,entry_key,version,status").eq("content->template->>key", preset.template.key).order("version", { ascending: false }).limit(1).maybeSingle();
  assert.ifError(findError);
  let id = existing?.id;
  if (!id) {
    const saved = await saveInternalMailingPlaybookDraft(env, context, payload);
    assert.ok(saved.ok, JSON.stringify(saved)); id = saved.data.id;
  }
  let saved = await getInternalMailingPlaybookEntry(env, context, id); assert.ok(saved.ok, JSON.stringify(saved));
  const contextChanged = Object.entries(creativeContext).some(([key, value]) => JSON.stringify(saved.data.content[key]) !== JSON.stringify(value));
  if (process.argv.includes("--refresh") && contextChanged) {
    // Curating context must preserve any content the administrator has edited.
    const revised = await saveInternalMailingPlaybookDraft(env, context, { ...payload, content: { ...saved.data.content, ...creativeContext, sequence_arc: preset.structure, visual_direction: preset.template.description } }, id); assert.ok(revised.ok, JSON.stringify(revised));
    id = revised.data.id; saved = await getInternalMailingPlaybookEntry(env, context, id); assert.ok(saved.ok, JSON.stringify(saved));
  }
  assert.ok(saved.data.content.template && saved.data.content.raw_html);
  assert.equal(saved.data.status, "draft");
  renderInternalEmailTemplate(saved.data.content.raw_html, saved.data.content.template);
  receipts.push({ key: preset.template.key, id, title: preset.title, status: saved.data.status, variables: preset.template.variables.length });
  const imageFiles = [...new Set(preset.template.variables.filter((item) => item.kind === "image" && item.example.startsWith("/marketing-demo/")).map((item) => item.example))];
  const assets = await Promise.all(imageFiles.map(async (path) => ({ path, sha256: createHash("sha256").update(await readFile(`apps/web/public${path}`)).digest("hex") })));
  comparisonInputs.push({ key: preset.template.key, entry_id: id, version: saved.data.version, origin: "manual_reconstruction_not_model_output", human_review: "pending", source: saved.data.source.reference,
    objective: saved.data.objective, context: creativeContext, structure: preset.structure, variables: saved.data.content.template.variables,
    html_sha256: createHash("sha256").update(saved.data.content.raw_html).digest("hex"), assets });
}
const listed = await listInternalMailingPlaybook(env, context); assert.ok(listed.ok, JSON.stringify(listed));
for (const receipt of receipts) assert.ok(listed.data.some((entry: any) => entry.id === receipt.id && entry.template_key === receipt.key));
const consultant = { ...context, profile: { ...context.profile, platform_role: "consultant" as const } };
const denied = await listInternalMailingPlaybook(env, consultant); assert.ok(!denied.ok && denied.statusCode === 403);
await writeFile(`${dir}/receipt.json`, JSON.stringify({ environment: "TEST", internal_only: true, templates: receipts }, null, 2));
await writeFile(`${dir}/benchmark-manifest.json`, JSON.stringify({ status: "prepared_not_executed", model_ids: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "gpt-6-luna", "gpt-6.1-sol", "gpt-6.1-terra"],
  criteria: internalReferenceReviewCriteria, protocol: "Mismo brief, producto verificado, contexto y recursos para todos. Adjuntar las mismas imágenes con un canal visual admitido, no solo sus URLs o descripciones; no atribuir observación visual si la CLI no transmite imágenes. Evaluar adaptación guiada (imagen de referencia más contexto) y creación desde cero (brief y principios, sin entregar HTML ni composición a copiar) por separado. Conservar la salida original del modelo y el coste completo; cualquier corrección humana se registra como otra versión. Sin publicar ni enviar. No se ha ejecutado la comparación ni entrenado pesos.", templates: comparisonInputs }, null, 2));
console.log(JSON.stringify({ internal_only: true, templates: receipts, consultant_access: 403 }, null, 2));
