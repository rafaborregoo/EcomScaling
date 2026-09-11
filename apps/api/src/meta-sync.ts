import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { isIntegrationFeatureEnabled } from "@ecomscaling/integrations";
import { createLogger } from "@ecomscaling/observability";
import { metaGraphGet, metaGraphGetAll } from "./meta-client.js";
import { getValidMetaAccessToken } from "./meta.js";
import {
  checkOperationalOrganization,
  isOperationalOrganizationError,
} from "./operational-organization.js";
import { mapWithConcurrency } from "./async-concurrency.js";

export { mapWithConcurrency } from "./async-concurrency.js";

type ApiEnv = LoadedApiEnv;

const logger = createLogger("meta-sync");

export type MetaSyncMode = "initial" | "incremental";
export type MetaInsightsMode = "sync" | "async";
export type MetaActionReportTime = "impression" | "conversion" | "mixed";

export function buildMetaSyncIdempotencyKey(
  connectionId: string,
  scope: string,
  mode: MetaSyncMode,
  startedAt: string,
) {
  return `meta:${mode}:${scope}:${connectionId}:${startedAt.slice(0, 10)}`;
}

// Ventana [since, until] en fechas ISO (YYYY-MM-DD). initial/incremental la
// derivan de INSIGHTS_LOOKBACK_DAYS; el backfill pasa un mes concreto.
export type MetaInsightsWindow = { since: string; until: string };

function lookbackWindow(days: number): MetaInsightsWindow {
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

function parseMonth(month: string): { year: number; mon: number } {
  const parts = month.split("-");
  return { year: Number(parts[0] ?? 0), mon: Number(parts[1] ?? 1) };
}

// Primer y ultimo dia (ISO) del mes `YYYY-MM`.
function monthWindow(month: string): MetaInsightsWindow {
  const { year, mon } = parseMonth(month);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const last = new Date(Date.UTC(year, mon, 0));
  return {
    since: first.toISOString().slice(0, 10),
    until: last.toISOString().slice(0, 10),
  };
}

function addMonths(month: string, delta: number): string {
  const { year, mon } = parseMonth(month);
  const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Import completo e incremental son el mismo codigo parametrizado (ADR-0006
// punto 3). La ventana incremental es de 28 dias porque Meta reatribuye
// compras dentro de la ventana de atribucion: una fila ya sincronizada puede
// cambiar dias despues (guia Meta 7.3, "revisiones retroactivas").
const INSIGHTS_LOOKBACK_DAYS: Record<MetaSyncMode, number> = {
  initial: 90,
  incremental: 28,
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

type SyncBlockResult = { read: number; written: number };

/**
 * El token guardado ya no casa con `META_APP_SECRET`.
 *
 * `appsecret_proof` es un HMAC del token con el secreto de la app, asi que
 * Meta solo lo rechaza cuando el token lo emitio OTRA app (o el secreto se
 * rotó). No hay reintento que lo arregle: hay que reautorizar. Paso el
 * 2026-09-10 y el modulo entero se quedo sin datos bajo el mensaje generico
 * `meta_sync_partial_failure`, que no dice nada de reautorizar.
 */
export function isMetaAppSecretProofError(message: string): boolean {
  return message.includes("Invalid appsecret_proof");
}

/** El token caduco. Mismo final que el anterior: reautorizar, no reintentar. */
export function isMetaTokenExpiredError(message: string): boolean {
  return (
    message.includes("Session has expired") ||
    message.includes("Error validating access token")
  );
}

export function metaConnectionErrorMessage(
  blockErrors: readonly string[],
): string {
  if (blockErrors.some(isMetaAppSecretProofError)) {
    return "meta_reauth_required: el token guardado no pertenece a la app configurada (appsecret_proof invalido). Reconecta Meta Ads en Integraciones.";
  }
  if (blockErrors.some(isMetaTokenExpiredError)) {
    return "meta_reauth_required: el token de Meta ha caducado. Reconecta Meta Ads en Integraciones.";
  }
  return "meta_sync_partial_failure";
}

async function recordSyncRun(
  supabase: SupabaseClient,
  connectionId: string,
  organizationId: string,
  scope: string,
  mode: MetaSyncMode,
  runner: () => Promise<SyncBlockResult>,
  // El backfill pasa una clave estable por mes (sin la fecha de hoy) para que
  // reintentar el mismo mes sea idempotente y no cree una fila nueva por dia.
  idempotencyKeyOverride?: string,
  // Los mensajes de los bloques que fallan se acumulan aqui para que, al
  // cerrar el sync, la conexion pueda decir QUE hay que hacer y no solo que
  // algo fallo. Va el ultimo para no mover los parametros existentes.
  blockErrors?: string[],
) {
  const startedAt = new Date().toISOString();
  const idempotencyKey =
    idempotencyKeyOverride ??
    buildMetaSyncIdempotencyKey(connectionId, scope, mode, startedAt);

  const { data: existing } = await supabase
    .from("integration_sync_runs")
    .select("status")
    .eq("provider", "meta_ads")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing?.status === "succeeded") {
    return true;
  }

  const base = {
    connection_id: connectionId,
    organization_id: organizationId,
    provider: "meta_ads",
    sync_type: mode === "initial" ? "initial_import" : "incremental",
    sync_scope: scope,
    idempotency_key: idempotencyKey,
    started_at: startedAt,
  };

  await supabase.from("integration_sync_runs").upsert(
    {
      ...base,
      status: "running",
      records_read: 0,
      records_written: 0,
      records_failed: 0,
    },
    { onConflict: "provider,idempotency_key" },
  );

  try {
    const result = await runner();
    await supabase.from("integration_sync_runs").upsert(
      {
        ...base,
        status: "succeeded",
        finished_at: new Date().toISOString(),
        records_read: result.read,
        records_written: result.written,
        records_failed: 0,
      },
      { onConflict: "provider,idempotency_key" },
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    blockErrors?.push(message);
    logger.error("meta_sync_block_failed", {
      scope,
      connection_id: connectionId,
      organization_id: organizationId,
      message,
    });
    await supabase.from("integration_sync_runs").upsert(
      {
        ...base,
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message.slice(0, 500),
      },
      { onConflict: "provider,idempotency_key" },
    );
    return false;
  }
}

type CampaignNode = Record<string, unknown> & { id: string };
type InsightNode = {
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  unique_clicks?: string;
  inline_link_clicks?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  cpp?: string;
  publisher_platform?: string;
  platform_position?: string;
  device_platform?: string;
  action_report_time?: string;
  action_attribution_windows?: string[];
  [key: string]: unknown;
  actions?: Array<Record<string, unknown> & { action_type?: string; value?: string }>;
  action_values?: Array<Record<string, unknown> & { action_type?: string; value?: string }>;
  purchase_roas?: Array<Record<string, unknown> & { action_type?: string; value?: string }>;
};

type MetaInsightRowPayload = {
  organization_id: string;
  ad_account_id: string;
  campaign_id: string | null;
  ad_set_id: string | null;
  ad_id: string | null;
  level: "ad";
  external_entity_id: string;
  metric_date: string;
  publisher_platform: string | null;
  platform_position: string | null;
  device_platform: string | null;
  breakdowns: Record<string, string> | null;
  breakdown_hash: string;
  attribution_windows: string[] | null;
  attribution_hash: string;
  action_report_time: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number | null;
  clicks: number;
  unique_clicks: number;
  inline_link_clicks: number;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
  cpp: number | null;
  // Creatividad: la curva de video y lo que Meta opina de la subasta.
  video_plays: number | null;
  video_p25_watched: number | null;
  video_p50_watched: number | null;
  video_p75_watched: number | null;
  video_p95_watched: number | null;
  video_p100_watched: number | null;
  video_thruplays: number | null;
  video_avg_time_watched_seconds: number | null;
  cost_per_thruplay: number | null;
  quality_ranking: string | null;
  engagement_rate_ranking: string | null;
  conversion_rate_ranking: string | null;
  outbound_clicks: number | null;
  outbound_clicks_ctr: number | null;
  unique_inline_link_clicks: number | null;
  inline_link_click_ctr: number | null;
  cost_per_inline_link_click: number | null;
  estimated_ad_recallers: number | null;
  estimated_ad_recall_rate: number | null;
  full_view_impressions: number | null;
  full_view_reach: number | null;
  attribution_setting: string | null;
  raw_data: InsightNode;
  synced_at: string;
};

/**
 * Lee una metrica de insights de Meta, venga como escalar o como lista.
 *
 * Meta mezcla las dos formas sin criterio aparente: `ctr` llega como cadena,
 * `outbound_clicks` como `[{action_type, value}]`, y el video entero tambien
 * como lista. Tratar una lista como escalar da NaN, y NaN entra en la base
 * como null sin que nada falle: la metrica desaparece en silencio, que es el
 * peor final posible.
 *
 * Devuelve null y no 0 cuando no viene: un anuncio de imagen no tiene cero
 * reproducciones de video, no tiene video. De esa diferencia depende el
 * indice parcial de las metricas de creatividad.
 */
export function readInsightNumber(value: unknown): number | null {
  if (value == null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (Array.isArray(value)) {
    let total = 0;
    let seen = false;
    for (const entry of value) {
      const parsed = Number((entry as { value?: unknown })?.value);
      if (Number.isFinite(parsed)) {
        total += parsed;
        seen = true;
      }
    }
    // Una lista vacia o con valores ilegibles es "no vino", no un cero.
    return seen ? total : null;
  }

  return null;
}

export const META_PLATFORM_BREAKDOWN_KEYS = [
  "publisher_platform",
  "platform_position",
  "device_platform",
] as const;

export function buildMetaInsightRowPayload(
  organizationId: string,
  adAccountRowId: string,
  insight: InsightNode,
  internal: { adId: string; adSetId: string; campaignId: string | null } | undefined,
  syncedAt = new Date().toISOString(),
  actionReportTime: MetaActionReportTime | undefined = undefined,
  // Que claves forman el desglose de esta fila. Edad/genero, pais y hora
  // van al mismo jsonb que la plataforma, no a columnas propias: Meta no
  // deja pedirlos juntos, asi que cada corte es una peticion distinta y
  // seis columnas casi siempre nulas describirian peor esa realidad.
  breakdownKeys: readonly string[] = META_PLATFORM_BREAKDOWN_KEYS,
): MetaInsightRowPayload | null {
  if (!insight.ad_id || !insight.date_start) return null;
  const breakdownEntries = breakdownKeys
    .map((key) => [key, insight[key]] as [string, unknown])
    .filter((entry): entry is [string, string] => typeof entry[1] === "string");
  const breakdowns = breakdownEntries.length
    ? Object.fromEntries(breakdownEntries)
    : null;
  const attributionWindows = Array.isArray(insight.action_attribution_windows)
    ? insight.action_attribution_windows
    : null;
  const hash = (value: unknown) =>
    crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return {
    organization_id: organizationId,
    ad_account_id: adAccountRowId,
    campaign_id: internal?.campaignId ?? null,
    ad_set_id: internal?.adSetId ?? null,
    ad_id: internal?.adId ?? null,
    level: "ad",
    external_entity_id: insight.ad_id,
    metric_date: insight.date_start,
    publisher_platform: insight.publisher_platform ?? null,
    platform_position: insight.platform_position ?? null,
    device_platform: insight.device_platform ?? null,
    breakdowns,
    breakdown_hash: breakdowns ? hash(breakdowns) : "none",
    attribution_windows: attributionWindows,
    attribution_hash: attributionWindows ? hash(attributionWindows) : "default",
    action_report_time: actionReportTime ?? insight.action_report_time ?? "default",
    spend: insight.spend != null ? Number(insight.spend) : 0,
    impressions: insight.impressions != null ? Number(insight.impressions) : 0,
    reach: insight.reach != null ? Number(insight.reach) : 0,
    frequency: insight.frequency != null ? Number(insight.frequency) : null,
    clicks: insight.clicks != null ? Number(insight.clicks) : 0,
    unique_clicks: insight.unique_clicks != null ? Number(insight.unique_clicks) : 0,
    inline_link_clicks: insight.inline_link_clicks != null ? Number(insight.inline_link_clicks) : 0,
    cpm: insight.cpm != null ? Number(insight.cpm) : null,
    cpc: insight.cpc != null ? Number(insight.cpc) : null,
    ctr: insight.ctr != null ? Number(insight.ctr) : null,
    cpp: insight.cpp != null ? Number(insight.cpp) : null,
    video_plays: readInsightNumber(insight.video_play_actions),
    video_p25_watched: readInsightNumber(insight.video_p25_watched_actions),
    video_p50_watched: readInsightNumber(insight.video_p50_watched_actions),
    video_p75_watched: readInsightNumber(insight.video_p75_watched_actions),
    video_p95_watched: readInsightNumber(insight.video_p95_watched_actions),
    video_p100_watched: readInsightNumber(insight.video_p100_watched_actions),
    video_thruplays: readInsightNumber(
      insight.video_thruplay_watched_actions,
    ),
    video_avg_time_watched_seconds: readInsightNumber(
      insight.video_avg_time_watched_actions,
    ),
    cost_per_thruplay: readInsightNumber(insight.cost_per_thruplay),
    // Meta responde UNKNOWN cuando el anuncio no tiene volumen suficiente
    // para rankearlo. Se guarda tal cual: "no hay bastante dato" es una
    // respuesta distinta de "esta por debajo de la media".
    quality_ranking:
      typeof insight.quality_ranking === "string"
        ? insight.quality_ranking
        : null,
    engagement_rate_ranking:
      typeof insight.engagement_rate_ranking === "string"
        ? insight.engagement_rate_ranking
        : null,
    conversion_rate_ranking:
      typeof insight.conversion_rate_ranking === "string"
        ? insight.conversion_rate_ranking
        : null,
    outbound_clicks: readInsightNumber(insight.outbound_clicks),
    outbound_clicks_ctr: readInsightNumber(insight.outbound_clicks_ctr),
    unique_inline_link_clicks: readInsightNumber(
      insight.unique_inline_link_clicks,
    ),
    inline_link_click_ctr: readInsightNumber(insight.inline_link_click_ctr),
    cost_per_inline_link_click: readInsightNumber(
      insight.cost_per_inline_link_click,
    ),
    estimated_ad_recallers: readInsightNumber(insight.estimated_ad_recallers),
    estimated_ad_recall_rate: readInsightNumber(
      insight.estimated_ad_recall_rate,
    ),
    full_view_impressions: readInsightNumber(insight.full_view_impressions),
    full_view_reach: readInsightNumber(insight.full_view_reach),
    attribution_setting:
      typeof insight.attribution_setting === "string"
        ? insight.attribution_setting
        : null,
    raw_data: insight,
    synced_at: syncedAt,
  };
}

type MetaActionMetricPayload = {
  organization_id: string;
  insight_row_id: string;
  metric_name: "actions" | "action_values" | "purchase_roas";
  action_type: string;
  value: number | null;
  attribution_window: string;
  raw_value: Record<string, unknown>;
};

export function buildMetaActionMetricPayloads(
  organizationId: string,
  insightRowId: string,
  insight: InsightNode,
): MetaActionMetricPayload[] {
  const groups = [
    { metricName: "actions" as const, entries: insight.actions },
    { metricName: "action_values" as const, entries: insight.action_values },
    { metricName: "purchase_roas" as const, entries: insight.purchase_roas },
  ];
  const deduped = new Map<string, MetaActionMetricPayload>();
  const attributionWindows = ["1d_click", "7d_click", "1d_view"];
  for (const group of groups) {
    for (const entry of group.entries ?? []) {
      const actionType = entry.action_type ?? "none";
      const windows = attributionWindows.filter((window) => entry[window] != null);
      for (const attributionWindow of windows.length ? windows : ["default"]) {
        const rawValue = windows.length ? entry[attributionWindow] : entry.value;
        deduped.set(`${group.metricName}:${actionType}:${attributionWindow}`, {
          organization_id: organizationId,
          insight_row_id: insightRowId,
          metric_name: group.metricName,
          action_type: actionType,
          attribution_window: attributionWindow,
          value: rawValue != null ? Number(rawValue) : null,
          raw_value: entry,
        });
      }
    }
  }
  return [...deduped.values()];
}

const META_INSIGHT_BASE_FIELDS =
  "ad_id,adset_id,campaign_id,date_start,spend,impressions,reach,frequency,clicks,unique_clicks,inline_link_clicks,cpm,cpc,ctr,cpp,actions,action_values,purchase_roas";

// Video, rankings de subasta, clics reales y recuerdo. Van en un bloque
// separado porque son los que pueden hacer que Meta rechace la peticion:
// entonces se repite sin ellos y los insights siguen entrando.
const META_INSIGHT_EXTRA_FIELDS =
  "video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions,video_avg_time_watched_actions,cost_per_thruplay,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,outbound_clicks,outbound_clicks_ctr,unique_inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,estimated_ad_recallers,estimated_ad_recall_rate,full_view_impressions,full_view_reach,attribution_setting";

export function metaInsightFields(withExtras: boolean) {
  return withExtras
    ? `${META_INSIGHT_BASE_FIELDS},${META_INSIGHT_EXTRA_FIELDS}`
    : META_INSIGHT_BASE_FIELDS;
}

const META_INSIGHT_BREAKDOWNS = "publisher_platform,platform_position,device_platform";

/**
 * Un corte de insights: un desglose distinto es una peticion distinta.
 *
 * Meta no admite pedir todos los desgloses a la vez ni combinarlos entre si,
 * y los rankings de subasta y el video no vienen con cualquier desglose. Por
 * eso los cortes secundarios piden solo los campos base: cruzar demografia
 * con `quality_ranking` haria fallar la peticion entera.
 */
export type MetaInsightCut = {
  scope: string;
  breakdowns: string;
  keys: readonly string[];
  withExtras: boolean;
};

/**
 * El corte canonico: sin desglose ninguno.
 *
 * Es el unico donde `reach` y `frequency` significan algo. Meta deduplica
 * personas dentro de una peticion, no entre peticiones: sumar el alcance de
 * facebook y de instagram cuenta dos veces a quien vio las dos, y no hay
 * forma de saber cuantos son. El gasto y las impresiones si son aditivos,
 * pero el alcance no, asi que el total se pide aparte en vez de derivarse.
 *
 * Los rankings de subasta tampoco vienen con desglose, y llegan aqui.
 */
export const META_TOTAL_CUT: MetaInsightCut = {
  scope: "insights",
  breakdowns: "",
  keys: [],
  withExtras: true,
};

export const META_SECONDARY_CUTS: MetaInsightCut[] = [
  {
    scope: "insights_plataforma",
    breakdowns: META_INSIGHT_BREAKDOWNS,
    keys: META_PLATFORM_BREAKDOWN_KEYS,
    withExtras: false,
  },
  { scope: "insights_demografia", breakdowns: "age,gender", keys: ["age", "gender"], withExtras: false },
  { scope: "insights_pais", breakdowns: "country", keys: ["country"], withExtras: false },
  {
    scope: "insights_hora",
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
    keys: ["hourly_stats_aggregated_by_advertiser_time_zone"],
    withExtras: false,
  },
];
const META_ACTION_ATTRIBUTION_WINDOWS = ["1d_click", "7d_click", "1d_view"];
const ASYNC_REPORT_MAX_POLLS = 30;
const ASYNC_REPORT_POLL_MS = 2000;

export function resolveMetaInsightsMode(env: ApiEnv): MetaInsightsMode {
  return env.META_INSIGHTS_MODE === "async" ? "async" : "sync";
}

export function resolveMetaActionReportTime(
  env: ApiEnv,
): MetaActionReportTime | undefined {
  return env.META_ACTION_REPORT_TIME;
}

export function isMetaInsightsReportComplete(
  status: string | null | undefined,
) {
  return status === "Job Completed" || status === "completed";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type MetaReportContext = {
  supabase: SupabaseClient;
  organizationId: string;
  connectionId: string;
  adAccountRowId: string;
};

// La fila de meta_insight_report_runs es trazabilidad, no dato: si falla al
// guardarse no puede tumbar un sync que si trajo los insights.
async function saveMetaReportRun(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("meta_insight_report_runs")
    .upsert(row, { onConflict: "external_report_run_id" });
  if (error) {
    logger.error("meta_report_run_upsert_failed", {
      external_report_run_id: row.external_report_run_id,
      message: error.message,
    });
  }
}

/**
 * Pide los insights con los campos nuevos y, si Meta rechaza la peticion, la
 * repite sin ellos.
 *
 * ADR-0006 pto 8: no hay forma de comprobar contra una cuenta real que Meta
 * acepte los veintidos campos extra en una sola peticion -- su limite de
 * tamaño depende del volumen de la cuenta y no esta documentado como un
 * numero. Si los rechaza, lo que NO puede pasar es quedarse sin gasto ni
 * conversiones, que es lo unico que hoy llega a una pantalla.
 *
 * El log va como error y nombra que se perdio: desde fuera, una cuenta sin
 * metricas de video se ve igual que una cuenta que solo hace imagen.
 */
async function fetchMetaInsightsWithFallback(
  env: ApiEnv,
  accountId: string,
  accessToken: string,
  window: MetaInsightsWindow,
  mode: MetaInsightsMode,
  cut: MetaInsightCut,
  reportContext?: MetaReportContext,
): Promise<{ rows: InsightNode[]; extrasIncluded: boolean }> {
  if (!cut.withExtras) {
    return {
      rows: await fetchMetaInsights(
        env,
        accountId,
        accessToken,
        window,
        mode,
        cut,
        reportContext,
      ),
      extrasIncluded: true,
    };
  }

  try {
    return {
      rows: await fetchMetaInsights(
        env,
        accountId,
        accessToken,
        window,
        mode,
        cut,
        reportContext,
      ),
      extrasIncluded: true,
    };
  } catch (error) {
    logger.error(
      `Meta rechazo los campos extra de insights de la cuenta ${accountId}; se reintenta sin video, rankings de subasta ni clics salientes`,
      error instanceof Error ? error : new Error(String(error)),
    );

    return {
      rows: await fetchMetaInsights(
        env,
        accountId,
        accessToken,
        window,
        mode,
        { ...cut, withExtras: false },
        reportContext,
      ),
      extrasIncluded: false,
    };
  }
}

async function fetchMetaInsights(
  env: ApiEnv,
  accountId: string,
  accessToken: string,
  window: MetaInsightsWindow,
  mode: MetaInsightsMode,
  cut: MetaInsightCut = META_TOTAL_CUT,
  reportContext?: MetaReportContext,
): Promise<InsightNode[]> {
  const params = {
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({
      since: window.since,
      until: window.until,
    }),
    fields: metaInsightFields(cut.withExtras),
    action_attribution_windows: JSON.stringify(META_ACTION_ATTRIBUTION_WINDOWS),
  };
  // Meta rechaza `breakdowns` vacio: el corte total no lleva el parametro.
  if (cut.breakdowns) {
    Object.assign(params, { breakdowns: cut.breakdowns });
  }
  const actionReportTime = resolveMetaActionReportTime(env);
  if (actionReportTime) {
    Object.assign(params, { action_report_time: actionReportTime });
  }

  if (mode === "sync") {
    return metaGraphGetAll<InsightNode>(
      `${accountId}/insights`,
      accessToken,
      params,
      env.META_APP_SECRET,
    );
  }

  const report = await metaGraphGet<{ report_run_id?: string }>(
    `${accountId}/insights`,
    accessToken,
    { ...params, async: "true" },
    env.META_APP_SECRET,
  );
  const reportRunId = report.report_run_id;
  if (!reportRunId) {
    throw new Error("meta_async_report_id_missing");
  }

  // `request_params` es not null y el upsert reemplaza la fila entera, asi
  // que la base viaja con cada cambio de estado.
  const reportBase = reportContext
    ? {
        organization_id: reportContext.organizationId,
        connection_id: reportContext.connectionId,
        ad_account_id: reportContext.adAccountRowId,
        external_report_run_id: reportRunId,
        level: "ad",
        request_params: params,
      }
    : null;

  if (reportContext && reportBase) {
    await saveMetaReportRun(reportContext.supabase, {
      ...reportBase,
      status: "running",
      percent_complete: 0,
      started_at: new Date().toISOString(),
    });
  }

  for (let poll = 0; poll < ASYNC_REPORT_MAX_POLLS; poll += 1) {
    const status = await metaGraphGet<{
      async_status?: string;
      async_percent_completion?: number;
    }>(reportRunId, accessToken, {
      fields: "async_status,async_percent_completion",
    }, env.META_APP_SECRET);

    if (isMetaInsightsReportComplete(status.async_status)) {
      const rows = await metaGraphGetAll<InsightNode>(
        `${reportRunId}/insights`,
        accessToken,
        {
          // Los mismos campos con los que se pidio: si el reintento sin
          // extras creo el informe, pedirlos aqui lo rompe.
          fields: metaInsightFields(cut.withExtras),
          ...(cut.breakdowns ? { breakdowns: cut.breakdowns } : {}),
          action_attribution_windows: JSON.stringify(META_ACTION_ATTRIBUTION_WINDOWS),
        },
        env.META_APP_SECRET,
      );

      if (reportContext && reportBase) {
        const finishedAt = new Date().toISOString();
        await saveMetaReportRun(reportContext.supabase, {
          ...reportBase,
          status: "completed",
          percent_complete: 100,
          completed_at: finishedAt,
          downloaded_at: finishedAt,
        });
      }

      return rows;
    }

    if (
      status.async_status === "Job Failed" ||
      status.async_status === "failed"
    ) {
      if (reportContext && reportBase) {
        await saveMetaReportRun(reportContext.supabase, {
          ...reportBase,
          status: "failed",
          percent_complete: status.async_percent_completion ?? 0,
          completed_at: new Date().toISOString(),
          error_message: `meta_async_report_failed:${status.async_status}`,
        });
      }
      throw new Error(`meta_async_report_failed:${status.async_status}`);
    }

    if (reportContext && reportBase && status.async_percent_completion != null) {
      await saveMetaReportRun(reportContext.supabase, {
        ...reportBase,
        status: "running",
        percent_complete: status.async_percent_completion,
      });
    }

    await sleep(ASYNC_REPORT_POLL_MS);
  }

  if (reportContext && reportBase) {
    await saveMetaReportRun(reportContext.supabase, {
      ...reportBase,
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: "meta_async_report_timeout",
    });
  }

  throw new Error("meta_async_report_timeout");
}

async function syncAdAccountStructure(
  env: ApiEnv,
  supabase: SupabaseClient,
  organizationId: string,
  adAccountRowId: string,
  externalAdAccountId: string,
  accessToken: string,
): Promise<SyncBlockResult> {
  let read = 0;
  let written = 0;
  const now = new Date().toISOString();

  const campaigns = await metaGraphGetAll<CampaignNode>(
    `${externalAdAccountId}/campaigns`,
    accessToken,
    {
      fields:
        "id,name,objective,buying_type,configured_status,effective_status,special_ad_categories,daily_budget,lifetime_budget,budget_remaining,bid_strategy,start_time,stop_time,created_time,updated_time",
    },
    env.META_APP_SECRET,
  );
  read += campaigns.length;

  const campaignIdMap = new Map<string, string>();

  for (const campaign of campaigns) {
    const { data, error } = await supabase
      .from("meta_campaigns")
      .upsert(
        {
          organization_id: organizationId,
          ad_account_id: adAccountRowId,
          external_campaign_id: campaign.id,
          name: (campaign.name as string) ?? campaign.id,
          objective: (campaign.objective as string) ?? null,
          buying_type: (campaign.buying_type as string) ?? null,
          configured_status: (campaign.configured_status as string) ?? null,
          effective_status: (campaign.effective_status as string) ?? null,
          special_ad_categories: campaign.special_ad_categories ?? null,
          daily_budget:
            campaign.daily_budget != null
              ? Number(campaign.daily_budget) / 100
              : null,
          lifetime_budget:
            campaign.lifetime_budget != null
              ? Number(campaign.lifetime_budget) / 100
              : null,
          budget_remaining:
            campaign.budget_remaining != null
              ? Number(campaign.budget_remaining) / 100
              : null,
          bid_strategy: (campaign.bid_strategy as string) ?? null,
          starts_at: (campaign.start_time as string) ?? null,
          ends_at: (campaign.stop_time as string) ?? null,
          external_created_at: (campaign.created_time as string) ?? null,
          external_updated_at: (campaign.updated_time as string) ?? null,
          raw_data: campaign,
          last_synced_at: now,
        },
        { onConflict: "ad_account_id,external_campaign_id" },
      )
      .select("id")
      .single();

    if (error) {
      throw new Error(`meta_campaign_upsert_failed: ${error.message}`);
    }

    written += 1;
    campaignIdMap.set(campaign.id, data.id);
  }

  const adSets = await metaGraphGetAll<CampaignNode>(
    `${externalAdAccountId}/adsets`,
    accessToken,
    {
      fields:
        "id,name,campaign_id,configured_status,effective_status,optimization_goal,billing_event,bid_strategy,bid_amount,daily_budget,lifetime_budget,budget_remaining,destination_type,promoted_object,targeting,attribution_spec,is_dynamic_creative,learning_stage_info,start_time,end_time,created_time,updated_time",
    },
    env.META_APP_SECRET,
  );
  read += adSets.length;

  const adSetIdMap = new Map<string, string>();

  for (const adSet of adSets) {
    const campaignRowId = campaignIdMap.get(adSet.campaign_id as string);

    // Un conjunto en aprendizaje entrega peor y no es culpa de la
    // creatividad. Sin este dato, cada reinicio de la fase se lee como una
    // caida de rendimiento.
    const learning = adSet.learning_stage_info as
      | { status?: string; exit_reason?: string; conversions?: number }
      | undefined;

    if (!campaignRowId) {
      continue;
    }

    const { data, error } = await supabase
      .from("meta_ad_sets")
      .upsert(
        {
          organization_id: organizationId,
          campaign_id: campaignRowId,
          external_ad_set_id: adSet.id,
          name: (adSet.name as string) ?? adSet.id,
          configured_status: (adSet.configured_status as string) ?? null,
          effective_status: (adSet.effective_status as string) ?? null,
          optimization_goal: (adSet.optimization_goal as string) ?? null,
          billing_event: (adSet.billing_event as string) ?? null,
          bid_strategy: (adSet.bid_strategy as string) ?? null,
          bid_amount:
            adSet.bid_amount != null ? Number(adSet.bid_amount) / 100 : null,
          daily_budget:
            adSet.daily_budget != null
              ? Number(adSet.daily_budget) / 100
              : null,
          lifetime_budget:
            adSet.lifetime_budget != null
              ? Number(adSet.lifetime_budget) / 100
              : null,
          budget_remaining:
            adSet.budget_remaining != null
              ? Number(adSet.budget_remaining) / 100
              : null,
          destination_type: (adSet.destination_type as string) ?? null,
          promoted_object: adSet.promoted_object ?? null,
          targeting_data: adSet.targeting ?? null,
          attribution_spec: adSet.attribution_spec ?? null,
          is_dynamic_creative: Boolean(adSet.is_dynamic_creative),
          learning_stage_status: asText(learning?.status),
          learning_stage_exit_reason: asText(learning?.exit_reason),
          learning_conversions: asInteger(learning?.conversions),
          learning_conversions_needed: learning
            ? META_LEARNING_PHASE_CONVERSIONS
            : null,
          starts_at: (adSet.start_time as string) ?? null,
          ends_at: (adSet.end_time as string) ?? null,
          external_created_at: (adSet.created_time as string) ?? null,
          external_updated_at: (adSet.updated_time as string) ?? null,
          raw_data: adSet,
          last_synced_at: now,
        },
        { onConflict: "campaign_id,external_ad_set_id" },
      )
      .select("id")
      .single();

    if (error) {
      throw new Error(`meta_ad_set_upsert_failed: ${error.message}`);
    }

    written += 1;
    adSetIdMap.set(adSet.id, data.id);
  }

  const creatives = await metaGraphGetAll<CampaignNode>(
    `${externalAdAccountId}/adcreatives`,
    accessToken,
    {
      fields:
        "id,name,object_type,object_story_id,effective_object_story_id,call_to_action_type,body,title,link_url,thumbnail_url,image_hash,video_id,url_tags,object_story_spec,asset_feed_spec,degrees_of_freedom_spec",
    },
    env.META_APP_SECRET,
  );
  read += creatives.length;

  const creativeIdMap = new Map<string, string>();

  for (const creative of creatives) {
    const { data, error } = await supabase
      .from("meta_creatives")
      .upsert(
        {
          organization_id: organizationId,
          ad_account_id: adAccountRowId,
          external_creative_id: creative.id,
          name: (creative.name as string) ?? null,
          object_type: (creative.object_type as string) ?? null,
          object_story_id: (creative.object_story_id as string) ?? null,
          effective_object_story_id:
            (creative.effective_object_story_id as string) ?? null,
          call_to_action_type: (creative.call_to_action_type as string) ?? null,
          primary_text: (creative.body as string) ?? null,
          headline:
            typeof creative.title === "string"
              ? creative.title.slice(0, 500)
              : null,
          link_url: (creative.link_url as string) ?? null,
          thumbnail_url: (creative.thumbnail_url as string) ?? null,
          image_hash: (creative.image_hash as string) ?? null,
          external_video_id:
            creative.video_id != null ? String(creative.video_id) : null,
          url_tags: (creative.url_tags as string) ?? null,
          object_story_spec: creative.object_story_spec ?? null,
          asset_feed_spec: creative.asset_feed_spec ?? null,
          degrees_of_freedom_spec: creative.degrees_of_freedom_spec ?? null,
          raw_data: creative,
          last_synced_at: now,
        },
        { onConflict: "ad_account_id,external_creative_id" },
      )
      .select("id")
      .single();

    if (error) {
      throw new Error(`meta_creative_upsert_failed: ${error.message}`);
    }

    written += 1;
    creativeIdMap.set(creative.id, data.id);

    // Derivado puro de la creatividad que acaba de llegar: no cuesta una
    // peticion mas. La tabla no tiene clave natural (una creatividad puede
    // repetir el mismo texto en dos posiciones), asi que se reescribe
    // entera: es un retrato, no un historico.
    const assetRows = buildMetaCreativeAssetRows(creative);

    const { error: assetDeleteError } = await supabase
      .from("meta_creative_assets")
      .delete()
      .eq("creative_id", data.id);

    if (assetDeleteError) {
      throw new Error(
        `meta_creative_assets_delete_failed: ${assetDeleteError.message}`,
      );
    }

    if (assetRows.length > 0) {
      const { error: assetError } = await supabase
        .from("meta_creative_assets")
        .insert(
          assetRows.map((row) => ({
            ...row,
            organization_id: organizationId,
            creative_id: data.id,
          })),
        );

      if (assetError) {
        throw new Error(
          `meta_creative_assets_insert_failed: ${assetError.message}`,
        );
      }
      written += assetRows.length;
    }
  }

  const ads = await metaGraphGetAll<CampaignNode>(
    `${externalAdAccountId}/ads`,
    accessToken,
    {
      fields:
        "id,name,adset_id,configured_status,effective_status,creative,tracking_specs,conversion_specs,created_time,updated_time",
    },
    env.META_APP_SECRET,
  );
  read += ads.length;

  // Que creatividad lleva ahora mismo cada anuncio: cuando el rendimiento
  // cambia, esto es lo que dice si cambio el anuncio o cambio el mercado.
  const { data: openAssignments, error: assignmentLookupError } =
    await supabase
      .from("meta_ad_creative_assignments")
      .select("id, ad_id, creative_id, valid_from")
      .eq("organization_id", organizationId)
      .is("valid_until", null);

  if (assignmentLookupError) {
    throw new Error(
      `meta_ad_creative_assignments_lookup_failed: ${assignmentLookupError.message}`,
    );
  }

  const openByAd = new Map(
    (openAssignments ?? []).map((row) => [row.ad_id as string, row]),
  );

  for (const ad of ads) {
    const adSetRowId = adSetIdMap.get(ad.adset_id as string);

    if (!adSetRowId) {
      continue;
    }

    const creativeExternalId = (ad.creative as { id?: string } | undefined)?.id;
    const creativeRowId = creativeExternalId
      ? (creativeIdMap.get(creativeExternalId) ?? null)
      : null;

    const { data: adRow, error } = await supabase.from("meta_ads").upsert(
      {
        organization_id: organizationId,
        ad_set_id: adSetRowId,
        current_creative_id: creativeRowId,
        external_ad_id: ad.id,
        name: (ad.name as string) ?? ad.id,
        configured_status: (ad.configured_status as string) ?? null,
        effective_status: (ad.effective_status as string) ?? null,
        tracking_specs: ad.tracking_specs ?? null,
        conversion_specs: ad.conversion_specs ?? null,
        external_created_at: (ad.created_time as string) ?? null,
        external_updated_at: (ad.updated_time as string) ?? null,
        raw_data: ad,
        last_synced_at: now,
      },
      { onConflict: "ad_set_id,external_ad_id" },
    )
      .select("id")
      .single();

    if (error) {
      throw new Error(`meta_ad_upsert_failed: ${error.message}`);
    }

    written += 1;

    if (creativeRowId) {
      const open = openByAd.get(adRow.id);

      if (!open) {
        const { error: openError } = await supabase
          .from("meta_ad_creative_assignments")
          .insert({
            organization_id: organizationId,
            ad_id: adRow.id,
            creative_id: creativeRowId,
            valid_from: asText(ad.updated_time) ?? now,
          });

        if (openError) {
          throw new Error(
            `meta_ad_creative_assignment_insert_failed: ${openError.message}`,
          );
        }
        written += 1;
      } else if (open.creative_id !== creativeRowId) {
        // La tabla exige valid_until > valid_from. Si el cambio se detecta
        // en el mismo instante en que se abrio la fila, se cierra un
        // segundo despues en vez de romper el bloque entero.
        const closedAt = new Date(
          Math.max(
            Date.now(),
            Date.parse(open.valid_from as string) + 1000,
          ),
        ).toISOString();

        const { error: closeError } = await supabase
          .from("meta_ad_creative_assignments")
          .update({ valid_until: closedAt })
          .eq("id", open.id);

        if (closeError) {
          throw new Error(
            `meta_ad_creative_assignment_close_failed: ${closeError.message}`,
          );
        }

        const { error: reopenError } = await supabase
          .from("meta_ad_creative_assignments")
          .insert({
            organization_id: organizationId,
            ad_id: adRow.id,
            creative_id: creativeRowId,
            valid_from: closedAt,
          });

        if (reopenError) {
          throw new Error(
            `meta_ad_creative_assignment_insert_failed: ${reopenError.message}`,
          );
        }
        written += 1;
      }
    }
  }

  return { read, written };
}

async function syncAdAccountInsights(
  env: ApiEnv,
  supabase: SupabaseClient,
  organizationId: string,
  adAccountRowId: string,
  externalAdAccountId: string,
  accessToken: string,
  window: MetaInsightsWindow,
  insightsMode: MetaInsightsMode,
  cut: MetaInsightCut = META_TOTAL_CUT,
  reportContext?: MetaReportContext,
): Promise<SyncBlockResult> {
  let read = 0;
  let written = 0;

  const { rows: insights, extrasIncluded } =
    await fetchMetaInsightsWithFallback(
      env,
      externalAdAccountId,
      accessToken,
      window,
      insightsMode,
      cut,
      reportContext,
    );

  read = insights.length;

  if (!extrasIncluded) {
    logger.info("Meta insights sincronizados sin los campos extra", {
      organization_id: organizationId,
      ad_account_id: externalAdAccountId,
      cut: cut.scope,
      rows: insights.length,
    });
  }

  // Resolucion de ids internos en bloque para no hacer una query por fila.
  const { data: adRows, error: adLookupError } = await supabase
    .from("meta_ads")
    .select("id, external_ad_id, ad_set_id, meta_ad_sets(campaign_id)")
    .eq("organization_id", organizationId);

  if (adLookupError) {
    throw new Error(`meta_ads_lookup_failed: ${adLookupError.message}`);
  }

  const adMap = new Map<
    string,
    { adId: string; adSetId: string; campaignId: string | null }
  >();
  for (const row of adRows ?? []) {
    const adSetRelation = row.meta_ad_sets as unknown as {
      campaign_id?: string;
    } | null;
    adMap.set(row.external_ad_id, {
      adId: row.id,
      adSetId: row.ad_set_id,
      campaignId: adSetRelation?.campaign_id ?? null,
    });
  }

  const syncedAt = new Date().toISOString();
  const validInsightCandidates = insights
    .map((insight) => ({
      insight,
      row: buildMetaInsightRowPayload(
        organizationId,
        adAccountRowId,
        insight,
        insight.ad_id ? adMap.get(insight.ad_id) : undefined,
        syncedAt,
        resolveMetaActionReportTime(env),
        cut.keys,
      ),
    }))
    .filter((item): item is { insight: InsightNode; row: MetaInsightRowPayload } => item.row !== null);
  const validInsights = [
    ...new Map(
      validInsightCandidates.map((item) => [
        `${item.row.external_entity_id}:${item.row.metric_date}:${item.row.breakdown_hash}:${item.row.attribution_hash}:${item.row.action_report_time}`,
        item,
      ]),
    ).values(),
  ];

  if (validInsights.length > 0) {
    const { data: persistedRows, error } = await supabase
      .from("meta_insight_rows_daily")
      .upsert(validInsights.map((item) => item.row), {
        onConflict:
          "ad_account_id,level,external_entity_id,metric_date,breakdown_hash,attribution_hash,action_report_time",
      })
      .select("id, external_entity_id, metric_date, breakdown_hash, attribution_hash, action_report_time");
    if (error) throw new Error(`meta_insight_upsert_failed: ${error.message}`);

    const rowIds = new Map(
      ((persistedRows ?? []) as Array<{ id: string; external_entity_id: string; metric_date: string; breakdown_hash?: string; attribution_hash?: string; action_report_time?: string }>).map(
        (row) => [`${row.external_entity_id}:${row.metric_date}:${row.breakdown_hash ?? "none"}:${row.attribution_hash ?? "default"}:${row.action_report_time ?? "default"}`, row.id],
      ),
    );
    const actionPayloads: MetaActionMetricPayload[] = [];
    for (const item of validInsights) {
      const rowId = rowIds.get(`${item.row.external_entity_id}:${item.row.metric_date}:${item.row.breakdown_hash}:${item.row.attribution_hash}:${item.row.action_report_time}`);
      if (!rowId) throw new Error("meta_insight_row_id_missing_after_upsert");
      actionPayloads.push(...buildMetaActionMetricPayloads(organizationId, rowId, item.insight));
    }

    if (actionPayloads.length > 0) {
      const { error: actionError } = await supabase
        .from("meta_insight_action_metrics")
        .upsert(actionPayloads, {
          onConflict: "insight_row_id,metric_name,action_type,attribution_window",
        });
      if (actionError) throw new Error(`meta_action_metric_upsert_failed: ${actionError.message}`);
    }
    written = validInsights.length;
  }

  return { read, written };
}

// ---------------------------------------------------------------------------
// Bloques independientes (ADR-0006 punto 2). Cada uno tiene su propio scope,
// su try/catch y su fila en integration_sync_runs: que Meta no de acceso al
// pixel no puede dejar sin publicos ni sin gasto a la misma cuenta.
// ---------------------------------------------------------------------------

type MetaNode = Record<string, unknown> & { id?: string };

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asInteger(value: unknown): number | null {
  const parsed = readInsightNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function asBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

// Meta documenta que un conjunto sale de aprendizaje sobre las cincuenta
// conversiones en siete dias, pero no devuelve el numero: lo publica y lo
// deja en manos de quien lo lea.
const META_LEARNING_PHASE_CONVERSIONS = 50;

type MetaCreativeAssetRow = {
  asset_type:
    | "image"
    | "video"
    | "primary_text"
    | "headline"
    | "description"
    | "call_to_action"
    | "link_url"
    | "thumbnail"
    | "other";
  position: number;
  external_asset_id: string | null;
  asset_hash: string | null;
  text_value: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  link_url: string | null;
  asset_label: string | null;
  is_primary: boolean;
  metadata: Record<string, unknown> | null;
};

// Cuantas piezas distintas hay dentro de una creatividad dinamica: el
// `asset_feed_spec` lleva varias listas paralelas y Meta las combina en tiempo
// real. Sin desplegarlas, un anuncio con seis textos y cuatro videos se guarda
// como una sola fila y no hay forma de decir que copy funciono.
const ASSET_FEED_LISTS: Array<{
  key: string;
  type: MetaCreativeAssetRow["asset_type"];
  textField?: string;
}> = [
  { key: "bodies", type: "primary_text", textField: "text" },
  { key: "titles", type: "headline", textField: "text" },
  { key: "descriptions", type: "description", textField: "text" },
  { key: "images", type: "image" },
  { key: "videos", type: "video" },
  { key: "link_urls", type: "link_url" },
  { key: "call_to_action_types", type: "call_to_action" },
];

/**
 * Despliega una creatividad en sus piezas.
 *
 * Es derivado puro de lo que ya trae el bloque de estructura: no cuesta una
 * peticion mas. Devuelve una lista, no la escribe: asi se puede comprobar sin
 * base de datos.
 */
export function buildMetaCreativeAssetRows(
  creative: Record<string, unknown>,
): MetaCreativeAssetRow[] {
  const rows: MetaCreativeAssetRow[] = [];
  const push = (
    type: MetaCreativeAssetRow["asset_type"],
    position: number,
    isPrimary: boolean,
    fields: Partial<MetaCreativeAssetRow>,
  ) => {
    rows.push({
      asset_type: type,
      position,
      external_asset_id: null,
      asset_hash: null,
      text_value: null,
      media_url: null,
      thumbnail_url: null,
      link_url: null,
      asset_label: null,
      is_primary: isPrimary,
      metadata: null,
      ...fields,
    });
  };

  // La creatividad fija: lo que se ve si no hay variantes.
  if (asText(creative.image_hash)) {
    push("image", 0, true, { asset_hash: asText(creative.image_hash) });
  }
  if (creative.video_id != null) {
    push("video", 0, true, { external_asset_id: String(creative.video_id) });
  }
  if (asText(creative.body)) {
    push("primary_text", 0, true, { text_value: asText(creative.body) });
  }
  if (asText(creative.title)) {
    push("headline", 0, true, { text_value: asText(creative.title) });
  }
  if (asText(creative.link_url)) {
    push("link_url", 0, true, { link_url: asText(creative.link_url) });
  }
  if (asText(creative.thumbnail_url)) {
    push("thumbnail", 0, true, {
      thumbnail_url: asText(creative.thumbnail_url),
    });
  }
  if (asText(creative.call_to_action_type)) {
    push("call_to_action", 0, true, {
      text_value: asText(creative.call_to_action_type),
    });
  }

  const feed = creative.asset_feed_spec;
  if (!feed || typeof feed !== "object" || Array.isArray(feed)) {
    return rows;
  }

  for (const list of ASSET_FEED_LISTS) {
    const entries = (feed as Record<string, unknown>)[list.key];
    if (!Array.isArray(entries)) continue;

    entries.forEach((raw, index) => {
      // Las listas de textos traen objetos; la de CTA, cadenas sueltas.
      if (typeof raw === "string") {
        push(list.type, index, false, { text_value: raw });
        return;
      }
      if (!raw || typeof raw !== "object") return;

      const entry = raw as Record<string, unknown>;

      push(list.type, index, false, {
        external_asset_id: asText(entry.video_id),
        asset_hash: asText(entry.image_hash) ?? asText(entry.hash),
        text_value: list.textField ? asText(entry[list.textField]) : null,
        media_url: asText(entry.url) ?? asText(entry.video_url),
        thumbnail_url: asText(entry.thumbnail_url),
        link_url: asText(entry.website_url),
        metadata: entry,
      });
    });
  }

  return rows;
}

/**
 * Datos de la cuenta que solo se ven pidiendo la cuenta en si: como se paga y
 * si sigue viva.
 *
 * Una cuenta con la tarjeta caducada deja de gastar y desde las metricas se ve
 * igual que una campaña pausada a proposito.
 */
async function syncAdAccountProfile(
  env: ApiEnv,
  supabase: SupabaseClient,
  adAccountRowId: string,
  externalAdAccountId: string,
  accessToken: string,
): Promise<SyncBlockResult> {
  const account = await metaGraphGet<MetaNode>(
    externalAdAccountId,
    accessToken,
    {
      fields:
        "funding_source_details,business_country_code,tos_accepted,account_status,disable_reason,amount_spent,balance,spend_cap",
    },
    env.META_APP_SECRET,
  );

  // Meta no devuelve un booleano de terminos: devuelve un mapa de que version
  // se acepto. Vacio o ausente es "no consta", no "no aceptado".
  const tos = account.tos_accepted;
  const hasAcceptedTerms =
    tos && typeof tos === "object" && !Array.isArray(tos)
      ? Object.values(tos as Record<string, unknown>).some((v) => Number(v) > 0)
      : null;

  const { error } = await supabase
    .from("meta_ad_accounts")
    .update({
      funding_source_details: account.funding_source_details ?? null,
      business_country_code: asText(account.business_country_code),
      has_accepted_terms: hasAcceptedTerms,
      account_status_code: asInteger(account.account_status),
      disable_reason_code: asInteger(account.disable_reason),
      amount_spent:
        account.amount_spent != null ? Number(account.amount_spent) / 100 : null,
      balance: account.balance != null ? Number(account.balance) / 100 : null,
      spend_cap:
        account.spend_cap != null ? Number(account.spend_cap) / 100 : null,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", adAccountRowId);

  if (error) {
    throw new Error(`meta_ad_account_profile_update_failed: ${error.message}`);
  }

  return { read: 1, written: 1 };
}

/**
 * Normaliza la respuesta de /{pixel}/stats.
 *
 * ADR-0006 pto 8: la documentacion describe una entrada por bucket con un mapa
 * `value` de evento a recuento, pero no hay forma de comprobarlo sin una cuenta
 * real. Se aceptan las dos formas plausibles y el llamador registra un error si
 * llegaron entradas y no salio ninguna fila: un pixel "sin eventos" y un pixel
 * que no sabemos leer se ven igual desde fuera.
 */
export function parseMetaPixelStats(
  entries: unknown[],
): Array<{ metricDate: string; eventName: string; eventCount: number }> {
  const rows: Array<{
    metricDate: string;
    eventName: string;
    eventCount: number;
  }> = [];

  for (const raw of entries) {
    const entry = raw as Record<string, unknown>;
    const startTime = asText(entry.start_time) ?? asText(entry.timestamp);
    if (!startTime) continue;
    const metricDate = startTime.slice(0, 10);

    const value = entry.value;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      for (const [eventName, count] of Object.entries(
        value as Record<string, unknown>,
      )) {
        const parsed = readInsightNumber(count);
        if (parsed != null) {
          rows.push({ metricDate, eventName, eventCount: parsed });
        }
      }
      continue;
    }

    const eventName = asText(entry.event) ?? asText(entry.action_type);
    const parsed = readInsightNumber(value ?? entry.count);
    if (eventName && parsed != null) {
      rows.push({ metricDate, eventName, eventCount: parsed });
    }
  }

  return rows;
}

async function syncAdAccountPixels(
  env: ApiEnv,
  supabase: SupabaseClient,
  organizationId: string,
  adAccountRowId: string,
  externalAdAccountId: string,
  accessToken: string,
  window: MetaInsightsWindow,
): Promise<SyncBlockResult> {
  let read = 0;
  let written = 0;
  const now = new Date().toISOString();

  const pixels = await metaGraphGetAll<MetaNode>(
    `${externalAdAccountId}/adspixels`,
    accessToken,
    {
      fields:
        "id,name,last_fired_time,is_unavailable,data_use_setting,enable_automatic_matching,first_party_cookie_status,creation_time",
    },
    env.META_APP_SECRET,
  );
  read += pixels.length;

  for (const pixel of pixels) {
    if (!pixel.id) continue;

    const { data: pixelRow, error } = await supabase
      .from("meta_pixels")
      .upsert(
        {
          organization_id: organizationId,
          ad_account_id: adAccountRowId,
          external_pixel_id: pixel.id,
          name: asText(pixel.name),
          last_fired_at: asText(pixel.last_fired_time),
          is_unavailable: asBool(pixel.is_unavailable),
          data_use_setting: asText(pixel.data_use_setting),
          enable_automatic_matching: asBool(pixel.enable_automatic_matching),
          first_party_cookie_status: asText(pixel.first_party_cookie_status),
          external_created_at: asText(pixel.creation_time),
          last_synced_at: now,
        },
        { onConflict: "ad_account_id,external_pixel_id" },
      )
      .select("id")
      .single();

    if (error) {
      throw new Error(`meta_pixel_upsert_failed: ${error.message}`);
    }
    written += 1;

    const stats = await metaGraphGetAll<MetaNode>(
      `${pixel.id}/stats`,
      accessToken,
      {
        aggregation: "event",
        start_time: window.since,
        end_time: window.until,
      },
      env.META_APP_SECRET,
    );
    read += stats.length;

    const parsed = parseMetaPixelStats(stats);

    if (stats.length > 0 && parsed.length === 0) {
      logger.error("meta_pixel_stats_shape_unexpected", {
        organization_id: organizationId,
        pixel_id: pixel.id,
        entries: stats.length,
        keys: Object.keys(stats[0] ?? {}),
      });
    }

    // Meta puede repetir el mismo evento en varios buckets del mismo dia: se
    // suman antes de escribir, o el upsert se pisa a si mismo dentro del lote.
    const byKey = new Map<
      string,
      { metricDate: string; eventName: string; eventCount: number }
    >();
    for (const row of parsed) {
      const key = `${row.metricDate}:${row.eventName}`;
      const previous = byKey.get(key);
      byKey.set(
        key,
        previous
          ? { ...row, eventCount: previous.eventCount + row.eventCount }
          : row,
      );
    }

    if (byKey.size > 0) {
      const { error: statsError } = await supabase
        .from("meta_pixel_daily_stats")
        .upsert(
          [...byKey.values()].map((row) => ({
            organization_id: organizationId,
            pixel_id: pixelRow.id,
            metric_date: row.metricDate,
            event_name: row.eventName,
            event_count: row.eventCount,
          })),
          { onConflict: "pixel_id,metric_date,event_name" },
        );

      if (statsError) {
        throw new Error(`meta_pixel_stats_upsert_failed: ${statsError.message}`);
      }
      written += byKey.size;
    }
  }

  return { read, written };
}

async function syncAdAccountAudiences(
  env: ApiEnv,
  supabase: SupabaseClient,
  organizationId: string,
  adAccountRowId: string,
  externalAdAccountId: string,
  accessToken: string,
): Promise<SyncBlockResult> {
  const now = new Date().toISOString();

  const audiences = await metaGraphGetAll<MetaNode>(
    `${externalAdAccountId}/customaudiences`,
    accessToken,
    {
      fields:
        "id,name,description,subtype,approximate_count_lower_bound,approximate_count_upper_bound,retention_days,operation_status,delivery_status,data_source,lookalike_spec,time_created,time_updated",
    },
    env.META_APP_SECRET,
  );

  let written = 0;

  for (const audience of audiences) {
    if (!audience.id) continue;

    const lookalike = audience.lookalike_spec as
      | {
          origin?: Array<{ id?: string }>;
          ratio?: number;
          country?: string;
        }
      | undefined;

    const { error } = await supabase.from("meta_custom_audiences").upsert(
      {
        organization_id: organizationId,
        ad_account_id: adAccountRowId,
        external_audience_id: audience.id,
        name: asText(audience.name),
        description: asText(audience.description),
        subtype: asText(audience.subtype),
        // Meta nunca da un tamaño exacto: da una horquilla. Se guardan los dos
        // extremos en vez de aparentar una precision que no existe.
        approximate_count_lower: asInteger(
          audience.approximate_count_lower_bound,
        ),
        approximate_count_upper: asInteger(
          audience.approximate_count_upper_bound,
        ),
        retention_days: asInteger(audience.retention_days),
        operation_status: audience.operation_status ?? null,
        delivery_status: audience.delivery_status ?? null,
        data_source: audience.data_source ?? null,
        is_lookalike: Boolean(lookalike),
        lookalike_origin_external_id: asText(lookalike?.origin?.[0]?.id),
        lookalike_ratio: lookalike?.ratio ?? null,
        lookalike_country: asText(lookalike?.country),
        external_created_at: asText(audience.time_created),
        external_updated_at: asText(audience.time_updated),
        last_synced_at: now,
      },
      { onConflict: "ad_account_id,external_audience_id" },
    );

    if (error) {
      throw new Error(`meta_custom_audience_upsert_failed: ${error.message}`);
    }
    written += 1;
  }

  return { read: audiences.length, written };
}

/**
 * Registro de cambios de la cuenta.
 *
 * Sin esto, una caida de resultados no se puede separar de alguien que subio
 * el presupuesto o cambio la puja el martes.
 */
async function syncAdAccountActivities(
  env: ApiEnv,
  supabase: SupabaseClient,
  organizationId: string,
  adAccountRowId: string,
  externalAdAccountId: string,
  accessToken: string,
  window: MetaInsightsWindow,
): Promise<SyncBlockResult> {
  const activities = await metaGraphGetAll<MetaNode>(
    `${externalAdAccountId}/activities`,
    accessToken,
    {
      fields:
        "event_time,event_type,translated_event_type,actor_id,actor_name,object_type,object_id,object_name,extra_data",
      since: window.since,
      until: window.until,
    },
    env.META_APP_SECRET,
  );

  // La clave natural es (instante, tipo, objeto, actor): Meta no da id. Dos
  // filas iguales en el mismo lote romperian el on conflict.
  const deduped = new Map<string, Record<string, unknown>>();

  for (const activity of activities) {
    const eventTime = asText(activity.event_time);
    const eventType = asText(activity.event_type);
    if (!eventTime || !eventType) continue;

    const actorId = asText(activity.actor_id) ?? "";
    const objectId = asText(activity.object_id) ?? "";

    deduped.set(`${eventTime}:${eventType}:${objectId}:${actorId}`, {
      organization_id: organizationId,
      ad_account_id: adAccountRowId,
      event_time: eventTime,
      event_type: eventType,
      translated_event_type: asText(activity.translated_event_type),
      actor_id: actorId,
      actor_name: asText(activity.actor_name),
      object_type: asText(activity.object_type),
      object_external_id: objectId,
      object_name: asText(activity.object_name),
      extra_data: activity.extra_data ?? null,
    });
  }

  if (deduped.size > 0) {
    const { error } = await supabase
      .from("meta_account_activities")
      .upsert([...deduped.values()], {
        onConflict:
          "ad_account_id,event_time,event_type,object_external_id,actor_id",
      });

    if (error) {
      throw new Error(`meta_activity_upsert_failed: ${error.message}`);
    }
  }

  return { read: activities.length, written: deduped.size };
}

/**
 * Problemas de revision por anuncio.
 *
 * Un anuncio rechazado deja de gastar y en las cifras se ve igual que uno que
 * dejo de funcionar. Es un retrato del momento: lo que ya no viene, se borra.
 */
async function syncAdIssues(
  env: ApiEnv,
  supabase: SupabaseClient,
  organizationId: string,
  externalAdAccountId: string,
  accessToken: string,
): Promise<SyncBlockResult> {
  const ads = await metaGraphGetAll<MetaNode>(
    `${externalAdAccountId}/ads`,
    accessToken,
    { fields: "id,issues_info,ad_review_feedback" },
    env.META_APP_SECRET,
  );

  const { data: adRows, error: lookupError } = await supabase
    .from("meta_ads")
    .select("id, external_ad_id, review_feedback")
    .eq("organization_id", organizationId);

  if (lookupError) {
    throw new Error(`meta_ads_lookup_failed: ${lookupError.message}`);
  }

  const adIdMap = new Map(
    (adRows ?? []).map((row) => [
      row.external_ad_id,
      { id: row.id as string, reviewFeedback: row.review_feedback },
    ]),
  );

  const touchedAdIds: string[] = [];
  const issues: Record<string, unknown>[] = [];
  const detectedAt = new Date().toISOString();

  for (const ad of ads) {
    const known = ad.id ? adIdMap.get(ad.id) : undefined;
    if (!known) continue;
    const adRowId = known.id;
    touchedAdIds.push(adRowId);

    // Solo se escribe si cambio. La mayoria de los anuncios no tienen
    // veredicto de revision nunca, y sin esta comparacion cada sync haria
    // una escritura por anuncio para dejar el mismo null.
    const nextFeedback = ad.ad_review_feedback ?? null;
    if (
      JSON.stringify(known.reviewFeedback ?? null) !==
      JSON.stringify(nextFeedback)
    ) {
      const { error: feedbackError } = await supabase
        .from("meta_ads")
        .update({ review_feedback: nextFeedback })
        .eq("id", adRowId);

      if (feedbackError) {
        throw new Error(
          `meta_ad_review_feedback_failed: ${feedbackError.message}`,
        );
      }
    }

    const byCode = new Map<number, Record<string, unknown>>();
    for (const raw of (ad.issues_info as unknown[]) ?? []) {
      const issue = raw as Record<string, unknown>;
      const errorCode = asInteger(issue.error_code) ?? 0;
      byCode.set(errorCode, {
        organization_id: organizationId,
        ad_id: adRowId,
        level: asText(issue.level),
        error_code: errorCode,
        error_type: asText(issue.error_type),
        error_summary: asText(issue.error_summary),
        error_message: asText(issue.error_message),
        detected_at: detectedAt,
      });
    }
    issues.push(...byCode.values());
  }

  if (touchedAdIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("meta_ad_issues")
      .delete()
      .in("ad_id", touchedAdIds);

    if (deleteError) {
      throw new Error(`meta_ad_issues_delete_failed: ${deleteError.message}`);
    }
  }

  if (issues.length > 0) {
    const { error: insertError } = await supabase
      .from("meta_ad_issues")
      .insert(issues);

    if (insertError) {
      throw new Error(`meta_ad_issues_insert_failed: ${insertError.message}`);
    }
  }

  return { read: ads.length, written: issues.length };
}

/**
 * Lo que la propia Meta sugiere sobre cada campaña, conjunto y anuncio.
 *
 * Vale como segunda opinion, no como orden: se guarda para que el consultor la
 * vea. Tambien es un retrato del momento.
 */
async function syncAccountRecommendations(
  env: ApiEnv,
  supabase: SupabaseClient,
  organizationId: string,
  adAccountRowId: string,
  externalAdAccountId: string,
  accessToken: string,
): Promise<SyncBlockResult> {
  const levels: Array<{ edge: string; level: "campaign" | "adset" | "ad" }> = [
    { edge: "campaigns", level: "campaign" },
    { edge: "adsets", level: "adset" },
    { edge: "ads", level: "ad" },
  ];

  let read = 0;
  const deduped = new Map<string, Record<string, unknown>>();
  const detectedAt = new Date().toISOString();

  for (const { edge, level } of levels) {
    const nodes = await metaGraphGetAll<MetaNode>(
      `${externalAdAccountId}/${edge}`,
      accessToken,
      { fields: "id,recommendations" },
      env.META_APP_SECRET,
    );
    read += nodes.length;

    for (const node of nodes) {
      if (!node.id) continue;
      for (const raw of (node.recommendations as unknown[]) ?? []) {
        const recommendation = raw as Record<string, unknown>;
        const code = asInteger(recommendation.code) ?? 0;
        deduped.set(`${level}:${node.id}:${code}`, {
          organization_id: organizationId,
          ad_account_id: adAccountRowId,
          entity_level: level,
          entity_external_id: node.id,
          code,
          title: asText(recommendation.title),
          message: asText(recommendation.message),
          confidence: asText(recommendation.confidence),
          importance: asText(recommendation.importance),
          detected_at: detectedAt,
        });
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("meta_recommendations")
    .delete()
    .eq("ad_account_id", adAccountRowId);

  if (deleteError) {
    throw new Error(`meta_recommendations_delete_failed: ${deleteError.message}`);
  }

  if (deduped.size > 0) {
    const { error } = await supabase
      .from("meta_recommendations")
      .insert([...deduped.values()]);

    if (error) {
      throw new Error(`meta_recommendations_insert_failed: ${error.message}`);
    }
  }

  return { read, written: deduped.size };
}

export async function runMetaSync(
  env: ApiEnv,
  connectionId: string,
  mode: MetaSyncMode = "initial",
) {
  if (!isIntegrationFeatureEnabled("meta_ads", env.INTEGRATION_FEATURE_FLAGS))
    throw new Error("meta_ads_integration_disabled");

  const supabase = createServiceClient(env);

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, organization_id")
    .eq("id", connectionId)
    .single();

  if (connectionError || !connection) {
    throw new Error(
      `meta_sync_connection_load_failed: ${connectionError?.message ?? "not_found"}`,
    );
  }

  const operational = await checkOperationalOrganization(
    supabase,
    connection.organization_id,
  );
  if (isOperationalOrganizationError(operational))
    throw new Error(operational.error);

  const accessToken = await getValidMetaAccessToken(env, connectionId);

  if (!accessToken) {
    throw new Error("meta_access_token_unavailable");
  }

  const { data: adAccounts, error: accountsError } = await supabase
    .from("meta_ad_accounts")
    .select("id, external_ad_account_id")
    .eq("connection_id", connectionId)
    .eq("is_selected", true)
    .eq("is_active", true);

  if (accountsError) {
    throw new Error(`meta_ad_accounts_load_failed: ${accountsError.message}`);
  }

  await supabase
    .from("integration_connections")
    .update({ status: "syncing" })
    .eq("id", connectionId);

  let anyFailed = false;
  // Se acumulan para que el mensaje final de la conexion diga que hacer.
  const blockErrors: string[] = [];

  // Bloques independientes por ADR-0006: cada uno falla o triunfa por su
  // cuenta, con su fila en integration_sync_runs. Que Meta no de acceso al
  // pixel no puede dejar sin gasto a la misma cuenta.
  for (const account of adAccounts ?? []) {
    const organizationId = connection.organization_id as string;
    const external = account.external_ad_account_id as string;
    const window = lookbackWindow(INSIGHTS_LOOKBACK_DAYS[mode]);
    const insightsMode = resolveMetaInsightsMode(env);
    const reportContext: MetaReportContext = {
      supabase,
      organizationId,
      connectionId,
      adAccountRowId: account.id,
    };

    // La estructura va primero y aparte: los problemas por anuncio y los
    // insights necesitan que las filas de anuncio ya existan.
    const structureOk = await recordSyncRun(
      supabase,
      connectionId,
      organizationId,
      `structure:${external}`,
      mode,
      () =>
        syncAdAccountStructure(
          env,
          supabase,
          organizationId,
          account.id,
          external,
          accessToken,
        ),
      undefined,
      blockErrors,
    );

    const blocks: Array<[string, () => Promise<SyncBlockResult>]> = [
      [
        `account:${external}`,
        () =>
          syncAdAccountProfile(env, supabase, account.id, external, accessToken),
      ],
      [
        `${META_TOTAL_CUT.scope}:${external}`,
        () =>
          syncAdAccountInsights(
            env,
            supabase,
            organizationId,
            account.id,
            external,
            accessToken,
            window,
            insightsMode,
            META_TOTAL_CUT,
            reportContext,
          ),
      ],
      // Un corte por desglose, cada uno con su peticion y su fila: si Meta
      // no sirve la demografia, el gasto por plataforma sigue entrando.
      ...META_SECONDARY_CUTS.map(
        (cut): [string, () => Promise<SyncBlockResult>] => [
          `${cut.scope}:${external}`,
          () =>
            syncAdAccountInsights(
              env,
              supabase,
              organizationId,
              account.id,
              external,
              accessToken,
              window,
              insightsMode,
              cut,
              reportContext,
            ),
        ],
      ),
      [
        `pixels:${external}`,
        () =>
          syncAdAccountPixels(
            env,
            supabase,
            organizationId,
            account.id,
            external,
            accessToken,
            window,
          ),
      ],
      [
        `audiences:${external}`,
        () =>
          syncAdAccountAudiences(
            env,
            supabase,
            organizationId,
            account.id,
            external,
            accessToken,
          ),
      ],
      [
        `activities:${external}`,
        () =>
          syncAdAccountActivities(
            env,
            supabase,
            organizationId,
            account.id,
            external,
            accessToken,
            window,
          ),
      ],
      [
        `issues:${external}`,
        () => syncAdIssues(env, supabase, organizationId, external, accessToken),
      ],
      [
        `recommendations:${external}`,
        () =>
          syncAccountRecommendations(
            env,
            supabase,
            organizationId,
            account.id,
            external,
            accessToken,
          ),
      ],
    ];

    let accountFailed = !structureOk;

    for (const [scope, runner] of blocks) {
      const ok = await recordSyncRun(
        supabase,
        connectionId,
        organizationId,
        scope,
        mode,
        runner,
        undefined,
        blockErrors,
      );
      accountFailed = accountFailed || !ok;
    }

    anyFailed = anyFailed || accountFailed;
  }

  const now = new Date().toISOString();
  await supabase
    .from("integration_connections")
    .update({
      status: anyFailed ? "error" : "connected",
      last_sync_at: now,
      ...(anyFailed
        ? {
            last_error_at: now,
            last_error_message: metaConnectionErrorMessage(blockErrors),
          }
        : { last_error_message: null }),
    })
    .eq("id", connectionId);

  // Tras la primera importacion: arranca el backfill historico (24 meses) si
  // hace falta. No bloquea el sync; el avance real lo hace el cron de
  // reconciliacion, un mes por pasada.
  if (mode === "initial" && !anyFailed) {
    try {
      await maybeStartMetaBackfill(
        env,
        supabase,
        connectionId,
        connection.organization_id,
      );
    } catch (error) {
      logger.error("meta_backfill_start_failed", {
        connection_id: connectionId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Backfill historico (plan 2+3). El estado vive en
// integration_connections.metadata.backfill:
//   { status: "running"|"done", from: "YYYY-MM", cursor: "YYYY-MM", pct: 0-100,
//     started_at, completed_at }
// Se procesa un mes por pasada del cron de reconciliacion: throttle natural,
// reanudable (el cursor solo baja cuando el mes acaba bien) e idempotente
// (clave estable por mes en integration_sync_runs).
// ---------------------------------------------------------------------------

const META_BACKFILL_MAX_MONTHS = 24;

export type MetaBackfillState = {
  status: "running" | "done";
  from: string;
  cursor: string;
  pct: number;
  started_at?: string;
  completed_at?: string;
};

function readBackfillState(
  metadata: Record<string, unknown> | null | undefined,
): MetaBackfillState | null {
  const raw = (metadata ?? {})["backfill"];
  if (!raw || typeof raw !== "object") return null;
  const state = raw as Record<string, unknown>;
  if (state.status !== "running" && state.status !== "done") return null;
  const parsed: MetaBackfillState = {
    status: state.status,
    from: String(state.from ?? ""),
    cursor: String(state.cursor ?? ""),
    pct: Number(state.pct ?? 0),
  };
  if (typeof state.started_at === "string") parsed.started_at = state.started_at;
  if (typeof state.completed_at === "string") {
    parsed.completed_at = state.completed_at;
  }
  return parsed;
}

async function writeBackfillState(
  supabase: SupabaseClient,
  connectionId: string,
  state: MetaBackfillState | null,
) {
  const { data } = await supabase
    .from("integration_connections")
    .select("metadata")
    .eq("id", connectionId)
    .single();
  const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
  if (state) {
    metadata.backfill = state;
  } else {
    delete metadata.backfill;
  }
  await supabase
    .from("integration_connections")
    .update({ metadata })
    .eq("id", connectionId);
}

/**
 * Arranca un backfill si la conexion no tiene estado y le faltan datos
 * historicos. `from` = max(hace 24 meses, mes de creacion de la campana mas
 * antigua). `cursor` = el mes anterior al dato mas antiguo que ya tenemos.
 */
export async function maybeStartMetaBackfill(
  env: ApiEnv,
  supabase: SupabaseClient,
  connectionId: string,
  organizationId: string,
): Promise<void> {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("metadata")
    .eq("id", connectionId)
    .single();
  if (readBackfillState(connection?.metadata as Record<string, unknown>)) {
    return; // ya hay un backfill (running o done)
  }

  const floor = addMonths(currentMonth(), -META_BACKFILL_MAX_MONTHS);

  const { data: accountIds } = await supabase
    .from("meta_ad_accounts")
    .select("id")
    .eq("connection_id", connectionId);
  const accountRowIds = (accountIds ?? []).map((row) => row.id as string);

  let campaignFloor = floor;
  if (accountRowIds.length > 0) {
    const { data: oldestCampaign } = await supabase
      .from("meta_campaigns")
      .select("external_created_at")
      .in("ad_account_id", accountRowIds)
      .not("external_created_at", "is", null)
      .order("external_created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (oldestCampaign?.external_created_at) {
      const month = String(oldestCampaign.external_created_at).slice(0, 7);
      if (month > floor) campaignFloor = month;
    }
  }

  const { data: oldestRow } = await supabase
    .from("meta_insight_rows_daily")
    .select("metric_date")
    .eq("organization_id", organizationId)
    .order("metric_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  const startMonth = oldestRow?.metric_date
    ? addMonths(String(oldestRow.metric_date).slice(0, 7), -1)
    : addMonths(currentMonth(), -1);

  if (startMonth < campaignFloor) {
    await writeBackfillState(supabase, connectionId, {
      status: "done",
      from: campaignFloor,
      cursor: campaignFloor,
      pct: 100,
      completed_at: new Date().toISOString(),
    });
    return;
  }

  await writeBackfillState(supabase, connectionId, {
    status: "running",
    from: campaignFloor,
    cursor: startMonth,
    pct: 0,
    started_at: new Date().toISOString(),
  });
  logger.info("meta_backfill_started", {
    connection_id: connectionId,
    from: campaignFloor,
    cursor: startMonth,
  });
}

/**
 * Procesa UN mes del backfill de una conexion (el mes en `cursor`), baja el
 * cursor y persiste el progreso. Devuelve si avanzo y si termino.
 */
export async function backfillMetaConnectionStep(
  env: ApiEnv,
  connectionId: string,
): Promise<{ advanced: boolean; month?: string; done?: boolean }> {
  if (!isIntegrationFeatureEnabled("meta_ads", env.INTEGRATION_FEATURE_FLAGS)) {
    return { advanced: false };
  }
  const supabase = createServiceClient(env);
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id, organization_id, metadata")
    .eq("id", connectionId)
    .single();
  const state = readBackfillState(
    connection?.metadata as Record<string, unknown>,
  );
  if (!connection || !state || state.status !== "running") {
    return { advanced: false };
  }

  const accessToken = await getValidMetaAccessToken(env, connectionId);
  if (!accessToken) return { advanced: false };

  const { data: adAccounts } = await supabase
    .from("meta_ad_accounts")
    .select("id, external_ad_account_id")
    .eq("connection_id", connectionId)
    .eq("is_selected", true)
    .eq("is_active", true);

  const month = state.cursor;
  const window = monthWindow(month);
  let anyFailed = false;

  for (const account of adAccounts ?? []) {
    const ok = await recordSyncRun(
      supabase,
      connectionId,
      connection.organization_id as string,
      `backfill:${month}:${account.external_ad_account_id}`,
      "initial",
      () =>
        syncAdAccountInsights(
          env,
          supabase,
          connection.organization_id as string,
          account.id,
          account.external_ad_account_id,
          accessToken,
          window,
          resolveMetaInsightsMode(env),
        ),
      `meta:backfill:${account.external_ad_account_id}:${connectionId}:${month}`,
    );
    anyFailed = anyFailed || !ok;
  }

  if (anyFailed) {
    // No bajamos el cursor: el proximo tick reintenta el mismo mes.
    return { advanced: false, month };
  }

  const nextCursor = addMonths(month, -1);
  const totalMonths = Math.max(
    1,
    monthsBetween(state.from, addMonths(currentMonth(), -1)),
  );
  const doneMonths = monthsBetween(nextCursor, addMonths(currentMonth(), -1));
  const pct = Math.min(100, Math.round((doneMonths / totalMonths) * 100));

  if (nextCursor < state.from) {
    await writeBackfillState(supabase, connectionId, {
      ...state,
      status: "done",
      cursor: state.from,
      pct: 100,
      completed_at: new Date().toISOString(),
    });
    logger.info("meta_backfill_completed", { connection_id: connectionId });
    return { advanced: true, month, done: true };
  }

  await writeBackfillState(supabase, connectionId, {
    ...state,
    cursor: nextCursor,
    pct,
  });
  return { advanced: true, month, done: false };
}

function monthsBetween(fromMonth: string, toMonth: string): number {
  const from = parseMonth(fromMonth);
  const to = parseMonth(toMonth);
  return (to.year - from.year) * 12 + (to.mon - from.mon);
}

/**
 * Estado del backfill de Meta para una organizacion (la conexion que aun este
 * importando manda). Lo usan el banner del frontend y los agentes (a14/a02)
 * para avisar de que los datos historicos aun no estan completos.
 */
export async function getOrgMetaBackfillStatus(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ status: "running" | "done"; pct: number; from: string } | null> {
  const { data } = await supabase
    .from("integration_connections")
    .select("metadata")
    .eq("provider", "meta_ads")
    .eq("organization_id", organizationId);
  const states = (data ?? [])
    .map((row) => readBackfillState(row.metadata as Record<string, unknown>))
    .filter((state): state is MetaBackfillState => state !== null);
  if (states.length === 0) return null;
  const running = states.find((state) => state.status === "running");
  const chosen = running ?? states[0];
  if (!chosen) return null;
  return { status: chosen.status, pct: chosen.pct, from: chosen.from };
}

/**
 * Reconciliacion periodica de Meta Ads (ADR-0006 punto 4 y guia Meta 10):
 * los webhooks de Meta solo cubren cambios estructurales concretos y nunca
 * sustituyen la reextraccion de Insights, que ademas se reatribuyen dias
 * despues. Recorre las conexiones `connected` y reejecuta el sync en modo
 * incremental; una conexion que falle no interrumpe al resto.
 */
export async function reconcileAllMetaConnections(env: ApiEnv) {
  if (!isIntegrationFeatureEnabled("meta_ads", env.INTEGRATION_FEATURE_FLAGS)) {
    return { total: 0, succeeded: 0, failed: 0, results: [] };
  }

  const supabase = createServiceClient(env);
  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("provider", "meta_ads")
    .eq("status", "connected")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`meta_connections_list_failed: ${error.message}`);

  const results = await mapWithConcurrency(connections ?? [], 3, async (connection) => {
    try {
      const { data: claimedConnection, error: claimError } = await supabase
        .from("integration_connections")
        .update({ status: "syncing" })
        .eq("id", connection.id)
        .eq("status", "connected")
        .select("id")
        .maybeSingle();
      if (claimError) throw new Error(`meta_reconcile_claim_failed: ${claimError.message}`);
      if (!claimedConnection) {
        return { connectionId: connection.id, status: "skipped" as const };
      }

      await runMetaSync(env, connection.id, "incremental");

      // Backfill historico: arranca si falta y avanza un mes por pasada del
      // cron (throttle natural). Un fallo aqui no marca la reconciliacion como
      // fallida: se reintenta el mismo mes en el proximo tick.
      try {
        const stepSupabase = createServiceClient(env);
        const { data: conn } = await stepSupabase
          .from("integration_connections")
          .select("organization_id")
          .eq("id", connection.id)
          .single();
        if (conn) {
          await maybeStartMetaBackfill(
            env,
            stepSupabase,
            connection.id,
            conn.organization_id as string,
          );
        }
        const step = await backfillMetaConnectionStep(env, connection.id);
        if (step.advanced) {
          logger.info("meta_backfill_step", {
            connection_id: connection.id,
            month: step.month,
            done: step.done ?? false,
          });
        }
      } catch (backfillError) {
        logger.error("meta_backfill_step_failed", {
          connection_id: connection.id,
          message:
            backfillError instanceof Error
              ? backfillError.message
              : String(backfillError),
        });
      }

      return { connectionId: connection.id, status: "succeeded" as const };
    } catch (syncError) {
      const detail =
        syncError instanceof Error
          ? syncError.message
          : "meta_reconcile_failed";
      logger.error("meta_reconcile_connection_failed", {
        connection_id: connection.id,
        message: detail,
      });
      return { connectionId: connection.id, status: "failed" as const, detail };
    }
  });

  return {
    total: results.length,
    succeeded: results.filter((item) => item.status === "succeeded").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    results,
  };
}
