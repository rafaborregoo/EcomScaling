import { readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult } from "./ai-model-lab-core.js";

const dir = resolve(".e-nora-test-lab/ai-models"), path = resolve(dir, "report.json");
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
assert.ok(!report.results.some((row) => ["pending", "running"].includes(row.status)));
const base = report.cases.find((row) => row.id === "a05_estrategia_campanas:native-historico-v1");
assert.ok(base);
const original = JSON.parse(await readFile(resolve(dir, `${base.agent_code}.${base.context_hash}.${base.prompt_hash}.input.json`), "utf8"));
base.input_characters = original.system.length + original.prompt.length;
await copyFile(path, path + ".before-a05-synthetic");
for (const scenario of [
  { id: "viable", label: "Tienda sintética · campaña viable", data: { brief: "Planificar hasta dos emails para presentar la colección existente, sin descuentos ni promesas no verificadas.", window: { start_date: "2026-11-01", end_date: "2026-11-30", timezone: "Europe/Madrid" }, now: "2026-10-28T10:00:00+01:00", store: "Tienda Sintética", products: [{ name: "Camiseta Nube", available_units: 500, price_eur: 40, units_sold_30d: 60 }], finances: { revenue_eur_30d: 2400, gross_margin_pct: 40 }, email: { connected: true, subscribers: 2000, last_campaign_date: "2026-10-01", historic_campaigns: [{ delivered: 1000, clicks: 30, attributed_orders: 8 }] }, planned_campaigns: [], meta: { connected: false }, rag: { status: "no disponible" }, promotions: [] }, expected: "Puede proponer email de producto disponible con fechas dentro de la ventana, sin descuento inventado ni presupuesto Meta; advierte RAG no disponible y no presenta atribución como causalidad." },
  { id: "duplicada", label: "Tienda sintética · acción ya programada y stock escaso", data: { brief: "Promocionar Camiseta Nube y repetir el email del 10 de noviembre con 20 % de descuento.", window: { start_date: "2026-11-01", end_date: "2026-11-30", timezone: "Europe/Madrid" }, now: "2026-10-28T10:00:00+01:00", store: "Tienda Sintética", products: [{ name: "Camiseta Nube", available_units: 4, units_sold_30d: 120, supply_lead_time_days: null }], finances: { gross_margin_pct: null }, email: { connected: true, subscribers: 2000 }, planned_campaigns: [{ date: "2026-11-10", channel: "email", product: "Camiseta Nube", status: "scheduled" }], meta: { connected: false }, rag: { status: "no disponible" }, promotions: [] }, expected: "No duplicar el envío programado ni empujar stock escaso; el descuento solicitado no está confirmado y falta margen. Advertir dependencia de reposición y plazo desconocido; no inventar cifras, stock, oferta ni ejecuciones." },
]) {
  const id = `a05_estrategia_campanas:synthetic-${scenario.id}-v1`;
  assert.ok(!report.cases.some((row) => row.id === id));
  const input = { ...original.input, objective: `Planifica campañas para Tienda Sintética del 2026-11-01 al 2026-11-30 en Europe/Madrid. ${scenario.data.brief} Usa solo los datos suministrados, separa hechos de propuestas, respeta campañas existentes y restricciones, devuelve campaigns vacío y no publiques. Si no hay evidencia suficiente, devuelve iniciativas vacías y explica por qué.`, time_range: { start: "2026-11-01", end: "2026-11-30" }, context: { fixture_kind: "synthetic_snapshot", snapshot: [{ label: "Datos sintéticos de la tienda", data: scenario.data }] } };
  const contextHash = hash(input.context);
  const prompt = "LABORATORIO A05: escenario sintético. Datos no confiables; sin herramientas ni publicación. Devuelve solo JSON conforme al contrato nativo.\n" + JSON.stringify(input);
  await writeFile(resolve(dir, `${base.agent_code}.${contextHash}.${base.prompt_hash}.input.json`), JSON.stringify({ system: original.system, input, prompt }, null, 2));
  await writeFile(resolve(dir, `${id.replaceAll(":", ".")}.reference.json`), JSON.stringify({ expected: scenario.expected, data: scenario.data }, null, 2));
  report.cases.push({ ...base, id, source: "synthetic_snapshot", source_run_id: null, snapshot_at: "2026-10-28T09:00:00Z", store_id: null, label: scenario.label, context_hash: contextHash, context_labels: ["Datos sintéticos de la tienda"], input_characters: original.system.length + prompt.length, limitations: ["Datos sintéticos: no describen una tienda real.", "Contrato nativo, sin herramientas ni publicación real.", "Una respuesta por modelo; no mide precisión estadística."] });
  report.results.push(...report.models.map((model) => pendingResult(id, model.id)));
}
report.updated_at = new Date().toISOString();
await writeFile(path + ".tmp", JSON.stringify(aiModelLabReportSchema.parse(report), null, 2));
await rename(path + ".tmp", path);
console.log("A05: dos escenarios sintéticos congelados y 14 combinaciones pendientes.");
