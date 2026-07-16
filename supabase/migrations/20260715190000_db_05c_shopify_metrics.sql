-- DB-05c: Shopify dashboard metrics - current stock view plus org-scoped
-- aggregation functions (sales summary, top products, stock summary).
-- Functions run as SECURITY INVOKER (the default) so RLS on the underlying
-- tables still restricts rows to organizations the caller can access, even
-- if target_organization_id is spoofed.

create or replace view public.shopify_inventory_current_levels as
select distinct on (inventory_item_id, location_id)
  id,
  organization_id,
  inventory_item_id,
  location_id,
  external_inventory_level_id,
  available_quantity,
  on_hand_quantity,
  committed_quantity,
  incoming_quantity,
  quantities_data,
  is_active,
  captured_at
from public.shopify_inventory_level_snapshots
order by inventory_item_id, location_id, captured_at desc;

grant select on public.shopify_inventory_current_levels to authenticated;

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
    and coalesce(processed_at, external_created_at) between period_start and period_end;
$$;

grant execute on function public.shopify_sales_summary(uuid, timestamptz, timestamptz) to authenticated;

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
    and coalesce(o.processed_at, o.external_created_at) between period_start and period_end
  group by p.id, p.title
  order by revenue desc
  limit result_limit;
$$;

grant execute on function public.shopify_top_products(uuid, timestamptz, timestamptz, integer) to authenticated;

create or replace function public.shopify_stock_summary(
  target_organization_id uuid,
  low_stock_threshold integer default 5
)
returns table (
  tracked_items bigint,
  total_available bigint,
  low_stock_items bigint,
  out_of_stock_items bigint
)
language sql
stable
as $$
  select
    count(*) as tracked_items,
    coalesce(sum(available_quantity), 0) as total_available,
    count(*) filter (where available_quantity is not null and available_quantity > 0 and available_quantity <= low_stock_threshold) as low_stock_items,
    count(*) filter (where coalesce(available_quantity, 0) <= 0) as out_of_stock_items
  from public.shopify_inventory_current_levels
  where organization_id = target_organization_id
    and is_active = true;
$$;

grant execute on function public.shopify_stock_summary(uuid, integer) to authenticated;
