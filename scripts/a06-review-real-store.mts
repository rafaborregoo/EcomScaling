import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { agentOutputSchema } from "../packages/ai/src/index.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`, caseId = "a06_planificador_stock:real-store-runtime-2026-10-31";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
assert.ok(!report.active_batch);
const scenario = report.cases.find((row) => row.id === caseId); assert.ok(scenario);
const input = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const blocks = input.input.context.snapshot;
const inventory = blocks.find((row: any) => row.label.startsWith("Productos con demanda"))?.data;
const pending = blocks.find((row: any) => row.label.startsWith("Propuestas anteriores de A06"))?.data.proposals ?? [];
const ids = new Set(inventory.items.map((item: any) => item.product_id));
const covered = new Set(pending.map((item: any) => item.related_product_id));
const notes: Record<string, string[]> = {
  "claude-haiku-5-5": ["Prioriza las dos urgencias sin duplicar Bruma/Arena; contempla los ocho riesgos y advierte la repetición de las últimas semanas.", "Su resumen usa el hito interno del 16/11, no la fecha comercial del 27/11; debe leerse como plazo de preparación. La advertencia distingue ambas fechas de la etiqueta del hito.", "Rellena source_flow_refs con etiquetas inventadas de cruce de stock. Son campos inaplicables al stock, ignorados por su entrega actual; se conserva el defecto en la evaluación.", "Dos tareas no implican peor respuesta: el resto se mantiene como seguimiento con menor urgencia. Es la opción habitual de menor coste entre las que ofrecen una lectura suficientemente prudente."],
  "claude-sonnet-5-5": ["Buena composición: seis hallazgos y dos tareas urgentes, sin perder los ocho productos ni las propuestas pendientes.", "Explica el 27/11 y la repetición semanal; mantiene confianza media. Mayor coste CLI que Haiku para una decisión operativa semejante."],
  "claude-opus-5-5": ["Añade una revisión de Cargo Oliva con evidencia; esa tercera tarea es razonable y no se penaliza por cantidad.", "Atribuye que los siete artículos agotados están fuera del análisis a falta de ventas, una explicación que el bloque agregado no acredita por producto. Usa alguna formulación de agotamiento demasiado firme antes de sus cautelas."],
  "gpt-6-luna": ["Dos tareas urgentes correctas y sin duplicados; es el menor coste estimado del conjunto.", "Resume cuatro productos con cobertura inferior a ocho días, pero la fuente contiene cinco (incluido Cargo Oliva). Confianza alta poco prudente frente al patrón repetido y a las limitaciones del escenario."],
  "gpt-6.1-sol": ["Cubre los seis productos sin propuesta previa, con IDs correctos y prioridades diferenciadas; las seis revisiones están respaldadas por coberturas de 1,3 a 15,4 días y no son compras automáticas.", "Separa demanda, disponibilidad y efecto desconocido de campaña. Veinte hallazgos duplican parcialmente cada producto entre riesgo y escenario, lo que empeora la lectura y aumenta tamaño/coste.", "Respaldo de mayor capacidad conservado; esta muestra no obliga a usarlo para todos los controles diarios."],
  "gpt-6.1-terra": ["Cuatro tareas justificadas: Arcilla, Boreal, Cargo y Camiseta; mantiene Gorra y Calcetín en seguimiento y no duplica Bruma/Arena.", "Buena alternativa para mayor detalle con menos coste que Sol; omite advertir la repetición de las cuatro últimas semanas. No se cambia la asignación primaria por esta única muestra."],
};
const summaries: any[] = [];
for (const result of report.results.filter((row) => row.case_id === caseId)) {
  assert.equal(result.status, "completed");
  const output = agentOutputSchema.parse(parseOutput(result.raw_response));
  const tasks = output.proposed_writes.filter((write) => write.kind === "task");
  assert.ok(tasks.every((write) => write.related_product_id && ids.has(write.related_product_id)), `invalid product ID: ${result.model_id}`);
  assert.ok(tasks.every((write) => !covered.has(write.related_product_id)), `duplicate pending product: ${result.model_id}`);
  assert.equal(new Set(tasks.map((write) => write.related_product_id)).size, tasks.length);
  const u = result.usage;
  const total = result.model_id.startsWith("claude-") ? Number(u.input ?? 0) + Number(u.cached ?? 0) + Number(u.cache_creation ?? 0) : Number(u.input ?? 0);
  const cold = calculateLabApiPrice(result.model_id, { ...u, input: total, cached: 0, cache_creation: 0 });
  assert.ok(cold);
  result.review = { status: "reviewed", method: "automated", reviewer: "Codex · revisión con snapshot, IDs y aritmética", verdict: result.model_id === "gpt-6-luna" ? "Revisable con error de recuento y cautela insuficiente." : "Borrador revisable; propuestas pendientes de aprobación.",
    notes: ["Contrato nativo válido; IDs de producto observados, sin duplicar dos propuestas anteriores pendientes y sin tareas ejecutadas.", ...notes[result.model_id], "Una respuesta por modelo y mismo contexto real de TEST, con datos de demostración. No es precisión estadística ni valida herramientas dinámicas. Coste orientativo con tarifas internas de referencia 28/10/2026 y tokens CLI, no factura ni garantía del consumo API."] };
  summaries.push({ model: result.model_id, tasks: tasks.length, findings: output.findings.length, confidence: output.confidence, latency_ms: result.duration_ms,
    native: true, valid_product_ids: true, no_pending_duplicates: true, input_total: total, output_tokens: u.output, cold_usd_per_run: cold.low, cold_usd_30_runs: cold.low * 30, notes: notes[result.model_id] });
}
assert.equal(summaries.length, 6);
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
await writeFile(`${dir}/a06-real-store-review.json`, JSON.stringify({ case_id: caseId, inventory_products: ids.size, pending_products: covered.size,
  scheduled_runs_per_day: 1, events_mode: "shadow", events_max_per_day_if_enabled: 4, current_primary: "claude-haiku-5-5", fallback: "gpt-6.1-sol", summaries }, null, 2));
console.log(JSON.stringify(summaries.map(({ notes, ...row }) => row), null, 2));
