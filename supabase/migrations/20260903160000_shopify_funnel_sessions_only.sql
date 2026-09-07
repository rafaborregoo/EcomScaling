-- El embudo pasa a leer SOLO sesiones; los pedidos los pone el que ya los tenia.
--
-- Por que: shopify_funnel_summary/_daily hacian su propio escaneo de
-- shopify_order_facts para contar pedidos e ingresos, datos que la misma
-- request ya obtiene de shopify_sales_summary y shopify_sales_daily. Eso
-- duplicaba la parte cara de la consulta y, con las 10 RPC que /shopify/metrics
-- lanza en paralelo, empujaba a shopify_top_products y shopify_financial_summary
-- por encima del statement_timeout de 8s del rol `authenticated` (HTTP 500).
--
-- El coste real no es el volumen (688 pedidos, 965 lineas): es que la politica
-- RLS `private.can_access_org(organization_id)` recibe una COLUMNA, asi que
-- Postgres la evalua fila a fila y cada llamada hace hasta 3 subconsultas
-- SECURITY DEFINER. Medido: 935ms solo en el Seq Scan de shopify_order_facts.
-- Eso es un problema transversal (72 politicas con ese mismo patron) y se trata
-- aparte; aqui simplemente se deja de pagarlo dos veces.
--
-- Las tasas se siguen calculando sobre agregados SQL (ADR-0006 pto 6): la
-- ponderada por sesiones sale de aqui, y pedidos/sesiones es una division de
-- dos escalares ya agregados, no una agregacion en Node.
--
-- ADR-0021 sigue en pie: conversion_rate_shopify (la que reporta Shopify) no se
-- mezcla ni se promedia con la propia; cada una viaja con su fuente.

drop function if exists public.shopify_funnel_summary(uuid, timestamptz, timestamptz, uuid);
drop function if exists public.shopify_funnel_daily(uuid, timestamptz, timestamptz, uuid);

create function public.shopify_funnel_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  sessions bigint,
  online_store_visitors bigint,
  conversion_rate_shopify numeric,
  days_with_sessions bigint
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select
    coalesce(sum(d.sessions), 0)::bigint,
    coalesce(sum(d.online_store_visitors), 0)::bigint,
    -- Media ponderada por sesiones, no media de medias.
    round(
      case
        when coalesce(sum(d.sessions), 0) > 0
        then sum(d.conversion_rate * d.sessions) / nullif(sum(d.sessions), 0)
      end,
      5
    ),
    count(*)::bigint
  from public.shopify_sessions_daily d
  where d.organization_id = target_organization_id
    and (target_store_id is null or d.store_id = target_store_id)
    -- period_start null = "Todo": sin cota inferior.
    and (period_start is null or d.bucket_date >= date_trunc('day', period_start)::date)
    and d.bucket_date <= date_trunc('day', period_end)::date;
$$;

grant execute on function public.shopify_funnel_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- Serie diaria de sesiones. Solo los dias con dato: el relleno de huecos lo
-- hace ya shopify_sales_daily, con el que se cruza por fecha.
create function public.shopify_funnel_daily(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  bucket_date date,
  sessions bigint
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select d.bucket_date, sum(d.sessions)::bigint
  from public.shopify_sessions_daily d
  where d.organization_id = target_organization_id
    and (target_store_id is null or d.store_id = target_store_id)
    and d.bucket_date >= date_trunc('day', period_start)::date
    and d.bucket_date <= date_trunc('day', period_end)::date
  group by d.bucket_date
  order by d.bucket_date;
$$;

grant execute on function public.shopify_funnel_daily(uuid, timestamptz, timestamptz, uuid) to authenticated;
