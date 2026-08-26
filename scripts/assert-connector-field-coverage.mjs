import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const typesPath = resolve("packages/db/src/database.types.ts");
const source = readFileSync(typesPath, "utf8");

const required = {
  shopify: {
    shopify_stores: [
      "connection_id",
      "external_shop_id",
      "myshopify_domain",
      "currency_code",
      "timezone",
    ],
    shopify_products: [
      "external_product_id",
      "title",
      "handle",
      "status",
      "vendor",
    ],
    shopify_variants: [
      "external_variant_id",
      "product_id",
      "current_price",
      "inventory_policy",
    ],
    shopify_inventory_items: [
      "external_inventory_item_id",
      "sku",
      "tracked",
      "current_unit_cost",
    ],
    shopify_order_facts: [
      "external_order_id",
      "order_name",
      "processed_at",
      "currency_code",
      "current_total_price",
      "financial_status",
      "fulfillment_status",
      "customer_reference_hash",
    ],
    shopify_order_items: [
      "external_line_item_id",
      "order_id",
      "product_id",
      "variant_id",
      "quantity_current",
      "current_line_total",
    ],
    shopify_refunds: [
      "external_refund_id",
      "order_id",
      "total_refunded",
      "currency_code",
    ],
    shopify_customers: [
      "external_customer_id",
      "customer_reference_hash",
      "number_of_orders",
      "amount_spent",
    ],
  },
  meta: {
    meta_business_accounts: ["connection_id", "external_business_id", "name"],
    meta_ad_accounts: [
      "external_ad_account_id",
      "account_name",
      "currency_code",
      "timezone_name",
      "is_selected",
    ],
    meta_campaigns: [
      "external_campaign_id",
      "ad_account_id",
      "objective",
      "configured_status",
      "effective_status",
      "daily_budget",
    ],
    meta_ad_sets: [
      "external_ad_set_id",
      "campaign_id",
      "optimization_goal",
      "billing_event",
      "targeting_data",
      "attribution_spec",
    ],
    meta_ads: [
      "external_ad_id",
      "ad_set_id",
      "name",
      "configured_status",
      "effective_status",
      "current_creative_id",
    ],
    meta_creatives: [
      "external_creative_id",
      "object_type",
      "primary_text",
      "headline",
      "link_url",
      "thumbnail_url",
    ],
    meta_insight_rows_daily: [
      "external_entity_id",
      "level",
      "metric_date",
      "breakdowns",
      "attribution_windows",
      "impressions",
      "reach",
      "clicks",
      "spend",
      "raw_data",
    ],
    meta_insight_action_metrics: [
      "insight_row_id",
      "action_type",
      "metric_name",
      "value",
      "raw_value",
    ],
  },
  klaviyo: {
    klaviyo_accounts: [
      "connection_id",
      "external_account_id",
      "currency_code",
      "timezone",
      "conversion_metric_id",
    ],
    klaviyo_lists: ["external_list_id", "name", "profile_count", "is_active"],
    klaviyo_segments: [
      "external_segment_id",
      "name",
      "profile_count",
      "is_active",
    ],
    klaviyo_flows: [
      "external_flow_id",
      "name",
      "status",
      "trigger_type",
    ],
    klaviyo_flow_messages: [
      "flow_id",
      "external_message_id",
      "channel",
      "status",
    ],
    klaviyo_campaigns: [
      "external_campaign_id",
      "name",
      "status",
      "send_time",
    ],
    klaviyo_campaign_messages: [
      "campaign_id",
      "external_message_id",
      "channel",
      "status",
    ],
    klaviyo_forms: ["external_form_id", "name", "status"],
    klaviyo_metrics: [
      "external_metric_id",
      "name",
      "metric_type",
      "is_conversion_candidate",
    ],
    klaviyo_report_runs: [
      "idempotency_key",
      "report_type",
      "period_start",
      "period_end",
      "status",
    ],
    klaviyo_report_values: [
      "report_run_id",
      "entity_type",
      "external_entity_id",
      "period_start",
      "period_end",
      "revenue",
      "conversions",
    ],
  },
};

function getRowFields(tableName) {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tableMatch = source.match(
    new RegExp(
      `\n\\s{6}${escaped}: \\{\\s+Row: \\{([\\s\\S]*?)\\s+\\}\\s+Insert:`,
    ),
  );
  if (!tableMatch) return null;
  return new Set(
    [...tableMatch[1].matchAll(/\n\s+([A-Za-z0-9_]+):/g)].map(
      (match) => match[1],
    ),
  );
}

const failures = [];
let tableCount = 0;
let fieldCount = 0;

for (const [provider, tables] of Object.entries(required)) {
  for (const [table, fields] of Object.entries(tables)) {
    tableCount += 1;
    const actual = getRowFields(table);
    if (!actual) {
      failures.push(`${provider}.${table}: table missing from generated types`);
      continue;
    }
    for (const field of fields) {
      fieldCount += 1;
      if (!actual.has(field)) {
        failures.push(`${provider}.${table}.${field}: field missing`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("CONNECTOR_FIELD_COVERAGE_FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `CONNECTOR_FIELD_COVERAGE_OK: ${tableCount} tables and ${fieldCount} MVP fields verified`,
  );
}
