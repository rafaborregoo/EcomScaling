import assert from "node:assert/strict";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { buildA14OperationalOutputContract } from "../packages/ai/src/index.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`, caseId = "a14_operativa_meta:real-store-runtime-2026-11-05-readable-account";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8"))); assert.ok(!report.active_batch);
const scenario = report.cases.find((row) => row.id === caseId)!; assert.ok(scenario);
const input = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const blocks = input.input.context.snapshot;
assert.equal(blocks.find((b: any) => b.label.startsWith("Veredicto determinista A24")).data.status, "unknown");
assert.equal(blocks.find((b: any) => b.label === "Suficiencia del cálculo financiero para comparar A14").data.status, "incomplete");
const notes: Record<string, string[]> = {
  "claude-haiku-5-5": ["Reconoce adquisición ausente y cobertura económica incompleta, sin tareas duplicadas.", "Añade análisis de envíos fuera del foco de A14 y compara eventos/pedidos como si debieran coincidir; una cobertura incompleta no permite afirmar el impacto económico de cambiar tarifas."],
  "claude-sonnet-5-5": ["Describe las carencias y evita tareas nuevas.", "Recomienda mantener gasto para proteger margen aunque no existe gasto verificable ni margen acreditado. Sigue siendo una recomendación presupuestaria sin base suficiente."],
  "claude-opus-5-5": ["Contrasta el historial de tareas y cobertura con detalle, sin propuestas nuevas.", "Califica como incoherencia el cambio frente al informe anterior, que pertenece a la cuenta retirada, sin verificar equivalencia de cuenta. Juzga poco creíble el número de clientes nuevos por volumen de pedidos sin evidencia adicional."],
  "gpt-6-luna": ["Respuesta concisa que respeta el bloqueo de inversión y no duplica tareas.", "Deja fuera el detalle de los 951 pedidos y costes y usa confianza alta con cobertura incompleta; aporta menos seguimiento operativo que Sol."],
  "gpt-6.1-sol": ["Principal: identifica ausencia de adquisición, cobertura A24 desconocida y los 951 pedidos/costes no verificados. Distingue EUR compatible de suficiencia económica y no rescata cifras de la cuenta anterior.", "Relaciona las carencias con controles ya abiertos, sin inventar inversión, causas, CAPI o fatiga creativa. Confianza media y cero tareas duplicadas.", "Selección para el estado actual; no demuestra superioridad universal ni calidad de optimización con una campaña activa y economía verificada."],
  "gpt-6.1-terra": ["Segundo candidato: correcto y más económico, sin tareas ni recomendaciones de presupuesto.", "Menos detalle sobre cobertura de pedidos y seguimiento histórico. La confianza alta es más fuerte que la evidencia disponible; Sol queda mejor calibrado. Respaldo de modelo, no de caída de todo OpenAI."],
};
const summaries = [];
for (const row of report.results.filter((item) => item.case_id === caseId)) {
  assert.equal(row.status, "completed"); const raw = parseOutput(row.raw_response) as any;
  const output = buildA14OperationalOutputContract("unknown").schema.parse(raw);
  const u = row.usage, total = row.model_id.startsWith("claude-") ? Number(u.input ?? 0) + Number(u.cached ?? 0) + Number(u.cache_creation ?? 0) : Number(u.input ?? 0);
  const cold = calculateLabApiPrice(row.model_id, { input: total, cached: 0, cache_creation: 0, output: u.output }); assert.ok(cold);
  row.review = { status: "reviewed", method: "automated", reviewer: "Codex · contraste con snapshot, atribución y tareas", verdict: row.model_id === "gpt-6.1-sol" ? "Sol principal para diagnóstico y abstención; Terra fallback. Optimización con inversión real no evaluada." : "Revisión comparada con límites de medición; ver observaciones.", notes: [...notes[row.model_id], "Una respuesta por modelo sobre datos TEST de demostración. Revisión retrospectiva por el asistente, sin panel humano independiente ni API pagada. Costes API equivalentes sobre tokens CLI, no factura."] };
  summaries.push({ model: row.model_id, native: true, raw_tasks: raw.proposed_writes.length, retained_tasks: output.proposed_writes.length, findings: output.findings.length, confidence: output.confidence, input_total: total, output_tokens: u.output, cli_ms: row.duration_ms, cold_usd_per_run: cold.low, monthly_30_store_usd: cold.low * 30, notes: notes[row.model_id] });
}
assert.equal(summaries.length, 6);
scenario.limitations.push("Cuenta seleccionada Rafael Borrego Reyes: ficha e informes accesibles, sincronización completada; sin filas de adquisición en ambas ventanas. Antigua Rafa Borrego desasignada, sin borrar histórico. Finanzas disponibles pero incompletas; no es una validación de inversión con campaña activa.");
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
await mkdir(".e-nora-test-lab/a14-real-2026-11-05-readable-account", { recursive: true });
await writeFile(".e-nora-test-lab/a14-real-2026-11-05-readable-account/review.json", JSON.stringify({ case_id: caseId, primary: "gpt-6.1-sol", fallback: "gpt-6.1-terra", full_coverage_validation: "pending", summaries }, null, 2));
console.log(JSON.stringify(summaries.map(({ notes, ...row }) => row), null, 2));
