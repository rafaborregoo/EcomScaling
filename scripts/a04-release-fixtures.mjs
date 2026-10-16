/**
 * Genera los 13 fixtures de release de A04 (plan diario): 10 de calibración
 * ("gold" para el gate) y 3 de release ("holdout", un solo uso).
 *
 * Base: histórico real de la tienda E-NORA Demo (ventas y productos por
 * ventana, backlog y Camino del 15-oct-2026, conocimiento RAG real).
 * Encima, cada caso añade una incidencia INVENTADA pero verosímil, porque la
 * tienda demo casi nunca tiene problemas y un planificador que solo ve días
 * tranquilos no se puede evaluar. Cada `scenario` dice qué es real y qué no.
 *
 * Todos son SINTÉTICOS (split development): llevan incidencias inventadas, y
 * el gate solo admite como calibración o release casos de producción real
 * anonimizados con revisión de privacidad. Sirven para iterar el prompt; la
 * certificación necesita ejecuciones reales de A04 etiquetadas por dos personas.
 *
 * Uso: npx tsx scripts/a04-release-fixtures.mjs   (tsx: importa el calendario comercial)
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commercialCalendar } from "../apps/api/src/commercial-calendar.ts";

const DATASET_VERSION = "2026-09-29.v2";
const RUBRIC_VERSION = "judge-rubrics-v7";
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/api/eval-fixtures/a04/development");

// Mismo JSON canónico que agent-release-eval-fixture.ts: el hash debe coincidir.
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
const sha = (value) => createHash("sha256").update(stableJson(value)).digest("hex");

const source = (key, content, asOf) => ({
  key,
  status: "available",
  content,
  content_sha256: sha(content),
  as_of: asOf,
});
const missing = (key, status, asOf) => ({ key, status, content_sha256: null, as_of: asOf });

// --- Datos reales de la tienda (consultados el 15-oct-2026) ----------------
const REAL = {
  now: { window: ["2026-09-15", "2026-10-15"], sales: { orders: 966, gross_sales: 53082, discounts: 273.6, refunds: 0, net_sales: 52808.4, aov: 54.67, units_sold: 1045 },
    top: [["Camiseta Básica Niebla", 150, 4309], ["Sudadera Oversize Arena", 144, 8253], ["Bolso Mini Bruma", 143, 5546], ["Sudadera Capucha Arcilla", 133, 9037], ["Calcetín Rib Menta", 127, 1517], ["Chaqueta Boreal Negra", 125, 14827], ["Gorra Costa Cruda", 118, 2822], ["Pantalón Cargo Oliva", 102, 6496]] },
  bf2025: { window: ["2025-10-28", "2025-11-27"], sales: { orders: 1217, gross_sales: 68255, discounts: 8328.92, refunds: 0, net_sales: 59926.08, aov: 49.24, units_sold: 1319 },
    top: [["Pantalón Cargo Oliva", 193, 10810], ["Gorra Costa Cruda", 185, 3975], ["Bolso Mini Bruma", 175, 5969], ["Sudadera Capucha Arcilla", 172, 10299], ["Sudadera Oversize Arena", 161, 8179], ["Chaqueta Boreal Negra", 149, 15541], ["Camiseta Básica Niebla", 145, 3677], ["Calcetín Rib Menta", 139, 1476]] },
  jan2026: { window: ["2026-01-05", "2026-02-04"], sales: { orders: 653, gross_sales: 36035, discounts: 152.9, refunds: 0, net_sales: 35882.1, aov: 54.95, units_sold: 699 },
    top: [["Pantalón Cargo Oliva", 95, 6035], ["Chaqueta Boreal Negra", 92, 10912], ["Calcetín Rib Menta", 91, 1086], ["Camiseta Básica Niebla", 90, 2598], ["Gorra Costa Cruda", 90, 2153], ["Bolso Mini Bruma", 87, 3385], ["Sudadera Capucha Arcilla", 82, 5542], ["Sudadera Oversize Arena", 72, 4170]] },
  may2026: { window: ["2026-05-01", "2026-05-31"], sales: { orders: 1052, gross_sales: 58198, discounts: 329.4, refunds: 0, net_sales: 57868.6, aov: 55.01, units_sold: 1134 },
    top: [["Calcetín Rib Menta", 163, 1943], ["Chaqueta Boreal Negra", 153, 18100], ["Gorra Costa Cruda", 152, 3619], ["Pantalón Cargo Oliva", 137, 8717], ["Sudadera Capucha Arcilla", 136, 9187], ["Camiseta Básica Niebla", 135, 3898], ["Bolso Mini Bruma", 132, 5121], ["Sudadera Oversize Arena", 126, 7285]] },
  jun2026: { window: ["2026-06-01", "2026-07-01"], sales: { orders: 1208, gross_sales: 67426, discounts: 431.7, refunds: 0, net_sales: 66994.3, aov: 55.46, units_sold: 1301 },
    top: [["Chaqueta Boreal Negra", 174, 20563], ["Gorra Costa Cruda", 171, 4087], ["Bolso Mini Bruma", 169, 6568], ["Calcetín Rib Menta", 162, 1928], ["Sudadera Oversize Arena", 161, 9268], ["Camiseta Básica Niebla", 159, 4579], ["Sudadera Capucha Arcilla", 153, 10343], ["Pantalón Cargo Oliva", 152, 9658]] },
  aug2026: { window: ["2026-08-01", "2026-08-31"], sales: { orders: 691, gross_sales: 37932, discounts: 124, refunds: 0, net_sales: 37808, aov: 54.71, units_sold: 746 },
    top: [["Pantalón Cargo Oliva", 106, 6746], ["Bolso Mini Bruma", 105, 4087], ["Camiseta Básica Niebla", 100, 2886], ["Calcetín Rib Menta", 93, 1110], ["Sudadera Oversize Arena", 91, 5261], ["Gorra Costa Cruda", 89, 2122], ["Chaqueta Boreal Negra", 89, 10579], ["Sudadera Capucha Arcilla", 74, 5018]] },
};

// Backlog real del 15-oct (Camino aceptado): lo cercano con detalle, lo lejano solo titulares.
const REAL_NEAR_TASKS = [
  ["Preparar el registro de interés en Black Friday ya planificado", "2026-10-16", "urgent", "klaviyo"],
  ["Verificar las condiciones que limitan la campaña", "2026-10-16", "urgent", "general"],
  ["Verificar existencias, costes y medición antes de definir la campaña", "2026-10-17", "urgent", "general"],
  ["Seleccionar variantes líderes que puedan anunciarse", "2026-10-18", "urgent", "shopify"],
  ["Comprobar costes y fijar límites económicos antes de proponer ofertas", "2026-10-20", "urgent", "general"],
  ["Contrastar el evento de compra y el gasto de Meta con Shopify", "2026-10-23", "high", "meta"],
  ["Cerrar la selección y la oferta de Black Friday", "2026-10-25", "urgent", "shopify"],
  ["Revisar los flujos básicos sin duplicar mensajes ni incentivos", "2026-10-28", "high", "klaviyo"],
];
const REAL_LATER_TASKS = [
  ["Preparar catálogo y servicio de invierno", "2026-10-31", "high"],
  ["Dimensionar expedición y soporte para Black Friday", "2026-11-01", "high"],
  ["Preparar colección, anuncios y secuencia de Black Friday", "2026-11-07", "high"],
  ["Verificar existencias, costes y plazos para decidir los regalos", "2026-11-09", "urgent"],
  ["Decidir inversión según ROAS y MER", "2026-11-14", "high"],
  ["Convertir los plazos del transportista en una promesa de entrega comprobable", "2026-11-17", "urgent"],
];
const REAL_CAMINO = {
  plan: "E-NORA Demo: vender la campaña de invierno sin perder margen",
  phases: [
    { name: "Capturar el pico de noviembre", status: "pending" },
    { name: "Convertir invierno en ventas y segunda compra", status: "pending" },
    { name: "Sostener ventas tras el pico", status: "pending" },
  ],
  milestones: [{
    id: "3e6cecb1-0d26-4b34-9b22-664579461420",
    name: "Productos líderes, captación y control de inversión listos el 26 de octubre",
    status: "pending",
    target_date: "2026-10-29",
    linked_tasks: ["Preparar el registro de interés en Black Friday ya planificado", "Seleccionar variantes líderes que puedan anunciarse", "Comprobar costes y fijar límites económicos antes de proponer ofertas"],
  }],
};

// Conocimiento RAG real (extractos de documentos activos en la base de conocimiento).
const RAG = {
  stock: { documento: "FASE 5.07 — Inventario, stockout, overstock y replenishment", extracto: "Stockout: existe cuando demanda supera inventario disponible. Consecuencias: revenue perdido, CAC desperdiciado, pérdida de ranking, clientes hacia competidores. No debe escalarse agresivamente tráfico hacia un producto sin capacidad de entrega; puede ser necesario reducir campañas, cambiar merchandising o dirigir demanda a sustitutos. Cuando hay stockout, las ventas observadas subestiman la demanda real." },
  checkout: { documento: "FASE 5.03 — PDP, carrito, checkout y fricciones de compra", extracto: "Las caídas bruscas de conversión en checkout tras un cambio de tema, app o método de pago se comprueban primero con un pedido de prueba completo en móvil y escritorio antes de tocar tráfico o precios." },
  medicion: { documento: "FASE 5.01 — Medición, incrementalidad y madurez de adquisición", extracto: "Sin eventos de compra fiables la plataforma optimiza a ciegas: antes de cambiar presupuesto se verifica que el evento de compra llega, con valor y moneda, y que no se duplica entre píxel y servidor." },
  fulfillment: { documento: "FASE 5.08 — Fulfillment, entrega, capacidad y fiabilidad operativa", extracto: "Un atasco de preparación se ataca por antigüedad del pedido: primero los que superan el plazo prometido, y se avisa proactivamente a los clientes afectados antes de que pregunten." },
  marca: { documento: "Cuestionario de la marca (reglas provisionales)", extracto: "No aplicar descuentos sin comprobar antes el margen real; no acumular promociones; no usar falsa escasez; no prometer disponibilidad ni plazos de entrega sin respaldo; no asumir autorización para activar anuncios ni comprometer gasto." },
};

const OBJECTIVE = 'Proponer las tareas que tiene sentido hacer HOY en la tienda "E-NORA Demo", a partir de los datos de los ultimos 30 dias. Cita en sources[].reference exactamente la clave (key) de cada fuente congelada que uses.';

const topBlock = (w) => ({ ventana: REAL[w].window, productos: REAL[w].top.map(([titulo, unidades, ingresos_netos_eur]) => ({ titulo, unidades, ingresos_netos_eur })) });

function nearTasks(rows, overrides = []) {
  return [...rows.map(([title, due, priority, channel]) => ({ title, due_at: `${due}T00:00:00Z`, priority, status: "pending", source: "strategic_plan", categories: [channel] })), ...overrides];
}

function baseSources(c) {
  const asOf = `${c.date}T07:00:00Z`;
  const sources = [
    source("tareas_abiertas", { near_term_window_days: 14, near_term: c.near, later_count: c.later.length, later: c.later.map(([title, due, priority]) => ({ title, due_at: `${due}T00:00:00Z`, priority })), note: "Una tarea de later NO cubre una urgencia de hoy." }, asOf),
    source("historial_resultados_tareas", c.outcomes ?? [], asOf),
    source("alertas_activas", c.alerts ?? [], asOf),
    c.salesMissing ? missing("ventas_shopify_30d", "stale", c.salesMissing) : source("ventas_shopify_30d", { periodo: REAL[c.window].window, moneda: "EUR", ...REAL[c.window].sales }, asOf),
    source("productos_mas_vendidos_30d", topBlock(c.window), asOf),
    source("propuestas_otros_horizontes", c.siblings ?? [{ horizon: "semanal", proposals: [] }, { horizon: "mensual", proposals: [] }], asOf),
    source("mi_camino", c.camino ?? { status: "sin_camino_activo" }, asOf),
    source("diagnostico_a02", c.a02, asOf),
    // Mismo contexto que A04 recibe en producción desde 2026-10-15.
    source("fechas_comerciales_45d", { eventos: commercialCalendar(new Date(`${c.date}T07:00:00Z`), 45, "E-NORA Demo moda").map((event) => ({ evento: event.name, fecha: event.date, empieza_a_preparar: event.prep_start, vas_tarde: event.late_start })), campanas_planificadas: c.campaigns ?? [], propuestas_aprobadas: [] }, asOf),
    source("especialistas_aprobados", c.specialists ? { status: "available", outputs: c.specialists } : { status: "no_recent_approved_outputs", outputs: [] }, asOf),
    source("diagnostico_ejecutivo_d14", { status: "no_canonical_diagnosis", diagnosticos: [] }, asOf),
    ...(c.window === "now" && !c.salesMissing ? [source("ventas_shopify_periodo_anterior", { periodo: ["2026-08-16", "2026-09-15"], moneda: "EUR", orders: 677, net_sales: 36969.2, aov: 54.61, units_sold: 729 }, asOf)] : []),
    source("asignacion_consultor", { has_consultant: true, decision_rule: "Las propuestas quedan pendientes de revision del consultor humano asignado." }, asOf),
    source("conocimiento_rag", c.rag.map((k) => RAG[k]), asOf),
  ];
  for (const [key, content] of Object.entries(c.extra ?? {})) sources.push(source(key, content, asOf));
  return sources;
}

function fixture(c) {
  const [start, end] = REAL[c.window].window;
  const split = "development";
  return {
    schema_version: "agent-release-replay-v1",
    agent_code: "a04_generador_tareas",
    dataset_version: DATASET_VERSION,
    rubric_version: RUBRIC_VERSION,
    split,
    provenance: "synthetic",
    privacy_reviewed: false,
    // scenario no llega al modelo (solo al juez y al panel); el validador lo
    // limita a 300 caracteres, de ahí que los textos de abajo sean cortos.
    scenario: `${c.id} ${c.scenario}`,
    input: { objective: OBJECTIVE, parameters: { horizon: "day", lookback_days: 30, reference_date: c.date } },
    scope: { organization_ref: "org-demo-anon", store_ref: "store-demo-anon", timezone: "Europe/Madrid", period_start: start, period_end: end },
    sources: baseSources(c),
    tool_replay: [],
    visual_artifacts: [],
    constraints: {
      expected_abstention: c.abstain ?? false,
      required_output_paths: c.expectTask ? ["$.proposed_writes[0]"] : [],
      forbidden_output_paths: c.expectTask === false ? ["$.proposed_writes[0]"] : ["$.proposed_writes[5]"],
    },
  };
}

const QUIET_A02 = (date) => ({ generated_at: `${date}T05:00:00Z`, headline: "Negocio estable: ventas en línea con el periodo anterior y sin incidencias operativas.", findings: [{ area: "ventas", title: "Ventas estables frente al periodo anterior", severity: "info" }, { area: "finanzas", title: "Margen por encima del punto de equilibrio", severity: "info" }] });

const CASES = [
  // ------------------------- 10 de calibración (gold) -------------------------
  { id: "C01", split: "calibration", window: "now", date: "2026-10-15", expectTask: true, rag: ["stock", "marca"],
    scenario: "Best-seller con 2 días de cobertura; la tarea del Camino que lo cubre vence en 3 días. Debe adelantar el primer paso hoy, sin duplicar la tarea.",
    invented: "solo la cobertura en días (las 8 uds son reales).",
    near: nearTasks(REAL_NEAR_TASKS), later: REAL_LATER_TASKS, camino: REAL_CAMINO,
    a02: { generated_at: "2026-10-14T17:22:03Z", headline: "Negocio rentable, con riesgo inminente de quiebre en varios best-sellers.", findings: [{ area: "stock", title: "7 de 34 productos agotados y 4 en stock bajo", severity: "high" }, { area: "stock", title: "Varios best-sellers con cobertura de menos de 3 días", severity: "critical" }, { area: "klaviyo", title: "No hay flows activos", severity: "medium" }] },
    extra: { inventario_productos_clave: [{ producto: "Chaqueta Boreal Negra", disponible: 8, vendidas_30d: 125, cobertura_dias: 1.9, anunciada_en_meta: true }, { producto: "Sudadera Capucha Arcilla", disponible: 61, vendidas_30d: 133, cobertura_dias: 13.8 }] } },
  { id: "C02", split: "calibration", window: "aug2026", date: "2026-08-31", expectTask: false, rag: ["marca"],
    scenario: "Mes tranquilo sin alertas, stock sano y backlog cercano que ya cubre lo pendiente. Lo correcto es no proponer nada y decir qué tareas lo cubren.",
    invented: "el backlog (dos tareas plausibles) y el inventario.",
    near: [{ title: "Revisar la ficha de la Sudadera Capucha Arcilla", due_at: "2026-09-01T00:00:00Z", priority: "medium", status: "in_progress", source: "manual", categories: ["shopify"] }, { title: "Preparar el envío de vuelta al cole", due_at: "2026-09-02T00:00:00Z", priority: "medium", status: "pending", source: "consulting_call", categories: ["klaviyo"] }], later: [],
    a02: QUIET_A02("2026-08-31"),
    extra: { inventario_productos_clave: [{ producto: "Pantalón Cargo Oliva", disponible: 240, vendidas_30d: 106, cobertura_dias: 68 }, { producto: "Bolso Mini Bruma", disponible: 190, vendidas_30d: 105, cobertura_dias: 54 }] } },
  { id: "C03", split: "calibration", window: "may2026", date: "2026-05-31", expectTask: true, rag: ["stock", "marca"],
    scenario: "El producto con más ingresos está agotado, se sigue anunciando en Meta y no hay ninguna tarea abierta sobre ello.",
    invented: "el agotado (0 uds), el gasto de Meta en el anuncio y el backlog.",
    near: [{ title: "Preparar la colección de verano", due_at: "2026-06-10T00:00:00Z", priority: "medium", status: "pending", source: "manual", categories: ["shopify"] }], later: [],
    a02: { generated_at: "2026-05-31T05:00:00Z", headline: "Ventas fuertes, pero el producto que más factura está agotado y sigue recibiendo inversión.", findings: [{ area: "stock", title: "Chaqueta Boreal Negra agotada con demanda de 5 uds/día", severity: "critical" }] },
    specialists: [{ agent_code: "a06_planificador_stock", output_id: "out-a06-0530", as_of: "2026-05-30T06:00:00Z", valid_until: "2026-06-13T06:00:00Z", conclusion: "La Chaqueta Boreal Negra se agota en 1-2 días al ritmo actual; el resto del catálogo tiene más de 20 días de cobertura.", findings: [{ title: "Chaqueta Boreal Negra sin cobertura", severity: "critical", evidence: "4 uds disponibles el 30-may, 5 uds/día" }], recommendations: [{ action: "Pedir reposición de la Chaqueta Boreal Negra y reducir su exposición mientras tanto", priority: "high" }] }],
    extra: { inventario_productos_clave: [{ producto: "Chaqueta Boreal Negra", disponible: 0, vendidas_30d: 153, dias_agotada: 2 }], meta_anuncios_activos: [{ anuncio: "Boreal - prospecting", producto: "Chaqueta Boreal Negra", gasto_ultimos_2_dias_eur: 186, estado: "activo" }] } },
  { id: "C04", split: "calibration", window: "jun2026", date: "2026-06-30", expectTask: true, rag: ["medicion", "marca"],
    scenario: "Meta deja de recibir compras hace 48 h mientras Shopify registra pedidos y el gasto sigue: hay que verificar el evento antes de tocar presupuesto.",
    invented: "la caída de eventos y el gasto de Meta.",
    near: [], later: [],
    a02: { generated_at: "2026-06-30T05:00:00Z", headline: "Ventas récord en Shopify; Meta informa cero compras desde hace dos días.", findings: [{ area: "meta", title: "Eventos de compra de Meta a cero en 48 h con pedidos en Shopify", severity: "high" }] },
    specialists: [{ agent_code: "a24_medicion_meta", output_id: "out-a24-0629", as_of: "2026-06-29T06:00:00Z", valid_until: "2026-07-29T06:00:00Z", conclusion: "La medición de compras de Meta era fiable hasta el 28-jun: eventos de píxel y servidor desduplicados, con valor y moneda.", findings: [{ title: "Evento de compra con valor y moneda correctos", severity: "info", evidence: "Coincidencia del 94 % con pedidos de Shopify en 30 días" }], recommendations: [] }],
    extra: { meta_eventos_compra: { ultimas_48h_meta: 0, ultimas_48h_shopify_pedidos: 83, gasto_ultimas_48h_eur: 420, ultimo_evento_recibido: "2026-06-28T09:14:00Z" } } },
  { id: "C05", split: "calibration", window: "aug2026", date: "2026-08-31", expectTask: true, rag: ["marca"],
    scenario: "El flow de carrito abandonado lleva 6 días en borrador tras una edición y los carritos abandonados siguen entrando.",
    invented: "el estado del flow y los carritos abandonados.",
    near: [], later: [],
    a02: { generated_at: "2026-08-31T05:00:00Z", headline: "Ventas estables; el flow de carrito abandonado está parado.", findings: [{ area: "klaviyo", title: "Flow de carrito abandonado en borrador desde hace 6 días", severity: "high" }] },
    specialists: [{ agent_code: "a28_arquitecto_flujos", output_id: "out-a28-0820", as_of: "2026-08-20T06:00:00Z", valid_until: "2026-09-03T06:00:00Z", conclusion: "Los flows básicos están completos; el de carrito abandonado es el que más ingresos atribuidos aporta.", findings: [{ title: "Carrito abandonado: principal flow por ingresos atribuidos", severity: "info", evidence: "2.140 EUR atribuidos en 30 días (5 días tras clic)" }], recommendations: [{ action: "Mantener el flow de carrito abandonado activo y revisar su segundo email", priority: "medium" }] }],
    extra: { klaviyo_flows: [{ flow: "Carrito abandonado", estado: "draft", desde: "2026-08-25", ingresos_atribuidos_30d_previos_eur: 2140, ventana_atribucion: "5 días tras clic" }, { flow: "Bienvenida", estado: "live" }], carritos_abandonados_7d: 74 } },
  { id: "C06", split: "calibration", window: "bf2025", date: "2025-11-27", expectTask: true, rag: ["marca"],
    scenario: "El código BIENVENIDA15 se usa 412 veces en 7 días con solo 3 primeros pedidos: el código se ha filtrado y lo usan clientes recurrentes.",
    invented: "el uso del código (los descuentos reales del periodo, 8.329 €, sí son del histórico).",
    near: [], later: [],
    a02: { generated_at: "2025-11-27T05:00:00Z", headline: "Black Friday con ventas altas y descuentos del 12 % de las ventas brutas.", findings: [{ area: "descuentos", title: "BIENVENIDA15 usado por clientes que ya habían comprado", severity: "high" }] },
    extra: { uso_codigos_descuento_7d: [{ codigo: "BIENVENIDA15", usos: 412, usos_semana_anterior: 31, primeros_pedidos: 3, descuento_total_eur: 3060, condicion_prevista: "solo primera compra" }] } },
  { id: "C07", split: "calibration", window: "now", date: "2026-10-15", expectTask: false, rag: ["stock", "marca"],
    scenario: "Mismo riesgo de quiebre que C01, pero ya hay una tarea EN CURSO que repone la Chaqueta Boreal Negra y vence mañana: no debe duplicarla.",
    invented: "la tarea en curso de reposición.",
    near: nearTasks(REAL_NEAR_TASKS, [{ title: "Reponer y limitar la exposición de la Chaqueta Boreal Negra", due_at: "2026-10-16T00:00:00Z", priority: "urgent", status: "in_progress", source: "manual", categories: ["shopify"] }]), later: REAL_LATER_TASKS, camino: REAL_CAMINO,
    a02: { generated_at: "2026-10-14T17:22:03Z", headline: "Negocio rentable, con riesgo de quiebre en la Chaqueta Boreal Negra.", findings: [{ area: "stock", title: "Chaqueta Boreal Negra con cobertura de menos de 2 días", severity: "critical" }] },
    extra: { inventario_productos_clave: [{ producto: "Chaqueta Boreal Negra", disponible: 8, vendidas_30d: 125, cobertura_dias: 1.9, pedido_proveedor_confirmado: "llegada 2026-10-17" }] } },
  { id: "C08", split: "calibration", window: "jan2026", date: "2026-02-04", expectTask: true, rag: ["marca"],
    scenario: "Una tarea para cargar costes de producto se ignoró hace 3 semanas y los costes siguen faltando en 6 de los 8 productos líderes: debe re-proponerla replanteada.",
    invented: "la tarea ignorada y la cobertura de costes.",
    outcomes: [{ title: "Subir costes de producto al panel", status: "ignored", ignored_reason: "no hay tiempo ahora", updated_at: "2026-01-14T10:00:00Z" }],
    near: [], later: [],
    a02: { generated_at: "2026-02-04T05:00:00Z", headline: "Enero flojo (-32 % de pedidos frente a septiembre) y margen no calculable por falta de costes.", findings: [{ area: "finanzas", title: "Margen no fiable: faltan costes en 6 de 8 productos líderes", severity: "high" }] },
    extra: { cobertura_costes_producto: { productos_lideres: 8, con_coste: 2, sin_coste: ["Pantalón Cargo Oliva", "Chaqueta Boreal Negra", "Calcetín Rib Menta", "Camiseta Básica Niebla", "Gorra Costa Cruda", "Bolso Mini Bruma"] } } },
  { id: "C09", split: "calibration", window: "now", date: "2026-10-15", abstain: true, rag: ["marca"],
    scenario: "La sincronización de Shopify falla desde hace 4 días: ventas sin datos frescos y diagnóstico A02 caducado. Debe declarar confianza baja y el hueco de datos.",
    invented: "el fallo de sincronización.",
    salesMissing: "2026-10-11T06:00:00Z",
    near: nearTasks(REAL_NEAR_TASKS.slice(0, 3)), later: REAL_LATER_TASKS, camino: REAL_CAMINO,
    alerts: [{ title: "Sincronización de Shopify fallando", severity: "high", status: "open", first_detected_at: "2026-10-11T06:00:00Z" }],
    a02: { generated_at: "2026-10-10T17:00:00Z", stale: true, headline: "Lectura de hace 5 días; no refleja el estado actual.", findings: [] } },
  { id: "C10", split: "calibration", window: "aug2026", date: "2026-08-31", expectTask: false, rag: ["marca"],
    scenario: "Tienda tranquila; la única alerta es de la propia plataforma (método de pago de un proveedor de IA). No debe proponer tareas sobre la plataforma.",
    invented: "la alerta de plataforma.",
    near: [], later: [],
    alerts: [{ title: "Proveedor de embeddings sin método de pago", severity: "medium", status: "open", ambito: "plataforma E-NORA" }],
    a02: QUIET_A02("2026-08-31") },

  // --------------------- 3 de release (holdout, un solo uso) ---------------------
  { id: "R01", split: "release", window: "bf2025", date: "2025-11-27", expectTask: true, rag: ["fulfillment", "marca"],
    scenario: "Atasco de preparación tras Black Friday: 138 pedidos sin preparar con más de 48 h, por encima del plazo habitual de 2 días.",
    invented: "el atasco de preparación.",
    near: [], later: [],
    a02: { generated_at: "2025-11-27T05:00:00Z", headline: "Pico de Black Friday con preparación desbordada.", findings: [{ area: "operaciones", title: "138 pedidos sin preparar con más de 48 h", severity: "critical" }] },
    extra: { pedidos_pendientes_preparar: { total: 212, mas_de_48h: 138, mas_de_96h: 41, plazo_habitual_dias: 2 } } },
  { id: "R02", split: "release", window: "may2026", date: "2026-05-31", expectTask: true, rag: ["marca"],
    scenario: "Las devoluciones del Pantalón Cargo Oliva suben al 22 % de las unidades en 14 días, casi todas por talla.",
    invented: "las devoluciones (el histórico real tiene 0 devoluciones).",
    near: [], later: [],
    a02: { generated_at: "2026-05-31T05:00:00Z", headline: "Ventas sanas; devoluciones por talla concentradas en un producto.", findings: [{ area: "devoluciones", title: "Pantalón Cargo Oliva con 22 % de devoluciones por talla", severity: "high" }] },
    extra: { devoluciones_14d: [{ producto: "Pantalón Cargo Oliva", unidades_vendidas: 64, unidades_devueltas: 14, motivo_principal: "talla pequeña", porcentaje_motivo: 0.86 }] } },
  { id: "R03", split: "release", window: "jun2026", date: "2026-06-30", expectTask: true, rag: ["checkout", "marca"],
    scenario: "Tras publicar un tema nuevo ayer, la finalización del checkout cae del 62 % al 31 % con las sesiones estables.",
    invented: "la caída de checkout y el cambio de tema.",
    near: [], later: [],
    a02: { generated_at: "2026-06-30T05:00:00Z", headline: "Sesiones estables pero la mitad de pedidos desde ayer.", findings: [{ area: "conversion", title: "Finalización del checkout del 62 % al 31 % desde el cambio de tema", severity: "critical" }] },
    extra: { embudo_checkout: { antes_cambio_tema: { sesiones_dia: 1480, checkouts_iniciados: 96, finalizados: 60 }, desde_cambio_tema: { sesiones_dia: 1510, checkouts_iniciados: 98, finalizados: 30 }, cambio: "tema publicado 2026-06-29 18:40" } } },
];

mkdirSync(outDir, { recursive: true });
const cases = CASES;
for (const c of cases) {
  const file = path.join(outDir, `${c.id}.json`);
  writeFileSync(file, `${JSON.stringify(fixture(c), null, 2)}\n`);
}
// Qué es real y qué inventado, fuera del fixture: el juez ve el fixture entero
// y castigaba como "no verificable" cualquier cifra marcada como inventada.
writeFileSync(path.join(outDir, "procedencia.json"), `${JSON.stringify(Object.fromEntries(cases.map((c) => [c.id, {
  real: `Ventas y productos de E-NORA Demo ${REAL[c.window].window.join("..")}${c.window === "now" ? "; backlog y Camino del 15-oct-2026" : ""}; extractos RAG de la base de conocimiento`,
  inventado: c.invented,
}])), null, 2)}\n`);
console.log(`${cases.length} fixtures en ${outDir}`);
