-- Las seis metricas del modulo que comparan contra `period_start` no
-- contemplaban que llegue null, que es exactamente como el selector de periodo
-- pide "Todo". `x >= null` no da falso: da NULL, y la fila se descarta. El
-- resultado era una tienda entera con datos vista como vacia, sin error en
-- ningun sitio.
--
-- Mismo predicado que ya usaban shopify_sales_summary y compañia desde db_05g.
-- Solo cambia esa condicion; el resto del cuerpo es identico y los permisos
-- sobreviven a `create or replace`.

create or replace function public.shopify_customer_recurrence(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  new_orders bigint,
  returning_orders bigint,
  unknown_orders bigint,
  new_revenue numeric,
  returning_revenue numeric,
  repeat_order_rate numeric
)
language sql
stable
as $$
  with scoped as (
    select o.customer_order_index, o.net_sales
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  )
  select
    count(*) filter (where customer_order_index = 1) as new_orders,
    count(*) filter (where customer_order_index > 1) as returning_orders,
    count(*) filter (where customer_order_index is null) as unknown_orders,
    coalesce(sum(net_sales) filter (where customer_order_index = 1), 0) as new_revenue,
    coalesce(sum(net_sales) filter (where customer_order_index > 1), 0) as returning_revenue,
    round(
      count(*) filter (where customer_order_index > 1)::numeric
      / nullif(count(*) filter (where customer_order_index is not null), 0),
      4
    ) as repeat_order_rate
  from scoped;
$$;

create or replace function public.shopify_attribution_by_channel(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  source_type text,
  source text,
  utm_campaign text,
  orders bigint,
  revenue numeric,
  new_customers bigint,
  avg_days_to_conversion numeric
)
language sql
stable
as $$
  select
    o.first_visit_source_type::text as source_type,
    o.first_visit_source::text as source,
    o.first_visit_utm_campaign::text as utm_campaign,
    count(*) as orders,
    coalesce(sum(o.net_sales), 0) as revenue,
    count(*) filter (where o.customer_order_index = 1) as new_customers,
    round(avg(o.days_to_conversion), 1) as avg_days_to_conversion
  from public.shopify_order_facts o
  where o.organization_id = target_organization_id
    and (target_store_id is null or o.store_id = target_store_id)
    and o.is_test_order = false
    and o.cancelled_at is null
    and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
    and coalesce(o.processed_at, o.external_created_at) <= period_end
  group by 1, 2, 3
  order by revenue desc;
$$;

create or replace function public.shopify_return_rate_by_product(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid,
  result_limit integer default 20
)
returns table (
  product_id uuid,
  title text,
  units_sold bigint,
  units_returned bigint,
  return_rate numeric,
  revenue numeric,
  refunded_amount numeric,
  top_return_reason text
)
language sql
stable
as $$
  with sold as (
    select
      i.id as item_id,
      i.product_id,
      i.title,
      i.quantity_original,
      i.current_line_total,
      i.refunded_amount
    from public.shopify_order_items i
    join public.shopify_order_facts o on o.id = i.order_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  returned as (
    select
      r.order_item_id,
      sum(r.quantity) as units,
      mode() within group (order by r.return_reason) as reason
    from public.shopify_return_line_items r
    join sold on sold.item_id = r.order_item_id
    where r.organization_id = target_organization_id
    group by r.order_item_id
  )
  select
    sold.product_id,
    min(sold.title)::text as title,
    coalesce(sum(sold.quantity_original), 0) as units_sold,
    coalesce(sum(returned.units), 0) as units_returned,
    round(
      coalesce(sum(returned.units), 0)::numeric
      / nullif(sum(sold.quantity_original), 0),
      4
    ) as return_rate,
    coalesce(sum(sold.current_line_total), 0) as revenue,
    coalesce(sum(sold.refunded_amount), 0) as refunded_amount,
    mode() within group (order by returned.reason) as top_return_reason
  from sold
  left join returned on returned.order_item_id = sold.item_id
  where sold.product_id is not null
  group by sold.product_id
  order by units_returned desc, revenue desc
  limit result_limit;
$$;

create or replace function public.shopify_delivery_times(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  fulfillments bigint,
  delivered bigint,
  in_transit bigint,
  avg_hours_to_ship numeric,
  avg_days_to_deliver numeric,
  with_estimate bigint,
  late_deliveries bigint,
  avg_delay_days numeric
)
language sql
stable
as $$
  with scoped as (
    select
      f.external_created_at as shipped_at,
      f.delivered_at,
      f.in_transit_at,
      f.estimated_delivery_at,
      coalesce(o.processed_at, o.external_created_at) as ordered_at
    from public.shopify_fulfillments f
    join public.shopify_order_facts o on o.id = f.order_id
    where f.organization_id = target_organization_id
      and (target_store_id is null or f.store_id = target_store_id)
      and (period_start is null or f.external_created_at >= period_start)
      and f.external_created_at <= period_end
  )
  select
    count(*) as fulfillments,
    count(*) filter (where delivered_at is not null) as delivered,
    count(*) filter (where delivered_at is null and in_transit_at is not null) as in_transit,
    round(
      (avg(extract(epoch from (shipped_at - ordered_at)) / 3600)
        filter (where shipped_at is not null and ordered_at is not null))::numeric,
      1
    ) as avg_hours_to_ship,
    round(
      (avg(extract(epoch from (delivered_at - shipped_at)) / 86400)
        filter (where delivered_at is not null and shipped_at is not null))::numeric,
      1
    ) as avg_days_to_deliver,
    count(*) filter (where estimated_delivery_at is not null) as with_estimate,
    count(*) filter (
      where delivered_at is not null
        and estimated_delivery_at is not null
        and delivered_at > estimated_delivery_at
    ) as late_deliveries,
    round(
      (avg(extract(epoch from (delivered_at - estimated_delivery_at)) / 86400)
        filter (
          where delivered_at is not null
            and estimated_delivery_at is not null
            and delivered_at > estimated_delivery_at
        ))::numeric,
      1
    ) as avg_delay_days
  from scoped;
$$;

create or replace function public.shopify_checkout_recovery(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  checkouts bigint,
  recovered bigint,
  recovery_rate numeric,
  lost_value numeric,
  recovered_value numeric,
  avg_checkout_value numeric,
  avg_hours_to_recover numeric
)
language sql
stable
as $$
  with scoped as (
    select c.total_price, c.completed_at, c.external_created_at
    from public.shopify_abandoned_checkouts c
    where c.organization_id = target_organization_id
      and (target_store_id is null or c.store_id = target_store_id)
      and (period_start is null or c.external_created_at >= period_start)
      and c.external_created_at <= period_end
  )
  select
    count(*) as checkouts,
    count(*) filter (where completed_at is not null) as recovered,
    round(
      count(*) filter (where completed_at is not null)::numeric / nullif(count(*), 0),
      4
    ) as recovery_rate,
    coalesce(sum(total_price) filter (where completed_at is null), 0) as lost_value,
    coalesce(sum(total_price) filter (where completed_at is not null), 0) as recovered_value,
    round(avg(total_price), 2) as avg_checkout_value,
    round(
      (avg(extract(epoch from (completed_at - external_created_at)) / 3600)
        filter (where completed_at is not null))::numeric,
      1
    ) as avg_hours_to_recover
  from scoped;
$$;

create or replace function public.shopify_discount_cost_by_code(
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
  new_customers bigint,
  orders_with_multiple_codes bigint,
  discount_share numeric
)
language sql
stable
as $$
  with scoped_orders as (
    select o.id, o.net_sales, o.discounts, o.customer_order_index
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  codes_per_order as (
    select a.order_id, count(*) as code_count
    from public.shopify_order_discount_applications a
    join scoped_orders on scoped_orders.id = a.order_id
    where a.organization_id = target_organization_id
      and a.code is not null
    group by a.order_id
  )
  select
    a.code::text,
    count(*) as orders,
    coalesce(sum(o.net_sales), 0) as order_revenue,
    coalesce(sum(o.discounts), 0) as order_discount_total,
    count(*) filter (where o.customer_order_index = 1) as new_customers,
    count(*) filter (where c.code_count > 1) as orders_with_multiple_codes,
    round(
      coalesce(sum(o.discounts), 0) / nullif(sum(o.net_sales + o.discounts), 0),
      4
    ) as discount_share
  from public.shopify_order_discount_applications a
  join scoped_orders o on o.id = a.order_id
  join codes_per_order c on c.order_id = a.order_id
  where a.organization_id = target_organization_id
    and a.code is not null
  group by a.code
  order by order_discount_total desc
  limit result_limit;
$$;
