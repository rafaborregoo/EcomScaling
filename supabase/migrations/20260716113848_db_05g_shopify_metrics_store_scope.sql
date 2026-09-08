-- DB-05g: allow Shopify metrics to be scoped to one connected store.
-- Existing org-level function signatures remain available for backwards
-- compatibility. The API calls these overloads when a connection/store is
-- selected from the UI.

drop function if exists public.shopify_sales_summary(uuid, timestamptz, timestamptz, uuid);
create or replace function public.shopify_sales_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
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
    and (target_store_id is null or store_id = target_store_id)
    and is_test_order = false
    and cancelled_at is null
    and (period_start is null or coalesce(processed_at, external_created_at) >= period_start)
    and coalesce(processed_at, external_created_at) <= period_end;
$$;

grant execute on function public.shopify_sales_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

drop function if exists public.shopify_top_products(uuid, timestamptz, timestamptz, integer, uuid);
create or replace function public.shopify_top_products(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  result_limit integer,
  target_store_id uuid
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
    and (target_store_id is null or o.store_id = target_store_id)
    and (target_store_id is null or p.store_id = target_store_id)
    and o.is_test_order = false
    and o.cancelled_at is null
    and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
    and coalesce(o.processed_at, o.external_created_at) <= period_end
  group by p.id, p.title
  order by revenue desc
  limit result_limit;
$$;

grant execute on function public.shopify_top_products(uuid, timestamptz, timestamptz, integer, uuid) to authenticated;

drop function if exists public.shopify_stock_summary(uuid, integer, uuid);
create or replace function public.shopify_stock_summary(
  target_organization_id uuid,
  low_stock_threshold integer,
  target_store_id uuid
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
    coalesce(sum(s.available_quantity), 0) as total_available,
    count(*) filter (
      where s.available_quantity is not null
        and s.available_quantity > 0
        and s.available_quantity <= low_stock_threshold
    ) as low_stock_items,
    count(*) filter (where coalesce(s.available_quantity, 0) <= 0) as out_of_stock_items
  from public.shopify_inventory_current_state s
  join public.shopify_inventory_items ii on ii.id = s.inventory_item_id
  join public.shopify_variants v on v.id = ii.variant_id
  join public.shopify_products p on p.id = v.product_id
  where s.organization_id = target_organization_id
    and (target_store_id is null or p.store_id = target_store_id)
    and s.is_active = true;
$$;

grant execute on function public.shopify_stock_summary(uuid, integer, uuid) to authenticated;

drop function if exists public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid);
create or replace function public.shopify_margin_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  revenue numeric,
  cogs numeric,
  gross_margin numeric,
  margin_pct numeric,
  items_with_cost bigint,
  items_without_cost bigint
)
language sql
stable
as $$
  with priced_items as (
    select
      oi.id as order_item_id,
      greatest(oi.quantity_current - oi.refunded_quantity, 0) as net_quantity,
      oi.current_line_total - oi.discount_total as item_revenue,
      (
        select pc.unit_cost
        from public.product_costs pc
        where pc.inventory_item_id = ii.id
          and pc.valid_from <= coalesce(o.processed_at, o.external_created_at)::date
          and (pc.valid_until is null or pc.valid_until >= coalesce(o.processed_at, o.external_created_at)::date)
        order by pc.valid_from desc
        limit 1
      ) as unit_cost
    from public.shopify_order_items oi
    join public.shopify_order_facts o on o.id = oi.order_id
    left join public.shopify_inventory_items ii on ii.variant_id = oi.variant_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  )
  select
    coalesce(sum(item_revenue), 0) as revenue,
    coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0) as cogs,
    coalesce(sum(item_revenue) filter (where unit_cost is not null), 0)
      - coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0) as gross_margin,
    case
      when coalesce(sum(item_revenue) filter (where unit_cost is not null), 0) > 0 then round(
        (
          coalesce(sum(item_revenue) filter (where unit_cost is not null), 0)
          - coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0)
        ) / sum(item_revenue) filter (where unit_cost is not null) * 100,
        2
      )
      else 0
    end as margin_pct,
    count(*) filter (where unit_cost is not null) as items_with_cost,
    count(*) filter (where unit_cost is null) as items_without_cost
  from priced_items;
$$;

grant execute on function public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_sales_summary(uuid, timestamptz, timestamptz, uuid) is 'Resumen de ventas Shopify filtrable por store_id; null mantiene lectura a nivel organizacion.';
comment on function public.shopify_top_products(uuid, timestamptz, timestamptz, integer, uuid) is 'Top productos Shopify filtrable por store_id; null mantiene lectura a nivel organizacion.';
comment on function public.shopify_stock_summary(uuid, integer, uuid) is 'Resumen de stock Shopify filtrable por store_id; null mantiene lectura a nivel organizacion.';
comment on function public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid) is 'Resumen de margen Shopify filtrable por store_id; null mantiene lectura a nivel organizacion.';
