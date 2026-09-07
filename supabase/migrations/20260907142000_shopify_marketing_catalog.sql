-- Marketing y catalogo de Shopify: carritos abandonados, promociones,
-- campañas declaradas y colecciones.
--
-- El hilo comun: hoy se sabe cuanto se vendio, no que lo movio. Un descuento
-- del 67% sobre el bruto no dice nada si no se sabe con que codigo se fue ni a
-- quien; un carrito abandonado es dinero que ya dijo que si y se fue.

-- --- Carritos abandonados --------------------------------------------------

create table public.shopify_abandoned_checkouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_checkout_id varchar(255) not null,
  -- Mismo hash que en los pedidos: permite cruzar carrito abandonado con la
  -- compra posterior sin guardar datos personales.
  customer_reference_hash varchar(255),
  total_price numeric(14,2) not null default 0,
  subtotal_price numeric(14,2) not null default 0,
  currency_code varchar(3),
  total_items integer not null default 0,
  -- Null mientras siga abandonado. Con fecha, el carrito acabo en compra: es
  -- la tasa de recuperacion, y sin esta columna se contarian como perdidos
  -- carritos que se cerraron solos.
  completed_at timestamptz,
  recovery_url text,
  country_code varchar(2),
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_abandoned_checkouts_unique_external unique (store_id, external_checkout_id)
);

create table public.shopify_abandoned_checkout_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  checkout_id uuid not null references public.shopify_abandoned_checkouts (id) on delete cascade,
  variant_id uuid references public.shopify_variants (id) on delete set null,
  product_id uuid references public.shopify_products (id) on delete set null,
  external_line_item_id varchar(255) not null,
  title varchar(255) not null,
  quantity integer not null default 0,
  unit_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_abandoned_checkout_items_unique_external unique (checkout_id, external_line_item_id)
);

create index shopify_abandoned_checkouts_organization_id_idx
  on public.shopify_abandoned_checkouts (organization_id);
create index shopify_abandoned_checkouts_created_idx
  on public.shopify_abandoned_checkouts (organization_id, external_created_at desc);
-- El listado util es siempre "los que siguen sin recuperar en esta ventana".
create index shopify_abandoned_checkouts_pending_idx
  on public.shopify_abandoned_checkouts (organization_id, external_created_at desc)
  where completed_at is null;
create index shopify_abandoned_checkout_items_organization_id_idx
  on public.shopify_abandoned_checkout_items (organization_id);
create index shopify_abandoned_checkout_items_checkout_id_idx
  on public.shopify_abandoned_checkout_items (checkout_id);

-- --- Promociones -----------------------------------------------------------

create table public.shopify_discounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_discount_id varchar(255) not null,
  title varchar(255),
  -- El codigo que teclea el cliente. Null en descuentos automaticos, que es
  -- justo la distincion que interesa: un automatico se lo lleva todo el mundo.
  code varchar(255),
  status varchar(40),
  -- percentage, fixed_amount, free_shipping, bxgy, app.
  discount_class varchar(40),
  value_type varchar(40),
  value numeric(14,2),
  -- Shopify avisa de que se actualiza de forma asincrona: sirve para ordenar
  -- promociones por uso, no para cuadrar contabilidad al centimo.
  usage_count integer not null default 0,
  usage_limit integer,
  applies_once_per_customer boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_discounts_unique_external unique (store_id, external_discount_id)
);

-- Que descuento se aplico en que pedido. Es la tabla que convierte "regalamos
-- 13.576 €" en "este codigo concreto se llevo 4.000 y no trajo un cliente
-- nuevo". Un pedido puede llevar varios.
create table public.shopify_order_discount_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.shopify_order_facts (id) on delete cascade,
  discount_id uuid references public.shopify_discounts (id) on delete set null,
  -- Se guarda el texto ademas del enlace: si la promocion se borra en Shopify,
  -- el pedido historico tiene que seguir sabiendo con que codigo se vendio.
  code varchar(255),
  title varchar(255),
  allocation_method varchar(40),
  target_type varchar(40),
  amount numeric(14,2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_order_discount_applications_unique unique (order_id, position)
);

create index shopify_discounts_organization_id_idx
  on public.shopify_discounts (organization_id);
create index shopify_discounts_code_idx
  on public.shopify_discounts (organization_id, code)
  where code is not null;
create index shopify_order_discount_applications_organization_id_idx
  on public.shopify_order_discount_applications (organization_id);
create index shopify_order_discount_applications_order_id_idx
  on public.shopify_order_discount_applications (order_id);
create index shopify_order_discount_applications_code_idx
  on public.shopify_order_discount_applications (organization_id, code)
  where code is not null;

-- --- Campañas declaradas en Shopify ---------------------------------------

create table public.shopify_marketing_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_event_id varchar(255) not null,
  event_type varchar(80),
  channel_handle varchar(80),
  app_handle varchar(120),
  description text,
  -- Los mismos UTM que llegan en la atribucion del pedido: es el enganche que
  -- permite decir "esta campaña declarada trajo estos pedidos".
  utm_source varchar(120),
  utm_medium varchar(120),
  utm_campaign varchar(200),
  started_at timestamptz,
  ended_at timestamptz,
  external_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_marketing_events_unique_external unique (store_id, external_event_id)
);

create index shopify_marketing_events_organization_id_idx
  on public.shopify_marketing_events (organization_id);
create index shopify_marketing_events_started_idx
  on public.shopify_marketing_events (organization_id, started_at desc);
create index shopify_marketing_events_utm_idx
  on public.shopify_marketing_events (organization_id, utm_campaign)
  where utm_campaign is not null;

-- --- Colecciones -----------------------------------------------------------
--
-- Para analizar por categoria como la tienda la organiza de verdad, en vez de
-- por `product_type`, que casi nadie mantiene.

create table public.shopify_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_collection_id varchar(255) not null,
  title varchar(255) not null,
  handle varchar(255),
  is_automated boolean not null default false,
  products_count integer not null default 0,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_collections_unique_external unique (store_id, external_collection_id)
);

create table public.shopify_product_collections (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.shopify_products (id) on delete cascade,
  collection_id uuid not null references public.shopify_collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, collection_id)
);

create index shopify_collections_organization_id_idx
  on public.shopify_collections (organization_id);
create index shopify_product_collections_organization_id_idx
  on public.shopify_product_collections (organization_id);
-- Un producto pertenece a varias colecciones y una coleccion tiene muchos
-- productos: la clave primaria cubre un sentido, este indice el otro.
create index shopify_product_collections_collection_id_idx
  on public.shopify_product_collections (collection_id);

-- --- updated_at ------------------------------------------------------------

create trigger set_shopify_abandoned_checkouts_updated_at
before update on public.shopify_abandoned_checkouts
for each row execute function private.set_updated_at();

create trigger set_shopify_abandoned_checkout_items_updated_at
before update on public.shopify_abandoned_checkout_items
for each row execute function private.set_updated_at();

create trigger set_shopify_discounts_updated_at
before update on public.shopify_discounts
for each row execute function private.set_updated_at();

create trigger set_shopify_order_discount_applications_updated_at
before update on public.shopify_order_discount_applications
for each row execute function private.set_updated_at();

create trigger set_shopify_marketing_events_updated_at
before update on public.shopify_marketing_events
for each row execute function private.set_updated_at();

create trigger set_shopify_collections_updated_at
before update on public.shopify_collections
for each row execute function private.set_updated_at();

-- --- RLS -------------------------------------------------------------------

alter table public.shopify_abandoned_checkouts enable row level security;
alter table public.shopify_abandoned_checkout_items enable row level security;
alter table public.shopify_discounts enable row level security;
alter table public.shopify_order_discount_applications enable row level security;
alter table public.shopify_marketing_events enable row level security;
alter table public.shopify_collections enable row level security;
alter table public.shopify_product_collections enable row level security;

create policy "shopify_abandoned_checkouts_select_authorized"
on public.shopify_abandoned_checkouts
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_abandoned_checkout_items_select_authorized"
on public.shopify_abandoned_checkout_items
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_discounts_select_authorized"
on public.shopify_discounts
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_order_discount_applications_select_authorized"
on public.shopify_order_discount_applications
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_marketing_events_select_authorized"
on public.shopify_marketing_events
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_collections_select_authorized"
on public.shopify_collections
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_product_collections_select_authorized"
on public.shopify_product_collections
for select
to authenticated
using (private.can_access_org(organization_id));

grant select on public.shopify_abandoned_checkouts to authenticated;
grant select on public.shopify_abandoned_checkout_items to authenticated;
grant select on public.shopify_discounts to authenticated;
grant select on public.shopify_order_discount_applications to authenticated;
grant select on public.shopify_marketing_events to authenticated;
grant select on public.shopify_collections to authenticated;
grant select on public.shopify_product_collections to authenticated;
