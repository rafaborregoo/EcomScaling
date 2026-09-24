import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
const source = (
  await Promise.all(files.map((file) => readFile(path.join(migrationsDir, file), "utf8")))
).join("\n");

const functions = [
  ["public.shopify_sales_summary", "uuid, timestamptz, timestamptz", "pg_catalog, public"],
  ["public.shopify_sales_summary", "uuid, timestamptz, timestamptz, uuid", "pg_catalog, public"],
  ["public.shopify_top_products", "uuid, timestamptz, timestamptz, integer", "pg_catalog, public"],
  ["public.shopify_top_products", "uuid, timestamptz, timestamptz, integer, uuid", "pg_catalog, public"],
  ["public.shopify_stock_summary", "uuid, integer", "pg_catalog, public"],
  ["public.shopify_stock_summary", "uuid, integer, uuid", "pg_catalog, public"],
  ["public.shopify_margin_summary", "uuid, timestamptz, timestamptz", "pg_catalog, public"],
  ["public.shopify_margin_summary", "uuid, timestamptz, timestamptz, uuid", "pg_catalog, public"],
  ["public.shopify_financial_summary", "uuid, timestamptz, timestamptz, uuid", "pg_catalog, public"],
  ["public.shopify_stock_risk_products", "uuid, timestamptz, timestamptz, uuid", "pg_catalog, public"],
  ["public.shopify_sales_daily", "uuid, timestamptz, timestamptz, uuid", "pg_catalog, public"],
  ["public.meta_spend_summary", "uuid, date, date", "pg_catalog, public"],
  ["public.meta_spend_daily", "uuid, date, date", "pg_catalog, public"],
  ["public.klaviyo_email_report", "uuid, date, date", "pg_catalog, public"],
  ["public.admin_organization_ai_stats", "timestamptz", "pg_catalog, public"],
  ["public.admin_consultant_ai_stats", "timestamptz", "pg_catalog, public"],
  ["public.admin_agent_runtime_stats", "timestamptz", "pg_catalog, public"],
  ["public.consultant_business_rollup", "uuid[], timestamptz, timestamptz", "pg_catalog, public"],
  ["public.reorder_strategic_phases", "uuid, uuid[]", "pg_catalog, public"],
  ["public.reorder_strategic_milestones", "uuid, uuid[]", "pg_catalog, public"],
  ["private.gateway_org_id", "", "pg_catalog"],
  ["public.organization_activity_digest", "uuid", "pg_catalog, public"],
  ["public.consultant_referrals", "uuid", "pg_catalog, public"],
  ["public.consultant_referral_summary", "uuid", "pg_catalog, public"],
  ["public.admin_referral_program", "", "pg_catalog, public"],
  ["public.agent_runs_snapshot_prompt", "", "pg_catalog, public"],
  ["public.admin_agent_quality_stats", "timestamptz", "pg_catalog, public"],
  ["public.admin_ai_failure_clusters", "timestamptz", "pg_catalog, public"],
  ["public.admin_data_quality_portfolio", "", "pg_catalog, public"],
  ["private.capture_inventory_snapshot", "", "pg_catalog, public"],
];

const normalize = (value) => value.replace(/\s+/g, " ").trim().toLowerCase();
const normalized = normalize(source);
const missing = functions.filter(([name, args, searchPath]) =>
  !normalized.includes(normalize(`alter function ${name}(${args}) set search_path = ${searchPath};`)),
);

if (missing.length > 0) {
  throw new Error(`Missing explicit function search_path hardening: ${missing.map(([name, args]) => `${name}(${args})`).join(", ")}`);
}

console.log(`Function search_path hardening verified: ${functions.length} functions`);
