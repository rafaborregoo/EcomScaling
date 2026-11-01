-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Drafts are created in E-NORA first; only the explicit apply endpoint writes to Shopify.
create table if not exists public.shopify_discount_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  idempotency_key uuid not null,
  request jsonb not null check (jsonb_typeof(request) = 'object'),
  status text not null default 'draft'
    check (status in ('draft', 'applying', 'applied', 'failed', 'conflict', 'expired')),
  created_by uuid not null references auth.users (id),
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  shopify_discount_id text,
  shopify_result jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_discount_proposals_store_idempotency_unique
    unique (store_id, idempotency_key)
);

create index if not exists shopify_discount_proposals_scope_status_idx
  on public.shopify_discount_proposals (organization_id, store_id, status, created_at desc);

-- Reserve a code while a proposal is live so parallel drafts cannot race to create it.
create unique index if not exists shopify_discount_proposals_live_code_unique
  on public.shopify_discount_proposals (store_id, lower(request ->> 'code'))
  where status in ('draft', 'applying', 'applied');

alter table public.shopify_discount_proposals enable row level security;
revoke all on public.shopify_discount_proposals from public, anon, authenticated;
grant select, insert, update on public.shopify_discount_proposals to service_role;
