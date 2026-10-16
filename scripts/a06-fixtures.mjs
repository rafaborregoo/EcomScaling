/**
 * Casos de desarrollo de A06 (planificador de stock). Base REAL: los 8
 * productos con ventas de E-NORA Demo a 15-oct-2026 (inventario, ventas de 30
 * días, previsión y serie de 52 semanas), su Camino y su backlog. Encima, cada
 * caso añade una incidencia inventada verosímil.
 *
 * Todos son SINTÉTICOS (split development): el gate solo admite como
 * calibración o release casos de producción real anonimizados y revisados.
 *
 * Uso: node scripts/a06-fixtures.mjs   (escribe apps/api/eval-fixtures/a06/development)
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/api/eval-fixtures/a06/development");

// Mismo JSON canónico que agent-release-eval-fixture.ts: el hash debe coincidir.
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
const sha = (value) => createHash("sha256").update(stableJson(value)).digest("hex");
const source = (key, content, asOf) => ({ key, status: "available", content, content_sha256: sha(content), as_of: asOf });

// --- Datos reales (snapshot de A06 del 15-oct-2026) --------------------------
// [titulo, product_id, disponible, vendidas30d, pedidos, dias_venta, cobertura, riesgo, forecast30d, serie52 desde 2025-10-13]
const REAL_PRODUCTS = [
  ["Camiseta Básica Niebla", "ead98dd1-9c9c-4f5f-a930-338c680fe123", 40, 150, 136, 30, 8, "watch", 147, "21,22,25,11,27,61,72,33,23,22,21,18,21,19,16,25,27,15,11,9,13,10,21,23,16,21,24,18,23,28,31,43,30,32,27,52,41,16,17,18,25,16,19,27,18,28,24,18,29,38,34,34"],
  ["Bolso Mini Bruma", "d59de466-112d-4947-bb20-69a375d64420", 12, 146, 137, 31, 2.5, "high", 151, "24,30,22,19,33,65,80,21,14,24,21,25,21,22,18,22,16,22,10,15,12,12,20,21,20,27,28,24,20,22,46,32,33,35,42,43,38,21,20,19,23,26,22,20,18,33,23,23,30,37,34,34"],
  ["Sudadera Oversize Arena", "8061d2df-26a9-4063-ae95-5c008dd2f116", 25, 145, 135, 31, 5.2, "high", 147, "21,20,15,25,29,70,61,30,24,22,25,20,18,15,21,16,22,15,15,10,13,17,19,14,13,26,22,25,22,13,33,35,41,34,42,31,43,31,18,14,21,23,23,21,25,17,19,21,30,46,32,31"],
  ["Sudadera Capucha Arcilla", "3143e617-8dcc-4bd4-9ff7-d01077e87755", 6, 132, 124, 30, 1.4, "high", 134, "17,20,23,25,36,67,81,28,18,18,17,27,23,15,23,16,18,24,5,9,9,11,27,30,33,12,19,22,23,21,34,44,32,29,37,33,39,30,24,19,23,13,15,16,26,16,14,24,30,32,31,31"],
  ["Calcetín Rib Menta", "0222a751-dd63-4ff1-888d-5a05e40da3fc", 75, 130, 116, 31, 17.3, "covered", 132, "22,25,20,22,29,49,52,37,21,21,24,19,27,29,15,17,20,24,11,13,15,11,18,19,21,24,15,20,28,21,55,48,34,41,37,42,33,22,14,12,18,33,24,18,17,28,16,23,29,22,33,33"],
  ["Chaqueta Boreal Negra", "0b5293d6-485f-4302-88cc-2d69f3b8e620", 8, 127, 120, 30, 1.9, "high", 124, "22,17,24,14,31,54,59,32,14,21,26,19,19,25,21,20,21,19,13,9,10,8,14,19,27,15,21,23,19,29,39,29,52,52,35,36,40,13,13,17,17,16,20,26,22,18,25,15,32,33,25,25"],
  ["Gorra Costa Cruda", "63214020-4209-4268-9146-0279bf9e6818", 45, 118, 113, 27, 11.5, "watch", 119, "14,20,25,33,41,59,61,42,22,26,22,33,27,19,20,20,17,16,14,17,14,13,31,24,25,21,20,21,25,23,37,37,49,31,46,39,39,23,14,20,25,24,25,24,23,10,29,18,18,20,32,32"],
  ["Pantalón Cargo Oliva", "acae8657-2e03-401b-82a4-4ab4808d6afd", 18, 100, 91, 28, 5.4, "high", 99, "29,19,20,24,47,71,69,42,29,21,20,18,14,28,21,25,19,26,19,18,11,14,20,23,20,27,21,18,18,20,37,39,37,47,38,27,28,28,11,10,13,22,25,29,21,25,24,18,30,26,19,19"],
];

function product([title, id, available, sold, orders, sellingDays, cover, risk, forecast30d, weekly], overrides = {}) {
  const avg = Math.round((sold / 30) * 100) / 100;
  return {
    title, product_id: id, available_quantity: available, quantity_sold_in_period: sold, order_count: orders,
    selling_days: sellingDays, average_daily_sales: avg, days_of_cover: cover, stock_coverage_sample_sufficient: true,
    inventory_status: "tracked_current", inventory_sync_age_hours: 9.8, inventory_sync_is_stale: false,
    demand_forecast: { risk, weeks: 12, quality: "strong", forecast30d, coverageDays: cover, sellingWeeks: 12 },
    weekly_units_last_52: { first_week_start: "2025-10-13", units: weekly.split(",").map(Number) },
    ...overrides,
  };
}
/** El mismo producto con stock suficiente para N días de cobertura. */
const healthy = (row, days) => {
  const available = Math.round((row[3] / 30) * days);
  return product(row, { available_quantity: available, days_of_cover: days, demand_forecast: { risk: "covered", weeks: 12, quality: "strong", forecast30d: row[8], coverageDays: days, sellingWeeks: 12 } });
};

const REAL_OPEN_TASKS = {
  scope: "store_plus_unscoped", total_open: 14, near_term_window_days: 14,
  near_term: [
    { title: "Preparar el registro de interés en Black Friday ya planificado", priority: "urgent", status: "pending", due_at: "2026-10-16T00:00:00Z", source: "strategic_plan" },
    { title: "Verificar las condiciones que limitan la campaña", priority: "urgent", status: "pending", due_at: "2026-10-16T00:00:00Z", source: "strategic_plan" },
    { title: "Verificar existencias, costes y medición antes de definir la campaña", priority: "urgent", status: "pending", due_at: "2026-10-17T00:00:00Z", source: "strategic_plan" },
    { title: "Seleccionar variantes líderes que puedan anunciarse", priority: "urgent", status: "pending", due_at: "2026-10-18T00:00:00Z", source: "strategic_plan" },
    { title: "Cerrar la selección y la oferta de Black Friday", priority: "urgent", status: "pending", due_at: "2026-10-25T00:00:00Z", source: "strategic_plan" },
  ],
  near_term_omitted: 0, later_count: 2,
  later: [
    { title: "Dimensionar expedición y soporte para Black Friday", priority: "high", due_at: "2026-11-01T00:00:00Z" },
    { title: "Preparar colección, anuncios y secuencia de Black Friday", priority: "high", due_at: "2026-11-07T00:00:00Z" },
  ],
  note: "near_term trae detalle; later son tareas con fecha lejana y solo se listan para no duplicarlas.",
};
const REAL_CAMINO = {
  status: "available", plan: "E-NORA Demo: vender la campaña de invierno sin perder margen",
  phases: [{ name: "Capturar el pico de noviembre", status: "pending" }, { name: "Convertir invierno en ventas y segunda compra", status: "pending" }],
  milestones: [{ id: "3e6cecb1-0d26-4b34-9b22-664579461420", phase: "Puesta a punto en paralelo con la campaña", name: "Productos líderes, captación y control de inversión listos el 26 de octubre", status: "pending", target_date: "2026-10-29",
    description: "Cada variante seleccionada tiene disponibilidad y coste comprobados.", linked_tasks: [{ title: "Seleccionar variantes líderes que puedan anunciarse", status: "pending" }] }],
};
const RAG_STOCK = { documento: "FASE 5.07 — Inventario, stockout, overstock y replenishment", extracto: "Stockout: existe cuando demanda supera inventario disponible. No debe escalarse tráfico hacia un producto sin capacidad de entrega. Cuando hay stockout, las ventas observadas subestiman la demanda real. El overstock inmoviliza caja: se trata con merchandising o liquidación planificada, no con más compra." };
const CALENDAR_BASE = [{ key: "black_friday", name: "Black Friday", date: "2026-11-27", scope: "global" }, { key: "cyber_monday", name: "Cyber Monday", date: "2026-11-30", scope: "global" }, { key: "temporada_nieve", name: "Temporada de nieve", date: "2026-12-01", scope: "categoria" }];

const OBJECTIVE = 'Prever la demanda de los productos y priorizar riesgos de rotura en la tienda "E-NORA Demo". Separa la linea base reciente del escenario de campaña. Contrasta Black Friday y las campañas propias planificadas con ventas comparables del producto; un descuento previsto no justifica por si solo aumentar unidades. Explica la cobertura y calidad de la señal, evita cantidades de compra y propone solo tareas de reposicion justificadas por la evidencia. Cita en sources[].reference exactamente la clave (key) de cada fuente congelada que uses.';

function fixture(c) {
  const asOf = "2026-10-15T07:00:00Z";
  const items = c.items ?? REAL_PRODUCTS.map((row) => product(row));
  return {
    schema_version: "agent-release-replay-v1",
    agent_code: "a06_planificador_stock",
    dataset_version: "2026-10-15.a06.v1",
    rubric_version: "judge-rubrics-v7",
    split: "development",
    provenance: "synthetic",
    privacy_reviewed: false,
    scenario: `${c.id} ${c.scenario}`,
    input: { objective: OBJECTIVE, parameters: { lookback_days: 30, reference_date: "2026-10-15" } },
    scope: { organization_ref: "org-demo-anon", store_ref: "store-demo-anon", timezone: "Europe/Madrid", period_start: "2026-09-15", period_end: "2026-10-15" },
    sources: [
      source("stock_agregado", c.stockSummary ?? { tracked_items: 34, low_stock_items: 4, total_available: 457, out_of_stock_items: 7 }, asOf),
      source("productos_riesgo_stock", { store: "E-NORA Demo", period_start: "2026-09-15", period_end: "2026-10-15", status: "available", items }, asOf),
      source("tareas_abiertas", c.openTasks ?? REAL_OPEN_TASKS, asOf),
      source("tareas_cerradas_60d", c.closedTasks ?? [], asOf),
      source("mi_camino", REAL_CAMINO, asOf),
      source("calendario_campanas", { reference_events: CALENDAR_BASE, own_campaigns: c.campaigns ?? [] }, asOf),
      source("asignacion_consultor", { has_consultant: true, decision_rule: "Las propuestas quedan pendientes de revision del consultor humano asignado." }, asOf),
      source("conocimiento_rag", [RAG_STOCK], asOf),
    ],
    tool_replay: [],
    visual_artifacts: [],
    constraints: {
      expected_abstention: c.abstain ?? false,
      required_output_paths: c.expectTask ? ["$.proposed_writes[0]"] : [],
      forbidden_output_paths: c.expectTask === false ? ["$.proposed_writes[0]"] : ["$.proposed_writes[6]"],
    },
  };
}

const [NIEBLA, BOLSO, OVERSIZE, ARCILLA, MENTA, BOREAL, GORRA, CARGO] = REAL_PRODUCTS;
const allHealthy = () => REAL_PRODUCTS.map((row) => healthy(row, 45));

const CASES = [
  { id: "S01", expectTask: true, invented: "nada: inventario, ventas, backlog y Camino reales del 15-oct-2026.",
    scenario: "Día real: tres best-sellers con menos de 3 días de cobertura y dos con unos 5 días; ninguna tarea abierta trata su reposición. Debe priorizar por cobertura con related_product_id exacto y sin inventar cantidades." },
  { id: "S02", expectTask: true, invented: "la tarea en curso de reposición de la Sudadera Capucha Arcilla.",
    scenario: "Como S01, pero ya hay una tarea EN CURSO para reponer la Sudadera Capucha Arcilla que vence mañana: no debe duplicarla; sí tratar los otros productos en riesgo.",
    openTasks: { ...REAL_OPEN_TASKS, near_term: [...REAL_OPEN_TASKS.near_term, { title: "Reponer Sudadera Capucha Arcilla con el proveedor", priority: "urgent", status: "in_progress", due_at: "2026-10-16T00:00:00Z", source: "manual" }] } },
  { id: "S03", invented: "el fallo de sincronización de inventario (5 días sin sincronizar).",
    scenario: "El inventario lleva 5 días sin sincronizar: la cobertura no es calculable aunque haya ventas. No debe afirmar roturas ni proponer reponer; como mucho revisar la sincronización, con confianza baja.",
    items: REAL_PRODUCTS.map((row) => product(row, { inventory_sync_age_hours: 121, inventory_sync_is_stale: true, days_of_cover: null, demand_forecast: { risk: "unknown", weeks: 12, quality: "strong", forecast30d: row[8], coverageDays: null, sellingWeeks: 12 } })) },
  { id: "S04", expectTask: false, invented: "el stock de todos los productos (45 días de cobertura).",
    scenario: "Todos los productos tienen unos 45 días de cobertura con sincronización de hoy. Lo correcto es no proponer reposición y decir qué cobertura tiene el producto más justo.",
    items: allHealthy(), stockSummary: { tracked_items: 34, low_stock_items: 0, total_available: 1890, out_of_stock_items: 0 } },
  { id: "S05", expectTask: false, invented: "la tarea ignorada y la cobertura sana del resto.",
    scenario: "El Bolso Mini Bruma tiene 2,5 días de cobertura, pero su reposición se ignoró hace 10 días porque el proveedor no tiene stock hasta noviembre. Sin evidencia nueva no debe re-proponerla; debe mencionarlo.",
    items: REAL_PRODUCTS.map((row) => (row === BOLSO ? product(row) : healthy(row, 40))),
    closedTasks: [{ title: "Reponer Bolso Mini Bruma", status: "ignored", source: "ai_consultant", updated_at: "2026-10-05T10:00:00Z", ignored_reason: "El proveedor no tiene stock hasta noviembre" }] },
  { id: "S06", expectTask: false, invented: "el producto nuevo y la cobertura sana del resto.",
    scenario: "Producto nuevo con 3 ventas en 2 días y 2 unidades: la muestra no basta para estimar cobertura. No debe proponer reposición urgente por él; el resto está cubierto.",
    items: [...allHealthy(), { title: "Abrigo Lana Piedra", product_id: "5d1f6c2a-8e4b-4f1d-9a77-2c3e4b5a6d7e", available_quantity: 2, quantity_sold_in_period: 3, order_count: 3, selling_days: 2, average_daily_sales: null, days_of_cover: null, stock_coverage_sample_sufficient: false, inventory_status: "tracked_current", inventory_sync_age_hours: 9.8, inventory_sync_is_stale: false, demand_forecast: null, weekly_units_last_52: { first_week_start: "2025-10-13", units: [...Array(50).fill(0), 1, 2] } }] },
  { id: "S07", expectTask: true, invented: "la campaña de Black Friday con 30 % sobre la Chaqueta Boreal Negra y su cobertura de 20 días.",
    scenario: "Campaña planificada de Black Friday con 30 % sobre la Chaqueta Boreal Negra; hoy tiene 20 días de cobertura base, pero el año pasado vendió el doble en esas semanas. Debe separar base y campaña y proponer revisar la reposición antes, sin inventar cantidades.",
    items: REAL_PRODUCTS.map((row) => (row === BOREAL ? healthy(row, 20) : healthy(row, 45))),
    campaigns: [{ title: "Black Friday: Chaqueta Boreal Negra", description: "Campaña principal de Black Friday centrada en la chaqueta", channel: "Meta + Email", item_type: "campaign", starts_at: "2026-11-20T08:00:00Z", ends_at: "2026-11-30T23:00:00Z", status: "planned", discount_pct: 30, product_ids: ["0b5293d6-485f-4302-88cc-2d69f3b8e620"] }] },
  { id: "S08", expectTask: false, invented: "la sincronización parcial de la Chaqueta Boreal Negra.",
    scenario: "La Chaqueta Boreal Negra aparece con 0 unidades pero su sincronización es parcial (2 de 5 variantes): no debe afirmar que está agotada ni proponer reponerla; debe señalar la incidencia de datos.",
    items: REAL_PRODUCTS.map((row) => (row === BOREAL ? product(row, { available_quantity: 0, days_of_cover: null, inventory_status: "partial_sync", tracked_variants: 5, synced_variants: 2 }) : healthy(row, 40))) },
];

mkdirSync(outDir, { recursive: true });
for (const c of CASES) writeFileSync(path.join(outDir, `${c.id}.json`), `${JSON.stringify(fixture(c), null, 2)}\n`);
writeFileSync(path.join(outDir, "procedencia.json"), `${JSON.stringify(Object.fromEntries(CASES.map((c) => [c.id, { real: "Inventario, ventas, serie semanal, backlog y Camino de E-NORA Demo a 15-oct-2026", inventado: c.invented }])), null, 2)}\n`);
console.log(`${CASES.length} fixtures en ${outDir}`);
