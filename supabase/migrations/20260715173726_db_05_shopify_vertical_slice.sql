create table if not exists public.shopify_stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  external_shop_id varchar(255) not null,
  myshopify_domain varchar(255) not null,
  primary_domain varchar(255),
  shop_name varchar(255) not null,
  currency_code varchar(3),
  timezone varchar(100),
  plan_display_name varchar(120),
  weight_unit varchar(30),
  taxes_included boolean,
  is_active boolean not null default true,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_stores_unique_connection unique (connection_id),
  constraint shopify_stores_unique_external_shop unique (external_shop_id),
  constraint shopify_stores_unique_domain unique (myshopify_domain)
);

create table if not exists public.shopify_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_location_id varchar(255) not null,
  name varchar(255) not null,
  is_active boolean not null default true,
  fulfills_online_orders boolean,
  address_data jsonb,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_locations_unique_external unique (store_id, external_location_id)
);

create table if not exists public.shopify_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_product_id varchar(255) not null,
  title varchar(255) not null,
  handle varchar(255),
  vendor varchar(180),
  product_type varchar(180),
  status varchar(50),
  published_at timestamptz,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_products_unique_external unique (store_id, external_product_id)
);

create table if not exists public.shopify_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.shopify_products (id) on delete cascade,
  external_variant_id varchar(255) not null,
  title varchar(255),
  barcode varchar(180),
  current_price numeric(14,2),
  compare_at_price numeric(14,2),
  position int,
  taxable boolean,
  inventory_policy varchar(50),
  is_active boolean not null default true,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_variants_unique_external unique (product_id, external_variant_id)
);

create table if not exists public.shopify_inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  variant_id uuid not null unique references public.shopify_variants (id) on delete cascade,
  external_inventory_item_id varchar(255) not null unique,
  sku varchar(180),
  tracked boolean not null default false,
  requires_shipping boolean not null default true,
  current_unit_cost numeric(14,4),
  cost_currency_code varchar(3),
  country_code_of_origin varchar(2),
  province_code_of_origin varchar(10),
  harmonized_system_code varchar(20),
  measurement_data jsonb,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopify_inventory_level_snapshots (
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
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint shopify_inventory_levels_unique_capture unique (inventory_item_id, location_id, captured_at)
);

create table if not exists public.shopify_order_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_order_id varchar(255) not null,
  order_name varchar(100),
  customer_reference_hash varchar(255),
  financial_status varchar(80),
  fulfillment_status varchar(80),
  source_name varchar(100),
  currency_code varchar(3),
  presentment_currency_code varchar(3),
  gross_sales numeric(14,2) not null default 0,
  discounts numeric(14,2) not null default 0,
  refunds numeric(14,2) not null default 0,
  net_sales numeric(14,2) not null default 0,
  current_subtotal_price numeric(14,2) not null default 0,
  current_shipping_price numeric(14,2) not null default 0,
  current_total_tax numeric(14,2) not null default 0,
  current_total_price numeric(14,2) not null default 0,
  total_items integer not null default 0,
  is_first_customer_order boolean,
  is_test_order boolean not null default false,
  external_created_at timestamptz,
  processed_at timestamptz,
  external_updated_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason varchar(120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_orders_unique_external unique (store_id, external_order_id)
);

create table if not exists public.shopify_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.shopify_order_facts (id) on delete cascade,
  product_id uuid references public.shopify_products (id) on delete set null,
  variant_id uuid references public.shopify_variants (id) on delete set null,
  external_line_item_id varchar(255) not null,
  title varchar(255) not null,
  sku_snapshot varchar(180),
  vendor_snapshot varchar(180),
  quantity_original integer not null default 0,
  quantity_current integer not null default 0,
  unit_price numeric(14,2) not null default 0,
  original_line_total numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  current_line_total numeric(14,2) not null default 0,
  refunded_quantity integer not null default 0,
  refunded_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_order_items_unique_external unique (order_id, external_line_item_id)
);

create table if not exists public.shopify_refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.shopify_order_facts (id) on delete cascade,
  external_refund_id varchar(255) not null,
  total_refunded numeric(14,2) not null default 0,
  currency_code varchar(3),
  external_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_refunds_unique_external unique (order_id, external_refund_id)
);

create table if not exists public.shopify_refund_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  refund_id uuid not null references public.shopify_refunds (id) on delete cascade,
  order_item_id uuid not null references public.shopify_order_items (id) on delete cascade,
  location_id uuid references public.shopify_locations (id) on delete set null,
  external_refund_line_item_id varchar(255),
  quantity integer not null,
  subtotal numeric(14,2) not null default 0,
  total_tax numeric(14,2) not null default 0,
  restock_type varchar(80),
  created_at timestamptz not null default now(),
  constraint shopify_refund_items_unique_external unique (refund_id, external_refund_line_item_id)
);

create table if not exists public.product_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inventory_item_id uuid not null references public.shopify_inventory_items (id) on delete cascade,
  unit_cost numeric(14,4) not null,
  currency_code varchar(3) not null default 'EUR',
  source varchar(40) not null,
  is_override boolean not null default false,
  valid_from date not null,
  valid_until date,
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint product_costs_source_check check (source in ('shopify', 'manual', 'import'))
);

create index if not exists shopify_stores_organization_id_idx on public.shopify_stores (organization_id);
create index if not exists shopify_stores_connection_id_idx on public.shopify_stores (connection_id);
create index if not exists shopify_stores_domain_idx on public.shopify_stores (myshopify_domain);
create index if not exists shopify_locations_organization_id_idx on public.shopify_locations (organization_id);
create index if not exists shopify_locations_store_id_idx on public.shopify_locations (store_id);
create index if not exists shopify_products_organization_id_idx on public.shopify_products (organization_id);
create index if not exists shopify_products_store_id_idx on public.shopify_products (store_id);
create index if not exists shopify_variants_organization_id_idx on public.shopify_variants (organization_id);
create index if not exists shopify_variants_product_id_idx on public.shopify_variants (product_id);
create index if not exists shopify_inventory_items_organization_id_idx on public.shopify_inventory_items (organization_id);
create index if not exists shopify_inventory_items_sku_idx on public.shopify_inventory_items (sku);
create index if not exists shopify_inventory_level_snapshots_organization_id_idx on public.shopify_inventory_level_snapshots (organization_id);
create index if not exists shopify_inventory_level_snapshots_inventory_item_id_idx on public.shopify_inventory_level_snapshots (inventory_item_id);
create index if not exists shopify_inventory_level_snapshots_location_id_idx on public.shopify_inventory_level_snapshots (location_id);
create index if not exists shopify_inventory_level_snapshots_captured_at_idx on public.shopify_inventory_level_snapshots (captured_at);
create index if not exists shopify_order_facts_organization_id_idx on public.shopify_order_facts (organization_id);
create index if not exists shopify_order_facts_store_id_idx on public.shopify_order_facts (store_id);
create index if not exists shopify_order_facts_processed_at_idx on public.shopify_order_facts (processed_at);
create index if not exists shopify_order_items_organization_id_idx on public.shopify_order_items (organization_id);
create index if not exists shopify_order_items_order_id_idx on public.shopify_order_items (order_id);
create index if not exists shopify_order_items_product_id_idx on public.shopify_order_items (product_id);
create index if not exists shopify_order_items_variant_id_idx on public.shopify_order_items (variant_id);
create index if not exists shopify_refunds_organization_id_idx on public.shopify_refunds (organization_id);
create index if not exists shopify_refunds_order_id_idx on public.shopify_refunds (order_id);
create index if not exists shopify_refund_items_organization_id_idx on public.shopify_refund_items (organization_id);
create index if not exists shopify_refund_items_refund_id_idx on public.shopify_refund_items (refund_id);
create index if not exists shopify_refund_items_order_item_id_idx on public.shopify_refund_items (order_item_id);
create index if not exists product_costs_organization_id_idx on public.product_costs (organization_id);
create index if not exists product_costs_inventory_item_id_idx on public.product_costs (inventory_item_id);

drop trigger if exists set_shopify_stores_updated_at on public.shopify_stores;
create trigger set_shopify_stores_updated_at
before update on public.shopify_stores
for each row execute function private.set_updated_at();

drop trigger if exists set_shopify_locations_updated_at on public.shopify_locations;
create trigger set_shopify_locations_updated_at
before update on public.shopify_locations
for each row execute function private.set_updated_at();

drop trigger if exists set_shopify_products_updated_at on public.shopify_products;
create trigger set_shopify_products_updated_at
before update on public.shopify_products
for each row execute function private.set_updated_at();

drop trigger if exists set_shopify_variants_updated_at on public.shopify_variants;
create trigger set_shopify_variants_updated_at
before update on public.shopify_variants
for each row execute function private.set_updated_at();

drop trigger if exists set_shopify_inventory_items_updated_at on public.shopify_inventory_items;
create trigger set_shopify_inventory_items_updated_at
before update on public.shopify_inventory_items
for each row execute function private.set_updated_at();

drop trigger if exists set_shopify_order_facts_updated_at on public.shopify_order_facts;
create trigger set_shopify_order_facts_updated_at
before update on public.shopify_order_facts
for each row execute function private.set_updated_at();

drop trigger if exists set_shopify_order_items_updated_at on public.shopify_order_items;
create trigger set_shopify_order_items_updated_at
before update on public.shopify_order_items
for each row execute function private.set_updated_at();

drop trigger if exists set_shopify_refunds_updated_at on public.shopify_refunds;
create trigger set_shopify_refunds_updated_at
before update on public.shopify_refunds
for each row execute function private.set_updated_at();

drop trigger if exists set_product_costs_updated_at on public.product_costs;
create trigger set_product_costs_updated_at
before update on public.product_costs
for each row execute function private.set_updated_at();

alter table public.shopify_stores enable row level security;
alter table public.shopify_locations enable row level security;
alter table public.shopify_products enable row level security;
alter table public.shopify_variants enable row level security;
alter table public.shopify_inventory_items enable row level security;
alter table public.shopify_inventory_level_snapshots enable row level security;
alter table public.shopify_order_facts enable row level security;
alter table public.shopify_order_items enable row level security;
alter table public.shopify_refunds enable row level security;
alter table public.shopify_refund_items enable row level security;
alter table public.product_costs enable row level security;

drop policy if exists "shopify_stores_select_authorized" on public.shopify_stores;
create policy "shopify_stores_select_authorized" on public.shopify_stores
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_locations_select_authorized" on public.shopify_locations;
create policy "shopify_locations_select_authorized" on public.shopify_locations
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_products_select_authorized" on public.shopify_products;
create policy "shopify_products_select_authorized" on public.shopify_products
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_variants_select_authorized" on public.shopify_variants;
create policy "shopify_variants_select_authorized" on public.shopify_variants
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_inventory_items_select_authorized" on public.shopify_inventory_items;
create policy "shopify_inventory_items_select_authorized" on public.shopify_inventory_items
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_inventory_level_snapshots_select_authorized" on public.shopify_inventory_level_snapshots;
create policy "shopify_inventory_level_snapshots_select_authorized" on public.shopify_inventory_level_snapshots
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_order_facts_select_authorized" on public.shopify_order_facts;
create policy "shopify_order_facts_select_authorized" on public.shopify_order_facts
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_order_items_select_authorized" on public.shopify_order_items;
create policy "shopify_order_items_select_authorized" on public.shopify_order_items
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_refunds_select_authorized" on public.shopify_refunds;
create policy "shopify_refunds_select_authorized" on public.shopify_refunds
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_refund_items_select_authorized" on public.shopify_refund_items;
create policy "shopify_refund_items_select_authorized" on public.shopify_refund_items
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "product_costs_select_authorized" on public.product_costs;
create policy "product_costs_select_authorized" on public.product_costs
for select
to authenticated
using (private.can_access_org(organization_id));

comment on table public.shopify_stores is 'Tienda Shopify conectada a una organizacion.';
comment on table public.shopify_products is 'Productos sincronizados desde Shopify.';
comment on table public.shopify_variants is 'Variantes sincronizadas desde Shopify.';
comment on table public.shopify_inventory_items is 'InventoryItem sincronizado 1:1 con variante.';
comment on table public.shopify_locations is 'Ubicaciones de inventario y fulfillment.';
comment on table public.shopify_inventory_level_snapshots is 'Foto historica de stock por item y location.';
comment on table public.shopify_order_facts is 'Pedido Shopify sincronizado sin PII innecesaria.';
comment on table public.shopify_order_items is 'Linea economica del pedido.';
comment on table public.shopify_refunds is 'Cabecera de reembolso.';
comment on table public.shopify_refund_items is 'Linea concreta del reembolso.';
comment on table public.product_costs is 'Coste por inventory item para margen y beneficio.';

grant select on public.shopify_stores to authenticated;
grant select on public.shopify_locations to authenticated;
grant select on public.shopify_products to authenticated;
grant select on public.shopify_variants to authenticated;
grant select on public.shopify_inventory_items to authenticated;
grant select on public.shopify_inventory_level_snapshots to authenticated;
grant select on public.shopify_order_facts to authenticated;
grant select on public.shopify_order_items to authenticated;
grant select on public.shopify_refunds to authenticated;
grant select on public.shopify_refund_items to authenticated;
grant select on public.product_costs to authenticated;
