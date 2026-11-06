import assert from "node:assert/strict";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { agentOutputSchema } from "../packages/ai/src/index.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`, caseId = "a12_analista_email:real-store-runtime-2026-11-02-normalized";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
const scenario = report.cases.find((row) => row.id === caseId)!; assert.ok(scenario);
const input = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const blocks = input.input.context.snapshot;
const current = blocks.find((row: any) => row.label.startsWith("Email Klaviyo -- último")).data.report.totals;
const previous = blocks.find((row: any) => row.label.includes("totales del periodo anterior")).data.totals;
assert.equal(current.revenue, 10478.4); assert.equal(previous.revenue, 7714.3);
const notes: Record<string, string[]> = {
  "claude-haiku-5-5": ["Cifras principales correctas, contempla histórico de tareas y la propuesta de comprobar flows puede ser útil; no se penaliza por proponer trabajo adicional.", "Fallo: que los pedidos del tracking y los ingresos del informe casi coincidan no demuestra que la atribución no separe flujos. Afirma actividad nula donde solo faltan filas de flows.", "Llama a la mejora de rebotes limpieza de lista sin evidencia de que se haya hecho; usa referencias de flujo inventadas y un plazo del título antiguo del hito (13/11) frente al target_date vigente (16/11)."],
  "claude-sonnet-5-5": ["Buen equilibrio de estructura, cifras y coste. Reconoce al final que no sabemos si faltan flujos, actividad o atribución; no duplica su construcción.", "La cabecera califica de problema estructural la dependencia total antes de confirmar cobertura de flows; el objetivo 25–35 % procede de una referencia genérica del prompt, no de la economía validada de esta tienda.", "Segundo candidato editorial de este ensayo, con mayor cautela deseable en el resumen; sirve de fallback cruzado de proveedor."],
  "claude-opus-5-5": ["Desarrolla una propuesta concreta de comprobación, no vuelve a construir flows automáticamente. El número de tareas no se penaliza.", "Fallo: afirma que Apple ha inflado las aperturas y que en octubre se usó limpieza/exclusión de inactivos, sin evidencia de esas causas o acciones.", "Introduce una meta de 15 % de contribución de flows en noviembre sin justificación de volumen, cobertura o economía. Mayor coste y extensión no implican mejor diagnóstico."],
  "gpt-6-luna": ["Muy barato, cubre ingresos, interacción y entregabilidad; evita crear tareas duplicadas.", "Limitación: confianza alta pese a la ausencia de entidades flow y de cuerpos de 15 emails. Cita una revisión A26 entre fuentes aunque reconoce que no está disponible.", "Pequeña desviación de redondeo: crecimiento 35,84 % frente a 35,83 % a dos decimales. No es un error material del diagnóstico."],
  "gpt-6.1-sol": ["Recomendado: cifras y denominadores correctos, tasas mensuales separadas de eventos, confianza media, cobertura explícita y sin causa atribuida al asunto.", "Reconoce que la lista de flows vacía no demuestra inexistencia o inactividad, y que ya se crearon bienvenida/carrito. La comprobación se deja como recomendación en lugar de duplicar construcción.", "Referencia 25–35 % heredada del prompt, no objetivo validado del cliente. Conviene validar umbrales por tienda y probar más casos antes de afirmar superioridad general."],
  "gpt-6.1-terra": ["Alternativa económica con cifras y denominadores correctos. Reconoce que la ausencia de flows no demuestra que no existan; no duplica tareas.", "Confianza alta y oportunidad de reducir dependencia demasiado firmes para un informe sin entidades flow. Dice que una campaña mejoró comparándola con totales del mes anterior, que pertenecen a otra entidad mensual.", "Menor coste que Sol; queda como alternativa a seguir, sin afirmar que haya demostrado igual calidad en más tiendas."],
};
const summaries = [];
for (const row of report.results.filter((item) => item.case_id === caseId)) {
  assert.equal(row.status, "completed"); const output = agentOutputSchema.parse(parseOutput(row.raw_response));
  const u = row.usage, total = row.model_id.startsWith("claude-") ? Number(u.input ?? 0) + Number(u.cached ?? 0) + Number(u.cache_creation ?? 0) : Number(u.input ?? 0);
  const cold = calculateLabApiPrice(row.model_id, { input: total, cached: 0, cache_creation: 0, output: u.output }); assert.ok(cold);
  const measured = calculateLabApiPrice(row.model_id, u);
  row.review = { status: "reviewed", method: "automated", reviewer: "Codex · contraste editorial y aritmético con snapshot", verdict: row.model_id === "gpt-6.1-sol" ? "Recomendado para este caso; Sonnet fallback." : "Comparado con las mismas cifras; ver límites y hallazgos.", notes: [...notes[row.model_id], "Una respuesta por modelo sobre datos sintéticos ya persistidos en TEST. Evaluación retrospectiva, no juez humano independiente ni tasa estadística de precisión. Sin herramientas dinámicas ni API pagada."] };
  summaries.push({ model: row.model_id, status: row.status, native_contract: true, tasks: output.proposed_writes.length, confidence: output.confidence, input_total: total, output_tokens: u.output, duration_ms: row.duration_ms, measured_api_equivalent: measured, cold_usd_per_run: cold.low, store_30_runs_usd: cold.low * 30, store_plus_org_60_runs_usd: cold.low * 60, notes: notes[row.model_id] });
}
assert.equal(summaries.length, 6);
report.updated_at = new Date().toISOString(); await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
const evidence = { case_id: caseId, primary: "gpt-6.1-sol", fallback: "claude-sonnet-5-5", source: "persisted_synthetic_test_history", current, previous, expected_growth_pct: (current.revenue / previous.revenue - 1) * 100, summaries, cadence: { scopes: "store + organizational aggregate, distinct caches", default_max_daily_for_one_store: 2, monthly_scenario: 60, conditional: "Only eligible changed activity, age, pending-review and budget gates; viewing a result never adds a generation.", manual_and_retries_extra: true }, limitations: ["Solo campañas en este fixture: no permite validar comparaciones numéricas de entidades flow.", "Las seis respuestas anteriores sin intervalos se conservan separadas como caso de cobertura ausente.", "No certifica comportamiento de herramientas, API ni rendimiento de un negocio real."] };
await mkdir(".e-nora-test-lab/a12-real-2026-11-02", { recursive: true }); await writeFile(".e-nora-test-lab/a12-real-2026-11-02/review.json", JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(summaries.map(({ notes, ...row }) => row), null, 2));
