create table if not exists public.intervention_matching_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  context_id text not null,
  decision_cycle_id text not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null,
  input_fingerprint text not null,
  disposition text not null check (disposition in ('MATCHES_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_MATCHES')),
  candidate_count integer not null check (candidate_count >= 0),
  matched_count integer not null check (matched_count >= 0 and matched_count <= candidate_count),
  input_envelope jsonb not null,
  result jsonb not null,
  unresolved_unknowns jsonb not null default '[]'::jsonb check (jsonb_typeof(unresolved_unknowns) = 'array'),
  reason_codes jsonb not null default '[]'::jsonb check (jsonb_typeof(reason_codes) = 'array'),
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs) = 'array'),
  created_at timestamptz not null default now(),
  unique (organization_id, input_fingerprint)
);

create index if not exists intervention_matching_runs_org_evaluated_idx
  on public.intervention_matching_runs (organization_id, evaluated_at desc);

alter table public.intervention_matching_runs enable row level security;

drop policy if exists intervention_matching_runs_consultant_read
  on public.intervention_matching_runs;
create policy intervention_matching_runs_consultant_read
  on public.intervention_matching_runs
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

grant select on public.intervention_matching_runs to authenticated;
