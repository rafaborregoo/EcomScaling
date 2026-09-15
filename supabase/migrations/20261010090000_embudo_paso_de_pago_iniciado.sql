-- F5 del panel del manager: el embudo gana el paso de "pago iniciado".
-- Ver docs/PLAN_PANEL_MANAGER.md.
--
-- El embudo se quedo en sesiones -> pedidos en
-- 20260903160000_shopify_funnel_sessions_only.sql, por coste de consulta y no
-- por falta de datos. Faltan los dos pasos donde se localiza la fuga: anadir al
-- carrito y pago iniciado.
--
-- ESTE ARREGLO TRAE UNO DE LOS DOS, Y CON DATO PROPIO. Medido en produccion el
-- 2026-09-15: `shopify_abandoned_checkouts` tiene 35 filas desde julio y
-- **cero** con `completed_at`, o sea que Shopify solo nos lista los checkouts
-- que se quedaron sin terminar. Por tanto:
--
--   pagos iniciados = checkouts abandonados + pedidos
--
-- sin doble conteo: en cuanto uno se completa deja de estar en esa lista y pasa
-- a ser un pedido. Los pedidos los pone quien ya los tiene (ADR de la migracion
-- de sessions-only: esta funcion NO vuelve a escanear shopify_order_facts, que
-- es lo que hizo saltar el statement_timeout de 8s).
--
-- EL PASO QUE NO VIENE: "anadir al carrito". Ese si necesita una metrica de
-- ShopifyQL que no tenemos verificada contra la API real, y meter un nombre de
-- columna a ojo es como se rompen los sync en silencio. Se deja fuera.
--
-- NO SABER NO ES CERO. La sincronizacion de checkouts empezo el 2026-07-16: en
-- un periodo anterior a esa fecha no hay checkouts porque no se pedian, no
-- porque nadie iniciara el pago. Si el embudo pintara 0 ahi, diria que todos
-- los pedidos entraron sin pasar por el pago, que es absurdo. Por eso sale
-- `checkout_data_since`: la API compara con el inicio del periodo y, si el
-- periodo empieza antes, el paso se muestra como desconocido.

drop function if exists public.shopify_funnel_summary(uuid, timestamptz, timestamptz, uuid);
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
  days_with_sessions bigint,
  abandoned_checkouts bigint,
  checkout_data_since date
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  with sesiones as (
    select
      coalesce(sum(d.sessions), 0)::bigint as sessions,
      coalesce(sum(d.online_store_visitors), 0)::bigint as online_store_visitors,
      -- Media ponderada por sesiones, no media de medias.
      round(
        case
          when coalesce(sum(d.sessions), 0) > 0
          then sum(d.conversion_rate * d.sessions) / nullif(sum(d.sessions), 0)
        end,
        5
      ) as conversion_rate_shopify,
      count(*)::bigint as days_with_sessions
    from public.shopify_sessions_daily d
    where d.organization_id = target_organization_id
      and (target_store_id is null or d.store_id = target_store_id)
      -- period_start null = "Todo": sin cota inferior.
      and (period_start is null or d.bucket_date >= date_trunc('day', period_start)::date)
      and d.bucket_date <= date_trunc('day', period_end)::date
  ),
  checkouts as (
    select count(*)::bigint as abandoned_checkouts
    from public.shopify_abandoned_checkouts c
    where c.organization_id = target_organization_id
      and (target_store_id is null or c.store_id = target_store_id)
      and (period_start is null or c.external_created_at >= period_start)
      and c.external_created_at <= period_end
  ),
  -- Desde cuando tenemos checkouts de esta tienda, sin acotar al periodo: es lo
  -- que distingue "nadie inicio el pago" de "todavia no lo sincronizabamos".
  cobertura as (
    select min(c.external_created_at)::date as checkout_data_since
    from public.shopify_abandoned_checkouts c
    where c.organization_id = target_organization_id
      and (target_store_id is null or c.store_id = target_store_id)
  )
  select
    s.sessions,
    s.online_store_visitors,
    s.conversion_rate_shopify,
    s.days_with_sessions,
    k.abandoned_checkouts,
    v.checkout_data_since
  from sesiones s
  cross join checkouts k
  cross join cobertura v;
$$;

grant execute on function public.shopify_funnel_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_funnel_summary(uuid, timestamptz, timestamptz, uuid) is
  'Embudo: sesiones (ShopifyQL) y checkouts abandonados del periodo. Los pagos '
  'iniciados se componen fuera sumando estos checkouts a los pedidos, que la '
  'misma peticion ya tiene -- esta funcion no vuelve a escanear '
  'shopify_order_facts a proposito. checkout_data_since dice desde cuando hay '
  'datos de checkout, para no confundir "nadie inicio el pago" con "todavia no '
  'lo sincronizabamos".';

-- Serie diaria: mismo anadido, para que la curva del embudo tenga el paso.
drop function if exists public.shopify_funnel_daily(uuid, timestamptz, timestamptz, uuid);
create function public.shopify_funnel_daily(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  bucket_date date,
  sessions bigint,
  abandoned_checkouts bigint
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  with sesiones as (
    select d.bucket_date, sum(d.sessions)::bigint as sessions
    from public.shopify_sessions_daily d
    where d.organization_id = target_organization_id
      and (target_store_id is null or d.store_id = target_store_id)
      and d.bucket_date >= date_trunc('day', period_start)::date
      and d.bucket_date <= date_trunc('day', period_end)::date
    group by d.bucket_date
  ),
  checkouts as (
    select c.external_created_at::date as bucket_date, count(*)::bigint as abandoned_checkouts
    from public.shopify_abandoned_checkouts c
    where c.organization_id = target_organization_id
      and (target_store_id is null or c.store_id = target_store_id)
      and c.external_created_at >= period_start
      and c.external_created_at <= period_end
    group by 1
  )
  -- `full join`: un dia puede tener checkouts sin sesiones (dato de analitica
  -- que Shopify aun no ha consolidado) o sesiones sin checkouts.
  select
    coalesce(s.bucket_date, k.bucket_date) as bucket_date,
    coalesce(s.sessions, 0) as sessions,
    coalesce(k.abandoned_checkouts, 0) as abandoned_checkouts
  from sesiones s
  full join checkouts k on k.bucket_date = s.bucket_date
  order by 1;
$$;

grant execute on function public.shopify_funnel_daily(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- El indice que calza con el predicado de fecha, junto a la funcion que lo
-- necesita (ADR-0006 pto 6).
create index if not exists shopify_abandoned_checkouts_org_created_idx
  on public.shopify_abandoned_checkouts (organization_id, store_id, external_created_at);
