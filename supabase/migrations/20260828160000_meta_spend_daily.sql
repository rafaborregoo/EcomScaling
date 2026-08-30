-- Serie diaria de inversión Meta para el sparkline de la tarjeta KPI
-- "Inversión Meta" del dashboard. Mismo patrón que meta_spend_summary:
-- funcion SQL `stable`, sin `security definer` (RLS de meta_insight_rows_daily
-- limita las filas a organizaciones accesibles), ejecutable por `authenticated`,
-- llamada via .rpc() desde apps/api.
--
-- El predicado de fecha calza con el indice existente
-- meta_insight_rows_daily_org_date_idx (organization_id, metric_date), creado en
-- db_06; no hace falta indice nuevo. generate_series rellena los dias sin gasto
-- con 0 para que la linea del sparkline no tenga huecos. period_start es
-- obligatorio (el dashboard solo pide sparkline para 7/30/90 dias).

create or replace function public.meta_spend_daily(
  target_organization_id uuid,
  period_start date,
  period_end date
)
returns table (
  bucket_date date,
  spend numeric
)
language sql
stable
as $$
  with days as (
    select generate_series(period_start, period_end, interval '1 day')::date as bucket_date
  ),
  daily as (
    select
      r.metric_date as bucket_date,
      coalesce(sum(r.spend), 0) as spend
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.metric_date >= period_start
      and r.metric_date <= period_end
    group by r.metric_date
  )
  select
    d.bucket_date,
    coalesce(daily.spend, 0) as spend
  from days d
  left join daily on daily.bucket_date = d.bucket_date
  order by d.bucket_date;
$$;

grant execute on function public.meta_spend_daily(uuid, date, date) to authenticated;

comment on function public.meta_spend_daily is 'Gasto Meta por dia (insights nivel ad, sin breakdown) para el sparkline de la tarjeta KPI. Rellena con 0 los dias sin filas. period_start obligatorio.';
