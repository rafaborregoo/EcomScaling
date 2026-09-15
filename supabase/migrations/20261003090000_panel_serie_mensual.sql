-- F2 del panel del manager: la serie mensual.
-- Ver docs/PLAN_PANEL_MANAGER.md.
--
-- El panel de referencia ancla toda su narrativa en un grafico de barras de 12
-- meses con los ingresos de cada mes y el beneficio debajo. Hoy no hay forma de
-- dibujarlo: `shopify_sales_daily` agrupa por dia y no devuelve beneficio.
--
-- Decision de diseno: esta funcion NO reimplementa la formula financiera, la
-- LLAMA una vez por mes con un `lateral`. Copiar la formula aqui seria mas
-- rapido de escribir y garantizaria que algun dia el grafico y el KPI del
-- periodo se contradigan -- que es justo lo que no puede pasar cuando el
-- consultor esta ensenando la pantalla a un cliente. Una sola fuente de verdad
-- para el beneficio, aunque cueste 12 llamadas.
--
-- Coste: cada llamada filtra por `(organization_id, coalesce(processed_at,
-- external_created_at))`, que es exactamente el indice parcial
-- `shopify_order_facts_org_processed_idx` que ya existe (ADR-0006 pto 6, el
-- indice ya calza; no hace falta uno nuevo). El termino caro es el conteo de
-- clientes nuevos, que recorre el historico completo de la tienda una vez por
-- mes; si algun dia esto se acerca al statement_timeout de 8 s del rol
-- `authenticated`, la salida es materializar los primeros pedidos por cliente,
-- no duplicar la formula.

drop function if exists public.shopify_financial_monthly(uuid, integer, uuid);
create function public.shopify_financial_monthly(
  target_organization_id uuid,
  months_back integer,
  target_store_id uuid
)
returns table (
  bucket_month date,
  orders_count bigint,
  net_revenue_ex_tax numeric,
  net_profit numeric,
  ads_spend numeric,
  new_customers bigint
)
language sql
stable
as $$
  with bounds as (
    select
      m::date as bucket_month,
      m as period_start,
      -- El fin de mes es el ultimo instante del mes, no el primero del
      -- siguiente: `shopify_financial_summary` compara con `<= period_end` y
      -- un pedido de las 00:00:00 del dia 1 contaria en los dos meses.
      (m + interval '1 month' - interval '1 microsecond') as period_end
    from generate_series(
      date_trunc('month', now()) - make_interval(months => greatest(months_back, 1) - 1),
      date_trunc('month', now()),
      interval '1 month'
    ) as m
  )
  select
    b.bucket_month,
    f.orders_count,
    f.net_revenue_ex_tax,
    f.net_profit,
    f.ads_spend,
    f.new_customers
  from bounds b
  cross join lateral public.shopify_financial_summary(
    target_organization_id,
    b.period_start,
    b.period_end,
    target_store_id
  ) f
  order by b.bucket_month;
$$;

grant execute on function public.shopify_financial_monthly(uuid, integer, uuid) to authenticated;

comment on function public.shopify_financial_monthly(uuid, integer, uuid) is
  'Serie mensual de ingresos sin IVA y beneficio neto, un mes por fila, del mes '
  'actual hacia atras. Llama a shopify_financial_summary mes a mes en vez de '
  'reimplementar la formula: el grafico y el KPI del periodo no pueden '
  'contradecirse porque salen del mismo calculo. months_back cuenta el mes en '
  'curso (12 = este mes y los once anteriores).';
