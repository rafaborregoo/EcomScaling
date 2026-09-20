-- F8.02: evaluación auditable de autonomía y HITL.
-- La tabla registra la decisión de supervisión; no concede permiso de ejecución.
create table if not exists public.hitl_approval_assessment_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  context_id text not null,
  decision_cycle_id text not null,
  action_id text not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null,
  input_fingerprint text not null,
  disposition text not null,
  autonomy_level text not null,
  approval_requirement text not null,
  approval_state text not null,
  approval_gate boolean not null,
  execution_state text not null,
  input_envelope jsonb not null,
  result jsonb not null,
  unresolved_unknowns jsonb not null default '[]'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint hitl_approval_assessment_runs_unique_input unique (organization_id, input_fingerprint),
  constraint hitl_approval_assessment_runs_disposition check (disposition in ('AUTONOMY_AVAILABLE', 'APPROVAL_REQUIRED', 'ESCALATION_REQUIRED', 'HUMAN_ONLY', 'VALIDATION_REQUIRED')),
  constraint hitl_approval_assessment_runs_execution_authority check ((result ->> 'execution_authorized') = 'false')
);

create index if not exists hitl_approval_assessment_runs_org_idx on public.hitl_approval_assessment_runs (organization_id, evaluated_at desc);
create index if not exists hitl_approval_assessment_runs_disposition_idx on public.hitl_approval_assessment_runs (organization_id, disposition);
create index if not exists hitl_approval_assessment_runs_action_idx on public.hitl_approval_assessment_runs (organization_id, action_id);

alter table public.hitl_approval_assessment_runs enable row level security;

drop policy if exists "hitl_approval_assessment_runs_select_consultants" on public.hitl_approval_assessment_runs;
create policy "hitl_approval_assessment_runs_select_consultants" on public.hitl_approval_assessment_runs
for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.hitl_approval_assessment_runs to authenticated;

comment on table public.hitl_approval_assessment_runs is 'F8.02: evaluación tenant-scoped de HITL/autonomía; approval no equivale a ejecución y execution_authorized siempre es false.';
