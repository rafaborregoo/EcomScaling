-- F5 del panel del manager: el embudo pasa a tener UNA sola fuente.
-- Ver docs/PLAN_PANEL_MANAGER.md.
--
-- DE DONDE VENIMOS. El embudo se fue montando con lo que habia a mano:
--   Sesiones            -> ShopifyQL (analitica de la tienda online)
--   Anadio al carrito   -> ShopifyQL (20261014090000)
--   Pago iniciado       -> checkouts abandonados + pedidos (20261010090000)
--   Compras             -> pedidos
--
-- Los dos ultimos cuentan TODOS los canales; los dos primeros solo visitas a la
-- web. Mezclados en la misma columna de porcentajes, un paso podia salir por
-- encima del 100 % del anterior en una tienda que venda tambien fuera de la
-- web. No era un error de cuenta: era la costura entre dos fuentes.
--
-- LO QUE SE HACE. El esquema `sessions` de ShopifyQL publica los cuatro pasos
-- con la misma unidad -- visitas a la tienda online:
--   sessions
--   sessions_with_cart_additions        ("anadio un articulo al carrito")
--   sessions_that_reached_checkout      ("llego a la pagina de pago")
--   sessions_that_completed_checkout    ("completo la compra")
--
-- Asi que el embudo se queda con esas cuatro y el apano de los checkouts
-- abandonados se jubila AQUI DENTRO. El bloque de sync de checkouts sigue
-- existiendo y la tabla tambien: lo que se retira es su uso como paso del
-- embudo, que nunca fue su trabajo.
--
-- LO QUE ESTA FUNCION YA NO HACE: leer shopify_abandoned_checkouts. Solo toca
-- shopify_sessions_daily, que son decenas de filas por tienda y mes.
--
-- NULLABLE, COMO EL CARRITO. Las filas ya sincronizadas se quedan a null: null
-- es "ese dia no pedimos la metrica", no "ese dia nadie llego al pago". Se
-- rellenan segun corra el sync, o de golpe con un sync completo (365 dias).

alter table public.shopify_sessions_daily
  add column if not exists sessions_that_reached_checkout integer;

alter table public.shopify_sessions_daily
  add column if not exists sessions_that_completed_checkout integer;

comment on column public.shopify_sessions_daily.sessions_that_reached_checkout is
  'ShopifyQL sessions.sessions_that_reached_checkout: visitas que llegaron a la '
  'pagina de pago. NULL = ese dia no se pidio la metrica (no equivale a 0).';

comment on column public.shopify_sessions_daily.sessions_that_completed_checkout is
  'ShopifyQL sessions.sessions_that_completed_checkout: visitas que completaron '
  'la compra. NULL = ese dia no se pidio la metrica (no equivale a 0). No es lo '
  'mismo que el numero de pedidos: aqui solo cuenta la tienda online.';

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
  cart_additions bigint,
  checkouts_reached bigint,
  purchases bigint,
  funnel_data_since date
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
      count(*)::bigint as days_with_sessions,
      -- `sum` ignora los null: suma los dias que si tienen la metrica. Cuales
      -- son esos dias lo dice `funnel_data_since`.
      coalesce(sum(d.sessions_with_cart_additions), 0)::bigint as cart_additions,
      coalesce(sum(d.sessions_that_reached_checkout), 0)::bigint as checkouts_reached,
      coalesce(sum(d.sessions_that_completed_checkout), 0)::bigint as purchases
    from public.shopify_sessions_daily d
    where d.organization_id = target_organization_id
      and (target_store_id is null or d.store_id = target_store_id)
      -- period_start null = "Todo": sin cota inferior.
      and (period_start is null or d.bucket_date >= date_trunc('day', period_start)::date)
      and d.bucket_date <= date_trunc('day', period_end)::date
  ),
  -- Desde cuando el embudo esta COMPLETO. Las tres metricas viajan en la misma
  -- consulta a ShopifyQL, asi que normalmente aparecen y desaparecen juntas;
  -- exigir las tres evita pintar medio embudo si alguna vez no fuera asi.
  -- Sin columna de bookkeeping: el dato se describe a si mismo.
  cobertura as (
    select min(d.bucket_date) as funnel_data_since
    from public.shopify_sessions_daily d
    where d.organization_id = target_organization_id
      and (target_store_id is null or d.store_id = target_store_id)
      and d.sessions_with_cart_additions is not null
      and d.sessions_that_reached_checkout is not null
      and d.sessions_that_completed_checkout is not null
  )
  select
    s.sessions,
    s.online_store_visitors,
    s.conversion_rate_shopify,
    s.days_with_sessions,
    s.cart_additions,
    s.checkouts_reached,
    s.purchases,
    c.funnel_data_since
  from sesiones s
  cross join cobertura c;
$$;

grant execute on function public.shopify_funnel_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_funnel_summary(uuid, timestamptz, timestamptz, uuid) is
  'Embudo de la tienda online, entero desde ShopifyQL: sesiones -> carrito -> '
  'pago -> compra, los cuatro pasos en la misma unidad (visitas). `purchases` '
  'son visitas que compraron, NO el numero de pedidos: los pedidos incluyen '
  'otros canales. funnel_data_since dice desde cuando el embudo esta completo, '
  'para no confundir "nadie llego ahi" con "todavia no lo sincronizabamos".';
