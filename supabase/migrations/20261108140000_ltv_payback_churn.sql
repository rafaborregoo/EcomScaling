-- LTV, payback y churn (decision de producto del 2026-09-24).
--
-- Lo decidido:
--   * LTV sobre MARGEN DE CONTRIBUCION (ingreso sin impuestos - coste de
--     producto - envio - comision de pago), no sobre ingreso. Si alguna linea
--     de la cohorte no tiene coste, la contribucion es null: "sin coste", nunca
--     un margen inflado por las lineas que faltan. El ingreso va al lado.
--   * Horizonte principal 365 dias, con la curva a 30/60/90/180 para las
--     tiendas que aun no tienen un año de historia.
--   * Churn: cliente sin comprar en 180 dias.
--
-- Cohorte de cada hito: clientes cuya PRIMERA compra cae en los 180 dias
-- anteriores a (as_of - hito). Asi todos han tenido el hito entero para
-- volver a comprar: una cohorte que no ha madurado no se mezcla.
--
-- El CAC es el de esa misma cohorte: gasto publicitario de su ventana de
-- captacion entre los clientes nuevos de esa ventana. Payback = primer hito
-- en que la contribucion acumulada por cliente cubre ese CAC (se calcula en
-- packages/contracts/src/customer-lifetime.ts, no aqui).

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
  cohort_cac numeric
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
      o.customer_reference_hash as hash,
      coalesce(o.processed_at, o.external_created_at) as happened_at,
      o.current_total_price - o.refunds - o.current_total_tax as revenue,
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
  -- Coste por linea con la misma resolucion que shopify_margin_summary: coste
  -- fechado escrito por una persona y, si no hay, el que reporta Shopify.
  item_costs as (
    select
      oi.order_id,
      greatest(oi.quantity_current - oi.refunded_quantity, 0) as net_quantity,
      coalesce(pc.unit_cost, ii.current_unit_cost) as unit_cost
    from public.shopify_order_items oi
    join orders o on o.id = oi.order_id
    left join public.shopify_inventory_items ii on ii.variant_id = oi.variant_id
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
      sum(net_quantity * unit_cost) filter (where unit_cost is not null) as cogs,
      count(*) filter (where unit_cost is null) as items_without_cost
    from item_costs
    group by order_id
  ),
  order_contribution as (
    select
      o.id,
      o.hash,
      o.happened_at,
      o.revenue,
      coalesce(c.items_without_cost, 0) as items_without_cost,
      o.revenue
        - coalesce(c.cogs, 0)
        - coalesce(rule.cost_per_order, st.default_shipping_cost, 0)
        - (o.revenue * coalesce(st.payment_fee_pct, 0) / 100 + coalesce(st.payment_fee_fixed, 0))
        as contribution
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
      sum(oc.items_without_cost) as items_without_cost
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
      round(avg(revenue), 2) as avg_revenue,
      round(avg(contribution), 2) as avg_contribution,
      coalesce(sum(items_without_cost), 0)::bigint as items_without_cost
    from per_customer
    group by milestone_days
  )
  select
    m.milestone_days,
    m.cohort_start,
    m.cohort_end,
    coalesce(p.cohort_customers, 0) as cohort_customers,
    p.avg_revenue,
    case when coalesce(p.items_without_cost, 0) = 0 then p.avg_contribution end as avg_contribution,
    coalesce(p.items_without_cost, 0) as items_without_cost,
    case when a.days_with_data > 0 then a.spend end as cohort_ads_spend,
    case when a.days_with_data > 0 and p.cohort_customers > 0
      then round(a.spend / p.cohort_customers, 2) end as cohort_cac
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
  'Curva de valor por cliente a 30/60/90/180/365 dias sobre cohortes maduras '
  '(primera compra en los 180 dias previos a as_of - hito). avg_contribution es '
  'margen de contribucion y queda null si falta el coste de alguna linea. '
  'cohort_cac = gasto publicitario de la ventana de captacion / clientes de la '
  'cohorte, para el payback.';

drop function if exists public.shopify_customer_churn(uuid, uuid, timestamptz);
create function public.shopify_customer_churn(
  target_organization_id uuid,
  target_store_id uuid,
  as_of timestamptz
)
returns table (
  churn_days integer,
  base_customers bigint,
  churned_customers bigint,
  churn_rate numeric
)
language sql
stable
as $$
  -- Base: quien compro en el año anterior al umbral (tuvo ocasion de volver).
  -- Perdido: quien de esa base no ha vuelto a comprar en los ultimos 180 dias.
  with orders as (
    select o.customer_reference_hash as hash, coalesce(o.processed_at, o.external_created_at) as happened_at
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and o.customer_reference_hash is not null
      and coalesce(o.processed_at, o.external_created_at) <= as_of
  ),
  base as (
    select distinct hash
    from orders
    where happened_at >= as_of - interval '545 days'
      and happened_at < as_of - interval '180 days'
  ),
  active as (
    select distinct hash from orders where happened_at >= as_of - interval '180 days'
  )
  select
    180 as churn_days,
    (select count(*) from base) as base_customers,
    (select count(*) from base b where not exists (select 1 from active a where a.hash = b.hash)) as churned_customers,
    case when (select count(*) from base) > 0 then round(
      (select count(*) from base b where not exists (select 1 from active a where a.hash = b.hash))::numeric
      / (select count(*) from base), 4)
    end as churn_rate;
$$;

alter function public.shopify_customer_churn(uuid, uuid, timestamptz)
  set search_path = pg_catalog, public;

grant execute on function public.shopify_customer_churn(uuid, uuid, timestamptz) to authenticated;

comment on function public.shopify_customer_churn(uuid, uuid, timestamptz) is
  'Churn a 180 dias: de los clientes que compraron entre 545 y 180 dias antes de '
  'as_of, cuantos no han vuelto a comprar en los ultimos 180.';
