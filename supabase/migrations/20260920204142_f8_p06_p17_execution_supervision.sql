-- F8.06-F8.15/F8.17: etapas supervisadas, sin conceder autoridad de ejecución.
create table if not exists public.execution_supervision_runs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  context_id text not null, plan_id text not null, action_id text not null, stage text not null, as_of timestamptz not null, evaluated_at timestamptz not null, input_fingerprint text not null,
  decision text not null, input_envelope jsonb not null, result jsonb not null, blockers jsonb not null default '[]'::jsonb, warnings jsonb not null default '[]'::jsonb, source_refs jsonb not null default '[]'::jsonb, unresolved_unknowns jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(),
  constraint execution_supervision_runs_unique_input unique (organization_id, stage, input_fingerprint),
  constraint execution_supervision_runs_stage check (stage in ('UNIVERSAL','EXECUTABILITY_AUTHORIZATION','CAPABILITIES','SAFE_EXECUTION','MONITORING','GUARDRAILS','LIFECYCLE','INCIDENTS','ROLLBACK_RECOVERY','OVERRIDE_ESCALATION','CONCURRENCY','VERIFICATION','REPORTING')),
  constraint execution_supervision_runs_decision check (decision in ('READY','CONDITIONAL','BLOCKED','WAITING','UNKNOWN','COMPLETED')),
  constraint execution_supervision_runs_no_execution check ((result ->> 'execution_authorized') = 'false')
);
create index if not exists execution_supervision_runs_org_idx on public.execution_supervision_runs (organization_id, evaluated_at desc);
create index if not exists execution_supervision_runs_stage_idx on public.execution_supervision_runs (organization_id, stage, evaluated_at desc);
alter table public.execution_supervision_runs enable row level security;
drop policy if exists "execution_supervision_runs_select_consultants" on public.execution_supervision_runs;
create policy "execution_supervision_runs_select_consultants" on public.execution_supervision_runs for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
grant select on public.execution_supervision_runs to authenticated;
comment on table public.execution_supervision_runs is 'F8.06-F8.17: capacidades, ejecución segura, supervisión, lifecycle, incidentes, recovery, override, concurrencia, verificación y reporting; sin autoridad implícita.';
