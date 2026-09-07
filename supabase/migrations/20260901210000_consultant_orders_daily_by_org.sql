-- Grafico del widget "Pedidos" del Dashboard del consultor: evolucion de
-- pedidos por cliente (organizacion) dentro del rango elegido. Serie temporal
-- diaria; los dias sin pedidos de un cliente no se devuelven (el frontend
-- rellena los huecos con 0 para dibujar la linea).
--
-- ADR-0006 pto. 6: funcion SQL `stable`, SECURITY INVOKER, sin `security
-- definer`; el backend la invoca con service role sobre las org asignadas.
-- Mismo criterio de venta real que consultant_orders_by_org. El predicado de
-- fecha calza con shopify_order_facts_org_processed_idx (organization_id,
-- coalesce(processed_at, external_created_at)); no hace falta indice nuevo.

create or replace function public.consultant_orders_daily_by_org(
  org_ids uuid[],
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  bucket_date date,
  organization_id uuid,
  orders_count bigint
)
language sql
stable
as $$
  select
    date_trunc('day', coalesce(o.processed_at, o.external_created_at))::date as bucket_date,
    o.organization_id,
    count(*)::bigint as orders_count
  from public.shopify_order_facts o
  where o.organization_id = any(org_ids)
    and o.is_test_order = false
    and o.cancelled_at is null
    and coalesce(o.processed_at, o.external_created_at) between period_start and period_end
  group by 1, 2
  order by 1;
$$;

grant execute on function public.consultant_orders_daily_by_org(uuid[], timestamptz, timestamptz)
  to authenticated;

comment on function public.consultant_orders_daily_by_org is
  'Serie diaria de pedidos por organizacion en un rango, para el grafico de evolucion del widget "Pedidos" del Dashboard del consultor. Mismo criterio de venta real que consultant_orders_by_org.';
