-- Ranking de TIENDAS por pedidos del Dashboard del consultor (vista general).
-- Complementa consultant_orders_by_org: un cliente puede tener varias tiendas
-- (modelo multitienda), y "quien vende mas" a nivel cliente esconde que dentro
-- de ese cliente una tienda tira y otra esta parada.
--
-- ADR-0006 pto. 6: agregacion en funcion SQL `stable`, SECURITY INVOKER, sin
-- `security definer`; el backend la invoca con service role sobre las org
-- asignadas. Mismo criterio de venta real que consultant_orders_by_org
-- (is_test_order = false, cancelled_at is null, coalesce(processed_at,
-- external_created_at)), asi que los dos rankings siempre cuadran entre si.
-- El predicado de fecha calza con shopify_order_facts_org_processed_idx
-- (organization_id, coalesce(processed_at, external_created_at)); el group by
-- adicional por store_id no necesita indice nuevo.

drop function if exists public.consultant_orders_by_store(uuid[], timestamptz, timestamptz);
create or replace function public.consultant_orders_by_store(
  org_ids uuid[],
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  store_id uuid,
  organization_id uuid,
  shop_name text,
  myshopify_domain text,
  currency_code text,
  orders_count bigint,
  net_sales numeric,
  units_sold bigint
)
language sql
stable
as $$
  select
    o.store_id,
    o.organization_id,
    s.shop_name::text as shop_name,
    s.myshopify_domain::text as myshopify_domain,
    coalesce(s.currency_code, 'EUR')::text as currency_code,
    count(*)::bigint as orders_count,
    coalesce(sum(o.net_sales), 0) as net_sales,
    coalesce(sum(o.total_items), 0)::bigint as units_sold
  from public.shopify_order_facts o
  join public.shopify_stores s on s.id = o.store_id
  where o.organization_id = any(org_ids)
    and o.is_test_order = false
    and o.cancelled_at is null
    and coalesce(o.processed_at, o.external_created_at) between period_start and period_end
  group by o.store_id, o.organization_id, s.shop_name, s.myshopify_domain, s.currency_code;
$$;

grant execute on function public.consultant_orders_by_store(uuid[], timestamptz, timestamptz)
  to authenticated;

comment on function public.consultant_orders_by_store is
  'Pedidos, unidades y facturacion neta de un periodo desglosados por tienda Shopify, para el ranking de tiendas del Dashboard del consultor. Mismo criterio de venta real que consultant_orders_by_org.';
