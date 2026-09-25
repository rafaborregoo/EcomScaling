-- Pixel propio de EcomScaling (Shopify Web Pixel): vistas de producto.
--
-- Decision de producto del 2026-09-24: `conversion_cro.product_views` no tenia
-- fuente -- shopify_funnel_summary no trae vistas de producto --, asi que se
-- crea el pixel y se trae el dato. La extension vive en
-- extensions/ecomscaling-pixel y manda cada `product_viewed` a
-- POST /v1/pixel/events. Aqui solo se guarda lo necesario para contar vistas:
-- ni URL completa ni datos del cliente; el client_id del navegador llega ya
-- resumido (sha256) para contar visitantes distintos sin guardar el original.
--
-- Estado = eventos append-only con clave natural (store_id, event_id): Shopify
-- puede reenviar el mismo evento y el upsert lo absorbe (ADR-0006 punto 1 se
-- refiere a estado actual; esto son hechos, no estado).
--
-- Idempotente (CLAUDE.md).

create table if not exists public.shopify_pixel_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  event_id varchar(80) not null,
  event_name varchar(40) not null,
  occurred_at timestamptz not null,
  client_id_hash varchar(64),
  product_id varchar(40),
  variant_id varchar(40),
  received_at timestamptz not null default now(),
  constraint shopify_pixel_events_unico unique (store_id, event_id),
  constraint shopify_pixel_events_nombre check (event_name in ('product_viewed'))
);

comment on table public.shopify_pixel_events is
  'Eventos del pixel propio (Shopify Web Pixel). Hoy solo product_viewed: la fuente de las vistas de producto del embudo.';

create index if not exists shopify_pixel_events_org_fecha_idx
  on public.shopify_pixel_events (organization_id, event_name, occurred_at);

alter table public.shopify_pixel_events enable row level security;

drop policy if exists "shopify_pixel_events_select_authorized" on public.shopify_pixel_events;
create policy "shopify_pixel_events_select_authorized" on public.shopify_pixel_events
  for select to authenticated
  using (private.can_access_org(organization_id));

grant select on public.shopify_pixel_events to authenticated;

-- Vistas de producto de un periodo. first_event_at dice desde cuando hay pixel:
-- antes de esa fecha no hay "cero vistas", hay "sin dato".
drop function if exists public.shopify_product_views(uuid, timestamptz, timestamptz, uuid);
create function public.shopify_product_views(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  product_views bigint,
  unique_viewers bigint,
  products_viewed bigint,
  first_event_at timestamptz
)
language sql
stable
as $$
  select
    count(*) filter (where e.occurred_at >= coalesce(period_start, '-infinity'::timestamptz) and e.occurred_at <= period_end) as product_views,
    count(distinct e.client_id_hash) filter (where e.occurred_at >= coalesce(period_start, '-infinity'::timestamptz) and e.occurred_at <= period_end) as unique_viewers,
    count(distinct e.product_id) filter (where e.occurred_at >= coalesce(period_start, '-infinity'::timestamptz) and e.occurred_at <= period_end) as products_viewed,
    min(e.occurred_at) as first_event_at
  from public.shopify_pixel_events e
  where e.organization_id = target_organization_id
    and e.event_name = 'product_viewed'
    and (target_store_id is null or e.store_id = target_store_id);
$$;

alter function public.shopify_product_views(uuid, timestamptz, timestamptz, uuid)
  set search_path = pg_catalog, public;

grant execute on function public.shopify_product_views(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_product_views(uuid, timestamptz, timestamptz, uuid) is
  'Vistas de producto del pixel propio en el periodo. first_event_at null = la tienda no tiene el pixel activo: el dato es desconocido, no cero.';
