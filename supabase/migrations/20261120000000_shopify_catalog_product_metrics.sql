-- Metricas del catalogo de Shopify por producto: ventas, stock, margen,
-- ranking con filtros/orden, resumen, serie semanal y compras conjuntas.
--
-- Son funciones SQL `stable` y `security invoker` (ADR-0006): corren con los
-- permisos del usuario, asi que RLS sigue decidiendo que ve cada cual. El
-- indice que sirve a los joins ya existe (shopify_order_items_product_id_idx,
-- shopify_order_items_order_id_idx); aqui solo se anade el de la fecha del
-- pedido, que es el predicado de periodo.
--
-- Idempotente: cada funcion se elimina por firma antes de crearse.

create index if not exists shopify_order_facts_store_processed_idx
  on public.shopify_order_facts (store_id, (coalesce(processed_at, external_created_at)));

-- ---------------------------------------------------------------------------
-- 1. Metricas por producto
-- ---------------------------------------------------------------------------
drop function if exists public.shopify_catalog_product_metrics(uuid, uuid[], uuid[], timestamptz, timestamptz);

create function public.shopify_catalog_product_metrics(
  target_organization_id uuid,
  target_store_ids uuid[],
  target_product_ids uuid[],
  target_period_start timestamptz,
  target_period_end timestamptz
)
returns table (
  product_id uuid,
  units_ordered bigint,
  units_refunded bigint,
  orders_count bigint,
  last_order_at timestamptz,
  stock_available bigint,
  tracked_variants bigint,
  variants_total bigint,
  variants_out bigint,
  variants_low bigint,
  variants_without_cost bigint,
  price_min numeric,
  price_max numeric,
  order_lines bigint,
  lines_missing_cost bigint,
  lines_missing_net bigint,
  net_revenue numeric,
  cogs numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with prods as (
    select p.id
    from public.shopify_products p
    where p.organization_id = target_organization_id
      and p.store_id = any(target_store_ids)
      and (target_product_ids is null or p.id = any(target_product_ids))
  ),
  var_stock as (
    select
      v.product_id,
      v.current_price,
      ii.tracked,
      ii.current_unit_cost,
      coalesce(sum(cs.available_quantity) filter (where cs.is_active), 0) as available
    from public.shopify_variants v
    join prods on prods.id = v.product_id
    left join public.shopify_inventory_items ii on ii.variant_id = v.id
    left join public.shopify_inventory_current_state cs on cs.inventory_item_id = ii.id
    where v.organization_id = target_organization_id
      and v.is_active
    group by v.id, v.product_id, v.current_price, ii.tracked, ii.current_unit_cost
  ),
  var_agg as (
    select
      product_id,
      sum(available) filter (where tracked) as stock_available,
      count(*) filter (where tracked) as tracked_variants,
      count(*) as variants_total,
      count(*) filter (where tracked and available <= 0) as variants_out,
      count(*) filter (where tracked and available between 1 and 5) as variants_low,
      count(*) filter (where current_unit_cost is null) as variants_without_cost,
      min(current_price) as price_min,
      max(current_price) as price_max
    from var_stock
    group by product_id
  ),
  sales as (
    select
      item.product_id,
      coalesce(sum(item.quantity_original), 0)::bigint as units_ordered,
      coalesce(sum(item.refunded_quantity), 0)::bigint as units_refunded,
      count(distinct orders.id)::bigint as orders_count,
      max(coalesce(orders.processed_at, orders.external_created_at)) as last_order_at,
      count(*)::bigint as order_lines,
      count(*) filter (where ii.current_unit_cost is null)::bigint as lines_missing_cost,
      count(*) filter (where item.net_revenue is null)::bigint as lines_missing_net,
      sum(item.net_revenue) as net_revenue,
      sum(coalesce(item.net_quantity, item.quantity_current) * ii.current_unit_cost) as cogs
    from public.shopify_order_items item
    join public.shopify_order_facts orders
      on orders.id = item.order_id
     and orders.organization_id = item.organization_id
    join prods on prods.id = item.product_id
    left join public.shopify_inventory_items ii on ii.variant_id = item.variant_id
    where orders.organization_id = target_organization_id
      and orders.store_id = any(target_store_ids)
      and orders.is_test_order = false
      and orders.cancelled_at is null
      and coalesce(orders.processed_at, orders.external_created_at) >= target_period_start
      and coalesce(orders.processed_at, orders.external_created_at) < target_period_end
    group by item.product_id
  )
  select
    prods.id,
    coalesce(sales.units_ordered, 0),
    coalesce(sales.units_refunded, 0),
    coalesce(sales.orders_count, 0),
    sales.last_order_at,
    var_agg.stock_available::bigint,
    coalesce(var_agg.tracked_variants, 0),
    coalesce(var_agg.variants_total, 0),
    coalesce(var_agg.variants_out, 0),
    coalesce(var_agg.variants_low, 0),
    coalesce(var_agg.variants_without_cost, 0),
    var_agg.price_min,
    var_agg.price_max,
    coalesce(sales.order_lines, 0),
    coalesce(sales.lines_missing_cost, 0),
    coalesce(sales.lines_missing_net, 0),
    sales.net_revenue,
    sales.cogs
  from prods
  left join var_agg on var_agg.product_id = prods.id
  left join sales on sales.product_id = prods.id;
$$;

revoke all on function public.shopify_catalog_product_metrics(uuid, uuid[], uuid[], timestamptz, timestamptz) from public, anon;
grant execute on function public.shopify_catalog_product_metrics(uuid, uuid[], uuid[], timestamptz, timestamptz) to authenticated, service_role;
comment on function public.shopify_catalog_product_metrics(uuid, uuid[], uuid[], timestamptz, timestamptz) is
  'Ventas (unidades), stock, cobertura de costes e importes netos por producto en un periodo. El margen solo es fiable cuando lines_missing_cost y lines_missing_net son 0; los pedidos son los sincronizados, no todo el historial de Shopify.';

-- ---------------------------------------------------------------------------
-- 2. Ranking paginado con busqueda, filtro y orden
-- ---------------------------------------------------------------------------
drop function if exists public.shopify_catalog_product_ranking(uuid, uuid[], text, text, text, text, timestamptz, timestamptz, integer, integer);

create function public.shopify_catalog_product_ranking(
  target_organization_id uuid,
  target_store_ids uuid[],
  search_term text,
  target_status text,
  target_filter text,
  target_sort text,
  target_period_start timestamptz,
  target_period_end timestamptz,
  page_size integer,
  page_offset integer
)
returns table (
  product_id uuid,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select p.id, p.title, p.status, p.external_updated_at
    from public.shopify_products p
    where p.organization_id = target_organization_id
      and p.store_id = any(target_store_ids)
      and case
            when coalesce(target_status, '') = '' then p.status is distinct from 'DELETED'
            else p.status = target_status
          end
      and (
        coalesce(search_term, '') = ''
        or p.title ilike '%' || search_term || '%'
        or p.handle ilike '%' || search_term || '%'
        or p.vendor ilike '%' || search_term || '%'
        or p.product_type ilike '%' || search_term || '%'
        or exists (
          select 1
          from public.shopify_variants v
          join public.shopify_inventory_items ii on ii.variant_id = v.id
          where v.product_id = p.id
            and ii.sku ilike '%' || search_term || '%'
        )
      )
  ),
  m as (
    select * from public.shopify_catalog_product_metrics(
      target_organization_id, target_store_ids, null, target_period_start, target_period_end
    )
  ),
  filtered as (
    select
      base.id,
      base.title,
      base.external_updated_at,
      m.units_ordered,
      m.stock_available,
      case
        when m.order_lines > 0 and m.lines_missing_cost = 0 and m.lines_missing_net = 0 and coalesce(m.net_revenue, 0) > 0
          then (m.net_revenue - coalesce(m.cogs, 0)) / m.net_revenue
      end as margin
    from base
    join m on m.product_id = base.id
    where case coalesce(target_filter, '')
      when 'out' then m.tracked_variants > 0 and coalesce(m.stock_available, 0) <= 0
      when 'low' then m.stock_available between 1 and 5
      when 'no_cost' then m.variants_without_cost > 0
      when 'no_sales' then base.status = 'ACTIVE' and m.units_ordered = 0
      else true
    end
  )
  select
    filtered.id,
    count(*) over ()
  from filtered
  order by
    case when target_sort = 'sales' then filtered.units_ordered end desc nulls last,
    case when target_sort = 'stock' then filtered.stock_available end asc nulls last,
    case when target_sort = 'margin' then filtered.margin end asc nulls last,
    case when target_sort = 'updated' then filtered.external_updated_at end desc nulls last,
    filtered.title asc,
    filtered.id asc
  limit greatest(page_size, 1)
  offset greatest(page_offset, 0);
$$;

revoke all on function public.shopify_catalog_product_ranking(uuid, uuid[], text, text, text, text, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.shopify_catalog_product_ranking(uuid, uuid[], text, text, text, text, timestamptz, timestamptz, integer, integer) to authenticated, service_role;
comment on function public.shopify_catalog_product_ranking(uuid, uuid[], text, text, text, text, timestamptz, timestamptz, integer, integer) is
  'Pagina de ids de producto ya filtrada (out, low, no_cost, no_sales) y ordenada (sales, stock, margin, updated, name), con el total antes de paginar.';

-- ---------------------------------------------------------------------------
-- 3. Resumen del catalogo
-- ---------------------------------------------------------------------------
drop function if exists public.shopify_catalog_summary(uuid, uuid[], timestamptz, timestamptz);

create function public.shopify_catalog_summary(
  target_organization_id uuid,
  target_store_ids uuid[],
  target_period_start timestamptz,
  target_period_end timestamptz
)
returns table (
  total bigint,
  active bigint,
  draft bigint,
  archived bigint,
  out_of_stock bigint,
  low_stock bigint,
  without_cost bigint,
  without_sales bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with m as (
    select * from public.shopify_catalog_product_metrics(
      target_organization_id, target_store_ids, null, target_period_start, target_period_end
    )
  )
  select
    count(*) filter (where p.status is distinct from 'DELETED'),
    count(*) filter (where p.status = 'ACTIVE'),
    count(*) filter (where p.status = 'DRAFT'),
    count(*) filter (where p.status = 'ARCHIVED'),
    count(*) filter (where p.status = 'ACTIVE' and m.tracked_variants > 0 and coalesce(m.stock_available, 0) <= 0),
    count(*) filter (where p.status = 'ACTIVE' and m.stock_available between 1 and 5),
    count(*) filter (where p.status = 'ACTIVE' and m.variants_without_cost > 0),
    count(*) filter (where p.status = 'ACTIVE' and m.units_ordered = 0)
  from public.shopify_products p
  join m on m.product_id = p.id
  where p.organization_id = target_organization_id
    and p.store_id = any(target_store_ids);
$$;

revoke all on function public.shopify_catalog_summary(uuid, uuid[], timestamptz, timestamptz) from public, anon;
grant execute on function public.shopify_catalog_summary(uuid, uuid[], timestamptz, timestamptz) to authenticated, service_role;
comment on function public.shopify_catalog_summary(uuid, uuid[], timestamptz, timestamptz) is
  'Contadores del catalogo: totales por estado y, sobre los activos, sin stock, stock bajo (5 o menos), sin coste y sin ventas en el periodo.';

-- ---------------------------------------------------------------------------
-- 4. Serie semanal de unidades
-- ---------------------------------------------------------------------------
drop function if exists public.shopify_catalog_product_weekly(uuid, uuid[], uuid[], timestamptz, integer);

create function public.shopify_catalog_product_weekly(
  target_organization_id uuid,
  target_store_ids uuid[],
  target_product_ids uuid[],
  target_period_end timestamptz,
  weeks integer
)
returns table (
  product_id uuid,
  week_start date,
  units_ordered bigint,
  units_refunded bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    item.product_id,
    date_trunc('week', coalesce(orders.processed_at, orders.external_created_at) at time zone 'UTC')::date,
    coalesce(sum(item.quantity_original), 0)::bigint,
    coalesce(sum(item.refunded_quantity), 0)::bigint
  from public.shopify_order_items item
  join public.shopify_order_facts orders
    on orders.id = item.order_id
   and orders.organization_id = item.organization_id
  where orders.organization_id = target_organization_id
    and orders.store_id = any(target_store_ids)
    and item.product_id = any(target_product_ids)
    and orders.is_test_order = false
    and orders.cancelled_at is null
    and coalesce(orders.processed_at, orders.external_created_at) >= target_period_end - make_interval(weeks => least(greatest(weeks, 1), 52))
    and coalesce(orders.processed_at, orders.external_created_at) < target_period_end
  group by 1, 2;
$$;

revoke all on function public.shopify_catalog_product_weekly(uuid, uuid[], uuid[], timestamptz, integer) from public, anon;
grant execute on function public.shopify_catalog_product_weekly(uuid, uuid[], uuid[], timestamptz, integer) to authenticated, service_role;
comment on function public.shopify_catalog_product_weekly(uuid, uuid[], uuid[], timestamptz, integer) is
  'Unidades pedidas y reembolsadas por semana (lunes UTC) y producto en las ultimas N semanas. Las semanas sin ventas no devuelven fila.';

-- ---------------------------------------------------------------------------
-- 5. Compras conjuntas
-- ---------------------------------------------------------------------------
drop function if exists public.shopify_catalog_product_copurchase(uuid, uuid, uuid, timestamptz, timestamptz, integer);

create function public.shopify_catalog_product_copurchase(
  target_organization_id uuid,
  target_store_id uuid,
  target_product_id uuid,
  target_period_start timestamptz,
  target_period_end timestamptz,
  max_rows integer
)
returns table (
  other_product_id uuid,
  other_title text,
  orders_together bigint,
  share numeric,
  product_orders bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with own as (
    select distinct orders.id as order_id
    from public.shopify_order_items item
    join public.shopify_order_facts orders
      on orders.id = item.order_id
     and orders.organization_id = item.organization_id
    where orders.organization_id = target_organization_id
      and orders.store_id = target_store_id
      and item.product_id = target_product_id
      and orders.is_test_order = false
      and orders.cancelled_at is null
      and coalesce(orders.processed_at, orders.external_created_at) >= target_period_start
      and coalesce(orders.processed_at, orders.external_created_at) < target_period_end
  ),
  total as (select count(*)::bigint as n from own)
  select
    other.product_id,
    product.title::text,
    count(distinct other.order_id)::bigint,
    (count(distinct other.order_id)::numeric / nullif((select n from total), 0)),
    (select n from total)
  from own
  join public.shopify_order_items other
    on other.order_id = own.order_id
   and other.organization_id = target_organization_id
   and other.product_id is not null
   and other.product_id <> target_product_id
  join public.shopify_products product on product.id = other.product_id
  group by other.product_id, product.title
  order by 3 desc, 2 asc
  limit greatest(max_rows, 1);
$$;

revoke all on function public.shopify_catalog_product_copurchase(uuid, uuid, uuid, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.shopify_catalog_product_copurchase(uuid, uuid, uuid, timestamptz, timestamptz, integer) to authenticated, service_role;
comment on function public.shopify_catalog_product_copurchase(uuid, uuid, uuid, timestamptz, timestamptz, integer) is
  'Productos que aparecen en los mismos pedidos que el indicado (pedidos sincronizados del periodo), con el porcentaje de sus pedidos en que coinciden.';
