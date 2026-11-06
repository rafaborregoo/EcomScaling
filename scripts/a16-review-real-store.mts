import assert from "node:assert/strict";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { instagramOverlayDraftSchema } from "../packages/ai/src/index.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { normalizeOutput, parseOutput } from "./ai-model-lab-core.js";

const root = ".e-nora-test-lab/ai-models", reportPath = `${root}/report.json`;
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(reportPath, "utf8")));
assert.ok(!report.active_batch);
const caseIds = [
  "a16_texto_sobre_imagen:real-store-runtime-2026-11-06-product-coordinates-v7",
  "a16_texto_sobre_imagen:real-store-runtime-2026-11-06-abstract-coordinates-v7",
];
const notes: Record<string, string[]> = {
  "claude-haiku-5-5": ["Genera copy más completo para el snowboard y respeta la falta de destino: no inventa CTA. Usa posición y contraste con detalle.", "En la creatividad abstracta repite la idea de colección en kicker y titular. Copy algo redundante; hace falta vigilar el número de bloques."],
  "claude-sonnet-5-5": ["Composición y contraste bien explicados; reconoce el margen estrecho del producto.", "En la pieza abstracta introduce «Muy pronto», una promesa temporal no dada por el brief. En el producto coloca textos en franjas superior/inferior muy estrechas."],
  "claude-opus-5-5": ["Mejor equilibrio de jerarquía, copy breve y ubicación en márgenes realmente libres. Describe el gráfico visible sin prometer prestaciones; omite CTA al faltar destino.", "En el abstracto mantiene el titular bajo el círculo y dentro del panel claro. Coste superior; la lectura del texto pequeño debe confirmarse en el render final."],
  "gpt-6-luna": ["Muy barato, conciso y sin afirmaciones comerciales.", "Propone titulares genéricos y no aprovecha el detalle gráfico del producto. La caja inferior del snowboard queda cerca del borde del lienzo."],
  "gpt-6.1-sol": ["Copy visual útil («Geometría a todo color»), breve, factual y sin CTA inventado; coloca texto en margen lateral.", "No nombra el producto en la pieza de snowboard. La variante abstracta es segura pero genérica."],
  "gpt-6.1-terra": ["Respuestas claras, seguras y con caja dentro del área clara del abstracto.", "Copy muy plano: para el producto repite el nombre y no convierte el rasgo visual en una idea creativa."],
};
const summaries = [];
for (const model of ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "gpt-6-luna", "gpt-6.1-sol", "gpt-6.1-terra"]) {
  const cases = caseIds.map((caseId) => {
    const row = report.results.find((result) => result.case_id === caseId && result.model_id === model);
    assert.ok(row, `${caseId}/${model}`); assert.equal(row.status, "completed");
    const parsed = parseOutput(row.raw_response) as unknown;
    const checked = instagramOverlayDraftSchema.safeParse(parsed);
    assert.ok(checked.success, `${model} failed native A16 contract: ${JSON.stringify(checked)}`);
    const result = checked.data;
    const usage = row.usage;
    const inputTotal = model.startsWith("claude-")
      ? Number(usage.input ?? 0) + Number(usage.cached ?? 0) + Number(usage.cache_creation ?? 0)
      : Number(usage.input ?? 0);
    const coldPrice = calculateLabApiPrice(model, { input: inputTotal, cached: 0, cache_creation: 0, output: usage.output })!;
    row.normalized = {
      summary: result.blocks.map((block) => block.text).join(" · "),
      findings: result.blocks.map((block) => `${block.role}: ${block.text} (${block.position.x_pct}%, ${block.position.y_pct}%, ancho ${block.position.width_pct}%)`),
      recommendations: [`Color texto ${result.palette.text_hex}; acento ${result.palette.accent_hex}`, result.rationale],
      warnings: [],
    };
    row.review = {
      status: "reviewed", method: "automated", reviewer: "Codex · revisión de copy, imagen y coordenadas",
      verdict: model === "claude-opus-5-5" ? "Principal recomendado; Sol como fallback." : "Comparado con las dos imágenes de A16; ver observaciones.",
      notes: [...notes[model], "Contrato nativo A16 validado. Revisión retrospectiva sin panel humano independiente; dos imágenes no demuestran calidad universal. Precio calculado como API equivalente en frío desde el catálogo guardado, no es factura ni consumo de API medido."],
    };
    return { case_id: caseId, input_total: inputTotal, output_tokens: usage.output, cold_usd_per_image: coldPrice.low, block_count: result.blocks.length, blocks: result.blocks, palette: result.palette, rationale: result.rationale };
  });
  summaries.push({ model, cases, mean_input_total: cases.reduce((sum, item) => sum + item.input_total, 0) / cases.length, mean_output_tokens: cases.reduce((sum, item) => sum + item.output_tokens, 0) / cases.length, mean_cold_usd_per_image: cases.reduce((sum, item) => sum + item.cold_usd_per_image, 0) / cases.length, usd_for_20_images: cases.reduce((sum, item) => sum + item.cold_usd_per_image, 0) * 10, notes: notes[model] });
}
for (const item of report.cases.filter((row) => row.agent_code === "a16_texto_sobre_imagen" && !caseIds.includes(row.id))) {
  item.label = `[Archivado · reemplazado] ${item.label ?? item.id}`;
  item.limitations = [...(item.limitations ?? []), "No usar para ranking: tanda preliminar reemplazada por la comparación con imagen, datos Shopify, coordenadas exactas y contrato nativo del 06/11/2026."];
  for (const result of report.results.filter((row) => row.case_id === item.id)) {
    result.review = { status: "reviewed", method: "automated", reviewer: "Codex · control de versiones de A16", verdict: "Archivada; no entra en el ranking final.", notes: ["La primera tanda no adjuntaba píxeles o usó un contrato/geometría preliminar. Consultar los dos casos coordinates-v6 para la decisión final."] };
  }
}
report.updated_at = new Date().toISOString();
await writeFile(`${reportPath}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${reportPath}.tmp`, reportPath);
await mkdir(".e-nora-test-lab/a16-real-2026-11-06", { recursive: true });
await writeFile(".e-nora-test-lab/a16-real-2026-11-06/review.json", JSON.stringify({ primary: "claude-opus-5-5", fallback: "gpt-6.1-sol", cases: caseIds, summaries }, null, 2));
console.log(JSON.stringify(summaries.map(({ cases: _cases, notes: _notes, ...summary }) => summary), null, 2));
