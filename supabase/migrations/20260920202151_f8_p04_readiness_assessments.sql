-- F8.04: barrera tenant-bound entre plan y ejecución; no concede autoridad.
create table if not exists public.readiness_assessment_runs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  context_id text not null, plan_id text not null, action_id text not null, scope text not null, as_of timestamptz not null, evaluated_at timestamptz not null, input_fingerprint text not null,
  readiness_decision text not null, input_envelope jsonb not null, result jsonb not null, blocking_reasons jsonb not null default '[]'::jsonb, unresolved_unknowns jsonb not null default '[]'::jsonb, source_refs jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(),
  constraint readiness_assessment_runs_unique_input unique (organization_id, input_fingerprint), constraint readiness_assessment_runs_decision check (readiness_decision in ('READY','READY_WITH_CONDITIONS','PARTIALLY_READY','NOT_READY','BLOCKED','WAITING')), constraint readiness_assessment_runs_no_execution check ((result ->> 'execution_authorized') = 'false')
);
create index if not exists readiness_assessment_runs_org_idx on public.readiness_assessment_runs (organization_id, evaluated_at desc);
create index if not exists readiness_assessment_runs_decision_idx on public.readiness_assessment_runs (organization_id, readiness_decision);
alter table public.readiness_assessment_runs enable row level security;
drop policy if exists "readiness_assessment_runs_select_consultants" on public.readiness_assessment_runs;
create policy "readiness_assessment_runs_select_consultants" on public.readiness_assessment_runs for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
grant select on public.readiness_assessment_runs to authenticated;
comment on table public.readiness_assessment_runs is 'F8.04: readiness y preconditions evidenciadas; READY no significa ejecutar y execution_authorized siempre es false.';
