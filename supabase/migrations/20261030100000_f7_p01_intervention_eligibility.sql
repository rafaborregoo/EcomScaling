-- F7.01 — elegibilidad de intervenciones.
-- La tabla guarda la foto determinista del filtro; no selecciona, prioriza ni ejecuta.
create table if not exists public.intervention_eligibility_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  context_id text not null,
  decision_cycle_id text not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null default now(),
  input_fingerprint varchar(80) not null,
  disposition varchar(32) not null,
  candidate_count integer not null default 0,
  eligible_count integer not null default 0,
  input_envelope jsonb not null,
  result jsonb not null,
  unresolved_unknowns jsonb not null default '[]'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  constraint intervention_eligibility_disposition_check check (
    disposition in (
      'CANDIDATES_AVAILABLE',
      'VALIDATION_REQUIRED',
      'NO_ELIGIBLE_CANDIDATES',
      'NO_APPLICABLE_CANDIDATES'
    )
  ),
  constraint intervention_eligibility_counts_check check (
    candidate_count >= 0 and eligible_count >= 0 and eligible_count <= candidate_count
  ),
  constraint intervention_eligibility_arrays_check check (
    jsonb_typeof(unresolved_unknowns) = 'array'
    and jsonb_typeof(reason_codes) = 'array'
    and jsonb_typeof(source_refs) = 'array'
  ),
  constraint intervention_eligibility_unique_input unique (organization_id, input_fingerprint)
);

create index if not exists intervention_eligibility_org_idx
  on public.intervention_eligibility_runs (organization_id, evaluated_at desc);

alter table public.intervention_eligibility_runs enable row level security;

drop policy if exists "intervention_eligibility_select_staff" on public.intervention_eligibility_runs;
create policy "intervention_eligibility_select_staff"
  on public.intervention_eligibility_runs for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.intervention_eligibility_runs to authenticated;
