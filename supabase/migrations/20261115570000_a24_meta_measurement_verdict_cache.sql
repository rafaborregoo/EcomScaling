-- Shared, short-lived verdict read by A14/A23/A24/A25 for the same store
-- and date window. This is internal evidence, never a browser-facing table.
create table if not exists public.meta_measurement_verdict_cache (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  verdict_version varchar(80) not null,
  verdict_status varchar(50) not null check (
    verdict_status in ('usable_with_attribution_limits', 'restricted', 'not_assessable', 'unknown')
  ),
  verdict jsonb not null,
  evaluated_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_measurement_verdict_cache_period_check check (period_end >= period_start),
  constraint meta_measurement_verdict_cache_expiry_check check (expires_at > evaluated_at),
  constraint meta_measurement_verdict_cache_scope_unique unique (
    organization_id, store_id, period_start, period_end, verdict_version
  )
);

create index if not exists meta_measurement_verdict_cache_expiry_idx
  on public.meta_measurement_verdict_cache (organization_id, store_id, expires_at desc);

alter table public.meta_measurement_verdict_cache enable row level security;
revoke all on table public.meta_measurement_verdict_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.meta_measurement_verdict_cache to service_role;

comment on table public.meta_measurement_verdict_cache is
  'Internal versioned A24 measurement gate shared across Meta specialists; rows are scoped by tenant/store/window and expire quickly.';
