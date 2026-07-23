import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { metaGraphGetAll } from "./meta-client.js";
import { getValidMetaAccessToken } from "./meta.js";

type ApiEnv = LoadedApiEnv;

const logger = createLogger("meta-sync");
const INSIGHTS_LOOKBACK_DAYS = 90;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

type SyncBlockResult = { read: number; written: number };

async function recordSyncRun(
  supabase: SupabaseClient,
  connectionId: string,
  organizationId: string,
  scope: string,
  runner: () => Promise<SyncBlockResult>,
) {
  const startedAt = new Date().toISOString();
  const idempotencyKey = `meta:${scope}:${connectionId}:${startedAt.slice(0, 10)}`;

  const base = {
    connection_id: connectionId,
    organization_id: organizationId,
    provider: "meta_ads",
    sync_type: "initial_import",
    sync_scope: scope,
    idempotency_key: idempotencyKey,
    started_at: startedAt,
  };

  await supabase
    .from("integration_sync_runs")
    .upsert(
      { ...base, status: "running", records_read: 0, records_written: 0, records_failed: 0 },
      { onConflict: "provider,idempotency_key" },
    );

  try {
    const result = await runner();
    await supabase
      .from("integration_sync_runs")
      .upsert(
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
    logger.error("meta_sync_block_failed", {
      scope,
      connection_id: connectionId,
      organization_id: organizationId,
      message,
    });
    await supabase
      .from("integration_sync_runs")
      .upsert(
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
  actions?: Array<{ action_type?: string; value?: string }>;
  action_values?: Array<{ action_type?: string; value?: string }>;
  purchase_roas?: Array<{ action_type?: string; value?: string }>;
};

async function syncAdAccountStructure(
  supabase: SupabaseClient,
  organizationId: string,
  adAccountRowId: string,
  externalAdAccountId: string,
  accessToken: string,
): Promise<SyncBlockResult> {
  let read = 0;
  let written = 0;
  const now = new Date().toISOString();

  const campaigns = await metaGraphGetAll<CampaignNode>(`${externalAdAccountId}/campaigns`, accessToken, {
    fields:
      "id,name,objective,buying_type,configured_status,effective_status,special_ad_categories,daily_budget,lifetime_budget,budget_remaining,bid_strategy,start_time,stop_time,created_time,updated_time",
  });
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
          daily_budget: campaign.daily_budget != null ? Number(campaign.daily_budget) / 100 : null,
          lifetime_budget: campaign.lifetime_budget != null ? Number(campaign.lifetime_budget) / 100 : null,
          budget_remaining: campaign.budget_remaining != null ? Number(campaign.budget_remaining) / 100 : null,
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

  const adSets = await metaGraphGetAll<CampaignNode>(`${externalAdAccountId}/adsets`, accessToken, {
    fields:
      "id,name,campaign_id,configured_status,effective_status,optimization_goal,billing_event,bid_strategy,bid_amount,daily_budget,lifetime_budget,budget_remaining,destination_type,promoted_object,targeting,attribution_spec,is_dynamic_creative,start_time,end_time,created_time,updated_time",
  });
  read += adSets.length;

  const adSetIdMap = new Map<string, string>();

  for (const adSet of adSets) {
    const campaignRowId = campaignIdMap.get(adSet.campaign_id as string);

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
          bid_amount: adSet.bid_amount != null ? Number(adSet.bid_amount) / 100 : null,
          daily_budget: adSet.daily_budget != null ? Number(adSet.daily_budget) / 100 : null,
          lifetime_budget: adSet.lifetime_budget != null ? Number(adSet.lifetime_budget) / 100 : null,
          budget_remaining: adSet.budget_remaining != null ? Number(adSet.budget_remaining) / 100 : null,
          destination_type: (adSet.destination_type as string) ?? null,
          promoted_object: adSet.promoted_object ?? null,
          targeting_data: adSet.targeting ?? null,
          attribution_spec: adSet.attribution_spec ?? null,
          is_dynamic_creative: Boolean(adSet.is_dynamic_creative),
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

  const creatives = await metaGraphGetAll<CampaignNode>(`${externalAdAccountId}/adcreatives`, accessToken, {
    fields:
      "id,name,object_type,object_story_id,effective_object_story_id,call_to_action_type,body,title,link_url,thumbnail_url,image_hash,video_id,url_tags,object_story_spec,asset_feed_spec,degrees_of_freedom_spec",
  });
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
          effective_object_story_id: (creative.effective_object_story_id as string) ?? null,
          call_to_action_type: (creative.call_to_action_type as string) ?? null,
          primary_text: (creative.body as string) ?? null,
          headline: typeof creative.title === "string" ? creative.title.slice(0, 500) : null,
          link_url: (creative.link_url as string) ?? null,
          thumbnail_url: (creative.thumbnail_url as string) ?? null,
          image_hash: (creative.image_hash as string) ?? null,
          external_video_id: creative.video_id != null ? String(creative.video_id) : null,
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
  }

  const ads = await metaGraphGetAll<CampaignNode>(`${externalAdAccountId}/ads`, accessToken, {
    fields:
      "id,name,adset_id,configured_status,effective_status,creative,tracking_specs,conversion_specs,created_time,updated_time",
  });
  read += ads.length;

  for (const ad of ads) {
    const adSetRowId = adSetIdMap.get(ad.adset_id as string);

    if (!adSetRowId) {
      continue;
    }

    const creativeExternalId = (ad.creative as { id?: string } | undefined)?.id;

    const { error } = await supabase
      .from("meta_ads")
      .upsert(
        {
          organization_id: organizationId,
          ad_set_id: adSetRowId,
          current_creative_id: creativeExternalId ? creativeIdMap.get(creativeExternalId) ?? null : null,
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
      );

    if (error) {
      throw new Error(`meta_ad_upsert_failed: ${error.message}`);
    }

    written += 1;
  }

  return { read, written };
}

async function syncAdAccountInsights(
  supabase: SupabaseClient,
  organizationId: string,
  adAccountRowId: string,
  externalAdAccountId: string,
  accessToken: string,
): Promise<SyncBlockResult> {
  let read = 0;
  let written = 0;

  const until = new Date();
  const since = new Date(until.getTime() - INSIGHTS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const insights = await metaGraphGetAll<InsightNode>(`${externalAdAccountId}/insights`, accessToken, {
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
    }),
    fields:
      "ad_id,adset_id,campaign_id,date_start,spend,impressions,reach,frequency,clicks,unique_clicks,inline_link_clicks,cpm,cpc,ctr,cpp,actions,action_values,purchase_roas",
  });

  read = insights.length;

  // Resolucion de ids internos en bloque para no hacer una query por fila.
  const { data: adRows, error: adLookupError } = await supabase
    .from("meta_ads")
    .select("id, external_ad_id, ad_set_id, meta_ad_sets(campaign_id)")
    .eq("organization_id", organizationId);

  if (adLookupError) {
    throw new Error(`meta_ads_lookup_failed: ${adLookupError.message}`);
  }

  const adMap = new Map<string, { adId: string; adSetId: string; campaignId: string | null }>();
  for (const row of adRows ?? []) {
    const adSetRelation = row.meta_ad_sets as unknown as { campaign_id?: string } | null;
    adMap.set(row.external_ad_id, {
      adId: row.id,
      adSetId: row.ad_set_id,
      campaignId: adSetRelation?.campaign_id ?? null,
    });
  }

  for (const insight of insights) {
    if (!insight.ad_id || !insight.date_start) {
      continue;
    }

    const internal = adMap.get(insight.ad_id);

    const { data: insightRow, error } = await supabase
      .from("meta_insight_rows_daily")
      .upsert(
        {
          organization_id: organizationId,
          ad_account_id: adAccountRowId,
          campaign_id: internal?.campaignId ?? null,
          ad_set_id: internal?.adSetId ?? null,
          ad_id: internal?.adId ?? null,
          level: "ad",
          external_entity_id: insight.ad_id,
          metric_date: insight.date_start,
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
          raw_data: insight,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "ad_account_id,level,external_entity_id,metric_date,breakdown_hash,attribution_hash,action_report_time" },
      )
      .select("id")
      .single();

    if (error) {
      throw new Error(`meta_insight_upsert_failed: ${error.message}`);
    }

    written += 1;

    const actionGroups: Array<{ metricName: string; entries: Array<{ action_type?: string; value?: string }> | undefined }> = [
      { metricName: "actions", entries: insight.actions },
      { metricName: "action_values", entries: insight.action_values },
      { metricName: "purchase_roas", entries: insight.purchase_roas },
    ];

    for (const group of actionGroups) {
      for (const entry of group.entries ?? []) {
        const { error: actionError } = await supabase
          .from("meta_insight_action_metrics")
          .upsert(
            {
              organization_id: organizationId,
              insight_row_id: insightRow.id,
              metric_name: group.metricName,
              action_type: entry.action_type ?? "none",
              value: entry.value != null ? Number(entry.value) : null,
              raw_value: entry,
            },
            { onConflict: "insight_row_id,metric_name,action_type,attribution_window" },
          );

        if (actionError) {
          throw new Error(`meta_action_metric_upsert_failed: ${actionError.message}`);
        }
      }
    }
  }

  return { read, written };
}

export async function runMetaInitialSync(env: ApiEnv, connectionId: string) {
  const supabase = createServiceClient(env);

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, organization_id")
    .eq("id", connectionId)
    .single();

  if (connectionError || !connection) {
    throw new Error(`meta_sync_connection_load_failed: ${connectionError?.message ?? "not_found"}`);
  }

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

  // Bloques independientes por ADR-0006: la estructura y los insights de cada
  // cuenta fallan o triunfan por separado, con su fila en integration_sync_runs.
  for (const account of adAccounts ?? []) {
    const structureOk = await recordSyncRun(
      supabase,
      connectionId,
      connection.organization_id,
      `structure:${account.external_ad_account_id}`,
      () =>
        syncAdAccountStructure(
          supabase,
          connection.organization_id,
          account.id,
          account.external_ad_account_id,
          accessToken,
        ),
    );

    const insightsOk = await recordSyncRun(
      supabase,
      connectionId,
      connection.organization_id,
      `insights:${account.external_ad_account_id}`,
      () =>
        syncAdAccountInsights(
          supabase,
          connection.organization_id,
          account.id,
          account.external_ad_account_id,
          accessToken,
        ),
    );

    anyFailed = anyFailed || !structureOk || !insightsOk;
  }

  const now = new Date().toISOString();
  await supabase
    .from("integration_connections")
    .update({
      status: anyFailed ? "error" : "connected",
      last_sync_at: now,
      ...(anyFailed
        ? { last_error_at: now, last_error_message: "meta_sync_partial_failure" }
        : { last_error_message: null }),
    })
    .eq("id", connectionId);
}
