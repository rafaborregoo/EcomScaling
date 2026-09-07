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
  freshness_seconds: z.number().nonnegative(),
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
  "shopify_demand_sources",
  "shopify_fulfillment_health",
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
  description: `EcomScaling tool ${name}`,
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
        "get_strategic_plan",
        "get_current_milestone",
        "list_open_tasks",
        "list_open_alerts",
        "get_task_history",
        "get_call_history",
        "get_financial_settings",
        "report_confidence",
        "shopify_customer_health",
        "shopify_demand_sources",
        "shopify_fulfillment_health",
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
  shopify_demand_sources: {
    definition: getDefinition("shopify_demand_sources"),
    inputSchema: emptyInputSchema,
    outputSchema: domainReadOutputSchema,
  },
  shopify_fulfillment_health: {
    definition: getDefinition("shopify_fulfillment_health"),
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
