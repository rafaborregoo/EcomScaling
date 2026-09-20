create table if not exists public.recommendation_portfolio_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  context_id text not null,
  decision_cycle_id text not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null,
  input_fingerprint text not null,
  disposition text not null check (disposition in ('PORTFOLIO_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_PORTFOLIO_CANDIDATES')),
  candidate_count integer not null default 0,
  primary_candidate_id text,
  input_envelope jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  unresolved_unknowns text[] not null default '{}'::text[],
  reason_codes text[] not null default '{}'::text[],
  source_refs text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create unique index if not exists recommendation_portfolio_runs_org_fingerprint_idx on public.recommendation_portfolio_runs(organization_id, input_fingerprint);
create index if not exists recommendation_portfolio_runs_org_evaluated_idx on public.recommendation_portfolio_runs(organization_id, evaluated_at desc);

alter table public.recommendation_portfolio_runs enable row level security;
drop policy if exists recommendation_portfolio_runs_consultant_read on public.recommendation_portfolio_runs;
create policy recommendation_portfolio_runs_consultant_read on public.recommendation_portfolio_runs
  for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

comment on table public.recommendation_portfolio_runs is 'F7.12: cartera minima y coherente de recomendaciones; no asigna recursos ni autoriza ejecucion.';
