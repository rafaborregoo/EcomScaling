import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { buildReadOnlyOutputContract } from "../packages/ai/src/index.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`, caseId = "a08_gestor_conocimiento:real-org-methodology-runtime-2026-10-31";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
assert.ok(!report.active_batch);
const notes: Record<string, string[]> = {
  "claude-haiku-5-5": ["Distingue 338 documentos y muestra de 16, pero convierte cifras ya declaradas ficticias en una incidencia editorial de prioridad alta.", "Recomienda centralizar cuatro documentos solo por coincidencia temática. La lectura parcial no demuestra redundancia; conclusión demasiado intervencionista."],
  "claude-sonnet-5-5": ["Buena síntesis, cautelas de telemetría y cifras correctas. Conservado como respaldo de mayor capacidad en otro proveedor.", "Atribuye los dos cuestionarios a la misma tienda aunque ambos store_id son null. Su futura auditoría debe respetar el alcance organizativo; se conserva el defecto sin corregir su respuesta."],
  "claude-opus-5-5": ["Detecta el problema potencial de indexar cifras sin pregunta y distingue metodología de documentación local.", "Usa una conclusión demasiado firme de no duplicidad y una fecha de revisión supuestamente vencida sin plazo persistido. Mucho mayor coste para este corte."],
  "gpt-6-luna": ["Económico, correcto en cobertura, candidato y cautelas. No inventa contenido faltante.", "No explica el carácter ficticio de las cifras que aporta la búsqueda de contraste y declara confianza alta con evidencia semántica parcial."],
  "gpt-6.1-sol": ["La respuesta más conservadora: datos correctos, store_id null explícito, cifras ficticias y ausencia de carencia probada. No inventa acciones para llenar la respuesta.", "Alternativa de calidad. Para este control, Terra da lectura comparable con dos recomendaciones internas útiles y menos coste/latencia."],
  "gpt-6.1-terra": ["Principal elegido: cobertura 338/316/22, muestra 16, cero pendientes, 2.589 fragmentos; no confunde un candidato con duplicado ni organización con tienda.", "Reconoce cifras ficticias y telemetría incompleta. Propone revisar el par y continuidad de telemetría, sin crear tareas, fusionar ni modificar documentos.", "No es el máximo detalle ni una victoria estadística: una salida por modelo. Sol queda como alternativa y Sonnet como respaldo entre proveedores."],
};
const summaries = [];
for (const result of report.results.filter((row) => row.case_id === caseId)) {
  assert.equal(result.status, "completed");
  const output = buildReadOnlyOutputContract().schema.parse(parseOutput(result.raw_response));
  assert.equal(output.proposed_writes.length, 0); assert.equal(output.approval_required, false);
  for (const value of ["338", "316", "22", "16"]) assert.ok(JSON.stringify(output).includes(value), `${result.model_id}: missing coverage ${value}`);
  const u = result.usage;
  assert.ok(u.input !== null && u.cached !== null && u.cache_creation !== null && u.output !== null);
  const total = result.model_id.startsWith("claude-") ? u.input + u.cached + u.cache_creation : u.input;
  const cold = calculateLabApiPrice(result.model_id, { ...u, input: total, cached: 0, cache_creation: 0 }); assert.ok(cold);
  result.review = { status: "reviewed", method: "automated", reviewer: "Codex · contraste con snapshot, alcance e indexación", verdict: result.model_id === "gpt-6.1-terra" ? "Elegido por equilibrio de prudencia, utilidad y coste." : "Comparado; limitaciones registradas.", notes: [
    "Contrato nativo de solo lectura válido; normaliza approval_required=false y proposed_writes=[]. Sin acciones ejecutadas.",
    ...notes[result.model_id], "Una respuesta por modelo, mismo contexto autorizado TEST y búsqueda preseleccionada por el arnés. No acredita elección dinámica de herramientas. Codex no confirma ID servido. Costes equivalentes API de referencia, no factura.",
  ] };
  summaries.push({ model: result.model_id, findings: output.findings.length, recommendations: output.recommendations.length, confidence: output.confidence,
    input_total: total, output_tokens: u.output, latency_ms: result.duration_ms, cold_usd_per_run: cold.low, cold_usd_4_runs: cold.low * 4, cold_usd_30_runs: cold.low * 30, notes: notes[result.model_id] });
}
assert.equal(summaries.length, 6);
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
await writeFile(`${dir}/a08-real-org-review.json`, JSON.stringify({ case_id: caseId, primary: "gpt-6.1-terra", fallback: "claude-sonnet-5-5", frequency: "manual_only", summaries }, null, 2));
console.log(JSON.stringify(summaries.map(({ notes, ...row }) => row), null, 2));
