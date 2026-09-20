-- F7/P03 — priorización cualitativa entre intervenciones elegibles y causalmente emparejadas.
-- No calcula score, no crea tareas y no concede autorización de ejecución.

create table if not exists public.intervention_prioritization_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  context_id text not null,
  decision_cycle_id text not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null default now(),
  input_fingerprint varchar(80) not null,
  disposition varchar(40) not null,
  candidate_count integer not null default 0,
  primary_priority_candidate_id text,
  input_envelope jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  unresolved_unknowns text[] not null default '{}',
  reason_codes text[] not null default '{}',
  source_refs text[] not null default '{}',
  constraint intervention_prioritization_runs_disposition_check check (
    disposition in ('PRIORITY_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_PRIORIZABLE_CANDIDATES')
  )
);

comment on table public.intervention_prioritization_runs is
  'F7/P03: comparación cualitativa de intervenciones; una prioridad no autoriza ejecución.';
comment on column public.intervention_prioritization_runs.result is
  'Decisión explicable NOW/LATER/DO_NOT_DO, sin score ni fórmula económica.';

create unique index if not exists intervention_prioritization_runs_input_uidx
  on public.intervention_prioritization_runs (organization_id, input_fingerprint);
create index if not exists intervention_prioritization_runs_org_evaluated_idx
  on public.intervention_prioritization_runs (organization_id, evaluated_at desc);

alter table public.intervention_prioritization_runs enable row level security;
grant select on public.intervention_prioritization_runs to authenticated;

drop policy if exists intervention_prioritization_runs_tenant_select on public.intervention_prioritization_runs;
create policy intervention_prioritization_runs_tenant_select
  on public.intervention_prioritization_runs
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
