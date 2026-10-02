alter table public.shopify_order_items
  add column if not exists bundle_group_coverage text default 'unknown',
  add column if not exists bundle_group_id text,
  add column if not exists bundle_parent_title text,
  add column if not exists bundle_parent_external_product_id text,
  add column if not exists bundle_parent_external_variant_id text,
  add column if not exists bundle_parent_quantity integer;

alter table public.shopify_order_items
  drop constraint if exists shopify_order_items_bundle_group_coverage_check,
  add constraint shopify_order_items_bundle_group_coverage_check
    check (bundle_group_coverage is null or bundle_group_coverage in ('unknown', 'not_bundle', 'partial', 'confirmed')),
  drop constraint if exists shopify_order_items_bundle_group_quantity_check,
  add constraint shopify_order_items_bundle_group_quantity_check
    check (bundle_parent_quantity is null or bundle_parent_quantity > 0),
  drop constraint if exists shopify_order_items_bundle_group_confirmed_check,
  add constraint shopify_order_items_bundle_group_confirmed_check
    check (
      bundle_group_coverage <> 'confirmed'
      or (
        bundle_group_id is not null
        and bundle_parent_title is not null
        and bundle_parent_quantity is not null
      )
    );

create index if not exists shopify_order_items_bundle_parent_idx
  on public.shopify_order_items (
    organization_id,
    bundle_parent_external_product_id,
    order_id
  )
  where bundle_group_coverage = 'confirmed';

comment on column public.shopify_order_items.bundle_group_coverage is
  'Cobertura de agrupacion del pack: desconocida, no-pack, parcial o confirmada por Shopify.';
comment on column public.shopify_order_items.bundle_group_id is
  'ID Shopify LineItemGroup compartido por las lineas componente del mismo pack vendido.';

drop function if exists public.shopify_product_bundle_activity(uuid, uuid, text[], timestamptz, timestamptz);
create function public.shopify_product_bundle_activity(
  target_organization_id uuid,
  target_store_id uuid,
  target_parent_product_ids text[],
  target_period_start timestamptz,
  target_period_end timestamptz
)
returns table (
  parent_product_id text,
  bundle_group_count bigint,
  bundles_sold bigint,
  last_order_at timestamptz,
  unclassified_line_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with eligible_lines as (
    select
      item.order_id,
      item.bundle_group_id,
      item.bundle_group_coverage,
      item.bundle_parent_external_product_id,
      item.bundle_parent_quantity,
      coalesce(orders.processed_at, orders.external_created_at) as order_at
    from public.shopify_order_items item
    join public.shopify_order_facts orders
      on orders.id = item.order_id
     and orders.organization_id = item.organization_id
    where orders.organization_id = target_organization_id
      and orders.store_id = target_store_id
      and orders.is_test_order = false
      and orders.cancelled_at is null
      and coalesce(orders.processed_at, orders.external_created_at) >= target_period_start
      and coalesce(orders.processed_at, orders.external_created_at) < target_period_end
  ), bundle_groups as (
    select
      line.order_id,
      line.bundle_group_id,
      line.bundle_parent_external_product_id,
      max(line.bundle_parent_quantity)::bigint as quantity,
      max(line.order_at) as order_at
    from eligible_lines line
    where line.bundle_group_coverage = 'confirmed'
      and line.bundle_parent_external_product_id = any(target_parent_product_ids)
    group by line.order_id, line.bundle_group_id, line.bundle_parent_external_product_id
  ), bundle_summary as (
    select
      group_line.bundle_parent_external_product_id as parent_product_id,
      count(*)::bigint as bundle_group_count,
      coalesce(sum(group_line.quantity), 0)::bigint as bundles_sold,
      max(group_line.order_at) as last_order_at
    from bundle_groups group_line
    group by group_line.bundle_parent_external_product_id
  ), coverage_summary as (
    select count(*)::bigint as unclassified_line_count
    from eligible_lines
    where bundle_group_coverage is null or bundle_group_coverage in ('unknown', 'partial')
  ), target_products as (
    select distinct unnest(target_parent_product_ids) as parent_product_id
  )
  select
    target.parent_product_id,
    coalesce(summary.bundle_group_count, 0),
    coalesce(summary.bundles_sold, 0),
    summary.last_order_at,
    coverage.unclassified_line_count
  from target_products target
  cross join coverage_summary coverage
  left join bundle_summary summary using (parent_product_id);
$$;

revoke all on function public.shopify_product_bundle_activity(uuid, uuid, text[], timestamptz, timestamptz) from public, anon;
grant execute on function public.shopify_product_bundle_activity(uuid, uuid, text[], timestamptz, timestamptz) to authenticated, service_role;
comment on function public.shopify_product_bundle_activity(uuid, uuid, text[], timestamptz, timestamptz) is
  'Agrupa pedidos por LineItemGroup una vez por pack; informa unidades/grupos observados sin duplicar importes de las lineas componente.';
