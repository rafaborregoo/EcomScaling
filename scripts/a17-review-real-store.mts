import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { buildLeanOutputContract } from "../packages/ai/src/index.js";
import { serializeUntrustedContextBlocks } from "../packages/ai/src/untrusted-context.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";

export const caseId = "a17_plan_semanal:real-store-runtime-2026-11-06-weekly-v2";
const dir = ".e-nora-test-lab/ai-models", path = `${dir}/report.json`;
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
assert.ok(!report.active_batch);
const scenario = report.cases.find((row) => row.id === caseId)!; assert.ok(scenario);
const source = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const contextLimits = { maxBlockChars: 64_000, maxContextChars: 300_000 };
const serialized = serializeUntrustedContextBlocks(source.input.context.snapshot, contextLimits);
assert.equal(serialized.truncated, false, JSON.stringify(serialized.truncatedBlocks));
const weekly = source.input.context.snapshot.find((block: any) => block.label.startsWith("Ventas semanales comparables")).data;
const notes: Record<string, string[]> = {
  "claude-haiku-5-5": ["Cifras semanales correctas, evita duplicados y detecta la tarea vencida. Aparta el seguimiento de la meta como responsabilidad exclusiva de A18/Camino; A17 sí debe usarla para priorizar su semana.", "123 s y varias entradas en el recibo CLI. La suma supera el umbral largo del estimador Haiku: el coste en frío es conservador, no el precio de una única entrada de ese tamaño."],
  "claude-sonnet-5-5": ["Principal: cifras exactas, caída del 13,5% sin causalidad inventada, fechas vigentes de los hitos y prioridad de la tarea de invierno vencida. Cero tareas nuevas es defendible con la cobertura existente.", "Cuenta noviembre como seis días, aunque la sexta jornada es parcial; no debe extrapolarse como seis días completos. No convierte el backlog en horas disponibles, aunque concluye de forma demasiado tajante que añadir trabajo no sería defendible.", "Contrato válido en 14,7 s. Aproximadamente $0,138/run y $0,69 por cinco ejecuciones compartidas por tienda."],
  "claude-opus-5-5": ["Dos propuestas con entregable, responsable, evidencia y medida: revisión integrada del hito y prueba de carrito. Son ideas revisables, no se penalizan por ser más tareas. El control conjunto de Black Friday añade una comprobación aunque se solapa parcialmente con la preparación abierta.", "No elegible automáticamente: proposed_writes.0.due_hint supera el máximo nativo de 100 caracteres. No se ha truncado ni reparado su respuesta para declararla válida.", "Agotó 300 s y el reintento tardó 355,9 s. Coste estimado del recibo completo ~$0,959; el intento incompleto tiene consumo desconocido."],
  "gpt-6-luna": ["Muy barato y contrato válido; evita duplicados sin atribuir causalidad.", "Demasiado genérico: omite valores y magnitud de la caída, tarea vencida y límites de frescura/Meta/Klaviyo. Warnings vacío; orienta menos al consultor."],
  "gpt-6.1-sol": ["Contrato válido y prudente: distingue semana, contexto mensual, fuentes antiguas, aprobación y ausencia de impacto probado.", "Sin cifras ni prioridades concretas en la explicación principal. Agotó 300 s y tardó 324,5 s en el reintento sin mejora clara frente a Sonnet. Terra ofrece una abstención similar más rápida y barata en esta muestra."],
  "gpt-6.1-terra": ["Fallback: cifras, ventanas y pedidos correctos, confianza media; no confunde ausencia de Meta con cero gasto ni variación semanal con causa. Contrato válido en 19,4 s.", "~$0,063/run o ~$0,31 por cinco ejecuciones. Deja los números en los límites y no destaca la tarea vencida como Sonnet. Segundo candidato por utilidad, precio y tiempo."],
};
assert.equal(weekly.current.data.net_sales, 9954.7);
assert.equal(weekly.previous.data.net_sales, 11505.6);
const summaries = report.results.filter((row) => row.case_id === caseId).map((row) => {
  assert.equal(row.status, "completed", row.model_id);
  const raw = parseOutput(row.raw_response) as any;
  const parsed = buildLeanOutputContract(["findings", "recommendations"]).schema.safeParse(raw);
  const output = parsed.success ? parsed.data : raw;
  assert.ok(output && Array.isArray(output.proposed_writes));
  row.checks.native_contract = parsed.success;
  row.review = { status: "reviewed", method: "automated", reviewer: "Codex · contraste con snapshot y backlog TEST", verdict: row.model_id === "claude-sonnet-5-5" ? "Principal: Sonnet 5.5; fallback: Terra." : row.model_id === "gpt-6.1-terra" ? "Segundo candidato y fallback de Sonnet." : row.model_id === "claude-opus-5-5" ? "Ideas útiles, contrato nativo inválido; no seleccionable automáticamente." : "Comparado; consultar observaciones.", notes: [...notes[row.model_id]!, "Una muestra TEST, revisión del asistente sin panel humano independiente. No valida tools dinámicas. Precio equivalente API en frío con sobrecarga CLI; los intentos sin recibo tienen consumo desconocido."] };
  const u = row.usage;
  const total = row.model_id.startsWith("claude-") ? Number(u.input ?? 0) + Number(u.cached ?? 0) + Number(u.cache_creation ?? 0) : Number(u.input ?? 0);
  const price = calculateLabApiPrice(row.model_id, { input: total, cached: 0, cache_creation: 0, output: u.output }); assert.ok(price);
  return { model: row.model_id, native_contract: parsed.success, validation_errors: parsed.success ? [] : parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })), tasks: output.proposed_writes.length, confidence: output.confidence, input_total: total, output_tokens: u.output, cli_ms: row.duration_ms, cold_usd_per_run: price.low, monthly_30_days_5_runs_usd: price.low * 5, answer: output.answer, warnings: output.warnings, proposals: output.proposed_writes };
});
assert.equal(summaries.length, 6);
for (const issue of [
  { id: "a17-store-cron-ui-scope", severity: "high" as const, title: "El cron semanal no generaba el alcance de tienda de la UI", detail: "A17 se programaba para la organización y enviaba connectionId=null.", status: "fixed" as const, evidence: "Prueba de scopes reproducida en rojo y verde; dos sesiones autenticadas reciben el mismo output.", resolution: "Scopes de tienda y connectionId propagado; sección A17 compartida en Tareas." },
  { id: "a17-weekly-context-missing", severity: "high" as const, title: "Faltaban ventas semanales y títulos para deduplicar", detail: "La tanda inicial solo tenía agregados de treinta días y un backlog abreviado.", status: "fixed" as const, evidence: "weekly-v2: dos semanas de siete días, acumulado mensual, 72 títulos y plan_id. Serialización completa verificada.", resolution: "Ventanas explícitas, índice y límites de contexto de A17; primera tanda archivada." },
  { id: "a17-opus-due-hint-invalid", severity: "medium" as const, title: "Opus propone dos tareas pero incumple due_hint", detail: "La primera propuesta supera el máximo de cien caracteres en el plazo; el contrato nativo la rechaza.", status: "limited" as const, evidence: "weekly-v2: claude-opus-5-5, proposed_writes.0.due_hint. Respuesta íntegra conservada, sin recorte para forzar validez.", resolution: "Sonnet principal y Terra fallback. Nueva prueba necesaria para considerar Opus automáticamente." },
]) {
  const value = { ...issue, agent_code: "a17_plan_semanal" };
  const index = report.issues.findIndex((item) => item.id === issue.id);
  if (index < 0) report.issues.push(value); else report.issues[index] = value;
}
const old = report.cases.find((row) => row.id === "a17_plan_semanal:real-store-runtime-2026-11-06");
if (old && !old.label.includes("Archivada")) old.label += " · Archivada: faltaban ventanas semanales e índice de tareas";
if (old && !old.limitations.some((text) => text.startsWith("EXCLUIDA"))) old.limitations.push("EXCLUIDA del veredicto: faltaban comparación semanal, acumulado mensual, plan_id e índice completo de títulos. Sus seis respuestas y consumos se conservan como diagnóstico del contexto.");
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
await mkdir(".e-nora-test-lab/a17-real-2026-11-06", { recursive: true });
await writeFile(".e-nora-test-lab/a17-real-2026-11-06/review.json", JSON.stringify({ case_id: caseId, context_limits: contextLimits, context_serialized_chars: serialized.text.length, native_context_not_truncated: true, weekly_metrics: weekly, summaries, price_basis: "Equivalente API en frío sobre tokens CLI, catálogo local 28/10/2026; no factura ni tarifa actual verificada. Cinco ejecuciones por 30 días por tienda; cliente y consultor comparten lectura. No incluye ejecuciones manuales, tools, juez o fallback activado." }, null, 2));
console.log(JSON.stringify(summaries.map(({ answer, warnings, proposals, ...summary }) => summary), null, 2));
