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
  type HttpSloReport,
} from "@e-nora/observability";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  // SQO-02: opcionales -- sin una API desplegada y su secreto interno, el
  // chequeo de SLO simplemente se omite en vez de fallar (mismo criterio de
  // "preparado, no conectado" que el resto de la cola).
  API_BASE_URL?: string;
  INTERNAL_API_SECRET?: string;
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
const WEBHOOK_BACKLOG_MS = 2 * 60 * 1000;
const WEBHOOK_BACKLOG_ROW_LIMIT = 500;
const MAX_FINDING_SUMMARY_LENGTH = 500;
const MAX_FINDING_DETAIL_STRING_LENGTH = 2_000;
// SQO-02: no dejar el chequeo colgado si la instancia desplegada esta caida.
const HTTP_SLO_FETCH_TIMEOUT_MS = 5_000;

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
    | "webhook_backlog"
    | "http_slo_degraded"
    | "http_slo_check_failed";
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

/** Continuous integration checks only; the wider ops/cost audit remains opt-in. */
export async function runIntegrationHealthMonitor(env: ApiEnv): Promise<OpsHealthCheckResult> {
  const client = createServiceClient(env);
  const now = Date.now();
  const results = await Promise.all([
    client.from("integration_connections").select("id,organization_id,provider,status,updated_at,last_error_message")
      .in("provider", ["shopify", "meta_ads", "klaviyo"]).in("status", ["error", "syncing"])
      .not("provider_account_id", "like", "pending:%").limit(500),
    client.schema("private").from("webhook_events").select("connection_id,organization_id,provider,received_at,status,retry_count")
      .in("provider", ["shopify", "klaviyo"]).in("status", ["received", "queued", "processing", "failed"])
      .lt("received_at", new Date(now - WEBHOOK_BACKLOG_MS).toISOString()).order("received_at").limit(500),
  ]);
  for (const result of results) if (result.error) throw new Error(`integration_health_read_failed:${result.error.message}`);
  const findings: OpsHealthFinding[] = [];
  for (const connection of results[0].data ?? []) {
    if (connection.status === "syncing" && Date.parse(connection.updated_at) > now - 3_600_000) continue;
    findings.push(finding({ type: connection.status === "error" ? "connection_error" : "connection_stuck_syncing",
      summary: `Integración ${connection.provider}: ${connection.status === "error" ? "requiere atención" : "sincronización interrumpida"}`,
      runbook: "RB-001-shopify-sync-failed.md", details: connection }));
  }
  const grouped = new Map<string, { connection_id: string | null; provider: string; count: number; exhausted: number; oldest_received_at: string }>();
  for (const event of results[1].data ?? []) {
    const key = event.connection_id ?? event.provider;
    const current = grouped.get(key) ?? { connection_id: event.connection_id, provider: event.provider, count: 0, exhausted: 0, oldest_received_at: event.received_at };
    current.count++;
    if (event.retry_count >= 16) current.exhausted++;
    grouped.set(key, current);
  }
  for (const backlog of grouped.values()) findings.push(finding({ type: "webhook_backlog",
    summary: `${backlog.provider}: ${backlog.count} eventos pendientes, ${backlog.exhausted} con reintentos agotados`,
    runbook: "RB-004-webhook-duplicate-backlog.md", details: backlog }));
  return { ok: true, checkedAt: new Date(now).toISOString(), findings };
}

/**
 * SQO-02: lee el SLO HTTP de una instancia de la API ya desplegada. Sin
 * `API_BASE_URL`/`INTERNAL_API_SECRET` configurados no hay nada que consultar
 * todavia -- se omite en silencio en vez de tratarlo como fallo. Con ambos
 * configurados, un fallo de red o una respuesta invalida SI es un finding
 * (la propia observabilidad esta rota), separado del SLO realmente incumplido.
 */
export async function checkHttpSlo(
  env: Pick<ApiEnv, "API_BASE_URL" | "INTERNAL_API_SECRET">,
  fetchImpl: typeof fetch = fetch,
): Promise<OpsHealthFinding[]> {
  if (!env.API_BASE_URL || !env.INTERNAL_API_SECRET) return [];

  const url = new URL("/health/slo", env.API_BASE_URL).toString();
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { "x-internal-secret": env.INTERNAL_API_SECRET },
      signal: AbortSignal.timeout(HTTP_SLO_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    return [
      finding({
        type: "http_slo_check_failed",
        summary: `No se pudo consultar /health/slo en ${env.API_BASE_URL}`,
        runbook: "RB-011-http-slo-degraded.md",
        details: {
          error: error instanceof Error ? error.message : "unknown_error",
        },
      }),
    ];
  }

  if (!response.ok) {
    return [
      finding({
        type: "http_slo_check_failed",
        summary: `/health/slo respondio ${response.status} en ${env.API_BASE_URL}`,
        runbook: "RB-011-http-slo-degraded.md",
        details: { status: response.status },
      }),
    ];
  }

  const report = (await response.json()) as HttpSloReport;
  if (report.status !== "degraded" && report.status !== "critical") return [];

  return [
    finding({
      type: "http_slo_degraded",
      summary: `SLO HTTP en estado ${report.status}: error rate ${(report.errorRate * 100).toFixed(2)}%, p95 ${report.p95LatencyMs ?? "desconocido"}ms`,
      runbook: "RB-011-http-slo-degraded.md",
      details: report,
    }),
  ];
}

export async function runOpsHealthCheck(
  env: ApiEnv,
): Promise<OpsHealthCheckResult> {
  const client = createServiceClient(env);
  const now = Date.now();
  const findings: OpsHealthFinding[] = [];
  // Independiente de Supabase: se dispara ya para correr en paralelo con el
  // resto de las consultas de abajo.
  const httpSloFindingsPromise = checkHttpSlo(env);

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
      .in("status", ["received", "queued", "processing", "failed"])
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
        summary: `${backlog.count} webhook(s) de ${backlog.provider} pendientes desde hace mas de 2 min (conexion ${backlog.connectionId ?? "desconocida"})`,
        runbook: "RB-004-webhook-duplicate-backlog.md",
        details: backlog,
      }),
    );
  }

  findings.push(...(await httpSloFindingsPromise));

  return { ok: true, checkedAt: new Date(now).toISOString(), findings };
}
