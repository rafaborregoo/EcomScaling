import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { isIntegrationFeatureEnabled } from "@e-nora/integrations";
import {
  createKlaviyoClient,
  type KlaviyoReportRequest,
  type KlaviyoReportType,
  type KlaviyoResource,
} from "./klaviyo-client.js";
import { getValidKlaviyoAccessToken } from "./klaviyo-token-store.js";
import { retryAbortedTransaction } from "./request-gate.js";
import { resolveKlaviyoStoreLink } from "./klaviyo-store-link.js";
import { klaviyoReportGroupings } from "./klaviyo-report-groupings.js";
import {
  isKlaviyoPermissionError,
  klaviyoCapability,
  type KlaviyoCapability,
} from "./klaviyo-permissions.js";
import {
  checkOperationalOrganization,
  isOperationalOrganizationError,
  assertConnectionIngestible,
} from "./operational-organization.js";
import { mapWithConcurrency } from "./async-concurrency.js";
import { requiresIntegrationReauthorization } from "./integration-sync-retry.js";
import { syncKlaviyoMarketingBlocks } from "./klaviyo-sync-marketing.js";
import { invalidateIntegrationData } from "./integration-data-cache.js";
import { enqueueIntegrationSync } from "./integration-sync-queue.js";
import { ensureKlaviyoWebhooks } from "./klaviyo-webhooks.js";
import { readKlaviyoFlowDefinitionSummary, summarizeKlaviyoFlowDefinition } from "./klaviyo-flow-definition-summary.js";
import {
  classifyKlaviyoMetricName,
  extractKlaviyoFlowMetricRefs,
  queryKlaviyoFlowMetricVolumes,
  readKlaviyoFlowMetricRefs,
  readStoredKlaviyoMetricVolumeAttempts,
  readStoredKlaviyoMetricVolumes,
  selectKlaviyoMetricIdsForRefresh,
} from "./klaviyo-flow-event-volume.js";

type SyncMode = "initial" | "incremental";

export const KLAVIYO_INCREMENTAL_BUCKET_HOURS = 0.25;
export const KLAVIYO_SYNC_STALE_AFTER_MS = 60 * 60 * 1000;

// Ventana de clicks que se re-pide en cada pasada. Lo anterior ya esta
// guardado: cada click es un evento y traerlo todo crece sin limite.
// Es ventana de DESCARGA, no de atribucion: la de Klaviyo no llega por API.
const KLAVIYO_CLICK_WINDOW_DAYS = 30;
// Tope duro de paginas. Una tienda con mucho volumen no debe poder alargar
// el sync indefinidamente: se trae lo mas reciente y el resto entra en la
// siguiente pasada.
const KLAVIYO_CLICK_MAX_PAGES = 20;

/** El reconciliador corre cada 6 horas; la idempotencia debe usar esa misma ventana. */
export function buildKlaviyoSyncIdempotencyKey(
  connectionId: string,
  mode: SyncMode,
  reference = new Date(),
): string {
  if (mode === "initial") {
    return `klaviyo:${connectionId}:initial:${reference.toISOString().slice(0, 10)}`;
  }
  const bucketMs = KLAVIYO_INCREMENTAL_BUCKET_HOURS * 60 * 60 * 1000;
  const bucketStart = new Date(
    Math.floor(reference.getTime() / bucketMs) * bucketMs,
  );
  return `klaviyo:${connectionId}:incremental:${bucketStart.toISOString()}`;
}

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
    global: { fetch: retryAbortedTransaction() },
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

function nested(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// Rutas candidatas del asunto dentro de campaign-message.attributes, en el
// MISMO orden que el coalesce de klaviyo_email_report (migracion
// 20260829150000). Si ninguna casa, el panel muestra el nombre de la campana y
// el sync deja un log de diagnostico con la forma real del raw_data (ADR-0006
// punto 8) para poder ampliar ambos sitios a la vez.
const KLAVIYO_SUBJECT_PATHS: ReadonlyArray<readonly string[]> = [
  ["definition", "content", "subject"],
  ["content", "subject"],
];

export function extractKlaviyoSubject(rawData: unknown): string | null {
  for (const path of KLAVIYO_SUBJECT_PATHS) {
    const found = nested(rawData, path);
    if (typeof found === "string" && found.trim()) return found;
  }
  return null;
}

/** Igual que el asunto, una ruta por revision de la API. */
export function extractKlaviyoPreviewText(rawData: unknown): string | null {
  for (const path of [
    ["definition", "content", "preview_text"],
    ["content", "preview_text"],
  ]) {
    const found = nested(rawData, path);
    if (typeof found === "string" && found.trim()) return found;
  }
  return null;
}

/**
 * Id de la plantilla de un campaign-message. Vive en `relationships`, NO en
 * `attributes`, asi que hay que mirar el recurso entero: guardar solo los
 * atributos (lo que se venia haciendo) pierde el enlace con el cuerpo del
 * email. Se prueban tambien dos rutas dentro de attributes por si una revision
 * lo devuelve ahi.
 */
export function extractKlaviyoTemplateId(
  resource: Pick<KlaviyoResource, "attributes" | "relationships">,
): string | null {
  const candidates: unknown[] = [
    nested(resource.relationships, ["template", "data", "id"]),
    nested(resource.attributes, ["definition", "template_id"]),
    nested(resource.attributes, ["template_id"]),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return null;
}

/**
 * Tipo de una accion de flujo. Comprobado contra la API real: viaja en
 * `definition.type` con valores en minusculas y guion (`send-email`,
 * `time-delay`), NO en `attributes.action_type` como sugiere la documentacion.
 */
export function extractKlaviyoActionType(rawData: unknown): string | null {
  for (const path of [["definition", "type"], ["action_type"]]) {
    const found = nested(rawData, path);
    if (typeof found === "string" && found.trim()) return found;
  }
  return null;
}

/**
 * El mensaje de una accion de envio viene INCRUSTADO en la propia accion, en
 * `definition.data.message`, con asunto, preheader, remitente y template_id.
 * Es decir: no hace falta pedir `/flow-actions/{id}/flow-messages`, que ademas
 * gastaria una llamada por accion. Que devuelva null es tambien la forma de
 * saber que la accion no envia nada (un retardo, un split).
 */
export function extractKlaviyoFlowMessage(
  rawData: unknown,
): Record<string, unknown> | null {
  const message = nested(rawData, ["definition", "data", "message"]);
  return message && typeof message === "object" && !Array.isArray(message)
    ? (message as Record<string, unknown>)
    : null;
}

/**
 * En las revisiones recientes el canal viaja en `definition.channel`; en las
 * anteriores estaba suelto en `attributes`. Devolver null cuando no se
 * encuentra es deliberado: aguas abajo, null se trata como email (que es lo que
 * el modulo mide) en vez de descartar el mensaje.
 */
export function extractKlaviyoChannel(rawData: unknown): string | null {
  for (const path of [["channel"], ["definition", "channel"]]) {
    const found = nested(rawData, path);
    if (typeof found === "string" && found.trim()) return found;
  }
  return null;
}

/**
 * URL de un evento "Clicked Email". Klaviyo la pone en `event_properties`
 * (comprobado: las propiedades NO estan en `properties`), pero la clave exacta
 * varia entre integraciones -- se han visto `URL`, `url` y `$url`. Se prueban
 * las tres y, si ninguna casa, el sync deja un log con las claves reales para
 * poder ampliar esta lista (ADR-0006 punto 8).
 */
export function extractKlaviyoClickUrl(
  eventProperties: unknown,
): string | null {
  for (const key of ["URL", "url", "$url", "Link", "link"]) {
    const found = nested(eventProperties, [key]);
    if (typeof found === "string" && found.trim()) return found;
  }
  return null;
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
  // Disparo manual desde la UI: ignora la idempotencia (la ventana diaria del
  // `initial` bloqueaba reintentos el mismo día tras un run que quedó
  // `succeeded` con fallos). El cron sigue llamando sin `force`.
  force = false,
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
  assertConnectionIngestible(connection.status);

  const operational = await checkOperationalOrganization(
    client,
    connection.organization_id,
  );
  if (isOperationalOrganizationError(operational))
    throw new Error(operational.error);

  const idempotencyKey = buildKlaviyoSyncIdempotencyKey(connectionId, mode);
  const { data: existingRun } = await client
    .from("integration_sync_runs")
    .select("id, status, records_read, records_written, records_failed")
    .eq("provider", "klaviyo")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (!force && existingRun?.status === "succeeded") {
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
    const storeLink = await resolveKlaviyoStoreLink(client, {
      organizationId: connection.organization_id,
      connectionId,
      externalAccountId: account.id,
    });
    const accountRow = {
      organization_id: connection.organization_id,
      connection_id: connectionId,
      external_account_id: account.id,
      ...(storeLink.storeScopeAvailable ? { store_id: storeLink.storeId } : {}),
      name: text(accountAttributes.name),
      timezone: text(accountAttributes.timezone),
      // La Accounts API lo llama `preferred_currency` (no `currency_code`):
      // leyendo el nombre equivocado la moneda quedaba siempre null y ningun
      // revenue Klaviyo podia compararse con Shopify (fase-10, G-XCA-005).
      currency_code:
        text(accountAttributes.preferred_currency)?.toUpperCase() ?? null,
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

    // Klaviyo exige un filtro de canal para listar campañas (si no, 400 "A
    // channel filter is required to list campaigns") y el único operador que
    // admite para messages.channel es `equals` -- con `any` responde 400. Así
    // que es una petición por canal, cada una con su propio guardarraíl: una
    // cuenta sin SMS no puede tumbar la lista de campañas de email.
    const campaignsPath = (channel: string) =>
      "/campaigns?filter=" +
      encodeURIComponent(`equals(messages.channel,'${channel}')`);

    // ADR-0006 punto 2 y 8: cada recurso del catálogo se pide por separado y con
    // su try/catch. Si Klaviyo cambia el contrato de un endpoint (revisión,
    // filtro obligatorio, forma de respuesta) ese bloque queda vacío esta pasada
    // y se registra, pero el resto del sync (y la cuenta) siguen.
    // Los recursos que esta pasada no ha podido traer. Van al ledger: un run
    // que se anota `succeeded` con `records_failed: 0` mientras tres recursos
    // fallan hace que A12 lea "0 flujos" como "esta tienda no tiene flujos".
    const skipped: string[] = [];
    // Falta elegir la métrica de compra: el sync está bien y reintentarlo no
    // arregla nada. Se avisa en Integraciones sin marcar la conexión como rota.
    let pendingSetup: string | null = null;
    // Un recurso que no llega por falta de permiso no es "un recurso que no
    // llego": es una casilla sin marcar en Klaviyo, y hay que decirlo con ese
    // nombre o nadie sabe que tocar.
    const deniedPermissions: KlaviyoCapability[] = [];
    /**
     * Una fila por bloque en `integration_sync_runs` (ADR-0006 punto 2).
     *
     * Hasta ahora la pasada entera escribia UNA fila con `sync_scope` null, y
     * los bloques best-effort solo dejaban un `console.warn`: cuando un recurso
     * no llegaba, en la base no quedaba ni rastro de cual. La fila de la pasada
     * sigue estando -- es el paraguas --, estas son las de dentro.
     */
    const recordBlockRun = async (
      scope: string,
      startedAt: string,
      result: { read: number; error?: string },
    ) => {
      if (result.error && !skipped.includes(scope)) skipped.push(scope);
      const { error: ledgerError } = await client.from("integration_sync_runs").upsert(
        {
          connection_id: connectionId,
          organization_id: connection.organization_id,
          provider: "klaviyo",
          sync_type: mode === "initial" ? "initial_import" : "incremental",
          sync_scope: scope,
          idempotency_key: `${idempotencyKey}:${scope}`,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          status: result.error ? "failed" : "succeeded",
          records_read: result.read,
          records_written: result.read,
          records_failed: result.error ? 1 : 0,
          error_message: result.error?.slice(0, 500) ?? null,
        },
        { onConflict: "provider,idempotency_key" },
      );
      if (ledgerError) throw new Error(`klaviyo_block_ledger_failed:${ledgerError.message}`);
    };

    const fetchResource = async (
      label: string,
      fetcher: () => Promise<KlaviyoResource[]>,
      capabilityKey?: string,
    ): Promise<KlaviyoResource[]> => {
      const startedAt = new Date().toISOString();
      try {
        const rows = await fetcher();
        await recordBlockRun(label, startedAt, { read: rows.length });
        return rows;
      } catch (error) {
        skipped.push(label);
        const message =
          error instanceof Error ? error.message : "unknown_error";
        const capability = capabilityKey ? klaviyoCapability(capabilityKey) : null;
        if (capability && isKlaviyoPermissionError(message)) {
          deniedPermissions.push(capability);
        }
        console.warn(`klaviyo_resource_skipped:${label}:${message}`);
        await recordBlockRun(label, startedAt, { read: 0, error: message });
        return [];
      }
    };

    // ponytail: sin profile_count. La revisión 2026-07-15 rechaza
    // `additional-fields[list]` en /lists y /segments ("additional-fields must
    // be in []"), así que las listas llegan sin tamaño de audiencia y
    // `profile_count` queda null. Nada lo lee todavía (los *_daily_snapshots
    // están vacíos); cuando haga falta, se pide por lista con su propio
    // endpoint, vigilando la cuota.
    const resources = await Promise.all([
      fetchResource("lists", () => api.listResources("lists"), "lists:read"),
      fetchResource(
        "segments",
        () => api.listResources("segments"),
        "segments:read",
      ),
      fetchResource("flows", () => api.listResources("flows"), "flows:read"),
      fetchResource(
        "campaigns_email",
        () => api.listAll(campaignsPath("email")),
        "campaigns:read",
      ),
      fetchResource(
        "campaigns_sms",
        () => api.listAll(campaignsPath("sms")),
        "campaigns:read",
      ),
      fetchResource("forms", () => api.listResources("forms"), "forms:read"),
      fetchResource(
        "metrics",
        () => api.listResources("metrics"),
        "metrics:read",
      ),
    ]);
    const [
      lists,
      segments,
      flows,
      campaignsEmail,
      campaignsSms,
      forms,
      metrics,
    ] = resources;
    const campaigns = [...campaignsEmail, ...campaignsSms];
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

    // A28 needs trigger/profile filters and the delay/split sequence, which
    // the normal list endpoint deliberately omits. Enrich a small rotating
    // batch only when a flow is new or changed; persist the redacted summary
    // beside the ordinary flow metadata, never Klaviyo's full definition.
    const { data: existingFlowRows, error: existingFlowRowsError } = await client
      .from("klaviyo_flows")
      .select("external_flow_id, raw_data")
      .eq("account_id", accountRowStored.id);
    const existingFlowSummaryById = new Map<string, ReturnType<typeof readKlaviyoFlowDefinitionSummary>>();
    const existingFlowMetricRefsById = new Map<string, string[]>();
    const flowMetricVolumesById = new Map<string, Map<string, { event_type: string; event_count: number; period_start: string; period_end: string; fetched_at: string }>>();
    const flowMetricAttemptsById = new Map<string, Map<string, string>>();
    const definitionAttemptedAtById = new Map<string, string>();
    for (const existing of existingFlowRows ?? []) {
      const externalId = text(existing.external_flow_id);
      if (externalId) {
        const raw = attrs({ attributes: existing.raw_data } as KlaviyoResource);
        existingFlowSummaryById.set(externalId, readKlaviyoFlowDefinitionSummary(raw));
        existingFlowMetricRefsById.set(externalId, readKlaviyoFlowMetricRefs(raw));
        flowMetricVolumesById.set(externalId, new Map(readStoredKlaviyoMetricVolumes(raw).map((entry) => [entry.metric_id, {
          event_type: entry.event_type, event_count: entry.event_count,
          period_start: entry.period_start, period_end: entry.period_end, fetched_at: entry.fetched_at,
        }])));
        flowMetricAttemptsById.set(externalId, new Map(readStoredKlaviyoMetricVolumeAttempts(raw).map((entry) => [entry.metric_id, entry.attempted_at])));
        const attemptedAt = date(raw.a28_flow_structure_attempted_at);
        if (attemptedAt) definitionAttemptedAtById.set(externalId, attemptedAt);
      }
    }
    const definitionStartedAt = new Date().toISOString();
    const definitionAttemptedAt = new Date().toISOString();
    const definitionRetryAfter = Date.now() - 24 * 60 * 60 * 1000;
    let flowDefinitionErrors = 0;
    const flowDefinitionSummaries = new Map<string, NonNullable<ReturnType<typeof summarizeKlaviyoFlowDefinition>>>();
    const flowDefinitionMetricRefs = new Map<string, string[]>();
    const attemptedFlowIds = new Set<string>();
    if (!existingFlowRowsError) {
      const definitionCandidates = flows
        .filter((flow) => {
          const existing = existingFlowSummaryById.get(flow.id);
          const sourceUpdatedAt = date(attrs(flow).updated);
          const attemptedAt = definitionAttemptedAtById.get(flow.id);
          const coolingDown = attemptedAt !== undefined && Date.parse(attemptedAt) > definitionRetryAfter;
          return !coolingDown && (!existing || (sourceUpdatedAt !== null && date(existing.source_updated_at) !== sourceUpdatedAt));
        })
        .slice(0, 6);
      for (const flow of definitionCandidates) attemptedFlowIds.add(flow.id);
      const enriched = await mapWithConcurrency(definitionCandidates, 2, async (flow) => {
        try {
          const response = await api.request<{ data?: KlaviyoResource }>(
            `/flows/${encodeURIComponent(flow.id)}?additional-fields%5Bflow%5D=definition`,
          );
          const summary = summarizeKlaviyoFlowDefinition(response);
          return summary
            ? { externalFlowId: flow.id, summary, metricRefs: extractKlaviyoFlowMetricRefs(response) }
            : null;
        } catch {
          flowDefinitionErrors += 1;
          return null;
        }
      });
      for (const item of enriched) {
        if (!item) continue;
        flowDefinitionSummaries.set(item.externalFlowId, item.summary);
        flowDefinitionMetricRefs.set(item.externalFlowId, item.metricRefs);
      }
    }
    await recordBlockRun("flow_definitions", definitionStartedAt, {
      read: flowDefinitionSummaries.size,
      ...(existingFlowRowsError
        ? { error: "definition_cache_unavailable" }
        : flowDefinitionErrors > 0 ? { error: `definition_fetch_failed:${flowDefinitionErrors}` } : {}),
    });
    // Aggregate event counts are refreshed in the existing six-hour sync, not
    // when a user runs A28. This keeps interactive agent runs read-only and
    // prevents repeated Klaviyo traffic during busy periods.
    const refsByFlow = new Map(flows.map((flow) => [flow.id,
      flowDefinitionMetricRefs.get(flow.id) ?? existingFlowMetricRefsById.get(flow.id) ?? [],
    ]));
    const referencedMetricIds = [...new Set([...refsByFlow.values()].flat())];
    const volumeCacheByMetricId = new Map<string, { event_type: string; event_count: number; period_start: string; period_end: string; fetched_at: string }>();
    const attemptByMetricId = new Map<string, string>();
    for (const values of flowMetricVolumesById.values()) for (const [id, volume] of values) {
      const existing = volumeCacheByMetricId.get(id);
      if (!existing || Date.parse(volume.fetched_at) > Date.parse(existing.fetched_at)) volumeCacheByMetricId.set(id, volume);
    }
    for (const values of flowMetricAttemptsById.values()) for (const [id, attemptedAt] of values) {
      if (!attemptByMetricId.has(id) || Date.parse(attemptedAt) > Date.parse(attemptByMetricId.get(id)!)) attemptByMetricId.set(id, attemptedAt);
    }
    const refreshIds = selectKlaviyoMetricIdsForRefresh(
      referencedMetricIds,
      new Map([...volumeCacheByMetricId].map(([id, volume]) => [id, volume.fetched_at])),
      attemptByMetricId,
    );
    const volumeStartedAt = new Date().toISOString();
    let volumeFailures = 0;
    if (refreshIds.length > 0) {
      const metricNames = new Map(metrics.map((metric) => [metric.id, classifyKlaviyoMetricName(text(attrs(metric).name))]));
      const end = new Date();
      const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      try {
        const volumeResult = await queryKlaviyoFlowMetricVolumes(api, refreshIds, { start, end }, accountRow.timezone ?? "UTC");
        for (const metricId of refreshIds) {
          attemptByMetricId.set(metricId, volumeStartedAt);
          const count = volumeResult.results.get(metricId);
          if (count === undefined) { volumeFailures += 1; continue; }
          volumeCacheByMetricId.set(metricId, {
            event_type: metricNames.get(metricId) ?? "unmapped_metric",
            event_count: count,
            period_start: volumeResult.period_start,
            period_end: volumeResult.period_end,
            fetched_at: volumeStartedAt,
          });
        }
      } catch {
        volumeFailures = refreshIds.length;
        for (const metricId of refreshIds) attemptByMetricId.set(metricId, volumeStartedAt);
      }
    }
    await recordBlockRun("flow_event_volume", volumeStartedAt, {
      read: refreshIds.length - volumeFailures,
      ...(volumeFailures > 0 ? { error: `aggregate_fetch_failed:${volumeFailures}` } : {}),
    });
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
        ...(existingFlowRowsError ? {} : {
          raw_data: {
            ...attrs(row),
            ...((flowDefinitionSummaries.get(row.id) ?? existingFlowSummaryById.get(row.id))
              ? { a28_flow_structure: flowDefinitionSummaries.get(row.id) ?? existingFlowSummaryById.get(row.id) }
              : {}),
            ...(flowDefinitionMetricRefs.has(row.id) || existingFlowMetricRefsById.has(row.id)
              ? { a28_flow_metric_refs: flowDefinitionMetricRefs.get(row.id) ?? existingFlowMetricRefsById.get(row.id) ?? [] }
              : {}),
            ...((refsByFlow.get(row.id)?.length ?? 0) > 0 ? {
              a28_flow_metric_volumes: (refsByFlow.get(row.id) ?? []).flatMap((metricId) => {
                const volume = volumeCacheByMetricId.get(metricId);
                return volume ? [{ metric_id: metricId, ...volume }] : [];
              }),
              a28_flow_metric_volume_attempts: (refsByFlow.get(row.id) ?? []).flatMap((metricId) => {
                const attemptedAt = attemptByMetricId.get(metricId);
                return attemptedAt ? [{ metric_id: metricId, attempted_at: attemptedAt }] : [];
              }),
            } : {}),
            ...((attemptedFlowIds.has(row.id) ? definitionAttemptedAt : definitionAttemptedAtById.get(row.id))
              ? { a28_flow_structure_attempted_at: attemptedFlowIds.has(row.id) ? definitionAttemptedAt : definitionAttemptedAtById.get(row.id) }
              : {}),
          },
        }),
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
    // Para clasificar las audiencias de una campana hace falta saber si un
    // id externo es lista o segmento, y como se llama.
    const listIdsExternos = new Set(lists.map((row) => row.id));
    const segmentIdsExternos = new Set(segments.map((row) => row.id));
    const nombresAudiencia = new Map<string, string>();
    for (const row of [...lists, ...segments]) {
      const nombre = text(attrs(row).name);
      if (nombre) nombresAudiencia.set(row.id, nombre);
    }

    // Ids de plantilla que citan los mensajes de campana y de flujo. Se
    // resuelven al final, de una vez y sin repetir.
    const templateIds = new Set<string>();

    // Mensajes de campana: traen el ASUNTO real (dentro de raw_data), que el
    // panel de email y el agente A12 usan para el ranking de asuntos. El
    // rendimiento sigue siendo a nivel de campana (klaviyo_report_values), asi
    // que basta con el mensaje de cada campana; los flow-messages se dejan para
    // cuando haya reporting a nivel de flow-message. Best-effort: si el
    // endpoint o la forma de la respuesta cambian, se registra y NO se tumba el
    // resto del sync (que ya funciona).
    let campaignMessagesWritten = 0;
    const campaignMessagesStartedAt = new Date().toISOString();
    try {
      const { data: storedCampaigns } = await client
        .from("klaviyo_campaigns")
        .select("id, external_campaign_id")
        .eq("account_id", accountRowStored.id);

      let campaignsWithMessageError = 0;
      const campaignMessageRows = (
        await mapWithConcurrency(storedCampaigns ?? [], 3, async (campaign) => {
          let messages: KlaviyoResource[];
          try {
            messages = await api.listAll(
              `/campaigns/${campaign.external_campaign_id}/campaign-messages`,
            );
          } catch {
            // Una campaña con relación rota no debe perder las de las demás.
            campaignsWithMessageError += 1;
            return [];
          }
          return messages.map((message) => ({
            organization_id: connection.organization_id,
            campaign_id: campaign.id,
            external_message_id: message.id,
            // Las columnas existian desde el principio y nadie las rellenaba:
            // el asunto se leia de raw_data en SQL y la plantilla no se leia en
            // ningun sitio. Con external_template_id puesto, el mensaje ya
            // enlaza con su cuerpo en klaviyo_templates.
            external_template_id: extractKlaviyoTemplateId(message),
            subject: extractKlaviyoSubject(attrs(message)),
            preview_text: extractKlaviyoPreviewText(attrs(message)),
            channel: extractKlaviyoChannel(attrs(message)),
            status: text(attrs(message).status),
            raw_data: attrs(message),
          }));
        })
      ).flat();

      await upsertRows(
        client,
        "klaviyo_campaign_messages",
        campaignMessageRows,
        "campaign_id,external_message_id",
      );
      campaignMessagesWritten = campaignMessageRows.length;
      await recordBlockRun("campaign_messages", campaignMessagesStartedAt, {
        read: campaignMessagesWritten,
      });
      for (const row of campaignMessageRows) {
        if (row.external_template_id) templateIds.add(row.external_template_id);
      }
      if (campaignsWithMessageError > 0) {
        console.warn(
          `klaviyo_campaign_messages_partial:${campaignsWithMessageError}/${
            storedCampaigns?.length ?? 0
          } campañas sin mensajes esta pasada`,
        );
      }

      // Verificacion del supuesto de la ruta del asunto contra datos reales
      // (ADR-0006 punto 8). Solo cuentan los mensajes de email; si una parte no
      // resuelve asunto con las rutas conocidas, se registra la forma real del
      // primer raw_data sin resolver para poder ampliar KLAVIYO_SUBJECT_PATHS y
      // el coalesce de la funcion SQL.
      const emailMessages = campaignMessageRows.filter(
        (row) => row.channel === "email" || row.channel === null,
      );

      // Mismo control para la plantilla: sin external_template_id el mensaje se
      // queda sin cuerpo, y eso hay que verlo en los logs y no descubrirlo
      // cuando un agente escriba sobre emails que no ha podido leer.
      const withoutTemplate = emailMessages.filter(
        (row) => row.external_template_id === null,
      );
      if (emailMessages.length > 0 && withoutTemplate.length > 0) {
        console.warn(
          `klaviyo_template_id_unresolved:${withoutTemplate.length}/${emailMessages.length}`,
        );
      }

      const unresolved = emailMessages.filter(
        (row) => extractKlaviyoSubject(row.raw_data) === null,
      );
      if (emailMessages.length > 0 && unresolved.length > 0) {
        const sample = unresolved[0]?.raw_data;
        console.warn(
          `klaviyo_subject_path_unresolved:${unresolved.length}/${emailMessages.length}:` +
            `keys=${
              sample && typeof sample === "object"
                ? Object.keys(sample as Record<string, unknown>).join(",")
                : typeof sample
            }:content_keys=${
              (() => {
                const content = nested(sample, ["definition", "content"]) ??
                  nested(sample, ["content"]);
                return content && typeof content === "object"
                  ? Object.keys(content as Record<string, unknown>).join(",")
                  : typeof content;
              })()
            }`,
        );
      }
    } catch (error) {
      // ADR-0006 punto 8: log de diagnostico si un supuesto de la doc del
      // proveedor no se cumple (endpoint, paginacion, forma de la respuesta).
      console.warn(
        `klaviyo_campaign_messages_sync_skipped:${
          error instanceof Error ? error.message : "unknown_error"
        }`,
      );
      await recordBlockRun("campaign_messages", campaignMessagesStartedAt, {
        read: 0,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }

    // Acciones y mensajes de los flujos. En ecommerce la mayor parte del
    // ingreso por email sale de los flujos (bienvenida, carrito abandonado,
    // postcompra), no de las campanas, y hasta ahora klaviyo_flow_actions y
    // klaviyo_flow_messages estaban creadas y vacias: del lado del flujo no
    // teniamos ni el asunto ni el cuerpo, solo el nombre.
    //
    // Mismo patron que los mensajes de campana: best-effort, un fallo aqui no
    // tumba el resto de la pasada.
    let flowMessagesWritten = 0;
    const flowMessagesStartedAt = new Date().toISOString();
    try {
      const { data: storedFlows } = await client
        .from("klaviyo_flows")
        .select("id, external_flow_id")
        .eq("account_id", accountRowStored.id);

      let flowsWithActionError = 0;
      const actionRows = (
        await mapWithConcurrency(storedFlows ?? [], 3, async (flow) => {
          let actions: KlaviyoResource[];
          try {
            actions = await api.listAll(
              `/flows/${flow.external_flow_id}/flow-actions`,
            );
          } catch {
            flowsWithActionError += 1;
            return [];
          }
          return actions.map((action) => ({
            organization_id: connection.organization_id,
            flow_id: flow.id,
            external_action_id: action.id,
            // Un tipo desconocido se guarda como tal en vez de perder la
            // accion entera.
            action_type: extractKlaviyoActionType(attrs(action)) ?? "unknown",
            status: text(nested(attrs(action), ["definition", "data", "status"])),
            settings_data: nested(attrs(action), ["definition", "data"]) ?? null,
            external_created_at: date(attrs(action).created),
            external_updated_at: date(attrs(action).updated),
            raw_data: attrs(action),
            last_synced_at: now,
          }));
        })
      ).flat();

      if (actionRows.length > 0) {
        await upsertRows(
          client,
          "klaviyo_flow_actions",
          actionRows,
          "flow_id,external_action_id",
        );

        // El mensaje ya venia dentro de la accion, asi que no hay ninguna
        // llamada mas que hacer: se lee del raw_data que acabamos de guardar.
        // klaviyo_flow_messages cuelga del FLUJO (unique flow_id +
        // external_message_id) y guarda la accion como puntero opcional, para
        // que el mensaje sobreviva si la accion desaparece.
        const { data: storedActions } = await client
          .from("klaviyo_flow_actions")
          .select("id, flow_id, external_action_id, raw_data")
          .in(
            "flow_id",
            (storedFlows ?? []).map((flow) => flow.id),
          );

        const flowMessageRows = (storedActions ?? []).flatMap((action) => {
          const message = extractKlaviyoFlowMessage(action.raw_data);
          const externalMessageId = message?.id;
          if (!message || typeof externalMessageId !== "string") return [];
          return [
            {
              organization_id: connection.organization_id,
              flow_id: action.flow_id,
              action_id: action.id,
              external_message_id: externalMessageId,
              external_template_id: text(message.template_id),
              // El canal se deduce del tipo de accion ("send-email"): el
              // mensaje incrustado no lo lleva.
              channel:
                extractKlaviyoActionType(action.raw_data)?.replace(
                  /^send-/,
                  "",
                ) ?? "email",
              name: text(message.name),
              // Aqui el asunto se llama `subject_line`, no `subject`.
              subject: text(message.subject_line),
              preview_text: text(message.preview_text),
              from_email: text(message.from_email),
              from_label: text(message.from_label),
              reply_to_email: text(message.reply_to_email),
              raw_data: message,
              last_synced_at: now,
            },
          ];
        });

        if (flowMessageRows.length > 0) {
          await upsertRows(
            client,
            "klaviyo_flow_messages",
            flowMessageRows,
            "flow_id,external_message_id",
          );
          flowMessagesWritten = flowMessageRows.length;

          await recordBlockRun("flow_messages", flowMessagesStartedAt, {

            read: flowMessageRows.length,

          });
          for (const row of flowMessageRows) {
            if (row.external_template_id)
              templateIds.add(row.external_template_id);
          }
        }
      }

      if (flowsWithActionError > 0) {
        console.warn(
          `klaviyo_flow_actions_partial:${flowsWithActionError}/${
            storedFlows?.length ?? 0
          } flujos sin acciones esta pasada`,
        );
      }
    } catch (error) {
      console.warn(
        `klaviyo_flow_messages_sync_skipped:${
          error instanceof Error ? error.message : "unknown_error"
        }`,
      );
      await recordBlockRun("flow_messages", flowMessagesStartedAt, {
        read: 0,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }

    // Audiencias de cada campana: a quien se le mando y a quien se excluyo.
    // No hace falta ninguna llamada -- vienen dentro de la campana que ya
    // tenemos (raw_data.audiences), y la tabla llevaba vacia desde agosto
    // simplemente porque nadie la escribia.
    const campaignAudiencesStartedAt = new Date().toISOString();
    try {
      const { data: campanasGuardadas } = await client
        .from("klaviyo_campaigns")
        .select("id, raw_data")
        .eq("account_id", accountRowStored.id);

      const audienceRows = ((campanasGuardadas ?? []) as Array<{
        id: string;
        raw_data: unknown;
      }>).flatMap((campana) => {
        const incluidas = nested(campana.raw_data, ["audiences", "included"]);
        const excluidas = nested(campana.raw_data, ["audiences", "excluded"]);
        const filas: Array<Record<string, unknown>> = [];

        // Klaviyo no dice si un id incluido es lista o segmento, asi que se
        // resuelve contra lo que ya hemos sincronizado. Lo excluido va como
        // "excluded" sea lo que sea: para el consultor lo que importa es que
        // no lo recibe.
        const clasificar = (externalId: string): string =>
          listIdsExternos.has(externalId)
            ? "list"
            : segmentIdsExternos.has(externalId)
              ? "segment"
              : "list";

        if (Array.isArray(incluidas)) {
          for (const externalId of incluidas) {
            if (typeof externalId !== "string") continue;
            filas.push({
              organization_id: connection.organization_id,
              campaign_id: campana.id,
              audience_type: clasificar(externalId),
              external_audience_id: externalId,
              name: nombresAudiencia.get(externalId) ?? null,
              raw_data: { included: true },
            });
          }
        }
        if (Array.isArray(excluidas)) {
          for (const externalId of excluidas) {
            if (typeof externalId !== "string") continue;
            filas.push({
              organization_id: connection.organization_id,
              campaign_id: campana.id,
              audience_type: "excluded",
              external_audience_id: externalId,
              name: nombresAudiencia.get(externalId) ?? null,
              raw_data: { included: false },
            });
          }
        }
        return filas;
      });

      await upsertRows(
        client,
        "klaviyo_campaign_audiences",
        audienceRows,
        "campaign_id,audience_type,external_audience_id",
      );
      await recordBlockRun("campaign_audiences", campaignAudiencesStartedAt, {
        read: audienceRows.length,
      });
    } catch (error) {
      console.warn(
        `klaviyo_campaign_audiences_sync_skipped:${
          error instanceof Error ? error.message : "unknown_error"
        }`,
      );
      await recordBlockRun("campaign_audiences", campaignAudiencesStartedAt, {
        read: 0,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }

    // Tamano de listas y segmentos, un snapshot por dia.
    //
    // `profile_count` NO se puede pedir en el listado -- la revision
    // 2026-07-15 responde "additional-fields must be in []" -- pero SI en el
    // recurso suelto. Comprobado contra la cuenta real. Por eso es una
    // peticion por lista y por segmento en vez de dos en total: con un puñado
    // de cada uno es asumible, y es la unica forma de tener el dato.
    const audienceSnapshotsStartedAt = new Date().toISOString();
    try {
      const snapshotDate = now.slice(0, 10);

      const contar = async (
        recurso: string,
        externalId: string,
      ): Promise<number | null> => {
        try {
          const response = await api.request<{
            data?: { attributes?: Record<string, unknown> };
          }>(
            `/${recurso}s/${externalId}?additional-fields[${recurso}]=profile_count`,
          );
          return integer(response.data?.attributes?.profile_count);
        } catch {
          return null;
        }
      };

      const { data: listasGuardadas } = await client
        .from("klaviyo_lists")
        .select("id, external_list_id")
        .eq("account_id", accountRowStored.id);
      const listSnapshots = (
        await mapWithConcurrency(
          (listasGuardadas ?? []) as Array<{
            id: string;
            external_list_id: string;
          }>,
          3,
          async (lista) => {
            const count = await contar("list", lista.external_list_id);
            // Sin cuenta no se escribe fila: un snapshot con 0 inventado
            // pareceria una lista que se vacio de golpe.
            return count === null
              ? []
              : [
                  {
                    organization_id: connection.organization_id,
                    list_id: lista.id,
                    snapshot_date: snapshotDate,
                    profile_count: count,
                    source: "live",
                  },
                ];
          },
        )
      ).flat();
      await upsertRows(
        client,
        "klaviyo_list_daily_snapshots",
        listSnapshots,
        "list_id,snapshot_date",
      );

      const { data: segmentosGuardados } = await client
        .from("klaviyo_segments")
        .select("id, external_segment_id")
        .eq("account_id", accountRowStored.id);
      const segmentSnapshots = (
        await mapWithConcurrency(
          (segmentosGuardados ?? []) as Array<{
            id: string;
            external_segment_id: string;
          }>,
          3,
          async (segmento) => {
            const count = await contar(
              "segment",
              segmento.external_segment_id,
            );
            return count === null
              ? []
              : [
                  {
                    organization_id: connection.organization_id,
                    segment_id: segmento.id,
                    snapshot_date: snapshotDate,
                    profile_count: count,
                    source: "live",
                  },
                ];
          },
        )
      ).flat();
      await upsertRows(
        client,
        "klaviyo_segment_daily_snapshots",
        segmentSnapshots,
        "segment_id,snapshot_date",
      );
      await recordBlockRun("audience_snapshots", audienceSnapshotsStartedAt, {
        read: segmentSnapshots.length,
      });
    } catch (error) {
      console.warn(
        `klaviyo_audience_snapshots_skipped:${
          error instanceof Error ? error.message : "unknown_error"
        }`,
      );
      await recordBlockRun("audience_snapshots", audienceSnapshotsStartedAt, {
        read: 0,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }

    let clicksWritten = 0;
    const clicksStartedAt = new Date().toISOString();
    // Clicks en enlaces: que CTA se pulsa, no solo cuanta gente pulsa algo.
    //
    // Los eventos "Clicked Email" son los unicos que llevan la URL. Se piden
    // por el id de la metrica de la propia cuenta y solo de la ventana
    // reciente: cada click es un evento, asi que traerlo todo cada pasada
    // crece sin limite y no aporta -- lo viejo ya esta guardado.
    try {
      const clickMetric = metrics.find(
        (row) => text(attrs(row).name) === "Clicked Email",
      );

      if (clickMetric) {
        const desde = new Date(
          Date.now() - KLAVIYO_CLICK_WINDOW_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();
        const eventos = await api.listAll(
          "/events?filter=" +
            encodeURIComponent(
              `and(equals(metric_id,'${clickMetric.id}'),greater-than(datetime,${desde}))`,
            ) +
            "&sort=-datetime",
          { maxPages: KLAVIYO_CLICK_MAX_PAGES },
        );

        const clickRows = eventos.map((evento) => {
          const propiedades = attrs(evento).event_properties;
          return {
            organization_id: connection.organization_id,
            account_id: accountRowStored.id,
            external_event_id: evento.id,
            occurred_at:
              date(attrs(evento).datetime) ?? new Date().toISOString(),
            url: extractKlaviyoClickUrl(propiedades),
            external_message_id: text(nested(propiedades, ["$message"])),
            external_profile_id: text(
              nested(evento.relationships, ["profile", "data", "id"]),
            ),
            raw_data: propiedades ?? {},
          };
        });

        await upsertRows(
          client,
          "klaviyo_email_click_events",
          clickRows,
          "account_id,external_event_id",
        );
        clicksWritten = clickRows.length;

        await recordBlockRun("click_events", clicksStartedAt, {

          read: clickRows.length,

        });

        // Sin URL el click no sirve para nada de lo que existe esta tabla.
        // Si pasa, hay que ver la clave real antes de suponerla.
        const sinUrl = clickRows.filter((row) => row.url === null);
        if (sinUrl.length > 0) {
          const muestra = sinUrl[0]?.raw_data;
          console.warn(
            `klaviyo_click_url_unresolved:${sinUrl.length}/${clickRows.length}:` +
              `keys=${
                muestra && typeof muestra === "object"
                  ? Object.keys(muestra as Record<string, unknown>).join(",")
                  : typeof muestra
              }`,
          );
        }
      } else {
        console.warn(
          "klaviyo_click_metric_missing: la cuenta no expone la metrica Clicked Email",
        );
      }
    } catch (error) {
      console.warn(
        `klaviyo_click_events_skipped:${
          error instanceof Error ? error.message : "unknown_error"
        }`,
      );
      await recordBlockRun("click_events", clicksStartedAt, {
        read: 0,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }

    // Plantillas (el cuerpo del email), resueltas UNA A UNA por id.
    //
    // Comprobado contra la API real: `/templates` devuelve una lista VACIA
    // aunque las plantillas existan -- ahi solo aparece la biblioteca guardada,
    // no las que se crean dentro de una campana o un flujo, que son
    // precisamente las que nos interesan. Por id (`/templates/{id}`) se
    // recuperan sin problema. Ademas asi solo se pide lo que algun mensaje
    // referencia, que es mas barato en cuota que listar.
    let templatesWritten = 0;
    const templatesStartedAt = new Date().toISOString();
    if (templateIds.size > 0) {
      try {
        const templateRows = (
          await mapWithConcurrency([...templateIds], 3, async (templateId) => {
            try {
              const response = await api.request<{ data?: KlaviyoResource }>(
                `/templates/${templateId}`,
              );
              const template = response.data;
              if (!template) return [];
              const { html, text: plain, ...rest } = attrs(template);
              return [
                {
                  organization_id: connection.organization_id,
                  account_id: accountRowStored.id,
                  external_template_id: template.id,
                  name: text(attrs(template).name),
                  editor_type: text(attrs(template).editor_type),
                  html_content: text(html),
                  // ponytail: Klaviyo devuelve `text` vacio en las plantillas
                  // del editor visual (genera el texto al enviar). Los agentes
                  // necesitaran el HTML convertido a texto; se hace al
                  // construir su contexto, no aqui, para no reprocesar en cada
                  // sync.
                  text_content: text(plain),
                  external_created_at: date(attrs(template).created),
                  external_updated_at: date(attrs(template).updated),
                  raw_data: rest,
                  last_synced_at: now,
                },
              ];
            } catch {
              // Una plantilla borrada en Klaviyo no debe costar las demas.
              return [];
            }
          })
        ).flat();

        await upsertRows(
          client,
          "klaviyo_templates",
          templateRows,
          "account_id,external_template_id",
        );
        templatesWritten = templateRows.length;

        await recordBlockRun("templates", templatesStartedAt, {

          read: templateRows.length,

        });

        if (templateRows.length < templateIds.size) {
          console.warn(
            `klaviyo_templates_partial:${templateRows.length}/${templateIds.size} plantillas resueltas`,
          );
        }
      } catch (error) {
        console.warn(
          `klaviyo_templates_sync_skipped:${
            error instanceof Error ? error.message : "unknown_error"
          }`,
        );
        await recordBlockRun("templates", templatesStartedAt, {
          read: 0,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    // Bloques de Marketing (diagramas de flows, audiencias, series diarias,
    // formularios, catálogo de plantillas). Cada uno se protege solo.
    try {
      // Select only the unambiguous official Shopify revenue metric. A custom
      // event with the same name must never silently become the revenue source.
      const officialOrders = metrics.filter((metric) => {
        const attributes = attrs(metric);
        const integration = attributes.integration as { key?: string; name?: string } | undefined;
        return attributes.name === "Placed Order" &&
          (integration?.key?.toLowerCase() === "shopify" || integration?.name?.toLowerCase() === "shopify");
      });
      if (officialOrders.length === 1) {
        const { error: selectionError } = await client.from("klaviyo_accounts")
          .update({ conversion_metric_id: officialOrders[0]!.id })
          .eq("id", accountRowStored.id).is("conversion_metric_id", null);
        if (selectionError) throw selectionError;
      }
      const { data: accountMetric, error: metricReadError } = await client
        .from("klaviyo_accounts")
        .select("conversion_metric_id")
        .eq("id", accountRowStored.id)
        .maybeSingle();
      if (metricReadError) throw metricReadError;
      if (!accountMetric?.conversion_metric_id) pendingSetup = "klaviyo_conversion_metric_not_selected";
      await syncKlaviyoMarketingBlocks({
        client,
        api,
        organizationId: connection.organization_id,
        accountId: accountRowStored.id,
        mode,
        conversionMetricId: (accountMetric?.conversion_metric_id as string | null) ?? null,
        metrics,
        lists,
        segments,
        recordBlockRun,
      });
    } catch (error) {
      if (!skipped.includes("marketing_blocks")) skipped.push("marketing_blocks");
      console.warn(
        `klaviyo_marketing_blocks_skipped:${error instanceof Error ? error.message : "unknown_error"}`,
      );
    }

    const recordsRead =
      resources.reduce((sum, rows) => sum + rows.length, 0) +
      1 +
      campaignMessagesWritten +
      flowMessagesWritten +
      templatesWritten +
      clicksWritten;
    await invalidateIntegrationData(env.REDIS_URL, connection.organization_id);
    await ensureKlaviyoWebhooks(env, connectionId).catch((error: unknown) => console.warn("Klaviyo webhook verification deferred", { connection_id: connectionId, error: error instanceof Error ? error.message : "unknown_error" }));
    await client
      .from("integration_sync_runs")
      .update({
        status: skipped.length ? "partial" : "succeeded",
        records_read: recordsRead,
        records_written: recordsRead,
        // Limpia el rastro de un intento fallido anterior sobre la misma fila
        // (mismo idempotency_key): si esta pasada completó, no debe seguir
        // mostrando el error de la anterior en la UI. Pero si algún recurso se
        // quedó fuera, se dice: el catálogo está incompleto y quien lo lea
        // tiene que saberlo antes de concluir que algo no existe.
        records_failed: skipped.length,
        error_message: skipped.length
          ? permissionAwareSkipMessage(skipped, deniedPermissions)
          : null,
        finished_at: now,
      })
      .eq("id", syncRun.id);
    await client
      .from("integration_connections")
      .update({
        status: skipped.length ? "error" : "connected",
        last_sync_at: now,
        last_error_at: skipped.length ? new Date().toISOString() : null,
        last_error_message: skipped.length ? permissionAwareSkipMessage(skipped, deniedPermissions) : pendingSetup,
      })
      .eq("id", connectionId);
    return {
      status: skipped.length ? "partial" as const : "succeeded" as const,
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

// Estadisticas que Klaviyo solo sabe calcular si la metrica de conversion
// elegida lleva valor economico. Con una que no lo lleve, la API NO ignora
// estas cuatro: rechaza el informe entero con 400.
const VALUE_STATISTICS = new Set([
  "conversion_rate",
  "conversion_uniques",
  "conversion_value",
  "revenue_per_recipient",
]);

/**
 * Comprobado contra la cuenta real el 2026-09-10: pidiendo las 19 estadisticas
 * con `Placed Order` (WsWGgW) la API devuelve 400
 * "Passed in conversion metric does not support querying for values data";
 * quitando estas cuatro, la MISMA peticion devuelve 200.
 *
 * Es decir: cuatro estadisticas dejaban sin aperturas, clics ni entregas a todo
 * el modulo de email -- `klaviyo_report_values` llevaba vacia desde el primer
 * dia y A12 opinaba sin una sola cifra de envio. Se reintenta sin ellas y el
 * run queda `partial`: hay rendimiento, no hay ingresos atribuidos. Que es la
 * verdad, y ADR-0021 exige justamente no inventarse la parte de ingresos.
 */
export function isConversionMetricValueError(message: string): boolean {
  return message.includes(
    "conversion metric does not support querying for values data",
  );
}

export function statisticsWithoutValues(statistics: string[]): string[] {
  return statistics.filter((statistic) => !VALUE_STATISTICS.has(statistic));
}

export async function runKlaviyoReport(
  env: LoadedApiEnv,
  organizationId: string,
  connectionId: string,
  input: KlaviyoReportInput,
  force = false,
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
    (input.group_by ?? []).slice().sort().join(","),
    input.filter ?? "",
  ].join(":");
  const { data: existingRun } = await client
    .from("klaviyo_report_runs")
    .select("id, status, finished_at")
    .eq("account_id", account.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  const recentPeriod = input.periodEnd >= new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const recentlyFetched = Date.now() - Date.parse(existingRun?.finished_at ?? "") < 15 * 60_000;
  if (existingRun?.status === "succeeded" && (!recentPeriod || (!force && recentlyFetched))) {
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
    type ReportResponse = {
      data?: {
        attributes?: {
          results?: Array<{
            groupings?: Record<string, unknown>;
            statistics?: Record<string, unknown>;
          }>;
        };
      };
    };
    const ask = (statistics: string[]) =>
      api.queryReport<ReportResponse>({
        type: input.type,
        statistics,
        conversion_metric_id: account.conversion_metric_id,
        timeframe: {
          start: `${input.periodStart}T00:00:00+00:00`,
          end: `${input.periodEnd}T23:59:59+00:00`,
        },
        ...(input.filter ? { filter: input.filter } : {}),
        ...(input.group_by ? { group_by: input.group_by } : {}),
        ...(input.interval ? { interval: input.interval } : {}),
      });

    let response: ReportResponse;
    let sinIngresos = false;
    try {
      response = await ask(input.statistics);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const resto = statisticsWithoutValues(input.statistics);
      // Sin estadisticas que pedir aparte de las de valor no hay reintento que
      // valga: el fallo es el mismo y volver a llamar solo gasta cuota.
      if (!isConversionMetricValueError(message) || resto.length === 0) throw error;
      response = await ask(resto);
      sinIngresos = true;
    }
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
        // Flows agrupan por flow_message_id: sin él, dos emails del mismo
        // flow chocan en la clave del upsert y el informe entero falla.
        external_message_id:
          typeof groupings.campaign_message_id === "string"
            ? groupings.campaign_message_id
            : typeof groupings.flow_message_id === "string"
              ? groupings.flow_message_id
              : "",
        metric_id: account.conversion_metric_id,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        conversions: numberValue(
          statistics.conversion_uniques ?? statistics.conversions,
        ),
        revenue: numberValue(statistics.conversion_value ?? statistics.revenue),
        currency_code: account.currency_code,
        variation_id:
          typeof groupings.variation === "string" ? groupings.variation : "",
        variation_name:
          typeof groupings.variation_name === "string"
            ? groupings.variation_name
            : "",
        raw_data: { groupings, statistics },
      };
    });
    if (rows.length) {
      await upsertRows(
        client,
        "klaviyo_report_values",
        rows,
        "report_run_id,entity_type,external_entity_id,metric_id,period_start,period_end,external_message_id,variation_id,variation_name",
      );
    }
    await client
      .from("klaviyo_report_runs")
      .update({
        status: sinIngresos ? "partial" : "succeeded",
        error_message: sinIngresos
          ? `conversion_metric_sin_valor:${account.conversion_metric_id}: la metrica de conversion elegida no devuelve valor economico. Hay aperturas, clics y entregas; NO hay ingresos atribuidos ni tasa de conversion.`
          : null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", reportRun.id);
    return {
      status: sinIngresos ? ("partial" as const) : ("succeeded" as const),
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
      "id, report_run_id, entity_type, external_entity_id, entity_name, metric_id, period_start, period_end, conversions, revenue, currency_code, raw_data",
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

// Meses completos de historico que E-NORA quiere tener antes de poder
// hablar de tendencias de email. Reporting API admite como maximo un ano por
// solicitud, asi que el backfill va mes a mes.
export const KLAVIYO_BACKFILL_MONTHS = 12;
// Estadisticas de Reporting API que se piden en cada informe campaign/flow. El
// sync guarda `raw_data.statistics` entero, asi que ampliar esta lista enriquece
// todos los runs futuros y el backfill sin cambiar el resto del pipe. Nombres
// validos para campaign-values-report y flow-values-report en la revision
// 2026-04-15. `conversion_uniques` y `conversion_value` alimentan las columnas
// `conversions`/`revenue`; el resto vive en `raw_data.statistics` y lo lee la
// funcion SQL del panel.
export const KLAVIYO_REPORT_STATISTICS = [
  "recipients",
  "delivered",
  "opens",
  "opens_unique",
  "open_rate",
  "clicks",
  "clicks_unique",
  "click_rate",
  "click_to_open_rate",
  "conversion_uniques",
  "conversion_value",
  "conversion_rate",
  "revenue_per_recipient",
  "unsubscribes",
  "unsubscribe_rate",
  "bounced",
  "bounce_rate",
  "spam_complaints",
  "spam_complaint_rate",
];
const KLAVIYO_REPORT_TYPES = [
  "campaign-values-report",
  "flow-values-report",
] as const;

/**
 * La Reporting API EXIGE agrupar por el id del mensaje ("Grouping by
 * campaign_message_id is required" / "Group by flow_message_id is required"),
 * no solo por el de la campana o el flujo. Se piden los dos: el del mensaje
 * porque es obligatorio, y el de la campana/flujo porque es por donde
 * klaviyo_email_report enlaza con klaviyo_campaigns / klaviyo_flows.
 *
 * `external_entity_id` guarda el id de la campana/flujo y el mensaje permanece
 * en raw_data.groupings. Las dimensiones estables variation/variation_name se
 * persisten por separado para evitar que filas A/B se sobrescriban; el informe
 * general excluye esas filas y una RPC acotada las expone al analisis A26.
 */
function groupByForType(type: KlaviyoReportType): string[] {
  return klaviyoReportGroupings(type);
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
  existing: Array<{
    report_type: string;
    period_start: string;
    statistics?: unknown;
  }>,
  months = KLAVIYO_BACKFILL_MONTHS,
  requiredStatistics: readonly string[] = KLAVIYO_REPORT_STATISTICS,
): { type: KlaviyoReportType; periodStart: string; periodEnd: string } | null {
  // Un mes cuenta como hecho solo si su run cubre TODAS las estadisticas
  // requeridas. Un run antiguo pedido con menos stats (p. ej. antes de ampliar
  // KLAVIYO_REPORT_STATISTICS con aperturas/clics/entregabilidad) NO cuenta: se
  // vuelve a pedir para rellenar el historico. Filas sin el campo `statistics`
  // (o con una forma inesperada) se consideran hechas -- compatibilidad.
  const covers = (stats: unknown): boolean => {
    if (!Array.isArray(stats)) return true;
    const have = new Set(stats.map(String));
    return requiredStatistics.every((stat) => have.has(stat));
  };
  const done = new Set(
    existing
      .filter((row) => covers(row.statistics))
      .map((row) => `${row.report_type}:${row.period_start}`),
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

export async function reconcileAllKlaviyoConnections(env: LoadedApiEnv, onlyConnectionId?: string, force = false) {
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
  const { error: recoveryError } = await client.from("integration_connections")
    .update({ status: "error", last_error_message: "klaviyo_sync_interrupted_retrying" })
    .eq("provider", "klaviyo").eq("status", "syncing")
    .lt("updated_at", new Date(Date.now() - KLAVIYO_SYNC_STALE_AFTER_MS).toISOString());
  if (recoveryError) throw new Error(`klaviyo_sync_recovery_failed:${recoveryError.message}`);
  let connectionQuery = client
    .from("integration_connections")
    .select("id, organization_id, status, last_error_message")
    .eq("provider", "klaviyo")
    .in("status", ["connected", "error"])
    .order("created_at", { ascending: true });
  if (onlyConnectionId) connectionQuery = connectionQuery.eq("id", onlyConnectionId);
  const { data: connections, error } = await connectionQuery;
  if (error)
    throw new Error(`klaviyo_connections_list_failed:${error.message}`);

  const periodEnd = new Date().toISOString().slice(0, 10);
  const periodStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const results = await mapWithConcurrency(connections ?? [], 2, async (connection) => {
    try {
      if (!onlyConnectionId) {
        if (requiresIntegrationReauthorization(connection.last_error_message)) return { connectionId: connection.id, status: "skipped" as const, detail: "reauthorization_required" };
        await enqueueIntegrationSync(env, { provider: "klaviyo", connectionId: connection.id, organizationId: connection.organization_id, mode: "incremental" });
        return { connectionId: connection.id, status: "queued" as const };
      }
      // Cierra las pasadas que sobrevivieron como `running` a la muerte o
      // reinicio del proceso. Solo toca runs con más de una hora: una pasada
      // activa conserva su fila y no se marca como fallida.
      const staleBefore = new Date(
        Date.now() - KLAVIYO_SYNC_STALE_AFTER_MS,
      ).toISOString();
      const { data: staleRuns, error: staleRunsError } = await client
        .from("integration_sync_runs")
        .select("id")
        .eq("connection_id", connection.id)
        .eq("provider", "klaviyo")
        .eq("status", "running")
        .lt("started_at", staleBefore);
      if (staleRunsError) {
        throw new Error(`klaviyo_stale_runs_load_failed:${staleRunsError.message}`);
      }
      const staleRunIds = (staleRuns ?? []).map((run) => run.id);
      if (staleRunIds.length > 0) {
        const recoveredAt = new Date().toISOString();
        const { error: recoverError } = await client
          .from("integration_sync_runs")
          .update({
            status: "failed",
            records_failed: 1,
            error_message: "klaviyo_sync_stale_recovered: el worker anterior no terminó la pasada.",
            finished_at: recoveredAt,
          })
          .in("id", staleRunIds)
          .eq("status", "running");
        if (recoverError) {
          throw new Error(`klaviyo_stale_runs_recovery_failed:${recoverError.message}`);
        }
        console.warn("klaviyo_stale_runs_recovered", {
          connection_id: connection.id,
          count: staleRunIds.length,
        });
      }

      if (
        connection.status === "error" &&
        requiresIntegrationReauthorization(connection.last_error_message)
      ) {
        return {
          connectionId: connection.id,
          status: "skipped",
          detail: "reauthorization_required",
        } as const;
      }

      await runKlaviyoSync(env, connection.id, "incremental", force);
      const { data: account } = await client
        .from("klaviyo_accounts")
        .select("id, conversion_metric_id")
        .eq("connection_id", connection.id)
        .maybeSingle();
      if (!account?.conversion_metric_id) {
        return {
          connectionId: connection.id,
          status: "skipped",
          detail: "conversion_metric_not_selected",
        } as const;
      }
      for (const type of KLAVIYO_REPORT_TYPES) {
        await runKlaviyoReport(env, connection.organization_id, connection.id, {
          type,
          statistics: KLAVIYO_REPORT_STATISTICS,
          periodStart,
          periodEnd,
          group_by: groupByForType(type),
        }, force);
      }

      await invalidateIntegrationData(env.REDIS_URL, connection.organization_id);
      await client.from("integration_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", connection.id);

      // Backfill incremental del historico: un mes pendiente por pasada. Con
      // el cron de 6 horas el ano completo queda cubierto en pocos dias sin
      // agotar la cuota de Reporting API ni bloquear el sync reciente.
      if (new Date().getUTCHours() % 6 !== 0 || new Date().getUTCMinutes() >= 15) {
        return { connectionId: connection.id, status: "succeeded" as const, detail: "recent_reports_updated" };
      }
      const { data: historicRuns } = await client
        .from("klaviyo_report_runs")
        .select("report_type, period_start, statistics")
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

      return {
        connectionId: connection.id,
        status: "succeeded",
        detail: pending
          ? `backfilled:${pending.type}:${pending.periodStart}`
          : "history_complete",
      } as const;
    } catch (syncError) {
      return {
        connectionId: connection.id,
        status: "failed",
        detail:
          syncError instanceof Error
            ? syncError.message
            : "klaviyo_reconcile_failed",
      } as const;
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

/**
 * Mensaje del run cuando falta algo: si la causa fue un permiso, nombra el
 * permiso tal cual aparece en Klaviyo en vez del codigo interno.
 */
export function permissionAwareSkipMessage(
  skipped: readonly string[],
  denied: readonly KlaviyoCapability[],
): string {
  const codigo = `klaviyo_recursos_no_traidos:${skipped.join(",")}`;
  if (denied.length === 0) return codigo;
  const permisos = [...new Set(denied.map((item) => item.label))].join(", ");
  return `Faltan permisos en Klaviyo: ${permisos}. Actualiza la API key (o vuelve a autorizar la cuenta) y sincroniza de nuevo. ${codigo}`;
}
