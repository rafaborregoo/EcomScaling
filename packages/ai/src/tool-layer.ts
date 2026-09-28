import { z } from "zod";

/**
 * AI-00A: contrato ejecutable de la capa de tools.
 *
 * El catálogo describe capacidades y guardas; los adaptadores de cada
 * proveedor inyectan el executor cuando la conexión está disponible. Una
 * tool planificada no puede aparentar que está conectada porque no tiene
 * executor registrado.
 */

export const toolPermissionSchema = z.enum([
  "read",
  "propose",
  "write",
  "admin",
]);
export type ToolPermission = z.infer<typeof toolPermissionSchema>;

export const toolStatusSchema = z.enum([
  "implemented_partial",
  "planned",
  "disabled",
]);
export type ToolStatus = z.infer<typeof toolStatusSchema>;

export const toolErrorSchema = z.object({
  error: z.string().min(1),
  why: z.string().min(1),
  how_to_fix: z.string().min(1),
  retry_after: z.number().int().nonnegative().nullable(),
});
export type ToolError = z.infer<typeof toolErrorSchema>;

export const toolCostSchema = z.object({
  tokens: z.number().nonnegative(),
  latency_ms: z.number().nonnegative(),
  euros: z.number().nonnegative(),
});

export const provenanceSchema = z.object({
  source: z.string().min(1),
  as_of: z.string().datetime(),
  // null = la consulta se ejecutó ahora, pero el conector no expone la hora
  // de la última sincronización de esta fuente. No declarar frescura ficticia.
  freshness_seconds: z.number().nonnegative().nullable(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

export const toolWriteRequestSchema = z.object({
  idempotency_key: z.string().min(16).max(200),
  dry_run: z.boolean(),
});
export type ToolWriteRequest = z.infer<typeof toolWriteRequestSchema>;

export const toolWriteResultSchema = z.object({
  dry_run: z.boolean(),
  changed: z.boolean(),
  rollback_token: z.string().nullable(),
  audit_id: z.string().uuid().nullable(),
});
export type ToolWriteResult = z.infer<typeof toolWriteResultSchema>;

export const toolDefinitionSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/),
  version: z.string().regex(/^v\d+$/),
  permission: toolPermissionSchema,
  status: toolStatusSchema,
  description: z.string().min(1),
  estimated_cost: toolCostSchema,
  requires_approval: z.boolean(),
  requires_idempotency_key: z.boolean(),
  connector: z
    .enum(["core", "shopify", "meta", "klaviyo", "instagram"])
    .nullable(),
});
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;

export type ToolContract<TInput = unknown, TOutput = unknown> = {
  definition: ToolDefinition;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
};

export const toolContextSchema = z.object({
  organization_id: z.string().uuid(),
  actor_user_id: z.string().uuid(),
  allowed_tools: z.array(z.string()),
  approval_mode: z.enum([
    "none",
    "required_before_write",
    "required_before_publish",
  ]),
  connected_connectors: z.array(
    z.enum(["core", "shopify", "meta", "klaviyo", "instagram"]),
  ),
});
export type ToolContext = z.infer<typeof toolContextSchema>;

export const toolCollectionSchema = z.object({
  rows: z.array(z.unknown()),
  truncated: z.boolean(),
  next_cursor: z.string().nullable(),
  total_count: z.number().int().nonnegative().nullable(),
});

export const toolCollectionWithProvenanceSchema = toolCollectionSchema.extend({
  provenance: provenanceSchema,
});

const readTools = [
  "sql_query",
  "get_metric",
  "compare_periods",
  "get_timeseries",
  "detect_anomaly",
  "get_cohort",
  "describe_schema",
  "sample_rows",
  "data_coverage",
  "get_organization_profile",
  "get_brand_profile",
  "get_strategic_plan",
  "get_current_milestone",
  "list_open_tasks",
  "list_open_alerts",
  "get_task_history",
  "get_call_history",
  "get_financial_settings",
  // AI-22/23: contratos preparados sobre tablas normalizadas y tenant-scoped.
  "meta_read_ad_accounts",
  "meta_read_campaign_insights",
  "instagram_read_media",
  "instagram_read_insights",
  "knowledge_search",
  "memory_recall",
  "get_playbook",
  "cite_source",
  "get_budget_status",
  "report_confidence",
  "sql_select",
  "search_knowledge",
  // Metricas del modulo de Shopify. Existen como tool y no solo como contexto
  // preparado para que el chat no tenga que explorar once tablas con sql_select
  // para responder "¿vuelven los clientes?": una llamada, una respuesta, y los
  // mismos numeros que ve el consultor en pantalla.
  "shopify_customer_health",
  "shopify_product_repurchase_health",
  "shopify_demand_sources",
  "shopify_fulfillment_health",
  "shopify_delivery_diagnostics",
  "shopify_open_delivery_exceptions",
  // Embudo y margen entraron despues: se veian en pantalla y ningun agente
  // podia leerlos, asi que el copiloto no sabia responder "donde se cae la
  // conversion" ni "que me come el margen" con el numero a dos clics.
  "shopify_funnel_health",
  "shopify_margin_health",
  "get_shopify_product_catalog",
  // Metricas del modulo de Meta. Mismo criterio que las de Shopify: tres
  // tools y no nueve funciones sueltas, cada una responde una pregunta
  // entera. Las dos viejas (meta_read_ad_accounts,
  // meta_read_campaign_insights) siguen siendo el acceso crudo a la
  // estructura; estas son las que ya vienen con el juicio calculado.
  "meta_creative_health",
  "meta_creative_diagnostics",
  "meta_delivery_health",
  "meta_change_log",
  // El gasto agregado ya estaba via meta_read_campaign_insights; esta baja a
  // campana y a serie diaria, que es el nivel al que se decide que se apaga.
  "meta_spend_detail",
  // Klaviyo: el contenido (asuntos y cuerpos) y si se puede medir. El cuerpo
  // llega ya convertido a texto -- el HTML de un email son 25 KB de tablas.
  "klaviyo_email_content",
  "klaviyo_measurement_health",
  "klaviyo_performance_summary",
  "klaviyo_entity_performance",
  "klaviyo_deliverability_health",
  "search_internal_email_design_playbook",
] as const;

const proposedTools = [
  "propose_task",
  "propose_milestone",
  "propose_phase",
  "propose_alert_rule",
  "propose_budget_change",
  "propose_content",
  "propose_experiment",
  "dry_run_write",
  "escalate_to_human",
  "request_missing_data",
  "handoff_to_agent",
  "flag_data_quality_issue",
] as const;

const writeTools = [
  "memory_write",
  "shopify_update_product",
  "shopify_update_inventory",
  "meta_pause_ad",
  "meta_adjust_budget",
  "meta_duplicate_adset",
  "klaviyo_create_flow",
  "klaviyo_send_campaign",
  "instagram_schedule_post",
  "log_reasoning_step",
  "record_outcome",
] as const;

const connectorForTool = (name: string): ToolDefinition["connector"] => {
  if (name === "search_internal_email_design_playbook") return null;
  if (name.startsWith("shopify_")) return "shopify";
  if (name.startsWith("meta_")) return "meta";
  if (name.startsWith("klaviyo_") || name === "propose_content")
    return "klaviyo";
  if (name.startsWith("instagram_")) return "instagram";
  return "core";
};

/** Identificadores persistidos por Integrations que tienen alias en el Tool Layer. */
export function normalizeToolConnectorId(provider: string): string {
  return provider === "meta_ads" ? "meta" : provider;
}

/**
 * Lo que hace cada tool, en una frase, con sus trampas.
 *
 * Vive aqui y no junto a cada `registerScopedReadTool` porque tiene dos
 * lectores que no pueden discrepar: el modelo, que decide con esto si la
 * tool le sirve, y el catalogo de /admin/tools, donde alguien mira que sabe
 * hacer el copiloto. Dos copias del mismo texto se separan al primer cambio
 * y entonces el panel describe una tool que ya no se comporta asi.
 *
 * Las advertencias ("si X viene a 0 no significa Y") son parte de la
 * descripcion a proposito: son lo que evita que el modelo diagnostique al
 * reves, y lo que un consultor necesita saber para fiarse de la respuesta.
 */
export const TOOL_DESCRIPTIONS = {
  meta_read_ad_accounts: "Lee las cuentas publicitarias Meta sincronizadas para la organización activa, sin credenciales ni datos crudos.",
  meta_read_campaign_insights: "Lee insights diarios Meta ya sincronizados, con filtros de cuenta y fechas y sin exponer payloads crudos.",
  instagram_read_media: "Lee publicaciones de Instagram sincronizadas para la organización activa, sin credenciales ni payloads crudos.",
  instagram_read_insights: "Lee métricas de publicaciones Instagram ya sincronizadas, filtradas por cuenta y periodo y sin datos crudos.",
  shopify_customer_health: "Recurrencia, valor por cliente, cohortes, LTV y churn de la tienda: responde si los clientes vuelven y cuanto vale cada uno. Los pedidos contados en unknown_orders NO son clientes nuevos, son pedidos sin el dato de Shopify. ltv es la curva a 30/60/90/180/365 dias sobre cohortes maduras: avg_contribution es MARGEN de contribucion y viene null si falta el coste de algun producto (di sin coste, no uses avg_revenue en su lugar); cohort_cac es el gasto publicitario de la ventana de captacion entre los clientes de la cohorte, y el payback es el primer hito donde avg_contribution >= cohort_cac. churn es el % de clientes que no han vuelto a comprar en 180 dias.",
  shopify_product_repurchase_health: "Recompra observada por producto en una tienda concreta: cohortes con 90 dias completos de seguimiento, minimo 30 clientes elegibles por producto e intervalos solo con al menos 10 clientes repetidores. Nunca devuelve identificadores de cliente. El historial sincronizado puede estar incompleto; el comportamiento observado no demuestra una cadencia futura ni causalidad, asi que no recomiendes un dia exacto solo con esta señal.",
  get_shopify_product_catalog: "Busca productos sincronizados de Shopify de la tienda activa por nombre, handle o proveedor y devuelve variantes/precios disponibles. Solo incluye datos presentes en el catálogo local: no incluye descripción extensa, imágenes ni disponibilidad en tiempo real, y no inventes los campos ausentes.",
  shopify_demand_sources: "De donde vienen los pedidos (primera visita segun Shopify), carritos abandonados y coste de cada codigo de descuento. Esta atribucion es la de Shopify y NO se suma con la de Meta o Klaviyo.",
  shopify_fulfillment_health: "Plazos de entrega y devoluciones por producto con su motivo. Si with_estimate es 0, Shopify no dio fecha prometida: ahi late_deliveries 0 no significa que todo llegara a tiempo.",
  shopify_delivery_diagnostics: "Desglose read-only de fulfillments por transportista, ubicación de preparación y destino agregado (país/región), con volumen, muestra fiable desde 30 envíos, mediana/p90 de pedido a creación del fulfillment y de creación a entrega, ETA/tardanzas, pendientes vencidos y cobertura de eventos. Eventos explícitos pueden confirmar aduanas, intento, retraso o fallo comunicado; los textos originales, direcciones y tracking no se conservan ni se exponen. Cobertura incompleta no prueba ausencia de incidencias y un estado carrier no prueba culpa legal.",
  shopify_open_delivery_exceptions: "Excepciones logísticas abiertas por envío (máximo 50) con referencia seudónima, transportista, antigüedad, motivo explícito, confianza, área probable y acción recomendada. No devuelve pedido, dirección, teléfono, email ni tracking. 'carrier_or_customs' describe el área a investigar, no demuestra culpa del transportista ni de aduanas. Los episodios se deduplican por envío/motivo y solo se cierran al sincronizar una entrega confirmada; un hito de tránsito genérico no prueba resolución.",
  shopify_funnel_health: "Donde se cae la gente antes de comprar: sesiones, anadidos al carrito, checkouts iniciados y pedidos del periodo, mas la serie diaria para ver si el embudo empeora o es un dia suelto. conversion_rate_shopify es la tasa que calcula Shopify sobre sus propias sesiones. Compara days_with_funnel_data con requested_days: el primero cuenta fechas distintas con todos los pasos del embudo sincronizados, el segundo los dias calendario inclusivos solicitados. Si requested_days es null, sessions es 0, la cobertura es parcial, falta un evento o la lectura falla, la conversion es desconocida y no evidencia una caida. funnel_data_since solo indica el primer dia completo observado, no continuidad ni cobertura dentro del periodo.",
  shopify_margin_health: "Que se come el margen: margen bruto del periodo, los productos que mas venden con su facturacion, y lo que cuesta cada codigo de descuento. items_without_cost es el numero de lineas vendidas SIN coste cargado: si es alto, el margen esta inflado porque a esos productos se les cuenta ingreso y no coste, y hay que avisar antes de dar ninguna cifra de margen por buena. La serie diaria de ventas viene para distinguir una caida de margen de una caida de volumen.",
  meta_creative_health: "Rendimiento por creatividad de Meta y reparto del gasto por veredicto de subasta. hook_rate y hold_rate en null con has_video false significan que el anuncio NO es un video, no que el video sea malo. enough_volume false significa que no hay impresiones suficientes para publicar tasas. UNKNOWN en un ranking es que Meta no tiene volumen para juzgarlo, no un suspenso.",
  meta_creative_diagnostics: "Inspecciona un anuncio Meta concreto por ID y periodo (máximo 90 días): devuelve identidad, copies/CTA sincronizados, variantes y activos de texto disponibles, rendimiento agregado solo a nivel anuncio y serie temporal diaria. Solo atribuye el periodo a una creatividad cuando una asignación temporal cubre el periodo entero; nunca atribuye métricas a cada activo. La serie elige una fila canónica por día; reach y frequency son observaciones diarias y nunca deben sumarse entre fechas. La ventana de atribución de compras puede diferir de otros informes y la tendencia no prueba fatiga ni causalidad. Esta tool no devuelve URLs ni binarios; el runner puede adjuntar como evidencia visual una imagen estática que ya esté importada al banco privado, si se valida el scope y el MIME. El ID debe venir del rendimiento sincronizado; la tienda la fija el backend.",
  meta_delivery_health: "Si las cifras de Meta se pueden creer: salud del pixel por evento, objetivo/evento promocionado realmente configurado por conjunto, estado de aprendizaje reportado por Meta y contexto de actividad Shopify/frescura si hay tienda seleccionada. El último evento del registro no confirma un reset de aprendizaje; la ausencia con log stale/failed/unknown tampoco prueba que no hubiera cambios. Distingue mapeo ausente, evento no observado, cero actividad con fuentes frescas y cobertura desconocida; permisos/sync antiguos invalidan los ceros. La conciliación Meta-Shopify no prueba causalidad ni exige equivalencia 1:1. No deduzcas Purchase desde un objetivo genérico ni conviertas una consulta fallida en cero.",
  meta_spend_detail: "En que campanas de Meta se va el dinero y como evoluciona el gasto dia a dia. Las compras y el valor de compra que acompanan al gasto son los que **Meta se atribuye** con su modelo (7 dias click / 1 dia view por defecto): NO son facturacion, no se suman a la de Klaviyo ni sustituyen a la de Shopify. Al hablar de ellos di 'atribuido por Meta'. Para saber cuanto cuesta de verdad traer un cliente usa cac_blended del resumen financiero, que divide el gasto entre los clientes nuevos reales de la tienda.",
  meta_change_log: "Que se toco en la cuenta de Meta y que paso en los 7 dias siguientes, sobre la misma entidad y con el dia del cambio excluido de las dos ventanas. Es coincidencia en el tiempo, NO causa demostrada: no lo presentes como una relacion probada.",
  klaviyo_email_content: "Los emails que envia esta tienda, de campana y de flujo, con su asunto, su preheader, el cuerpo en texto y sus enlaces. Los de flujo van numerados en el orden en que los recibe el suscriptor. adds_utm false significa que ese email NO etiqueta sus enlaces: su trafico llega sin atribuir, asi que su efecto no se puede medir aunque funcione. cuerpo_cortado true significa que el texto se trunco, no que el email termine ahi.",
  klaviyo_measurement_health: "Si se puede creer lo que mide el email de esta tienda: cuantos emails no llevan UTM, no tienen cuerpo o no siguen clics, mas el inventario de flujos, campanas, listas y segmentos y el estado del ultimo sync. recursos_no_traidos con valor significa que el catalogo esta INCOMPLETO: que un flujo no aparezca no prueba que no exista.",
  klaviyo_performance_summary: "Resumen de rendimiento Klaviyo para un periodo y su periodo inmediatamente anterior, con KPIs, entidades destacadas y granularidad mensual. Es atribucion reportada por Klaviyo, no ventas incrementales; una fila mensual no equivale a un envio individual.",
  klaviyo_entity_performance: "Rendimiento mensual de una campaña o flow Klaviyo concreto, con IDs y tienda fijados por el backend. Si no hay filas devuelve sin_datos, no ceros. El informe disponible es mensual y no permite inferir métricas por envío.",
  klaviyo_deliverability_health: "Salud de medición y entregabilidad Klaviyo, cobertura de sync e inventario incompleto. El tracking conductual agregado solo está disponible en alcance global; para tienda concreta se marca explícitamente como no disponible y nunca se mezcla con otras tiendas.",
  search_internal_email_design_playbook: "Busca principios privados de composición de E-NORA para inspirar un email. Devuelve como máximo cuatro resúmenes sin IDs, nombres de fichas, ejemplos literales ni HTML; adapta las ideas, no reveles el playbook.",
  get_organization_profile: "Lee el perfil operativo de la organizacion activa, sin credenciales ni secretos.",
  get_brand_profile: "Lee la guia de marca de la organizacion y, si se selecciono una tienda, aplica sus overrides sin mezclar tiendas. Solo devuelve campos de marca; nunca el playbook interno de E-NORA.",
  get_strategic_plan: "Lee el plan estrategico activo y sus fases/hitos de la organizacion activa.",
  get_current_milestone: "Lee el hito pendiente actual del plan estrategico activo de la organizacion.",
  list_open_tasks: "Lista hasta 50 tareas pendientes o en curso de la organizacion activa, ordenadas por vencimiento.",
  list_open_alerts: "Lista hasta 50 alertas abiertas o reconocidas de la organizacion activa.",
  get_task_history: "Lee hasta 100 tareas recientes de la organizacion activa para entender decisiones y resultados previos.",
  get_call_history: "Lee hasta 50 llamadas de consultoria de la organizacion activa sin notas internas ni transcripciones completas.",
  get_financial_settings: "Lee los parametros financieros configurados para la organizacion activa, sin ejecutar calculos ni escrituras.",
  request_missing_data: "Solicita una conexión o dato que falta; nunca inventa resultados ni modifica el conector.",
  escalate_to_human: "Declara una abstención segura cuando faltan datos o el riesgo supera lo que el agente puede decidir.",
  flag_data_quality_issue: "Reporta datos incoherentes o incompletos para que el consultor los revise antes de razonar sobre ellos.",
  report_confidence: "Obliga al agente a declarar su confianza y qué evidencia adicional podría cambiar la conclusión.",
} as const satisfies Record<string, string>;

const definition = (
  name: string,
  permission: ToolPermission,
  status: ToolStatus = "planned",
): ToolDefinition => ({
  name,
  version: "v1",
  permission,
  status,
  connector: connectorForTool(name),
  description:
    (TOOL_DESCRIPTIONS as Record<string, string | undefined>)[name] ??
    `E-NORA tool ${name}`,
  estimated_cost: {
    tokens: permission === "read" ? 500 : 900,
    latency_ms: 1500,
    euros: 0.01,
  },
  requires_approval: permission === "propose" || permission === "write",
  requires_idempotency_key: permission === "write",
});

export const TOOL_REGISTRY: readonly ToolDefinition[] = [
  ...readTools.map((name) =>
    definition(
      name,
      "read",
      [
        "sql_select",
        "search_knowledge",
        "data_coverage",
        "get_budget_status",
        "meta_read_ad_accounts",
        "meta_read_campaign_insights",
        "instagram_read_media",
        "instagram_read_insights",
        "describe_schema",
        "get_organization_profile",
        "get_brand_profile",
        "get_strategic_plan",
        "get_current_milestone",
        "list_open_tasks",
        "list_open_alerts",
        "get_task_history",
        "get_call_history",
        "get_financial_settings",
        "report_confidence",
        "shopify_customer_health",
        "shopify_product_repurchase_health",
        "shopify_demand_sources",
        "shopify_fulfillment_health",
        "shopify_delivery_diagnostics",
        "shopify_open_delivery_exceptions",
        "shopify_funnel_health",
        "shopify_margin_health",
        "get_shopify_product_catalog",
        "meta_creative_health",
        "meta_creative_diagnostics",
        "meta_delivery_health",
        "meta_change_log",
        "meta_spend_detail",
        "klaviyo_email_content",
        "klaviyo_measurement_health",
        "klaviyo_performance_summary",
        "klaviyo_entity_performance",
        "klaviyo_deliverability_health",
        "search_internal_email_design_playbook",
      ].includes(name)
        ? "implemented_partial"
        : "planned",
    ),
  ),
  ...proposedTools.map((name) =>
    definition(
      name,
      "propose",
      [
        "dry_run_write",
        "request_missing_data",
        "escalate_to_human",
        "flag_data_quality_issue",
      ].includes(name)
        ? "implemented_partial"
        : "planned",
    ),
  ),
  ...writeTools.map((name) => definition(name, "write")),
];

const emptyInputSchema = z.object({}).strict();
const toolResultSchema = z.object({}).passthrough();
const coverageOutputSchema = z
  .object({
    schema_ready: z.boolean(),
    rows: z.array(
      z
        .object({
          provider: z.string(),
          available: z.boolean(),
          connection_status: z.string(),
          data_available: z.boolean(),
          provenance: provenanceSchema,
        })
        .passthrough(),
    ),
    truncated: z.boolean(),
    next_cursor: z.string().nullable(),
    total_count: z.number().int().nonnegative(),
  })
  .passthrough();
const budgetOutputSchema = z.object({
  spent_today_usd: z.number().nonnegative(),
  daily_budget_usd: z.number().nonnegative(),
  remaining_usd: z.number().nonnegative(),
  exhausted: z.boolean(),
  provenance: provenanceSchema,
});
const knowledgeSearchOutputSchema = z
  .object({
    matches: z.array(z.unknown()),
    rows: z.array(z.unknown()),
    truncated: z.boolean(),
    next_cursor: z.string().nullable(),
    total_count: z.number().int().nonnegative(),
    provenance: provenanceSchema,
  })
  .or(z.object({ error: toolErrorSchema }));
const domainReadOutputSchema = z
  .object({
    data: z.unknown(),
    provenance: provenanceSchema,
  })
  .or(z.object({ error: toolErrorSchema }));
const proposalProvenanceSchema = z.object({
  provenance: provenanceSchema,
});
const requestMissingDataInputSchema = z
  .object({
    provider: z.string().min(1).max(80),
    missing: z.array(z.string().min(1).max(200)).min(1).max(20),
    reason: z.string().min(1).max(1000),
    requested_action: z.string().min(1).max(500).optional(),
  })
  .strict();
const requestMissingDataOutputSchema = z
  .object({
    request_type: z.literal("missing_data"),
    provider: z.string(),
    missing: z.array(z.string()),
    reason: z.string(),
    requested_action: z.string().nullable(),
    approval_required: z.literal(false),
  })
  .merge(proposalProvenanceSchema)
  .or(z.object({ error: toolErrorSchema }));
const escalateToHumanInputSchema = z
  .object({
    reason: z.string().min(1).max(1000),
    risk: z.enum(["low", "medium", "high", "critical"]),
    blocking_questions: z.array(z.string().min(1).max(500)).max(10),
  })
  .strict();
const escalateToHumanOutputSchema = z
  .object({
    request_type: z.literal("human_escalation"),
    reason: z.string(),
    risk: z.enum(["low", "medium", "high", "critical"]),
    blocking_questions: z.array(z.string()),
    approval_required: z.literal(false),
  })
  .merge(proposalProvenanceSchema)
  .or(z.object({ error: toolErrorSchema }));
const flagDataQualityInputSchema = z
  .object({
    issue: z.string().min(1).max(1000),
    datasets: z.array(z.string().min(1).max(160)).min(1).max(20),
    severity: z.enum(["low", "medium", "high", "critical"]),
    suggested_fix: z.string().min(1).max(500).optional(),
  })
  .strict();
const flagDataQualityOutputSchema = z
  .object({
    request_type: z.literal("data_quality_issue"),
    issue: z.string(),
    datasets: z.array(z.string()),
    severity: z.enum(["low", "medium", "high", "critical"]),
    suggested_fix: z.string().nullable(),
    approval_required: z.literal(false),
  })
  .merge(proposalProvenanceSchema)
  .or(z.object({ error: toolErrorSchema }));
const reportConfidenceInputSchema = z
  .object({
    confidence: z.enum(["low", "medium", "high"]),
    rationale: z.string().min(1).max(1000),
    evidence_gaps: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict();
const reportConfidenceOutputSchema = z
  .object({
    confidence: z.enum(["low", "medium", "high"]),
    rationale: z.string(),
    evidence_gaps: z.array(z.string()),
  })
  .merge(proposalProvenanceSchema)
  .or(z.object({ error: toolErrorSchema }));
const paginatedReadInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(50),
    cursor: z
      .string()
      .regex(/^offset:\d+$/)
      .nullable()
      .default(null),
  })
  .strict();
const paginatedReadOutputSchema = toolCollectionWithProvenanceSchema.or(
  z.object({ error: toolErrorSchema }),
);
const preparedConnectorReadInputSchema = z
  .object({
    account_id: z.string().min(1).max(255).optional(),
    period_start: z.string().date().optional(),
    period_end: z.string().date().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    cursor: z.string().regex(/^offset:\d+$/).nullable().default(null),
  })
  .strict();

export const TOOL_CONTRACTS: Readonly<Record<string, ToolContract>> = {
  sql_select: {
    definition: getDefinition("sql_select"),
    inputSchema: z
      .object({
        query: z.string().min(1),
        purpose: z.string().min(1).optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        rows: z.array(z.unknown()),
        row_limit: z.number().nullable(),
        estimated_cost: z.number().nullable().default(null),
        truncated: z.boolean(),
        next_cursor: z.string().nullable(),
        total_count: z.number().int().nonnegative().nullable(),
        tables_used: z.array(z.string()),
        provenance: provenanceSchema,
      })
      .or(toolErrorSchema),
  },
  search_knowledge: {
    definition: getDefinition("search_knowledge"),
    inputSchema: z.object({ query: z.string().min(1) }).strict(),
    outputSchema: knowledgeSearchOutputSchema,
  },
  data_coverage: {
    definition: getDefinition("data_coverage"),
    inputSchema: emptyInputSchema,
    outputSchema: coverageOutputSchema.or(toolResultSchema),
  },
  get_budget_status: {
    definition: getDefinition("get_budget_status"),
    inputSchema: emptyInputSchema,
    outputSchema: budgetOutputSchema.or(z.object({ error: toolErrorSchema })),
  },
  describe_schema: {
    definition: getDefinition("describe_schema"),
    inputSchema: z
      .object({
        tables: z.array(z.string().min(1).max(120)).max(20).optional(),
      })
      .strict(),
    outputSchema: z
      .object({
        schema: z.string().min(1),
        tables: z.array(z.string()),
        provenance: provenanceSchema,
      })
      .or(toolErrorSchema),
  },
  get_organization_profile: {
    definition: getDefinition("get_organization_profile"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  get_brand_profile: {
    definition: getDefinition("get_brand_profile"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  get_strategic_plan: {
    definition: getDefinition("get_strategic_plan"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  get_current_milestone: {
    definition: getDefinition("get_current_milestone"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  list_open_tasks: {
    definition: getDefinition("list_open_tasks"),
    inputSchema: paginatedReadInputSchema,
    outputSchema: paginatedReadOutputSchema,
  },
  list_open_alerts: {
    definition: getDefinition("list_open_alerts"),
    inputSchema: paginatedReadInputSchema,
    outputSchema: paginatedReadOutputSchema,
  },
  get_task_history: {
    definition: getDefinition("get_task_history"),
    inputSchema: paginatedReadInputSchema,
    outputSchema: paginatedReadOutputSchema,
  },
  get_call_history: {
    definition: getDefinition("get_call_history"),
    inputSchema: paginatedReadInputSchema,
    outputSchema: paginatedReadOutputSchema,
  },
  get_financial_settings: {
    definition: getDefinition("get_financial_settings"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  shopify_customer_health: {
    definition: getDefinition("shopify_customer_health"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  shopify_product_repurchase_health: {
    definition: getDefinition("shopify_product_repurchase_health"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  shopify_funnel_health: {
    definition: getDefinition("shopify_funnel_health"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  shopify_margin_health: {
    definition: getDefinition("shopify_margin_health"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  get_shopify_product_catalog: {
    definition: getDefinition("get_shopify_product_catalog"),
    inputSchema: z.object({
      query: z.string().max(120).optional(),
      limit: z.number().int().min(1).max(30).default(12),
    }).strict(),
    outputSchema: domainReadOutputSchema,
  },
  search_internal_email_design_playbook: {
    definition: getDefinition("search_internal_email_design_playbook"),
    inputSchema: z.object({
      objective: z.string().trim().min(1).max(500),
      audience: z.string().trim().max(200).optional(),
    }).strict(),
    outputSchema: domainReadOutputSchema,
  },
  shopify_demand_sources: {
    definition: getDefinition("shopify_demand_sources"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  meta_creative_health: {
    definition: getDefinition("meta_creative_health"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  meta_creative_diagnostics: {
    definition: getDefinition("meta_creative_diagnostics"),
    inputSchema: z.object({
      ad_id: z.string().uuid(),
      period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).strict().refine((input) => {
      const start = Date.parse(`${input.period_start}T00:00:00Z`);
      const end = Date.parse(`${input.period_end}T00:00:00Z`);
      return Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 90 * 24 * 60 * 60 * 1000 && end <= Date.now();
    }, { message: "El periodo debe ser válido, no futuro y de máximo 90 días" }),
    outputSchema: domainReadOutputSchema,
  },
  meta_delivery_health: {
    definition: getDefinition("meta_delivery_health"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  meta_change_log: {
    definition: getDefinition("meta_change_log"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  klaviyo_email_content: {
    definition: getDefinition("klaviyo_email_content"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  klaviyo_measurement_health: {
    definition: getDefinition("klaviyo_measurement_health"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  klaviyo_performance_summary: {
    definition: getDefinition("klaviyo_performance_summary"),
    inputSchema: z.object({
      period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).strict(),
    outputSchema: domainReadOutputSchema,
  },
  klaviyo_entity_performance: {
    definition: getDefinition("klaviyo_entity_performance"),
    inputSchema: z.object({
      period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      entity_type: z.enum(["campaign", "flow"]),
      entity_id: z.string().uuid(),
    }).strict(),
    outputSchema: domainReadOutputSchema,
  },
  klaviyo_deliverability_health: {
    definition: getDefinition("klaviyo_deliverability_health"),
    inputSchema: z.object({
      period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).strict(),
    outputSchema: domainReadOutputSchema,
  },
  shopify_fulfillment_health: {
    definition: getDefinition("shopify_fulfillment_health"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  shopify_delivery_diagnostics: {
    definition: getDefinition("shopify_delivery_diagnostics"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  shopify_open_delivery_exceptions: {
    definition: getDefinition("shopify_open_delivery_exceptions"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  meta_read_ad_accounts: {
    definition: getDefinition("meta_read_ad_accounts"),
    inputSchema: preparedConnectorReadInputSchema,
    outputSchema: paginatedReadOutputSchema,
  },
  meta_read_campaign_insights: {
    definition: getDefinition("meta_read_campaign_insights"),
    inputSchema: preparedConnectorReadInputSchema,
    outputSchema: paginatedReadOutputSchema,
  },
  instagram_read_media: {
    definition: getDefinition("instagram_read_media"),
    inputSchema: preparedConnectorReadInputSchema,
    outputSchema: paginatedReadOutputSchema,
  },
  instagram_read_insights: {
    definition: getDefinition("instagram_read_insights"),
    inputSchema: preparedConnectorReadInputSchema,
    outputSchema: paginatedReadOutputSchema,
  },
  request_missing_data: {
    definition: getDefinition("request_missing_data"),
    inputSchema: requestMissingDataInputSchema,
    outputSchema: requestMissingDataOutputSchema,
  },
  escalate_to_human: {
    definition: getDefinition("escalate_to_human"),
    inputSchema: escalateToHumanInputSchema,
    outputSchema: escalateToHumanOutputSchema,
  },
  flag_data_quality_issue: {
    definition: getDefinition("flag_data_quality_issue"),
    inputSchema: flagDataQualityInputSchema,
    outputSchema: flagDataQualityOutputSchema,
  },
  report_confidence: {
    definition: getDefinition("report_confidence"),
    inputSchema: reportConfidenceInputSchema,
    outputSchema: reportConfidenceOutputSchema,
  },
  dry_run_write: {
    definition: getDefinition("dry_run_write"),
    inputSchema: z
      .object({
        operation: z.string().min(1).max(120),
        target: z.string().min(1).max(500),
        changes: z.record(z.string(), z.unknown()),
        reason: z.string().min(1).max(2000),
      })
      .strict(),
    outputSchema: z
      .object({
        dry_run: z.literal(true),
        changed: z.literal(false),
        operation: z.string(),
        target: z.string(),
        changes: z.record(z.string(), z.unknown()),
        approval_required: z.literal(true),
        rollback_token: z.null(),
        provenance: provenanceSchema,
      })
      .or(z.object({ error: toolErrorSchema })),
  },
};

function getDefinition(name: string): ToolDefinition {
  const found = TOOL_REGISTRY.find((tool) => tool.name === name);
  if (!found) throw new Error(`Missing tool definition: ${name}`);
  return found;
}

export function getToolDefinition(name: string): ToolDefinition | null {
  return TOOL_REGISTRY.find((tool) => tool.name === name) ?? null;
}

export function getToolContract(name: string): ToolContract | null {
  return TOOL_CONTRACTS[name] ?? null;
}

/**
 * Devuelve las tools declaradas para una version pero que aun no tienen
 * executor operativo. El runtime puede informar al agente sin exponer una
 * capacidad que en realidad no puede ejecutar.
 */
export function getUnavailableToolNames(rawAllowedTools: unknown): string[] {
  if (!Array.isArray(rawAllowedTools)) return [];

  return rawAllowedTools.filter((name): name is string => {
    if (typeof name !== "string") return false;
    const definition = getToolDefinition(name);
    return Boolean(
      definition &&
        (definition.status === "planned" || definition.status === "disabled"),
    );
  });
}

const permissionRank: Record<ToolPermission, number> = {
  read: 1,
  propose: 2,
  write: 3,
  admin: 4,
};

export type ToolAuthorizationResult =
  | { allowed: true; definition: ToolDefinition }
  | { allowed: false; reason: ToolError };

export function authorizeTool(
  name: string,
  context: ToolContext,
  requestedPermission: ToolPermission = "read",
): ToolAuthorizationResult {
  const definition = getToolDefinition(name);
  if (!definition) {
    return {
      allowed: false,
      reason: {
        error: "tool_not_registered",
        why: `Tool ${name} no esta registrada`,
        how_to_fix: "Registrar la tool en TOOL_REGISTRY",
        retry_after: null,
      },
    };
  }
  if (definition.status !== "implemented_partial") {
    return {
      allowed: false,
      reason: {
        error: "tool_not_implemented",
        why: `Tool ${name} no tiene executor operativo`,
        how_to_fix: "Activar el adaptador y registrar sus capacidades",
        retry_after: null,
      },
    };
  }
  if (
    definition.connector &&
    !context.connected_connectors.includes(definition.connector)
  ) {
    return {
      allowed: false,
      reason: {
        error: "connector_not_connected",
        why: `El conector ${definition.connector} no esta conectado`,
        how_to_fix: "Conectar y autorizar el proveedor antes de usar esta tool",
        retry_after: null,
      },
    };
  }
  if (!context.allowed_tools.includes(name)) {
    return {
      allowed: false,
      reason: {
        error: "tool_not_allowed",
        why: "La version del agente no permite esta tool",
        how_to_fix: "Actualizar allowed_tools con una version aprobada",
        retry_after: null,
      },
    };
  }
  if (
    permissionRank[definition.permission] < permissionRank[requestedPermission]
  ) {
    return {
      allowed: false,
      reason: {
        error: "permission_escalation_denied",
        why: "La tool no concede el permiso solicitado",
        how_to_fix: "Usar el permiso declarado y pasar por aprobación",
        retry_after: null,
      },
    };
  }
  if (definition.requires_approval && context.approval_mode === "none") {
    return {
      allowed: false,
      reason: {
        error: "approval_required",
        why: "La acción requiere revisión humana",
        how_to_fix: "Crear una propuesta y solicitar aprobación",
        retry_after: null,
      },
    };
  }
  return { allowed: true, definition };
}
