import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { currentCampaignPlanOutputSchema, flattenCampaignPlanActions } from "../packages/ai/src/index.js";
import { parseOutput } from "./ai-model-lab-core.js";
const path = ".e-nora-test-lab/ai-models/report.json";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
assert.ok(!report.active_batch);
const row = report.results.find((item) => item.case_id === "a05_estrategia_campanas:clean-runtime-v2-2026-10-31" && item.model_id === "gpt-6.1-sol");
assert.ok(row?.status === "completed");
const plan = currentCampaignPlanOutputSchema.parse(parseOutput(row.raw_response));
const actions = flattenCampaignPlanActions(plan);
assert.equal(actions.length, 4);
assert.ok(actions.every((action) => action.channel === "Email" && action.scheduled_date >= "2026-11-01" && action.scheduled_date <= "2026-12-31"));
row.review = { status: "reviewed", method: "automated", reviewer: "Codex · revisión de estructura y fuentes",
  verdict: "Borrador revisable: 3 iniciativas y 4 emails condicionales; no listo para enviar. Confianza baja y requisitos pendientes explícitos.",
  notes: [
    "Contrato nativo válido y cuatro acciones Email dentro de la ventana. Sin propuestas Meta ni reconstrucción de flows existentes.",
    "Usa variantes verificadas de The Complete Snowboard y Gift Card del catálogo actual. Las dos propuestas comerciales dependen de validaciones; no se aprueban inventario futuro, URLs ni audiencias.",
    "La limpieza afecta solo a NORA/TEST. Dos piezas proponen replantear borradores externos que se conservaron; no se crearon ni enviaron campañas externas.",
    "El modelo señala 15 campañas frente a 14 clasificadas: el total del proveedor incluye un canal distinto de email. Esa diferencia no demuestra una pérdida de datos. Se aclararon los nombres de cobertura de la herramienta para próximas lecturas; la respuesta original se conserva.",
    "Señala correctamente datos de demostración y requisitos de consentimientos, moneda, promociones y medición. Las fechas/hora usan America/New_York, según la tienda, y no acreditan una hora óptima para ES.",
    "CLI solicitada a Sol; el ID servido no queda acreditado por JSONL. Las herramientas fueron preseleccionadas por el arnés, no llamadas dinámicamente por el modelo. No es una comparación nueva entre modelos.",
  ] };
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2));
await rename(`${path}.tmp`, path);
console.log(JSON.stringify({ reviewed: true, initiatives: plan.initiatives.length, actions: actions.length, confidence: plan.confidence }));
