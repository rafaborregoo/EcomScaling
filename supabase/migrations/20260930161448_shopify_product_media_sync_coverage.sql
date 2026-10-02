create table if not exists public.shopify_product_media_sync_coverage (
  organization_id uuid not null,
  store_id uuid not null,
  status varchar(20) not null default 'pending',
  products_scanned integer not null default 0,
  images_scanned integer not null default 0,
  last_attempt_at timestamptz,
  last_successful_full_sync_at timestamptz,
  error_code varchar(120),
  updated_at timestamptz not null default now(),
  primary key (store_id),
  constraint shopify_product_media_coverage_store_fkey
    foreign key (organization_id, store_id)
    references public.shopify_stores (organization_id, id)
    on delete cascade,
  constraint shopify_product_media_coverage_status_check
    check (status in ('pending', 'running', 'complete', 'partial', 'failed')),
  constraint shopify_product_media_coverage_counts_check
    check (products_scanned >= 0 and images_scanned >= 0)
);

alter table public.shopify_product_media_sync_coverage enable row level security;
drop policy if exists shopify_product_media_sync_coverage_select_authorized
  on public.shopify_product_media_sync_coverage;
create policy shopify_product_media_sync_coverage_select_authorized
  on public.shopify_product_media_sync_coverage
  for select to authenticated
  using (private.can_access_org(organization_id));

revoke all on public.shopify_product_media_sync_coverage from anon, authenticated;
grant select on public.shopify_product_media_sync_coverage to authenticated;
grant select, insert, update, delete on public.shopify_product_media_sync_coverage to service_role;

comment on table public.shopify_product_media_sync_coverage is
  'Cobertura de galerías Shopify por tienda: el último intento y la última sincronización completa se conservan por separado.';
