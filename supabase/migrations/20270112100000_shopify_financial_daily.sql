-- Beneficio neto por dia, para la linea de beneficio del grafico del Dashboard.
-- Igual que shopify_financial_monthly: llama a shopify_financial_summary dia a
-- dia en vez de reimplementar la formula, asi la linea y el KPI del periodo no
-- pueden contradecirse. Los gastos fijos ya se prorratean por duracion del
-- periodo dentro de la funcion resumen.

drop function if exists public.shopify_financial_daily(uuid, timestamptz, timestamptz, uuid);

create function public.shopify_financial_daily(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  bucket_date date,
  net_profit numeric
)
language sql
stable
set search_path = pg_catalog, public
as $$
  with days as (
    select d as day_start
    from generate_series(
      date_trunc('day', period_start),
      date_trunc('day', period_end),
      interval '1 day'
    ) as d
  )
  select
    d.day_start::date as bucket_date,
    f.net_profit
  from days d
  cross join lateral public.shopify_financial_summary(
    target_organization_id,
    greatest(d.day_start, period_start),
    -- Ultimo instante del dia, no el primero del siguiente: el resumen compara
    -- con `<= period_end` y un pedido de las 00:00:00 contaria en dos dias.
    least(d.day_start + interval '1 day' - interval '1 microsecond', period_end),
    target_store_id
  ) f
  order by d.day_start;
$$;

grant execute on function public.shopify_financial_daily(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_financial_daily(uuid, timestamptz, timestamptz, uuid) is
  'Beneficio neto por dia del periodo, mismos cubos que shopify_sales_daily. '
  'Llama a shopify_financial_summary dia a dia para no duplicar la formula.';
