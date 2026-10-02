import type { SupabaseClient } from "@supabase/supabase-js";
import type { KlaviyoClient, KlaviyoResource } from "./klaviyo-client.js";
import { mapWithConcurrency } from "./async-concurrency.js";
import { buildKlaviyoFlowGraph } from "./klaviyo-flow-graph.js";

/**
 * Bloques de sync que alimentan Marketing (Flows, Audiencias, Plantillas y
 * Rendimiento). Cada bloque tiene su try/catch y su fila en
 * integration_sync_runs (ADR-0006 punto 2): uno que falla no tumba la pasada.
 *
 * Cuotas de Klaviyo que marcan el diseño:
 *  - GET /lists/{id} con profile_count: 1/s y 15/min -> pocas listas por pasada,
 *    las más antiguas primero; en unas horas están todas.
 *  - Reporting API (series y form values): 2/min y 225/día por cuenta,
 *    compartida con los informes que ya existen -> una vez al día cada uno.
 *
 * Importación inicial frente a incremental: el mismo código con más tope en la
 * inicial (más grafos, más listas y 120 días de serie en vez de 60).
 */

type Mode = "initial" | "incremental";
type RecordBlock = (
  scope: string,
  startedAt: string,
  result: { read: number; error?: string },
) => Promise<void>;

export type KlaviyoMarketingSyncInput = {
  client: SupabaseClient;
  api: KlaviyoClient;
  organizationId: string;
  accountId: string;
  mode: Mode;
  conversionMetricId: string | null;
  metrics: KlaviyoResource[];
  lists: KlaviyoResource[];
  segments: KlaviyoResource[];
  recordBlockRun: RecordBlock;
};

const DAY_MS = 86_400_000;

function nameMap(rows: KlaviyoResource[]) {
  return new Map(
    rows.flatMap((row) => {
      const name = (row.attributes as Record<string, unknown> | undefined)?.name;
      return typeof name === "string" ? [[row.id, name] as const] : [];
    }),
  );
}

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "unknown_error";
}

/** ¿Hay ya un bloque bueno de este tipo hoy para esta cuenta? */
async function ranToday(client: SupabaseClient, organizationId: string, scope: string) {
  const { data } = await client
    .from("integration_sync_runs")
    .select("id")
    .eq("provider", "klaviyo")
    .eq("organization_id", organizationId)
    .eq("sync_scope", scope)
    .eq("status", "succeeded")
    .gte("started_at", `${isoDay(new Date())}T00:00:00Z`)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function syncKlaviyoMarketingBlocks(input: KlaviyoMarketingSyncInput) {
  // Secuencial a propósito: cada bloque tira de una cuota distinta, pero los de
  // Reporting comparten la suya y en paralelo se pisarían el 2/min.
  await syncFlowGraphs(input);
  await syncAudienceSizes(input);
  await syncSegmentSeries(input);
  await syncFlowDailySeries(input);
  await syncFormStats(input);
  await syncTemplateCatalog(input);
}

/** Grafo de cada flow para el diagrama: los que no lo tienen o cambiaron. */
async function syncFlowGraphs(input: KlaviyoMarketingSyncInput) {
  const startedAt = new Date().toISOString();
  try {
    const { data: flows, error } = await input.client
      .from("klaviyo_flows")
      .select("id, external_flow_id, updated_at_external, definition_graph_synced_at")
      .eq("account_id", input.accountId);
    if (error) throw new Error(error.message);
    const cap = input.mode === "initial" ? 60 : 12;
    const pending = (flows ?? [])
      .filter((flow) => {
        if (!flow.definition_graph_synced_at) return true;
        return (
          flow.updated_at_external !== null &&
          Date.parse(flow.updated_at_external as string) > Date.parse(flow.definition_graph_synced_at as string)
        );
      })
      .slice(0, cap);
    const names = {
      metrics: nameMap(input.metrics),
      audiences: new Map([...nameMap(input.lists), ...nameMap(input.segments)]),
    };
    let failures = 0;
    let written = 0;
    await mapWithConcurrency(pending, 2, async (flow) => {
      try {
        const response = await input.api.request<unknown>(
          `/flows/${encodeURIComponent(flow.external_flow_id as string)}?additional-fields%5Bflow%5D=definition`,
        );
        const graph = buildKlaviyoFlowGraph(response, names);
        // Sin definición (flows muy antiguos o de tipos raros) también se anota
        // la fecha: si no, se reintentaría en cada pasada para nada.
        const { error: updateError } = await input.client
          .from("klaviyo_flows")
          .update({ definition_graph: graph, definition_graph_synced_at: new Date().toISOString() })
          .eq("id", flow.id);
        if (updateError) throw new Error(updateError.message);
        if (graph) written += 1;
        else console.warn(`klaviyo_flow_definition_missing:${flow.external_flow_id}`);
      } catch (flowError) {
        failures += 1;
        console.warn(`klaviyo_flow_graph_failed:${flow.external_flow_id}:${errorText(flowError)}`);
      }
    });
    await input.recordBlockRun("flow_graphs", startedAt, {
      read: written,
      ...(failures ? { error: `flow_graph_failed:${failures}/${pending.length}` } : {}),
    });
  } catch (error) {
    await input.recordBlockRun("flow_graphs", startedAt, { read: 0, error: errorText(error) });
  }
}

/**
 * Tamaño de listas y segmentos (profile_count) + foto del día. La revisión
 * 2026-07-15 no lo da en el listado, solo pidiendo cada uno por id.
 */
async function syncAudienceSizes(input: KlaviyoMarketingSyncInput) {
  const startedAt = new Date().toISOString();
  const today = isoDay(new Date());
  const staleBefore = Date.now() - 20 * 60 * 60 * 1000;
  const cap = input.mode === "initial" ? 12 : 6;
  let read = 0;
  let failures = 0;
  try {
    for (const kind of ["list", "segment"] as const) {
      const table = kind === "list" ? "klaviyo_lists" : "klaviyo_segments";
      const externalColumn = kind === "list" ? "external_list_id" : "external_segment_id";
      const { data: rows, error } = await input.client
        .from(table)
        .select(`id, ${externalColumn}, profile_count_synced_at`)
        .eq("account_id", input.accountId)
        .order("profile_count_synced_at", { ascending: true, nullsFirst: true })
        .limit(cap);
      if (error) throw new Error(error.message);
      const due = ((rows ?? []) as unknown as Array<Record<string, string | null>>).filter(
        (row) => !row.profile_count_synced_at || Date.parse(row.profile_count_synced_at) < staleBefore,
      );
      for (const row of due) {
        try {
          const response = await input.api.request<{ data?: { attributes?: { profile_count?: unknown } } }>(
            `/${kind}s/${encodeURIComponent(row[externalColumn] as string)}?additional-fields%5B${kind}%5D=profile_count`,
          );
          const count = response.data?.attributes?.profile_count;
          if (typeof count !== "number") {
            console.warn(`klaviyo_profile_count_missing:${kind}:${row[externalColumn]}`);
            continue;
          }
          const now = new Date().toISOString();
          await input.client.from(table).update({ profile_count: count, profile_count_synced_at: now }).eq("id", row.id);
          await input.client.from(kind === "list" ? "klaviyo_list_daily_snapshots" : "klaviyo_segment_daily_snapshots").upsert(
            {
              organization_id: input.organizationId,
              [kind === "list" ? "list_id" : "segment_id"]: row.id,
              snapshot_date: today,
              profile_count: count,
              source: "live",
            },
            { onConflict: kind === "list" ? "list_id,snapshot_date" : "segment_id,snapshot_date" },
          );
          read += 1;
        } catch (rowError) {
          failures += 1;
          console.warn(`klaviyo_profile_count_failed:${kind}:${errorText(rowError)}`);
        }
      }
    }
    await input.recordBlockRun("audience_sizes", startedAt, {
      read,
      ...(failures ? { error: `profile_count_failed:${failures}` } : {}),
    });
  } catch (error) {
    await input.recordBlockRun("audience_sizes", startedAt, { read, error: errorText(error) });
  }
}

/** Histórico diario de los segmentos (Klaviyo lo guarda desde junio de 2023). */
async function syncSegmentSeries(input: KlaviyoMarketingSyncInput) {
  const scope = "segment_series";
  if (await ranToday(input.client, input.organizationId, scope)) return;
  const startedAt = new Date().toISOString();
  try {
    const { data: segments, error } = await input.client
      .from("klaviyo_segments")
      .select("id, external_segment_id")
      .eq("account_id", input.accountId)
      .limit(100);
    if (error) throw new Error(error.message);
    if (!segments?.length) {
      await input.recordBlockRun(scope, startedAt, { read: 0 });
      return;
    }
    const byExternal = new Map(segments.map((row) => [row.external_segment_id as string, row.id as string]));
    const end = new Date();
    const start = new Date(end.getTime() - 59 * DAY_MS);
    const response = await input.api.request<SeriesResponse>("/segment-series-reports/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          type: "segment-series-report",
          attributes: {
            statistics: ["total_members"],
            interval: "daily",
            timeframe: { start: `${isoDay(start)}T00:00:00+00:00`, end: `${isoDay(end)}T00:00:00+00:00` },
            filter: `any(segment_id,[${[...byExternal.keys()].map((id) => JSON.stringify(id)).join(",")}])`,
          },
        },
      }),
    });
    const { dates, results } = readSeries(response);
    const rows = results.flatMap((result) => {
      const segmentId = byExternal.get(String(result.groupings.segment_id ?? ""));
      const values = result.statistics.total_members ?? [];
      if (!segmentId) return [];
      return dates.flatMap((date, index) =>
        typeof values[index] === "number"
          ? [{ organization_id: input.organizationId, segment_id: segmentId, snapshot_date: date, profile_count: Math.round(values[index]!), source: "series" }]
          : [],
      );
    });
    if (rows.length) {
      const { error: upsertError } = await input.client
        .from("klaviyo_segment_daily_snapshots")
        .upsert(rows, { onConflict: "segment_id,snapshot_date" });
      if (upsertError) throw new Error(upsertError.message);
    }
    if (dates.length && !results.length) console.warn("klaviyo_segment_series_empty_results");
    await input.recordBlockRun(scope, startedAt, { read: rows.length });
  } catch (error) {
    await input.recordBlockRun(scope, startedAt, { read: 0, error: errorText(error) });
  }
}

/**
 * Ingresos diarios de los flows (EUR atribuidos por Klaviyo). Las campañas no
 * tienen serie en la API: su cifra se pinta en el día de envío con el informe
 * de campaña que ya se guarda (ver klaviyo_daily_revenue en SQL).
 */
async function syncFlowDailySeries(input: KlaviyoMarketingSyncInput) {
  const scope = "flow_daily_series";
  if (await ranToday(input.client, input.organizationId, scope)) return;
  const startedAt = new Date().toISOString();
  if (!input.conversionMetricId) {
    await input.recordBlockRun(scope, startedAt, { read: 0, error: "conversion_metric_missing" });
    return;
  }
  try {
    const windows = input.mode === "initial" ? 2 : 1;
    const totals = new Map<string, { revenue: number; recipients: number }>();
    for (let index = 0; index < windows; index += 1) {
      const end = new Date(Date.now() - index * 59 * DAY_MS);
      const start = new Date(end.getTime() - 59 * DAY_MS);
      const response = await input.api.request<SeriesResponse>("/flow-series-reports/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            type: "flow-series-report",
            attributes: {
              statistics: ["conversion_value", "recipients"],
              interval: "daily",
              conversion_metric_id: input.conversionMetricId,
              group_by: ["flow_id", "flow_message_id"],
              timeframe: { start: `${isoDay(start)}T00:00:00+00:00`, end: `${isoDay(end)}T00:00:00+00:00` },
            },
          },
        }),
      });
      const { dates, results } = readSeries(response);
      for (const result of results) {
        dates.forEach((date, position) => {
          const bucket = totals.get(date) ?? { revenue: 0, recipients: 0 };
          bucket.revenue += result.statistics.conversion_value?.[position] ?? 0;
          bucket.recipients += result.statistics.recipients?.[position] ?? 0;
          totals.set(date, bucket);
        });
      }
    }
    const rows = [...totals].flatMap(([date, value]) => [
      { organization_id: input.organizationId, account_id: input.accountId, metric_date: date, metric_id: "nora:flow_revenue", metric_name: "Ingresos atribuidos a flows", value: value.revenue, source: "flow_series" },
      { organization_id: input.organizationId, account_id: input.accountId, metric_date: date, metric_id: "nora:flow_recipients", metric_name: "Destinatarios de flows", value: value.recipients, source: "flow_series" },
    ]);
    if (rows.length) {
      const { error } = await input.client
        .from("klaviyo_daily_account_metrics")
        .upsert(rows, { onConflict: "account_id,metric_date,metric_id" });
      if (error) throw new Error(error.message);
    }
    await input.recordBlockRun(scope, startedAt, { read: rows.length });
  } catch (error) {
    await input.recordBlockRun(scope, startedAt, { read: 0, error: errorText(error) });
  }
}

/** Vistas, altas y conversión de cada formulario en 30 días. */
async function syncFormStats(input: KlaviyoMarketingSyncInput) {
  const scope = "form_stats";
  if (await ranToday(input.client, input.organizationId, scope)) return;
  const startedAt = new Date().toISOString();
  try {
    const response = await input.api.request<{ data?: { attributes?: { results?: unknown[] } } }>("/form-values-reports/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          type: "form-values-report",
          attributes: {
            statistics: ["viewed_form_uniques", "submits", "submit_rate"],
            timeframe: { key: "last_30_days" },
            group_by: ["form_id"],
          },
        },
      }),
    });
    const results = (response.data?.attributes?.results ?? []) as Array<{
      groupings?: Record<string, unknown>;
      statistics?: Record<string, unknown>;
    }>;
    const now = new Date().toISOString();
    let written = 0;
    for (const result of results) {
      const formId = result.groupings?.form_id;
      if (typeof formId !== "string") continue;
      const { error } = await input.client
        .from("klaviyo_forms")
        .update({ stats_30d: result.statistics ?? {}, stats_synced_at: now })
        .eq("account_id", input.accountId)
        .eq("external_form_id", formId);
      if (!error) written += 1;
    }
    await input.recordBlockRun(scope, startedAt, { read: written });
  } catch (error) {
    await input.recordBlockRun(scope, startedAt, { read: 0, error: errorText(error) });
  }
}

/**
 * Catálogo completo de plantillas (solo metadatos). El bloque de plantillas de
 * la pasada principal trae el HTML de las que usan campañas y flows; este
 * añade el resto para que Marketing -> Plantillas las liste todas. Nunca pisa
 * una fila existente (ignoreDuplicates), así no borra el HTML ya guardado.
 */
async function syncTemplateCatalog(input: KlaviyoMarketingSyncInput) {
  const startedAt = new Date().toISOString();
  try {
    const rows = await input.api.listAll(
      "/templates?fields%5Btemplate%5D=name,editor_type,created,updated",
      { maxPages: input.mode === "initial" ? 50 : 10 },
    );
    const now = new Date().toISOString();
    const payload = rows.map((row) => {
      const attributes = (row.attributes ?? {}) as Record<string, unknown>;
      return {
        organization_id: input.organizationId,
        account_id: input.accountId,
        external_template_id: row.id,
        name: typeof attributes.name === "string" ? attributes.name : row.id,
        editor_type: typeof attributes.editor_type === "string" ? attributes.editor_type : null,
        external_created_at: typeof attributes.created === "string" ? attributes.created : null,
        external_updated_at: typeof attributes.updated === "string" ? attributes.updated : null,
        raw_data: attributes,
        last_synced_at: now,
      };
    });
    if (payload.length) {
      const { error } = await input.client
        .from("klaviyo_templates")
        .upsert(payload, { onConflict: "account_id,external_template_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    await input.recordBlockRun("template_catalog", startedAt, { read: payload.length });
  } catch (error) {
    // Una cuenta con muchas plantillas puede pasar del tope de páginas: lo ya
    // guardado sigue sirviendo y el aviso queda en el ledger.
    await input.recordBlockRun("template_catalog", startedAt, { read: 0, error: errorText(error) });
  }
}

type SeriesResponse = {
  data?: {
    attributes?: {
      date_times?: unknown[];
      results?: Array<{ groupings?: Record<string, unknown>; statistics?: Record<string, unknown> }>;
    };
  };
};

/** Normaliza la respuesta de un informe de serie a días + arrays numéricos. */
export function readSeries(response: SeriesResponse) {
  const dates = (response.data?.attributes?.date_times ?? []).map((value) =>
    typeof value === "string" ? value.slice(0, 10) : "",
  );
  const results = (response.data?.attributes?.results ?? []).map((result) => ({
    groupings: result.groupings ?? {},
    statistics: Object.fromEntries(
      Object.entries(result.statistics ?? {}).map(([key, values]) => [
        key,
        Array.isArray(values) ? values.map((value) => (typeof value === "number" ? value : 0)) : [],
      ]),
    ) as Record<string, number[]>,
  }));
  return { dates, results };
}
