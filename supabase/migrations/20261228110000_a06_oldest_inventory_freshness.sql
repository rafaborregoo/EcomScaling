-- Cambia el tipo de retorno: se borra antes de recrear (idempotente, CLAUDE.md).
drop function if exists public.shopify_stock_risk_products_a06(uuid, timestamptz, timestamptz, uuid);

create or replace function public.shopify_stock_risk_products_a06(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  product_id uuid,
  title varchar,
  store_id uuid,
  sku_list text[],
  available_quantity bigint,
  quantity_sold_period bigint,
  selling_days bigint,
  order_count bigint,
  inventory_status text,
  active_variant_count bigint,
  mapped_variant_count bigint,
  tracked_variant_count bigint,
  synced_variant_count bigint,
  latest_inventory_sync_at timestamptz,
  total_eligible bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with sold as (
    select
      oi.product_id,
      sum(oi.quantity_current)::bigint as quantity_sold,
      count(distinct coalesce(o.processed_at, o.external_created_at)::date)::bigint as selling_days,
      count(distinct o.id)::bigint as order_count
    from public.shopify_order_items oi
    join public.shopify_order_facts o on o.id = oi.order_id and o.organization_id = oi.organization_id
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
      count(distinct v.id) filter (where v.is_active)::bigint as active_variants,
      count(distinct ii.variant_id)::bigint as mapped_variants,
      count(distinct ii.variant_id) filter (where ii.tracked)::bigint as tracked_variants,
      count(distinct ii.variant_id) filter (where ii.tracked and s.id is not null)::bigint as synced_variants,
      count(distinct ii.variant_id) filter (where ii.tracked and s.available_quantity is not null)::bigint as known_variants,
      sum(s.available_quantity) filter (where ii.tracked)::bigint as summed_available,
      min(s.updated_at) filter (where ii.tracked and s.id is not null) as latest_sync,
      array_agg(distinct nullif(ii.sku, '') order by nullif(ii.sku, '')) filter (where v.is_active and nullif(ii.sku, '') is not null) as skus
    from public.shopify_products p
    left join public.shopify_variants v on v.product_id = p.id and v.organization_id = p.organization_id and v.is_active
    left join public.shopify_inventory_items ii on ii.variant_id = v.id and ii.organization_id = p.organization_id
    left join public.shopify_inventory_current_state s on s.inventory_item_id = ii.id and s.organization_id = p.organization_id and s.is_active
    where p.organization_id = target_organization_id
      and p.status = 'ACTIVE'
      and (target_store_id is null or p.store_id = target_store_id)
      and exists (
        select 1 from public.shopify_stores st
        where st.id = p.store_id and st.organization_id = p.organization_id and st.is_active
          and (target_store_id is null or st.id = target_store_id)
      )
    group by p.id
  ), eligible as (
    select
      p.id as product_id,
      p.title,
      p.store_id,
      coalesce(i.skus, array[]::text[]) as sku_list,
      case when coalesce(i.active_variants, 0) > 0
             and i.active_variants = i.mapped_variants
             and i.active_variants = i.tracked_variants
             and i.active_variants = i.synced_variants
             and i.active_variants = i.known_variants
           then coalesce(i.summed_available, 0)::bigint else null end as available_quantity,
      sold.quantity_sold,
      sold.selling_days,
      sold.order_count,
      case
        when coalesce(i.active_variants, 0) = 0 then 'unmatched_variant'
        when coalesce(i.mapped_variants, 0) < i.active_variants then 'inventory_item_unmatched'
        when coalesce(i.tracked_variants, 0) < i.active_variants then 'inventory_unmanaged'
        when coalesce(i.synced_variants, 0) < i.active_variants then 'partial_sync'
        when coalesce(i.known_variants, 0) < i.active_variants then 'quantity_unknown'
        else 'tracked_current'
      end as inventory_status,
      coalesce(i.active_variants, 0)::bigint as active_variant_count,
      coalesce(i.mapped_variants, 0)::bigint as mapped_variant_count,
      coalesce(i.tracked_variants, 0)::bigint as tracked_variant_count,
      coalesce(i.synced_variants, 0)::bigint as synced_variant_count,
      i.latest_sync as latest_inventory_sync_at
    from sold
    join public.shopify_products p on p.id = sold.product_id and p.organization_id = target_organization_id and p.status = 'ACTIVE'
    join public.shopify_stores st on st.id = p.store_id and st.organization_id = p.organization_id and st.is_active
    left join inventory i on i.product_id = p.id
    where target_store_id is null or p.store_id = target_store_id
  ), ranked as (
    select e.*, count(*) over ()::bigint as total_eligible,
      case when e.inventory_status = 'tracked_current' and e.quantity_sold > 0
        then e.available_quantity / (e.quantity_sold::numeric / greatest(1, extract(epoch from (period_end - period_start)) / 86400))
        else null end as estimated_cover_days
    from eligible e
  )
  select r.product_id, r.title, r.store_id, r.sku_list, r.available_quantity,
    r.quantity_sold, r.selling_days, r.order_count, r.inventory_status,
    r.active_variant_count, r.mapped_variant_count, r.tracked_variant_count,
    r.synced_variant_count, r.latest_inventory_sync_at, r.total_eligible
  from ranked r
  order by
    (r.inventory_status = 'tracked_current') desc,
    r.estimated_cover_days asc nulls last,
    r.quantity_sold desc,
    r.available_quantity asc nulls last,
    r.product_id
  limit 100;
$$;

comment on function public.shopify_stock_risk_products_a06(uuid, timestamptz, timestamptz, uuid) is
  'A06-only active-product risk sample. latest_inventory_sync_at represents the oldest included inventory record so freshness gates fail closed when any active variant/location is stale.';

revoke all on function public.shopify_stock_risk_products_a06(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.shopify_stock_risk_products_a06(uuid, timestamptz, timestamptz, uuid) to service_role;
