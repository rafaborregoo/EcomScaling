/**
 * SQO-02 (R-014, OPS-01 criterio "alertas operativas"): hasta ahora los
 * logs estructurados existian pero nada avisaba activamente cuando algo se
 * rompia -- diagnosticar un fallo dependia de que alguien mirara Supabase a
 * mano. Este chequeo agrega las senales que ya usan los runbooks manuales
 * (RB-001 sync fallido, RB-002 token expirado, RB-006 coste IA disparado) en
 * un unico resultado consumible por un cron (ver
 * `apps/worker/src/ops-health-check-once.ts` y
 * `.github/workflows/ops-health-check.yml`).
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  redactSensitive,
  redactSensitiveText,
} from "@ecomscaling/observability";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

// RB-001: SEV-2 si una tienda lleva datos parados >2h.
const STUCK_SYNC_ALERT_MS = 2 * 60 * 60 * 1000;
// Un sync que ya reintento 3+ veces y sigue fallando no se va a arreglar solo
// con el siguiente pase de reconciliacion horaria.
const REPEATED_FAILURE_ATTEMPTS = 3;
const REPEATED_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;
// RB-002: avisar antes de que el token expire, no despues.
const TOKEN_EXPIRY_WARNING_MS = 24 * 60 * 60 * 1000;
const COST_SPIKE_WINDOW_MS = 24 * 60 * 60 * 1000;
// R-008: el cron de purga corre a diario; 2 dias de margen antes de alertar
// evita ruido por el timing normal del cron, pero detecta si vuelve a
// fallar en silencio (ver bug real corregido 2026-07-22 en
// log_financial_change()/purgeExpiredDeletions).
const PURGE_OVERDUE_MS = 2 * 24 * 60 * 60 * 1000;
// RB-004 (Prevencion, gap real cerrado 2026-07-29): mismo umbral que la
// consulta manual documentada en el runbook -- webhooks atascados en
// `received` mas de 30 minutos no tenian ninguna alerta proactiva, solo se
// detectaban corriendo la consulta a mano o porque el cliente reportaba
// datos desactualizados.
const WEBHOOK_BACKLOG_MS = 30 * 60 * 1000;
const WEBHOOK_BACKLOG_ROW_LIMIT = 500;
const MAX_FINDING_SUMMARY_LENGTH = 500;
const MAX_FINDING_DETAIL_STRING_LENGTH = 2_000;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

export type OpsHealthFinding = {
  type:
    | "connection_error"
    | "connection_stuck_syncing"
    | "sync_repeated_failure"
    | "token_expiring_soon"
    | "ai_budget_exceeded"
    | "purge_overdue"
    | "webhook_backlog";
  summary: string;
  runbook: string;
  details: Record<string, unknown>;
};

export type OpsHealthCheckResult = {
  ok: true;
  checkedAt: string;
  findings: OpsHealthFinding[];
};

/**
 * Findings are written to a GitHub artifact and may be copied into an issue.
 * Keep the useful identifiers while removing credential-shaped keys and
 * tokens embedded in provider/database error strings.
 */
export function sanitizeOpsHealthDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  const redacted = redactSensitive(details);

  function sanitize(value: unknown): unknown {
    if (typeof value === "string") {
      const sanitized = redactSensitiveText(value);
      return sanitized.length > MAX_FINDING_DETAIL_STRING_LENGTH
        ? `${sanitized.slice(0, MAX_FINDING_DETAIL_STRING_LENGTH)}...[truncated]`
        : sanitized;
    }
    if (Array.isArray(value)) {
      return value.map((item) => sanitize(item));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, sanitize(item)]),
      );
    }
    return value;
  }

  return sanitize(redacted) as Record<string, unknown>;
}

function finding(
  value: Omit<OpsHealthFinding, "details"> & {
    details: Record<string, unknown>;
  },
): OpsHealthFinding {
  return {
    ...value,
    summary:
      value.summary.length > MAX_FINDING_SUMMARY_LENGTH
        ? `${value.summary.slice(0, MAX_FINDING_SUMMARY_LENGTH)}...[truncated]`
        : value.summary,
    details: sanitizeOpsHealthDetails(value.details),
  };
}

export async function runOpsHealthCheck(
  env: ApiEnv,
): Promise<OpsHealthCheckResult> {
  const client = createServiceClient(env);
  const now = Date.now();
  const findings: OpsHealthFinding[] = [];

  const [
    errorConnectionsResult,
    syncingConnectionsResult,
    failedRunsResult,
  ] = await Promise.all([
    client
      .from("integration_connections")
      .select(
        "id, organization_id, provider, provider_account_id, last_error_message, updated_at",
      )
      .eq("status", "error"),
    client
      .from("integration_connections")
      .select("id, organization_id, provider, provider_account_id, updated_at")
      .eq("status", "syncing"),
    client
      .from("integration_sync_runs")
      .select(
        "id, connection_id, organization_id, provider, sync_type, attempt_count, error_code, error_message, created_at",
      )
      .eq("status", "failed")
      .gte("attempt_count", REPEATED_FAILURE_ATTEMPTS)
      .gte(
        "created_at",
        new Date(now - REPEATED_FAILURE_WINDOW_MS).toISOString(),
      ),
  ]);
  const { data: errorConnections, error: errorConnectionsError } =
    errorConnectionsResult;
  if (errorConnectionsError) {
    throw new Error(
      `No se pudieron leer conexiones en error: ${errorConnectionsError.message}`,
    );
  }
  for (const connection of errorConnections ?? []) {
    findings.push(
      finding({
        type: "connection_error",
        summary: `Conexion ${connection.provider} (${connection.provider_account_id ?? connection.id}) en estado error`,
        runbook: "RB-001-shopify-sync-failed.md",
        details: connection,
      }),
    );
  }

  const { data: syncingConnections, error: syncingConnectionsError } =
    syncingConnectionsResult;
  if (syncingConnectionsError) {
    throw new Error(
      `No se pudieron leer conexiones en syncing: ${syncingConnectionsError.message}`,
    );
  }
  for (const connection of syncingConnections ?? []) {
    const updatedAt = connection.updated_at
      ? new Date(connection.updated_at).getTime()
      : now;
    if (now - updatedAt > STUCK_SYNC_ALERT_MS) {
      findings.push(
        finding({
          type: "connection_stuck_syncing",
          summary: `Conexion ${connection.provider} (${connection.provider_account_id ?? connection.id}) atascada en syncing desde hace mas de 2h`,
          runbook: "RB-001-shopify-sync-failed.md",
          details: connection,
        }),
      );
    }
  }

  const { data: failedRuns, error: failedRunsError } = failedRunsResult;
  if (failedRunsError) {
    throw new Error(
      `No se pudieron leer sync runs fallidos: ${failedRunsError.message}`,
    );
  }
  for (const run of failedRuns ?? []) {
    findings.push(
      finding({
        type: "sync_repeated_failure",
        summary: `Sync ${run.sync_type} de ${run.provider} fallo ${run.attempt_count} veces en las ultimas 24h`,
        runbook: "RB-001-shopify-sync-failed.md",
        details: run,
      }),
    );
  }

  const [
    expiringCredentialsResult,
    budgetRunsResult,
    overdueOrganizationsResult,
    overdueConnectionsResult,
    stuckWebhooksResult,
  ] = await Promise.all([
    client
      .schema("private")
      .from("integration_credentials")
      .select("id, connection_id, credential_kind, expires_at")
      .not("expires_at", "is", null)
      .lte("expires_at", new Date(now + TOKEN_EXPIRY_WARNING_MS).toISOString()),
    client
      .from("agent_runs")
      .select(
        "id, organization_id, agent_version_id, trigger_type, estimated_cost_usd, started_at",
      )
      .eq("status", "budget_exceeded")
      .gte("started_at", new Date(now - COST_SPIKE_WINDOW_MS).toISOString()),
    client
      .from("organizations")
      .select("id, display_name, scheduled_purge_at")
      .eq("status", "pending_deletion")
      .lte(
        "scheduled_purge_at",
        new Date(now - PURGE_OVERDUE_MS).toISOString(),
      ),
    client
      .from("integration_connections")
      .select("id, organization_id, provider, scheduled_purge_at")
      .eq("status", "pending_deletion")
      .lte(
        "scheduled_purge_at",
        new Date(now - PURGE_OVERDUE_MS).toISOString(),
      ),
    client
      .schema("private")
      .from("webhook_events")
      .select("connection_id, organization_id, provider, received_at")
      .eq("status", "received")
      .lt("received_at", new Date(now - WEBHOOK_BACKLOG_MS).toISOString())
      .order("received_at", { ascending: true })
      .limit(WEBHOOK_BACKLOG_ROW_LIMIT),
  ]);
  const { data: expiringCredentials, error: expiringCredentialsError } =
    expiringCredentialsResult;
  if (expiringCredentialsError) {
    throw new Error(
      `No se pudieron leer credenciales por expirar: ${expiringCredentialsError.message}`,
    );
  }
  for (const credential of expiringCredentials ?? []) {
    const alreadyExpired =
      credential.expires_at && new Date(credential.expires_at).getTime() <= now;
    findings.push(
      finding({
        type: "token_expiring_soon",
        summary: alreadyExpired
          ? `Credencial ${credential.credential_kind} de la conexion ${credential.connection_id} ya expiro`
          : `Credencial ${credential.credential_kind} de la conexion ${credential.connection_id} expira en menos de 24h`,
        runbook: "RB-002-oauth-token-expired.md",
        details: credential,
      }),
    );
  }

  const { data: budgetRuns, error: budgetRunsError } = budgetRunsResult;
  if (budgetRunsError) {
    throw new Error(
      `No se pudieron leer runs de agentes con presupuesto excedido: ${budgetRunsError.message}`,
    );
  }
  for (const run of budgetRuns ?? []) {
    findings.push(
      finding({
        type: "ai_budget_exceeded",
        summary: `Run de agente ${run.agent_version_id} corto por presupuesto excedido (org ${run.organization_id})`,
        runbook: "RB-006-ai-cost-spike.md",
        details: run,
      }),
    );
  }

  const { data: overdueOrganizations, error: overdueOrganizationsError } =
    overdueOrganizationsResult;
  if (overdueOrganizationsError) {
    throw new Error(
      `No se pudieron leer organizaciones pendientes de purga: ${overdueOrganizationsError.message}`,
    );
  }
  for (const organization of overdueOrganizations ?? []) {
    findings.push(
      finding({
        type: "purge_overdue",
        summary: `Organizacion ${organization.display_name} lleva mas de 2 dias pasada su fecha de purga sin borrarse`,
        runbook: "RB-008-purge-failed.md",
        details: organization,
      }),
    );
  }

  const { data: overdueConnections, error: overdueConnectionsError } =
    overdueConnectionsResult;
  if (overdueConnectionsError) {
    throw new Error(
      `No se pudieron leer conexiones pendientes de purga: ${overdueConnectionsError.message}`,
    );
  }
  for (const connection of overdueConnections ?? []) {
    findings.push(
      finding({
        type: "purge_overdue",
        summary: `Conexion ${connection.provider} (org ${connection.organization_id}) lleva mas de 2 dias pasada su fecha de purga sin borrarse`,
        runbook: "RB-008-purge-failed.md",
        details: connection,
      }),
    );
  }

  const { data: stuckWebhooks, error: stuckWebhooksError } = stuckWebhooksResult;
  if (stuckWebhooksError) {
    throw new Error(
      `No se pudieron leer webhooks atascados: ${stuckWebhooksError.message}`,
    );
  }
  const backlogByConnection = new Map<
    string,
    {
      connectionId: string | null;
      organizationId: string | null;
      provider: string;
      count: number;
      oldestReceivedAt: string;
    }
  >();
  for (const row of stuckWebhooks ?? []) {
    const key =
      row.connection_id ??
      `no-connection:${row.organization_id}:${row.provider}`;
    const existing = backlogByConnection.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      backlogByConnection.set(key, {
        connectionId: row.connection_id,
        organizationId: row.organization_id,
        provider: row.provider,
        count: 1,
        oldestReceivedAt: row.received_at,
      });
    }
  }
  for (const backlog of backlogByConnection.values()) {
    findings.push(
      finding({
        type: "webhook_backlog",
        summary: `${backlog.count} webhook(s) de ${backlog.provider} atascados en 'received' desde hace mas de 30 min (conexion ${backlog.connectionId ?? "desconocida"})`,
        runbook: "RB-004-webhook-duplicate-backlog.md",
        details: backlog,
      }),
    );
  }

  return { ok: true, checkedAt: new Date(now).toISOString(), findings };
}
