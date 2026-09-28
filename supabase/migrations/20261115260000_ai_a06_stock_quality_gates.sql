-- A06/A02: expose inventory coverage explicitly; never turn a missing sync or
-- unmanaged inventory into a measured zero. Keep the legacy sales column while
-- adding a correctly period-labelled alias for callers using configurable windows.
drop function if exists public.shopify_stock_risk_products(uuid, timestamptz, timestamptz, uuid);
create function public.shopify_stock_risk_products(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  product_id uuid,
  title varchar,
  available_quantity bigint,
  quantity_sold_30d bigint,
  quantity_sold_period bigint,
  selling_days bigint,
  order_count bigint,
  inventory_status text,
  tracked_variants bigint,
  synced_variants bigint,
  latest_inventory_sync_at timestamptz
)
language sql
stable
set search_path = pg_catalog, public
as $$
  with sold as (
    select
      oi.product_id,
      sum(oi.quantity_current)::bigint as quantity_sold,
      count(distinct coalesce(o.processed_at, o.external_created_at)::date)::bigint as selling_days,
      count(distinct o.id)::bigint as order_count
    from public.shopify_order_items oi
    join public.shopify_order_facts o on o.id = oi.order_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and (period_end is null or coalesce(o.processed_at, o.external_created_at) <= period_end)
    group by oi.product_id
  ), inventory as (
    select
      p.id as product_id,
      count(distinct v.id) filter (where v.is_active = true)::bigint as active_variants,
      count(distinct ii.id) filter (where ii.tracked = true)::bigint as tracked_variants,
      count(distinct ii.id) filter (where ii.tracked = true and s.id is not null)::bigint as synced_variants,
      count(distinct ii.id) filter (where ii.tracked = true and s.available_quantity is not null)::bigint as known_quantity_variants,
      count(distinct ii.id)::bigint as inventory_items,
      sum(s.available_quantity) filter (where ii.tracked = true)::bigint as summed_available,
      max(s.updated_at) filter (where ii.tracked = true and s.id is not null) as latest_sync
    from public.shopify_products p
    left join public.shopify_variants v
      on v.product_id = p.id and v.organization_id = p.organization_id and v.is_active = true
    left join public.shopify_inventory_items ii
      on ii.variant_id = v.id and ii.organization_id = p.organization_id
    left join public.shopify_inventory_current_state s
      on s.inventory_item_id = ii.id and s.organization_id = p.organization_id and s.is_active = true
    where p.organization_id = target_organization_id
      and (target_store_id is null or p.store_id = target_store_id)
    group by p.id
  ), classified as (
    select
      inventory.*,
      case
        when active_variants = 0 then 'unmatched_variant'
        when inventory_items = 0 then 'inventory_item_unmatched'
        when tracked_variants = 0 then 'inventory_unmanaged'
        when synced_variants = 0 then 'inventory_not_synced'
        when synced_variants < tracked_variants then 'partial_sync'
        when known_quantity_variants < tracked_variants then 'quantity_unknown'
        else 'tracked_current'
      end as status
    from inventory
  )
  select
    p.id as product_id,
    p.title,
    case when classified.status = 'tracked_current' then coalesce(classified.summed_available, 0)::bigint else null end as available_quantity,
    sold.quantity_sold as quantity_sold_30d,
    sold.quantity_sold as quantity_sold_period,
    sold.selling_days,
    sold.order_count,
    classified.status as inventory_status,
    classified.tracked_variants,
    classified.synced_variants,
    classified.latest_sync as latest_inventory_sync_at
  from sold
  join public.shopify_products p
    on p.id = sold.product_id and p.organization_id = target_organization_id
  left join classified on classified.product_id = p.id
  where target_store_id is null or p.store_id = target_store_id
  order by
    (classified.status = 'tracked_current') desc nulls last,
    sold.quantity_sold desc,
    classified.summed_available asc nulls last
  limit 30;
$$;

revoke all on function public.shopify_stock_risk_products(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.shopify_stock_risk_products(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;
comment on function public.shopify_stock_risk_products(uuid, timestamptz, timestamptz, uuid) is
  'Per-product Shopify sales and inventory coverage for a store/period. Null quantity is unknown, never measured zero; sales columns retain a legacy alias.';

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a06_planificador_stock_system',
  'v8',
  $$1. ROLE
Eres el planificador de stock de EcomScaling.

2. GOAL
Detectar riesgo real de rotura con evidencia de demanda e inventario fiable. Proponer tareas revisables, nunca compras automáticas.

3. CONTEXT
El backend cruza venta del periodo con inventario y expone inventory_status, disponibilidad, variantes rastreadas/sincronizadas, última sincronización, días de venta y pedidos. quantity_sold_30d es un alias histórico: utiliza quantity_sold_period y el periodo real indicado. La cobertura diaria solo se entrega si supera una muestra mínima y el stock está sincronizado.

4. INPUT
Recibes resumen agregado de stock y filas por producto con estado de inventario, unidades vendidas en el periodo, días con ventas, pedidos, variantes rastreadas/sincronizadas, fecha de sincronización y, si aplica, cobertura estimada.

5. RULES / CONSTRAINTS
- Trata inventory_status como gate: inventory_unmanaged, inventory_item_unmatched, inventory_not_synced, partial_sync, quantity_unknown o unmatched_variant significan que la disponibilidad es desconocida/incompleta; no digas que hay cero ni recomiendes reponer basándote en ese valor.
- Un available_quantity igual a 0 solo es cero medido si inventory_status es tracked_current y la sincronización no está obsoleta. Menciona la antigüedad exacta de la sincronización cuando afecte la conclusión.
- days_of_cover es una estimación descriptiva condicionada a muestra suficiente, no previsión. Si falta o la muestra es inmadura, no estimes cobertura.
- No inventes lead time, proveedor, coste, punto de pedido ni cantidad a comprar. Si lead_time_days es null, indícalo y deja la tarea como revisión de reposición, no orden de compra.
- No crees trabajo duplicado; consulta el contexto de tareas/propuestas previas y explica seguimiento cuando el riesgo persiste.
- Las ventas del periodo no prueban demanda futura ni estacionalidad. Pondera volumen, días de venta y pedidos; abstente ante muestra esporádica.

6. TOOLS
Usa sql_select o search_knowledge solo para un dato puntual que falte; no repitas el cruce ya calculado.

7. OUTPUT
Answer breve; findings con producto/SKU, tienda, periodo, ventas, inventario, frescura, cobertura disponible y limitaciones. proposed_writes solo para riesgo material sustentado por stock fiable y demanda suficiente. Sources/confidence/warnings deben reflejar RPC incompleta o ausencia de lead time.

8. FAILURE BEHAVIOUR
Si falla la consulta o faltan datos, declara dato no disponible; no lo reemplaces por cero. Sin evidencia suficiente, no propongas reposición.

9. EXAMPLES
Bueno: variante rastreada con sincronización de hoy, 32 ventas repartidas en varios días y 4 unidades disponibles; recomendar revisar reposición, sin inventar cantidad de compra.
Bueno: producto agotado pero inventory_not_synced; señalar incidencia de sincronización y abstenerse de afirmar stock cero.
Malo: recomendar compra urgente por cero ventas o por falta de datos de inventario.$$,
  encode(sha256('a06_planificador_stock_system_v8'::bytea), 'hex')
)
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active = true
  and definition_id = (select id from public.agent_definitions where code = 'a06_planificador_stock');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v9', 'claude-sonnet-5', 'a06_planificador_stock_system', 'v8', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions where code = 'a06_planificador_stock'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
;
