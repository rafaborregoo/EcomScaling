import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checks = [
  {
    provider: "Shopify",
    file: "apps/api/src/shopify-sync.ts",
    groups: {
      store_identity: ["myshopifyDomain", "currencyCode", "ianaTimezone", "plan"],
      catalog: ["external_product_id", "title", "handle", "vendor", "product_type", "status"],
      variants_and_inventory: ["external_variant_id", "current_price", "inventory_policy", "sku", "current_unit_cost"],
      orders: ["external_order_id", "processed_at", "current_total_price", "financial_status", "fulfillment_status"],
      customers_and_refunds: ["external_customer_id", "customer_reference_hash", "external_refund_id", "total_refunded"],
    },
  },
  {
    provider: "Meta Ads",
    file: "apps/api/src/meta-sync.ts",
    groups: {
      campaigns: ["objective", "configured_status", "effective_status", "daily_budget", "bid_strategy"],
      ad_sets: ["optimization_goal", "billing_event", "targeting_data", "attribution_spec", "is_dynamic_creative"],
      creatives: ["primary_text", "headline", "link_url", "thumbnail_url", "object_story_spec"],
      insights: ["metric_date", "breakdowns", "attribution_windows", "impressions", "reach", "clicks", "spend", "raw_data"],
    },
  },
  {
    provider: "Klaviyo",
    files: ["apps/api/src/klaviyo-sync.ts", "apps/api/src/klaviyo.ts"],
    groups: {
      account: ["external_account_id", "currency_code", "timezone", "conversion_metric_id", "raw_data"],
      resources: ["external_list_id", "external_segment_id", "external_flow_id", "external_campaign_id", "external_form_id", "external_metric_id"],
      resource_attributes: ["profile_count", "trigger_type", "send_time", "metric_type", "is_conversion_candidate"],
      reporting: ["report_run_id", "period_start", "period_end", "revenue", "conversions", "currency_code"],
    },
  },
];

const failures = [];
let groupCount = 0;
let fieldCount = 0;

for (const check of checks) {
  const files = check.files ?? [check.file];
  const source = files.map((file) => readFileSync(resolve(file), "utf8")).join("\n");
  for (const [group, fields] of Object.entries(check.groups)) {
    groupCount += 1;
    for (const field of fields) {
      fieldCount += 1;
      if (!source.includes(field)) {
        failures.push(`${check.provider}.${group}.${field}: mapping token missing from ${files.join(", ")}`);
      }
    }
  }
}

if (failures.length) {
  console.error("CONNECTOR_FIELD_MAPPINGS_FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`CONNECTOR_FIELD_MAPPINGS_OK: ${checks.length} adapters, ${groupCount} mapping groups and ${fieldCount} tokens verified`);
}
