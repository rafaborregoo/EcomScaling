import assert from "node:assert/strict";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { buildA13OperationalOutputContract } from "../packages/ai/src/index.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`, caseId = "a13_operativa_shopify:real-store-runtime-2026-11-03-calendar";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
const scenario = report.cases.find((row) => row.id === caseId)!; assert.ok(scenario);
const input = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const plan = input.input.context.snapshot.find((row: any) => row.label.startsWith("Objetivo y Camino")).data;
assert.equal(plan.goal_progress.measurement_period, "calendar_month_to_date"); assert.equal(plan.goal_progress.observed_value, 3847.1); assert.notEqual(plan.goal_progress.status, "achieved");
const notes: Record<string, string[]> = {
  "claude-haiku-5-5": ["Reconoce la naturaleza estimada del coste de envío y evita duplicar el trabajo de stock de A06. La tarea adicional de validar costes tiene utilidad; no se penaliza la cantidad.", "Introduce referencias de flow inaplicables a Shopify y repite el 13/11 del título antiguo en lugar del target_date vigente 16/11. Dice cero clientes nuevos en ambos periodos, aunque el anterior contiene uno.", "Precio bajo, pero estos fallos impiden seleccionarlo sobre Sol/Terra para esta lectura."],
  "claude-sonnet-5-5": ["Cifras principales y lectura mensual correctas, con confianza media y dos tareas concretas.", "Duplica parcialmente propuestas de stock de A06 y trata envío cobrado cero como política de envío gratis demostrada. Usa el 13/11 del título antiguo del hito, no su fecha vigente.", "Más tareas no es el defecto: se cuestionan la duplicación y las premisas, conservando los originales."],
  "claude-opus-5-5": ["Aporta detalle de contribución y comprobaciones operativas, pero insiste en reposición de Arcilla/Boreal ya propuesta por A06.", "Calcula 113/90 unidades con extrapolación constante hasta fin de mes, sin plazo de proveedor ni incertidumbre de campaña, y pide tramitar el pedido. No es una compra ejecutada, pero sí una propuesta demasiado prescriptiva para esta evidencia.", "Buen análisis financiero parcial; coste alto sin ventaja suficiente frente a Sol en prudencia y deduplicación."],
  "gpt-6-luna": ["Muy barato y conciso; usa stock y fechas correctas.", "Duplica la reposición cubierta por A06, propone tramitarla antes de conocer plazo/cantidad y deja fuera ventas, ticket y progreso mensual de esta visión operativa. Confianza alta poco calibrada.", "Su menor coste no compensa la cobertura limitada en esta muestra."],
  "gpt-6.1-sol": ["Principal: integra riesgo de stock, crecimiento de pedidos/ventas, caída de ticket y arranque mensual por debajo del ritmo. No presenta ese ritmo como pronóstico ni como causa.", "No añade tareas duplicadas cuando stock, oferta y cesta ya están cubiertos. Mantiene confianza media y declara límites de sincronización y proveedores.", "Una sola respuesta sobre datos TEST de demostración: recomendación de esta muestra, no superioridad universal ni validación de herramientas."],
  "gpt-6.1-terra": ["Segundo candidato: identifica correctamente ritmo mensual y stock, reconoce propuestas pendientes y no las duplica, con confianza media.", "Más barato, pero deja fuera la evolución de ventas/pedidos y el ticket que Sol sí resume. Se usa como fallback de modelo dentro de OpenAI, no como respaldo ante caída de todo el proveedor."],
};
const summaries = [];
for (const row of report.results.filter((item) => item.case_id === caseId)) {
  assert.equal(row.status, "completed"); const output = buildA13OperationalOutputContract().schema.parse(parseOutput(row.raw_response));
  const u = row.usage, total = row.model_id.startsWith("claude-") ? Number(u.input ?? 0) + Number(u.cached ?? 0) + Number(u.cache_creation ?? 0) : Number(u.input ?? 0);
  const cold = calculateLabApiPrice(row.model_id, { input: total, cached: 0, cache_creation: 0, output: u.output }); assert.ok(cold);
  row.review = { status: "reviewed", method: "automated", reviewer: "Codex · contraste con snapshot y tareas existentes", verdict: row.model_id === "gpt-6.1-sol" ? "Sol principal, Terra fallback; sin tareas duplicadas." : "Revisión comparada disponible; ver observaciones y límites.", notes: [...notes[row.model_id], "Revisión retrospectiva por el asistente, sin panel humano independiente. Sin API pagada, herramientas dinámicas ni acciones ejecutadas. Costes equivalentes API sobre tokens CLI; no factura."] };
  summaries.push({ model: row.model_id, native: true, tasks: output.proposed_writes.length, findings: output.findings.length, confidence: output.confidence, input_total: total, output_tokens: u.output, cli_ms: row.duration_ms, cold_usd_per_run: cold.low, monthly_30_store_usd: cold.low * 30, monthly_60_store_and_org_usd: cold.low * 60, notes: notes[row.model_id] });
}
assert.equal(summaries.length, 6);
const priorId = "a13_operativa_shopify:real-store-runtime-2026-11-03";
const prior = report.cases.find((row) => row.id === priorId);
if (prior && !prior.label.includes("Archivada")) prior.label += " · Archivada: progreso temporal incorrecto";
if (prior && !prior.limitations.some((text) => text.includes("EXCLUIDA"))) prior.limitations.push("EXCLUIDA del veredicto: el contexto usaba ventas de treinta días como ventana de siete para medir el objetivo. Las respuestas originales y su consumo se conservan; la tanda válida es la que termina en -calendar.");
for (const row of report.results.filter((item) => item.case_id === priorId)) row.review = { status: "reviewed", method: "automated", reviewer: "Codex · auditoría de contexto", verdict: "Tanda excluida del veredicto por error de periodo del contexto.", notes: ["El fallo de progreso pertenecía al backend, no al modelo. No mezclar estas respuestas con la nueva tanda calendar."] };
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
await mkdir(".e-nora-test-lab/a13-real-2026-11-03", { recursive: true });
await writeFile(".e-nora-test-lab/a13-real-2026-11-03/review.json", JSON.stringify({ case_id: caseId, primary: "gpt-6.1-sol", fallback: "gpt-6.1-terra", corrected_progress: plan.goal_progress, excluded_prior_case: "a13_operativa_shopify:real-store-runtime-2026-11-03", source_metrics: "TEST persisted demonstration data", summaries }, null, 2));
console.log(JSON.stringify(summaries.map(({ notes, ...row }) => row), null, 2));
