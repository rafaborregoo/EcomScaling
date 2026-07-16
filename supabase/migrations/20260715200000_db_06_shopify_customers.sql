-- DB-06: Shopify customers block. Reference implementation of the
-- integration-module pattern (see ADR-0006): its own sync_scope, upsert
-- in-place (current state, not append-only), no raw PII (mirrors
-- shopify_order_facts.customer_reference_hash - behavioral fields only).

alter table public.integration_sync_runs
  drop constraint integration_sync_runs_sync_scope_check;

alter table public.integration_sync_runs
  add constraint integration_sync_runs_sync_scope_check check (
    sync_scope is null
    or sync_scope in ('catalog', 'inventory', 'orders', 'refunds', 'customers')
  );

create table public.shopify_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_customer_id varchar(255) not null,
  customer_reference_hash varchar(255) not null,
  number_of_orders integer not null default 0,
  amount_spent numeric(14,2) not null default 0,
  currency_code varchar(3),
  state varchar(40),
  tags text[] not null default '{}',
  is_active boolean not null default true,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_customers_unique_external unique (store_id, external_customer_id)
);

create index shopify_customers_organization_id_idx on public.shopify_customers (organization_id);
create index shopify_customers_store_id_idx on public.shopify_customers (store_id);
create index shopify_customers_reference_hash_idx on public.shopify_customers (customer_reference_hash);

alter table public.shopify_customers enable row level security;

create policy "shopify_customers_select_authorized"
on public.shopify_customers
for select
to authenticated
using (private.can_access_org(organization_id));

grant select on public.shopify_customers to authenticated;

create trigger set_shopify_customers_updated_at
before update on public.shopify_customers
for each row execute function private.set_updated_at();

comment on table public.shopify_customers is 'Clientes Shopify sin PII: solo hash de referencia y metricas de comportamiento (pedidos, gasto, estado, tags).';
