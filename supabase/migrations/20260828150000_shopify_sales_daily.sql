-- Serie diaria de ventas para los sparklines de las tarjetas KPI del dashboard
-- (Total facturacion / Pedidos). Mismo patron que shopify_sales_summary:
-- funcion SQL `stable`, sin `security definer`, ejecutable por `authenticated`,
-- llamada via .rpc() desde apps/api. El predicado de fecha calza con el indice
-- existente shopify_order_facts_org_processed_idx (organization_id,
-- coalesce(processed_at, external_created_at)), creado en db_05e; no hace falta
-- indice nuevo.
--
-- generate_series rellena los dias sin pedidos con 0 para que la linea del
-- sparkline no tenga huecos. period_start es obligatorio (el dashboard solo
-- pide sparkline para 7/30/90 dias, nunca "Todo").

drop function if exists public.shopify_sales_daily(uuid, timestamptz, timestamptz, uuid);
create or replace function public.shopify_sales_daily(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  bucket_date date,
  net_sales numeric,
  orders_count bigint
)
language sql
stable
as $$
  with days as (
    select generate_series(
      date_trunc('day', period_start),
      date_trunc('day', period_end),
      interval '1 day'
    )::date as bucket_date
  ),
  daily as (
    select
      date_trunc('day', coalesce(o.processed_at, o.external_created_at))::date as bucket_date,
      coalesce(sum(o.net_sales), 0) as net_sales,
      count(*) as orders_count
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and coalesce(o.processed_at, o.external_created_at) >= period_start
      and coalesce(o.processed_at, o.external_created_at) <= period_end
    group by 1
  )
  select
    d.bucket_date,
    coalesce(daily.net_sales, 0) as net_sales,
    coalesce(daily.orders_count, 0) as orders_count
  from days d
  left join daily on daily.bucket_date = d.bucket_date
  order by d.bucket_date;
$$;

grant execute on function public.shopify_sales_daily(uuid, timestamptz, timestamptz, uuid) to authenticated;
