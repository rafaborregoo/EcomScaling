-- F5 del panel del manager, segundo paso del embudo: "anadio al carrito".
-- Ver docs/PLAN_PANEL_MANAGER.md.
--
-- 20261010090000 dejo el paso fuera a proposito: "necesita una metrica de
-- ShopifyQL que no tenemos verificada contra la API real, y meter un nombre de
-- columna a ojo es como se rompen los sync en silencio".
--
-- YA NO SE ADIVINA. La referencia del esquema `sessions` de ShopifyQL publica
-- los identificadores exactos, y el que buscabamos es
-- `sessions_with_cart_additions` (INTEGER, "Online store visits in which a
-- visitor added an item to cart"). Es una metrica de sesion, igual que
-- `sessions`: mismo denominador, mismo origen, comparable sin conversiones.
--
-- NULLABLE A PROPOSITO. `sessions` y `online_store_visitors` son `not null
-- default 0` porque desde el primer dia se pidieron. Esta no: las filas ya
-- sincronizadas se quedan a null, y null aqui significa "ese dia no lo
-- pedimos", no "ese dia nadie anadio al carrito". Poner 0 diria que ningun
-- visitante toco el carrito en un ano entero, que es mentira. Se rellenan solas
-- segun corra el sync, o de golpe con un sync completo de la tienda.

alter table public.shopify_sessions_daily
  add column if not exists sessions_with_cart_additions integer;

comment on column public.shopify_sessions_daily.sessions_with_cart_additions is
  'ShopifyQL sessions.sessions_with_cart_additions: visitas en las que alguien '
  'anadio un articulo al carrito. NULL = ese dia no se pidio la metrica (no '
  'equivale a 0).';

-- El embudo suma la metrica y dice desde cuando la tiene, con el mismo criterio
-- que `checkout_data_since`: no saber no es cero.
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
  checkout_data_since date,
  cart_additions bigint,
  cart_data_since date
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
      -- `sum` ignora los null: suma los dias que si tienen la metrica.
      coalesce(sum(d.sessions_with_cart_additions), 0)::bigint as cart_additions
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
  ),
  -- Lo mismo para el carrito, y sin columna de bookkeeping: el primer dia con
  -- la metrica no nula ES la fecha desde la que se puede pintar el paso.
  cobertura_carrito as (
    select min(d.bucket_date) as cart_data_since
    from public.shopify_sessions_daily d
    where d.organization_id = target_organization_id
      and (target_store_id is null or d.store_id = target_store_id)
      and d.sessions_with_cart_additions is not null
  )
  select
    s.sessions,
    s.online_store_visitors,
    s.conversion_rate_shopify,
    s.days_with_sessions,
    k.abandoned_checkouts,
    v.checkout_data_since,
    s.cart_additions,
    cc.cart_data_since
  from sesiones s
  cross join checkouts k
  cross join cobertura v
  cross join cobertura_carrito cc;
$$;

grant execute on function public.shopify_funnel_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_funnel_summary(uuid, timestamptz, timestamptz, uuid) is
  'Embudo: sesiones y carritos (ShopifyQL) y checkouts abandonados del periodo. '
  'Los pagos iniciados se componen fuera sumando estos checkouts a los pedidos, '
  'que la misma peticion ya tiene -- esta funcion NO vuelve a escanear '
  'shopify_order_facts a proposito. checkout_data_since y cart_data_since dicen '
  'desde cuando hay dato de cada paso, para no confundir "nadie llego ahi" con '
  '"todavia no lo sincronizabamos".';

-- El indice de sesiones por organizacion y fecha ya existe
-- (shopify_sessions_daily_org_date_idx, 20260903140000) y calza con el
-- predicado: la columna nueva no necesita indice propio, solo se agrega.
