-- Operativa de Shopify: envios, cobros y devoluciones.
--
-- Es la mitad que faltaba entera. Lo que hay hoy responde "cuanto vendemos";
-- esto responde "podemos con mas", que es lo primero que se rompe al escalar:
-- el tiempo hasta el envio sube antes que ninguna otra cifra.
--
-- ADR-0006: upsert in-place con unique (store_id, external_id), RLS solo de
-- lectura para authenticated, e indices que calzan con el predicado de fecha
-- que van a usar las metricas.

-- --- Envios ----------------------------------------------------------------

create table if not exists public.shopify_fulfillments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  order_id uuid not null references public.shopify_order_facts (id) on delete cascade,
  location_id uuid references public.shopify_locations (id) on delete set null,
  external_fulfillment_id varchar(255) not null,
  status varchar(60),
  display_status varchar(60),
  -- Los cuatro instantes que permiten medir la promesa contra la realidad.
  -- `estimated_delivery_at` es lo que se le dijo al cliente; `delivered_at`,
  -- lo que paso. La diferencia es la causa de devolucion mas evitable.
  external_created_at timestamptz,
  in_transit_at timestamptz,
  delivered_at timestamptz,
  estimated_delivery_at timestamptz,
  tracking_company varchar(160),
  tracking_numbers text[] not null default '{}',
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_fulfillments_unique_external unique (store_id, external_fulfillment_id)
);

create index if not exists shopify_fulfillments_organization_id_idx on public.shopify_fulfillments (organization_id);
create index if not exists shopify_fulfillments_order_id_idx on public.shopify_fulfillments (order_id);
-- Las metricas de plazo piden siempre una ventana sobre la fecha de envio.
create index if not exists shopify_fulfillments_created_idx on public.shopify_fulfillments (organization_id, external_created_at desc);
-- Solo las entregadas tienen plazo real que medir; el indice parcial evita
-- recorrer los envios en transito en cada calculo.
create index if not exists shopify_fulfillments_delivered_idx on public.shopify_fulfillments (organization_id, delivered_at desc)
  where delivered_at is not null;

-- --- Cobros ----------------------------------------------------------------

create table if not exists public.shopify_order_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  order_id uuid not null references public.shopify_order_facts (id) on delete cascade,
  external_transaction_id varchar(255) not null,
  -- sale, capture, refund, void, authorization.
  kind varchar(40),
  status varchar(40),
  gateway varchar(120),
  payment_method varchar(80),
  amount numeric(14,2) not null default 0,
  currency_code varchar(3),
  -- La comision real de la pasarela. Hoy el beneficio neto la ignora, asi que
  -- todo margen calculado esta inflado en el 1-3% del importe cobrado.
  fee_amount numeric(14,2),
  net_amount numeric(14,2),
  processed_at timestamptz,
  external_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_order_transactions_unique_external unique (store_id, external_transaction_id)
);

create index if not exists shopify_order_transactions_organization_id_idx on public.shopify_order_transactions (organization_id);
create index if not exists shopify_order_transactions_order_id_idx on public.shopify_order_transactions (order_id);
create index if not exists shopify_order_transactions_processed_idx on public.shopify_order_transactions (organization_id, processed_at desc);

-- --- Devoluciones (el porque, no el dinero) --------------------------------
--
-- `shopify_refunds` ya guarda el importe reembolsado. Esto es otra cosa: la
-- devolucion como proceso, con su motivo. Talla, defecto o expectativa piden
-- arreglos completamente distintos, y sin el motivo las tres se ven igual.

create table if not exists public.shopify_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  order_id uuid not null references public.shopify_order_facts (id) on delete cascade,
  external_return_id varchar(255) not null,
  status varchar(40),
  total_quantity integer not null default 0,
  external_created_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_returns_unique_external unique (store_id, external_return_id)
);

create table if not exists public.shopify_return_line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  return_id uuid not null references public.shopify_returns (id) on delete cascade,
  order_item_id uuid references public.shopify_order_items (id) on delete set null,
  external_return_line_item_id varchar(255) not null,
  quantity integer not null default 0,
  return_reason varchar(80),
  return_reason_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_return_line_items_unique_external unique (return_id, external_return_line_item_id)
);

create index if not exists shopify_returns_organization_id_idx on public.shopify_returns (organization_id);
create index if not exists shopify_returns_order_id_idx on public.shopify_returns (order_id);
create index if not exists shopify_returns_created_idx on public.shopify_returns (organization_id, external_created_at desc);
create index if not exists shopify_return_line_items_organization_id_idx on public.shopify_return_line_items (organization_id);
create index if not exists shopify_return_line_items_return_id_idx on public.shopify_return_line_items (return_id);
-- "Que producto se devuelve y por que" agrupa por motivo dentro de una org.
create index if not exists shopify_return_line_items_reason_idx on public.shopify_return_line_items (organization_id, return_reason)
  where return_reason is not null;

-- --- updated_at ------------------------------------------------------------

drop trigger if exists set_shopify_fulfillments_updated_at on public.shopify_fulfillments;
create trigger set_shopify_fulfillments_updated_at
before update on public.shopify_fulfillments
for each row execute function private.set_updated_at();

drop trigger if exists set_shopify_order_transactions_updated_at on public.shopify_order_transactions;
create trigger set_shopify_order_transactions_updated_at
before update on public.shopify_order_transactions
for each row execute function private.set_updated_at();

drop trigger if exists set_shopify_returns_updated_at on public.shopify_returns;
create trigger set_shopify_returns_updated_at
before update on public.shopify_returns
for each row execute function private.set_updated_at();

drop trigger if exists set_shopify_return_line_items_updated_at on public.shopify_return_line_items;
create trigger set_shopify_return_line_items_updated_at
before update on public.shopify_return_line_items
for each row execute function private.set_updated_at();

-- --- RLS -------------------------------------------------------------------
-- Solo lectura para authenticated. Las escrituras van con service role tras
-- comprobar membership a mano (ADR-0006 pto 7).

alter table public.shopify_fulfillments enable row level security;
alter table public.shopify_order_transactions enable row level security;
alter table public.shopify_returns enable row level security;
alter table public.shopify_return_line_items enable row level security;

drop policy if exists "shopify_fulfillments_select_authorized" on public.shopify_fulfillments;
create policy "shopify_fulfillments_select_authorized" on public.shopify_fulfillments
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_order_transactions_select_authorized" on public.shopify_order_transactions;
create policy "shopify_order_transactions_select_authorized" on public.shopify_order_transactions
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_returns_select_authorized" on public.shopify_returns;
create policy "shopify_returns_select_authorized" on public.shopify_returns
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "shopify_return_line_items_select_authorized" on public.shopify_return_line_items;
create policy "shopify_return_line_items_select_authorized" on public.shopify_return_line_items
for select
to authenticated
using (private.can_access_org(organization_id));

grant select on public.shopify_fulfillments to authenticated;
grant select on public.shopify_order_transactions to authenticated;
grant select on public.shopify_returns to authenticated;
grant select on public.shopify_return_line_items to authenticated;
