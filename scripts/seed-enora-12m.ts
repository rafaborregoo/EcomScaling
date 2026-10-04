/**
 * E-NORA coordinated 12-month synthetic seed.
 *
 * IMPORTANT:
 * - Targets the EXISTING connected E-NORA test tenant/store/accounts.
 * - Never creates a second Shopify/Klaviyo/Meta connection.
 * - Never calls provider APIs or sends/publishes anything.
 * - Refuses production and refuses to overwrite non-synthetic Shopify session history.
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { z } from "zod";
import {
  ENORA_PRODUCTS,
  ENORA_SCENARIO_ID,
  ENORA_SOURCE,
  ENORA_NORMALIZED_CURRENCY,
  ENORA_NORMALIZED_TIMEZONE,
  META_CAMPAIGNS,
  META_DERIVED_FORMULAS,
  generateEnoraScenario,
} from "./enora-seed-model.js";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_PRODUCTION_PROJECT_REF: z.string().regex(/^[a-z0-9]{10,30}$/),
  ALLOW_ENORA_SYNTHETIC_SEED: z.literal("true"),
  ENORA_SEED_ORG_SLUG: z.string().min(1).default("prueba-borrego"),
  ENORA_SEED_SHOP_DOMAIN: z.string().min(1).default("e-nora-demo.myshopify.com"),
  ENORA_SEED_META_ACCOUNT_ID: z.string().min(1).default("act_946548861093802"),
  ENORA_SEED_KLAVIYO_ACCOUNT_ID: z.string().min(1).default("WjvTcC"),
});

const env = envSchema.parse(process.env);
const targetProjectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0];
if (targetProjectRef === env.SUPABASE_PRODUCTION_PROJECT_REF) {
  throw new Error(
    "ENORA_SEED_PRODUCTION_PROJECT_REFUSED: use the isolated TEST ES IA Supabase project",
  );
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket as any },
});

type Row = Record<string, any>;

function md5Uuid(value: string) {
  const hex = crypto.createHash("md5").update(value).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function upsertRows(
  table: string,
  rows: Row[],
  onConflict: string,
) {
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const { error } = await supabase
      .from(table)
      .upsert(chunk as never, { onConflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function insertRows(table: string, rows: Row[]) {
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const { error } = await supabase.from(table).insert(chunk as never);
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
}

async function requireOne<T extends Row>(
  table: string,
  query: (builder: any) => any,
  errorCode: string,
): Promise<T> {
  const result = await query(supabase.from(table).select("*"));
  if (result.error) throw new Error(`${errorCode}: ${result.error.message}`);
  if (!result.data || result.data.length !== 1) {
    throw new Error(`${errorCode}: expected exactly one row, found ${result.data?.length ?? 0}`);
  }
  return result.data[0] as T;
}

async function resolveTarget() {
  const organization = await requireOne<Row>(
    "organizations",
    (q) => q.eq("slug", env.ENORA_SEED_ORG_SLUG),
    "ENORA_SEED_TARGET_ORGANIZATION_NOT_FOUND",
  );

  const store = await requireOne<Row>(
    "shopify_stores",
    (q) =>
      q
        .eq("organization_id", organization.id)
        .eq("myshopify_domain", env.ENORA_SEED_SHOP_DOMAIN),
    "ENORA_SEED_TARGET_STORE_NOT_FOUND",
  );

  const shopifyConnection = await requireOne<Row>(
    "integration_connections",
    (q) => q.eq("id", store.connection_id),
    "ENORA_SEED_SHOPIFY_CONNECTION_NOT_FOUND",
  );
  if (
    shopifyConnection.provider !== "shopify" ||
    shopifyConnection.status !== "connected"
  ) {
    throw new Error("ENORA_SEED_SHOPIFY_CONNECTION_NOT_CONNECTED");
  }

  const metaAccount = await requireOne<Row>(
    "meta_ad_accounts",
    (q) =>
      q
        .eq("organization_id", organization.id)
        .eq("store_id", store.id)
        .eq("external_ad_account_id", env.ENORA_SEED_META_ACCOUNT_ID),
    "ENORA_SEED_META_ACCOUNT_NOT_FOUND",
  );
  const metaConnection = await requireOne<Row>(
    "integration_connections",
    (q) => q.eq("id", metaAccount.connection_id),
    "ENORA_SEED_META_CONNECTION_NOT_FOUND",
  );
  if (metaConnection.provider !== "meta_ads" || metaConnection.status !== "connected") {
    throw new Error("ENORA_SEED_META_CONNECTION_NOT_CONNECTED");
  }

  const klaviyoAccount = await requireOne<Row>(
    "klaviyo_accounts",
    (q) =>
      q
        .eq("organization_id", organization.id)
        .eq("store_id", store.id)
        .eq("external_account_id", env.ENORA_SEED_KLAVIYO_ACCOUNT_ID),
    "ENORA_SEED_KLAVIYO_ACCOUNT_NOT_FOUND",
  );
  const klaviyoConnection = await requireOne<Row>(
    "integration_connections",
    (q) => q.eq("id", klaviyoAccount.connection_id),
    "ENORA_SEED_KLAVIYO_CONNECTION_NOT_FOUND",
  );
  if (klaviyoConnection.provider !== "klaviyo" || klaviyoConnection.status !== "connected") {
    throw new Error("ENORA_SEED_KLAVIYO_CONNECTION_NOT_CONNECTED");
  }

  return {
    organization,
    store,
    shopifyConnection,
    metaAccount,
    metaConnection,
    klaviyoAccount,
    klaviyoConnection,
  };
}

async function resolveCatalog(storeId: string) {
  const productIds = ENORA_PRODUCTS.map((product) => product.externalProductId);
  const variantIds = ENORA_PRODUCTS.map((product) => product.externalVariantId);

  const [{ data: products, error: productsError }, { data: variants, error: variantsError }] =
    await Promise.all([
      supabase
        .from("shopify_products")
        .select("id,external_product_id,title,handle")
        .eq("store_id", storeId)
        .in("external_product_id", productIds),
      supabase
        .from("shopify_variants")
        .select("id,product_id,external_variant_id,current_price")
        .eq("store_id", storeId)
        .in("external_variant_id", variantIds),
    ]);

  if (productsError) throw new Error(`ENORA_SEED_PRODUCTS_LOOKUP_FAILED: ${productsError.message}`);
  if (variantsError) throw new Error(`ENORA_SEED_VARIANTS_LOOKUP_FAILED: ${variantsError.message}`);
  if ((products?.length ?? 0) !== ENORA_PRODUCTS.length) {
    throw new Error(
      `ENORA_SEED_PRODUCT_SET_MISMATCH: expected ${ENORA_PRODUCTS.length}, found ${products?.length ?? 0}`,
    );
  }
  if ((variants?.length ?? 0) !== ENORA_PRODUCTS.length) {
    throw new Error(
      `ENORA_SEED_VARIANT_SET_MISMATCH: expected ${ENORA_PRODUCTS.length}, found ${variants?.length ?? 0}`,
    );
  }

  const productByExternalId = new Map(
    (products ?? []).map((row: any) => [row.external_product_id, row]),
  );
  const variantByExternalId = new Map(
    (variants ?? []).map((row: any) => [row.external_variant_id, row]),
  );

  for (const product of ENORA_PRODUCTS) {
    const dbProduct = productByExternalId.get(product.externalProductId);
    const dbVariant = variantByExternalId.get(product.externalVariantId);
    if (!dbProduct || !dbVariant || dbVariant.product_id !== dbProduct.id) {
      throw new Error(`ENORA_SEED_PRODUCT_VARIANT_MAPPING_FAILED: ${product.sku}`);
    }
  }

  return { productByExternalId, variantByExternalId };
}

async function refuseProviderSessionOverwrite(
  organizationId: string,
  storeId: string,
) {
  const { data, error } = await supabase
    .from("shopify_sessions_daily")
    .select("bucket_date,raw")
    .eq("organization_id", organizationId)
    .eq("store_id", storeId)
    .gte("bucket_date", "2025-10-04")
    .lte("bucket_date", "2026-10-03");
  if (error) throw new Error(`ENORA_SEED_SESSION_GUARD_FAILED: ${error.message}`);

  const providerRows = (data ?? []).filter((row: any) => {
    const raw = row.raw as Row | null;
    return raw?.scenario_id !== ENORA_SCENARIO_ID;
  });
  if (providerRows.length > 0) {
    throw new Error(
      `ENORA_SEED_PROVIDER_SESSION_OVERWRITE_REFUSED: found ${providerRows.length} non-synthetic day(s) in the seed window`,
    );
  }
}

async function main() {
  const target = await resolveTarget();
  const catalog = await resolveCatalog(target.store.id);
  await refuseProviderSessionOverwrite(target.organization.id, target.store.id);

  const scenario = generateEnoraScenario();
  const now = new Date().toISOString();

  const flattenedOrders = scenario.flatMap((day) => day.orders);
  const customerStats = new Map<
    string,
    { orders: number; spend: number; lastOrderAt: string | null }
  >();
  const customerOrderCounters = new Map<string, number>();

  for (let i = 1; i <= 240; i += 1) {
    customerStats.set(`syn_customer_${String(i).padStart(4, "0")}`, {
      orders: 0,
      spend: 0,
      lastOrderAt: null,
    });
  }

  const enrichedOrders = flattenedOrders.map((order) => {
    const stats = customerStats.get(order.customerKey)!;
    stats.orders += 1;
    stats.spend += order.netSales;
    stats.lastOrderAt = order.processedAt;

    const customerOrderIndex = (customerOrderCounters.get(order.customerKey) ?? 0) + 1;
    customerOrderCounters.set(order.customerKey, customerOrderIndex);
    return { ...order, customerOrderIndex };
  });

  await upsertRows(
    "shopify_customers",
    [...customerStats.entries()].map(([customerKey, stats]) => ({
      id: md5Uuid(`${ENORA_SCENARIO_ID}:target:shopify:customer:${customerKey}`),
      organization_id: target.organization.id,
      store_id: target.store.id,
      external_customer_id: customerKey,
      customer_reference_hash: sha256(customerKey),
      number_of_orders: stats.orders,
      amount_spent: Math.round(stats.spend * 100) / 100,
      currency_code: ENORA_NORMALIZED_CURRENCY,
      state: "enabled",
      tags: [ENORA_SOURCE, `scenario:${ENORA_SCENARIO_ID}`],
      is_active: true,
      email_marketing_state: "subscribed",
      verified_email: true,
      last_order_at: stats.lastOrderAt,
    })),
    "store_id,external_customer_id",
  );

  await upsertRows(
    "shopify_sessions_daily",
    scenario.map((day) => ({
      id: md5Uuid(`${ENORA_SCENARIO_ID}:target:shopify:sessions:${day.date}`),
      organization_id: target.organization.id,
      store_id: target.store.id,
      bucket_date: day.date,
      sessions: day.shopify.sessions,
      online_store_visitors: day.shopify.visitors,
      conversion_rate:
        day.shopify.sessions > 0
          ? day.shopify.completedCheckout / day.shopify.sessions
          : null,
      sessions_with_cart_additions: day.shopify.cartAdditions,
      sessions_that_reached_checkout: day.shopify.reachedCheckout,
      sessions_that_completed_checkout: day.shopify.completedCheckout,
      raw: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        scenario: day.scenario,
        seed_target: `${env.ENORA_SEED_ORG_SLUG}/${env.ENORA_SEED_SHOP_DOMAIN}`,
        original_timezone: target.store.timezone,
        normalized_timezone: ENORA_NORMALIZED_TIMEZONE,
      },
    })),
    "store_id,bucket_date",
  );

  const orderRows: Row[] = [];
  const orderItemRows: Row[] = [];

  for (const order of enrichedOrders) {
    const productRow = catalog.productByExternalId.get(order.product.externalProductId)!;
    const variantRow = catalog.variantByExternalId.get(order.product.externalVariantId)!;
    const orderId = md5Uuid(
      `${ENORA_SCENARIO_ID}:target:shopify:order:${order.externalOrderId}`,
    );
    const externalLineItemId = `${order.externalOrderId}:line:1`;
    const landing =
      order.channel === "organic"
        ? `/products/${order.product.handle}`
        : `/products/${order.product.handle}?utm_source=${order.utmSource}&utm_medium=${order.utmMedium}&utm_campaign=${order.utmCampaign}&utm_content=${order.utmContent}`;

    orderRows.push({
      id: orderId,
      organization_id: target.organization.id,
      store_id: target.store.id,
      external_order_id: order.externalOrderId,
      order_name: order.orderName,
      customer_reference_hash: sha256(order.customerKey),
      financial_status: "paid",
      fulfillment_status: "fulfilled",
      source_name: "web",
      currency_code: ENORA_NORMALIZED_CURRENCY,
      presentment_currency_code: ENORA_NORMALIZED_CURRENCY,
      gross_sales: order.grossSales,
      discounts: order.discount,
      refunds: 0,
      net_sales: order.netSales,
      current_subtotal_price: order.netSales,
      current_shipping_price: 0,
      current_total_tax: 0,
      current_total_price: order.netSales,
      total_items: order.quantity,
      is_first_customer_order: order.customerOrderIndex === 1,
      is_test_order: false,
      external_created_at: order.processedAt,
      processed_at: order.processedAt,
      customer_order_index: order.customerOrderIndex,
      days_to_conversion: order.channel === "organic" ? 0 : 1,
      first_visit_source:
        order.channel === "meta"
          ? "facebook"
          : order.channel === "klaviyo"
            ? "klaviyo"
            : "direct",
      first_visit_source_type:
        order.channel === "meta"
          ? "paid"
          : order.channel === "klaviyo"
            ? "email"
            : "direct",
      first_visit_landing_page: landing,
      first_visit_referrer_url:
        order.channel === "meta"
          ? "https://facebook.com/"
          : order.channel === "klaviyo"
            ? "https://klaviyo.com/"
            : null,
      first_visit_utm_source: order.utmSource,
      first_visit_utm_medium: order.utmMedium,
      first_visit_utm_campaign: order.utmCampaign,
      first_visit_at: order.processedAt,
      last_visit_source:
        order.channel === "meta"
          ? "facebook"
          : order.channel === "klaviyo"
            ? "klaviyo"
            : "direct",
      last_visit_source_type:
        order.channel === "meta"
          ? "paid"
          : order.channel === "klaviyo"
            ? "email"
            : "direct",
      tags: [
        ENORA_SOURCE,
        `scenario:${ENORA_SCENARIO_ID}`,
        `channel:${order.channel}`,
      ],
      payment_gateway_names: ["synthetic_gateway"],
      shipping_country_code: "ES",
    });

    orderItemRows.push({
      id: md5Uuid(`${ENORA_SCENARIO_ID}:target:shopify:item:${externalLineItemId}`),
      organization_id: target.organization.id,
      order_id: orderId,
      product_id: productRow.id,
      variant_id: variantRow.id,
      external_line_item_id: externalLineItemId,
      title: order.product.title,
      sku_snapshot: order.product.sku,
      vendor_snapshot: "E-NORA Demo",
      quantity_original: order.quantity,
      quantity_current: order.quantity,
      unit_price: order.product.price,
      original_line_total: order.grossSales,
      discount_total: order.discount,
      current_line_total: order.netSales,
      refunded_quantity: 0,
      refunded_amount: 0,
      bundle_group_coverage: "not_bundle",
      net_quantity: order.quantity,
      net_revenue: order.netSales,
      net_metrics_source: null,
    });
  }

  await upsertRows("shopify_order_facts", orderRows, "store_id,external_order_id");
  await upsertRows(
    "shopify_order_items",
    orderItemRows,
    "order_id,external_line_item_id",
  );

  const campaignDbIds = new Map<string, string>();
  const adSetDbIds = new Map<string, string>();
  const adDbIds = new Map<string, string>();

  const metaCampaignRows = META_CAMPAIGNS.map((campaign) => {
    const externalId = `synthetic:meta:${campaign.key}`;
    const id = md5Uuid(`${ENORA_SCENARIO_ID}:target:meta:campaign:${externalId}`);
    campaignDbIds.set(campaign.key, id);
    return {
      id,
      organization_id: target.organization.id,
      ad_account_id: target.metaAccount.id,
      external_campaign_id: externalId,
      name: campaign.name,
      objective: "OUTCOME_SALES",
      buying_type: "AUCTION",
      configured_status: "PAUSED",
      effective_status: "PAUSED",
      special_ad_categories: [],
      raw_data: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        seed_target: `${env.ENORA_SEED_ORG_SLUG}/${env.ENORA_SEED_SHOP_DOMAIN}`,
        provider_draft_id: null,
        provider_metrics_written: false,
      },
      last_synced_at: now,
    };
  });
  await upsertRows(
    "meta_campaigns",
    metaCampaignRows,
    "ad_account_id,external_campaign_id",
  );

  const metaAdSetRows = META_CAMPAIGNS.map((campaign) => {
    const externalId = `synthetic:meta:adset:${campaign.key}`;
    const id = md5Uuid(`${ENORA_SCENARIO_ID}:target:meta:adset:${externalId}`);
    adSetDbIds.set(campaign.key, id);
    return {
      id,
      organization_id: target.organization.id,
      campaign_id: campaignDbIds.get(campaign.key),
      external_ad_set_id: externalId,
      name: `${campaign.name} · Broad ES`,
      configured_status: "PAUSED",
      effective_status: "PAUSED",
      optimization_goal: "OFFSITE_CONVERSIONS",
      billing_event: "IMPRESSIONS",
      destination_type: "WEBSITE",
      targeting_data: { geo_locations: { countries: ["ES"] } },
      attribution_spec: [
        { event_type: "CLICK_THROUGH", window_days: 7 },
        { event_type: "VIEW_THROUGH", window_days: 1 },
      ],
      is_dynamic_creative: false,
      raw_data: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        provider_draft_id: null,
      },
      last_synced_at: now,
    };
  });
  await upsertRows(
    "meta_ad_sets",
    metaAdSetRows,
    "campaign_id,external_ad_set_id",
  );

  const metaAdRows = META_CAMPAIGNS.map((campaign) => {
    const externalId = `synthetic:meta:ad:${campaign.key}`;
    const id = md5Uuid(`${ENORA_SCENARIO_ID}:target:meta:ad:${externalId}`);
    adDbIds.set(campaign.key, id);
    return {
      id,
      organization_id: target.organization.id,
      ad_set_id: adSetDbIds.get(campaign.key),
      external_ad_id: externalId,
      name: `${campaign.name} · Creative A`,
      configured_status: "PAUSED",
      effective_status: "PAUSED",
      parsed_angle: campaign.key,
      parsed_format: "static",
      parsed_hook: "product-led",
      parsed_naming_data: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
      },
      raw_data: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        provider_draft_id: null,
      },
      last_synced_at: now,
    };
  });
  await upsertRows("meta_ads", metaAdRows, "ad_set_id,external_ad_id");

  const metaInsightRows: Row[] = [];
  for (const day of scenario) {
    for (const metric of day.meta) {
      metaInsightRows.push({
        organization_id: target.organization.id,
        ad_account_id: target.metaAccount.id,
        campaign_id: campaignDbIds.get(metric.campaignKey),
        ad_set_id: adSetDbIds.get(metric.campaignKey),
        ad_id: adDbIds.get(metric.campaignKey),
        level: "ad",
        external_entity_id: `synthetic:meta:ad:${metric.campaignKey}`,
        metric_date: day.date,
        breakdown_hash: "none",
        attribution_windows: ["7d_click", "1d_view"],
        attribution_hash: "synthetic_7d_click_1d_view",
        action_report_time: "conversion",
        spend: metric.spend,
        impressions: metric.impressions,
        reach: metric.reach,
        frequency: metric.frequency,
        clicks: metric.clicks,
        unique_clicks: Math.round(metric.clicks * 0.86),
        inline_link_clicks: metric.linkClicks,
        outbound_clicks: metric.outboundClicks,
        cpm: metric.cpm,
        cpc: metric.cpc,
        ctr: metric.ctr,
        outbound_clicks_ctr:
          metric.impressions > 0
            ? (metric.outboundClicks / metric.impressions) * 100
            : null,
        unique_inline_link_clicks: Math.round(metric.linkClicks * 0.88),
        inline_link_click_ctr:
          metric.impressions > 0
            ? (metric.linkClicks / metric.impressions) * 100
            : null,
        cost_per_inline_link_click:
          metric.linkClicks > 0 ? metric.spend / metric.linkClicks : null,
        attribution_setting: "7d_click_1d_view",
        raw_data: {
          source: ENORA_SOURCE,
          scenario_id: ENORA_SCENARIO_ID,
          scenario: day.scenario,
          seed_target: `${env.ENORA_SEED_ORG_SLUG}/${env.ENORA_SEED_SHOP_DOMAIN}`,
          landing_page_views: metric.landingPageViews,
          add_to_carts: metric.addToCarts,
          checkouts: metric.checkouts,
          purchases: metric.purchases,
          attributed_revenue: metric.attributedRevenue,
          original_currency: target.metaAccount.currency_code,
          original_timezone: target.metaAccount.timezone_name,
          normalized_currency: ENORA_NORMALIZED_CURRENCY,
          normalized_timezone: ENORA_NORMALIZED_TIMEZONE,
        },
        synced_at: now,
      });
    }
  }
  await upsertRows(
    "meta_insight_rows_daily",
    metaInsightRows,
    "ad_account_id,level,external_entity_id,metric_date,breakdown_hash,attribution_hash,action_report_time",
  );

  const { data: persistedInsights, error: persistedInsightsError } = await supabase
    .from("meta_insight_rows_daily")
    .select("id,external_entity_id,metric_date,raw_data")
    .eq("organization_id", target.organization.id)
    .eq("ad_account_id", target.metaAccount.id)
    .gte("metric_date", "2025-10-04")
    .lte("metric_date", "2026-10-03");
  if (persistedInsightsError) {
    throw new Error(`ENORA_SEED_META_INSIGHT_RELOAD_FAILED: ${persistedInsightsError.message}`);
  }

  const insightIdByKey = new Map<string, string>();
  for (const row of persistedInsights ?? []) {
    if ((row.raw_data as Row | null)?.scenario_id !== ENORA_SCENARIO_ID) continue;
    insightIdByKey.set(`${row.external_entity_id}:${row.metric_date}`, row.id);
  }
  if (insightIdByKey.size !== scenario.length * META_CAMPAIGNS.length) {
    throw new Error(
      `ENORA_SEED_META_INSIGHT_COUNT_MISMATCH: expected ${scenario.length * META_CAMPAIGNS.length}, found ${insightIdByKey.size}`,
    );
  }

  const actionRows: Row[] = [];
  const calculatedRows: Row[] = [];
  for (const day of scenario) {
    for (const metric of day.meta) {
      const insightId = insightIdByKey.get(
        `synthetic:meta:ad:${metric.campaignKey}:${day.date}`,
      )!;
      const actionSpecs = [
        ["actions", "landing_page_view", metric.landingPageViews],
        ["actions", "add_to_cart", metric.addToCarts],
        ["actions", "initiate_checkout", metric.checkouts],
        ["actions", "omni_purchase", metric.purchases],
        ["action_values", "omni_purchase", metric.attributedRevenue],
      ] as const;
      for (const [metricName, actionType, value] of actionSpecs) {
        actionRows.push({
          organization_id: target.organization.id,
          insight_row_id: insightId,
          metric_name: metricName,
          action_type: actionType,
          attribution_window: "7d_click_1d_view",
          value,
          raw_value: {
            source: ENORA_SOURCE,
            scenario_id: ENORA_SCENARIO_ID,
          },
        });
      }

      const derived: Record<string, number | null> = {
        frequency: metric.frequency,
        ctr: metric.ctr,
        cpc: metric.cpc,
        cpm: metric.cpm,
        cpa: metric.cpa,
        roas: metric.roas,
      };
      for (const [metricCode, value] of Object.entries(derived)) {
        calculatedRows.push({
          organization_id: target.organization.id,
          insight_row_id: insightId,
          metric_code: metricCode,
          value,
          formula_code:
            META_DERIVED_FORMULAS[
              metricCode as keyof typeof META_DERIVED_FORMULAS
            ],
          formula_version: "enora-synthetic-v1",
          input_data: {
            source: ENORA_SOURCE,
            scenario_id: ENORA_SCENARIO_ID,
            spend: metric.spend,
            impressions: metric.impressions,
            reach: metric.reach,
            clicks: metric.clicks,
            purchases: metric.purchases,
            attributed_revenue: metric.attributedRevenue,
          },
        });
      }
    }
  }
  await upsertRows(
    "meta_insight_action_metrics",
    actionRows,
    "insight_row_id,metric_name,action_type,attribution_window",
  );
  await upsertRows(
    "meta_calculated_metrics_daily",
    calculatedRows,
    "insight_row_id,metric_code,formula_version",
  );

  const campaignKeys = [...new Set(scenario.map((day) => day.klaviyo.campaignKey))];
  await upsertRows(
    "klaviyo_campaigns",
    campaignKeys.map((key) => ({
      id: md5Uuid(`${ENORA_SCENARIO_ID}:target:klaviyo:campaign:synthetic:${key}`),
      organization_id: target.organization.id,
      account_id: target.klaviyoAccount.id,
      external_campaign_id: `synthetic:${key}`,
      name: `E-NORA · ${key.replaceAll("_", " ")}`,
      status: "draft",
      send_time: null,
      raw_data: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        seed_target: `${env.ENORA_SEED_ORG_SLUG}/${env.ENORA_SEED_SHOP_DOMAIN}`,
        provider_status: "draft",
        provider_messages_sent: false,
        historical_performance_is_simulated: true,
        tracking_options: {
          is_tracking_opens: true,
          is_tracking_clicks: true,
          add_tracking_params: true,
          utm_source: "klaviyo",
          utm_medium: "email",
          utm_campaign: key,
        },
      },
      last_synced_at: now,
    })),
    "account_id,external_campaign_id",
  );

  const profileRows = [...customerStats.keys()].map((customerKey) => {
    const suffix = customerKey.slice(-4);
    const externalProfileId = `synthetic_profile_${suffix}`;
    return {
      id: md5Uuid(
        `${ENORA_SCENARIO_ID}:target:klaviyo:profile:${externalProfileId}`,
      ),
      organization_id: target.organization.id,
      account_id: target.klaviyoAccount.id,
      external_profile_id: externalProfileId,
      shopify_customer_id: customerKey,
      email: `enora.seed.${suffix}@example.com`,
      email_normalized: `enora.seed.${suffix}@example.com`,
      first_name: "Synthetic",
      last_name: `Customer ${suffix}`,
      raw_data: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        seed_target: `${env.ENORA_SEED_ORG_SLUG}/${env.ENORA_SEED_SHOP_DOMAIN}`,
      },
      first_seen_at: "2025-10-04T08:00:00+02:00",
      last_seen_at: now,
    };
  });
  await upsertRows("klaviyo_tracking_profiles", profileRows, "id");

  const { error: deleteDailyError } = await supabase
    .from("klaviyo_daily_account_metrics")
    .delete()
    .eq("organization_id", target.organization.id)
    .eq("account_id", target.klaviyoAccount.id)
    .contains("raw_data", { scenario_id: ENORA_SCENARIO_ID });
  if (deleteDailyError) {
    throw new Error(`ENORA_SEED_KLAVIYO_DAILY_RESET_FAILED: ${deleteDailyError.message}`);
  }

  const dailyKlaviyoRows: Row[] = [];
  const trackingRows: Row[] = [];
  const clickRows: Row[] = [];
  const klaviyoMetricSpecs = [
    ["recipients", "Recipients"],
    ["delivered", "Delivered Email"],
    ["opens", "Opened Email"],
    ["clicks", "Clicked Email"],
    ["unsubscribes", "Unsubscribed"],
    ["bounces", "Bounced Email"],
    ["purchases", "Placed Order"],
    ["attributedRevenue", "Attributed Revenue"],
  ] as const;

  for (const day of scenario) {
    for (const [key, metricName] of klaviyoMetricSpecs) {
      dailyKlaviyoRows.push({
        id: md5Uuid(
          `${ENORA_SCENARIO_ID}:target:klaviyo:daily:${day.date}:${key}`,
        ),
        organization_id: target.organization.id,
        account_id: target.klaviyoAccount.id,
        metric_date: day.date,
        metric_id: `synthetic:${key}`,
        metric_name: metricName,
        value: day.klaviyo[key],
        currency_code:
          key === "attributedRevenue" ? ENORA_NORMALIZED_CURRENCY : null,
        source: ENORA_SOURCE,
        raw_data: {
          source: ENORA_SOURCE,
          scenario_id: ENORA_SCENARIO_ID,
          scenario: day.scenario,
          campaign_key: day.klaviyo.campaignKey,
          full_aggregate: true,
          original_currency: target.klaviyoAccount.currency_code,
          original_timezone: target.klaviyoAccount.timezone,
          normalized_currency: ENORA_NORMALIZED_CURRENCY,
          normalized_timezone: ENORA_NORMALIZED_TIMEZONE,
        },
      });
    }

    for (const order of day.orders.filter((item) => item.channel === "klaviyo")) {
      const suffix = order.customerKey.slice(-4);
      const externalProfileId = `synthetic_profile_${suffix}`;
      const profileId = md5Uuid(
        `${ENORA_SCENARIO_ID}:target:klaviyo:profile:${externalProfileId}`,
      );
      const properties = {
        order_id: order.externalOrderId,
        product_id: order.product.externalProductId,
        variant_id: order.product.externalVariantId,
        sku: order.product.sku,
        utm_source: "klaviyo",
        utm_medium: "email",
        utm_campaign: order.utmCampaign,
        utm_content: order.utmContent,
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
      };

      trackingRows.push(
        {
          organization_id: target.organization.id,
          account_id: target.klaviyoAccount.id,
          profile_id: profileId,
          event_name: "Clicked Email",
          source: "manual",
          source_event_id: `synthetic:email-click:${order.externalOrderId}`,
          dedupe_key: sha256(
            `${ENORA_SCENARIO_ID}:email-click:${order.externalOrderId}`,
          ),
          occurred_at: order.processedAt,
          properties: { ...properties, sampled_event_trail: true },
          raw_data: {
            source: ENORA_SOURCE,
            scenario_id: ENORA_SCENARIO_ID,
            campaign_external_id: `synthetic:${order.klaviyoCampaignKey}`,
          },
        },
        {
          organization_id: target.organization.id,
          account_id: target.klaviyoAccount.id,
          profile_id: profileId,
          event_name: "Placed Order",
          source: "manual",
          source_event_id: order.externalOrderId,
          dedupe_key: sha256(
            `${ENORA_SCENARIO_ID}:placed-order:${order.externalOrderId}`,
          ),
          occurred_at: order.processedAt,
          value: order.netSales,
          currency_code: ENORA_NORMALIZED_CURRENCY,
          properties,
          raw_data: {
            source: ENORA_SOURCE,
            scenario_id: ENORA_SCENARIO_ID,
            campaign_external_id: `synthetic:${order.klaviyoCampaignKey}`,
          },
        },
      );

      clickRows.push({
        organization_id: target.organization.id,
        account_id: target.klaviyoAccount.id,
        external_event_id: `synthetic:click:${order.externalOrderId}`,
        occurred_at: order.processedAt,
        url: `https://synthetic.enora.invalid/products/${order.product.handle}?utm_source=klaviyo&utm_medium=email&utm_campaign=${order.utmCampaign}&utm_content=${order.utmContent}`,
        external_message_id: `synthetic:message:${order.klaviyoCampaignKey}`,
        external_profile_id: externalProfileId,
        raw_data: {
          source: ENORA_SOURCE,
          scenario_id: ENORA_SCENARIO_ID,
          order_id: order.externalOrderId,
        },
      });
    }
  }

  await insertRows("klaviyo_daily_account_metrics", dailyKlaviyoRows);
  await upsertRows(
    "klaviyo_tracking_events",
    trackingRows,
    "account_id,dedupe_key",
  );
  await upsertRows(
    "klaviyo_email_click_events",
    clickRows,
    "account_id,external_event_id",
  );

  const syntheticShopifyRevenue = enrichedOrders.reduce(
    (sum, order) => sum + order.netSales,
    0,
  );
  const syntheticMetaRevenue = scenario.reduce(
    (sum, day) =>
      sum + day.meta.reduce((inner, metric) => inner + metric.attributedRevenue, 0),
    0,
  );
  const syntheticKlaviyoRevenue = scenario.reduce(
    (sum, day) => sum + day.klaviyo.attributedRevenue,
    0,
  );

  console.log(
    JSON.stringify(
      {
        scenario_id: ENORA_SCENARIO_ID,
        source: ENORA_SOURCE,
        target: {
          project_ref: targetProjectRef,
          organization_slug: env.ENORA_SEED_ORG_SLUG,
          shop_domain: env.ENORA_SEED_SHOP_DOMAIN,
          meta_account_id: env.ENORA_SEED_META_ACCOUNT_ID,
          klaviyo_account_id: env.ENORA_SEED_KLAVIYO_ACCOUNT_ID,
        },
        provider_connections_created: 0,
        provider_api_writes: 0,
        provider_messages_sent: 0,
        days: scenario.length,
        products_reused_from_shopify: ENORA_PRODUCTS.length,
        synthetic_orders: enrichedOrders.length,
        synthetic_shopify_revenue: Math.round(syntheticShopifyRevenue * 100) / 100,
        synthetic_meta_revenue: Math.round(syntheticMetaRevenue * 100) / 100,
        synthetic_klaviyo_revenue: Math.round(syntheticKlaviyoRevenue * 100) / 100,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
