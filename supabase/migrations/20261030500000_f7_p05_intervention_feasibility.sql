-- F7/P05 — factibilidad de recursos, coste y esfuerzo de una intervencion.
-- Coste, esfuerzo y capacidad permanecen separados. No calcula score, ROI ni autoriza ejecucion.

create table if not exists public.intervention_feasibility_runs (
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
  constraint intervention_feasibility_runs_disposition_check check (
    disposition in ('FEASIBILITY_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_FEASIBILITY_CANDIDATES')
  )
);

comment on table public.intervention_feasibility_runs is
  'F7/P05: factibilidad cualitativa de recursos, coste y esfuerzo; no es un presupuesto ni una autorizacion.';
comment on column public.intervention_feasibility_runs.result is
  'Traza recurso requerido -> disponibilidad -> bottleneck/gap -> factibilidad -> adaptacion, sin score ni formula de coste.';

create unique index if not exists intervention_feasibility_runs_input_uidx
  on public.intervention_feasibility_runs (organization_id, input_fingerprint);
create index if not exists intervention_feasibility_runs_org_evaluated_idx
  on public.intervention_feasibility_runs (organization_id, evaluated_at desc);

alter table public.intervention_feasibility_runs enable row level security;
grant select on public.intervention_feasibility_runs to authenticated;

drop policy if exists intervention_feasibility_runs_tenant_select on public.intervention_feasibility_runs;
create policy intervention_feasibility_runs_tenant_select
  on public.intervention_feasibility_runs
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
