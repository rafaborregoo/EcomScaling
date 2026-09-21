-- F8.03: plan de ejecución verificable; no ejecuta herramientas ni concede autoridad.
create table if not exists public.execution_plan_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  context_id text not null,
  decision_cycle_id text not null,
  recommendation_id text not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null,
  input_fingerprint text not null,
  plan_version integer not null default 1,
  plan_status text not null,
  execution_intent text not null,
  objective text not null,
  ordered_action_ids jsonb not null default '[]'::jsonb,
  critical_path jsonb not null default '[]'::jsonb,
  input_envelope jsonb not null,
  result jsonb not null,
  blockers jsonb not null default '[]'::jsonb,
  unresolved_unknowns jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint execution_plan_runs_unique_input unique (organization_id, input_fingerprint),
  constraint execution_plan_runs_status check (plan_status in ('DRAFT', 'READY', 'READY_WITH_APPROVAL', 'BLOCKED', 'INVALID')),
  constraint execution_plan_runs_no_execution check ((result ->> 'execution_authorized') = 'false')
);

create index if not exists execution_plan_runs_org_idx on public.execution_plan_runs (organization_id, evaluated_at desc);
create index if not exists execution_plan_runs_status_idx on public.execution_plan_runs (organization_id, plan_status);
create index if not exists execution_plan_runs_recommendation_idx on public.execution_plan_runs (organization_id, recommendation_id);

alter table public.execution_plan_runs enable row level security;

drop policy if exists "execution_plan_runs_select_consultants" on public.execution_plan_runs;
create policy "execution_plan_runs_select_consultants" on public.execution_plan_runs
for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.execution_plan_runs to authenticated;

comment on table public.execution_plan_runs is 'F8.03: plan tenant-scoped, idempotente y verificable; preparar un plan no autoriza ni ejecuta cambios.';
