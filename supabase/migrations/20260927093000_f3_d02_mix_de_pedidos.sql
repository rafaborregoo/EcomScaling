-- ---------------------------------------------------------------------------
-- FASE 3 / D02 — la descomposicion del mix, en SQL.
--
-- El paso 6 del runtime pide separar cambio dentro de segmentos de cambio en
-- composicion. Para eso hacen falta dos fotos agregadas por segmento, y el
-- punto 6 del ADR-0006 es explicito: las metricas son funciones SQL `stable`
-- llamadas por `.rpc()`, nunca agregaciones en Node.
--
-- Dos dimensiones, que son las unicas que `shopify_order_facts` sostiene hoy
-- sin inventarse nada:
--
--   `channel`        de donde vino el cliente (`first_visit_source_type`)
--   `customer_type`  nuevo o recurrente (`is_first_customer_order`)
--
-- Falta `device`, `market` y `product`, que son las otras tres de la lista del
-- artefacto. No se simulan: el motor declara que no puede mirarlas y eso acaba
-- en `missing_context`, que es el comportamiento que pide el paso 15.
--
-- `orders` es el peso y `net_sales` da el rendimiento (AOV = net_sales/orders).
-- Los dos salen juntos a proposito: un peso sin rendimiento no distingue nada,
-- y es justo lo que la check constraint `..._rendimiento_par` impide guardar.
--
-- Sin `security definer`: la funcion se ejecuta con los permisos de quien
-- llama, igual que el resto de metricas del repo.
-- ---------------------------------------------------------------------------

create or replace function public.context_order_mix(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid default null
)
returns table (
  dimension text,
  segment text,
  orders bigint,
  net_sales numeric
)
language sql
stable
as $$
  with pedidos as (
    select
      coalesce(o.first_visit_source_type, 'desconocido') as canal,
      o.is_first_customer_order,
      o.net_sales
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      -- Mismos filtros que `shopify_sales_daily`: si el mix contara pedidos de
      -- prueba o cancelados, diria que el negocio cambio cuando cambio el QA.
      and o.is_test_order = false
      and o.cancelled_at is null
      and coalesce(o.processed_at, o.external_created_at) >= period_start
      and coalesce(o.processed_at, o.external_created_at) < period_end
  )
  select 'channel'::text, canal::text, count(*)::bigint, coalesce(sum(net_sales), 0)
    from pedidos
   group by canal
  union all
  select
    'customer_type'::text,
    case when is_first_customer_order then 'nuevo' else 'recurrente' end,
    count(*)::bigint,
    coalesce(sum(net_sales), 0)
    from pedidos
   group by is_first_customer_order;
$$;

comment on function public.context_order_mix(uuid, timestamptz, timestamptz, uuid) is
  'F3/D02 paso 6. Peso (pedidos) y rendimiento (net_sales) por segmento en una ventana, para separar cambio de rendimiento de cambio de composicion.';

-- El indice que calza con el predicado de fecha, junto a la funcion que lo
-- necesita (ADR-0006 punto 6).
create index if not exists shopify_order_facts_mix_idx
  on public.shopify_order_facts (
    organization_id,
    store_id,
    (coalesce(processed_at, external_created_at))
  )
  where is_test_order = false and cancelled_at is null;
