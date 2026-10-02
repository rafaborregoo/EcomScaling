-- Metricas por promocion de Shopify: descuento concedido, ventas, ticket medio,
-- clientes nuevos, serie semanal, productos mas vendidos y usos por codigo.
--
-- Funciones SQL `stable` y `security invoker` (ADR-0006): corren con los permisos
-- del usuario y RLS decide que ve cada cual. Se calculan sobre los pedidos
-- sincronizados (shopify_order_discount_applications enlazadas por discount_id),
-- no sobre el contador de usos de Shopify, que cubre otro periodo.
--
-- Idempotente: cada funcion se elimina por firma antes de crearse.

create index if not exists shopify_order_discount_applications_discount_idx
  on public.shopify_order_discount_applications (discount_id)
  where discount_id is not null;

-- ---------------------------------------------------------------------------
-- 1. Metricas por promocion
-- ---------------------------------------------------------------------------
drop function if exists public.shopify_discount_metrics(uuid, uuid[], uuid[], timestamptz, timestamptz);

create function public.shopify_discount_metrics(
  target_organization_id uuid,
  target_store_ids uuid[],
  target_discount_ids uuid[],
  target_period_start timestamptz,
  target_period_end timestamptz
)
returns table (
  discount_id uuid,
  orders_count bigint,
  discount_amount numeric,
  amount_coverage text,
  net_revenue numeric,
  new_customer_orders bigint,
  known_customer_orders bigint,
  last_order_at timestamptz,
  baseline_orders bigint,
  baseline_net_revenue numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped_orders as (
    select o.id, o.net_sales, o.customer_order_index,
           coalesce(o.processed_at, o.external_created_at) as at
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and o.store_id = any(target_store_ids)
      and o.is_test_order = false
      and o.cancelled_at is null
      and coalesce(o.processed_at, o.external_created_at) >= target_period_start
      and coalesce(o.processed_at, o.external_created_at) < target_period_end
  ),
  per_discount_order as (
    select
      a.discount_id,
      a.order_id,
      sum(a.amount) filter (where a.amount_coverage = 'complete') as exact_amount,
      bool_and(a.amount_coverage = 'complete') as amount_complete
    from public.shopify_order_discount_applications a
    join scoped_orders o on o.id = a.order_id
    where a.organization_id = target_organization_id
      and a.store_id = any(target_store_ids)
      and a.discount_id is not null
      and (target_discount_ids is null or a.discount_id = any(target_discount_ids))
    group by a.discount_id, a.order_id
  ),
  baseline as (
    select count(*) as orders, coalesce(sum(o.net_sales), 0) as revenue
    from scoped_orders o
    where not exists (
      select 1 from public.shopify_order_discount_applications a
      where a.order_id = o.id and a.organization_id = target_organization_id
    )
  )
  select
    p.discount_id,
    count(*),
    case when bool_and(p.amount_complete) then sum(p.exact_amount) else null end,
    case
      when bool_and(p.amount_complete) then 'complete'
      when bool_or(p.exact_amount is not null) then 'partial'
      else 'unavailable'
    end,
    coalesce(sum(o.net_sales), 0),
    count(*) filter (where o.customer_order_index = 1),
    count(*) filter (where o.customer_order_index is not null),
    max(o.at),
    (select orders from baseline),
    (select revenue from baseline)
  from per_discount_order p
  join scoped_orders o on o.id = p.order_id
  group by p.discount_id;
$$;

revoke all on function public.shopify_discount_metrics(uuid, uuid[], uuid[], timestamptz, timestamptz) from public, anon;
grant execute on function public.shopify_discount_metrics(uuid, uuid[], uuid[], timestamptz, timestamptz) to authenticated, service_role;
comment on function public.shopify_discount_metrics(uuid, uuid[], uuid[], timestamptz, timestamptz) is
  'Por promocion: pedidos sincronizados con ella, descuento concedido (null si algun importe es parcial), ventas netas, pedidos de cliente nuevo y base sin promocion para comparar el ticket medio.';

-- ---------------------------------------------------------------------------
-- 2. Serie semanal de usos
-- ---------------------------------------------------------------------------
drop function if exists public.shopify_discount_weekly(uuid, uuid[], uuid[], timestamptz, integer);

create function public.shopify_discount_weekly(
  target_organization_id uuid,
  target_store_ids uuid[],
  target_discount_ids uuid[],
  target_period_end timestamptz,
  weeks integer
)
returns table (
  discount_id uuid,
  week_start date,
  orders_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.discount_id,
    date_trunc('week', coalesce(o.processed_at, o.external_created_at) at time zone 'UTC')::date,
    count(distinct a.order_id)
  from public.shopify_order_discount_applications a
  join public.shopify_order_facts o
    on o.id = a.order_id
   and o.organization_id = a.organization_id
  where a.organization_id = target_organization_id
    and a.store_id = any(target_store_ids)
    and a.discount_id = any(target_discount_ids)
    and o.is_test_order = false
    and o.cancelled_at is null
    and coalesce(o.processed_at, o.external_created_at) >= target_period_end - make_interval(weeks => least(greatest(weeks, 1), 52))
    and coalesce(o.processed_at, o.external_created_at) < target_period_end
  group by 1, 2;
$$;

revoke all on function public.shopify_discount_weekly(uuid, uuid[], uuid[], timestamptz, integer) from public, anon;
grant execute on function public.shopify_discount_weekly(uuid, uuid[], uuid[], timestamptz, integer) to authenticated, service_role;
comment on function public.shopify_discount_weekly(uuid, uuid[], uuid[], timestamptz, integer) is
  'Pedidos con la promocion aplicada por semana (lunes UTC) en las ultimas N semanas. Las semanas sin usos no devuelven fila.';

-- ---------------------------------------------------------------------------
-- 3. Productos mas vendidos en pedidos con la promocion
-- ---------------------------------------------------------------------------
drop function if exists public.shopify_discount_top_products(uuid, uuid, uuid, timestamptz, timestamptz, integer);

create function public.shopify_discount_top_products(
  target_organization_id uuid,
  target_store_id uuid,
  target_discount_id uuid,
  target_period_start timestamptz,
  target_period_end timestamptz,
  result_limit integer default 8
)
returns table (
  product_id uuid,
  title text,
  units bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    item.product_id,
    coalesce(max(p.title), max(item.title))::text,
    coalesce(sum(item.quantity_original), 0)::bigint as units
  from public.shopify_order_items item
  join public.shopify_order_facts o
    on o.id = item.order_id
   and o.organization_id = item.organization_id
  left join public.shopify_products p on p.id = item.product_id
  where o.organization_id = target_organization_id
    and o.store_id = target_store_id
    and o.is_test_order = false
    and o.cancelled_at is null
    and coalesce(o.processed_at, o.external_created_at) >= target_period_start
    and coalesce(o.processed_at, o.external_created_at) < target_period_end
    and exists (
      select 1 from public.shopify_order_discount_applications a
      where a.order_id = o.id
        and a.organization_id = target_organization_id
        and a.discount_id = target_discount_id
    )
  group by item.product_id, case when item.product_id is null then item.title end
  order by units desc
  limit greatest(1, least(coalesce(result_limit, 8), 25));
$$;

revoke all on function public.shopify_discount_top_products(uuid, uuid, uuid, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.shopify_discount_top_products(uuid, uuid, uuid, timestamptz, timestamptz, integer) to authenticated, service_role;
comment on function public.shopify_discount_top_products(uuid, uuid, uuid, timestamptz, timestamptz, integer) is
  'Unidades por producto en los pedidos sincronizados donde se aplico la promocion (todas las lineas del pedido, no solo las que recibieron el descuento).';

-- ---------------------------------------------------------------------------
-- 4. Pedidos y descuento por codigo
-- ---------------------------------------------------------------------------
drop function if exists public.shopify_discount_codes_usage(uuid, uuid, uuid, timestamptz, timestamptz);

create function public.shopify_discount_codes_usage(
  target_organization_id uuid,
  target_store_id uuid,
  target_discount_id uuid,
  target_period_start timestamptz,
  target_period_end timestamptz
)
returns table (
  code text,
  orders_count bigint,
  discount_amount numeric,
  amount_coverage text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.code::text,
    count(distinct a.order_id),
    case when bool_and(a.amount_coverage = 'complete') then sum(a.amount) else null end,
    case
      when bool_and(a.amount_coverage = 'complete') then 'complete'
      when bool_or(a.amount_coverage = 'complete') then 'partial'
      else 'unavailable'
    end
  from public.shopify_order_discount_applications a
  join public.shopify_order_facts o
    on o.id = a.order_id
   and o.organization_id = a.organization_id
  where a.organization_id = target_organization_id
    and a.store_id = target_store_id
    and a.discount_id = target_discount_id
    and a.code is not null
    and o.is_test_order = false
    and o.cancelled_at is null
    and coalesce(o.processed_at, o.external_created_at) >= target_period_start
    and coalesce(o.processed_at, o.external_created_at) < target_period_end
  group by a.code
  order by 2 desc;
$$;

revoke all on function public.shopify_discount_codes_usage(uuid, uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.shopify_discount_codes_usage(uuid, uuid, uuid, timestamptz, timestamptz) to authenticated, service_role;
comment on function public.shopify_discount_codes_usage(uuid, uuid, uuid, timestamptz, timestamptz) is
  'Pedidos sincronizados y descuento aplicado por cada codigo de una promocion; solo los codigos que aparecen en pedidos.';
