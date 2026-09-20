create table if not exists public.recommendation_confidence_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  context_id text not null,
  decision_cycle_id text not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null,
  input_fingerprint text not null,
  disposition text not null check (disposition in ('CONFIDENCE_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_CONFIDENCE_CONTEXT')),
  scope text not null,
  input_envelope jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  unresolved_unknowns text[] not null default '{}'::text[],
  reason_codes text[] not null default '{}'::text[],
  source_refs text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create unique index if not exists recommendation_confidence_runs_org_fingerprint_idx on public.recommendation_confidence_runs(organization_id, input_fingerprint);
create index if not exists recommendation_confidence_runs_org_evaluated_idx on public.recommendation_confidence_runs(organization_id, evaluated_at desc);

alter table public.recommendation_confidence_runs enable row level security;
drop policy if exists recommendation_confidence_runs_consultant_read on public.recommendation_confidence_runs;
create policy recommendation_confidence_runs_consultant_read on public.recommendation_confidence_runs
  for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.recommendation_confidence_runs to authenticated;
comment on table public.recommendation_confidence_runs is 'F7.17: confianza multidimensional y compromiso cualitativo; no score, no probabilidades ni ejecucion automatica.';
