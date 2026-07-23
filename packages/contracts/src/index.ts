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
