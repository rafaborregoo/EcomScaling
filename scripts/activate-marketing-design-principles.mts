import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { saveInternalMailingPlaybookDraft, setInternalMailingPlaybookStatus } from "../apps/api/src/ai-runtime.js";
import { internalMailingPlaybookDraftSchema } from "../apps/api/src/marketing-playbook.js";
import { loadMarketingCreativeContext } from "../apps/api/src/marketing-creative-context.js";
import { marketingCreativeRequestSchema } from "../apps/api/src/marketing-creative-method.js";
import { internalReferenceEmailTemplates } from "./fixtures/internal-reference-email-templates.js";

const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const admin = await db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("platform_role", "platform_admin").eq("is_active", true).order("id").limit(1).single();
assert.ifError(admin.error); assert.ok(admin.data);
const context: AuthContext = { user: { id: admin.data.id }, profile: admin.data, memberships: [], subscriptions: [] };
const receipts: Array<{ id: string; title: string; status: string }> = [];
for (const preset of internalReferenceEmailTemplates) {
  const reference = `nora-marketing-method.v1:${preset.template.key}`;
  const existing = await db.from("internal_mailing_playbook_entries").select("id,status,title").eq("kind", "strategy").eq("source->>reference", reference).order("version", { ascending: false }).limit(1).maybeSingle();
  assert.ifError(existing.error);
  let entry = existing.data;
  if (!entry) {
    const payload = internalMailingPlaybookDraftSchema.parse({
      kind: "strategy", title: `Método · ${preset.title}`, objective: preset.objective,
      audience_tags: ["ecommerce"], lifecycle_tags: ["producto", "lanzamiento", "diseño", "email", "referencia-interna"],
      content: {
        when_to_use: preset.context?.when_to_use ?? preset.objective,
        when_not_to_use: preset.context?.when_not_to_use ?? "Sin evidencia del cliente no añadir claims, testimonios, urgencia ni condiciones comerciales.",
        sequence_arc: preset.structure, visual_direction: preset.template.description,
        persuasion_principles: preset.context?.persuasion_principles ?? ["Un argumento principal", "Jerarquía visual legible", "Continuidad entre producto, mensaje y CTA"],
        cta_guidance: preset.context?.cta_guidance ?? "Una acción principal con enlace verificado.",
        risks: preset.context?.risks ?? ["Copiar la referencia", "Inventar atributos del producto", "Texto ilegible en móvil"],
        do_not_copy: ["Fotografías y marcas de referencia", "Afirmaciones comerciales o de salud sin evidencia del cliente"],
      },
      evidence: { label: "inspiration", confidence: "low", limitations: "Método editorial abstraído; no es un test comercial ni demuestra rendimiento." },
      source: { type: "internal", reference, rights_confirmed: true },
    });
    const saved = await saveInternalMailingPlaybookDraft(env, context, payload);
    assert.ok(saved.ok, JSON.stringify(saved)); entry = saved.data;
  }
  assert.ok(entry);
  if (entry.status === "draft") {
    const published = await setInternalMailingPlaybookStatus(env, context, entry.id, "published");
    assert.ok(published.ok, JSON.stringify(published));
  } else assert.equal(entry.status, "published", "Do not reactivate a retired strategy automatically");
  receipts.push({ id: entry.id, title: entry.title, status: "published" });
}
const org = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04";
const store = "5e84efa9-6e7f-4759-8b87-22119401bd81";
const snapshot = await loadMarketingCreativeContext(db, org, store, "Lanzamiento de producto con fotografía editorial y CTA", marketingCreativeRequestSchema.parse({ creative_mode: "guided" }));
assert.ok(snapshot.products.length > 0, "Catalog must contain verified products");
assert.ok(snapshot.blocks.some((block) => block.label.includes("Principios") && JSON.stringify(block.data).includes('"available"')));
const selected = await loadMarketingCreativeContext(db, org, store, "Presenta este producto", marketingCreativeRequestSchema.parse({ product_ids: [snapshot.products[0].id] }));
assert.equal(selected.products.length, 1);
assert.equal(selected.products[0].id, snapshot.products[0].id);
const dir = ".e-nora-test-lab/skills-meta-ads";
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/integration-context.json`, JSON.stringify(snapshot, null, 2));
await writeFile(`${dir}/activation-receipt.json`, JSON.stringify({ environment: "TEST", methods: receipts, verified_context: snapshot.version, products: snapshot.products.length, explicit_product_checked: true, model_calls: 0, public_publications: 0, checked_at: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ published_principles: receipts.length, verified_products: snapshot.products.length, selected_product_verified: true, model_calls: 0, receipt: `${dir}/activation-receipt.json` }));
