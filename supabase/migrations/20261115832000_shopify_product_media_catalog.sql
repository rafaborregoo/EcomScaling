-- Product media is scoped to both its organization and its Shopify store.
-- Composite foreign keys prevent accidental cross-store associations even
-- when a service-role sync path is used.

do $scope_keys$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shopify_stores'::regclass
      and conname = 'shopify_stores_organization_id_id_key'
  ) then
    alter table public.shopify_stores
      add constraint shopify_stores_organization_id_id_key
      unique (organization_id, id);
  elsif not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shopify_stores'::regclass
      and conname = 'shopify_stores_organization_id_id_key'
      and pg_get_constraintdef(oid) = 'UNIQUE (organization_id, id)'
  ) then
    raise exception 'shopify_stores_organization_id_id_key has an unexpected definition';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shopify_products'::regclass
      and conname = 'shopify_products_organization_store_id_key'
  ) then
    alter table public.shopify_products
      add constraint shopify_products_organization_store_id_key
      unique (organization_id, store_id, id);
  elsif not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shopify_products'::regclass
      and conname = 'shopify_products_organization_store_id_key'
      and pg_get_constraintdef(oid) = 'UNIQUE (organization_id, store_id, id)'
  ) then
    raise exception 'shopify_products_organization_store_id_key has an unexpected definition';
  end if;
end
$scope_keys$;

alter table public.shopify_variants
  add column if not exists external_image_id varchar(255),
  add column if not exists store_id uuid references public.shopify_stores (id) on delete cascade;

-- Store IDs are persisted directly on variants and inventory items so every
-- external-ID lookup can stay inside the connection that supplied the event.
update public.shopify_variants variant
set store_id = product.store_id
from public.shopify_products product
where product.id = variant.product_id
  and variant.store_id is null;

alter table public.shopify_variants
  alter column store_id set not null;

create index if not exists shopify_variants_store_external_idx
  on public.shopify_variants (store_id, external_variant_id);

do $variant_scope_key$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shopify_variants'::regclass
      and conname = 'shopify_variants_organization_store_id_key'
  ) then
    alter table public.shopify_variants
      add constraint shopify_variants_organization_store_id_key
      unique (organization_id, store_id, id);
  elsif not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shopify_variants'::regclass
      and conname = 'shopify_variants_organization_store_id_key'
      and pg_get_constraintdef(oid) = 'UNIQUE (organization_id, store_id, id)'
  ) then
    raise exception 'shopify_variants_organization_store_id_key has an unexpected definition';
  end if;
end
$variant_scope_key$;

alter table public.shopify_inventory_items
  add column if not exists store_id uuid references public.shopify_stores (id) on delete cascade;

update public.shopify_inventory_items item
set store_id = variant.store_id
from public.shopify_variants variant
where variant.id = item.variant_id
  and item.store_id is null;

alter table public.shopify_inventory_items
  alter column store_id set not null;

alter table public.shopify_inventory_items
  drop constraint if exists shopify_inventory_items_external_inventory_item_id_key,
  drop constraint if exists shopify_inventory_items_store_external_unique,
  add constraint shopify_inventory_items_store_external_unique
    unique (store_id, external_inventory_item_id);

create index if not exists shopify_inventory_items_store_id_idx
  on public.shopify_inventory_items (store_id);

alter table public.shopify_order_discount_applications
  add column if not exists store_id uuid references public.shopify_stores (id) on delete cascade;

alter table public.shopify_order_discount_applications
  add column if not exists amount_coverage text not null default 'unavailable';

alter table public.shopify_order_discount_applications
  drop constraint if exists shopify_order_discount_applications_amount_coverage_check,
  add constraint shopify_order_discount_applications_amount_coverage_check
    check (amount_coverage in ('complete', 'partial', 'unavailable'));

update public.shopify_order_discount_applications application
set store_id = orders.store_id
from public.shopify_order_facts orders
where orders.id = application.order_id
  and application.store_id is null;

alter table public.shopify_order_discount_applications
  alter column store_id set not null;

create index if not exists shopify_order_discount_applications_store_code_idx
  on public.shopify_order_discount_applications (store_id, code)
  where code is not null;

alter table public.shopify_discounts
  add column if not exists codes text[] not null default '{}',
  add column if not exists codes_coverage text not null default 'unknown',
  add column if not exists configuration_coverage text not null default 'unknown',
  add column if not exists summary text,
  add column if not exists rule_data jsonb,
  add column if not exists uses_per_order_limit integer;

alter table public.shopify_discounts
  drop constraint if exists shopify_discounts_codes_coverage_check,
  add constraint shopify_discounts_codes_coverage_check
    check (codes_coverage in ('unknown', 'complete', 'partial')),
  drop constraint if exists shopify_discounts_configuration_coverage_check,
  add constraint shopify_discounts_configuration_coverage_check
    check (configuration_coverage in ('unknown', 'summary', 'partial', 'app_managed')),
  drop constraint if exists shopify_discounts_uses_per_order_limit_check,
  add constraint shopify_discounts_uses_per_order_limit_check
    check (uses_per_order_limit is null or uses_per_order_limit > 0);

update public.shopify_discounts
set codes = array[code]
where code is not null and cardinality(codes) = 0;

do $discount_scope_key$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shopify_discounts'::regclass
      and conname = 'shopify_discounts_organization_store_id_key'
  ) then
    alter table public.shopify_discounts
      add constraint shopify_discounts_organization_store_id_key
      unique (organization_id, store_id, id);
  elsif not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shopify_discounts'::regclass
      and conname = 'shopify_discounts_organization_store_id_key'
      and pg_get_constraintdef(oid) = 'UNIQUE (organization_id, store_id, id)'
  ) then
    raise exception 'shopify_discounts_organization_store_id_key has an unexpected definition';
  end if;
end
$discount_scope_key$;

create table if not exists public.shopify_discount_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  store_id uuid not null,
  discount_id uuid not null,
  rule_side varchar(16) not null,
  target_type varchar(16) not null,
  external_target_id varchar(255) not null,
  target_title varchar(255),
  parent_external_product_id varchar(255),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_discount_targets_discount_fkey
    foreign key (organization_id, store_id, discount_id)
    references public.shopify_discounts (organization_id, store_id, id)
    on delete cascade,
  constraint shopify_discount_targets_side_check
    check (rule_side in ('buys', 'gets')),
  constraint shopify_discount_targets_type_check
    check (target_type in ('product', 'variant', 'collection', 'all')),
  constraint shopify_discount_targets_external_unique
    unique (store_id, discount_id, rule_side, target_type, external_target_id)
);

create index if not exists shopify_discount_targets_external_idx
  on public.shopify_discount_targets (organization_id, store_id, target_type, external_target_id)
  where is_active;
create index if not exists shopify_discount_targets_discount_idx
  on public.shopify_discount_targets (organization_id, store_id, discount_id, rule_side)
  where is_active;

alter table public.shopify_discount_targets enable row level security;
drop policy if exists shopify_discount_targets_select_authorized
  on public.shopify_discount_targets;
create policy shopify_discount_targets_select_authorized
  on public.shopify_discount_targets
  for select to authenticated
  using (private.can_access_org(organization_id));
revoke all on public.shopify_discount_targets from anon, authenticated;
grant select on public.shopify_discount_targets to authenticated;
grant select, insert, update, delete on public.shopify_discount_targets to service_role;

create table if not exists public.shopify_discount_target_sync_coverage (
  organization_id uuid not null,
  store_id uuid not null,
  rule_side varchar(16) not null,
  status varchar(20) not null,
  discounts_scanned integer not null default 0,
  targets_scanned integer not null default 0,
  last_synced_at timestamptz not null,
  error_code varchar(120),
  updated_at timestamptz not null default now(),
  primary key (store_id, rule_side),
  constraint shopify_discount_target_coverage_store_fkey
    foreign key (organization_id, store_id)
    references public.shopify_stores (organization_id, id)
    on delete cascade,
  constraint shopify_discount_target_coverage_side_check
    check (rule_side in ('buys', 'gets')),
  constraint shopify_discount_target_coverage_status_check
    check (status in ('complete', 'partial', 'failed')),
  constraint shopify_discount_target_coverage_counts_check
    check (discounts_scanned >= 0 and targets_scanned >= 0)
);

alter table public.shopify_discount_target_sync_coverage enable row level security;
drop policy if exists shopify_discount_target_sync_coverage_select_authorized
  on public.shopify_discount_target_sync_coverage;
create policy shopify_discount_target_sync_coverage_select_authorized
  on public.shopify_discount_target_sync_coverage
  for select to authenticated
  using (private.can_access_org(organization_id));
revoke all on public.shopify_discount_target_sync_coverage from anon, authenticated;
grant select on public.shopify_discount_target_sync_coverage to authenticated;
grant select, insert, update, delete on public.shopify_discount_target_sync_coverage to service_role;

create table if not exists public.shopify_product_bundle_components (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  store_id uuid not null,
  parent_variant_id uuid not null,
  component_variant_id uuid,
  external_parent_variant_id varchar(255) not null,
  external_component_variant_id varchar(255) not null,
  component_quantity integer not null,
  verification_status varchar(40) not null,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_product_bundle_components_store_fkey
    foreign key (organization_id, store_id)
    references public.shopify_stores (organization_id, id)
    on delete cascade,
  constraint shopify_product_bundle_components_parent_fkey
    foreign key (organization_id, store_id, parent_variant_id)
    references public.shopify_variants (organization_id, store_id, id)
    on delete cascade,
  constraint shopify_product_bundle_components_component_fkey
    foreign key (organization_id, store_id, component_variant_id)
    references public.shopify_variants (organization_id, store_id, id)
    on delete cascade,
  constraint shopify_product_bundle_components_external_unique
    unique (store_id, external_parent_variant_id, external_component_variant_id),
  constraint shopify_product_bundle_components_quantity_check
    check (component_quantity > 0),
  constraint shopify_product_bundle_components_status_check
    check (verification_status in ('confirmed', 'unresolved_component'))
);

create index if not exists shopify_product_bundle_components_parent_idx
  on public.shopify_product_bundle_components (organization_id, store_id, parent_variant_id)
  where is_active;

create index if not exists shopify_product_bundle_components_component_idx
  on public.shopify_product_bundle_components (organization_id, store_id, component_variant_id)
  where is_active;

create table if not exists public.shopify_bundle_sync_coverage (
  organization_id uuid not null,
  store_id uuid primary key,
  status varchar(20) not null,
  variants_scanned integer not null default 0,
  bundle_variants_count integer not null default 0,
  components_count integer not null default 0,
  unresolved_components_count integer not null default 0,
  last_synced_at timestamptz not null,
  error_code varchar(120),
  updated_at timestamptz not null default now(),
  constraint shopify_bundle_sync_coverage_store_fkey
    foreign key (organization_id, store_id)
    references public.shopify_stores (organization_id, id)
    on delete cascade,
  constraint shopify_bundle_sync_coverage_status_check
    check (status in ('complete', 'partial', 'failed')),
  constraint shopify_bundle_sync_coverage_counts_check
    check (variants_scanned >= 0 and bundle_variants_count >= 0 and components_count >= 0 and unresolved_components_count >= 0)
);

alter table public.shopify_product_bundle_components enable row level security;
drop policy if exists shopify_product_bundle_components_select_authorized
  on public.shopify_product_bundle_components;
create policy shopify_product_bundle_components_select_authorized
  on public.shopify_product_bundle_components
  for select to authenticated
  using (private.can_access_org(organization_id));
revoke all on public.shopify_product_bundle_components from anon, authenticated;
grant select on public.shopify_product_bundle_components to authenticated;
grant select, insert, update, delete on public.shopify_product_bundle_components to service_role;

alter table public.shopify_bundle_sync_coverage enable row level security;
drop policy if exists shopify_bundle_sync_coverage_select_authorized
  on public.shopify_bundle_sync_coverage;
create policy shopify_bundle_sync_coverage_select_authorized
  on public.shopify_bundle_sync_coverage
  for select to authenticated
  using (private.can_access_org(organization_id));
revoke all on public.shopify_bundle_sync_coverage from anon, authenticated;
grant select on public.shopify_bundle_sync_coverage to authenticated;
grant select, insert, update, delete on public.shopify_bundle_sync_coverage to service_role;

create table if not exists public.shopify_product_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  external_media_id varchar(255) not null,
  media_content_type varchar(40) not null,
  source_url text,
  alt_text text,
  width integer,
  height integer,
  position integer not null default 0,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_product_media_store_org_fkey
    foreign key (organization_id, store_id)
    references public.shopify_stores (organization_id, id)
    on delete cascade,
  constraint shopify_product_media_product_scope_fkey
    foreign key (organization_id, store_id, product_id)
    references public.shopify_products (organization_id, store_id, id)
    on delete cascade,
  constraint shopify_product_media_unique_external
    unique (product_id, external_media_id),
  constraint shopify_product_media_dimensions_nonnegative
    check ((width is null or width >= 0) and (height is null or height >= 0))
);

create index if not exists shopify_product_media_catalog_idx
  on public.shopify_product_media (organization_id, store_id, product_id, position)
  where is_active;

alter table public.shopify_product_media enable row level security;

drop policy if exists shopify_product_media_select_authorized
  on public.shopify_product_media;
create policy shopify_product_media_select_authorized
  on public.shopify_product_media
  for select
  to authenticated
  using (private.can_access_org(organization_id));

revoke all on public.shopify_product_media from anon, authenticated;
grant select on public.shopify_product_media to authenticated;
grant select, insert, update, delete on public.shopify_product_media to service_role;

comment on table public.shopify_product_media is
  'Media Shopify por producto y tienda; las imágenes se consumen en miniaturas y fichas.';

drop function if exists public.shopify_product_variant_activity(uuid, uuid, uuid, timestamptz, timestamptz);
drop function if exists public.shopify_product_variant_activity(uuid, uuid, uuid[], timestamptz, timestamptz);
create function public.shopify_product_variant_activity(
  target_organization_id uuid,
  target_store_id uuid,
  target_product_ids uuid[],
  target_period_start timestamptz,
  target_period_end timestamptz
)
returns table (
  product_id uuid,
  variant_id uuid,
  units_ordered bigint,
  units_refunded bigint,
  orders_count bigint,
  last_order_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    item.product_id,
    item.variant_id,
    coalesce(sum(item.quantity_original), 0)::bigint as units_ordered,
    coalesce(sum(item.refunded_quantity), 0)::bigint as units_refunded,
    count(distinct orders.id)::bigint as orders_count,
    max(coalesce(orders.processed_at, orders.external_created_at)) as last_order_at
  from public.shopify_order_items item
  join public.shopify_order_facts orders
    on orders.id = item.order_id
   and orders.organization_id = item.organization_id
  join public.shopify_products product
    on product.id = item.product_id
   and product.organization_id = item.organization_id
  where orders.organization_id = target_organization_id
    and orders.store_id = target_store_id
    and item.product_id = any(target_product_ids)
    and product.store_id = target_store_id
    and orders.is_test_order = false
    and orders.cancelled_at is null
    and coalesce(orders.processed_at, orders.external_created_at) >= target_period_start
    and coalesce(orders.processed_at, orders.external_created_at) < target_period_end
  group by item.product_id, item.variant_id;
$$;

revoke all on function public.shopify_product_variant_activity(uuid, uuid, uuid[], timestamptz, timestamptz) from public, anon;
grant execute on function public.shopify_product_variant_activity(uuid, uuid, uuid[], timestamptz, timestamptz) to authenticated, service_role;
comment on function public.shopify_product_variant_activity(uuid, uuid, uuid[], timestamptz, timestamptz) is
  'Actividad de unidades y cantidades reembolsadas observadas por variante; no devuelve importes monetarios porque los pedidos pueden usar distintas monedas y la cobertura de read_all_orders es limitada.';
