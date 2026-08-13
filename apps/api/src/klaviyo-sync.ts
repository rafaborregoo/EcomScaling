import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { isIntegrationFeatureEnabled } from "@ecomscaling/integrations";
import {
  createKlaviyoClient,
  type KlaviyoReportRequest,
  type KlaviyoReportType,
  type KlaviyoResource,
} from "./klaviyo-client.js";
import { getValidKlaviyoAccessToken } from "./klaviyo-token-store.js";

type SyncMode = "initial" | "incremental";

export type KlaviyoReportInput = Pick<
  KlaviyoReportRequest,
  "type" | "statistics" | "filter" | "group_by" | "interval"
> & {
  periodStart: string;
  periodEnd: string;
};

function serviceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function attrs(resource: KlaviyoResource): Record<string, unknown> {
  return resource.attributes ?? {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : null;
}

function date(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

async function upsertRows(
  client: ReturnType<typeof serviceClient>,
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict: string,
) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`klaviyo_sync_${table}_failed:${error.message}`);
}

export async function runKlaviyoSync(
  env: LoadedApiEnv,
  connectionId: string,
  mode: SyncMode,
) {
  if (!isIntegrationFeatureEnabled("klaviyo", env.INTEGRATION_FEATURE_FLAGS))
    throw new Error("klaviyo_integration_disabled");

  const client = serviceClient(env);
  const { data: connection, error: connectionError } = await client
    .from("integration_connections")
    .select("id, organization_id, provider, status")
    .eq("id", connectionId)
    .eq("provider", "klaviyo")
    .maybeSingle();
  if (connectionError)
    throw new Error(
      `klaviyo_connection_load_failed:${connectionError.message}`,
    );
  if (!connection) throw new Error("klaviyo_connection_not_found");

  const idempotencyKey = `klaviyo:${connectionId}:${mode}:${new Date().toISOString().slice(0, 10)}`;
  const { data: existingRun } = await client
    .from("integration_sync_runs")
    .select("id, status, records_read, records_written, records_failed")
    .eq("provider", "klaviyo")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingRun?.status === "succeeded") {
    return {
      status: "succeeded" as const,
      recordsRead: existingRun.records_read,
      recordsWritten: existingRun.records_written,
    };
  }

  const { data: syncRun, error: syncRunError } = await client
    .from("integration_sync_runs")
    .upsert(
      {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        provider: "klaviyo",
        sync_type: mode === "initial" ? "initial_import" : "incremental",
        status: "running",
        idempotency_key: idempotencyKey,
        started_at: new Date().toISOString(),
        attempt_count: 1,
      },
      { onConflict: "provider,idempotency_key" },
    )
    .select("id, organization_id")
    .single();
  if (syncRunError || !syncRun)
    throw new Error(
      `klaviyo_sync_run_create_failed:${syncRunError?.message ?? "missing_run"}`,
    );

  try {
    const accessToken = await getValidKlaviyoAccessToken(env, connectionId);
    const api = createKlaviyoClient(accessToken);
    const account = await api.getAccount();
    const accountAttributes = attrs(account);
    const now = new Date().toISOString();
    const accountRow = {
      organization_id: connection.organization_id,
      connection_id: connectionId,
      external_account_id: account.id,
      name: text(accountAttributes.name),
      timezone: text(accountAttributes.timezone),
      currency_code:
        text(accountAttributes.currency_code)?.toUpperCase() ?? null,
      raw_data: accountAttributes,
      last_synced_at: now,
    };
    await upsertRows(
      client,
      "klaviyo_accounts",
      [accountRow],
      "connection_id,external_account_id",
    );
    const { data: accountRowStored, error: accountLoadError } = await client
      .from("klaviyo_accounts")
      .select("id")
      .eq("connection_id", connectionId)
      .eq("external_account_id", account.id)
      .single();
    if (accountLoadError || !accountRowStored)
      throw new Error(
        `klaviyo_account_load_failed:${accountLoadError?.message ?? "missing_account"}`,
      );

    const resources = await Promise.all([
      api.listResources("lists"),
      api.listResources("segments"),
      api.listResources("flows"),
      api.listResources("campaigns"),
      api.listResources("forms"),
      api.listResources("metrics"),
    ]);
    const [lists, segments, flows, campaigns, forms, metrics] = resources;
    await upsertRows(
      client,
      "klaviyo_lists",
      lists.map((row) => ({
        organization_id: connection.organization_id,
        account_id: accountRowStored.id,
        external_list_id: row.id,
        name: text(attrs(row).name) ?? row.id,
        opt_in_process: text(attrs(row).opt_in_process),
        profile_count: integer(attrs(row).profile_count),
        raw_data: attrs(row),
        last_synced_at: now,
      })),
      "account_id,external_list_id",
    );
    await upsertRows(
      client,
      "klaviyo_segments",
      segments.map((row) => ({
        organization_id: connection.organization_id,
        account_id: accountRowStored.id,
        external_segment_id: row.id,
        name: text(attrs(row).name) ?? row.id,
        profile_count: integer(attrs(row).profile_count),
        raw_data: attrs(row),
        last_synced_at: now,
      })),
      "account_id,external_segment_id",
    );
    await upsertRows(
      client,
      "klaviyo_flows",
      flows.map((row) => ({
        organization_id: connection.organization_id,
        account_id: accountRowStored.id,
        external_flow_id: row.id,
        name: text(attrs(row).name) ?? row.id,
        status: text(attrs(row).status),
        trigger_type: text(attrs(row).trigger_type),
        created_at_external: date(attrs(row).created),
        updated_at_external: date(attrs(row).updated),
        raw_data: attrs(row),
        last_synced_at: now,
      })),
      "account_id,external_flow_id",
    );
    await upsertRows(
      client,
      "klaviyo_campaigns",
      campaigns.map((row) => ({
        organization_id: connection.organization_id,
        account_id: accountRowStored.id,
        external_campaign_id: row.id,
        name: text(attrs(row).name) ?? row.id,
        status: text(attrs(row).status),
        send_time: date(attrs(row).send_time),
        created_at_external: date(attrs(row).created_at),
        updated_at_external: date(attrs(row).updated_at),
        raw_data: attrs(row),
        last_synced_at: now,
      })),
      "account_id,external_campaign_id",
    );
    await upsertRows(
      client,
      "klaviyo_forms",
      forms.map((row) => ({
        organization_id: connection.organization_id,
        account_id: accountRowStored.id,
        external_form_id: row.id,
        name: text(attrs(row).name) ?? row.id,
        status: text(attrs(row).status),
        raw_data: attrs(row),
        last_synced_at: now,
      })),
      "account_id,external_form_id",
    );
    await upsertRows(
      client,
      "klaviyo_metrics",
      metrics.map((row) => ({
        organization_id: connection.organization_id,
        account_id: accountRowStored.id,
        external_metric_id: row.id,
        name: text(attrs(row).name) ?? row.id,
        metric_type: text(attrs(row).type),
        raw_data: attrs(row),
        last_synced_at: now,
      })),
      "account_id,external_metric_id",
    );

    const recordsRead =
      resources.reduce((sum, rows) => sum + rows.length, 0) + 1;
    await client
      .from("integration_sync_runs")
      .update({
        status: "succeeded",
        records_read: recordsRead,
        records_written: recordsRead,
        finished_at: now,
      })
      .eq("id", syncRun.id);
    await client
      .from("integration_connections")
      .update({
        status: "connected",
        last_sync_at: now,
        last_error_at: null,
        last_error_message: null,
      })
      .eq("id", connectionId);
    return {
      status: "succeeded" as const,
      recordsRead,
      recordsWritten: recordsRead,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "klaviyo_sync_failed";
    await client
      .from("integration_sync_runs")
      .update({
        status: "failed",
        records_failed: 1,
        error_message: message.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq("id", syncRun.id);
    await client
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: new Date().toISOString(),
        last_error_message: message.slice(0, 500),
      })
      .eq("id", connectionId);
    throw error;
  }
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function runKlaviyoReport(
  env: LoadedApiEnv,
  organizationId: string,
  connectionId: string,
  input: KlaviyoReportInput,
) {
  if (!isIntegrationFeatureEnabled("klaviyo", env.INTEGRATION_FEATURE_FLAGS))
    throw new Error("klaviyo_integration_disabled");

  if (!input.statistics.length)
    throw new Error("klaviyo_report_statistics_required");
  const client = serviceClient(env);
  const { data: connection, error: connectionError } = await client
    .from("integration_connections")
    .select("id, organization_id")
    .eq("id", connectionId)
    .eq("organization_id", organizationId)
    .eq("provider", "klaviyo")
    .maybeSingle();
  if (connectionError || !connection) {
    throw new Error(
      `klaviyo_connection_load_failed:${connectionError?.message ?? "not_found"}`,
    );
  }
  const { data: account, error: accountError } = await client
    .from("klaviyo_accounts")
    .select("id, timezone, currency_code, conversion_metric_id")
    .eq("organization_id", connection.organization_id)
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (accountError || !account) {
    throw new Error(
      `klaviyo_account_load_failed:${accountError?.message ?? "not_found"}`,
    );
  }
  if (!account.conversion_metric_id)
    throw new Error("klaviyo_conversion_metric_not_selected");

  const idempotencyKey = [
    input.type,
    account.conversion_metric_id,
    input.periodStart,
    input.periodEnd,
    input.statistics.slice().sort().join(","),
    input.filter ?? "",
  ].join(":");
  const { data: existingRun } = await client
    .from("klaviyo_report_runs")
    .select("id, status")
    .eq("account_id", account.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingRun?.status === "succeeded") {
    return {
      status: "succeeded" as const,
      reportRunId: existingRun.id,
      resultCount: 0,
    };
  }
  const { data: reportRun, error: runError } = await client
    .from("klaviyo_report_runs")
    .upsert(
      {
        organization_id: connection.organization_id,
        account_id: account.id,
        report_type: input.type,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        timezone: account.timezone ?? "UTC",
        currency_code: account.currency_code,
        status: "running",
        idempotency_key: idempotencyKey,
        started_at: new Date().toISOString(),
      },
      { onConflict: "account_id,idempotency_key" },
    )
    .select("id")
    .single();
  if (runError || !reportRun) {
    throw new Error(
      `klaviyo_report_run_create_failed:${runError?.message ?? "missing_run"}`,
    );
  }

  try {
    const token = await getValidKlaviyoAccessToken(env, connectionId);
    const api = createKlaviyoClient(token);
    const response = await api.queryReport<{
      data?: {
        attributes?: {
          results?: Array<{
            groupings?: Record<string, unknown>;
            statistics?: Record<string, unknown>;
          }>;
        };
      };
    }>({
      type: input.type,
      statistics: input.statistics,
      conversion_metric_id: account.conversion_metric_id,
      timeframe: {
        start: `${input.periodStart}T00:00:00+00:00`,
        end: `${input.periodEnd}T23:59:59+00:00`,
      },
      ...(input.filter ? { filter: input.filter } : {}),
      ...(input.group_by ? { group_by: input.group_by } : {}),
      ...(input.interval ? { interval: input.interval } : {}),
    });
    const results = response.data?.attributes?.results ?? [];
    const entityType = input.type.split("-")[0] ?? "unknown";
    const entityKey = `${entityType}_id`;
    const rows = results.map((result) => {
      const groupings = result.groupings ?? {};
      const statistics = result.statistics ?? {};
      return {
        organization_id: connection.organization_id,
        report_run_id: reportRun.id,
        entity_type: entityType,
        external_entity_id:
          typeof groupings[entityKey] === "string"
            ? groupings[entityKey]
            : null,
        entity_name:
          typeof groupings[`${entityType}_name`] === "string"
            ? groupings[`${entityType}_name`]
            : null,
        metric_id: account.conversion_metric_id,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        conversions: numberValue(
          statistics.conversion_uniques ?? statistics.conversions,
        ),
        revenue: numberValue(statistics.conversion_value ?? statistics.revenue),
        currency_code: account.currency_code,
        raw_data: { groupings, statistics },
      };
    });
    if (rows.length) {
      await upsertRows(
        client,
        "klaviyo_report_values",
        rows,
        "report_run_id,entity_type,external_entity_id,metric_id,period_start,period_end",
      );
    }
    await client
      .from("klaviyo_report_runs")
      .update({ status: "succeeded", finished_at: new Date().toISOString() })
      .eq("id", reportRun.id);
    return {
      status: "succeeded" as const,
      reportRunId: reportRun.id,
      resultCount: rows.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "klaviyo_report_failed";
    await client
      .from("klaviyo_report_runs")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq("id", reportRun.id);
    throw error;
  }
}

export async function listKlaviyoReports(
  env: LoadedApiEnv,
  organizationId: string,
  connectionId: string,
  limit = 25,
) {
  const client = serviceClient(env);
  const { data: connection, error: connectionError } = await client
    .from("integration_connections")
    .select("id, organization_id")
    .eq("id", connectionId)
    .eq("organization_id", organizationId)
    .eq("provider", "klaviyo")
    .maybeSingle();
  if (connectionError || !connection) {
    throw new Error(
      `klaviyo_connection_load_failed:${connectionError?.message ?? "not_found"}`,
    );
  }

  const { data: account, error: accountError } = await client
    .from("klaviyo_accounts")
    .select("id")
    .eq("organization_id", connection.organization_id)
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (accountError || !account) {
    throw new Error(
      `klaviyo_account_load_failed:${accountError?.message ?? "not_found"}`,
    );
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const { data: runs, error: runsError } = await client
    .from("klaviyo_report_runs")
    .select(
      "id, report_type, period_start, period_end, status, error_message, started_at, finished_at",
    )
    .eq("organization_id", connection.organization_id)
    .eq("account_id", account.id)
    .order("started_at", { ascending: false })
    .limit(safeLimit);
  if (runsError) {
    throw new Error(`klaviyo_report_runs_load_failed:${runsError.message}`);
  }

  const runIds = (runs ?? []).map((run) => run.id as string);
  if (runIds.length === 0) {
    return { runs: [], values: [] };
  }
  const { data: values, error: valuesError } = await client
    .from("klaviyo_report_values")
    .select(
      "report_run_id, entity_type, external_entity_id, entity_name, metric_id, period_start, period_end, conversions, revenue, currency_code, raw_data",
    )
    .eq("organization_id", connection.organization_id)
    .in("report_run_id", runIds)
    .order("revenue", { ascending: false, nullsFirst: false })
    .limit(safeLimit * 20);
  if (valuesError) {
    throw new Error(`klaviyo_report_values_load_failed:${valuesError.message}`);
  }
  return {
    runs: (runs ?? []).map((run) => ({
      ...run,
      entity_type: String(run.report_type ?? "").split("-")[0] ?? "unknown",
    })),
    values: values ?? [],
  };
}

// Meses completos de historico que EcomScaling quiere tener antes de poder
// hablar de tendencias de email. Reporting API admite como maximo un ano por
// solicitud, asi que el backfill va mes a mes.
export const KLAVIYO_BACKFILL_MONTHS = 12;
export const KLAVIYO_REPORT_STATISTICS = [
  "opens",
  "clicks",
  "conversion_uniques",
  "conversion_value",
];
const KLAVIYO_REPORT_TYPES = [
  "campaign-values-report",
  "flow-values-report",
] as const;

function groupByForType(type: KlaviyoReportType): string[] {
  return [type.startsWith("campaign") ? "campaign_id" : "flow_id"];
}

function monthPeriod(reference: Date, monthsAgo: number) {
  const start = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth() - monthsAgo,
      1,
    ),
  );
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  );
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

/**
 * Devuelve el siguiente informe historico que falta, del mes mas reciente al
 * mas antiguo, o `null` si el historico ya esta completo. El reconciliador
 * ejecuta como mucho uno por pasada: las cuotas de Reporting API son de 2
 * solicitudes por minuto y 225 al dia, asi que rellenar 12 meses de golpe
 * agotaria la cuota de la cuenta del cliente.
 */
export function nextKlaviyoBackfillPeriod(
  reference: Date,
  existing: Array<{ report_type: string; period_start: string }>,
  months = KLAVIYO_BACKFILL_MONTHS,
): { type: KlaviyoReportType; periodStart: string; periodEnd: string } | null {
  const done = new Set(
    existing.map((row) => `${row.report_type}:${row.period_start}`),
  );
  for (let monthsAgo = 1; monthsAgo <= months; monthsAgo += 1) {
    const period = monthPeriod(reference, monthsAgo);
    for (const type of KLAVIYO_REPORT_TYPES) {
      if (!done.has(`${type}:${period.periodStart}`)) {
        return { type, ...period };
      }
    }
  }
  return null;
}

export async function reconcileAllKlaviyoConnections(env: LoadedApiEnv) {
  if (!isIntegrationFeatureEnabled("klaviyo", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };
  }

  const client = serviceClient(env);
  const { data: connections, error } = await client
    .from("integration_connections")
    .select("id, organization_id")
    .eq("provider", "klaviyo")
    .eq("status", "connected")
    .order("created_at", { ascending: true });
  if (error)
    throw new Error(`klaviyo_connections_list_failed:${error.message}`);

  const results: Array<{
    connectionId: string;
    status: "succeeded" | "failed" | "skipped";
    detail?: string;
  }> = [];
  const periodEnd = new Date().toISOString().slice(0, 10);
  const periodStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  for (const connection of connections ?? []) {
    try {
      await runKlaviyoSync(env, connection.id, "incremental");
      const { data: account } = await client
        .from("klaviyo_accounts")
        .select("id, conversion_metric_id")
        .eq("connection_id", connection.id)
        .maybeSingle();
      if (!account?.conversion_metric_id) {
        results.push({
          connectionId: connection.id,
          status: "skipped",
          detail: "conversion_metric_not_selected",
        });
        continue;
      }
      for (const type of KLAVIYO_REPORT_TYPES) {
        await runKlaviyoReport(env, connection.organization_id, connection.id, {
          type,
          statistics: KLAVIYO_REPORT_STATISTICS,
          periodStart,
          periodEnd,
          group_by: groupByForType(type),
        });
      }

      // Backfill incremental del historico: un mes pendiente por pasada. Con
      // el cron de 6 horas el ano completo queda cubierto en pocos dias sin
      // agotar la cuota de Reporting API ni bloquear el sync reciente.
      const { data: historicRuns } = await client
        .from("klaviyo_report_runs")
        .select("report_type, period_start")
        .eq("account_id", account.id)
        .eq("status", "succeeded");
      const pending = nextKlaviyoBackfillPeriod(new Date(), historicRuns ?? []);
      if (pending) {
        await runKlaviyoReport(env, connection.organization_id, connection.id, {
          type: pending.type,
          statistics: KLAVIYO_REPORT_STATISTICS,
          periodStart: pending.periodStart,
          periodEnd: pending.periodEnd,
          group_by: groupByForType(pending.type),
        });
      }

      results.push({
        connectionId: connection.id,
        status: "succeeded",
        detail: pending
          ? `backfilled:${pending.type}:${pending.periodStart}`
          : "history_complete",
      });
    } catch (syncError) {
      results.push({
        connectionId: connection.id,
        status: "failed",
        detail:
          syncError instanceof Error
            ? syncError.message
            : "klaviyo_reconcile_failed",
      });
    }
  }

  return {
    total: results.length,
    succeeded: results.filter((item) => item.status === "succeeded").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    results,
  };
}
