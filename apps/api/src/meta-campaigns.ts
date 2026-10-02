import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { metaCostRates } from "./meta-insights.js";

/**
 * /meta/campanas y /meta/campanas/[id]: el gasto por campaña que ya agrega
 * meta_spend_by_campaign, con la estructura (estado, presupuesto, conjuntos,
 * anuncios con incidencia) de meta_campaign_structure y una serie diaria por
 * campaña (meta_campaign_daily, que no existía: las series diarias previas
 * eran de toda la cuenta).
 *
 * El ROAS de equilibrio no vive aquí: sale de los costes de producto de
 * Shopify (/shopify/metrics), igual que en /meta. La pantalla lo pide aparte.
 */

type ApiEnv = { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string };

type CampaignQuery = {
  connectionId?: string;
  q?: string;
  status?: string;
  filter?: string;
  sort?: string;
  page?: string;
  periodDays?: string;
};

const PAGE_SIZE = 24;
const MIN_IMPRESSIONS_FOR_RATES = 1000;
const CHANGE_WINDOW_DAYS = 7;
const CHANGE_MIN_SPEND = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = new Set([7, 30, 90, 365]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function periodDaysFrom(value: string | undefined) {
  const parsed = Number(value ?? 30);
  return PERIODS.has(parsed) ? parsed : 30;
}

function pageNumber(value: string | undefined) {
  const parsed = Number(value ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : null;
}

async function loadStoreId(
  supabase: ReturnType<typeof createUserScopedClient>,
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

async function loadCurrency(
  supabase: ReturnType<typeof createUserScopedClient>,
  organizationId: string,
  storeId: string | null,
) {
  let query = supabase
    .from("meta_ad_accounts")
    .select("currency_code")
    .eq("organization_id", organizationId)
    .eq("is_selected", true)
    .eq("is_active", true);
  if (storeId) query = query.eq("store_id", storeId);
  const { data } = await query;
  const codes = new Set((data ?? []).map((row) => row.currency_code as string | null).filter((code): code is string => Boolean(code)));
  return codes.size === 1 ? [...codes][0]! : null;
}

type StructureRow = {
  campaign_id: string;
  name: string;
  objective: string | null;
  effective_status: string | null;
  configured_status: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  budget_remaining: number | null;
  starts_at: string | null;
  ends_at: string | null;
  ad_set_count: number;
  active_ad_set_count: number;
  ad_count: number;
  rejected_ad_count: number;
  learning_ad_set_count: number;
  learning_limited_ad_set_count: number;
};

type SpendRow = {
  campaign_id: string;
  campaign_name: string | null;
  spend: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  purchases: number | string | null;
  purchase_value: number | string | null;
  roas: number | string | null;
  days_with_data: number | string | null;
  purchase_action_type: string | null;
};

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function budgetText(row: StructureRow) {
  if (row.daily_budget != null) return { amount: row.daily_budget, kind: "daily" as const };
  if (row.lifetime_budget != null) return { amount: row.lifetime_budget, kind: "lifetime" as const };
  return null;
}

export async function listMetaCampaigns(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  input: CampaignQuery,
) {
  if (!context.memberships.some((membership) => membership.organization_id === organizationId)) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  }
  const page = pageNumber(input.page);
  if (page === null) return { ok: false as const, statusCode: 400, error: "invalid_page" };
  if (input.connectionId && !UUID_PATTERN.test(input.connectionId)) {
    return { ok: false as const, statusCode: 400, error: "invalid_connection_id" };
  }
  const status = input.status?.toUpperCase() ?? "";
  const filter = input.filter ?? "";
  if (filter && !["rejected", "learning"].includes(filter)) {
    return { ok: false as const, statusCode: 400, error: "invalid_filter" };
  }
  const sort = ["spend", "roas", "name"].includes(input.sort ?? "") ? input.sort! : "spend";
  const periodDays = periodDaysFrom(input.periodDays);

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const storeId = await loadStoreId(supabase, organizationId, input.connectionId);
  const currency = await loadCurrency(supabase, organizationId, storeId);

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * DAY_MS);
  const toDate = (value: Date) => value.toISOString().slice(0, 10);

  const [structureResult, spendResult, dailyResult] = await Promise.all([
    supabase.rpc("meta_campaign_structure", { target_organization_id: organizationId, target_store_id: storeId }),
    supabase.rpc("meta_spend_by_campaign", {
      target_organization_id: organizationId,
      period_start: toDate(periodStart),
      period_end: toDate(periodEnd),
      target_store_id: storeId,
    }),
    supabase.rpc("meta_campaign_daily", {
      target_organization_id: organizationId,
      period_start: toDate(periodStart),
      period_end: toDate(periodEnd),
      target_store_id: storeId,
      target_campaign_id: null,
    }),
  ]);
  if (structureResult.error) return { ok: false as const, statusCode: 500, error: "meta_campaign_structure_failed", detail: structureResult.error.message };
  if (spendResult.error) return { ok: false as const, statusCode: 500, error: "meta_spend_by_campaign_failed", detail: spendResult.error.message };

  const structureRows = (structureResult.data ?? []) as StructureRow[];
  const spendById = new Map(((spendResult.data ?? []) as SpendRow[]).map((row) => [row.campaign_id, row]));
  const dailyByCampaign = new Map<string, Array<{ date: string; spend: number }>>();
  if (!dailyResult.error) {
    for (const row of (dailyResult.data ?? []) as Array<{ campaign_id: string; bucket_date: string; spend: number }>) {
      const list = dailyByCampaign.get(row.campaign_id) ?? [];
      list.push({ date: row.bucket_date, spend: num(row.spend) });
      dailyByCampaign.set(row.campaign_id, list);
    }
  }

  let rows = structureRows.map((structure) => {
    const spendRow = spendById.get(structure.campaign_id);
    const spend = num(spendRow?.spend);
    const impressions = num(spendRow?.impressions);
    const clicks = num(spendRow?.clicks);
    return {
      campaign_id: structure.campaign_id,
      name: structure.name,
      objective: structure.objective,
      effective_status: structure.effective_status,
      budget: budgetText(structure),
      ad_set_count: Number(structure.ad_set_count),
      active_ad_set_count: Number(structure.active_ad_set_count),
      ad_count: Number(structure.ad_count),
      rejected_ad_count: Number(structure.rejected_ad_count),
      learning_ad_set_count: Number(structure.learning_ad_set_count) + Number(structure.learning_limited_ad_set_count),
      learning_limited_ad_set_count: Number(structure.learning_limited_ad_set_count),
      spend,
      impressions,
      clicks,
      purchases: num(spendRow?.purchases),
      purchase_value: num(spendRow?.purchase_value),
      roas: spendRow?.roas == null ? null : num(spendRow.roas),
      purchase_action_type: spendRow?.purchase_action_type ?? null,
      days_with_data: num(spendRow?.days_with_data),
      ...metaCostRates(spend, impressions, clicks),
      daily_spend: dailyByCampaign.get(structure.campaign_id) ?? [],
    };
  });

  if (status) rows = rows.filter((row) => row.effective_status === status);
  if (filter === "rejected") rows = rows.filter((row) => row.rejected_ad_count > 0);
  if (filter === "learning") rows = rows.filter((row) => row.learning_ad_set_count > 0);
  const search = input.q?.trim().toLowerCase().slice(0, 120);
  if (search) rows = rows.filter((row) => row.name.toLowerCase().includes(search));

  rows.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "es") : (b[sort as "spend" | "roas"] ?? -1) - (a[sort as "spend" | "roas"] ?? -1)));

  const total = rows.length;
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      currency,
      period: { days: periodDays, start: periodStart.toISOString(), end: periodEnd.toISOString() },
      min_impressions_for_rates: MIN_IMPRESSIONS_FOR_RATES,
      page,
      page_size: PAGE_SIZE,
      total,
      campaigns: pageRows,
      summary: {
        total: structureRows.length,
        active: structureRows.filter((row) => row.effective_status === "ACTIVE").length,
        paused: structureRows.filter((row) => row.effective_status === "PAUSED").length,
        rejected: structureRows.filter((row) => row.rejected_ad_count > 0).length,
        learning: structureRows.filter((row) => row.learning_ad_set_count > 0 || row.learning_limited_ad_set_count > 0).length,
        spend: [...spendById.values()].reduce((sum, row) => sum + num(row.spend), 0),
        purchase_value: [...spendById.values()].reduce((sum, row) => sum + num(row.purchase_value), 0),
      },
    },
  };
}

export async function getMetaCampaignDetail(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  campaignId: string,
  input: Pick<CampaignQuery, "connectionId" | "periodDays">,
) {
  if (!context.memberships.some((membership) => membership.organization_id === organizationId)) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  }
  if (!UUID_PATTERN.test(campaignId)) return { ok: false as const, statusCode: 404, error: "campaign_not_found" };
  if (input.connectionId && !UUID_PATTERN.test(input.connectionId)) {
    return { ok: false as const, statusCode: 400, error: "invalid_connection_id" };
  }
  const periodDays = periodDaysFrom(input.periodDays);

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const storeId = await loadStoreId(supabase, organizationId, input.connectionId);
  const currency = await loadCurrency(supabase, organizationId, storeId);

  const { data: campaignRow, error: campaignError } = await supabase
    .from("meta_campaigns")
    .select("id, ad_account_id, external_created_at, external_updated_at")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError) return { ok: false as const, statusCode: 500, error: "meta_campaign_load_failed", detail: campaignError.message };
  if (!campaignRow) return { ok: false as const, statusCode: 404, error: "campaign_not_found" };
  if (storeId) {
    const { data: account } = await supabase.from("meta_ad_accounts").select("store_id").eq("id", campaignRow.ad_account_id).maybeSingle();
    if (account && account.store_id !== storeId) return { ok: false as const, statusCode: 404, error: "campaign_not_found" };
  }

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * DAY_MS);
  const toDate = (value: Date) => value.toISOString().slice(0, 10);
  const window = { target_organization_id: organizationId, period_start: toDate(periodStart), period_end: toDate(periodEnd), target_store_id: storeId };

  const [structureResult, spendResult, dailyResult, adSetsResult, adsResult, changesResult, issuesResult] = await Promise.all([
    supabase.rpc("meta_campaign_structure", { target_organization_id: organizationId, target_store_id: storeId }),
    supabase.rpc("meta_spend_by_campaign", { ...window }),
    supabase.rpc("meta_campaign_daily", { ...window, target_campaign_id: campaignId }),
    supabase.rpc("meta_learning_phase_status", { ...window, target_campaign_id: campaignId }),
    supabase.rpc("meta_creative_performance", { ...window, min_impressions: MIN_IMPRESSIONS_FOR_RATES, target_campaign_id: campaignId }),
    supabase.rpc("meta_change_impact", { ...window, window_days: CHANGE_WINDOW_DAYS, min_spend: CHANGE_MIN_SPEND, target_campaign_id: campaignId }),
    supabase.rpc("meta_campaign_ad_issues", { target_organization_id: organizationId, target_campaign_id: campaignId }),
  ]);
  if (structureResult.error) return { ok: false as const, statusCode: 500, error: "meta_campaign_structure_failed", detail: structureResult.error.message };

  const structure = (structureResult.data as StructureRow[] | null)?.find((row) => row.campaign_id === campaignId);
  if (!structure) return { ok: false as const, statusCode: 404, error: "campaign_not_found" };
  const spendRow = (spendResult.data as SpendRow[] | null)?.find((row) => row.campaign_id === campaignId);
  const spend = num(spendRow?.spend);
  const impressions = num(spendRow?.impressions);
  const clicks = num(spendRow?.clicks);

  const unavailable: string[] = [];
  const rowsOf = <T>(result: { data: unknown; error: { message: string } | null }, name: string): T[] => {
    if (result.error) {
      unavailable.push(name);
      return [];
    }
    return (result.data ?? []) as T[];
  };

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      currency,
      period: { days: periodDays, start: periodStart.toISOString(), end: periodEnd.toISOString() },
      min_impressions_for_rates: MIN_IMPRESSIONS_FOR_RATES,
      change_window_days: CHANGE_WINDOW_DAYS,
      campaign: {
        campaign_id: structure.campaign_id,
        name: structure.name,
        objective: structure.objective,
        effective_status: structure.effective_status,
        configured_status: structure.configured_status,
        budget: budgetText(structure),
        budget_remaining: structure.budget_remaining,
        starts_at: structure.starts_at,
        ends_at: structure.ends_at,
        external_created_at: campaignRow.external_created_at,
        external_updated_at: campaignRow.external_updated_at,
        ad_set_count: Number(structure.ad_set_count),
        ad_count: Number(structure.ad_count),
        spend,
        impressions,
        clicks,
        purchases: num(spendRow?.purchases),
        purchase_value: num(spendRow?.purchase_value),
        roas: spendRow?.roas == null ? null : num(spendRow.roas),
        purchase_action_type: spendRow?.purchase_action_type ?? null,
        ...metaCostRates(spend, impressions, clicks),
      },
      daily: rowsOf<{ bucket_date: string; spend: number | string; purchases: number | string; purchase_value: number | string }>(dailyResult, "daily").map((row) => ({
        date: row.bucket_date,
        spend: num(row.spend),
        purchases: num(row.purchases),
        purchase_value: num(row.purchase_value),
      })),
      ad_sets: rowsOf(adSetsResult, "ad_sets"),
      ads: rowsOf(adsResult, "ads"),
      changes: rowsOf(changesResult, "changes"),
      issues: rowsOf(issuesResult, "issues"),
      unavailable,
    },
  };
}
