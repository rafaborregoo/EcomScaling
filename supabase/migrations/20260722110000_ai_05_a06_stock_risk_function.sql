-- AI-05 (fix A06): funcion SQL que cruza stock disponible con ventas
-- recientes por producto, en el mismo patron que el resto de metricas
-- (funcion SQL stable, no agregacion en Node). Se probo A06 dejando que el
-- modelo hiciera este cruce el solo via sql_select y se colgo en el limite
-- de llamadas a herramientas (8) con una respuesta final vacia/corrupta tras
-- 500s: el cruce producto a producto es exactamente el tipo de contexto que
-- debe llegar ya resuelto (criterio ADR-0006 punto 6), no algo que el modelo
-- reconstruya por su cuenta turno a turno.

create or replace function public.shopify_stock_risk_products(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  product_id uuid,
  title varchar,
  available_quantity bigint,
  quantity_sold_30d bigint
)
language sql
stable
as $$
  with sold as (
    select
      oi.product_id,
      sum(oi.quantity_current) as quantity_sold
    from public.shopify_order_items oi
    join public.shopify_order_facts o on o.id = oi.order_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
    group by oi.product_id
  ),
  stock as (
    select
      v.product_id,
      coalesce(sum(s.available_quantity), 0) as available_quantity
    from public.shopify_inventory_current_state s
    join public.shopify_inventory_items ii on ii.id = s.inventory_item_id
    join public.shopify_variants v on v.id = ii.variant_id
    where s.organization_id = target_organization_id
      and s.is_active = true
    group by v.product_id
  )
  select
    p.id as product_id,
    p.title,
    coalesce(stock.available_quantity, 0) as available_quantity,
    sold.quantity_sold as quantity_sold_30d
  from sold
  join public.shopify_products p on p.id = sold.product_id
  left join stock on stock.product_id = p.id
  where (target_store_id is null or p.store_id = target_store_id)
  order by sold.quantity_sold desc, coalesce(stock.available_quantity, 0) asc
  limit 30;
$$;

grant execute on function public.shopify_stock_risk_products(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_stock_risk_products(uuid, timestamptz, timestamptz, uuid) is 'Cruce de stock disponible y ventas de los ultimos N dias por producto, ordenado por riesgo de quiebre (vende mucho, queda poco); base de contexto de A06.';
