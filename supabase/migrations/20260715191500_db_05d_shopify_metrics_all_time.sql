-- DB-05d: allow Shopify sales metrics to cover "all time" by treating a
-- null period_start as no lower bound, instead of capping the UI at 365 days.

drop function if exists public.shopify_sales_summary(uuid, timestamptz, timestamptz);
create or replace function public.shopify_sales_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  orders_count bigint,
  gross_sales numeric,
  net_sales numeric,
  discounts numeric,
  refunds numeric,
  units_sold bigint,
  aov numeric
)
language sql
stable
as $$
  select
    count(*) as orders_count,
    coalesce(sum(gross_sales), 0) as gross_sales,
    coalesce(sum(net_sales), 0) as net_sales,
    coalesce(sum(discounts), 0) as discounts,
    coalesce(sum(refunds), 0) as refunds,
    coalesce(sum(total_items), 0) as units_sold,
    case when count(*) > 0 then round(coalesce(sum(net_sales), 0) / count(*), 2) else 0 end as aov
  from public.shopify_order_facts
  where organization_id = target_organization_id
    and is_test_order = false
    and cancelled_at is null
    and (period_start is null or coalesce(processed_at, external_created_at) >= period_start)
    and coalesce(processed_at, external_created_at) <= period_end;
$$;

drop function if exists public.shopify_top_products(uuid, timestamptz, timestamptz, integer);
create or replace function public.shopify_top_products(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  result_limit integer default 10
)
returns table (
  product_id uuid,
  title varchar,
  quantity_sold bigint,
  revenue numeric
)
language sql
stable
as $$
  select
    p.id as product_id,
    p.title,
    coalesce(sum(oi.quantity_current), 0) as quantity_sold,
    coalesce(sum(oi.current_line_total), 0) as revenue
  from public.shopify_order_items oi
  join public.shopify_order_facts o on o.id = oi.order_id
  join public.shopify_products p on p.id = oi.product_id
  where o.organization_id = target_organization_id
    and o.is_test_order = false
    and o.cancelled_at is null
    and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
    and coalesce(o.processed_at, o.external_created_at) <= period_end
  group by p.id, p.title
  order by revenue desc
  limit result_limit;
$$;
