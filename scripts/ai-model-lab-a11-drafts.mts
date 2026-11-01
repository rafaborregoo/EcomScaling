import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { sanitizeGeneratedEmailHtml } from "../packages/ai/src/index.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { marketingDraftStorageFields } from "../apps/api/src/marketing-draft-storage.js";

const dir = ".e-nora-test-lab/ai-models";
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(`${dir}/report.json`, "utf8")),
);
assert.ok(
  process.env.SUPABASE_URL?.includes(
    `://${report.target.project_ref}.supabase.co`,
  ),
  "wrong_project",
);
assert.equal(report.target.project_ref, "kopcblejsxpkxoykldyh");
assert.equal(report.target.owner, "borregorafa99@gmail.com");
const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const ownerId = "ead62983-1938-4da6-af8f-13cb64d8cd3e";
const { data: membership, error: me } = await db
  .from("organization_members")
  .select("user_id,role,is_active")
  .eq("user_id", ownerId)
  .eq("organization_id", report.target.organization_id)
  .eq("is_active", true)
  .single();
assert.ifError(me);
assert.equal(membership!.role, "owner");
const { data: store, error: se } = await db
  .from("shopify_stores")
  .select(
    "id,connection_id,organization_id,integration_connections!inner(status)",
  )
  .eq("id", "5e84efa9-6e7f-4759-8b87-22119401bd81")
  .eq("organization_id", report.target.organization_id)
  .single();
assert.ifError(se);
const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const rows = [];
for (const c of report.cases.filter(
  (c) => c.agent_code === "a11_generador_marketing" && c.schema_file,
)) {
  const input = JSON.parse(
    await readFile(
      `${dir}/${c.agent_code}.${c.context_hash}.${c.prompt_hash}.input.json`,
      "utf8",
    ),
  );
  const context = input.input.context.snapshot[0].data;
  const channel = context.channel as string;
  for (const result of report.results.filter(
    (r) => r.case_id === c.id && r.model_id !== "gpt-6-astra",
  )) {
    assert.equal(result.status, "completed");
    assert.equal(result.checks.native_contract, true);
    const o = JSON.parse(result.raw_response);
    const label = report.models.find((m) => m.id === result.model_id)!.label;
    const price = calculateLabApiPrice(result.model_id, result.usage);
    assert.ok(price);
    const h = createHash("sha256")
      .update(`a11-human-review-v1:${result.id}`)
      .digest("hex");
    const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
    const email = channel === "email_klaviyo";
    const ig = channel === "instagram_organic";
    const title = `[LAB A11] ${email ? "Email" : ig ? "Instagram" : "Meta"} · ${label}`;
    const hashtags = ig
      ? o.hashtags
          .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
          .join(" ")
      : "";
    const body = email
      ? o.plain_text
      : ig
        ? `${o.caption}\n\n${hashtags}`
        : o.primary_text;
    const html = sanitizeGeneratedEmailHtml(
      email ? o.html : `<p>${escape(body).replace(/\n/g, "<br>")}</p>`,
    );
    const storage = marketingDraftStorageFields({
      preheader: email
        ? o.preheader
        : ig
          ? o.creative_brief
          : (o.description ?? ""),
      purpose: email ? o.purpose : o.summary,
      tone: o.tone,
    });
    rows.push({
      id,
      organization_id: report.target.organization_id,
      created_by: ownerId,
      content_type: "campaign",
      status: "draft",
      request: {
        channel,
        source: "ai_model_lab",
        store_id: store!.connection_id,
        brief: context.brief,
        ...(email
          ? {
              document_schema: "marketing-email-html-v2",
              design: {
                version: 2,
                blocks: [{ id: `lab-${id}`, type: "html", props: { html } }],
              },
            }
          : {}),
        ai_lab: {
          batch: "a11-human-review-v1",
          result_id: result.id,
          case_id: c.id,
          model: result.model_id,
          model_label: label,
          synthetic: true,
          estimated_api_cost_low: price!.low,
          estimated_api_cost_high: price!.high,
          cli_duration_ms: result.duration_ms,
          model_verified: result.model_verified,
          output_hash: createHash("sha256")
            .update(result.raw_response)
            .digest("hex"),
        },
        // Se guarda la respuesta íntegra para cotejarla con la pieza sin regenerar.
        lab_original_output: o,
        generated_field_overflow: storage.overflow,
      },
      summary: `PRUEBA A11 · ${label}. Datos sintéticos. API estimada ${price!.low.toFixed(4)}–${price!.high.toFixed(4)} USD; no es factura. ${o.summary}`,
      template_name: title,
      subject: (email ? o.subject : ig ? o.title : o.headline).slice(0, 255),
      preheader: storage.preheader,
      from_name: email ? o.from_name : "Nube",
      reply_to: email ? o.reply_to : null,
      purpose: storage.purpose,
      audience: o.audience,
      locale: o.locale,
      tone: storage.tone,
      plain_text: body,
      html,
      blocks: email
        ? o.blocks
        : [
            {
              type: "text",
              content: ig ? o.caption : o.primary_text,
              href: null,
              alt: null,
            },
            {
              type: "button",
              content: o.call_to_action,
              href: ig ? null : o.destination_url,
              alt: null,
            },
          ],
      personalization_tokens: email ? o.personalization_tokens : [],
      brand_colors: context.brand.colors ?? {},
      verbatim_texts: email ? ["Hecho para tus ideas de cada día."] : [],
      compliance_notes: [
        "Prueba de laboratorio solicitada para revisión humana. Producto y marca sintéticos; no programar ni enviar.",
        `Modelo solicitado: ${result.model_id}. ${result.model_verified ? "Confirmado por Claude CLI." : "Codex no confirma el ID servido."}`,
        ...o.compliance_notes,
        ...(ig ? [o.creative_brief] : []),
        ...(!email && !ig ? o.creative_notes : []),
      ],
      sources: o.sources,
      confidence: o.confidence,
      warnings: [
        "LAB A11: contenido sintético para comparar modelos; revisión humana pendiente.",
        ...o.warnings,
        ...storage.warnings,
      ],
      scheduled_for: null,
    });
  }
}
assert.equal(rows.length, 18);
await writeFile(
  `${dir}/a11-drafts.prepared.json`,
  JSON.stringify(rows, null, 2),
);
if (!process.argv.includes("--apply")) {
  console.log(
    JSON.stringify({
      prepared: rows.length,
      organization: report.target.organization_id,
      store: store!.id,
      owner: report.target.owner,
      status: "draft",
      apply_required: true,
    }),
  );
  process.exit(0);
}
// Una inserción atómica. IDs deterministas; repetir no sobrescribe revisiones humanas.
const { error } = await db
  .from("marketing_content_drafts")
  .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
assert.ifError(error);
const { data: saved, error: re } = await db
  .from("marketing_content_drafts")
  .select("*")
  .in(
    "id",
    rows.map((r) => r.id),
  );
assert.ifError(re);
assert.equal(saved!.length, 18);
assert.ok(
  saved!.every((r) => r.organization_id === report.target.organization_id),
);
const { data: versions, error: versionError } = await db.from("marketing_content_draft_versions").select("draft_id,version").in("draft_id", rows.map(r => r.id));
assert.ifError(versionError);
const missingVersions = saved!.filter(d => d.version === 1 && !versions!.some(v => v.draft_id === d.id && v.version === d.version));
if (missingVersions.length) {
  const { error } = await db.from("marketing_content_draft_versions").insert(missingVersions.map(d => ({draft_id:d.id,organization_id:d.organization_id,version:d.version,change_type:"generated",edited_by:ownerId,snapshot:d})));
  assert.ifError(error);
}
const manifest = saved!.map((r) => ({
  id: r.id,
  name: r.template_name,
  status: r.status,
  channel: r.request.channel,
  model: r.request.ai_lab.model,
  href: `/marketing?section=crear&draft=${r.id}`,
}));
await writeFile(
  `${dir}/a11-drafts.manifest.json`,
  JSON.stringify(manifest, null, 2),
);
console.log(
  JSON.stringify({
    saved: saved!.length,
    status_counts: saved!.reduce(
      (a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a),
      {} as Record<string, number>,
    ),
    scheduled: saved!.filter((r) => r.scheduled_for).length,
    manifest: `${dir}/a11-drafts.manifest.json`,
  }),
);
