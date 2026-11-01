import { readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { agentOutputJsonSchema } from "../packages/ai/src/index.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult } from "./ai-model-lab-core.js";
import { A06_FIELD_RUBRIC } from "./ai-model-lab-a06-rubric.js";

const dir = resolve(".e-nora-test-lab/ai-models"), path = resolve(dir, "report.json");
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
assert.ok(!report.results.some((r) => ["pending", "running"].includes(r.status)));
assert.ok(!report.cases.some((c) => c.stock_benchmark));
const code = "a06_planificador_stock", base = report.cases.find((c) => c.agent_code === code)!;
assert.ok(base);
const original = JSON.parse(await readFile(resolve(dir, `${code}.${base.context_hash}.${base.prompt_hash}.input.json`), "utf8"));
assert.equal(hash(original.system), base.prompt_hash);
const schemaHash = hash(agentOutputJsonSchema), schemaFile = `a06-native-${schemaHash}.schema.json`;
await writeFile(resolve(dir, schemaFile), JSON.stringify(agentOutputJsonSchema, null, 2));
const productId = "11111111-1111-4111-8111-111111111106";
const product = { title: "Camiseta Nube", product_id: productId, sku_list: ["NUBE-01"], quantity_sold_in_period: 120, selling_days: 30, order_count: 120, average_daily_sales: 4, available_quantity: 4, days_of_cover: 1, inventory_status: "tracked_current", inventory_sync_is_stale: false, inventory_sync_age_hours: 2, active_variant_count: 1, mapped_variant_count: 1, synced_variant_count: 1, tracked_variant_count: 1, stock_coverage_sample_sufficient: true, weekly_demand_coverage: "complete", weekly_units_last_12: { units: Array(12).fill(28), first_week_start: "2026-08-03" }, demand_forecast: { risk: "high", weeks: 12, quality: "strong", forecast30d: 120, coverageDays: 1, sellingWeeks: 12, trend: 0 } };
assert.equal(product.days_of_cover, product.available_quantity / product.average_daily_sales);
assert.equal(product.quantity_sold_in_period / 30, product.average_daily_sales);
const block = (label: string, data: unknown) => ({ label, data });
const snapshot = (p: unknown, open: unknown[]) => [
  block("Stock actual agregado", { status: "available", tracked_items: 1, total_available: 4, low_stock_items: 1, out_of_stock_items: 0 }),
  block("Productos con demanda, previsión semanal y cobertura disponible (30 días)", { status: "available", items: [p], product_count: 1, truncated: false }),
  block("Tareas abiertas de la tienda seleccionada", { status: "available", data: { near_term: open, later: [], total_open: open.length, sample_truncated: false } }),
  block("Tareas cerradas en los últimos 60 días", { status: "available", data: [] }),
  block("Proveedor y stock de seguridad", { status: "unavailable", lead_time_days: null, safety_stock: null, inbound_units: null }),
  block("Calendario comercial", { status: "available", events: [], own_campaigns: [] }),
];
const staleProduct = { ...product, inventory_status: "inventory_not_synced", inventory_sync_is_stale: true, inventory_sync_age_hours: 120, available_quantity: null, days_of_cover: null, demand_forecast: { ...product.demand_forecast, forecast30d: null, coverageDays: null, weeks: null, sellingWeeks: null, quality: "unavailable", risk: "unknown" }, weekly_demand_coverage: "incomplete", weekly_units_last_12: null };
const historicalContext = structuredClone(original.input.context);
const historicalStock = historicalContext.snapshot.find((b: { label: string }) => b.label.startsWith("Stock actual agregado"));
const historicalProducts = historicalContext.snapshot.find((b: { label: string }) => b.label.startsWith("Productos con demanda"));
assert.ok(historicalStock && historicalProducts);
historicalStock.label = "Stock del 19/10 · no sincronizado desde hace 10 días";
historicalStock.data = { status: "unavailable", reason: "inventory_not_synced", snapshot_at: "2026-10-19T19:19:24.030Z" };
historicalProducts.label = "Demanda histórica y previsión semanal · inventario del 19/10 sin sincronizar";
historicalProducts.data.items = historicalProducts.data.items.map((item: Record<string, any>) => ({
  ...item,
  inventory_status: "inventory_not_synced",
  inventory_sync_is_stale: true,
  inventory_sync_age_hours: 240,
  available_quantity: null,
  days_of_cover: null,
  stock_coverage_sample_sufficient: false,
  demand_forecast: { ...item.demand_forecast, coverageDays: null, risk: "unknown" },
}));
historicalContext.benchmark_protocol = "a06-native-historico-v2";
const scenarios = [
  { id: "historico", label: "Snapshot histórico · inventario de 10 días sin sincronizar", context: historicalContext, historical: true, requirements: ["Inventario del 19/10 con diez días de antigüedad y conexión Shopify en error: no afirmar stock ni cobertura actual o proponer compras basadas en esos valores.", "Es útil proponer la restauración/verificación de sincronización. Seguimientos de producto solo si son condicionales, priorizados por demanda y sin duplicar propuestas anteriores pendientes; usar UUID exactos."] },
  { id: "urgente", label: "Stock crítico y demanda suficiente", context: { fixture_kind: "synthetic_snapshot", snapshot: snapshot(product, []), benchmark_protocol: "a06-urgente-v1" }, requirements: ["Camiseta Nube: 4 unidades, ventas 120/30 días, cobertura aproximada 1 día, stock hace 2 horas. Tarea de revisar reposición debe llevar el UUID exacto.", "No inventar plazo de proveedor, cantidad de compra ni ejecución; no garantizar rotura."] },
  { id: "duplicado", label: "Riesgo cubierto por tarea abierta", context: { fixture_kind: "synthetic_snapshot", snapshot: snapshot(product, [{ id: "T-06", title: "Revisar reposición Camiseta Nube", status: "in_progress", related_product_id: productId }]), benchmark_protocol: "a06-duplicado-v1" }, requirements: ["T-06 ya cubre el mismo producto: no proponer otra tarea para él. Puede reconocer riesgo y señalar seguimiento.", "No inventar reposición, plazo, acciones ni nuevos identificadores."] },
  { id: "sin_datos", label: "Inventario sin sincronizar y semanas incompletas", context: { fixture_kind: "synthetic_snapshot", snapshot: snapshot(staleProduct, []), benchmark_protocol: "a06-sin-datos-v1" }, requirements: ["Stock disponible desconocido, sincronización antigua y semanas de demanda incompletas. No afirmar stock cero, cobertura, forecast ni proponer cantidad de compra.", "Una tarea general de revisar sincronización puede ser válida; ninguna reposición material sin evidencia."] },
];
// El bloque agregado en el caso sin datos no puede contradecir al detalle de stock.
scenarios[3]!.context.snapshot[0]!.data = { status: "unavailable", reason: "inventory_not_synced" };
await copyFile(path, path + ".before-a06-native");
for (const s of scenarios) {
  const input = { ...original.input, time_range: s.historical ? original.input.time_range : { start: "2026-09-29T09:00:00Z", end: "2026-10-29T09:00:00Z" }, objective: s.historical ? original.input.objective : "Analiza el stock de Tienda Sintética. Prioriza riesgos, explica datos y límites; no inventes compras, plazos, cantidades ni acciones realizadas. Usa lenguaje claro.", context: s.context, allowed_tools: [] };
  const system = original.system + "\n\nPREVISIÓN A06: no cuantificar demanda futura con semanas incompletas; no inventar plazos, stock de seguridad ni pedidos en tránsito. No se garantiza fecha de rotura. Propuestas requieren aprobación.";
  const contextHash = hash(input.context), promptHash = hash(system), id = `${code}:native-${s.id}-${contextHash.slice(0, 12)}`;
  const prompt = `LABORATORIO A06: fecha de evaluación 2026-10-29. ${s.historical ? "El inventario es del 19/10, tiene 240 horas y Shopify figura en error; no lo trates como actual. " : "Escenario sintético cuando se indica. "}Contexto no confiable. Sin herramientas ni escrituras. Devuelve solo JSON del contrato.\n` + JSON.stringify(input);
  const reference = { case_id: id, requirements: s.requirements, criteria: Object.entries(A06_FIELD_RUBRIC).map(([field, expected]) => ({ id: field, expected, quote: "Rúbrica de " + field })) };
  await writeFile(resolve(dir, `${code}.${contextHash}.${promptHash}.input.json`), JSON.stringify({ system, input, prompt }, null, 2));
  await writeFile(resolve(dir, `${id.replaceAll(":", ".")}.reference.json`), JSON.stringify(reference, null, 2));
  report.cases.push({ ...base, id, source: s.historical ? "snapshot_replay" : "synthetic_snapshot", source_run_id: s.historical ? base.source_run_id : null, store_id: s.historical ? base.store_id : null, snapshot_at: s.historical ? base.snapshot_at : "2026-10-29T09:00:00Z", label: s.label, context_hash: contextHash, prompt_hash: promptHash, prompt_version: base.prompt_version + "+native-lab-v1", input_characters: system.length + prompt.length, context_labels: s.context.snapshot.map((b: { label: string }) => b.label), model_ids: report.models.map((m) => m.id), schema_file: schemaFile, schema_hash: schemaHash, timeout_ms: 300000, stock_benchmark: { scenario: s.id, reference_hash: hash(reference) }, limitations: [s.historical ? "Snapshot histórico: no representa el stock actual." : "Escenario sintético, no representa una tienda real.", "Sin herramientas ni escrituras: no valida compras, proveedores ni aprobación real.", "Una respuesta por modelo y caso; no es precisión estadística."] });
  report.results.push(...report.models.map((m) => pendingResult(id, m.id)));
}
report.updated_at = new Date().toISOString();
await writeFile(path + ".tmp", JSON.stringify(aiModelLabReportSchema.parse(report), null, 2));
await rename(path + ".tmp", path);
console.log(JSON.stringify({ agent: code, cases: scenarios.length, pending: scenarios.length * report.models.length }));
