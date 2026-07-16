-- DB-05f: gross margin metric, using whatever product_costs rows exist for
-- the period. Costs are optional per SKU (valid_from/valid_until ranges), so
-- the function also reports how many line items had a matching cost, since
-- margin_pct is only meaningful once most items are priced.

create or replace function public.shopify_margin_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz
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

grant execute on function public.shopify_margin_summary(uuid, timestamptz, timestamptz) to authenticated;

comment on function public.shopify_margin_summary is 'Margen bruto calculado solo sobre lineas de pedido que tienen un product_costs vigente en la fecha del pedido; margin_pct ignora lineas sin coste cargado (ver items_without_cost).';
