-- F7/P07 — camino condicional de secuenciación y dependencias.
-- No es un DAG, scheduler, plan de proyecto ni autorización de ejecución.

create table if not exists public.intervention_sequencing_runs (
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
  constraint intervention_sequencing_runs_disposition_check check (
    disposition in ('SEQUENCES_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_SEQUENCE_CANDIDATES')
  )
);

comment on table public.intervention_sequencing_runs is
  'F7/P07: secuenciacion cualitativa con prerequisites, blockers, gates y ramas; no es scheduler ni autorizacion.';
comment on column public.intervention_sequencing_runs.result is
  'Traza prioridad -> prerequisite -> blocker/unlock -> gate -> next/branch/wait/parallel, sin fechas, owners ni tareas.';

create unique index if not exists intervention_sequencing_runs_input_uidx
  on public.intervention_sequencing_runs (organization_id, input_fingerprint);
create index if not exists intervention_sequencing_runs_org_evaluated_idx
  on public.intervention_sequencing_runs (organization_id, evaluated_at desc);

alter table public.intervention_sequencing_runs enable row level security;
grant select on public.intervention_sequencing_runs to authenticated;

drop policy if exists intervention_sequencing_runs_tenant_select on public.intervention_sequencing_runs;
create policy intervention_sequencing_runs_tenant_select
  on public.intervention_sequencing_runs
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
