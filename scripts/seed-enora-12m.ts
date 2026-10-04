/**
 * E-NORA coordinated 12-month synthetic seed.
 *
 * Writes ONLY to an isolated Supabase test/dev project. It never calls Shopify,
 * Klaviyo or Meta provider APIs. Provider snapshots/IDs are copied as metadata
 * so E-NORA can exercise the same ingestion/analytics surfaces without forging
 * data inside the providers.
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { z } from "zod";
import {
  ENORA_META_AD_ACCOUNT_ID,
  ENORA_NORMALIZED_CURRENCY,
  ENORA_NORMALIZED_TIMEZONE,
  ENORA_PRODUCTS,
  ENORA_PROVIDER_SHOP_DOMAIN,
  ENORA_PROVIDER_SHOP_TIMEZONE,
  ENORA_SCENARIO_ID,
  ENORA_SOURCE,
  META_CAMPAIGNS,
  META_DERIVED_FORMULAS,
  generateEnoraScenario,
} from "./enora-seed-model.js";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_PRODUCTION_PROJECT_REF: z.string().regex(/^[a-z0-9]{10,30}$/),
  ALLOW_ENORA_SYNTHETIC_SEED: z.literal("true"),
  ENORA_SEED_ORG_SLUG: z
    .string()
    .regex(/^enora-synthetic-[a-z0-9-]+$/)
    .default("enora-synthetic-12m"),
});

const env = envSchema.parse(process.env);
const targetProjectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0];
if (targetProjectRef === env.SUPABASE_PRODUCTION_PROJECT_REF) {
  throw new Error(
    "ENORA_SEED_PRODUCTION_PROJECT_REFUSED: use an isolated Supabase test/dev project",
  );
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket as any },
});

function deterministicUuid(key: string) {
  const bytes = crypto.createHash("sha256").update(`${ENORA_SCENARIO_ID}:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function upsertRows(
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict = "id",
) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from(table).upsert(chunk as never, { onConflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function refuseNonSyntheticTenant() {
  const { data: existingOrg, error } = await supabase
    .from("organizations")
    .select("id, slug, display_name")
    .eq("slug", env.ENORA_SEED_ORG_SLUG)
    .maybeSingle();
  if (error) throw new Error(`organization lookup failed: ${error.message}`);
  if (!existingOrg) return;

  const { data: connections, error: connectionsError } = await supabase
    .from("integration_connections")
    .select("provider, provider_account_id, metadata")
    .eq("organization_id", existingOrg.id);
  if (connectionsError) {
    throw new Error(`connection safety lookup failed: ${connectionsError.message}`);
  }
  const unsafe = (connections ?? []).filter((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return metadata?.source !== ENORA_SOURCE || metadata?.scenario_id !== ENORA_SCENARIO_ID;
  });
  if (unsafe.length) {
    throw new Error(
      `ENORA_SEED_REAL_CONNECTION_REFUSED: ${env.ENORA_SEED_ORG_SLUG} contains non-synthetic connections`,
    );
  }
}

async function main() {
  await refuseNonSyntheticTenant();

  const now = new Date().toISOString();
  const orgId = deterministicUuid("organization");
  const shopifyConnectionId = deterministicUuid("connection:shopify");
  const metaConnectionId = deterministicUuid("connection:meta");
  const klaviyoConnectionId = deterministicUuid("connection:klaviyo");
  const storeId = deterministicUuid("shopify:store");
  const metaAccountId = deterministicUuid("meta:account");
  const klaviyoAccountId = deterministicUuid("klaviyo:account");

  await upsertRows("organizations", [
    {
      id: orgId,
      slug: env.ENORA_SEED_ORG_SLUG,
      display_name: "E-NORA · Synthetic 12M",
      currency_code: ENORA_NORMALIZED_CURRENCY,
      timezone: ENORA_NORMALIZED_TIMEZONE,
      ecommerce_url: "https://synthetic.enora.invalid",
    },
  ]);

  await upsertRows("integration_connections", [
    {
      id: shopifyConnectionId,
      organization_id: orgId,
      provider: "shopify",
      provider_account_id: "synthetic:e-nora-demo",
      provider_account_name: "E-NORA Demo · synthetic mirror",
      status: "connected",
      connected_at: now,
      last_sync_at: now,
      metadata: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        provider_snapshot: true,
        original_domain: ENORA_PROVIDER_SHOP_DOMAIN,
        original_timezone: ENORA_PROVIDER_SHOP_TIMEZONE,
        original_currency: "EUR",
        normalized_timezone: ENORA_NORMALIZED_TIMEZONE,
        normalized_currency: ENORA_NORMALIZED_CURRENCY,
      },
    },
    {
      id: metaConnectionId,
      organization_id: orgId,
      provider: "meta_ads",
      provider_account_id: `synthetic:${ENORA_META_AD_ACCOUNT_ID}`,
      provider_account_name: "Meta test account · synthetic analytics",
      status: "connected",
      connected_at: now,
      last_sync_at: now,
      metadata: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        real_connection_account_id: ENORA_META_AD_ACCOUNT_ID,
        provider_metrics_written: false,
        normalized_timezone: ENORA_NORMALIZED_TIMEZONE,
        normalized_currency: ENORA_NORMALIZED_CURRENCY,
      },
    },
    {
      id: klaviyoConnectionId,
      organization_id: orgId,
      provider: "klaviyo",
      provider_account_id: "synthetic:enora-klaviyo",
      provider_account_name: "E-NORA Klaviyo · synthetic analytics",
      status: "connected",
      connected_at: now,
      last_sync_at: now,
      metadata: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        provider_messages_sent: false,
        normalized_timezone: ENORA_NORMALIZED_TIMEZONE,
        normalized_currency: ENORA_NORMALIZED_CURRENCY,
      },
    },
  ]);

  await upsertRows("shopify_stores", [
    {
      id: storeId,
      organization_id: orgId,
      connection_id: shopifyConnectionId,
      external_shop_id: "synthetic:e-nora-demo",
      myshopify_domain: "enora-synthetic-12m.invalid",
      primary_domain: null,
      shop_name: "E-NORA Demo",
      currency_code: "EUR",
      timezone: ENORA_PROVIDER_SHOP_TIMEZONE,
      plan_display_name: "Synthetic mirror",
      is_active: true,
    },
  ]);

  const productRows = ENORA_PRODUCTS.map((product) => ({
    id: deterministicUuid(`shopify:product:${product.sku}`),
    organization_id: orgId,
    store_id: storeId,
    external_product_id: product.externalProductId,
    title: product.title,
    handle: product.handle,
    vendor: "E-NORA Demo",
    product_type: product.productType,
    status: "ACTIVE",
    updated_at: now,
  }));
  await upsertRows("shopify_products", productRows);

  const variantRows = ENORA_PRODUCTS.map((product) => ({
    id: deterministicUuid(`shopify:variant:${product.sku}`),
    organization_id: orgId,
    store_id: storeId,
    product_id: deterministicUuid(`shopify:product:${product.sku}`),
    external_variant_id: product.externalVariantId,
    title: "Default Title",
    current_price: product.price,
    position: 1,
    is_active: true,
    selected_options: [],
    updated_at: now,
  }));
  await upsertRows("shopify_variants", variantRows);

  const customerAgg = new Map<
    string,
    { orders: number; spend: number; lastOrderAt: string | null }
  >();
  for (let n = 1; n <= 240; n += 1) {
    const key = `syn_customer_${String(n).padStart(4, "0")}`;
    customerAgg.set(key, { orders: 0, spend: 0, lastOrderAt: null });
  }

  const scenario = generateEnoraScenario();

  for (const day of scenario) {
    for (const order of day.orders) {
      const agg = customerAgg.get(order.customerKey)!;
      agg.orders += 1;
      agg.spend += order.netSales;
      agg.lastOrderAt = order.processedAt;
    }
  }

  await upsertRows(
    "shopify_customers",
    [...customerAgg.entries()].map(([customerKey, agg]) => ({
      id: deterministicUuid(`shopify:customer:${customerKey}`),
      organization_id: orgId,
      store_id: storeId,
      external_customer_id: customerKey,
      customer_reference_hash: sha256(customerKey),
      number_of_orders: agg.orders,
      amount_spent: Math.round(agg.spend * 100) / 100,
      currency_code: ENORA_NORMALIZED_CURRENCY,
      state: "enabled",
      tags: [ENORA_SOURCE, `scenario:${ENORA_SCENARIO_ID}`],
      is_active: true,
      last_order_at: agg.lastOrderAt,
      email_marketing_state: "subscribed",
      verified_email: true,
    })),
  );

  const shopifySessionRows: Array<Record<string, unknown>> = [];
  const shopifyOrderRows: Array<Record<string, unknown>> = [];
  const shopifyOrderItemRows: Array<Record<string, unknown>> = [];

  for (const day of scenario) {
    shopifySessionRows.push({
      id: deterministicUuid(`shopify:sessions:${day.date}`),
      organization_id: orgId,
      store_id: storeId,
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
        normalized_timezone: ENORA_NORMALIZED_TIMEZONE,
        provider_original_timezone: ENORA_PROVIDER_SHOP_TIMEZONE,
      },
    });

    for (const order of day.orders) {
      const orderId = deterministicUuid(`shopify:order:${order.externalOrderId}`);
      const utmContent = order.utmContent
        ? `&utm_content=${encodeURIComponent(order.utmContent)}`
        : "";
      const landing = order.utmCampaign
        ? `/products/${order.product.handle}?utm_source=${order.utmSource}&utm_medium=${order.utmMedium}&utm_campaign=${order.utmCampaign}${utmContent}`
        : `/products/${order.product.handle}`;
      shopifyOrderRows.push({
        id: orderId,
        organization_id: orgId,
        store_id: storeId,
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
        is_first_customer_order: false,
        is_test_order: false,
        external_created_at: order.processedAt,
        processed_at: order.processedAt,
        first_visit_at: order.processedAt,
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
      });
      shopifyOrderItemRows.push({
        id: deterministicUuid(`shopify:order-item:${order.externalOrderId}:1`),
        organization_id: orgId,
        order_id: orderId,
        product_id: deterministicUuid(`shopify:product:${order.product.sku}`),
        variant_id: deterministicUuid(`shopify:variant:${order.product.sku}`),
        external_line_item_id: `${order.externalOrderId}:line:1`,
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
        net_quantity: order.quantity,
        net_revenue: order.netSales,
        net_metrics_source: ENORA_SOURCE,
      });
    }
  }
  await upsertRows("shopify_sessions_daily", shopifySessionRows);
  await upsertRows("shopify_order_facts", shopifyOrderRows);
  await upsertRows("shopify_order_items", shopifyOrderItemRows);

  await upsertRows("meta_ad_accounts", [
    {
      id: metaAccountId,
      organization_id: orgId,
      connection_id: metaConnectionId,
      store_id: storeId,
      external_ad_account_id: `synthetic:${ENORA_META_AD_ACCOUNT_ID}`,
      account_name: "E-NORA Meta synthetic analytics",
      currency_code: ENORA_NORMALIZED_CURRENCY,
      timezone_name: ENORA_NORMALIZED_TIMEZONE,
      is_selected: true,
      is_active: true,
      account_status_code: 1,
      canonical_purchase_action_type: "omni_purchase",
      last_synced_at: now,
      raw_data: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        real_connection_account_id: ENORA_META_AD_ACCOUNT_ID,
        provider_metrics_written: false,
      },
    },
  ]);

  const metaCampaignRows = META_CAMPAIGNS.map((campaign) => ({
    id: deterministicUuid(`meta:campaign:${campaign.key}`),
    organization_id: orgId,
    ad_account_id: metaAccountId,
    external_campaign_id: `synthetic:meta:${campaign.key}`,
    name: campaign.name,
    objective: "OUTCOME_SALES",
    configured_status: "PAUSED",
    effective_status: "PAUSED",
    last_synced_at: now,
    raw_data: {
      source: ENORA_SOURCE,
      scenario_id: ENORA_SCENARIO_ID,
      provider_draft_id: null,
      provider_status: "not_created_by_seed",
    },
  }));
  await upsertRows("meta_campaigns", metaCampaignRows);

  const metaAdSetRows = META_CAMPAIGNS.map((campaign) => ({
    id: deterministicUuid(`meta:adset:${campaign.key}`),
    organization_id: orgId,
    campaign_id: deterministicUuid(`meta:campaign:${campaign.key}`),
    external_ad_set_id: `synthetic:meta:adset:${campaign.key}`,
    name: `${campaign.name} · Broad ES`,
    configured_status: "PAUSED",
    effective_status: "PAUSED",
    optimization_goal: "OFFSITE_CONVERSIONS",
    billing_event: "IMPRESSIONS",
    destination_type: "WEBSITE",
    targeting_data: { geo_locations: { countries: ["ES"] } },
    raw_data: {
      source: ENORA_SOURCE,
      scenario_id: ENORA_SCENARIO_ID,
      provider_draft_id: null,
    },
  }));
  await upsertRows("meta_ad_sets", metaAdSetRows);

  const metaAdRows = META_CAMPAIGNS.map((campaign) => ({
    id: deterministicUuid(`meta:ad:${campaign.key}`),
    organization_id: orgId,
    ad_set_id: deterministicUuid(`meta:adset:${campaign.key}`),
    external_ad_id: `synthetic:meta:ad:${campaign.key}`,
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
  }));
  await upsertRows("meta_ads", metaAdRows);

  const insightRows: Array<Record<string, unknown>> = [];
  const actionRows: Array<Record<string, unknown>> = [];
  const calculatedRows: Array<Record<string, unknown>> = [];

  for (const day of scenario) {
    for (const metric of day.meta) {
      const insightId = deterministicUuid(`meta:insight:${metric.campaignKey}:${day.date}`);
      const campaignId = deterministicUuid(`meta:campaign:${metric.campaignKey}`);
      const adSetId = deterministicUuid(`meta:adset:${metric.campaignKey}`);
      const adId = deterministicUuid(`meta:ad:${metric.campaignKey}`);
      insightRows.push({
        id: insightId,
        organization_id: orgId,
        ad_account_id: metaAccountId,
        campaign_id: campaignId,
        ad_set_id: adSetId,
        ad_id: adId,
        level: "ad",
        external_entity_id: `synthetic:meta:ad:${metric.campaignKey}`,
        metric_date: day.date,
        breakdown_hash: "none",
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
        inline_link_click_ctr:
          metric.impressions > 0 ? metric.linkClicks / metric.impressions : null,
        outbound_clicks_ctr:
          metric.impressions > 0 ? metric.outboundClicks / metric.impressions : null,
        raw_data: {
          source: ENORA_SOURCE,
          scenario_id: ENORA_SCENARIO_ID,
          scenario: day.scenario,
          metric_provenance: {
            base: [
              "spend",
              "impressions",
              "reach",
              "clicks",
              "inline_link_clicks",
              "outbound_clicks",
            ],
            derived: ["frequency", "ctr", "cpc", "cpm"],
          },
          original_currency: "EUR",
          normalized_currency: ENORA_NORMALIZED_CURRENCY,
          original_timezone: ENORA_NORMALIZED_TIMEZONE,
          normalized_timezone: ENORA_NORMALIZED_TIMEZONE,
        },
        synced_at: now,
      });

      const actionSpecs = [
        ["landing_page_view", "actions", metric.landingPageViews],
        ["add_to_cart", "actions", metric.addToCarts],
        ["initiate_checkout", "actions", metric.checkouts],
        ["omni_purchase", "actions", metric.purchases],
        ["omni_purchase", "action_values", metric.attributedRevenue],
      ] as const;
      for (const [actionType, metricName, value] of actionSpecs) {
        actionRows.push({
          id: deterministicUuid(
            `meta:action:${metric.campaignKey}:${day.date}:${actionType}:${metricName}`,
          ),
          organization_id: orgId,
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

      const derived = {
        frequency: metric.frequency,
        ctr: metric.ctr,
        cpc: metric.cpc,
        cpm: metric.cpm,
        cpa: metric.cpa,
        roas: metric.roas,
      };
      for (const [metricCode, value] of Object.entries(derived)) {
        calculatedRows.push({
          id: deterministicUuid(
            `meta:calculated:${metric.campaignKey}:${day.date}:${metricCode}`,
          ),
          organization_id: orgId,
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
  await upsertRows("meta_insight_rows_daily", insightRows);
  await upsertRows("meta_insight_action_metrics", actionRows);
  await upsertRows("meta_calculated_metrics_daily", calculatedRows);

  await upsertRows("klaviyo_accounts", [
    {
      id: klaviyoAccountId,
      organization_id: orgId,
      connection_id: klaviyoConnectionId,
      store_id: storeId,
      external_account_id: "synthetic:enora-klaviyo",
      name: "E-NORA Klaviyo synthetic analytics",
      timezone: ENORA_NORMALIZED_TIMEZONE,
      currency_code: ENORA_NORMALIZED_CURRENCY,
      conversion_metric_name: "Placed Order",
      conversion_metric_source: "shopify",
      raw_data: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        provider_messages_sent: false,
      },
      last_synced_at: now,
    },
  ]);

  const campaignKeys = [...new Set(scenario.map((day) => day.klaviyo.campaignKey))];
  await upsertRows(
    "klaviyo_campaigns",
    campaignKeys.map((key) => ({
      id: deterministicUuid(`klaviyo:campaign:${key}`),
      organization_id: orgId,
      account_id: klaviyoAccountId,
      external_campaign_id: `synthetic:${key}`,
      name: `E-NORA · ${key.replaceAll("_", " ")}`,
      status: "draft",
      send_time: null,
      raw_data: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
        provider_status: "draft",
        historical_performance_is_simulated: true,
        tracking_options: {
          is_tracking_opens: true,
          is_tracking_clicks: true,
          add_tracking_params: true,
          custom_tracking_params: [
            { name: "utm_source", value: "klaviyo" },
            { name: "utm_medium", value: "email" },
            { name: "utm_campaign", value: key },
          ],
        },
      },
      last_synced_at: now,
    })),
  );

  const profileRows = [...customerAgg.keys()].map((customerKey) => {
    const n = customerKey.slice(-4);
    return {
      id: deterministicUuid(`klaviyo:profile:${customerKey}`),
      organization_id: orgId,
      account_id: klaviyoAccountId,
      shopify_customer_id: customerKey,
      external_profile_id: `synthetic_profile_${n}`,
      email: `enora.seed.${n}@example.com`,
      email_normalized: `enora.seed.${n}@example.com`,
      first_name: "Synthetic",
      last_name: `Customer ${n}`,
      first_seen_at: "2025-10-04T08:00:00+02:00",
      last_seen_at: now,
      raw_data: {
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
      },
    };
  });
  await upsertRows("klaviyo_tracking_profiles", profileRows);

  const dailyKlaviyoRows: Array<Record<string, unknown>> = [];
  const trackingRows: Array<Record<string, unknown>> = [];
  const clickRows: Array<Record<string, unknown>> = [];
  const klaviyoMetrics = [
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
    for (const [key, name] of klaviyoMetrics) {
      const value = day.klaviyo[key];
      dailyKlaviyoRows.push({
        id: deterministicUuid(`klaviyo:daily:${day.date}:${key}`),
        organization_id: orgId,
        account_id: klaviyoAccountId,
        metric_date: day.date,
        metric_id: `synthetic:${key}`,
        metric_name: name,
        value,
        currency_code: key === "attributedRevenue" ? ENORA_NORMALIZED_CURRENCY : null,
        source: ENORA_SOURCE,
        raw_data: {
          source: ENORA_SOURCE,
          scenario_id: ENORA_SCENARIO_ID,
          scenario: day.scenario,
          campaign_key: day.klaviyo.campaignKey,
          full_aggregate: true,
        },
      });
    }

    const emailOrders = day.orders.filter((order) => order.channel === "klaviyo");
    for (const order of emailOrders) {
      const profileId = deterministicUuid(`klaviyo:profile:${order.customerKey}`);
      const profileNumber = order.customerKey.slice(-4);
      const campaignExternalId = `synthetic:${order.klaviyoCampaignKey}`;
      const properties = {
        order_id: order.externalOrderId,
        product_id: order.product.externalProductId,
        variant_id: order.product.externalVariantId,
        sku: order.product.sku,
        utm_source: order.utmSource,
        utm_medium: order.utmMedium,
        utm_campaign: order.utmCampaign,
        utm_content: order.utmContent,
        source: ENORA_SOURCE,
        scenario_id: ENORA_SCENARIO_ID,
      };
      trackingRows.push(
        {
          id: deterministicUuid(`klaviyo:event:click:${order.externalOrderId}`),
          organization_id: orgId,
          account_id: klaviyoAccountId,
          profile_id: profileId,
          event_name: "Clicked Email",
          source: ENORA_SOURCE,
          source_event_id: `synthetic:email-click:${order.externalOrderId}`,
          dedupe_key: sha256(`${ENORA_SCENARIO_ID}:email-click:${order.externalOrderId}`),
          occurred_at: order.processedAt,
          properties: { ...properties, sampled_event_trail: true },
          raw_data: {
            source: ENORA_SOURCE,
            scenario_id: ENORA_SCENARIO_ID,
            campaign_external_id: campaignExternalId,
          },
        },
        {
          id: deterministicUuid(`klaviyo:event:order:${order.externalOrderId}`),
          organization_id: orgId,
          account_id: klaviyoAccountId,
          profile_id: profileId,
          event_name: "Placed Order",
          source: ENORA_SOURCE,
          source_event_id: order.externalOrderId,
          dedupe_key: sha256(`${ENORA_SCENARIO_ID}:placed-order:${order.externalOrderId}`),
          occurred_at: order.processedAt,
          value: order.netSales,
          currency_code: ENORA_NORMALIZED_CURRENCY,
          properties,
          raw_data: {
            source: ENORA_SOURCE,
            scenario_id: ENORA_SCENARIO_ID,
            campaign_external_id: campaignExternalId,
          },
        },
      );
      clickRows.push({
        id: deterministicUuid(`klaviyo:email-click:${order.externalOrderId}`),
        organization_id: orgId,
        account_id: klaviyoAccountId,
        external_event_id: `synthetic:click:${order.externalOrderId}`,
        external_message_id: `synthetic:message:${order.klaviyoCampaignKey}`,
        external_profile_id: `synthetic_profile_${profileNumber}`,
        occurred_at: order.processedAt,
        url: `https://synthetic.enora.invalid/products/${order.product.handle}?utm_source=klaviyo&utm_medium=email&utm_campaign=${order.utmCampaign}&utm_content=${order.utmContent}`,
        raw_data: {
          source: ENORA_SOURCE,
          scenario_id: ENORA_SCENARIO_ID,
          order_id: order.externalOrderId,
        },
      });
    }
  }
  await upsertRows("klaviyo_daily_account_metrics", dailyKlaviyoRows);
  await upsertRows("klaviyo_tracking_events", trackingRows);
  await upsertRows("klaviyo_email_click_events", clickRows);

  const summary = {
    scenario_id: ENORA_SCENARIO_ID,
    source: ENORA_SOURCE,
    days: scenario.length,
    products_from_shopify_mcp: ENORA_PRODUCTS.length,
    shopify_orders: shopifyOrderRows.length,
    meta_daily_rows: insightRows.length,
    klaviyo_daily_metrics: dailyKlaviyoRows.length,
    klaviyo_event_trail_rows: trackingRows.length,
    normalized_currency: ENORA_NORMALIZED_CURRENCY,
    normalized_timezone: ENORA_NORMALIZED_TIMEZONE,
    provider_writes: {
      shopify: false,
      meta: false,
      klaviyo: false,
    },
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
