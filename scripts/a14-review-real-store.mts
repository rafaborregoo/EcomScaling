import assert from "node:assert/strict";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { buildA14OperationalOutputContract } from "../packages/ai/src/index.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`, caseId = "a14_operativa_meta:real-store-runtime-2026-11-03";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8"))); assert.ok(!report.active_batch);
const scenario = report.cases.find((row) => row.id === caseId)!; assert.ok(scenario);
const input = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const blocks = input.input.context.snapshot;
assert.equal(blocks.find((b: any) => b.label.startsWith("Veredicto determinista A24")).data.status, "unknown");
assert.equal(blocks.find((b: any) => b.label === "Suficiencia del cálculo financiero para comparar A14").data.status, "unknown");
const notes: Record<string, string[]> = {
  "claude-haiku-5-5": ["Reconoce la falta de medición y finanzas y no genera tareas duplicadas.", "Compara un ticket histórico del Camino con compras actuales como incoherencia acreditada y adopta el 13/11 del título del hito frente al target_date 16/11. Recomienda mantener el gasto pese a carecer de base para esa decisión. Exigir el 100 % del backfill organizativo no acredita cobertura de esta cuenta."],
  "claude-sonnet-5-5": ["Ofrece cifras y límites, sin tareas adicionales.", "Error aritmético explícito: afirma que 8.235 compras superan 9.652 clics. La conclusión y la recomendación repiten esa premisa falsa. Las compras atribuidas omni_purchase tampoco equivalen a conversiones de esos clics. Recomienda mantener el gasto sin demostrar sostenibilidad."],
  "claude-opus-5-5": ["Aporta más detalle y una auditoría de medición; más tareas no es por sí un defecto.", "Asume que compras omni_purchase/clics es conversión de clic y que debe igualarse al ticket histórico del Camino. Su criterio de éxito exige compras Meta no superiores a pedidos Shopify sin acreditar equivalencia de atribución. Repite el 13/11 antiguo y prescribe mantener gasto. El filtro nativo conservador retira su propuesta por incluir términos de inversión; se conservan respuesta original y resultado filtrado."],
  "gpt-6-luna": ["Es el más económico y mantiene bloqueadas las propuestas de inversión sin inventar equilibrio.", "Lectura muy breve: omite compras/CPA, tareas abiertas, comprobación ya completada y backfill. Su recomendación genérica puede repetir trabajo en vez de contrastar la cobertura vigente."],
  "gpt-6.1-sol": ["Principal para el estado actual: distingue cifras atribuidas de rentabilidad, CPA de CAC y EUR compatible de suficiencia financiera. Usa cifras correctas, periodos explícitos y no duplica tareas.", "Contrasta la comprobación histórica completada con la propuesta A24 pendiente sin darla por vigente. Recomienda recuperar el cálculo dentro del control abierto; no prescribe mantener, escalar ni recortar presupuesto.", "No diagnostica la causa del recuento llamativo; tampoco se ha probado su capacidad para decidir con medición y finanzas completas. Selección provisional para esta cobertura limitada, con revalidación obligatoria al restaurarla."],
  "gpt-6.1-terra": ["Segundo candidato: prudente, reconoce las dos carencias y la propuesta A24 existente sin crear duplicados ni cambiar inversión.", "Menor coste, pero menos cobertura: solo muestra gasto y no contrasta la comprobación completada con el diagnóstico pendiente ni propone recuperar el cálculo financiero de forma concreta. Fallback de modelo dentro de OpenAI, no respaldo ante caída total del proveedor."],
};
const summaries = [];
for (const row of report.results.filter((item) => item.case_id === caseId)) {
  assert.equal(row.status, "completed"); const raw = parseOutput(row.raw_response) as any;
  const output = buildA14OperationalOutputContract("unknown").schema.parse(raw);
  const u = row.usage, total = row.model_id.startsWith("claude-") ? Number(u.input ?? 0) + Number(u.cached ?? 0) + Number(u.cache_creation ?? 0) : Number(u.input ?? 0);
  const cold = calculateLabApiPrice(row.model_id, { input: total, cached: 0, cache_creation: 0, output: u.output }); assert.ok(cold);
  row.review = { status: "reviewed", method: "automated", reviewer: "Codex · contraste con snapshot, atribución y tareas", verdict: row.model_id === "gpt-6.1-sol" ? "Sol principal provisional, Terra fallback; falta validar cobertura completa." : "Revisión comparada con límites de medición; ver observaciones.", notes: [...notes[row.model_id], "Una respuesta por modelo sobre datos TEST de demostración. Revisión retrospectiva por el asistente, sin panel humano independiente ni API pagada. Costes API equivalentes sobre tokens CLI, no factura."] };
  summaries.push({ model: row.model_id, native: true, raw_tasks: raw.proposed_writes.length, retained_tasks: output.proposed_writes.length, findings: output.findings.length, confidence: output.confidence, input_total: total, output_tokens: u.output, cli_ms: row.duration_ms, cold_usd_per_run: cold.low, monthly_30_store_usd: cold.low * 30, notes: notes[row.model_id] });
}
assert.equal(summaries.length, 6);
scenario.limitations.push("Cobertura limitada: A24 unknown y RPC shopify_financial_coverage ausente en TEST (PGRST202). No valida decisiones de inversión ni rentabilidad completa; repetir cuando haya evidencia vigente.");
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
await mkdir(".e-nora-test-lab/a14-real-2026-11-03", { recursive: true });
await writeFile(".e-nora-test-lab/a14-real-2026-11-03/review.json", JSON.stringify({ case_id: caseId, primary: "gpt-6.1-sol", fallback: "gpt-6.1-terra", full_coverage_validation: "pending", summaries }, null, 2));
console.log(JSON.stringify(summaries.map(({ notes, ...row }) => row), null, 2));
