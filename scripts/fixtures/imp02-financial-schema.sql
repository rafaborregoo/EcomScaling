-- Minimal synthetic schema for executing the real financial SQL in a new local database.
create schema if not exists private;
create table public.shopify_stores(id uuid primary key,organization_id uuid,connection_id uuid,currency_code text,is_active boolean default true);
create table public.integration_connections(id uuid primary key,organization_id uuid,provider text,status text,last_sync_at timestamptz,last_error_at timestamptz);
create table public.shopify_order_facts(
 id uuid primary key,organization_id uuid,store_id uuid,customer_reference_hash text,currency_code text,
 is_test_order boolean default false,cancelled_at timestamptz,processed_at timestamptz,external_created_at timestamptz,external_updated_at timestamptz,
 net_sales numeric default 0,current_total_price numeric default 0,current_total_tax numeric default 0,current_shipping_price numeric default 0,refunds numeric default 0
);
create table public.shopify_order_items(id uuid primary key,organization_id uuid,order_id uuid,variant_id uuid,net_quantity integer,net_revenue numeric,net_metrics_source text);
create table public.shopify_inventory_items(id uuid primary key,organization_id uuid,store_id uuid,variant_id uuid,current_unit_cost numeric);
create table public.product_costs(id uuid primary key,organization_id uuid,inventory_item_id uuid,unit_cost numeric,currency_code text,valid_from date,valid_until date);
create table public.organization_financial_settings(organization_id uuid primary key,payment_fee_pct numeric,payment_fee_fixed numeric,default_shipping_cost numeric,currency_code text);
create table public.shipping_cost_rules(id uuid primary key,organization_id uuid,is_active boolean,country_code text,cost_per_order numeric,min_order_total numeric,max_order_total numeric,valid_from date,valid_until date,currency_code text);
create table public.fixed_expenses(id uuid primary key,organization_id uuid,is_active boolean,amount numeric,billing_period text,valid_from date,valid_until date,currency_code text);
create table public.meta_ad_accounts(id uuid primary key,organization_id uuid,store_id uuid,connection_id uuid,currency_code text,is_active boolean,is_selected boolean);
create table public.meta_insight_rows_daily(id uuid primary key,organization_id uuid,ad_account_id uuid,metric_date date,level text,breakdown_hash text,spend numeric);
create table public.shopify_refunds(id uuid primary key,organization_id uuid,store_id uuid,order_id uuid,external_created_at timestamptz,total_refunded numeric);
