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
    | "purge_overdue";
  summary: string;
  runbook: string;
  details: Record<string, unknown>;
};

export type OpsHealthCheckResult = {
  ok: true;
  checkedAt: string;
  findings: OpsHealthFinding[];
};

export async function runOpsHealthCheck(env: ApiEnv): Promise<OpsHealthCheckResult> {
  const client = createServiceClient(env);
  const now = Date.now();
  const findings: OpsHealthFinding[] = [];

  const { data: errorConnections, error: errorConnectionsError } = await client
    .from("integration_connections")
    .select("id, organization_id, provider, provider_account_id, last_error_message, updated_at")
    .eq("status", "error");
  if (errorConnectionsError) {
    throw new Error(`No se pudieron leer conexiones en error: ${errorConnectionsError.message}`);
  }
  for (const connection of errorConnections ?? []) {
    findings.push({
      type: "connection_error",
      summary: `Conexion ${connection.provider} (${connection.provider_account_id ?? connection.id}) en estado error`,
      runbook: "RB-001-shopify-sync-failed.md",
      details: connection,
    });
  }

  const { data: syncingConnections, error: syncingConnectionsError } = await client
    .from("integration_connections")
    .select("id, organization_id, provider, provider_account_id, updated_at")
    .eq("status", "syncing");
  if (syncingConnectionsError) {
    throw new Error(`No se pudieron leer conexiones en syncing: ${syncingConnectionsError.message}`);
  }
  for (const connection of syncingConnections ?? []) {
    const updatedAt = connection.updated_at ? new Date(connection.updated_at).getTime() : now;
    if (now - updatedAt > STUCK_SYNC_ALERT_MS) {
      findings.push({
        type: "connection_stuck_syncing",
        summary: `Conexion ${connection.provider} (${connection.provider_account_id ?? connection.id}) atascada en syncing desde hace mas de 2h`,
        runbook: "RB-001-shopify-sync-failed.md",
        details: connection,
      });
    }
  }

  const { data: failedRuns, error: failedRunsError } = await client
    .from("integration_sync_runs")
    .select("id, connection_id, organization_id, provider, sync_type, attempt_count, error_code, error_message, created_at")
    .eq("status", "failed")
    .gte("attempt_count", REPEATED_FAILURE_ATTEMPTS)
    .gte("created_at", new Date(now - REPEATED_FAILURE_WINDOW_MS).toISOString());
  if (failedRunsError) {
    throw new Error(`No se pudieron leer sync runs fallidos: ${failedRunsError.message}`);
  }
  for (const run of failedRuns ?? []) {
    findings.push({
      type: "sync_repeated_failure",
      summary: `Sync ${run.sync_type} de ${run.provider} fallo ${run.attempt_count} veces en las ultimas 24h`,
      runbook: "RB-001-shopify-sync-failed.md",
      details: run,
    });
  }

  const { data: expiringCredentials, error: expiringCredentialsError } = await client
    .schema("private")
    .from("integration_credentials")
    .select("id, connection_id, credential_kind, expires_at")
    .not("expires_at", "is", null)
    .lte("expires_at", new Date(now + TOKEN_EXPIRY_WARNING_MS).toISOString());
  if (expiringCredentialsError) {
    throw new Error(`No se pudieron leer credenciales por expirar: ${expiringCredentialsError.message}`);
  }
  for (const credential of expiringCredentials ?? []) {
    const alreadyExpired = credential.expires_at && new Date(credential.expires_at).getTime() <= now;
    findings.push({
      type: "token_expiring_soon",
      summary: alreadyExpired
        ? `Credencial ${credential.credential_kind} de la conexion ${credential.connection_id} ya expiro`
        : `Credencial ${credential.credential_kind} de la conexion ${credential.connection_id} expira en menos de 24h`,
      runbook: "RB-002-oauth-token-expired.md",
      details: credential,
    });
  }

  const { data: budgetRuns, error: budgetRunsError } = await client
    .from("agent_runs")
    .select("id, organization_id, agent_version_id, trigger_type, estimated_cost_usd, started_at")
    .eq("status", "budget_exceeded")
    .gte("started_at", new Date(now - COST_SPIKE_WINDOW_MS).toISOString());
  if (budgetRunsError) {
    throw new Error(`No se pudieron leer runs de agentes con presupuesto excedido: ${budgetRunsError.message}`);
  }
  for (const run of budgetRuns ?? []) {
    findings.push({
      type: "ai_budget_exceeded",
      summary: `Run de agente ${run.agent_version_id} corto por presupuesto excedido (org ${run.organization_id})`,
      runbook: "RB-006-ai-cost-spike.md",
      details: run,
    });
  }

  const { data: overdueOrganizations, error: overdueOrganizationsError } = await client
    .from("organizations")
    .select("id, display_name, scheduled_purge_at")
    .eq("status", "pending_deletion")
    .lte("scheduled_purge_at", new Date(now - PURGE_OVERDUE_MS).toISOString());
  if (overdueOrganizationsError) {
    throw new Error(`No se pudieron leer organizaciones pendientes de purga: ${overdueOrganizationsError.message}`);
  }
  for (const organization of overdueOrganizations ?? []) {
    findings.push({
      type: "purge_overdue",
      summary: `Organizacion ${organization.display_name} lleva mas de 2 dias pasada su fecha de purga sin borrarse`,
      runbook: "RB-008-purge-failed.md",
      details: organization,
    });
  }

  const { data: overdueConnections, error: overdueConnectionsError } = await client
    .from("integration_connections")
    .select("id, organization_id, provider, scheduled_purge_at")
    .eq("status", "pending_deletion")
    .lte("scheduled_purge_at", new Date(now - PURGE_OVERDUE_MS).toISOString());
  if (overdueConnectionsError) {
    throw new Error(`No se pudieron leer conexiones pendientes de purga: ${overdueConnectionsError.message}`);
  }
  for (const connection of overdueConnections ?? []) {
    findings.push({
      type: "purge_overdue",
      summary: `Conexion ${connection.provider} (org ${connection.organization_id}) lleva mas de 2 dias pasada su fecha de purga sin borrarse`,
      runbook: "RB-008-purge-failed.md",
      details: connection,
    });
  }

  return { ok: true, checkedAt: new Date(now).toISOString(), findings };
}
