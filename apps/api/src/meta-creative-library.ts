import { type AuthContext, createUserScopedClient, requireOperationalOrganization } from "./auth-context.js";

type ApiEnv = { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string };
type Input = { connectionId?: string; q?: string; page?: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 36;

type Creative = {
  id: string;
  ad_account_id: string;
  external_creative_id: string;
  name: string | null;
  object_type: string | null;
  primary_text: string | null;
  headline: string | null;
  description: string | null;
  link_url: string | null;
  thumbnail_url: string | null;
  image_hash: string | null;
  external_video_id: string | null;
  last_synced_at: string | null;
};

type Asset = {
  id: string;
  creative_id: string;
  asset_type: string;
  position: number;
  text_value: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  link_url: string | null;
  asset_label: string | null;
  is_primary: boolean;
  metadata: Record<string, unknown> | null;
};

type Ad = {
  id: string;
  ad_set_id: string;
  current_creative_id: string;
  external_ad_id: string;
  name: string;
  configured_status: string | null;
  effective_status: string | null;
  review_feedback: unknown;
  last_synced_at: string | null;
};

type AdSet = {
  id: string;
  campaign_id: string;
  name: string;
  effective_status: string | null;
  daily_budget: number | string | null;
  lifetime_budget: number | string | null;
  budget_remaining: number | string | null;
};
type Campaign = {
  id: string;
  name: string;
  effective_status: string | null;
  objective: string | null;
  daily_budget: number | string | null;
  lifetime_budget: number | string | null;
  budget_remaining: number | string | null;
};
type Account = {
  id: string;
  name: string | null;
  currency_code: string | null;
};

function pageNumber(value: string | undefined) {
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page > 0 && page <= 100_000
    ? page
    : null;
}

function asMoney(value: number | string | null | undefined) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shortReviewFeedback(value: unknown): string | null {
  if (typeof value === "string") return value.slice(0, 500);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  for (const key of ["message", "error_message", "summary", "reason"]) {
    const candidate = object[key];
    if (typeof candidate === "string" && candidate.trim())
      return candidate.trim().slice(0, 500);
  }
  return null;
}

export function mapMetaCreativeLibraryRows(input: {
  creatives: Creative[];
  assets: Asset[];
  ads: Ad[];
  adSets: AdSet[];
  campaigns: Campaign[];
  accounts: Account[];
}) {
  const assetsByCreative = new Map<string, Asset[]>();
  for (const asset of input.assets) {
    const rows = assetsByCreative.get(asset.creative_id) ?? [];
    rows.push(asset);
    assetsByCreative.set(asset.creative_id, rows);
  }
  const adSetsById = new Map(input.adSets.map((row) => [row.id, row]));
  const campaignsById = new Map(input.campaigns.map((row) => [row.id, row]));
  const accountsById = new Map(input.accounts.map((row) => [row.id, row]));
  const adsByCreative = new Map<string, Ad[]>();
  for (const ad of input.ads) {
    const rows = adsByCreative.get(ad.current_creative_id) ?? [];
    rows.push(ad);
    adsByCreative.set(ad.current_creative_id, rows);
  }

  return input.creatives.map((creative) => {
    const assets = (assetsByCreative.get(creative.id) ?? []).sort(
      (a, b) => a.position - b.position,
    );
    const account = accountsById.get(creative.ad_account_id);
    const ads = (adsByCreative.get(creative.id) ?? []).map((ad) => {
      const adSet = adSetsById.get(ad.ad_set_id);
      const campaign = adSet ? campaignsById.get(adSet.campaign_id) : undefined;
      return {
        id: ad.id,
        external_id: ad.external_ad_id,
        name: ad.name,
        configured_status: ad.configured_status,
        effective_status: ad.effective_status,
        review_feedback: shortReviewFeedback(ad.review_feedback),
        last_synced_at: ad.last_synced_at,
        ad_set: adSet
          ? {
              id: adSet.id,
              name: adSet.name,
              effective_status: adSet.effective_status,
              budget:
                asMoney(adSet.daily_budget) != null
                  ? {
                      amount: asMoney(adSet.daily_budget),
                      kind: "daily" as const,
                    }
                  : asMoney(adSet.lifetime_budget) != null
                    ? {
                        amount: asMoney(adSet.lifetime_budget),
                        kind: "lifetime" as const,
                      }
                    : null,
              budget_remaining: asMoney(adSet.budget_remaining),
            }
          : null,
        campaign: campaign
          ? {
              id: campaign.id,
              name: campaign.name,
              objective: campaign.objective,
              effective_status: campaign.effective_status,
              budget:
                asMoney(campaign.daily_budget) != null
                  ? {
                      amount: asMoney(campaign.daily_budget),
                      kind: "daily" as const,
                    }
                  : asMoney(campaign.lifetime_budget) != null
                    ? {
                        amount: asMoney(campaign.lifetime_budget),
                        kind: "lifetime" as const,
                      }
                    : null,
              budget_remaining: asMoney(campaign.budget_remaining),
            }
          : null,
      };
    });
    return {
      id: creative.id,
      external_id: creative.external_creative_id,
      name: creative.name,
      object_type: creative.object_type,
      primary_text: creative.primary_text,
      headline: creative.headline,
      description: creative.description,
      link_url: creative.link_url,
      thumbnail_url: creative.thumbnail_url,
      image_hash: creative.image_hash,
      external_video_id: creative.external_video_id,
      last_synced_at: creative.last_synced_at,
      account: account
        ? {
            id: account.id,
            name: account.name,
            currency_code: account.currency_code,
          }
        : null,
      assets,
      ads,
      ad_count: ads.length,
    };
  });
}

export async function listMetaCreativeLibrary(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  input: Input,
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (!access.ok) return access;
  if (input.connectionId && !UUID_PATTERN.test(input.connectionId)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_connection_id",
    };
  }
  const page = pageNumber(input.page);
  if (page === null)
    return { ok: false as const, statusCode: 400, error: "invalid_page" };

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  let storeId: string | null = null;
  if (input.connectionId) {
    const { data: store, error: storeError } = await supabase
      .from("shopify_stores")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("connection_id", input.connectionId)
      .maybeSingle();
    if (storeError)
      return {
        ok: false as const,
        statusCode: 500,
        error: "meta_creative_store_scope_failed",
      };
    if (!store)
      return { ok: false as const, statusCode: 404, error: "store_not_found" };
    storeId = store.id as string;
  }

  let accountQuery = supabase
    .from("meta_ad_accounts")
    .select("id, name:account_name, currency_code")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("is_selected", true);
  if (storeId) accountQuery = accountQuery.eq("store_id", storeId);
  const { data: accounts, error: accountsError } = await accountQuery;
  if (accountsError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_creative_accounts_load_failed",
    };
  const accountRows = (accounts ?? []) as Account[];
  const accountIds = accountRows.map((account) => account.id);
  if (!accountIds.length) {
    return {
      ok: true as const,
      data: {
        creatives: [],
        total: 0,
        page,
        page_size: PAGE_SIZE,
        organization_id: organizationId,
        scope: storeId ? "store" : "organization",
      },
    };
  }

  const offset = (page - 1) * PAGE_SIZE;
  let creativesQuery = supabase
    .from("meta_creatives")
    .select(
      "id, ad_account_id, external_creative_id, name, object_type, primary_text, headline, description, link_url, thumbnail_url, image_hash, external_video_id, last_synced_at",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .in("ad_account_id", accountIds)
    .order("last_synced_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);
  const search = input.q?.trim().slice(0, 120);
  const safeSearch = search?.replace(/[,%()\\"]/g, " ").trim();
  if (safeSearch)
    creativesQuery = creativesQuery.or(
      `name.ilike.%${safeSearch}%,primary_text.ilike.%${safeSearch}%,headline.ilike.%${safeSearch}%`,
    );
  const {
    data: creatives,
    count,
    error: creativesError,
  } = await creativesQuery;
  if (creativesError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_creative_library_load_failed",
    };
  const creativeRows = (creatives ?? []) as Creative[];
  const creativeIds = creativeRows.map((creative) => creative.id);
  if (!creativeIds.length) {
    return {
      ok: true as const,
      data: {
        creatives: [],
        total: count ?? 0,
        page,
        page_size: PAGE_SIZE,
        organization_id: organizationId,
        scope: storeId ? "store" : "organization",
      },
    };
  }

  const [assetsResult, adsResult] = await Promise.all([
    supabase
      .from("meta_creative_assets")
      .select(
        "id, creative_id, asset_type, position, text_value, media_url, thumbnail_url, link_url, asset_label, is_primary, metadata",
      )
      .eq("organization_id", organizationId)
      .in("creative_id", creativeIds)
      .order("position", { ascending: true }),
    supabase
      .from("meta_ads")
      .select(
        "id, ad_set_id, current_creative_id, external_ad_id, name, configured_status, effective_status, review_feedback, last_synced_at",
      )
      .eq("organization_id", organizationId)
      .in("current_creative_id", creativeIds),
  ]);
  if (assetsResult.error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_creative_assets_load_failed",
    };
  if (adsResult.error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_creative_ads_load_failed",
    };

  const adRows = (adsResult.data ?? []) as Ad[];
  const adSetIds = [...new Set(adRows.map((ad) => ad.ad_set_id))];
  const { data: adSets, error: adSetsError } = adSetIds.length
    ? await supabase
        .from("meta_ad_sets")
        .select(
          "id, campaign_id, name, effective_status, daily_budget, lifetime_budget, budget_remaining",
        )
        .eq("organization_id", organizationId)
        .in("id", adSetIds)
    : { data: [], error: null };
  if (adSetsError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_creative_ad_sets_load_failed",
    };
  const adSetRows = (adSets ?? []) as AdSet[];
  const campaignIds = [...new Set(adSetRows.map((adSet) => adSet.campaign_id))];
  const { data: campaigns, error: campaignsError } = campaignIds.length
    ? await supabase
        .from("meta_campaigns")
        .select(
          "id, name, effective_status, objective, daily_budget, lifetime_budget, budget_remaining",
        )
        .eq("organization_id", organizationId)
        .in("id", campaignIds)
    : { data: [], error: null };
  if (campaignsError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_creative_campaigns_load_failed",
    };

  const rows = mapMetaCreativeLibraryRows({
    creatives: creativeRows,
    assets: (assetsResult.data ?? []) as Asset[],
    ads: adRows,
    adSets: adSetRows,
    campaigns: (campaigns ?? []) as Campaign[],
    accounts: accountRows,
  });
  return {
    ok: true as const,
    data: {
      creatives: rows,
      total: count ?? rows.length,
      page,
      page_size: PAGE_SIZE,
      organization_id: organizationId,
      scope: storeId ? "store" : "organization",
    },
  };
}
