-- F3b del panel del manager: el coste que el cliente pone en Shopify llega al
-- motor de margen. Ver docs/PLAN_PANEL_MANAGER.md.
--
-- EL PROBLEMA, medido en produccion el 2026-09-15: 44 articulos de inventario,
-- 1 con coste puesto en Shopify, **0 filas en `product_costs`** -- la tabla
-- esta vacia entera. El COGS sale a cero y con el un margen del 77,84% que no
-- existe.
--
-- No es falta de datos, es una tuberia cortada:
--
--   * el sync SI pide `unitCost` a Shopify y lo guarda en
--     `shopify_inventory_items.current_unit_cost` (shopify-sync.ts);
--   * `shopify_margin_summary` SOLO lee `public.product_costs`;
--   * y nada escribe nunca en `product_costs` salvo el formulario manual de
--     `/shopify`, de uno en uno por SKU.
--
-- Asi que un cliente puede tener todos sus costes puestos en Shopify y seguir
-- viendo COGS 0 para siempre, sin ningun error por ningun lado.
--
-- POR QUE UN RESPALDO EN LA LECTURA Y NO UNA ESCRITURA EN EL SYNC. La opcion
-- obvia era que el sync creara una fila en `product_costs` con cada coste de
-- Shopify. Se descarta: `product_costs` es la tabla de costes *con historico y
-- con autor* (source, valid_from, valid_until, audit_logs), y es donde el
-- consultor mete a mano lo que Shopify no sabe. Si el sync empieza a escribir
-- ahi, cada importacion compite con el trabajo manual del consultor y antes o
-- despues lo pisa. La precedencia correcta es al reves: manda lo que una
-- persona escribio, y Shopify solo rellena el hueco.
--
-- EL TECHO, y se declara en la propia salida. `current_unit_cost` es el coste
-- de HOY: no tiene historico. Aplicarlo a un pedido de hace seis meses es una
-- aproximacion. Es muchisimo mejor que contar ese pedido como si el producto
-- fuera gratis, pero no es lo mismo que un coste fechado, y la pantalla tiene
-- que poder decirlo. Por eso sale `items_with_estimated_cost`: lineas cuyo
-- coste viene del valor actual de Shopify y no de una fila fechada.

drop function if exists public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid);
create function public.shopify_margin_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  revenue numeric,
  cogs numeric,
  gross_margin numeric,
  margin_pct numeric,
  items_with_cost bigint,
  items_without_cost bigint,
  items_with_estimated_cost bigint
)
language sql
stable
as $$
  with priced_items as (
    select
      oi.id as order_item_id,
      greatest(oi.quantity_current - oi.refunded_quantity, 0) as net_quantity,
      oi.current_line_total - oi.discount_total as item_revenue,
      -- Coste fechado: lo que una persona escribio para la fecha del pedido.
      (
        select pc.unit_cost
        from public.product_costs pc
        where pc.inventory_item_id = ii.id
          and pc.valid_from <= coalesce(o.processed_at, o.external_created_at)::date
          and (pc.valid_until is null or pc.valid_until >= coalesce(o.processed_at, o.external_created_at)::date)
        order by pc.valid_from desc
        limit 1
      ) as dated_cost,
      -- Respaldo: el coste actual que Shopify reporta para ese articulo.
      ii.current_unit_cost as shopify_cost
    from public.shopify_order_items oi
    join public.shopify_order_facts o on o.id = oi.order_id
    left join public.shopify_inventory_items ii on ii.variant_id = oi.variant_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  resolved as (
    select
      order_item_id,
      net_quantity,
      item_revenue,
      coalesce(dated_cost, shopify_cost) as unit_cost,
      dated_cost is null and shopify_cost is not null as is_estimated
    from priced_items
  )
  select
    coalesce(sum(item_revenue), 0) as revenue,
    coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0) as cogs,
    coalesce(sum(item_revenue) filter (where unit_cost is not null), 0)
      - coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0) as gross_margin,
    case
      when coalesce(sum(item_revenue) filter (where unit_cost is not null), 0) > 0 then round(
        (
          coalesce(sum(item_revenue) filter (where unit_cost is not null), 0)
          - coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0)
        ) / sum(item_revenue) filter (where unit_cost is not null) * 100,
        2
      )
      else 0
    end as margin_pct,
    count(*) filter (where unit_cost is not null) as items_with_cost,
    count(*) filter (where unit_cost is null) as items_without_cost,
    count(*) filter (where is_estimated) as items_with_estimated_cost
  from resolved;
$$;

grant execute on function public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid) is
  'Margen Shopify filtrable por store_id. El coste de cada linea sale de '
  'product_costs (fechado, escrito por una persona) y, si no hay fila que cubra '
  'la fecha del pedido, del current_unit_cost que Shopify reporta hoy. La '
  'precedencia es esa y no al reves: el sync nunca pisa el trabajo manual del '
  'consultor. items_with_estimated_cost cuenta las lineas que van por el '
  'respaldo, porque el coste de hoy aplicado a un pedido viejo es una '
  'aproximacion y la pantalla tiene que poder decirlo.';
