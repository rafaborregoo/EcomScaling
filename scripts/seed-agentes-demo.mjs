/**
 * Ejemplos de salida de TODOS los agentes, sin ejecutar ninguno.
 *
 * Inserta en la org `prueba-borrego` del proyecto TEST una ejecucion terminada
 * por agente con una salida de ejemplo valida contra su contrato, para revisar
 * como se ve cada pantalla con la sesion de cliente y con la de consultor.
 *
 *   npm run seed:agentes-demo            borra los ejemplos anteriores e inserta
 *   npm run seed:agentes-demo -- --clean solo borra
 *
 * Para que ninguna pantalla lance el agente de verdad: AI_AUTORUN_ENABLED=false
 * en .env.local (la cache se sirve aunque este vencida) y no pulsar "Actualizar".
 *
 * Todo lo insertado lleva la marca TAG (agent_runs.trace_id,
 * consulting_calls.external_recording_id, marketing_content_drafts.request.seed,
 * instagram_image_bank.checksum, prefijo del titulo de ai_conversations).
 * Se niega a correr contra produccion.
 */
import crypto from "node:crypto";
import zlib from "node:zlib";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const TAG = "seed:agentes-demo";
const CHAT_TITLE_PREFIX = "Ejemplo · ";
const ORG_SLUG = "prueba-borrego";
const CLIENT_EMAIL = "borregorafa99@gmail.com";
const CONSULTANT_EMAIL = "rafael@noraapp.es";
const BUCKET = "marketing-assets";
const IMAGE_CHECKSUM = "seed-agentes-demo";
const WARNING = "Salida de ejemplo (seed:agentes-demo): no la ha generado el agente.";

const url = process.env.SUPABASE_DB_URL;
const prodRef = process.env.SUPABASE_PRODUCTION_PROJECT_REF;
if (!url) throw new Error("Falta SUPABASE_DB_URL");
if (prodRef && url.includes(prodRef)) {
  throw new Error("SUPABASE_DB_URL apunta a produccion. Este script solo corre en TEST.");
}
const onlyClean = process.argv.includes("--clean");

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const one = async (sql, params) => (await db.query(sql, params)).rows[0];

const org = await one("select id from public.organizations where slug = $1", [ORG_SLUG]);
if (!org) throw new Error(`No existe la organizacion ${ORG_SLUG} en este proyecto`);
const ORG = org.id;
const userId = async (email) => {
  const row = await one("select id from auth.users where email = $1", [email]);
  if (!row) throw new Error(`No existe el usuario ${email}`);
  return row.id;
};
const CLIENT = await userId(CLIENT_EMAIL);
const CONSULTANT = await userId(CONSULTANT_EMAIL);
const stores = (await db.query("select id from public.shopify_stores where organization_id = $1", [ORG])).rows.map((r) => r.id);

// ---------------------------------------------------------------------------
// Limpieza
// ---------------------------------------------------------------------------

async function clean() {
  await db.query("begin");
  try {
    const drafts = await db.query(
      "delete from public.marketing_content_drafts where organization_id = $1 and request->>'seed' = $2 returning id",
      [ORG, TAG],
    );
    const outputs = await db.query(
      `select o.id from public.agent_outputs o join public.agent_runs r on r.id = o.run_id
       where r.organization_id = $1 and r.trace_id = $2`,
      [ORG, TAG],
    );
    const sourceIds = [...drafts.rows, ...outputs.rows].map((r) => r.id);
    if (sourceIds.length) {
      await db.query("delete from public.activity_events where source_id = any($1::uuid[])", [sourceIds]);
    }
    const images = await db.query(
      "delete from public.instagram_image_bank where organization_id = $1 and checksum = $2 returning storage_path",
      [ORG, IMAGE_CHECKSUM],
    );
    await db.query("delete from public.consulting_calls where organization_id = $1 and external_recording_id = $2", [ORG, TAG]);
    await db.query("delete from public.ai_conversations where organization_id = $1 and title like $2", [ORG, `${CHAT_TITLE_PREFIX}%`]);
    const runs = await db.query("delete from public.agent_runs where organization_id = $1 and trace_id = $2", [ORG, TAG]);
    await db.query("commit");
    if (images.rows.length) {
      await storage.storage.from(BUCKET).remove(images.rows.map((r) => r.storage_path));
    }
    console.log(`Borrado: ${runs.rowCount} ejecuciones, ${drafts.rowCount} borradores, ${images.rowCount} imagenes.`);
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

await clean();
if (onlyClean) {
  await db.end();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Helpers de insercion
// ---------------------------------------------------------------------------

const versions = new Map(
  (
    await db.query(
      `select d.code, v.id, v.model, v.prompt_code, v.prompt_version from public.agent_versions v
       join public.agent_definitions d on d.id = v.definition_id where v.is_active`,
    )
  ).rows.map((r) => [r.code, r]),
);

async function insertRun(code, { storeId = null, lookbackDays = 30, trigger = "manual", actor = CONSULTANT, objective } = {}) {
  const version = versions.get(code);
  if (!version) throw new Error(`No hay version activa de ${code}`);
  const row = await one(
    `insert into public.agent_runs (organization_id, agent_version_id, actor_user_id, trigger_type, objective,
       status, started_at, finished_at, store_id, lookback_days, execution_mode, trace_id, provider, model,
       input_tokens, output_tokens, estimated_cost_usd, latency_ms, model_calls, tool_call_count)
     values ($1, $2, $3, $4, $5, 'succeeded', now(), now(), $6, $7, 'live', $8, 'anthropic', $9, 0, 0, 0, 0, 0, 0)
     returning id`,
    [ORG, version.id, actor, trigger, objective ?? `[Ejemplo] ${code}`, storeId, lookbackDays, TAG, version.model],
  );
  return row.id;
}

async function insertOutput(runId, output, { approvalRequired = true } = {}) {
  const row = await one(
    `insert into public.agent_outputs (run_id, organization_id, schema_version, output, approval_required, status)
     values ($1, $2, 'v1', $3, $4, $5) returning id`,
    [runId, ORG, JSON.stringify(output), approvalRequired, approvalRequired ? "pending_approval" : "draft"],
  );
  return row.id;
}

async function seedDiagnostic(code, output, scopes) {
  for (const { storeId, lookbackDays } of scopes) {
    const runId = await insertRun(code, { storeId, lookbackDays });
    await insertOutput(runId, output);
  }
}

const ev = (label, value, source, period = "últimos 30 días") => ({ label, value, period, source });
const task = (title, description, priority, rationale, evidence) => ({ kind: "task", title, description, priority, rationale, evidence });
const finding = (title, severity, evidence, area = null) => ({ title, severity, evidence, area });
const rec = (action, priority, expected_impact, owner = "consultor") => ({ action, priority, expected_impact, owner });
const src = (kind, reference, period = "últimos 30 días") => ({ kind, reference, period });
const diag = ({ answer, findings, recommendations, writes, sources, confidence = "medium", warnings = [], headline, sections }) => ({
  answer,
  findings,
  recommendations,
  sources,
  proposed_writes: writes,
  approval_required: writes.length > 0,
  confidence,
  warnings: [WARNING, ...warnings],
  // Previsualizacion del contrato a02-4 (docs/REVISION_AGENTES.md): salida
  // por secciones + titular. Solo se manda si el agente lo pide (hoy a02).
  // El render en ai-diagnostic-section.tsx es minimo a proposito: la UI real
  // esta pendiente, esto es solo para ver la forma de los datos.
  ...(headline ? { headline } : {}),
  ...(sections ? { sections } : {}),
});
const section = (key, label, findings, recommendations = []) => ({ key, label, findings, recommendations });

// Alcances que puede pedir cada pantalla: la cache es por tienda y periodo.
const everyScope = [null, ...stores].flatMap((storeId) => [7, 30, 90].map((lookbackDays) => ({ storeId, lookbackDays })));
const orgScope = (lookbackDays) => [{ storeId: null, lookbackDays }];

// ---------------------------------------------------------------------------
// Diagnosticos con tarjeta (AiDiagnosticSection)
// ---------------------------------------------------------------------------

await seedDiagnostic("a02_monitor_negocio", diag({
  answer: "Las ventas crecen un 12 % frente al periodo anterior (18.420 EUR), pero el margen de contribución cae 3 puntos por el peso de los descuentos y por un ROAS de Meta que roza el break-even. Dos productos top se quedan sin stock en menos de 10 días.",
  findings: [
    finding("El margen cae aunque se vende más", "high", "Margen de contribución 31,4 % frente a 34,6 % el periodo anterior; los descuentos suponen el 9,8 % de la facturación."),
    finding("Meta está en el límite del break-even", "medium", "ROAS atribuido por Meta 2,1 con un ROAS de break-even de 1,9."),
    finding("Riesgo de rotura en dos productos top", "high", "Sudadera Oversize Arena (6 días de cobertura) y Gorra Classic Navy (9 días)."),
  ],
  recommendations: [
    rec("Limitar el código BIENVENIDA15 a primera compra", "high", "Recuperar ~1,5 puntos de margen"),
    rec("Reponer los dos productos top esta semana", "urgent", "Evitar ~2.300 EUR de ventas perdidas", "cliente"),
  ],
  writes: [
    task("Restringir BIENVENIDA15 a primera compra", "Cambiar la condición del código en Shopify para que solo aplique a clientes sin pedidos previos.", "high", "Es el código que más margen consume y lo están usando clientes recurrentes.", [ev("Coste del código", "1.140 EUR", "shopify"), ev("Pedidos de recurrentes con el código", "38 %", "shopify")]),
    task("Pedido de reposición de Sudadera Oversize Arena y Gorra Classic Navy", "Lanzar el pedido al proveedor con cobertura para 45 días.", "urgent", "Se agotan antes de que llegue una reposición normal.", [ev("Cobertura Sudadera Arena", "6 días", "shopify"), ev("Cobertura Gorra Navy", "9 días", "shopify")]),
  ],
  sources: [src("metric", "shopify_sales_summary"), src("metric", "shopify_financial_summary"), src("metric", "meta_spend_summary")],
  // a02-4: mismos hallazgos que arriba, pero agrupados por categoría en vez
  // de en una lista plana, más un titular corto.
  headline: "Vendes más, pero ganas menos por cada venta: revisa los descuentos antes de reponer.",
  sections: [
    section("ventas_margen", "Ventas y margen", [
      finding("El margen cae aunque se vende más", "high", "Margen de contribución 31,4 % frente a 34,6 % el periodo anterior; los descuentos suponen el 9,8 % de la facturación."),
    ], [rec("Limitar el código BIENVENIDA15 a primera compra", "high", "Recuperar ~1,5 puntos de margen")]),
    section("stock", "Stock", [
      finding("Riesgo de rotura en dos productos top", "high", "Sudadera Oversize Arena (6 días de cobertura) y Gorra Classic Navy (9 días)."),
    ], [rec("Reponer los dos productos top esta semana", "urgent", "Evitar ~2.300 EUR de ventas perdidas", "cliente")]),
    section("meta", "Adquisición Meta", [
      finding("Meta está en el límite del break-even", "medium", "ROAS atribuido por Meta 2,1 con un ROAS de break-even de 1,9."),
    ], []),
  ],
}), everyScope);

const planOutput = (horizon) => diag({
  answer: `Plan ${horizon}: tres frentes con cifras detrás. Primero margen (descuentos), después stock de los productos que tiran de la venta y por último la secuencia de bienvenida de Klaviyo, que convierte por debajo de lo esperado.`,
  findings: [
    finding("Backlog con tareas duplicadas", "low", "Hay 2 tareas abiertas sobre el mismo flujo de carrito abandonado."),
    finding("Ventas estables, margen en descenso", "medium", "Facturación +12 %, margen de contribución -3 puntos."),
  ],
  recommendations: [rec("Cerrar primero lo que afecta al margen", "high", "Proteger ~1.100 EUR/mes")],
  writes: [
    task(`Revisar descuentos activos (${horizon})`, "Listar los códigos activos, su coste y a quién se aplican; desactivar los que no traen clientes nuevos.", "high", "Los descuentos son la principal fuga de margen del periodo.", [ev("Descuentos / facturación", "9,8 %", "shopify")]),
    task(`Rehacer el email 2 de la bienvenida (${horizon})`, "Cambiar el ángulo del segundo email: prueba social en vez de repetir el descuento.", "medium", "Es el paso de la secuencia con más bajas de clic.", [ev("Tasa de clic email 2", "1,1 %", "klaviyo")]),
  ],
  sources: [src("table", "tasks"), src("metric", "shopify_sales_summary")],
});
await seedDiagnostic("a04_generador_tareas", planOutput("diario"), everyScope);
await seedDiagnostic("a17_plan_semanal", planOutput("semanal"), everyScope);
await seedDiagnostic("a18_plan_mensual", planOutput("mensual"), everyScope);

await seedDiagnostic("a06_planificador_stock", diag({
  answer: "3 productos que venden bien se quedan sin stock en menos de 15 días. El resto del catálogo con stock bajo apenas vende y no justifica reponer ahora.",
  findings: [
    finding("Sudadera Oversize Arena: 6 días de cobertura", "critical", "Vende 4,2 uds/día y quedan 25 uds."),
    finding("Gorra Classic Navy: 9 días de cobertura", "high", "Vende 2,1 uds/día y quedan 19 uds."),
    finding("Camiseta Basic Blanca M: 14 días", "medium", "Vende 3,0 uds/día y quedan 42 uds."),
  ],
  recommendations: [rec("Reponer por orden de cobertura", "urgent", "Evitar roturas en los 3 productos que más facturan", "cliente")],
  writes: [task("Reponer Sudadera Oversize Arena (≈190 uds)", "Pedido para 45 días de cobertura al ritmo actual.", "urgent", "Se agota en 6 días.", [ev("Venta diaria", "4,2 uds", "shopify"), ev("Stock", "25 uds", "shopify", null)])],
  sources: [src("metric", "shopify_stock_risk_products")],
  confidence: "high",
}), everyScope);

await seedDiagnostic("a08_gestor_conocimiento", diag({
  answer: "El catálogo cubre bien captación y email, pero no hay nada sobre política de devoluciones ni sobre pricing. Hay dos documentos que dicen casi lo mismo sobre flujos de bienvenida.",
  findings: [
    finding("Falta metodología de devoluciones", "medium", "Ningún documento activo trata devoluciones o logística inversa."),
    finding("Posible duplicado", "low", "«Flujo de bienvenida» y «Welcome series: guía» cubren lo mismo."),
  ],
  recommendations: [rec("Redactar una guía de devoluciones", "medium", "Los agentes podrán citarla en postventa")],
  writes: [task("Redactar la guía de devoluciones", "Documento de metodología: plazos, motivos y cómo reducirlas.", "medium", "a22 no tiene nada que citar cuando detecta devoluciones altas.", [])],
  sources: [src("table", "knowledge_documents", null)],
}), orgScope(30));

await seedDiagnostic("a12_analista_email", diag({
  answer: "Klaviyo atribuye 4.980 EUR en 90 días, el 71 % desde flujos. Las campañas abren bien (38 %) pero hacen poco clic (0,9 %). El flujo de carrito abandonado lleva 3 semanas sin enviar.",
  findings: [
    finding("Carrito abandonado parado", "high", "0 envíos en 21 días; antes enviaba ~40/semana."),
    finding("Campañas con clic bajo", "medium", "Clic único 0,9 % frente a 2,1 % de los flujos."),
    finding("Asuntos demasiado largos", "low", "Media de 68 caracteres; los que mejor abren tienen menos de 40."),
  ],
  recommendations: [rec("Revisar el disparador del carrito abandonado", "urgent", "Recuperar ~600 EUR/mes atribuidos por Klaviyo")],
  writes: [task("Reactivar el flujo de carrito abandonado", "Comprobar el evento Started Checkout y el estado del flujo en Klaviyo.", "urgent", "Es el flujo que más facturación atribuida traía.", [ev("Envíos últimos 21 días", "0", "klaviyo"), ev("EUR atribuidos por Klaviyo antes de parar", "610 EUR/mes", "klaviyo")])],
  sources: [src("metric", "klaviyo_email_report", "últimos 90 días")],
  warnings: ["Cifras atribuidas por Klaviyo: no se suman a Shopify ni a Meta."],
}), orgScope(90));

await seedDiagnostic("a13_operativa_shopify", diag({
  answer: "La tienda vende 18.420 EUR en 30 días (+12 %) con un margen de contribución del 31,4 % y un descuento medio del 9,8 %. Está por encima del break-even, pero el margen se estrecha.",
  findings: [
    finding("Descuento medio alto", "medium", "9,8 % sobre facturación, 3 puntos más que el periodo anterior."),
    finding("Dos productos top en riesgo de rotura", "high", "Cobertura de 6 y 9 días."),
  ],
  recommendations: [rec("Tarea de rama «Margen» de Mi Camino: revisar descuentos", "high", "Proteger margen")],
  writes: [task("Auditar descuentos activos", "Rama Mi Camino: Margen.", "high", "El descuento medio sube 3 puntos.", [ev("Descuento medio", "9,8 %", "shopify")])],
  sources: [src("metric", "shopify_financial_summary")],
}), orgScope(30));

await seedDiagnostic("a14_operativa_meta", diag({
  answer: "Se invierten 3.100 EUR en Meta (+18 %). El ROAS atribuido por Meta baja de 2,6 a 2,1 y el CAC blended sube a 34 EUR. Estás a 0,2 de ROAS del break-even.",
  findings: [
    finding("ROAS atribuido por Meta a la baja", "high", "2,6 → 2,1 con más inversión."),
    finding("CAC blended por encima del objetivo", "medium", "34 EUR frente a un objetivo de 28 EUR."),
  ],
  recommendations: [rec("No subir presupuesto hasta recuperar ROAS 2,4", "high", "Evitar comprar clientes por debajo del break-even")],
  writes: [task("Congelar el escalado de la campaña Prospecting ES", "Mantener presupuesto y rotar creatividades.", "high", "El ROAS cae según sube el gasto.", [ev("ROAS atribuido por Meta", "2,1", "meta"), ev("Inversión", "3.100 EUR", "meta")])],
  sources: [src("metric", "meta_spend_summary")],
  warnings: ["Compras y valor son los que Meta se atribuye (7d clic / 1d vista)."],
}), orgScope(30));

await seedDiagnostic("a20_retencion_clientes", diag({
  answer: "El 22 % de los clientes vuelve a comprar en 90 días y un cliente vale 61 EUR en su primer año. Las cohortes de primavera repiten menos que las de invierno.",
  findings: [
    finding("Recompra del 22 % a 90 días", "medium", "Por debajo del 28 % de referencia para moda básica."),
    finding("Cohortes recientes más débiles", "medium", "Marzo-mayo: 17 % de recompra frente a 26 % en enero-febrero."),
  ],
  recommendations: [rec("Montar un flujo post-compra a los 30 días", "high", "Subir la recompra 3-4 puntos")],
  writes: [task("Crear flujo post-compra día 30", "Email con complementos del producto comprado.", "high", "No hay nada que empuje la segunda compra.", [ev("Recompra 90 días", "22 %", "shopify", "últimos 90 días")])],
  sources: [src("metric", "shopify_cohorts", "últimos 90 días")],
}), orgScope(90));

await seedDiagnostic("a21_adquisicion_shopify", diag({
  answer: "El 46 % de los pedidos llega por búsqueda orgánica y el 31 % por redes pagadas según Shopify. Se quedan 7.800 EUR en carritos abandonados, de los que se recupera el 6 %.",
  findings: [
    finding("Recuperación de carritos muy baja", "high", "6 % recuperado frente a 10-15 % habitual."),
    finding("BIENVENIDA15 es el código más caro", "medium", "1.140 EUR de coste en el periodo."),
  ],
  recommendations: [rec("Reforzar el carrito abandonado", "high", "Recuperar ~350 EUR/mes")],
  writes: [task("Añadir un segundo email al carrito abandonado", "A las 24 h, con reseñas del producto.", "high", "Solo hay un email y llega a las 4 h.", [ev("Carritos abandonados", "7.800 EUR", "shopify", "últimos 90 días")])],
  sources: [src("metric", "shopify_checkout_recovery", "últimos 90 días")],
  warnings: ["Atribución de Shopify: no se suma con Meta ni Klaviyo."],
}), orgScope(90));

await seedDiagnostic("a22_postventa_shopify", diag({
  answer: "Se tarda 1,8 días en enviar y 4,1 en entregar. El 7 % de los pedidos llega tarde. La Sudadera Oversize Arena tiene un 14 % de devoluciones, casi todas por talla.",
  findings: [
    finding("Devoluciones por talla en la Sudadera Arena", "high", "14 % devuelta; 80 % de los motivos son «talla grande»."),
    finding("7 % de entregas tarde", "medium", "Concentradas en Baleares y Canarias."),
  ],
  recommendations: [rec("Añadir guía de tallas específica en la ficha", "high", "Bajar devoluciones a la mitad", "cliente")],
  writes: [task("Guía de tallas en la ficha de la Sudadera Arena", "Indicar que talla grande y recomendar una talla menos.", "high", "Es el producto con más devoluciones.", [ev("Devoluciones", "14 %", "shopify", "últimos 90 días")])],
  sources: [src("metric", "shopify_return_rate_by_product", "últimos 90 días")],
}), orgScope(90));

await seedDiagnostic("a23_creatividad_meta", diag({
  answer: "El 38 % del presupuesto está en creatividades que Meta califica por debajo de la media. Los dos vídeos UGC retienen el doble que los estáticos.",
  findings: [
    finding("1.180 EUR en piezas por debajo de la media", "high", "3 anuncios estáticos con ranking de calidad BELOW_AVERAGE."),
    finding("Los UGC enganchan", "info", "Hook rate 31 % frente a 14 % de la media de la cuenta."),
  ],
  recommendations: [rec("Retirar los 3 estáticos y duplicar los UGC", "high", "Mover ~1.100 EUR a piezas que funcionan")],
  writes: [task("Pausar 3 anuncios estáticos por debajo de la media", "Estático_Oferta_01, 02 y 04.", "high", "Consumen el 38 % del gasto con peor calidad.", [ev("Gasto en BELOW_AVERAGE", "1.180 EUR", "meta")])],
  sources: [src("metric", "meta_creative_performance")],
}), orgScope(30));

await seedDiagnostic("a24_medicion_meta", diag({
  answer: "El píxel envía visitas y carritos, pero lleva 4 días sin Purchase. Hasta que se arregle, el ROAS de Meta no es fiable.",
  findings: [
    finding("Purchase sin llegar", "critical", "4 de los últimos 30 días sin eventos Purchase."),
    finding("2 conjuntos en aprendizaje limitado", "medium", "Menos de 50 conversiones semanales."),
  ],
  recommendations: [rec("Revisar la integración del píxel en el checkout", "urgent", "Sin esto la optimización va a ciegas")],
  writes: [task("Revisar el evento Purchase del píxel", "Comprobar la app de Meta en Shopify y el Events Manager.", "urgent", "La campaña optimiza a compras y no las recibe.", [ev("Días sin Purchase", "4", "meta")])],
  sources: [src("metric", "meta_pixel_health")],
  confidence: "high",
}), orgScope(30));

await seedDiagnostic("a25_cambios_meta", diag({
  answer: "Hubo 9 cambios en la cuenta. Tras subir un 40 % el presupuesto de Prospecting ES, el CPA subió un 22 % en 7 días. Es coincidencia en el tiempo, no causa demostrada.",
  findings: [
    finding("Subida de presupuesto seguida de CPA más alto", "medium", "CPA 26 → 32 EUR en la misma campaña."),
    finding("4 públicos sin uso", "low", "Creados hace más de 90 días y en ningún conjunto activo."),
  ],
  recommendations: [rec("Escalar en saltos de 20 % como máximo", "medium", "Menos reinicios de aprendizaje")],
  writes: [task("Archivar 4 públicos sin uso", "Limpieza de la cuenta.", "low", "Ordenan la cuenta y evitan errores al segmentar.", [])],
  sources: [src("metric", "meta_change_impact")],
}), orgScope(30));

await seedDiagnostic("a26_contenido_email", diag({
  answer: "3 emails prometen en el asunto algo que el cuerpo no cumple y 5 no etiquetan sus enlaces con UTM, así que su efecto no se puede medir.",
  findings: [
    finding("Asunto que no cumple el cuerpo", "medium", "«Últimas unidades» en un email sin productos con stock bajo."),
    finding("5 emails sin UTM", "high", "Todo el flujo de bienvenida envía tráfico sin atribuir."),
    finding("Secuencia repetitiva", "low", "Los emails 2 y 3 de la bienvenida repiten el mismo descuento."),
  ],
  recommendations: [rec("Activar UTM automáticas en Klaviyo", "high", "Poder medir el flujo de bienvenida")],
  writes: [task("Activar UTM en el flujo de bienvenida", "Ajuste de tracking de enlaces en Klaviyo.", "high", "Sin UTM no se sabe si el flujo funciona.", [ev("Emails sin UTM", "5", "klaviyo")])],
  sources: [src("tool", "klaviyo_email_inventory", null)],
}), orgScope(30));

// ---------------------------------------------------------------------------
// Propuestas con su propio contrato (a05, a19, a27)
// ---------------------------------------------------------------------------

{
  const runId = await insertRun("a05_estrategia_campanas", { lookbackDays: 90 });
  await insertOutput(runId, {
    plan_name: "Otoño: recompra y lanzamiento de sudaderas",
    diagnosis: "Ventas +12 % con margen a la baja; email con buena apertura y poco clic; Meta cerca del break-even. Las campañas deben traer segunda compra sin más descuento.",
    campaigns: [
      { title: "Preventa Sudaderas Otoño", channel: "Email", objective: "Vender la colección a compradores sin descuento", audience: "Compradores de los últimos 12 meses", hypothesis: "El acceso anticipado vende sin descuento a quien ya compró.", start_offset_days: 7, duration_days: 5, evidence: [ev("Recompra 90 días", "22 %", "shopify", "últimos 90 días")], success_metric: "EUR atribuidos por Klaviyo" },
      { title: "UGC Sudadera Arena", channel: "Meta", objective: "Captar clientes nuevos con la pieza que mejor retiene", audience: "Lookalike 1 % compradores", hypothesis: "El vídeo UGC retiene el doble que el estático.", start_offset_days: 10, duration_days: 21, evidence: [ev("Hook rate UGC", "31 %", "meta")], success_metric: "CPA atribuido por Meta" },
    ],
    sources: [src("metric", "shopify_sales_summary", "últimos 90 días")],
    confidence: "medium",
    warnings: [WARNING],
  });
}

{
  const runId = await insertRun("a19_arquitecto_camino", { lookbackDays: 90 });
  await insertOutput(runId, {
    plan_name: "Trimestre de margen y recompra",
    diagnosis: "18.420 EUR/mes con margen de contribución del 31,4 % y recompra del 22 %. Crecer sin arreglar margen y recompra solo compra clientes más caros.",
    phases: [
      { name: "Margen", description: "Cortar descuentos que no traen clientes nuevos.", rationale: "Es la fuga más grande y la más rápida de cerrar.", evidence: [ev("Descuentos / facturación", "9,8 %", "shopify")], milestones: [{ name: "Descuento medio < 7 %", description: "Solo códigos de primera compra.", target_offset_days: 30, success_metric: "Descuento medio sobre facturación" }] },
      { name: "Recompra", description: "Flujos post-compra y campañas a compradores.", rationale: "La recompra está 6 puntos por debajo de la referencia.", evidence: [ev("Recompra 90 días", "22 %", "shopify", "últimos 90 días")], milestones: [{ name: "Recompra 90 días ≥ 26 %", description: "Flujo día 30 y preventa a compradores.", target_offset_days: 90, success_metric: "Tasa de recompra a 90 días" }] },
    ],
    sources: [src("metric", "shopify_financial_summary", "últimos 90 días")],
    confidence: "medium",
    warnings: [WARNING],
  });
}

const mailingPlan = {
  plan_name: "Semana de preventa Sudaderas Otoño",
  diagnosis: "Las campañas abren bien y hacen poco clic: la secuencia prioriza un solo CTA por email y prueba social en vez de descuento.",
  sequence_rationale: "Anuncio → prueba social → último aviso, cada uno con un ángulo distinto.",
  emails: [
    { sequence_number: 1, title: "Anuncio de preventa", objective: "Abrir la preventa", audience: "Compradores 12 meses", angle: "Acceso anticipado", subject_direction: "Corto y exclusivo", preheader_direction: "Fecha de fin", cta: "Ver sudaderas", copy_brief: "Solo para quien ya compró. Sin descuento.", evidence: [] },
    { sequence_number: 2, title: "Lo que dicen de la Arena", objective: "Vencer la duda de talla", audience: "No compradores del email 1", angle: "Reseñas y guía de tallas", subject_direction: "Prueba social", preheader_direction: "Cómo elegir talla", cta: "Encontrar mi talla", copy_brief: "Tres reseñas reales y la guía de tallas.", evidence: [] },
    { sequence_number: 3, title: "Último día de preventa", objective: "Cerrar", audience: "Clic sin compra", angle: "Urgencia real", subject_direction: "Fin de plazo", preheader_direction: "Stock de preventa", cta: "Reservar la mía", copy_brief: "Recordar el fin de la preventa sin inventar escasez.", evidence: [] },
  ],
  sources: [src("metric", "klaviyo_email_report", "últimos 90 días")],
  confidence: "medium",
  warnings: [WARNING],
};
{
  const runId = await insertRun("a27_planificador_mailing", { lookbackDays: 90 });
  await insertOutput(runId, mailingPlan);
}

// ---------------------------------------------------------------------------
// Borradores de email (a11), uno suelto y los tres de la secuencia de a27
// ---------------------------------------------------------------------------

const emailHtml = (title, body, cta) => `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px">
<tr><td style="padding:32px 32px 8px;font-size:24px;font-weight:bold;color:#0f172a">${title}</td></tr>
<tr><td style="padding:8px 32px 24px;font-size:16px;line-height:1.5;color:#334155">${body}</td></tr>
<tr><td style="padding:0 32px 32px"><a href="https://example.com/sudaderas?utm_source=klaviyo" style="background:#1d4ed8;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">${cta}</a></td></tr>
</table></td></tr></table></body></html>`;

async function seedDraft({ subject, preheader, title, body, cta, purpose, audience, brief }) {
  const output = {
    summary: `Borrador de ejemplo: ${title}.`,
    template_name: title,
    subject,
    preheader,
    from_name: "EcomScaling Dev",
    reply_to: null,
    purpose,
    audience,
    locale: "es-ES",
    tone: "cercano",
    plain_text: `${title}\n\n${body}\n\n${cta}`,
    html: emailHtml(title, body, cta),
    blocks: [
      { type: "heading", content: title, href: null, alt: null },
      { type: "text", content: body, href: null, alt: null },
      { type: "button", content: cta, href: "https://example.com/sudaderas?utm_source=klaviyo", alt: null },
    ],
    personalization_tokens: ["{{ first_name|default:'' }}"],
    compliance_notes: ["Incluye enlace de baja en el pie de Klaviyo."],
    sources: [src("metric", "klaviyo_email_report", "últimos 90 días")],
    confidence: "medium",
    warnings: [WARNING],
    approval_required: true,
  };
  const runId = await insertRun("a11_generador_marketing", { lookbackDays: 30 });
  const outputId = await insertOutput(runId, output);
  await db.query(
    `insert into public.marketing_content_drafts (organization_id, created_by, agent_run_id, agent_output_id, content_type,
       status, request, summary, template_name, subject, preheader, from_name, purpose, audience, locale, tone,
       plain_text, html, blocks, personalization_tokens, compliance_notes, sources, confidence, warnings)
     values ($1, $2, $3, $4, 'campaign', 'pending_approval', $5, $6, $7, $8, $9, $10, $11, $12, 'es-ES', 'cercano',
       $13, $14, $15, $16, $17, $18, 'medium', $19)`,
    [ORG, CONSULTANT, runId, outputId, JSON.stringify({ seed: TAG, channel: "email_klaviyo", content_type: "campaign", brief }),
      output.summary, title, subject, preheader, output.from_name, purpose, audience, output.plain_text, output.html,
      JSON.stringify(output.blocks), JSON.stringify(output.personalization_tokens), JSON.stringify(output.compliance_notes),
      JSON.stringify(output.sources), JSON.stringify(output.warnings)],
  );
}

await seedDraft({
  subject: "Tu segunda compra, con envío gratis",
  preheader: "Solo esta semana para clientes",
  title: "Gracias por volver",
  body: "Hace un mes te llevaste tu primera prenda. Esta semana el envío corre de nuestra cuenta en tu siguiente pedido.",
  cta: "Ver novedades",
  purpose: "Empujar la segunda compra",
  audience: "Clientes con una sola compra hace 30-45 días",
  brief: "Email de recompra a clientes con una compra, sin descuento, con envío gratis.",
});
for (const email of mailingPlan.emails) {
  await seedDraft({
    subject: email.title,
    preheader: email.preheader_direction,
    title: email.title,
    body: email.copy_brief,
    cta: email.cta,
    purpose: email.objective,
    audience: email.audience,
    brief: `PLAN ESTRATEGICO A27 · email ${email.sequence_number} de ${mailingPlan.emails.length}: ${email.title}`,
  });
}

// ---------------------------------------------------------------------------
// Llamada con resumen (a01)
// ---------------------------------------------------------------------------

{
  const call = await one(
    `insert into public.consulting_calls (organization_id, consultant_user_id, title, call_type, status, held_at,
       duration_minutes, is_visible_to_client, created_by, external_recording_id)
     values ($1, $2, 'Revisión mensual de septiembre (ejemplo)', 'monthly_review', 'held', now() - interval '1 day', 45, true, $2, $3)
     returning id`,
    [ORG, CONSULTANT, TAG],
  );
  const transcript = await one(
    `insert into public.call_transcripts (call_id, organization_id, content, source, version, is_current, created_by)
     values ($1, $2, $3, 'manual', 1, true, $4) returning id`,
    [call.id, ORG, "Consultor: ¿Cómo ha ido el mes?\nCliente: Vendemos más, pero no sé si ganamos más. Los descuentos se nos han ido de las manos.\nConsultor: Revisemos BIENVENIDA15 y la reposición de la Sudadera Arena.\nCliente: Vale, y quiero lanzar las sudaderas de otoño en octubre.", CONSULTANT],
  );
  const runId = await insertRun("a01_analista_llamadas", { trigger: "call" });
  await db.query(
    `insert into public.call_ai_summaries (call_id, organization_id, transcript_id, run_id, summary, key_points, agreed_actions, status, authored_by)
     values ($1, $2, $3, $4, $5, $6, $7, 'pending_approval', $8)`,
    [call.id, ORG, transcript.id, runId,
      "El cliente vende más pero duda del margen. Se acuerda revisar descuentos, reponer la Sudadera Arena y preparar el lanzamiento de otoño.",
      JSON.stringify({
        facts: ["Facturación +12 % en el mes", "El cliente percibe que los descuentos se han descontrolado"],
        recommendations: [{ action: "Limitar BIENVENIDA15 a primera compra", priority: "high", rationale: "Es el código que más margen consume." }],
        risks: ["Rotura de stock de la Sudadera Arena antes del lanzamiento"],
        key_quotes: ["«Vendemos más, pero no sé si ganamos más»"],
        proposed_tasks: [
          { title: "Restringir BIENVENIDA15", description: "Solo primera compra.", priority: "high", owner: "consultor" },
          { title: "Confirmar fecha de lanzamiento de otoño", description: "Fecha y stock disponible.", priority: "medium", owner: "cliente" },
        ],
        consultant_gaps: [{ topic: "Meta cerca del break-even", why_it_matters: "Se va a escalar el lanzamiento con Meta.", evidence: "ROAS atribuido por Meta 2,1 con break-even 1,9; no se habló.", severity: "medium" }],
        conversation_signals: [{ label: "Reparto de palabra", value: "Consultor 64 % / cliente 36 %", about: "consultor", reading: "Dejar más espacio al cliente en la próxima.", trend: "sin_referencia" }],
        confidence: "medium",
        warnings: [WARNING],
      }),
      JSON.stringify(["Revisar descuentos esta semana", "Lanzamiento de sudaderas en octubre"]),
      CONSULTANT],
  );
}

// ---------------------------------------------------------------------------
// Chat del Consultor IA (a09): una conversacion por usuario
// ---------------------------------------------------------------------------

for (const [user, withProposal] of [[CLIENT, false], [CONSULTANT, true]]) {
  const question = "¿Por qué gano menos este mes si vendo más?";
  const conversation = await one(
    `insert into public.ai_conversations (organization_id, user_id, agent_code, title)
     values ($1, $2, 'a09_copiloto_consultor', $3) returning id`,
    [ORG, user, `${CHAT_TITLE_PREFIX}${question}`],
  );
  await db.query(
    "insert into public.ai_messages (conversation_id, organization_id, role, content, created_at) values ($1, $2, 'user', $3, now() - interval '1 minute')",
    [conversation.id, ORG, question],
  );
  const chatOutput = {
    answer: "Vendes un 12 % más, pero el margen de contribución baja del 34,6 % al 31,4 %. La causa principal son los descuentos: suponen el 9,8 % de la facturación y BIENVENIDA15 la usan también clientes que ya habían comprado. Meta además está cerca del break-even (ROAS 2,1 atribuido por Meta frente a 1,9).",
    sources: [src("tool", "shopify_margin_health"), src("tool", "meta_spend_detail")],
    confidence: "medium",
    warnings: [WARNING],
    findings: [{ title: "Descuentos", detail: "9,8 % de la facturación", impact: "high" }],
    next_action: "Limitar BIENVENIDA15 a primera compra.",
    ...(withProposal
      ? { proposed_writes: [task("Restringir BIENVENIDA15 a primera compra", "Cambiar la condición en Shopify.", "high", "Recuperar margen.", [ev("Coste del código", "1.140 EUR", "shopify")])] }
      : {}),
  };
  const runId = await insertRun("a09_copiloto_consultor", { trigger: "chat", actor: user });
  await db.query(
    "insert into public.ai_messages (conversation_id, organization_id, role, content, run_id, metadata) values ($1, $2, 'assistant', $3, $4, $5)",
    [conversation.id, ORG, chatOutput.answer, runId, JSON.stringify({ ui_actions: [] })],
  );
  if (withProposal) await insertOutput(runId, chatOutput);
}

// ---------------------------------------------------------------------------
// Banco de imagenes (a15): una pieza grafica generada aqui y su ficha
// ---------------------------------------------------------------------------

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}
function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function brandGraphicPng(size = 640) {
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x += 1) {
      const t = y / size;
      let [r, g, b] = [29 + 40 * t, 78 + 60 * t, 216 - 20 * t]; // degradado azul de marca
      const inCard = x > 140 && x < 500 && y > 150 && y < 490;
      const dx = x - 430, dy = y - 200;
      if (inCard) [r, g, b] = [248, 250, 252];
      if (dx * dx + dy * dy < 55 * 55) [r, g, b] = [250, 204, 21];
      const o = 1 + x * 3;
      row[o] = r; row[o + 1] = g; row[o + 2] = b;
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

{
  const png = brandGraphicPng();
  const path = `${ORG}/instagram-bank/${crypto.randomUUID()}.png`;
  const upload = await storage.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: false });
  if (upload.error) throw new Error(`No se pudo subir la imagen de ejemplo: ${upload.error.message}`);
  const publicUrl = storage.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const analysis = {
    description: "Pieza gráfica de marca: fondo en degradado azul, un bloque blanco centrado que deja espacio para texto y un círculo amarillo en la esquina superior derecha.",
    objects: ["bloque blanco", "círculo amarillo", "fondo degradado"],
    colors: [{ label: "Azul marca", hex: "#1d4ed8" }, { label: "Blanco", hex: "#f8fafc" }, { label: "Amarillo", hex: "#facc15" }],
    style: "Plano, geométrico, sin fotografía.",
    ocr_text: "",
    suggested_use: "Fondo para anunciar la preventa: titular en el bloque blanco y el círculo amarillo como sello de fecha.",
    alt_text: "Fondo azul con un recuadro blanco y un círculo amarillo",
    confidence: "high",
  };
  const runId = await insertRun("a15_analista_imagenes", { trigger: "webhook" });
  await insertOutput(runId, analysis, { approvalRequired: false });
  await db.query(
    `insert into public.instagram_image_bank (organization_id, storage_path, public_url, original_filename, content_type,
       byte_size, checksum, status, analysis, markdown, agent_run_id, analyzed_at, created_by)
     values ($1, $2, $3, 'ejemplo-preventa.png', 'image/png', $4, $5, 'analyzed', $6, $7, $8, now(), $9)`,
    [ORG, path, publicUrl, png.length, IMAGE_CHECKSUM, JSON.stringify(analysis), `# ejemplo-preventa.png\n\n${analysis.description}`, runId, CONSULTANT],
  );
}

// ---------------------------------------------------------------------------
// Digest al final: con el mismo digest la cache se sirve aunque el autorun
// este encendido, mientras no haya actividad nueva en la organizacion.
// ---------------------------------------------------------------------------

const digest = await one("select public.organization_activity_digest($1) as d", [ORG]);
await db.query("update public.agent_runs set activity_digest = $1 where organization_id = $2 and trace_id = $3", [digest.d, ORG, TAG]);
const total = await one("select count(*)::int as n from public.agent_runs where organization_id = $1 and trace_id = $2", [ORG, TAG]);
console.log(`Insertadas ${total.n} ejecuciones de ejemplo en ${ORG_SLUG}. Borrar con: npm run seed:agentes-demo -- --clean`);
await db.end();
