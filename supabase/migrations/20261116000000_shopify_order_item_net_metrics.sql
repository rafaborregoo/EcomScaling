-- Shopify per-line metrics with explicit provenance. Old rows remain NULL until
-- a Shopify bulk reconciliation can provide an authoritative current value.
alter table public.shopify_order_items
  add column if not exists net_quantity integer,
  add column if not exists net_revenue numeric(14, 2),
  add column if not exists net_metrics_source text;

alter table public.shopify_order_items
  drop constraint if exists shopify_order_items_net_metrics_source_check,
  add constraint shopify_order_items_net_metrics_source_check
  check (net_metrics_source is null or net_metrics_source in (
    'shopify_graphql_exact',
    'shopify_rest_estimate'
  ));

-- The cohort LTV must use the same per-line net sales and store-scoped cost
-- resolution as shopify_margin_summary. Do not publish a partial cohort total
-- as a complete average while older lines have not been reconciled.
drop function if exists public.shopify_customer_lifetime(uuid, uuid, timestamptz);
create function public.shopify_customer_lifetime(
  target_organization_id uuid,
  target_store_id uuid,
  as_of timestamptz
)
returns table (
  milestone_days integer,
  cohort_start timestamptz,
  cohort_end timestamptz,
  cohort_customers bigint,
  avg_revenue numeric,
  avg_contribution numeric,
  items_without_cost bigint,
  cohort_ads_spend numeric,
  cohort_cac numeric,
  lines_with_exact_metrics bigint,
  lines_with_estimated_metrics bigint,
  lines_without_metrics bigint
)
language sql
stable
as $$
  with milestones as (
    select m as milestone_days,
           as_of - make_interval(days => m + 180) as cohort_start,
           as_of - make_interval(days => m) as cohort_end
    from unnest(array[30, 60, 90, 180, 365]) as m
  ),
  settings as (
    select s.payment_fee_pct, s.payment_fee_fixed, s.default_shipping_cost
    from public.organization_financial_settings s
    where s.organization_id = target_organization_id
  ),
  orders as (
    select
      o.id,
      o.store_id,
      o.customer_reference_hash as hash,
      coalesce(o.processed_at, o.external_created_at) as happened_at,
      o.current_total_price
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and o.customer_reference_hash is not null
      and coalesce(o.processed_at, o.external_created_at) <= as_of
  ),
  first_orders as (
    select hash, min(happened_at) as first_order_at
    from orders
    group by hash
  ),
  item_costs as (
    select
      oi.order_id,
      oi.net_quantity,
      oi.net_revenue,
      oi.net_metrics_source,
      coalesce(pc.unit_cost, ii.current_unit_cost) as unit_cost
    from public.shopify_order_items oi
    join orders o on o.id = oi.order_id
    left join public.shopify_inventory_items ii
      on ii.variant_id = oi.variant_id
     and ii.store_id = o.store_id
    left join lateral (
      select p.unit_cost
      from public.product_costs p
      where p.inventory_item_id = ii.id
        and p.valid_from <= o.happened_at::date
        and (p.valid_until is null or p.valid_until >= o.happened_at::date)
      order by p.valid_from desc
      limit 1
    ) pc on true
  ),
  order_costs as (
    select
      order_id,
      count(*) as line_count,
      sum(net_revenue) filter (where net_metrics_source is not null) as net_revenue,
      sum(net_quantity * unit_cost) filter (
        where unit_cost is not null and net_quantity is not null and net_metrics_source is not null
      ) as cogs,
      count(*) filter (where unit_cost is null) as items_without_cost,
      count(*) filter (where net_metrics_source = 'shopify_graphql_exact') as lines_with_exact_metrics,
      count(*) filter (where net_metrics_source = 'shopify_rest_estimate') as lines_with_estimated_metrics,
      count(*) filter (where net_metrics_source is null) as lines_without_metrics
    from item_costs
    group by order_id
  ),
  order_contribution as (
    select
      o.id,
      o.hash,
      o.happened_at,
      case
        when coalesce(c.line_count, 0) > 0 and coalesce(c.lines_without_metrics, 0) = 0
        then c.net_revenue
      end as revenue,
      coalesce(c.items_without_cost, 0) as items_without_cost,
      coalesce(c.lines_with_exact_metrics, 0) as lines_with_exact_metrics,
      coalesce(c.lines_with_estimated_metrics, 0) as lines_with_estimated_metrics,
      coalesce(c.lines_without_metrics, 0) + case when coalesce(c.line_count, 0) = 0 then 1 else 0 end
        as lines_without_metrics,
      case
        when coalesce(c.line_count, 0) > 0
          and coalesce(c.lines_without_metrics, 0) = 0
          and coalesce(c.items_without_cost, 0) = 0
        then c.net_revenue
          - coalesce(c.cogs, 0)
          - coalesce(rule.cost_per_order, st.default_shipping_cost, 0)
          - (c.net_revenue * coalesce(st.payment_fee_pct, 0) / 100 + coalesce(st.payment_fee_fixed, 0))
      end as contribution
    from orders o
    left join order_costs c on c.order_id = o.id
    left join settings st on true
    left join lateral (
      select r.cost_per_order
      from public.shipping_cost_rules r
      where r.organization_id = target_organization_id
        and r.is_active
        and r.country_code is null
        and r.valid_from <= o.happened_at::date
        and (r.valid_until is null or r.valid_until >= o.happened_at::date)
        and o.current_total_price >= r.min_order_total
        and (r.max_order_total is null or o.current_total_price < r.max_order_total)
      order by r.min_order_total desc
      limit 1
    ) rule on true
  ),
  per_customer as (
    select
      m.milestone_days,
      f.hash,
      sum(oc.revenue) as revenue,
      sum(oc.contribution) as contribution,
      sum(oc.items_without_cost) as items_without_cost,
      sum(oc.lines_with_exact_metrics) as lines_with_exact_metrics,
      sum(oc.lines_with_estimated_metrics) as lines_with_estimated_metrics,
      sum(oc.lines_without_metrics) as lines_without_metrics
    from milestones m
    join first_orders f
      on f.first_order_at >= m.cohort_start
     and f.first_order_at < m.cohort_end
    join order_contribution oc
      on oc.hash = f.hash
     and oc.happened_at < f.first_order_at + make_interval(days => m.milestone_days)
    group by m.milestone_days, f.hash
  ),
  per_milestone as (
    select
      milestone_days,
      count(*) as cohort_customers,
      round(avg(revenue), 2) as avg_revenue_partial,
      round(avg(contribution), 2) as avg_contribution_partial,
      coalesce(sum(items_without_cost), 0)::bigint as items_without_cost,
      coalesce(sum(lines_with_exact_metrics), 0)::bigint as lines_with_exact_metrics,
      coalesce(sum(lines_with_estimated_metrics), 0)::bigint as lines_with_estimated_metrics,
      coalesce(sum(lines_without_metrics), 0)::bigint as lines_without_metrics
    from per_customer
    group by milestone_days
  )
  select
    m.milestone_days,
    m.cohort_start,
    m.cohort_end,
    coalesce(p.cohort_customers, 0) as cohort_customers,
    case when coalesce(p.lines_without_metrics, 0) = 0 then p.avg_revenue_partial end as avg_revenue,
    case
      when coalesce(p.lines_without_metrics, 0) = 0 and coalesce(p.items_without_cost, 0) = 0
      then p.avg_contribution_partial
    end as avg_contribution,
    coalesce(p.items_without_cost, 0) as items_without_cost,
    case when a.days_with_data > 0 then a.spend end as cohort_ads_spend,
    case when a.days_with_data > 0 and p.cohort_customers > 0
      then round(a.spend / p.cohort_customers, 2) end as cohort_cac,
    coalesce(p.lines_with_exact_metrics, 0) as lines_with_exact_metrics,
    coalesce(p.lines_with_estimated_metrics, 0) as lines_with_estimated_metrics,
    coalesce(p.lines_without_metrics, 0) as lines_without_metrics
  from milestones m
  left join per_milestone p on p.milestone_days = m.milestone_days
  left join lateral public.ads_spend_summary(
    target_organization_id, m.cohort_start, m.cohort_end, target_store_id
  ) a on true
  order by m.milestone_days;
$$;

alter function public.shopify_customer_lifetime(uuid, uuid, timestamptz)
  set search_path = pg_catalog, public;

grant execute on function public.shopify_customer_lifetime(uuid, uuid, timestamptz) to authenticated;

comment on function public.shopify_customer_lifetime(uuid, uuid, timestamptz) is
  'LTV a 30/60/90/180/365 dias sobre cohortes maduras. revenue y contribution '
  'usan net_revenue/net_quantity por linea; se devuelven null si falta cobertura '
  'net-line o coste. Los conteos exactos, estimados y sin cobertura describen '
  'la evidencia incluida. Costes de inventario se enlazan por tienda.';

comment on column public.shopify_order_items.net_quantity is
  'Current quantity net of refunded and removed units. NULL means not yet reconciled.';
comment on column public.shopify_order_items.net_revenue is
  'Line amount after discounts, refunds, and removals, before tax; REST values are explicitly estimated.';
comment on column public.shopify_order_items.net_metrics_source is
  'shopify_graphql_exact from priceAfterAllDiscountsBeforeTaxesSet/currentQuantity, shopify_rest_estimate from REST webhooks, NULL for historical rows awaiting reconciliation.';

drop function if exists public.shopify_top_products(uuid, timestamptz, timestamptz, integer, uuid);
create function public.shopify_top_products(
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
  revenue numeric,
  lines_with_exact_metrics bigint,
  lines_with_estimated_metrics bigint,
  lines_without_metrics bigint
)
language sql
stable
as $$
  select
    p.id as product_id,
    p.title,
    coalesce(sum(oi.net_quantity), 0)::bigint as quantity_sold,
    coalesce(sum(oi.net_revenue), 0) as revenue,
    count(*) filter (where oi.net_metrics_source = 'shopify_graphql_exact') as lines_with_exact_metrics,
    count(*) filter (where oi.net_metrics_source = 'shopify_rest_estimate') as lines_with_estimated_metrics,
    count(*) filter (where oi.net_metrics_source is null) as lines_without_metrics
  from public.shopify_order_items oi
  join public.shopify_order_facts o on o.id = oi.order_id
  join public.shopify_products p on p.id = oi.product_id and p.store_id = o.store_id
  where o.organization_id = target_organization_id
    and (target_store_id is null or o.store_id = target_store_id)
    and o.is_test_order = false
    and o.cancelled_at is null
    and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
    and coalesce(o.processed_at, o.external_created_at) <= period_end
  group by p.id, p.title
  order by revenue desc
  limit result_limit;
$$;

grant execute on function public.shopify_top_products(uuid, timestamptz, timestamptz, integer, uuid) to authenticated;

drop function if exists public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid);
create function public.shopify_margin_summary(
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
  items_without_cost bigint,
  items_with_estimated_cost bigint,
  lines_with_exact_metrics bigint,
  lines_with_estimated_metrics bigint,
  lines_without_metrics bigint
)
language sql
stable
as $$
  with priced_items as (
    select
      oi.id as order_item_id,
      oi.net_quantity,
      oi.net_revenue,
      oi.net_metrics_source,
      (
        select pc.unit_cost
        from public.product_costs pc
        where pc.inventory_item_id = ii.id
          and pc.valid_from <= coalesce(o.processed_at, o.external_created_at)::date
          and (pc.valid_until is null or pc.valid_until >= coalesce(o.processed_at, o.external_created_at)::date)
        order by pc.valid_from desc
        limit 1
      ) as dated_cost,
      ii.current_unit_cost as shopify_cost
    from public.shopify_order_items oi
    join public.shopify_order_facts o on o.id = oi.order_id
    left join public.shopify_inventory_items ii
      on ii.variant_id = oi.variant_id
     and ii.store_id = o.store_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  resolved as (
    select
      order_item_id,
      net_quantity,
      net_revenue,
      net_metrics_source,
      coalesce(dated_cost, shopify_cost) as unit_cost,
      dated_cost is null and shopify_cost is not null as is_estimated_cost
    from priced_items
  ),
  totals as (
    select
      coalesce(sum(net_revenue), 0) as revenue,
      coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null and net_quantity is not null), 0) as cogs,
      coalesce(sum(net_revenue) filter (where unit_cost is not null and net_quantity is not null), 0) as margin_revenue,
      coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null and net_quantity is not null), 0) as margin_cogs,
      count(*) filter (where unit_cost is not null) as items_with_cost,
      count(*) filter (where unit_cost is null) as items_without_cost,
      count(*) filter (where is_estimated_cost) as items_with_estimated_cost,
      count(*) filter (where net_metrics_source = 'shopify_graphql_exact') as lines_with_exact_metrics,
      count(*) filter (where net_metrics_source = 'shopify_rest_estimate') as lines_with_estimated_metrics,
      count(*) filter (where net_metrics_source is null) as lines_without_metrics
    from resolved
  )
  select
    revenue,
    cogs,
    margin_revenue - margin_cogs as gross_margin,
    case when margin_revenue > 0 then round((margin_revenue - margin_cogs) / margin_revenue * 100, 2) else 0 end as margin_pct,
    items_with_cost,
    items_without_cost,
    items_with_estimated_cost,
    lines_with_exact_metrics,
    lines_with_estimated_metrics,
    lines_without_metrics
  from totals;
$$;

grant execute on function public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

drop function if exists public.shopify_return_rate_by_product(uuid, timestamptz, timestamptz, uuid, integer);
create function public.shopify_return_rate_by_product(
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
  top_return_reason text,
  lines_with_exact_metrics bigint,
  lines_with_estimated_metrics bigint,
  lines_without_metrics bigint
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
      i.net_revenue,
      i.net_metrics_source,
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
    round(coalesce(sum(returned.units), 0)::numeric / nullif(sum(sold.quantity_original), 0), 4) as return_rate,
    coalesce(sum(sold.net_revenue), 0) as revenue,
    coalesce(sum(sold.refunded_amount), 0) as refunded_amount,
    mode() within group (order by returned.reason) as top_return_reason,
    count(*) filter (where sold.net_metrics_source = 'shopify_graphql_exact') as lines_with_exact_metrics,
    count(*) filter (where sold.net_metrics_source = 'shopify_rest_estimate') as lines_with_estimated_metrics,
    count(*) filter (where sold.net_metrics_source is null) as lines_without_metrics
  from sold
  left join returned on returned.order_item_id = sold.item_id
  where sold.product_id is not null
  group by sold.product_id
  order by units_returned desc, revenue desc
  limit result_limit;
$$;

grant execute on function public.shopify_return_rate_by_product(uuid, timestamptz, timestamptz, uuid, integer) to authenticated;
