-- F8.16: cierre operacional, handoff y paquete de outcome para Fase 9.
-- Esta tabla registra hechos observados; no ejecuta tareas ni reescribe historia.
create table if not exists public.execution_closure_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  intervention_id text not null,
  recommendation_id text not null,
  output_id uuid references public.agent_outputs (id) on delete set null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null,
  input_fingerprint text not null,
  closure_state text not null,
  closure_gate boolean not null,
  operational_outcome text not null,
  verification_status text not null,
  closure_quality text not null,
  outcome_maturity text not null,
  handoff_status text not null,
  input_envelope jsonb not null,
  result jsonb not null,
  final_state_snapshot jsonb not null,
  unresolved_unknowns jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint execution_closure_runs_unique_input unique (organization_id, input_fingerprint),
  constraint execution_closure_runs_state check (closure_state in ('COMPLETED', 'CLOSURE_READY', 'CLOSING', 'CLOSED')),
  constraint execution_closure_runs_outcome check (operational_outcome in ('SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'ABORTED', 'ROLLED_BACK', 'INCONCLUSIVE', 'NOT_EXECUTED')),
  constraint execution_closure_runs_handoff check (handoff_status in ('NOT_REQUIRED', 'REQUESTED', 'ACCEPTED', 'REJECTED', 'FAILED', 'COMPLETE'))
);

create index if not exists execution_closure_runs_org_idx on public.execution_closure_runs (organization_id, evaluated_at desc);
create index if not exists execution_closure_runs_state_idx on public.execution_closure_runs (organization_id, closure_state, closure_gate);
create index if not exists execution_closure_runs_intervention_idx on public.execution_closure_runs (organization_id, intervention_id);

alter table public.execution_closure_runs enable row level security;

drop policy if exists "execution_closure_runs_select_consultants" on public.execution_closure_runs;
create policy "execution_closure_runs_select_consultants" on public.execution_closure_runs
for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.execution_closure_runs to authenticated;

comment on table public.execution_closure_runs is 'F8.16: cierre tenant-scoped, handoff y outcome observado; la evaluación no ejecuta ni autoriza acciones.';
