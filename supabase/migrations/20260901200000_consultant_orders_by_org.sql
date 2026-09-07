-- Widget "Pedidos" del Dashboard del consultor (estado "vista general"):
-- pedidos y facturacion de las ultimas 24h desglosados por cliente
-- (organizacion), para una lista con filas clicables.
--
-- ADR-0006 pto. 6: agregacion en funcion SQL `stable`, SECURITY INVOKER, sin
-- `security definer`; el backend la invoca con service role sobre las org
-- asignadas. Mismo criterio de ventas reales que consultant_business_rollup /
-- shopify_sales_summary. El predicado de fecha calza con el indice existente
-- shopify_order_facts_org_processed_idx (organization_id, coalesce(processed_at,
-- external_created_at)); no hace falta indice nuevo.

create or replace function public.consultant_orders_by_org(
  org_ids uuid[],
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  organization_id uuid,
  orders_count bigint,
  net_sales numeric
)
language sql
stable
as $$
  select
    o.organization_id,
    count(*)::bigint as orders_count,
    coalesce(sum(o.net_sales), 0) as net_sales
  from public.shopify_order_facts o
  where o.organization_id = any(org_ids)
    and o.is_test_order = false
    and o.cancelled_at is null
    and coalesce(o.processed_at, o.external_created_at) between period_start and period_end
  group by o.organization_id;
$$;

grant execute on function public.consultant_orders_by_org(uuid[], timestamptz, timestamptz)
  to authenticated;

comment on function public.consultant_orders_by_org is
  'Pedidos y facturacion neta de un periodo desglosados por organizacion, para el widget "Pedidos" del Dashboard del consultor. Mismo criterio de ventas reales que consultant_business_rollup.';
