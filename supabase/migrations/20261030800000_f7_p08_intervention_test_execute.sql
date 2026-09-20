-- F7/P08 — decisión cualitativa entre fijar, ejecutar, testear, pilotar,
-- recopilar evidencia, esperar o no proceder.
-- No es una plataforma de experimentación, scheduler ni autorización.

create table if not exists public.intervention_test_execute_runs (
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
  constraint intervention_test_execute_runs_disposition_check check (
    disposition in ('DECISIONS_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_DECISION_CANDIDATES')
  )
);

comment on table public.intervention_test_execute_runs is
  'F7/P08: decision cualitativa test vs execute; no lanza tests, cambia produccion ni autoriza ejecucion.';
comment on column public.intervention_test_execute_runs.result is
  'Mode, hypothesis, learning question, outcome, guardrails and handoff; sin sample size, porcentajes, scheduler ni permisos.';

create unique index if not exists intervention_test_execute_runs_input_uidx
  on public.intervention_test_execute_runs (organization_id, input_fingerprint);
create index if not exists intervention_test_execute_runs_org_evaluated_idx
  on public.intervention_test_execute_runs (organization_id, evaluated_at desc);

alter table public.intervention_test_execute_runs enable row level security;
grant select on public.intervention_test_execute_runs to authenticated;

drop policy if exists intervention_test_execute_runs_tenant_select on public.intervention_test_execute_runs;
create policy intervention_test_execute_runs_tenant_select
  on public.intervention_test_execute_runs
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
