-- Remove mutable search_path warnings from invoker analytics and admin functions.
-- The explicit paths prevent object shadowing while preserving existing grants.

alter function public.shopify_sales_summary(uuid, timestamptz, timestamptz)
  set search_path = pg_catalog, public;
alter function public.shopify_sales_summary(uuid, timestamptz, timestamptz, uuid)
  set search_path = pg_catalog, public;
alter function public.shopify_top_products(uuid, timestamptz, timestamptz, integer)
  set search_path = pg_catalog, public;
alter function public.shopify_top_products(uuid, timestamptz, timestamptz, integer, uuid)
  set search_path = pg_catalog, public;
alter function public.shopify_stock_summary(uuid, integer)
  set search_path = pg_catalog, public;
alter function public.shopify_stock_summary(uuid, integer, uuid)
  set search_path = pg_catalog, public;
alter function public.shopify_margin_summary(uuid, timestamptz, timestamptz)
  set search_path = pg_catalog, public;
alter function public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid)
  set search_path = pg_catalog, public;
alter function public.shopify_financial_summary(uuid, timestamptz, timestamptz, uuid)
  set search_path = pg_catalog, public;
alter function public.shopify_stock_risk_products(uuid, timestamptz, timestamptz, uuid)
  set search_path = pg_catalog, public;
alter function public.shopify_sales_daily(uuid, timestamptz, timestamptz, uuid)
  set search_path = pg_catalog, public;
alter function public.meta_spend_summary(uuid, date, date)
  set search_path = pg_catalog, public;
alter function public.meta_spend_daily(uuid, date, date)
  set search_path = pg_catalog, public;
alter function public.klaviyo_email_report(uuid, date, date)
  set search_path = pg_catalog, public;
alter function public.admin_organization_ai_stats(timestamptz)
  set search_path = pg_catalog, public;
alter function public.admin_consultant_ai_stats(timestamptz)
  set search_path = pg_catalog, public;
alter function public.admin_agent_runtime_stats(timestamptz)
  set search_path = pg_catalog, public;
alter function public.consultant_business_rollup(uuid[], timestamptz, timestamptz)
  set search_path = pg_catalog, public;
alter function public.reorder_strategic_phases(uuid, uuid[])
  set search_path = pg_catalog, public;
alter function public.reorder_strategic_milestones(uuid, uuid[])
  set search_path = pg_catalog, public;

-- This private helper is only used to read a request-local setting.
alter function private.gateway_org_id()
  set search_path = pg_catalog;
