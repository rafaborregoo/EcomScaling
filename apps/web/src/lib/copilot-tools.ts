// Lo que el Consultor IA enseña de su trabajo: qué herramienta usa y para qué,
// y los comandos con "/" que convierten un atajo en una pregunta completa.

/** Para qué sirve cada herramienta, en palabras del consultor. */
export const COPILOT_TOOL_LABELS: Record<string, string> = {
  sql_select: "Consulta de lectura sobre los datos",
  search_knowledge: "Metodología de Conocimiento",
  data_coverage: "Qué datos hay y de qué fechas",
  describe_schema: "Estructura de los datos",
  get_budget_status: "Saldo de IA",
  generate_report: "Informe PDF con plantilla",
  report_confidence: "Confianza del informe",
  get_organization_profile: "Perfil del cliente",
  get_brand_profile: "Marca del cliente",
  get_strategic_plan: "Plan y fase actual",
  get_current_milestone: "Hito en curso",
  list_open_tasks: "Tareas abiertas",
  list_open_alerts: "Alertas abiertas",
  get_task_history: "Historial de tareas",
  get_call_history: "Llamadas y compromisos",
  get_financial_settings: "Costes y márgenes configurados",
  shopify_customer_health: "¿Vuelven los clientes?",
  shopify_product_repurchase_health: "Recompra por producto",
  shopify_demand_sources: "De dónde viene la demanda",
  shopify_fulfillment_health: "Tiempos de preparación",
  shopify_delivery_diagnostics: "Entregas lentas o fallidas",
  shopify_open_delivery_exceptions: "Incidencias de entrega abiertas",
  shopify_return_delay_comparison: "Devoluciones frente a retrasos",
  shopify_funnel_health: "Dónde se cae la conversión",
  shopify_margin_health: "Qué se come el margen",
  get_shopify_product_catalog: "Catálogo, precios y stock",
  meta_read_ad_accounts: "Cuentas publicitarias de Meta",
  meta_read_campaign_insights: "Resultados de campañas de Meta",
  meta_creative_health: "Rendimiento de creatividades",
  meta_creative_diagnostics: "Por qué cae un anuncio",
  meta_delivery_health: "Entrega y CTR en Meta",
  meta_change_log: "Qué cambió en Meta y cuándo",
  meta_spend_detail: "Gasto por campaña y día",
  instagram_read_media: "Publicaciones de Instagram",
  instagram_read_insights: "Métricas de Instagram",
  klaviyo_email_content: "Asunto y cuerpo de emails",
  klaviyo_measurement_health: "¿Se puede medir Klaviyo?",
  klaviyo_performance_summary: "Ingresos atribuidos por Klaviyo",
  klaviyo_entity_performance: "Rendimiento de un email o flow",
  klaviyo_deliverability_health: "Entregabilidad",
  search_internal_email_design_playbook: "Guía interna de diseño de emails",
  web_search: "Búsqueda web",
  unknown_tool: "Herramienta no disponible",
};

export function copilotToolLabel(name: string) {
  return COPILOT_TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

export type CopilotCommand = {
  command: string;
  hint: string;
  /** Pregunta que se envía; `{rest}` es lo que se escribió tras el comando. */
  template: string;
};

export const COPILOT_COMMANDS: CopilotCommand[] = [
  {
    command: "/informe",
    hint: "Genera un PDF con una plantilla de informe",
    template: "Genera un informe PDF con la plantilla que mejor encaje. {rest}",
  },
  {
    command: "/comparar",
    hint: "Compara dos periodos de la misma métrica",
    template: "Compara este periodo con el anterior y dime qué cambió y qué dato lo respalda. {rest}",
  },
  {
    command: "/embudo",
    hint: "Dónde se pierde la conversión",
    template: "¿En qué paso del embudo se pierde la conversión y qué haría primero? {rest}",
  },
  {
    command: "/margen",
    hint: "Qué partida se come el margen",
    template: "¿Qué partida reduce más el margen y qué propones para recuperarlo? {rest}",
  },
  {
    command: "/campañas",
    hint: "Meta y Klaviyo, sin sumar atribución",
    template: "Resume el rendimiento de Meta y Klaviyo, cada plataforma con su propia atribución. {rest}",
  },
  {
    command: "/tareas",
    hint: "Revisa las tareas abiertas contra los datos",
    template: "De las tareas abiertas, ¿cuáles mueven la aguja y cuáles ya no tienen sentido con los datos? {rest}",
  },
];

/** "/informe de septiembre" → pregunta completa. Sin comando, el texto tal cual. */
export function expandCopilotCommand(text: string) {
  const match = /^(\/\S+)\s*([\s\S]*)$/.exec(text.trim());
  if (!match) return text.trim();
  const command = COPILOT_COMMANDS.find(
    (entry) => entry.command === match[1]!.toLocaleLowerCase(),
  );
  if (!command) return text.trim();
  return command.template.replace("{rest}", match[2]!.trim()).trim();
}

export function matchingCopilotCommands(text: string) {
  const match = /^\/(\S*)$/.exec(text);
  if (!match) return [];
  const prefix = `/${match[1]!.toLocaleLowerCase()}`;
  return COPILOT_COMMANDS.filter((entry) => entry.command.startsWith(prefix));
}
