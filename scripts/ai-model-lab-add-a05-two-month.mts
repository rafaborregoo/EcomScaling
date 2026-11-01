import { readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { campaignPlanJsonSchema } from "../packages/ai/src/index.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult } from "./ai-model-lab-core.js";

const dir = resolve(".e-nora-test-lab/ai-models");
const path = resolve(dir, "report.json");
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
if (report.results.some((row) => ["pending", "running"].includes(row.status)))
  throw new Error("active_batch");

const caseId = "a05_estrategia_campanas:real-store-two-months-v2-2026-11";
if (report.cases.some((item) => item.id === caseId))
  throw new Error("case_already_exists");
const base = report.cases.find(
  (item) => item.id === "a05_estrategia_campanas:native-historico-v1",
);
if (!base) throw new Error("a05_native_case_not_found");
const originalPath = resolve(
  dir,
  `${base.agent_code}.${base.context_hash}.${base.prompt_hash}.input.json`,
);
const original = JSON.parse(await readFile(originalPath, "utf8"));
const input = structuredClone(original.input);
const superseded = report.cases.find(
  (item) => item.id === "a05_estrategia_campanas:real-store-two-months-2026-11",
);
if (superseded) {
  superseded.label = "SUPERSEDED · A05 two-month test v1 (query included future-dated orders)";
  superseded.limitations.push(
    "Superseded by v2: first 90-day aggregation omitted an upper timestamp bound and included future-dated TEST orders.",
  );
}
const models = [
  "claude-haiku-5-5",
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "gpt-6-luna",
  "gpt-6.1-sol",
  "gpt-6.1-terra",
];
const evaluatedAt = "2026-10-30T11:46:29.197Z";
const currentTopProducts = [
  { title: "Chaqueta Boreal Negra", price_eur: 119, available_units: 8, units_sold_60d: 219, sales_eur_60d: 25942, estimated_cover_days: 2.2 },
  { title: "Sudadera Capucha Arcilla", price_eur: 68, available_units: 6, units_sold_60d: 245, sales_eur_60d: 16646.4, estimated_cover_days: 1.5 },
  { title: "Sudadera Oversize Arena", price_eur: 58, available_units: 25, units_sold_60d: 258, sales_eur_60d: 14772.6, estimated_cover_days: 5.8 },
  { title: "Pantalón Cargo Oliva", price_eur: 64, available_units: 18, units_sold_60d: 183, sales_eur_60d: 11660.8, estimated_cover_days: 5.9 },
  { title: "Bolso Mini Bruma", price_eur: 39, available_units: 12, units_sold_60d: 265, sales_eur_60d: 10288.2, estimated_cover_days: 2.7 },
  { title: "Camiseta Básica Niebla", price_eur: 29, available_units: 40, units_sold_60d: 266, sales_eur_60d: 7650.2, estimated_cover_days: 9.0 },
  { title: "Gorra Costa Cruda", price_eur: 24, available_units: 45, units_sold_60d: 235, sales_eur_60d: 5620.8, estimated_cover_days: 11.5 },
  { title: "Calcetín Rib Menta", price_eur: 12, available_units: 75, units_sold_60d: 241, sales_eur_60d: 2880, estimated_cover_days: 18.7 },
];
const refreshedMonths = [
  { bucket_month: "2026-05-01", gross_sales: 57379, discounts: 338.4, refunds: 0, net_sales: 57040.6, units_sold: 1121, orders_count: 1040, aov: 54.85 },
  { bucket_month: "2026-06-01", gross_sales: 67426, discounts: 431.7, refunds: 0, net_sales: 66994.3, units_sold: 1301, orders_count: 1208, aov: 55.46 },
  { bucket_month: "2026-07-01", gross_sales: 31791, discounts: 172.7, refunds: 0, net_sales: 31618.3, units_sold: 642, orders_count: 602, aov: 52.52 },
  { bucket_month: "2026-08-01", gross_sales: 411, discounts: 3.9, refunds: 0, net_sales: 407.1, units_sold: 8, orders_count: 8, aov: 50.89 },
  { bucket_month: "2026-08-01", gross_sales: 38773, discounts: 121.3, refunds: 0, net_sales: 38651.7, units_sold: 761, orders_count: 704, aov: 54.9 },
  { bucket_month: "2026-09-01", gross_sales: 46819, discounts: 222.7, refunds: 0, net_sales: 46596.3, units_sold: 899, orders_count: 833, aov: 55.94 },
  { bucket_month: "2026-10-01", gross_sales: 48377, discounts: 294.3, refunds: 0, net_sales: 48082.7, units_sold: 999, orders_count: 929, aov: 51.76 },
];

const snapshots = input.context.snapshot as Array<{ label: string; data: unknown }>;
const find = (pattern: RegExp) => snapshots.find((item) => pattern.test(item.label));
const set = (pattern: RegExp, label: string, data: unknown) => {
  const row = find(pattern);
  if (!row) throw new Error(`context_block_not_found:${pattern}`);
  row.label = label;
  row.data = data;
};
const brief =
  "Prueba solicitada por el propietario: crear un plan nuevo que cubra dos meses completos para la tienda E-NORA Demo, del 1 de noviembre al 31 de diciembre de 2026. La finalidad es ver qué campaña propone A05 con el catálogo, ventas recientes e histórico real disponibles. Es un borrador de laboratorio; no enviar ni publicar. Si no hay datos suficientes para proponer un envío, separar acciones preparatorias y condiciones necesarias de las campañas ejecutables.";
set(/Idea o acuerdo de campaña/i, "Brief de prueba A05 · plan de dos meses", brief);
set(/Ventana exacta de envíos/i, "Ventana exacta · 01/11/2026–31/12/2026", {
  start_date: "2026-11-01",
  end_date: "2026-12-31",
  days: 61,
  timezone: "America/New_York",
  market: "España",
  now_local: "2026-10-30 07:46",
  rule: "Cada acción propuesta debe caer dentro de esta ventana; es borrador, no autorización de envío.",
});
set(/Ventas Shopify \(90 dias\)/i, "Shopify · últimos 90 días, refrescado 30/10/2026", {
  period_start: "2026-08-01",
  period_end: "2026-10-30T11:46:29Z",
  orders_count: 2466,
  units_sold: 2659,
  net_sales_eur: 133330.7,
  aov_eur: 54.07,
  monthly_breakdown: refreshedMonths.slice(4),
  source: "shopify_order_facts TEST; excludes cancelled and test orders; processed_at <= evaluated_at 2026-10-30T11:46:29Z, excluding future-dated TEST orders",
});
set(/Ventas Shopify del periodo anterior/i, "Shopify · 90 días anteriores para tendencia", {
  period_start: "2026-05-02",
  period_end: "2026-07-31",
  orders_count: 2858,
  units_sold: 3072,
  net_sales_eur: 156060.3,
  monthly_breakdown: refreshedMonths.slice(0, 4),
  source: "shopify_order_facts TEST; excludes cancelled and test orders",
});
const seasonal = find(/Paquete preparado por inteligencia estacional A19/i);
if (!seasonal || !seasonal.data || typeof seasonal.data !== "object")
  throw new Error("a19_context_not_found");
const seasonalData = seasonal.data as Record<string, unknown>;
const oldMonths = Array.isArray(seasonalData.months)
  ? (seasonalData.months as Array<Record<string, unknown>>)
  : [];
seasonalData.months = [
  ...oldMonths.filter(
    (month) =>
      !["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"].includes(String(month.bucket_month)),
  ),
  ...refreshedMonths.slice(0, 3),
  { bucket_month: "2026-08-01", gross_sales: 39184, discounts: 125.2, refunds: 0, net_sales: 39058.8, units_sold: 769, orders_count: 712, aov: 54.86 },
  ...refreshedMonths.slice(5),
];
seasonalData.monthly_refresh_as_of = evaluatedAt;
set(/Resumen financiero/i, "Finanzas · dato no refrescado para esta evaluación", {
  status: "not_current",
  note: "El último paquete financiero del replay termina el 12/10/2026. No usar margen, rentabilidad, shipping_net ni umbrales anteriores como datos actuales.",
  current_verified_product_margin: false,
  current_verified_promotion: false,
});
set(/Situacion de stock/i, "Inventario Shopify · refrescado 30/10/2026", {
  tracked_items: 34,
  total_available_units: 457,
  out_of_stock_items: 7,
  items_with_1_to_10_units: 13,
  items_with_1_to_20_units: 20,
  latest_inventory_snapshot: "2026-10-30T00:00:00Z",
  product_catalog_last_sync: "2026-10-16T17:01:10Z",
});
set(/Productos con riesgo de rotura/i, "Productos Shopify con más ventas · stock y ventas a 30/10/2026", {
  period_days: 60,
  period_end: evaluatedAt,
  store: "E-NORA Demo · e-nora-demo.myshopify.com",
  inventory_captured_at: "2026-10-30T00:00:00Z",
  items: currentTopProducts,
  note: "La cobertura estimada es disponibilidad actual dividida por venta diaria media de los últimos 60 días; es descriptiva, no pronóstico. No recomendar una campaña de producto sin revalidar stock antes del envío.",
});
set(/Rendimiento de email por Klaviyo/i, "Klaviyo · histórico de rendimiento hasta 12/10/2026 (solo referencia)", {
  ...((find(/Rendimiento de email por Klaviyo/i)?.data as Record<string, unknown>) ?? {}),
  freshness: "historical_only_not_current",
});
set(/Adquis.*pagada en Meta/i, "Meta · atribución histórica hasta 12/10/2026 (solo referencia)", {
  ...((find(/Adquis.*pagada en Meta/i)?.data as Record<string, unknown>) ?? {}),
  freshness: "historical_only_not_current",
});
set(/Control de inversi.n Meta/i, "Meta · control histórico hasta 12/10/2026 (solo referencia)", {
  ...((find(/Control de inversi.n Meta/i)?.data as Record<string, unknown>) ?? {}),
  freshness: "historical_only_not_current",
});
set(/Campanas YA planificadas/i, "Campañas ya programadas · consulta de 30/10/2026", {
  evaluated_at: evaluatedAt,
  upcoming_calendar_items: [],
  note: "No había acciones activas en campaign_calendar_items entre el 01/11 y el 31/12. Las campañas de Klaviyo en estado draft no se consideran programadas.",
});
set(/Inventario sincronizado de flows Klaviyo/i, "Estado de canales · lectura de 30/10/2026", {
  klaviyo: {
    integration_status: "connected_with_sync_error",
    last_sync_at: "2026-10-30T11:33:02Z",
    account_timezone: "America/New_York",
    campaigns: { total: 15, sent: 1, draft: 14, scheduled_with_future_send_time: 0 },
    flows: [
      { name: "E-NORA · Bienvenida · ES", status: "draft" },
      { name: "E-NORA · Carrito abandonado · ES", status: "draft" },
      { name: "E-NORA · Seguimiento poscompra · ES", status: "draft" },
    ],
    active_lists: 4,
    active_segments: 9,
    audience_profile_counts: "not available in this query; do not invent audience size or current consent",
    sync_warning: "klaviyo_recursos_no_traidos:conversion_metric",
  },
  meta: {
    integration_status: "connected",
    last_sync_at: "2026-10-30T11:40:03Z",
    campaigns: [
      { name: "E-NORA · Prospecting · Sales", status: "PAUSED" },
      { name: "E-NORA · Retargeting · Sales", status: "PAUSED" },
      { name: "E-NORA · Creative Test · Sales", status: "PAUSED" },
    ],
    budget_authorization: "not supplied",
  },
});

// Discard a previously detected cross-store Mi Camino context block so it
// cannot steer the E-NORA Demo plan. Preserve the rest of the historical
// reasoning chain, whose original snapshot is separately dated 12 October.
input.context.snapshot = snapshots.filter(
  (row) => !/Contexto permanente de Mi Camino/i.test(row.label),
);
input.context.snapshot.push({
  label: "Control de contexto y seguridad de esta prueba",
  data: {
    freshness_cutoff: evaluatedAt,
    historical_context_before_refresh: "The remaining old context blocks are from the 12/10/2026 replay and are historical only.",
    cross_store_context_excluded: "A previously detected Mi Camino block named another store/category and was excluded from this evaluation.",
    tools_executed: [],
    publication_or_send: "not authorized; laboratory draft only",
  },
});

input.objective =
  "Planifica el calendario de marketing de E-NORA Demo del 2026-11-01 al 2026-12-31 (61 días; dos meses completos) con ventas recientes e histórico. Contrasta cada idea con los bloques refrescados el 30/10/2026 y separa explícitamente hechos actuales, datos históricos, hipótesis y requisitos pendientes. Elige una cadencia razonada: no llenes el calendario. Considera Singles Day (11/11), Black Friday (27/11), Cyber Monday (30/11) y Navidad (25/12) solo como fechas comerciales generales, no como demanda demostrada. Los top sellers tienen poco stock según el ritmo reciente; no los promociones hasta revalidar inventario o confirmar reposición. No inventes margen, descuento, audiencia consentida, presupuesto, URL, creatividades, reposición ni métricas de éxito. Puedes proponer un plan condicional de dos meses con hitos de preparación, decisión y medición, indicando qué queda bloqueado. Campañas y anuncios son borradores de laboratorio: no enviar, programar en plataformas, crear drafts externos ni publicar. No se han ejecutado herramientas ni una búsqueda RAG nueva; indícalo con honestidad.";
input.time_range = { start: "2026-11-01", end: "2026-12-31" };
const contextHash = hash(input.context);
const prompt =
  "LABORATORIO A05 · PLAN DE DOS MESES · CONTEXTO REAL TEST REFRESCADO 30/10/2026. Sin herramientas, sin escrituras, sin envíos y sin publicación. Los bloques marcados históricos no representan estado actual. Devuelve solo JSON conforme al contrato nativo.\n" +
  JSON.stringify(input);
const schemaFile = base.schema_file;
if (!schemaFile) throw new Error("a05_schema_not_found");
const schemaHash = hash(campaignPlanJsonSchema);
if (schemaHash !== base.schema_hash)
  throw new Error("a05_schema_hash_mismatch");

const updatedCase = {
  ...base,
  id: caseId,
  source: "read_only_query" as const,
  source_run_id: null,
  store_id: "5e84efa9-6e7f-4759-8b87-22119401bd81",
  snapshot_at: evaluatedAt,
  label: "E-NORA Demo TEST · campaña nueva · 01/11–31/12/2026",
  context_hash: contextHash,
  prompt_version: `${base.prompt_version}+two-month-live-test-v1`,
  model_ids: models,
  campaign_benchmark: {
    scenario: "two_month_window_real_test_store_v2",
    reference_hash: hash({
      window: ["2026-11-01", "2026-12-31"],
      current_top_products: currentTopProducts,
      no_send: true,
    }),
  },
  input_characters: original.system.length + prompt.length,
  timeout_ms: 300_000,
  limitations: [
    "Datos reales de la tienda TEST consultados en modo solo lectura el 30/10/2026.",
    "Ventas y rendimiento pasados no garantizan demanda en noviembre/diciembre.",
    "Margen, consentimiento y tamaños actuales de audiencia no quedaron verificados.",
    "No se ejecutaron herramientas ni acciones en Shopify, Klaviyo o Meta.",
    "Un resultado por modelo; es una comparación cualitativa, no una estimación estadística.",
  ],
};
const inputPath = resolve(
  dir,
  `${base.agent_code}.${contextHash}.${base.prompt_hash}.input.json`,
);
await copyFile(path, `${path}.before-a05-two-months`);
await writeFile(
  inputPath,
  JSON.stringify({ system: original.system, input, prompt }, null, 2),
);
await writeFile(
  resolve(dir, `${caseId.replaceAll(":", ".")}.reference.json`),
  JSON.stringify(
    {
      expected: "A cautious two-month draft that respects current store evidence, distinguishes history from current state, and blocks sends where stock, margin, audience, or budget are unverified.",
      evaluated_at: evaluatedAt,
      source: "TEST Supabase read-only query",
      window: ["2026-11-01", "2026-12-31"],
      current_top_products: currentTopProducts,
    },
    null,
    2,
  ),
);
report.cases.push(updatedCase);
report.results.push(...models.map((model) => pendingResult(caseId, model)));
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2));
await rename(`${path}.tmp`, path);
console.log(
  JSON.stringify({ case_id: caseId, models: models.length, input_characters: updatedCase.input_characters, window: ["2026-11-01", "2026-12-31"] }),
);
