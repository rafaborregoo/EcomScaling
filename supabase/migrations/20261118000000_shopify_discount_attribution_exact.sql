-- El descuento de un pedido puede incluir varias aplicaciones. No presentar
-- el total del pedido como si cada código hubiese causado todo ese importe.
drop function if exists public.shopify_discount_cost_by_code(
  uuid, timestamptz, timestamptz, uuid, integer
);

create function public.shopify_discount_cost_by_code(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid,
  result_limit integer default 20
)
returns table (
  code text,
  orders bigint,
  order_revenue numeric,
  order_discount_total numeric,
  attributed_discount_total numeric,
  attribution_coverage text,
  new_customers bigint,
  orders_with_multiple_codes bigint,
  discount_share numeric
)
language sql
stable
as $$
  with scoped_orders as (
    select o.id, o.store_id, o.net_sales, o.discounts, o.customer_order_index
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and coalesce(o.processed_at, o.external_created_at) >= period_start
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  codes_per_order as (
    select a.order_id, count(distinct a.code) as code_count
    from public.shopify_order_discount_applications a
    join scoped_orders o on o.id = a.order_id and o.store_id = a.store_id
    where a.organization_id = target_organization_id
      and (target_store_id is null or a.store_id = target_store_id)
      and a.code is not null
    group by a.order_id
  ),
  code_order as (
    select
      a.order_id,
      a.code::text as code,
      sum(a.amount) filter (where a.amount_coverage = 'complete') as exact_amount,
      bool_and(a.amount_coverage = 'complete') as amount_complete
    from public.shopify_order_discount_applications a
    join scoped_orders o on o.id = a.order_id and o.store_id = a.store_id
    where a.organization_id = target_organization_id
      and (target_store_id is null or a.store_id = target_store_id)
      and a.code is not null
    group by a.order_id, a.code
  ),
  code_totals as (
    select
      c.code,
      count(*) as orders,
      coalesce(sum(o.net_sales), 0) as order_revenue,
      coalesce(sum(o.discounts), 0) as order_discount_total,
      case when bool_and(c.amount_complete)
        then sum(c.exact_amount)
        else null
      end as attributed_discount_total,
      case
        when bool_and(c.amount_complete) then 'complete'
        when bool_or(c.exact_amount is not null) then 'partial'
        else 'unavailable'
      end as attribution_coverage,
      count(*) filter (where o.customer_order_index = 1) as new_customers,
      count(*) filter (where coalesce(cp.code_count, 0) > 1) as orders_with_multiple_codes,
      case when bool_and(c.amount_complete)
        then round(
          sum(c.exact_amount) / nullif(sum(o.net_sales + o.discounts), 0),
          4
        )
        else null
      end as discount_share
    from code_order c
    join scoped_orders o on o.id = c.order_id
    left join codes_per_order cp on cp.order_id = c.order_id
    group by c.code
  )
  select
    code,
    orders,
    order_revenue,
    order_discount_total,
    attributed_discount_total,
    attribution_coverage,
    new_customers,
    orders_with_multiple_codes,
    discount_share
  from code_totals
  order by attributed_discount_total desc nulls last, order_discount_total desc
  limit greatest(1, least(coalesce(result_limit, 20), 100));
$$;

grant execute on function public.shopify_discount_cost_by_code(
  uuid, timestamptz, timestamptz, uuid, integer
) to authenticated;
