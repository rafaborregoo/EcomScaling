-- A27: persist the reviewed strategy so a user can resume after a refresh.
create table if not exists public.marketing_mailing_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  status varchar(24) not null default 'planned',
  request jsonb not null,
  plan jsonb not null,
  client_state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_mailing_sequences_status_check
    check (status in ('planned', 'in_progress', 'completed', 'abandoned'))
);

create index if not exists marketing_mailing_sequences_org_store_created_idx
  on public.marketing_mailing_sequences (organization_id, store_id, created_at desc);

drop trigger if exists set_marketing_mailing_sequences_updated_at
  on public.marketing_mailing_sequences;
create trigger set_marketing_mailing_sequences_updated_at
before update on public.marketing_mailing_sequences
for each row execute function private.set_updated_at();

alter table public.marketing_mailing_sequences enable row level security;
revoke all on table public.marketing_mailing_sequences from public, anon, authenticated;
grant select, insert, update, delete on table public.marketing_mailing_sequences to service_role;

comment on table public.marketing_mailing_sequences is
  'A27 reviewed mailing plans and UI state for authenticated recovery; only the API service role may read or mutate it.';
