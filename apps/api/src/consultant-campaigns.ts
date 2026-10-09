/**
 * Marketing -> Campañas del consultor: la cartera, un cliente y una tienda con
 * la misma lectura.
 *
 * Una sola respuesta devuelve lo que esta semana sale, lo que se escapa (va
 * tarde, sin pieza), lo que han creado los clientes y esperan su revision y
 * como rindio lo de la semana pasada. Los estados, los resumenes y los titulares
 * NO se calculan aqui: viven en @e-nora/contracts (los usa tambien la
 * pantalla). Aqui solo se leen las filas y se cruzan los ids.
 *
 * Cifras de dinero: "EUR atribuidos por Klaviyo", de toda la vida de cada
 * campaña (ADR-0021). No se suman con Meta ni con Shopify, y solo se suman entre
 * clientes que miden en la misma moneda.
 *
 * ponytail: una consulta por tabla para toda la cartera y una RPC de stats de
 * Klaviyo por cliente (concurrencia 6, 60 s de cache). Con carteras de cientos
 * de clientes, pasar a una funcion SQL que agregue las dos cosas.
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import {
  aggregatePortfolioCampaigns,
  buildClientCampaignsHeadline,
  buildPortfolioCampaignsHeadline,
  buildStoreCampaignsHeadline,
  campaignWorkState,
  emptySentRollup,
  isWithinNextDays,
  summarizeClientCampaigns,
  UPCOMING_CAMPAIGN_STATES,
  type CampaignBrief,
  type CampaignOrigin,
  type CampaignReviewStatus,
  type SentRollup,
} from "@e-nora/contracts";
import type { AuthContext } from "./auth-context.js";
import { listConsultantOrganizations } from "./consultant.js";
import { getCached, setCached } from "./redis-cache.js";

const logger = createLogger("consultant-campaigns");

type ApiEnv = LoadedApiEnv;

const DAY_MS = 86_400_000;
const CACHE_TTL_SECONDS = 30;
const CONCURRENCY = 6;
const MAX_ORGS = 120;
const LOOKBACK_DAYS = 60;
const LOOKAHEAD_DAYS = 45;
const MAX_ITEMS = 3000;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type ItemRow = {
  id: string;
  organization_id: string;
  store_id: string | null;
  title: string;
  channel: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  origin: CampaignOrigin;
  review_status: CampaignReviewStatus | null;
  review_requested_at: string | null;
  marketing_draft_id: string | null;
  meta_campaign_id: string | null;
  klaviyo_campaign_id: string | null;
  metadata: { a05_proposal?: unknown } | null;
};

type Stats = { delivered: number; opens_unique: number; clicks_unique: number; revenue: number };

export type SentCampaign = {
  organization_id: string;
  organization_name: string;
  campaign_id: string;
  name: string;
  sent_at: string;
  delivered: number;
  open_rate: number | null;
  click_rate: number | null;
  revenue: number | null;
  currency_code: string | null;
  store_id: string | null;
  /** Enlace mas clicado de ese envio (tracking). Null si Klaviyo aun no ha dado clics por enlace. */
  top_link: { url: string; clicks: number } | null;
};

export type ReviewQueueRow = {
  item_id: string;
  organization_id: string;
  organization_name: string;
  title: string;
  channel: string;
  starts_at: string;
  review_status: CampaignReviewStatus;
  review_requested_at: string | null;
  open_corrections: number;
};

export type StoreCampaignSummary = {
  store_id: string;
  /** Conexion de la tienda: es lo que usa el selector de tienda de la pantalla. */
  connection_id: string | null;
  label: string;
  week: CampaignBrief[];
  late: number;
  awaiting_review: number;
  no_piece_soon: number;
  last_week: SentRollup;
};

export type ConsultantCampaignsOverview = {
  level: "portfolio" | "client" | "store";
  organization_id: string | null;
  store_id: string | null;
  generated_at: string;
  currency_code: string | null;
  headline: { title: string; detail: string };
  clients: ReturnType<typeof summarizeClientCampaigns>[];
  totals: ReturnType<typeof aggregatePortfolioCampaigns>;
  reviews: ReviewQueueRow[];
  last_week_sends: SentCampaign[];
  /** Solo con cliente o tienda elegidos: las campañas vivas, para calendario y cola. */
  items?: CampaignBrief[];
  stores?: StoreCampaignSummary[];
  truncated: boolean;
};

const brief = (row: ItemRow, state: CampaignBrief["state"], storeLabel: string | null): CampaignBrief => ({
  id: row.id,
  title: row.title,
  channel: row.channel,
  starts_at: row.starts_at,
  state,
  origin: row.origin,
  review_status: row.review_status,
  store_id: row.store_id,
  store_label: storeLabel,
});

/** Estadisticas por campaña de Klaviyo de un cliente (vida entera), indexadas por id externo. */
async function loadKlaviyoStats(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  now: Date,
): Promise<Map<string, Stats>> {
  const day = (value: Date) => value.toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("klaviyo_entity_stats", {
    target_organization_id: organizationId,
    period_start: day(new Date(now.getTime() - 400 * DAY_MS)),
    period_end: day(now),
    target_store_id: null,
  });
  if (error) {
    logger.error("consultant_campaigns_klaviyo_stats_failed", { organization_id: organizationId, error: error.message });
    return new Map();
  }
  const stats = new Map<string, Stats>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    if (row.level !== "entity" || row.entity_type !== "campaign") continue;
    stats.set(String(row.external_entity_id), {
      delivered: num(row.delivered),
      opens_unique: num(row.opens_unique),
      clicks_unique: num(row.clicks_unique),
      revenue: num(row.revenue),
    });
  }
  return stats;
}

function rollupOf(sends: SentCampaign[]): SentRollup {
  if (sends.length === 0) return emptySentRollup();
  const delivered = sends.reduce((total, send) => total + send.delivered, 0);
  const opens = sends.reduce((total, send) => total + (send.open_rate ?? 0) * send.delivered, 0);
  const clicks = sends.reduce((total, send) => total + (send.click_rate ?? 0) * send.delivered, 0);
  const revenueRows = sends.filter((send) => send.revenue !== null);
  return {
    sent: sends.length,
    open_rate: delivered > 0 ? opens / delivered : null,
    click_rate: delivered > 0 ? clicks / delivered : null,
    revenue: revenueRows.length ? revenueRows.reduce((total, send) => total + (send.revenue as number), 0) : null,
  };
}

export async function getConsultantCampaignsOverview(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  query: { organizationId?: string | undefined; storeId?: string | undefined; connectionId?: string | undefined },
) {
  const orgsResult = await listConsultantOrganizations(env, authorization, context);
  if (orgsResult.ok === false) return orgsResult;

  let organizations = orgsResult.data.organizations;
  if (query.organizationId) {
    organizations = organizations.filter((organization) => organization.id === query.organizationId);
    if (organizations.length === 0) {
      return {
        ok: false as const,
        statusCode: 403,
        error: "organization_not_in_portfolio",
        message: "Ese cliente no está en tu cartera.",
      };
    }
  }
  // La pantalla conoce la tienda por su conexion (el selector del shell); aqui se traduce a la tienda.
  let storeId = query.storeId;
  if (!storeId && query.connectionId && query.organizationId) {
    const { data: store } = await createServiceClient(env)
      .from("shopify_stores")
      .select("id")
      .eq("organization_id", query.organizationId)
      .eq("connection_id", query.connectionId)
      .eq("is_active", true)
      .maybeSingle();
    if (!store) {
      return { ok: false as const, statusCode: 404, error: "campaign_store_not_found", message: "Esa tienda no existe en este cliente." };
    }
    storeId = store.id as string;
  }
  return buildCampaignsOverview(env, context.user.id, organizations, {
    organizationId: query.organizationId,
    storeId,
  });
}

/** Enlace mas clicado de cada envio. Un fallo no tira la pantalla: ese envio sale sin enlace. */
async function loadTopLinks(
  supabase: ReturnType<typeof createServiceClient>,
  sends: Array<{ organization_id: string; external_campaign_id: string }>,
): Promise<Map<string, { url: string; clicks: number }>> {
  const top = new Map<string, { url: string; clicks: number }>();
  await mapLimit(sends, CONCURRENCY, async (send) => {
    const { data, error } = await supabase.rpc("klaviyo_campaign_link_clicks", {
      target_organization_id: send.organization_id,
      target_external_campaign_id: send.external_campaign_id,
    });
    if (error) {
      logger.error("consultant_campaigns_top_link_failed", { organization_id: send.organization_id, error: error.message });
      return;
    }
    const best = ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => ({ url: String(row.url), clicks: num(row.clicks) }))
      .sort((a, b) => b.clicks - a.clicks)[0];
    if (best && best.clicks > 0) top.set(`${send.organization_id}:${send.external_campaign_id}`, best);
  });
  return top;
}

/**
 * La lectura en si, sobre las organizaciones que ya se ha comprobado que son de
 * la cartera de quien pregunta. Aparte para poder ejercitarla sin una sesion.
 */
export async function buildCampaignsOverview(
  env: ApiEnv,
  userId: string,
  portfolio: Array<{ id: string; display_name: string }>,
  query: { organizationId?: string | undefined; storeId?: string | undefined },
) {
  const truncated = portfolio.length > MAX_ORGS;
  const organizations = portfolio.slice(0, MAX_ORGS);

  const cacheKey = `consultant:campaigns:v2:${userId}:${query.organizationId ?? "all"}:${query.storeId ?? "all"}`;
  const cached = await getCached<ConsultantCampaignsOverview>(env.REDIS_URL, cacheKey);
  if (cached) return { ok: true as const, data: cached };

  const now = new Date();
  const nowMs = now.getTime();
  const orgIds = organizations.map((organization) => organization.id);
  const nameByOrg = new Map(organizations.map((organization) => [organization.id, organization.display_name]));
  const level: ConsultantCampaignsOverview["level"] = query.organizationId
    ? query.storeId
      ? "store"
      : "client"
    : "portfolio";

  const supabase = createServiceClient(env);
  if (orgIds.length === 0) {
    const totals = aggregatePortfolioCampaigns([]);
    const data: ConsultantCampaignsOverview = {
      level,
      organization_id: query.organizationId ?? null,
      store_id: query.storeId ?? null,
      generated_at: now.toISOString(),
      currency_code: null,
      headline: buildPortfolioCampaignsHeadline([], totals),
      clients: [],
      totals,
      reviews: [],
      last_week_sends: [],
      truncated,
    };
    return { ok: true as const, data };
  }

  const windowStart = new Date(nowMs - LOOKBACK_DAYS * DAY_MS).toISOString();
  const windowEnd = new Date(nowMs + LOOKAHEAD_DAYS * DAY_MS).toISOString();
  const [storesResult, itemsResult, accountsResult] = await Promise.all([
    supabase
      .from("shopify_stores")
      .select("id, organization_id, connection_id, shop_name, myshopify_domain")
      .in("organization_id", orgIds)
      .eq("is_active", true),
    supabase
      .from("campaign_calendar_items")
      .select(
        "id, organization_id, store_id, title, channel, starts_at, ends_at, status, origin, review_status, review_requested_at, marketing_draft_id, meta_campaign_id, klaviyo_campaign_id, metadata",
      )
      .in("organization_id", orgIds)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .gte("starts_at", windowStart)
      .lte("starts_at", windowEnd)
      .order("starts_at", { ascending: true })
      .limit(MAX_ITEMS),
    supabase.from("klaviyo_accounts").select("organization_id, currency_code").in("organization_id", orgIds),
  ]);
  if (storesResult.error || itemsResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_campaigns_load_failed",
      detail: storesResult.error?.message ?? itemsResult.error?.message,
    };
  }
  const stores = (storesResult.data ?? []) as Array<{
    id: string;
    organization_id: string;
    connection_id: string | null;
    shop_name: string | null;
    myshopify_domain: string | null;
  }>;
  const storeLabel = new Map(stores.map((store) => [store.id, store.myshopify_domain ?? store.shop_name ?? "Tienda"]));
  const storeCount = new Map<string, number>();
  for (const store of stores) storeCount.set(store.organization_id, (storeCount.get(store.organization_id) ?? 0) + 1);
  const currencyByOrg = new Map<string, string | null>();
  for (const account of (accountsResult.data ?? []) as Array<{ organization_id: string; currency_code: string | null }>) {
    if (!currencyByOrg.has(account.organization_id)) currencyByOrg.set(account.organization_id, account.currency_code);
  }

  const itemRows = (itemsResult.data ?? []) as unknown as ItemRow[];
  const draftIds = [...new Set(itemRows.map((row) => row.marketing_draft_id).filter((id): id is string => Boolean(id)))];
  const klaviyoIds = [...new Set(itemRows.map((row) => row.klaviyo_campaign_id).filter((id): id is string => Boolean(id)))];
  const metaIds = [...new Set(itemRows.map((row) => row.meta_campaign_id).filter((id): id is string => Boolean(id)))];

  const lastWeekStart = new Date(nowMs - 7 * DAY_MS).toISOString();
  const [draftsResult, klaviyoResult, metaResult, sentResult, correctionsResult] = await Promise.all([
    draftIds.length
      ? supabase.from("marketing_content_drafts").select("id, status").in("id", draftIds)
      : Promise.resolve({ data: [], error: null }),
    klaviyoIds.length
      ? supabase.from("klaviyo_campaigns").select("id, status").in("id", klaviyoIds)
      : Promise.resolve({ data: [], error: null }),
    metaIds.length
      ? supabase.from("meta_campaigns").select("id, effective_status").in("id", metaIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("klaviyo_campaigns")
      .select("id, organization_id, external_campaign_id, name, status, send_time")
      .in("organization_id", orgIds)
      .gte("send_time", lastWeekStart)
      .lte("send_time", now.toISOString())
      .order("send_time", { ascending: false })
      .limit(500),
    supabase
      .from("campaign_item_notes")
      .select("item_id")
      .in("organization_id", orgIds)
      .eq("kind", "correction")
      .is("resolution", null),
  ]);

  const draftStatus = new Map(((draftsResult.data ?? []) as Array<{ id: string; status: string }>).map((row) => [row.id, row.status]));
  const klaviyoStatus = new Map(((klaviyoResult.data ?? []) as Array<{ id: string; status: string }>).map((row) => [row.id, row.status]));
  const metaStatus = new Map(((metaResult.data ?? []) as Array<{ id: string; effective_status: string | null }>).map((row) => [row.id, row.effective_status]));
  const openCorrections = new Map<string, number>();
  for (const row of (correctionsResult.data ?? []) as Array<{ item_id: string }>) {
    openCorrections.set(row.item_id, (openCorrections.get(row.item_id) ?? 0) + 1);
  }

  const briefs = itemRows.map((row) =>
    brief(
      row,
      campaignWorkState(
        {
          status: row.status,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          has_draft: Boolean(row.marketing_draft_id),
          draft_status: row.marketing_draft_id ? (draftStatus.get(row.marketing_draft_id) ?? null) : null,
          klaviyo_status: row.klaviyo_campaign_id ? (klaviyoStatus.get(row.klaviyo_campaign_id) ?? null) : null,
          meta_status: row.meta_campaign_id ? (metaStatus.get(row.meta_campaign_id) ?? null) : null,
          is_a05_proposal: Boolean(row.metadata?.a05_proposal),
        },
        nowMs,
      ),
      row.store_id ? (storeLabel.get(row.store_id) ?? null) : null,
    ),
  );
  const briefOrg = new Map(itemRows.map((row, index) => [briefs[index]!.id, row.organization_id]));

  // Lo que salio la semana pasada, con sus cifras (stats de toda la vida de cada campaña).
  const sentRows = ((sentResult.data ?? []) as Array<{
    id: string;
    organization_id: string;
    external_campaign_id: string;
    name: string;
    status: string | null;
    send_time: string;
  }>).filter((row) => /sent/i.test(row.status ?? ""));
  const sentOrgs = [...new Set(sentRows.map((row) => row.organization_id))];
  const statsByOrg = new Map<string, Map<string, Stats>>();
  await mapLimit(sentOrgs, CONCURRENCY, async (organizationId) => {
    statsByOrg.set(organizationId, await loadKlaviyoStats(supabase, organizationId, now));
  });
  const topLinks = await loadTopLinks(supabase, sentRows.slice(0, 40));
  const storeOfKlaviyo = new Map(
    itemRows.filter((row) => row.klaviyo_campaign_id).map((row) => [row.klaviyo_campaign_id as string, row.store_id]),
  );
  const sends: SentCampaign[] = sentRows.map((row) => {
    const stats = statsByOrg.get(row.organization_id)?.get(row.external_campaign_id);
    const delivered = stats?.delivered ?? 0;
    return {
      organization_id: row.organization_id,
      organization_name: nameByOrg.get(row.organization_id) ?? row.organization_id,
      campaign_id: row.id,
      name: row.name,
      sent_at: row.send_time,
      delivered,
      open_rate: delivered > 0 ? (stats?.opens_unique ?? 0) / delivered : null,
      click_rate: delivered > 0 ? (stats?.clicks_unique ?? 0) / delivered : null,
      revenue: stats ? stats.revenue : null,
      currency_code: currencyByOrg.get(row.organization_id) ?? null,
      store_id: storeOfKlaviyo.get(row.id) ?? null,
      top_link: topLinks.get(`${row.organization_id}:${row.external_campaign_id}`) ?? null,
    };
  });

  const clients = organizations.map((organization) => {
    const orgBriefs = briefs.filter((item) => briefOrg.get(item.id) === organization.id);
    return summarizeClientCampaigns({
      organization_id: organization.id,
      organization_name: organization.display_name,
      store_count: storeCount.get(organization.id) ?? 0,
      items: orgBriefs,
      last_week: rollupOf(sends.filter((send) => send.organization_id === organization.id)),
      nowMs,
    });
  });

  // Solo se suman EUR entre clientes que miden en la misma moneda.
  const currencies = clients
    .map((client) => currencyByOrg.get(client.organization_id) ?? null)
    .filter((code): code is string => Boolean(code));
  const baseCurrency =
    [...new Set(currencies)].sort(
      (a, b) => currencies.filter((code) => code === b).length - currencies.filter((code) => code === a).length,
    )[0] ?? null;
  const sumable = clients.map((client) =>
    (currencyByOrg.get(client.organization_id) ?? baseCurrency) === baseCurrency
      ? client
      : { ...client, last_week: { ...client.last_week, revenue: null } },
  );
  const totals = aggregatePortfolioCampaigns(sumable);

  const reviews: ReviewQueueRow[] = itemRows
    .filter((row) => row.origin === "client" && (row.review_status === "pending" || row.review_status === "changes_requested"))
    .map((row) => ({
      item_id: row.id,
      organization_id: row.organization_id,
      organization_name: nameByOrg.get(row.organization_id) ?? row.organization_id,
      title: row.title,
      channel: row.channel,
      starts_at: row.starts_at,
      review_status: row.review_status as CampaignReviewStatus,
      review_requested_at: row.review_requested_at,
      open_corrections: openCorrections.get(row.id) ?? 0,
    }))
    .sort((a, b) =>
      a.review_status === b.review_status
        ? Date.parse(a.starts_at) - Date.parse(b.starts_at)
        : a.review_status === "pending"
          ? -1
          : 1,
    );

  let headline = buildPortfolioCampaignsHeadline(clients, totals);
  let items: CampaignBrief[] | undefined;
  let storeSummaries: StoreCampaignSummary[] | undefined;
  if (query.organizationId) {
    const only = clients[0]!;
    const orgBriefs = briefs.filter((item) => briefOrg.get(item.id) === query.organizationId);
    const orgStores = stores.filter((store) => store.organization_id === query.organizationId);
    storeSummaries = orgStores.map((store) => {
      const storeBriefs = orgBriefs.filter((item) => item.store_id === store.id);
      const week = storeBriefs.filter(
        (item) => UPCOMING_CAMPAIGN_STATES.includes(item.state) && item.state !== "late" && isWithinNextDays(item.starts_at, nowMs),
      );
      return {
        store_id: store.id,
        connection_id: store.connection_id,
        label: storeLabel.get(store.id) ?? "Tienda",
        week,
        late: storeBriefs.filter((item) => item.state === "late").length,
        awaiting_review: storeBriefs.filter((item) => item.origin === "client" && item.review_status === "pending").length,
        no_piece_soon: week.filter((item) => item.state === "nopiece" && item.origin !== "client").length,
        last_week: rollupOf(sends.filter((send) => send.store_id === store.id)),
      };
    });
    if (query.storeId) {
      // Una campaña sin tienda concreta cuenta para todas las de su cliente.
      items = orgBriefs.filter((item) => item.store_id === null || item.store_id === query.storeId);
      headline = buildStoreCampaignsHeadline(storeLabel.get(query.storeId) ?? "Esta tienda", items, nowMs);
    } else {
      items = orgBriefs;
      headline = buildClientCampaignsHeadline(only, orgBriefs);
    }
  }

  const data: ConsultantCampaignsOverview = {
    level,
    organization_id: query.organizationId ?? null,
    store_id: query.storeId ?? null,
    generated_at: now.toISOString(),
    currency_code: baseCurrency,
    headline,
    clients,
    totals,
    reviews,
    last_week_sends: query.storeId ? sends.filter((send) => send.store_id === query.storeId) : sends,
    ...(items ? { items } : {}),
    ...(storeSummaries ? { stores: storeSummaries } : {}),
    truncated,
  };
  await setCached(env.REDIS_URL, cacheKey, data, CACHE_TTL_SECONDS);
  return { ok: true as const, data };
}
