-- DB-05e: Shopify module performance pass.
--
-- 1) shopify_order_facts had no index matching the predicate used by the
--    sales metrics functions (organization_id + coalesce(processed_at,
--    external_created_at) + is_test_order/cancelled_at filters), forcing a
--    full table scan on every dashboard load as order history grows.
--
-- 2) shopify_inventory_level_snapshots is append-only: every full sync AND
--    every inventory_levels/update webhook inserted a brand new row, so the
--    table grows unbounded (potentially thousands of rows per day per
--    store) even though only the *latest* row per (inventory_item,
--    location) is ever read. shopify_inventory_current_levels then had to
--    DISTINCT ON the entire history on every stock query, getting slower
--    over time. shopify_inventory_current_state replaces that with a single
--    upserted row per SKU/location - O(1) writes and reads regardless of
--    how long the store has been syncing.

create index if not exists shopify_order_facts_org_processed_idx
on public.shopify_order_facts (organization_id, coalesce(processed_at, external_created_at))
where is_test_order = false and cancelled_at is null;

create table public.shopify_inventory_current_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inventory_item_id uuid not null references public.shopify_inventory_items (id) on delete cascade,
  location_id uuid not null references public.shopify_locations (id) on delete cascade,
  external_inventory_level_id varchar(255),
  available_quantity integer,
  on_hand_quantity integer,
  committed_quantity integer,
  incoming_quantity integer,
  quantities_data jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint shopify_inventory_current_state_unique unique (inventory_item_id, location_id)
);

create index shopify_inventory_current_state_organization_id_idx
on public.shopify_inventory_current_state (organization_id);

alter table public.shopify_inventory_current_state enable row level security;

create policy "shopify_inventory_current_state_select_authorized"
on public.shopify_inventory_current_state
for select
to authenticated
using (private.can_access_org(organization_id));

grant select on public.shopify_inventory_current_state to authenticated;

create trigger set_shopify_inventory_current_state_updated_at
before update on public.shopify_inventory_current_state
for each row execute function private.set_updated_at();

insert into public.shopify_inventory_current_state (
  organization_id, inventory_item_id, location_id, external_inventory_level_id,
  available_quantity, on_hand_quantity, committed_quantity, incoming_quantity,
  quantities_data, is_active, updated_at
)
select
  organization_id, inventory_item_id, location_id, external_inventory_level_id,
  available_quantity, on_hand_quantity, committed_quantity, incoming_quantity,
  quantities_data, is_active, captured_at
from public.shopify_inventory_current_levels
on conflict (inventory_item_id, location_id) do nothing;

create or replace function public.shopify_stock_summary(
  target_organization_id uuid,
  low_stock_threshold integer default 5
)
returns table (
  tracked_items bigint,
  total_available bigint,
  low_stock_items bigint,
  out_of_stock_items bigint
)
language sql
stable
as $$
  select
    count(*) as tracked_items,
    coalesce(sum(available_quantity), 0) as total_available,
    count(*) filter (where available_quantity is not null and available_quantity > 0 and available_quantity <= low_stock_threshold) as low_stock_items,
    count(*) filter (where coalesce(available_quantity, 0) <= 0) as out_of_stock_items
  from public.shopify_inventory_current_state
  where organization_id = target_organization_id
    and is_active = true;
$$;

comment on table public.shopify_inventory_current_state is 'Estado de stock actual por item+location (upsert), reemplaza el uso de shopify_inventory_level_snapshots para lecturas de "stock ahora mismo".';
