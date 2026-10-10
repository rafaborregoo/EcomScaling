import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { isIntegrationFeatureEnabled } from "@e-nora/integrations";
import type { AuthContext } from "./auth-context.js";
import { summariseKlaviyoEmailRows, type KlaviyoEmailReportRow } from "./klaviyo.js";
import { providerCurrencyCode } from "./provider-currency.js";

/**
 * /klaviyo/emails y /klaviyo/emails/[id]: el mismo catálogo de campañas y
 * flujos que ya agrega klaviyo_email_report (ver getKlaviyoEmailReport), pero
 * como listado navegable con ficha por email en vez de una tabla fija.
 *
 * Reutiliza ese mismo RPC y su resumen (summariseKlaviyoEmailRows) en vez de
 * duplicar la agregación: aquí solo se pagina, filtra y ordena lo que SQL ya
 * sumó (ADR-0006 punto 6), y se añaden los bloques propios de la ficha
 * (pasos del email, clics por enlace, audiencia).
 */

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; statusCode: number; error: string; message?: string; detail?: string };

const DAY_MS = 86_400_000;
const DEFAULT_DAYS = 90;
const MAX_DAYS = 365;
const PAGE_SIZE = 24;
// Cuanto rebota o se queja una cuenta sana: por encima, el email pide revisión.
const UNSUB_RATE_ALERT = 0.005;
const SPAM_RATE_ALERT = 0.001;
const LOW_OPEN_SHARE = 0.85; // 15% o más por debajo de la media de la cuenta.

function serviceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isMember(context: AuthContext, organizationId: string) {
  return context.memberships.some((item) => item.organization_id === organizationId);
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePeriodDays(daysInput: string | undefined) {
  if (!daysInput || daysInput === "all") return DEFAULT_DAYS;
  const parsed = Number(daysInput);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(MAX_DAYS, Math.floor(parsed)) : DEFAULT_DAYS;
}

function pageNumber(value: string | undefined) {
  const parsed = Number(value ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : null;
}

async function resolveStoreId(
  supabase: ReturnType<typeof serviceClient>,
  organizationId: string,
  connectionId: string | undefined,
) {
  if (!connectionId) return null;
  const { data } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("connection_id", connectionId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// La moneda solo se declara si todas las cuentas del ambito coinciden (mismo
// criterio que /meta): con una cuenta sin moneda o dos distintas, se muestra
// la cifra sin simbolo y la pantalla lo dice, en vez de asumir EUR.
export async function resolveAccountScope(
  supabase: ReturnType<typeof serviceClient>,
  organizationId: string,
  storeId: string | null,
): Promise<{ id: string | undefined; currency: string | null }> {
  let query = supabase.from("klaviyo_accounts").select("id, currency_code, raw_data").eq("organization_id", organizationId);
  if (storeId) query = query.eq("store_id", storeId);
  const { data } = await query;
  const rows = data ?? [];
  const codes = new Set(rows.map((row) => providerCurrencyCode(row.currency_code, row.raw_data, "preferred_currency")));
  const only = codes.size === 1 ? [...codes][0] : null;
  return { id: rows[0]?.id as string | undefined, currency: only && /^[A-Z]{3}$/.test(only) ? only : null };
}

type ShapedEntity = ReturnType<typeof summariseKlaviyoEmailRows>["campaigns"][number];

export function entityAlert(entity: ShapedEntity, accountOpenRate: number | null) {
  if ((entity.spam_rate ?? 0) >= SPAM_RATE_ALERT) return { kind: "spam", text: "Quejas de spam altas" };
  if ((entity.unsub_rate ?? 0) >= UNSUB_RATE_ALERT) return { kind: "unsub", text: "Bajas altas" };
  if (accountOpenRate != null && entity.open_rate != null && entity.open_rate < accountOpenRate * LOW_OPEN_SHARE) {
    return { kind: "low_open", text: "Apertura baja" };
  }
  return null;
}

export async function listKlaviyoEmails(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  input: { days?: string; connectionId?: string; kind?: string; q?: string; sort?: string; page?: string },
): Promise<Result<Record<string, unknown>>> {
  if (!isIntegrationFeatureEnabled("klaviyo", env.INTEGRATION_FEATURE_FLAGS)) {
    return { ok: false, statusCode: 404, error: "integration_disabled" };
  }
  if (!isMember(context, organizationId)) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
  }
  const kind = input.kind === "campaign" || input.kind === "flow" ? input.kind : "";
  const sort = (["revenue", "open_rate", "revenue_per_recipient"].includes(input.sort ?? "") ? input.sort : "revenue") as
    | "revenue"
    | "open_rate"
    | "revenue_per_recipient";
  const page = pageNumber(input.page);
  if (page === null) return { ok: false, statusCode: 400, error: "invalid_page" };

  const periodDays = parsePeriodDays(input.days);
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * DAY_MS);
  const toDate = (value: Date) => value.toISOString().slice(0, 10);

  const supabase = serviceClient(env);
  const storeId = await resolveStoreId(supabase, organizationId, input.connectionId);
  const { id: accountId, currency } = await resolveAccountScope(supabase, organizationId, storeId);

  if (!accountId) {
    return {
      ok: true,
      data: { organization_id: organizationId, connected: false, currency: null, period: { days: periodDays }, total: 0, page, page_size: PAGE_SIZE, emails: [], summary: null },
    };
  }

  const { data, error } = await supabase.rpc("klaviyo_email_report", {
    target_organization_id: organizationId,
    period_start: toDate(periodStart),
    period_end: toDate(periodEnd),
    target_store_id: storeId,
  });
  if (error) return { ok: false, statusCode: 500, error: "klaviyo_email_report_failed", detail: error.message };

  const summary = summariseKlaviyoEmailRows((data ?? []) as KlaviyoEmailReportRow[]);
  const accountOpenRate = summary.totals.open_rate;
  let rows = [
    ...summary.campaigns.map((entity) => ({ ...entity, kind: "campaign" as const })),
    ...summary.flows.map((entity) => ({ ...entity, kind: "flow" as const })),
  ];

  if (kind) rows = rows.filter((row) => row.kind === kind);
  const search = input.q?.trim().toLowerCase().slice(0, 120);
  if (search) rows = rows.filter((row) => `${row.name} ${row.subject ?? ""}`.toLowerCase().includes(search));

  const sorted = rows
    .map((row) => ({ ...row, alert: entityAlert(row, accountOpenRate) }))
    .sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));

  const start = (page - 1) * PAGE_SIZE;
  const page_rows = sorted.slice(start, start + PAGE_SIZE);

  return {
    ok: true,
    data: {
      organization_id: organizationId,
      connected: true,
      currency,
      period: { days: periodDays, start: periodStart.toISOString(), end: periodEnd.toISOString() },
      total: sorted.length,
      page,
      page_size: PAGE_SIZE,
      emails: page_rows,
      summary: {
        total: rows.length,
        campaigns: rows.filter((row) => row.kind === "campaign").length,
        flows: rows.filter((row) => row.kind === "flow").length,
        revenue: summary.totals.revenue,
        flow_revenue: summary.totals.flow_revenue,
        flow_share_pct: summary.totals.flow_share_pct,
        account_open_rate: accountOpenRate,
        account_click_rate: summary.totals.click_rate,
        account_revenue_per_recipient: summary.totals.revenue_per_recipient,
        alerts: rows.filter((row) => entityAlert(row, accountOpenRate)).length,
      },
    },
  };
}

export async function getKlaviyoEmailDetail(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  entityId: string,
  input: { days?: string; connectionId?: string },
): Promise<Result<Record<string, unknown>>> {
  if (!isIntegrationFeatureEnabled("klaviyo", env.INTEGRATION_FEATURE_FLAGS)) {
    return { ok: false, statusCode: 404, error: "integration_disabled" };
  }
  if (!isMember(context, organizationId)) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
  }

  const periodDays = parsePeriodDays(input.days);
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * DAY_MS);
  const toDate = (value: Date) => value.toISOString().slice(0, 10);

  const supabase = serviceClient(env);
  const storeId = await resolveStoreId(supabase, organizationId, input.connectionId);
  const { currency } = await resolveAccountScope(supabase, organizationId, storeId);

  // Una campaña o flujo puede no haber tenido envíos en el periodo elegido
  // (p. ej. un flujo que lleva meses sin disparar). Se pide el periodo Y un
  // histórico largo de refuerzo: si el periodo no trae nada, el histórico
  // evita que la ficha se vea vacía solo por el filtro de fecha.
  const longStart = new Date(periodEnd.getTime() - 400 * DAY_MS);
  const [periodResult, longResult] = await Promise.all([
    supabase.rpc("klaviyo_email_report", {
      target_organization_id: organizationId,
      period_start: toDate(periodStart),
      period_end: toDate(periodEnd),
      target_store_id: storeId,
    }),
    supabase.rpc("klaviyo_email_report", {
      target_organization_id: organizationId,
      period_start: toDate(longStart),
      period_end: toDate(periodEnd),
      target_store_id: storeId,
    }),
  ]);
  if (periodResult.error) return { ok: false, statusCode: 500, error: "klaviyo_email_report_failed", detail: periodResult.error.message };

  const periodSummary = summariseKlaviyoEmailRows((periodResult.data ?? []) as KlaviyoEmailReportRow[]);
  const entityInPeriod = [...periodSummary.campaigns, ...periodSummary.flows].find((row) => row.id === entityId);
  let entity = entityInPeriod;
  let coverage: "period" | "lifetime" | "not_found" = entityInPeriod ? "period" : "not_found";
  if (!entity && !longResult.error) {
    const longSummary = summariseKlaviyoEmailRows((longResult.data ?? []) as KlaviyoEmailReportRow[]);
    const found = [...longSummary.campaigns, ...longSummary.flows].find((row) => row.id === entityId);
    if (found) {
      entity = found;
      coverage = "lifetime";
    }
  }
  if (!entity) return { ok: false, statusCode: 404, error: "klaviyo_email_not_found" };

  const entityType: "campaign" | "flow" = (periodResult.data as KlaviyoEmailReportRow[] | null)?.find((r) => r.entity_id === entityId)?.entity_type
    ?? (longResult.data as KlaviyoEmailReportRow[] | null)?.find((r) => r.entity_id === entityId)?.entity_type
    ?? "campaign";
  const accountOpenRate = periodSummary.totals.open_rate;

  const [inventoryResult, clicksResult, audiencesResult] = await Promise.all([
    supabase.rpc("klaviyo_email_inventory", { target_organization_id: organizationId, target_store_id: storeId }),
    supabase.rpc("klaviyo_entity_link_clicks", {
      target_organization_id: organizationId,
      target_entity_type: entityType,
      target_entity_id: entityId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    }),
    entityType === "campaign"
      ? supabase
          .from("klaviyo_campaign_audiences")
          .select("audience_type, audience_role, external_audience_id, list_id, segment_id")
          .eq("organization_id", organizationId)
          .eq("campaign_id", entityId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const inventoryRows = (inventoryResult.data ?? []) as Array<{
    parent_id: string;
    message_id: string;
    external_message_id: string;
    position_in_parent: number;
    subject: string | null;
    preview_text: string | null;
    template_name: string | null;
    body_chars: number | null;
    adds_utm: boolean;
    tracks_clicks: boolean | null;
  }>;
  const messages = inventoryRows.filter((row) => row.parent_id === entityId).sort((a, b) => a.position_in_parent - b.position_in_parent);
  const hasUtm = messages.length > 0 && messages.every((row) => row.adds_utm);

  // Rendimiento de cada paso del email (lifetime, como la cifra principal de
  // la ficha, para que la suma de los pasos cuadre con el total mostrado).
  const messageStatsResult = await supabase.rpc("klaviyo_message_stats", {
    target_organization_id: organizationId,
    period_start: toDate(longStart),
    period_end: toDate(periodEnd),
    target_store_id: storeId,
  });
  const statsByMessage = new Map(
    (!messageStatsResult.error ? (messageStatsResult.data ?? []) : []).map((row: Record<string, unknown>) => [
      String(row.external_message_id),
      row,
    ]),
  );
  const steps = messages.map((row) => {
    const stats = statsByMessage.get(row.external_message_id) as Record<string, unknown> | undefined;
    const recipients = num(stats?.recipients);
    const delivered = num(stats?.delivered);
    const opens = num(stats?.opens_unique);
    return {
      message_id: row.message_id,
      position: row.position_in_parent,
      subject: row.subject,
      preview_text: row.preview_text,
      template_name: row.template_name,
      body_chars: row.body_chars,
      adds_utm: row.adds_utm,
      tracks_clicks: row.tracks_clicks,
      revenue: num(stats?.revenue),
      recipients,
      delivered,
      open_rate: delivered > 0 ? opens / delivered : null,
      click_rate: delivered > 0 ? num(stats?.clicks_unique) / delivered : null,
    };
  });

  const audienceRows = (audiencesResult.data ?? []) as Array<{
    audience_type: string;
    audience_role: string;
    list_id: string | null;
    segment_id: string | null;
  }>;
  const listIds = audienceRows.filter((row) => row.list_id).map((row) => row.list_id!);
  const segmentIds = audienceRows.filter((row) => row.segment_id).map((row) => row.segment_id!);
  const [listsResult, segmentsResult] = await Promise.all([
    listIds.length ? supabase.from("klaviyo_lists").select("id, name").in("id", listIds) : Promise.resolve({ data: [] }),
    segmentIds.length ? supabase.from("klaviyo_segments").select("id, name").in("id", segmentIds) : Promise.resolve({ data: [] }),
  ]);
  const listNames = new Map((listsResult.data ?? []).map((row: { id: string; name: string }) => [row.id, row.name]));
  const segmentNames = new Map((segmentsResult.data ?? []).map((row: { id: string; name: string }) => [row.id, row.name]));
  const audience = audienceRows.map((row) => ({
    kind: row.audience_type,
    role: row.audience_role,
    name: row.list_id ? listNames.get(row.list_id) ?? "Lista" : row.segment_id ? segmentNames.get(row.segment_id) ?? "Segmento" : "Audiencia",
  }));

  return {
    ok: true,
    data: {
      organization_id: organizationId,
      currency,
      period: { days: periodDays, start: periodStart.toISOString(), end: periodEnd.toISOString() },
      stats_coverage: coverage,
      entity: { ...entity, type: entityType, alert: entityAlert(entity, accountOpenRate), has_utm: hasUtm },
      account: { open_rate: accountOpenRate, click_rate: periodSummary.totals.click_rate, revenue_per_recipient: periodSummary.totals.revenue_per_recipient },
      steps,
      links: clicksResult.error ? [] : clicksResult.data,
      links_coverage: clicksResult.error ? "unavailable" : "available",
      audience,
    },
  };
}
