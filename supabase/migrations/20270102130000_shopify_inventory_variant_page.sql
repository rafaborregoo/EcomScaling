-- Paginated inventory view at the actionable variant + location level.
-- Missing inventory snapshots remain NULL; they must never be interpreted as zero stock.
drop function if exists public.shopify_catalog_inventory_page(uuid, uuid[], text, text, integer, integer);
create or replace function public.shopify_catalog_inventory_page(
  target_organization_id uuid,
  target_store_ids uuid[],
  search_term text default '',
  target_filter text default '',
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  product_id uuid,
  store_id uuid,
  product_title text,
  product_status text,
  variant_id uuid,
  variant_title text,
  variant_position integer,
  inventory_item_id uuid,
  sku text,
  tracked boolean,
  location_id uuid,
  location_name text,
  available_quantity integer,
  on_hand_quantity integer,
  committed_quantity integer,
  incoming_quantity integer,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with eligible as (
    select
      p.id as product_id,
      p.store_id,
      p.title::text as product_title,
      p.status::text as product_status,
      v.id as variant_id,
      v.title::text as variant_title,
      v.position as variant_position,
      ii.id as inventory_item_id,
      ii.sku::text as sku,
      coalesce(ii.tracked, false) as tracked,
      loc.id as location_id,
      loc.name::text as location_name,
      state.available_quantity,
      state.on_hand_quantity,
      state.committed_quantity,
      state.incoming_quantity,
      state.updated_at
    from public.shopify_products p
    join public.shopify_variants v
      on v.product_id = p.id and v.organization_id = p.organization_id and v.is_active = true
    left join public.shopify_inventory_items ii
      on ii.variant_id = v.id and ii.organization_id = p.organization_id
    left join public.shopify_inventory_current_state state
      on state.inventory_item_id = ii.id and state.organization_id = p.organization_id and state.is_active = true
    left join public.shopify_locations loc
      on loc.id = state.location_id and loc.organization_id = p.organization_id and loc.store_id = p.store_id
    where p.organization_id = target_organization_id
      and p.store_id = any(target_store_ids)
      and p.status = 'ACTIVE'
      and (
        coalesce(search_term, '') = ''
        or p.title ilike '%' || search_term || '%'
        or coalesce(v.title, '') ilike '%' || search_term || '%'
        or coalesce(ii.sku, '') ilike '%' || search_term || '%'
      )
  ), filtered as (
    select *
    from eligible e
    where case coalesce(target_filter, '')
      when 'out' then e.tracked and e.available_quantity is not null and e.available_quantity <= 0
      when 'low' then e.tracked and e.available_quantity > 0 and e.available_quantity <= 5
      when 'untracked' then not e.tracked
      else true
    end
  )
  select
    f.product_id,
    f.store_id,
    f.product_title,
    f.product_status,
    f.variant_id,
    f.variant_title,
    f.variant_position,
    f.inventory_item_id,
    f.sku,
    f.tracked,
    f.location_id,
    f.location_name,
    f.available_quantity,
    f.on_hand_quantity,
    f.committed_quantity,
    f.incoming_quantity,
    f.updated_at,
    count(*) over () as total_count
  from filtered f
  order by
    case when f.tracked and f.available_quantity <= 0 then 0
         when f.tracked and f.available_quantity <= 5 then 1
         when not f.tracked or f.available_quantity is null then 2
         else 3 end,
    f.available_quantity asc nulls first,
    f.product_title asc,
    f.variant_position asc nulls last,
    f.location_name asc nulls last
  limit greatest(1, least(coalesce(page_size, 50), 100))
  offset greatest(0, coalesce(page_offset, 0));
$$;

revoke all on function public.shopify_catalog_inventory_page(uuid, uuid[], text, text, integer, integer) from public, anon;
grant execute on function public.shopify_catalog_inventory_page(uuid, uuid[], text, text, integer, integer) to authenticated, service_role;

comment on function public.shopify_catalog_inventory_page(uuid, uuid[], text, text, integer, integer) is
  'Lista paginada de stock Shopify por variante y ubicación; mantiene NULL cuando no hay una lectura de inventario.';
