import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

// BE-00: liveness (proceso arriba, sin tocar dependencias -- lo que decide si
// un orquestador debe reiniciar el proceso) separado de readiness (puede
// servir trafico de verdad -- lo que decide si debe recibir requests). Antes
// `/health` mezclaba ambos conceptos en un unico endpoint plano sin checks.
export const readinessCheckStatusSchema = z.enum(["ok", "error", "not_configured"]);

export const readinessResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.string().min(1),
  timestamp: z.string().datetime(),
  checks: z.object({
    supabase: readinessCheckStatusSchema,
    redis: readinessCheckStatusSchema,
  }),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;

// FE-02: catalogo cerrado de la banda de avisos superior del dashboard (antes
// el campo `type` era `string` libre en ambos lados -- backend y frontend
// podian desincronizarse sin que TypeScript lo detectara). Anadir un tipo
// nuevo de aviso significa anadirlo aqui primero, no solo en el string que
// arma apps/api/src/actions.ts.
export const ACCOUNT_ACTION_TYPES = [
  "integration_error",
  "shopify_reauthorization_required",
] as const;

export type AccountActionType = (typeof ACCOUNT_ACTION_TYPES)[number];

export const accountActionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(ACCOUNT_ACTION_TYPES),
  severity: z.enum(["info", "warning", "error"]),
  organization_id: z.string(),
  organization_name: z.string().nullable(),
  provider: z.string(),
  title: z.string(),
  message: z.string(),
  cta_label: z.string(),
  cta_href: z.string(),
  missing_scopes: z.array(z.string()).optional(),
});

export type AccountAction = z.infer<typeof accountActionSchema>;

// AI-10: envolvente comun para que el frontend no tenga que inferir alcance,
// frescura o trazabilidad a partir de shapes distintos por agente.
export type AgentRunStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "rejected_output"
  | "budget_exceeded";

/** AI-10: nombres de producto y estado real, separados del codigo de runtime. */
export type AgentCatalogEntry = {
  code: string;
  displayName: string;
  description: string;
  status: "implemented" | "prepared";
};

export const AGENT_CATALOG: readonly AgentCatalogEntry[] = [
  { code: "a01_analista_llamadas", displayName: "Resumen de llamada", description: "Resumen y acciones propuestas desde transcripciones revisadas.", status: "implemented" },
  { code: "a02_monitor_negocio", displayName: "Diagnóstico del negocio", description: "Diagnóstico con fuentes y límites explícitos.", status: "implemented" },
  { code: "a03_analista_adquisicion", displayName: "Análisis de adquisición", description: "Preparado para Meta Ads; no operativo sin conexión.", status: "prepared" },
  { code: "a04_generador_tareas", displayName: "Plan de prioridades", description: "Propone tareas desde señales Shopify verificadas.", status: "implemented" },
  { code: "a05_estrategia_campanas", displayName: "Estrategia de campañas", description: "Preparado para campañas futuras; no operativo sin conector.", status: "prepared" },
  { code: "a06_planificador_stock", displayName: "Planificación de stock", description: "Detecta riesgos de inventario con propuestas revisables.", status: "implemented" },
  { code: "a07_rendimiento_contenido", displayName: "Rendimiento de contenido", description: "Preparado para métricas futuras de contenido e Instagram.", status: "prepared" },
  { code: "a08_gestor_conocimiento", displayName: "Estado del conocimiento", description: "Revisa cobertura y calidad sin inventar documentos.", status: "implemented" },
  { code: "a09_copiloto_consultor", displayName: "Copiloto", description: "Responde con alcance tenant-bound y lectura controlada.", status: "implemented" },
  { code: "a11_generador_marketing", displayName: "Borradores de marketing", description: "Contenido portable para revisión; no publica ni envía.", status: "implemented" },
];

export function getAgentCatalogEntry(agentCode: string) {
  return AGENT_CATALOG.find((entry) => entry.code === agentCode) ?? null;
}

export type AgentSourceReference = {
  id: string;
  kind: "metric" | "sql_result" | "document" | "transcript" | "alert" | "task" | "integration";
  label: string;
  organizationId: string;
  storeId?: string;
  period?: { from: string; to: string };
  generatedAt?: string;
  location?: {
    page?: number;
    section?: string;
    paragraph?: number;
    timestampStart?: number;
    timestampEnd?: number;
  };
  href?: string;
};

export type AgentProposal = {
  id: string;
  type: "create_task" | "update_task" | "publish_summary" | "create_alert" | "update_plan" | "request_reauthorization";
  title: string;
  explanation: string;
  target: { entityType: string; entityId?: string };
  impact?: { severity: "low" | "medium" | "high" | "critical"; reversible: boolean };
  approval: { required: boolean; allowedRoles: string[] };
  idempotencyKey: string;
  status: "proposed" | "pending_approval" | "approved" | "rejected" | "executing" | "executed" | "failed" | "expired" | "superseded";
};

export type AgentOutputEnvelope<TContent> = {
  run: {
    id: string;
    agentCode: string;
    agentVersion?: string;
    status: AgentRunStatus;
    generatedAt: string;
    completedAt?: string;
    fromCache: boolean;
  };
  scope: {
    organizationId: string;
    storeId?: string;
    period?: { from: string; to: string; timezone: string };
  };
  freshness: {
    status: "fresh" | "stale" | "superseded";
    reason?: string;
    validUntil?: string;
  };
  quality: {
    confidence: "low" | "medium" | "high";
    groundedness: "verified" | "partially_supported" | "insufficient_evidence";
    dataCompleteness: "complete" | "partial" | "insufficient";
    warnings: string[];
  };
  sources: AgentSourceReference[];
  content: TContent;
  proposals: AgentProposal[];
};

/**
 * Permisos de Shopify que pide la app, con lo que desbloquea cada uno.
 *
 * Vive aqui y no en apps/api porque la interfaz tiene que poder decirle a la
 * persona que se pierde sin un permiso (leyendo `connection.scopes`) con el
 * mismo texto que usa el backend al fallar. Dos copias del mismo catalogo se
 * desincronizan siempre.
 */
export type ShopifyScopeInfo = {
  scope: string;
  /** Que deja de funcionar sin el, en lenguaje de la persona. */
  label: string;
  /** `false` = el modulo sigue, con menos alcance, y hay que avisarlo. */
  required: boolean;
  /** Solo para los que Shopify no concede sin tramite aparte. */
  note?: string;
};

export const SHOPIFY_SCOPES_USED: readonly ShopifyScopeInfo[] = [
  { scope: "read_orders", label: "Pedidos", required: true },
  { scope: "read_products", label: "Productos y variantes", required: true },
  { scope: "read_inventory", label: "Inventario", required: true },
  { scope: "read_locations", label: "Ubicaciones de stock", required: true },
  { scope: "read_customers", label: "Clientes y cohortes", required: true },
  {
    scope: "read_all_orders",
    label: "Histórico de pedidos de más de 60 días",
    required: false,
    note: "Shopify solo lo concede con la Access request aprobada en el Partner Dashboard. Sin él, la tienda se ve desde hace 60 días.",
  },
  {
    scope: "read_returns",
    label: "Devoluciones",
    required: false,
    note: "Sin él, las devoluciones no restan en los márgenes.",
  },
  {
    scope: "read_reports",
    label: "Sesiones y analítica",
    required: false,
    note: "Sin él no hay tasa de conversión: el sync de sesiones se salta solo.",
  },
];

export function shopifyScopeInfo(scope: string): ShopifyScopeInfo | null {
  return SHOPIFY_SCOPES_USED.find((item) => item.scope === scope) ?? null;
}

// FASE 3 / D00: contrato de diagnostico e invariantes del motor.
export * from "./diagnostics.js";

// FASE 3 / D01: calidad y fiabilidad de los datos, y la puerta antes de D00.
export * from "./data-quality.js";

// FASE 3 / D02: contextualizacion y limites de comparabilidad.
export * from "./context.js";

// FASE 3 / D03: madurez por capacidad y sus invariantes estructurales.
export * from "./maturity.js";

// FASE 3 / D04: salud por capacidad, separada de la madurez de D03.
export * from "./health.js";

// FASE 3 / D05: motor de senales, sus invariantes y el detector puro.
export * from "./signals.js";

// FASE 3 / D06: motor de sintomas, la frontera entre senal e interpretacion.
export * from "./symptoms.js";

// FASE 3 / D07: grafo causal, rutas plausibles y la jerarquia de evidencia.
export * from "./causal.js";

// FASE 3 / D08: motor de hipotesis, tests diagnosticos y contraste.
export * from "./hypotheses.js";

// FASE 3 / D09: causa raiz y constraints, las dos preguntas que no son la misma.
export * from "./root-cause.js";

// FASE 3 / D10: severidad e impacto, y las tres cosas que no tienen columna aqui.
export * from "./severity.js";

// FASE 3 / D11: confianza e incertidumbre, el bloque que audita a los diez anteriores.
export * from "./confidence.js";

// FASE 3 / D12: la capa adversarial, confusores y falsos diagnosticos.
export * from "./adversarial.js";

// FASE 3 / D13: la capa temporal, estado frente a trayectoria.
export * from "./temporal.js";

// Un intento de autorizacion OAuth a medias no es una tienda: la comparten el
// cron que los purga y la interfaz que los distingue de una conexion rota.
export * from "./authorization-attempt.js";

// FASE 3 / D14: la salida diagnostica, su validacion y el lenguaje calibrado.
export * from "./output.js";

// FASE 4 / P00: contrato raíz de ejecución, validez, unknowns y trazabilidad.
export * from "./prioritization.js";
export * from "./decision-context.js";
export * from "./temporal-urgency.js";
export * from "./impact.js";
export * from "./constraints.js";
export * from "./feasibility.js";
export * from "./risk.js";
export * from "./allocation.js";
export * from "./strategic-fit.js";
export * from "./ranking.js";
export * from "./portfolio.js";
export * from "./decision-output.js";

// FASE 5 / 5.00: contrato universal de playbooks, aplicabilidad y trazabilidad.
export * from "./playbook.js";

// FASE 5 / 5.01: extensión acotada para adquisición, demanda y fit de canal.
export * from "./acquisition.js";
