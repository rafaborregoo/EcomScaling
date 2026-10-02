import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import { createKlaviyoClient } from "./klaviyo-client.js";
import { getValidKlaviyoAccessToken } from "./klaviyo-token-store.js";
import {
  describeKlaviyoMissingPermissions,
  isKlaviyoPermissionError,
  klaviyoCapability,
} from "./klaviyo-permissions.js";
import { recordAuditLog } from "./audit-log.js";
import { activeKlaviyoConnectionId, canManage, previewKlaviyoTemplate, pushDraftToKlaviyoTemplate } from "./klaviyo.js";
import { readKlaviyoFlowGraph, type FlowGraph } from "./klaviyo-flow-graph.js";

/**
 * Marketing con Klaviyo dentro de NORA: lo que leen las pantallas Hoy,
 * Campañas, Flows, Plantillas, Audiencias y Rendimiento, y las dos escrituras
 * que evitan tener que abrir Klaviyo (programar y cancelar una campaña).
 *
 * Las cifras salen de funciones SQL (klaviyo_message_stats,
 * klaviyo_daily_revenue, shopify_sales_summary): aquí solo se juntan y se
 * cruzan ids (ADR-0006 punto 6). Todo importe es "EUR atribuidos por Klaviyo"
 * y no se suma con otras plataformas (ADR-0021).
 */

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; statusCode: number; error: string; message?: string; detail?: string };

type Stats = {
  revenue: number;
  conversions: number;
  recipients: number;
  delivered: number;
  opens_unique: number;
  clicks_unique: number;
  unsubscribes: number;
};

type Audience = { id: string; name: string; kind: "list" | "segment" | "unknown"; size: number | null };

const DAY_MS = 86_400_000;

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

function emptyStats(): Stats {
  return { revenue: 0, conversions: 0, recipients: 0, delivered: 0, opens_unique: 0, clicks_unique: 0, unsubscribes: 0 };
}

/** Fila de SQL -> Stats con números (Postgres devuelve numeric como texto). */
function statsOf(row: Record<string, unknown>): Stats {
  const stats = emptyStats();
  for (const key of Object.keys(stats) as Array<keyof Stats>) stats[key] = num(row[key]);
  return stats;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function resolveStoreId(
  supabase: ReturnType<typeof serviceClient>,
  organizationId: string,
  connectionId?: string,
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

export async function getMarketingKlaviyoWorkspace(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  input: { days?: string | undefined; connectionId?: string | undefined },
): Promise<Result<Record<string, unknown>>> {
  if (!isMember(context, organizationId)) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
  }
  const days = Math.min(365, Math.max(7, Math.floor(num(input.days) || 30)));
  const supabase = serviceClient(env);
  const storeId = await resolveStoreId(supabase, organizationId, input.connectionId);

  let accountQuery = supabase
    .from("klaviyo_accounts")
    .select("id, name, currency_code, timezone, raw_data, connection_id, last_synced_at")
    .eq("organization_id", organizationId);
  if (storeId) accountQuery = accountQuery.eq("store_id", storeId);
  const { data: accounts, error: accountError } = await accountQuery.limit(1);
  if (accountError) {
    return { ok: false, statusCode: 500, error: "klaviyo_account_load_failed", detail: accountError.message };
  }
  const account = accounts?.[0] ?? null;
  const end = new Date();
  const start = new Date(end.getTime() - days * DAY_MS);
  const previousStart = new Date(start.getTime() - days * DAY_MS);
  const day = (value: Date) => value.toISOString().slice(0, 10);
  const period = { days, start: start.toISOString(), end: end.toISOString() };

  const salesArgs = {
    target_organization_id: organizationId,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    target_store_id: storeId,
  };
  if (!account) {
    const { data: sales } = await supabase.rpc("shopify_sales_summary", salesArgs);
    return {
      ok: true,
      data: { connected: false, period, store_sales: num(obj((sales ?? [])[0]).net_sales) },
    };
  }

  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id, status, scopes, last_sync_at")
    .eq("id", account.connection_id as string)
    .maybeSingle();

  const statsArgs = (from: Date, to: Date) => ({
    target_organization_id: organizationId,
    period_start: day(from),
    period_end: day(to),
    target_store_id: storeId,
  });
  const [
    currentStats,
    previousStats,
    lifetimeStats,
    messageStats,
    daily,
    sales,
    campaigns,
    flows,
    flowActions,
    flowMessages,
    campaignMessages,
    audiences,
    lists,
    segments,
    listSnapshots,
    segmentSnapshots,
    forms,
    templates,
  ] = await Promise.all([
    supabase.rpc("klaviyo_entity_stats", statsArgs(start, end)),
    supabase.rpc("klaviyo_entity_stats", statsArgs(previousStart, start)),
    // Una campaña enviada hace meses sigue teniendo resultado: el de toda su vida.
    supabase.rpc("klaviyo_entity_stats", statsArgs(new Date(end.getTime() - 400 * DAY_MS), end)),
    supabase.rpc("klaviyo_message_stats", statsArgs(start, end)),
    supabase.rpc("klaviyo_daily_revenue", statsArgs(start, end)),
    supabase.rpc("shopify_sales_summary", salesArgs),
    supabase
      .from("klaviyo_campaigns")
      .select("id, external_campaign_id, name, status, send_time, raw_data, updated_at_external")
      .eq("account_id", account.id)
      .order("send_time", { ascending: false, nullsFirst: true })
      .limit(300),
    supabase
      .from("klaviyo_flows")
      .select("id, external_flow_id, name, status, trigger_type, definition_graph, updated_at_external")
      .eq("account_id", account.id)
      .order("name"),
    supabase
      .from("klaviyo_flow_actions")
      .select("id, flow_id, external_action_id, action_type, status")
      .eq("organization_id", organizationId),
    supabase
      .from("klaviyo_flow_messages")
      .select("flow_id, action_id, external_message_id, external_template_id, name, subject, preview_text")
      .eq("organization_id", organizationId),
    supabase
      .from("klaviyo_campaign_messages")
      .select("campaign_id, external_message_id, external_template_id, subject, preview_text, from_email, from_label, channel")
      .eq("organization_id", organizationId),
    supabase
      .from("klaviyo_campaign_audiences")
      .select("campaign_id, audience_type, external_audience_id, name")
      .eq("organization_id", organizationId),
    supabase
      .from("klaviyo_lists")
      .select("id, external_list_id, name, profile_count, profile_count_synced_at, opt_in_process")
      .eq("account_id", account.id)
      .order("name"),
    supabase
      .from("klaviyo_segments")
      .select("id, external_segment_id, name, profile_count, profile_count_synced_at")
      .eq("account_id", account.id)
      .order("name"),
    supabase
      .from("klaviyo_list_daily_snapshots")
      .select("list_id, snapshot_date, profile_count")
      .eq("organization_id", organizationId)
      .gte("snapshot_date", day(new Date(end.getTime() - 60 * DAY_MS)))
      .order("snapshot_date"),
    supabase
      .from("klaviyo_segment_daily_snapshots")
      .select("segment_id, snapshot_date, profile_count")
      .eq("organization_id", organizationId)
      .gte("snapshot_date", day(new Date(end.getTime() - 60 * DAY_MS)))
      .order("snapshot_date"),
    supabase
      .from("klaviyo_forms")
      .select("id, external_form_id, name, status, stats_30d, stats_synced_at")
      .eq("account_id", account.id)
      .order("name"),
    supabase
      .from("klaviyo_templates")
      .select("external_template_id, name, editor_type, external_updated_at, html_content")
      .eq("account_id", account.id)
      .order("external_updated_at", { ascending: false, nullsFirst: false })
      .limit(300),
  ]);
  const failed = [currentStats, messageStats, daily, campaigns, flows].find((result) => result.error);
  if (failed?.error) {
    return { ok: false, statusCode: 500, error: "marketing_klaviyo_load_failed", detail: failed.error.message };
  }

  // Las filas ya vienen sumadas de SQL; aquí solo se indexan.
  const periodMessages = new Map<string, Stats>(
    ((messageStats.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      `${row.entity_type}:${row.external_message_id ?? ""}`,
      statsOf(row),
    ]),
  );
  const entityIndex = (rows: unknown) =>
    new Map<string, Stats>(
      ((rows ?? []) as Array<Record<string, unknown>>)
        .filter((row) => row.level === "entity")
        .map((row) => [`${row.entity_type}:${row.external_entity_id}`, statsOf(row)]),
    );
  const totalsOf = (rows: unknown) => {
    const list = (rows ?? []) as Array<Record<string, unknown>>;
    const pick = (predicate: (row: Record<string, unknown>) => boolean) => {
      const row = list.find(predicate);
      return row ? statsOf(row) : emptyStats();
    };
    return {
      all: pick((row) => row.level === "total"),
      flow: pick((row) => row.level === "type" && row.entity_type === "flow"),
      campaign: pick((row) => row.level === "type" && row.entity_type === "campaign"),
    };
  };
  const periodEntities = entityIndex(currentStats.data);
  const lifetimeEntities = entityIndex(lifetimeStats.data);

  // Audiencias con su tamaño, para decir "a cuánta gente" en cada campaña.
  const audienceIndex = new Map<string, Audience>();
  for (const row of lists.data ?? []) {
    audienceIndex.set(row.external_list_id as string, { id: row.external_list_id as string, name: row.name as string, kind: "list", size: (row.profile_count as number | null) ?? null });
  }
  for (const row of segments.data ?? []) {
    audienceIndex.set(row.external_segment_id as string, { id: row.external_segment_id as string, name: row.name as string, kind: "segment", size: (row.profile_count as number | null) ?? null });
  }
  const audiencesByCampaign = new Map<string, { included: Audience[]; excluded: Audience[] }>();
  for (const row of audiences.data ?? []) {
    const bucket = audiencesByCampaign.get(row.campaign_id as string) ?? { included: [], excluded: [] };
    const known = audienceIndex.get(row.external_audience_id as string);
    const entry = known ?? { id: row.external_audience_id as string, name: (row.name as string | null) ?? "Audiencia", kind: "unknown" as const, size: null };
    (String(row.audience_type).startsWith("excluded") ? bucket.excluded : bucket.included).push(entry);
    audiencesByCampaign.set(row.campaign_id as string, bucket);
  }
  const messageByCampaign = new Map<string, Record<string, unknown>>();
  for (const row of campaignMessages.data ?? []) {
    if (!messageByCampaign.has(row.campaign_id as string) || row.channel === "email") {
      messageByCampaign.set(row.campaign_id as string, row);
    }
  }
  const templateUse = new Map<string, string[]>();
  const useTemplate = (templateId: unknown, label: string) => {
    if (typeof templateId !== "string") return;
    templateUse.set(templateId, [...(templateUse.get(templateId) ?? []), label]);
  };

  const campaignRows = (campaigns.data ?? []).map((row) => {
    const message = messageByCampaign.get(row.id as string) ?? {};
    const raw = obj(row.raw_data);
    useTemplate(message.external_template_id, `Campaña · ${row.name}`);
    const lifetime = lifetimeEntities.get(`campaign:${row.external_campaign_id}`);
    return {
      id: row.id,
      external_id: row.external_campaign_id,
      name: row.name,
      status: row.status,
      send_time: row.send_time ?? text(obj(raw.send_strategy).datetime),
      channel: text(message.channel) ?? "email",
      subject: text(message.subject),
      preview_text: text(message.preview_text),
      from_email: text(message.from_email),
      from_label: text(message.from_label),
      template_id: text(message.external_template_id),
      audiences: audiencesByCampaign.get(row.id as string) ?? { included: [], excluded: [] },
      stats: lifetime ?? null,
    };
  });

  // Flows: grafo + rendimiento de cada email del diagrama.
  const actionsByFlow = new Map<string, Map<string, string>>();
  for (const row of flowActions.data ?? []) {
    const map = actionsByFlow.get(row.flow_id as string) ?? new Map<string, string>();
    map.set(row.id as string, row.external_action_id as string);
    actionsByFlow.set(row.flow_id as string, map);
  }
  const messagesByFlow = new Map<string, Array<Record<string, unknown>>>();
  for (const row of flowMessages.data ?? []) {
    const list = messagesByFlow.get(row.flow_id as string) ?? [];
    list.push(row);
    messagesByFlow.set(row.flow_id as string, list);
  }
  const flowRows = (flows.data ?? []).map((row) => {
    const graph: FlowGraph | null = readKlaviyoFlowGraph(row.definition_graph);
    const actionExternal = actionsByFlow.get(row.id as string) ?? new Map<string, string>();
    const messages = (messagesByFlow.get(row.id as string) ?? []).map((message) => {
      useTemplate(message.external_template_id, `Flow · ${row.name}`);
      return {
        action_id: actionExternal.get(message.action_id as string) ?? null,
        message_id: message.external_message_id,
        template_id: message.external_template_id,
        name: message.name,
        subject: message.subject,
        stats: periodMessages.get(`flow:${message.external_message_id}`) ?? null,
      };
    });
    return {
      id: row.id,
      external_id: row.external_flow_id,
      name: row.name,
      status: row.status,
      trigger_type: row.trigger_type,
      updated_at: row.updated_at_external,
      graph,
      messages,
      stats: periodEntities.get(`flow:${row.external_flow_id}`) ?? null,
    };
  });

  const series = (rows: unknown, key: string) => {
    const map = new Map<string, Array<{ date: string; count: number }>>();
    for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
      const list = map.get(row[key] as string) ?? [];
      list.push({ date: row.snapshot_date as string, count: num(row.profile_count) });
      map.set(row[key] as string, list);
    }
    return map;
  };
  const listSeries = series(listSnapshots.data, "list_id");
  const segmentSeries = series(segmentSnapshots.data, "segment_id");
  const usedIn = (externalId: string) =>
    campaignRows.filter((campaign) =>
      [...campaign.audiences.included, ...campaign.audiences.excluded].some((audience) => audience.id === externalId),
    ).length;

  const raw = obj(account.raw_data);
  const contact = obj(raw.contact_information);
  const scopes = Array.isArray(connection?.scopes) ? (connection.scopes as string[]) : [];
  const totals = totalsOf(currentStats.data);

  return {
    ok: true,
    data: {
      connected: true,
      period,
      account: {
        name: account.name,
        currency: account.currency_code ?? "EUR",
        timezone: account.timezone,
        default_from_email: text(contact.default_sender_email),
        default_from_label: text(contact.default_sender_name) ?? text(contact.organization_name),
      },
      connection: {
        status: connection?.status ?? null,
        last_sync_at: connection?.last_sync_at ?? account.last_synced_at,
        can_schedule: scopes.includes("campaigns:write"),
      },
      totals: totals.all,
      totals_flow: totals.flow,
      totals_campaign: totals.campaign,
      previous: totalsOf(previousStats.data).all,
      store_sales: num(obj((sales.data ?? [])[0]).net_sales),
      daily: ((daily.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        day: row.day,
        flow: num(row.flow_revenue),
        campaign: num(row.campaign_revenue),
      })),
      campaigns: campaignRows,
      flows: flowRows,
      audiences: {
        lists: (lists.data ?? []).map((row) => ({
          id: row.external_list_id,
          name: row.name,
          size: row.profile_count,
          synced_at: row.profile_count_synced_at,
          double_opt_in: row.opt_in_process === "double_opt_in",
          series: listSeries.get(row.id as string) ?? [],
          used_in: usedIn(row.external_list_id as string),
        })),
        segments: (segments.data ?? []).map((row) => ({
          id: row.external_segment_id,
          name: row.name,
          size: row.profile_count,
          synced_at: row.profile_count_synced_at,
          series: segmentSeries.get(row.id as string) ?? [],
          used_in: usedIn(row.external_segment_id as string),
        })),
        forms: (forms.data ?? []).map((row) => ({
          id: row.external_form_id,
          name: row.name,
          status: row.status,
          stats: row.stats_30d ?? null,
          synced_at: row.stats_synced_at,
        })),
      },
      templates: (templates.data ?? []).map((row) => ({
        id: row.external_template_id,
        name: row.name,
        editor_type: row.editor_type,
        updated_at: row.external_updated_at,
        has_html: typeof row.html_content === "string" && row.html_content.length > 0,
        used_in: templateUse.get(row.external_template_id as string) ?? [],
      })),
    },
  };
}

/** HTML guardado de una plantilla de Klaviyo, para la miniatura (solo lectura). */
export async function getMarketingKlaviyoTemplateHtml(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  templateId: string,
): Promise<Result<{ html: string | null }>> {
  if (!isMember(context, organizationId)) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
  }
  const supabase = serviceClient(env);
  const { data, error } = await supabase
    .from("klaviyo_templates")
    .select("id, html_content")
    .eq("organization_id", organizationId)
    .eq("external_template_id", templateId)
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, statusCode: 500, error: "klaviyo_template_load_failed", detail: error.message };
  const stored = text(data?.html_content);
  if (stored || !data) return { ok: true, data: { html: stored } };
  // Del catálogo (sin HTML): se pide una vez a Klaviyo, saneado, y se guarda
  // para que la siguiente miniatura no vuelva a gastar cuota.
  const live = await previewKlaviyoTemplate(env, context, organizationId, templateId);
  if (!live.ok) return { ok: true, data: { html: null } };
  await supabase.from("klaviyo_templates").update({ html_content: live.data.html }).eq("id", data.id);
  return { ok: true, data: { html: live.data.html } };
}

/** Clics por enlace de una campaña. */
export async function getMarketingKlaviyoCampaignClicks(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  externalCampaignId: string,
): Promise<Result<{ links: Array<{ url: string; clicks: number; people: number }> }>> {
  if (!isMember(context, organizationId)) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
  }
  const { data, error } = await serviceClient(env).rpc("klaviyo_campaign_link_clicks", {
    target_organization_id: organizationId,
    target_external_campaign_id: externalCampaignId,
  });
  if (error) return { ok: false, statusCode: 500, error: "klaviyo_campaign_clicks_failed", detail: error.message };
  return {
    ok: true,
    data: {
      links: ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        url: String(row.url),
        clicks: num(row.clicks),
        people: num(row.people),
      })),
    },
  };
}

export type ScheduleCampaignInput = {
  draftId?: string;
  calendarItemId?: string | null;
  name?: string;
  subject?: string;
  previewText?: string;
  fromEmail?: string;
  fromLabel?: string;
  replyToEmail?: string | null;
  includedAudiences?: string[];
  excludedAudiences?: string[];
  /** ISO. Null = enviar ya. */
  sendAt?: string | null;
  smartSending?: boolean;
};

/** Cuerpo de POST /campaigns/ (revisión 2026-07-15). Aparte para testearlo. */
export function klaviyoCreateCampaignBody(input: {
  name: string;
  subject: string;
  previewText: string;
  fromEmail: string;
  fromLabel: string;
  replyToEmail: string | null;
  included: string[];
  excluded: string[];
  sendAt: string | null;
  smartSending: boolean;
}) {
  return {
    data: {
      type: "campaign",
      attributes: {
        name: input.name,
        audiences: { included: input.included, excluded: input.excluded },
        send_strategy: input.sendAt
          ? { method: "static", datetime: input.sendAt, options: { is_local: false } }
          : { method: "immediate" },
        send_options: { use_smart_sending: input.smartSending },
        tracking_options: { add_tracking_params: true, is_tracking_opens: true, is_tracking_clicks: true },
        "campaign-messages": {
          data: [
            {
              type: "campaign-message",
              attributes: {
                definition: {
                  channel: "email",
                  label: input.name,
                  content: {
                    subject: input.subject,
                    preview_text: input.previewText,
                    from_email: input.fromEmail,
                    from_label: input.fromLabel,
                    ...(input.replyToEmail ? { reply_to_email: input.replyToEmail } : {}),
                  },
                },
              },
            },
          ],
        },
      },
    },
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Programa (o envía ya) una pieza aprobada como campaña de Klaviyo:
 * plantilla -> campaña con audiencias -> asignar plantilla -> send job.
 * Escribe en la cuenta del cliente, así que exige rol de gestión y pieza
 * aprobada (lo comprueba el push de plantilla).
 */
export async function scheduleMarketingKlaviyoCampaign(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  input: ScheduleCampaignInput,
): Promise<Result<{ klaviyo_campaign_id: string; status: string }>> {
  const accessError = canManage(context, organizationId);
  if (accessError) return { ok: false, statusCode: 403, error: accessError };
  const subject = input.subject?.trim() ?? "";
  const fromEmail = input.fromEmail?.trim() ?? "";
  const included = (input.includedAudiences ?? []).filter((id) => typeof id === "string" && id.trim());
  const excluded = (input.excludedAudiences ?? []).filter((id) => typeof id === "string" && id.trim());
  if (!input.draftId?.trim()) return { ok: false, statusCode: 400, error: "missing_draft_id" };
  if (!subject) return { ok: false, statusCode: 400, error: "missing_subject", message: "Falta el asunto." };
  if (!EMAIL_RE.test(fromEmail)) {
    return { ok: false, statusCode: 400, error: "invalid_from_email", message: "El remitente no es un email válido." };
  }
  if (input.replyToEmail && !EMAIL_RE.test(input.replyToEmail.trim())) {
    return { ok: false, statusCode: 400, error: "invalid_reply_to", message: "El email de respuesta no es válido." };
  }
  if (included.length === 0) {
    return { ok: false, statusCode: 400, error: "missing_audience", message: "Elige al menos una lista o segmento." };
  }
  let sendAt: string | null = null;
  if (input.sendAt) {
    const parsed = Date.parse(input.sendAt);
    if (!Number.isFinite(parsed) || parsed < Date.now() + 5 * 60_000) {
      return { ok: false, statusCode: 400, error: "invalid_send_at", message: "La hora de envío tiene que ser al menos dentro de 5 minutos." };
    }
    sendAt = new Date(parsed).toISOString();
  }

  const pushed = await pushDraftToKlaviyoTemplate(env, context, organizationId, input.draftId);
  if (!pushed.ok) return pushed;
  const templateId = pushed.data.klaviyo_template_id;

  const supabase = serviceClient(env);
  const connectionId = await activeKlaviyoConnectionId(supabase, organizationId);
  if (!connectionId) return { ok: false, statusCode: 409, error: "klaviyo_not_connected" };
  const name = (input.name?.trim() || subject).slice(0, 255);

  let campaignId: string | null = null;
  try {
    const client = createKlaviyoClient(await getValidKlaviyoAccessToken(env, connectionId));
    const created = await client.request<{
      data?: { id?: string; relationships?: Record<string, { data?: Array<{ id?: string }> }> };
    }>("/campaigns/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        klaviyoCreateCampaignBody({
          name,
          subject,
          previewText: input.previewText?.trim() ?? "",
          fromEmail,
          fromLabel: input.fromLabel?.trim() || fromEmail,
          replyToEmail: input.replyToEmail?.trim() || null,
          included,
          excluded,
          sendAt,
          smartSending: input.smartSending ?? true,
        }),
      ),
    });
    campaignId = created.data?.id ?? null;
    if (!campaignId) throw new Error("klaviyo_campaign_id_missing");
    let messageId = created.data?.relationships?.["campaign-messages"]?.data?.[0]?.id ?? null;
    if (!messageId) {
      const messages = await client.listAll(`/campaigns/${encodeURIComponent(campaignId)}/campaign-messages`);
      messageId = messages[0]?.id ?? null;
    }
    if (!messageId) throw new Error("klaviyo_campaign_message_missing");
    await client.request("/campaign-message-assign-template/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: { type: "campaign-message", id: messageId, relationships: { template: { data: { type: "template", id: templateId } } } },
      }),
    });
    await client.request("/campaign-send-jobs/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { type: "campaign-send-job", id: campaignId } }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.warn(`klaviyo_campaign_schedule_failed:${campaignId ?? "-"}:${message}`);
    if (isKlaviyoPermissionError(message)) {
      const capability = klaviyoCapability("campaigns:write");
      return {
        ok: false,
        statusCode: 403,
        error: "klaviyo_campaign_write_denied",
        message: capability
          ? describeKlaviyoMissingPermissions([capability], "api_key") + " Si conectaste por OAuth, vuelve a autorizar la cuenta."
          : "Klaviyo no deja crear campañas con esta conexión.",
        detail: message,
      };
    }
    return {
      ok: false,
      statusCode: 502,
      error: "klaviyo_campaign_schedule_failed",
      message: campaignId
        ? "La campaña se creó en Klaviyo como borrador pero no se pudo programar. Revísala allí o inténtalo de nuevo."
        : "Klaviyo no aceptó la campaña.",
      detail: message,
    };
  }

  // Se guarda ya, sin esperar al siguiente sync: así Hoy y Campañas la ven y el
  // enlace para medirla existe desde el primer momento (sin «Medir» manual).
  const status = sendAt ? "Scheduled" : "Sending";
  const { data: account } = await supabase
    .from("klaviyo_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("connection_id", connectionId)
    .limit(1)
    .maybeSingle();
  if (account) {
    const { data: stored } = await supabase
      .from("klaviyo_campaigns")
      .upsert(
        {
          organization_id: organizationId,
          account_id: account.id,
          external_campaign_id: campaignId,
          name,
          status,
          send_time: sendAt ?? new Date().toISOString(),
          raw_data: { created_from: "nora", draft_id: input.draftId },
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "account_id,external_campaign_id" },
      )
      .select("id")
      .single();
    if (stored && input.calendarItemId) {
      await supabase
        .from("campaign_calendar_items")
        .update({ klaviyo_campaign_id: stored.id, marketing_draft_id: input.draftId, status: "in_progress" })
        .eq("id", input.calendarItemId)
        .eq("organization_id", organizationId);
    }
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: sendAt ? "klaviyo.campaign_scheduled" : "klaviyo.campaign_sent",
    entityType: "marketing_content_draft",
    entityId: input.draftId,
    newData: { klaviyo_campaign_id: campaignId, send_at: sendAt, included, excluded },
  });
  return { ok: true, data: { klaviyo_campaign_id: campaignId, status } };
}

/** Cancela una campaña programada o la devuelve a borrador en Klaviyo. */
export async function cancelMarketingKlaviyoCampaign(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  externalCampaignId: string,
  action: string | undefined,
): Promise<Result<{ status: string }>> {
  const accessError = canManage(context, organizationId);
  if (accessError) return { ok: false, statusCode: 403, error: accessError };
  if (action !== "cancel" && action !== "revert") {
    return { ok: false, statusCode: 400, error: "invalid_action" };
  }
  const supabase = serviceClient(env);
  const { data: campaign } = await supabase
    .from("klaviyo_campaigns")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("external_campaign_id", externalCampaignId)
    .limit(1)
    .maybeSingle();
  if (!campaign) return { ok: false, statusCode: 404, error: "klaviyo_campaign_not_found" };
  const connectionId = await activeKlaviyoConnectionId(supabase, organizationId);
  if (!connectionId) return { ok: false, statusCode: 409, error: "klaviyo_not_connected" };
  try {
    const client = createKlaviyoClient(await getValidKlaviyoAccessToken(env, connectionId));
    await client.request(`/campaign-send-jobs/${encodeURIComponent(externalCampaignId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { type: "campaign-send-job", id: externalCampaignId, attributes: { action } } }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (isKlaviyoPermissionError(message)) {
      return { ok: false, statusCode: 403, error: "klaviyo_campaign_write_denied", detail: message };
    }
    return {
      ok: false,
      statusCode: 502,
      error: "klaviyo_campaign_cancel_failed",
      message: "Klaviyo no dejó cancelarla. Si ya empezó a enviarse, no se puede parar.",
      detail: message,
    };
  }
  const status = action === "cancel" ? "Cancelled" : "Draft";
  await supabase.from("klaviyo_campaigns").update({ status }).eq("id", campaign.id);
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: action === "cancel" ? "klaviyo.campaign_cancelled" : "klaviyo.campaign_reverted",
    entityType: "klaviyo_campaign",
    entityId: campaign.id as string,
    newData: { external_campaign_id: externalCampaignId },
  });
  return { ok: true, data: { status } };
}
