-- FASE 4 / P00 — contrato raíz y runtime de priorización.
--
-- P00 no calcula el ranking final. Congela la ejecución, registra su contexto,
-- separa ABSTAINED de FAILED y deja trazable qué reglas permitieron avanzar.
-- El ranking/portfolio se incorpora en P1-P12 sin mutar estas ejecuciones.

create table if not exists public.prioritization_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_id uuid not null references public.organizations (id) on delete cascade,
  analysis_snapshot_id text not null,
  created_at timestamptz not null default now(),
  decision_as_of timestamptz not null,
  completed_at timestamptz,
  schema_version varchar(32) not null,
  decision_policy_version varchar(64) not null,
  input_fingerprint varchar(80) not null,
  recompute_reason varchar(48),
  run_status varchar(24) not null,
  decision_validity varchar(32) not null,
  input_envelope jsonb not null default '{}'::jsonb,
  unresolved_unknowns text[] not null default '{}',
  abstention_reason_codes text[] not null default '{}',
  source_lineage_refs text[] not null default '{}',
  warnings text[] not null default '{}',
  result jsonb not null default '{}'::jsonb,
  invalidation_reason text,
  invalidated_at timestamptz,
  replacement_run_id uuid references public.prioritization_runs (id) on delete set null,
  constraint prioritization_runs_status_check check (run_status in ('CREATED','INPUT_INCOMPLETE','READY','EVALUATING','COMPLETED','ABSTAINED','INVALIDATED','FAILED')),
  constraint prioritization_runs_validity_check check (decision_validity in ('VALID','VALID_WITH_LIMITATIONS','REQUIRES_VALIDATION','INSUFFICIENT_INFORMATION','NO_VALID_CANDIDATES','STALE','INVALID')),
  constraint prioritization_runs_failed_invalid_check check (run_status <> 'FAILED' or decision_validity = 'INVALID'),
  constraint prioritization_runs_abstained_reason_check check (run_status <> 'ABSTAINED' or cardinality(abstention_reason_codes) > 0)
);

comment on table public.prioritization_runs is
  'F4/P00: ejecución inmutable de priorización. No es una tarea ni un playbook.';
comment on column public.prioritization_runs.analysis_snapshot_id is
  'Referencia al estado lógico congelado; nunca se reescribe una ejecución histórica.';
comment on column public.prioritization_runs.input_envelope is
  'Referencias P0, no una copia mutable de diagnósticos, contexto o candidatos.';

create unique index if not exists prioritization_runs_semantic_input_uidx
  on public.prioritization_runs (organization_id, analysis_snapshot_id, input_fingerprint, decision_policy_version);
create index if not exists prioritization_runs_org_created_idx
  on public.prioritization_runs (organization_id, created_at desc);

create table if not exists public.prioritization_rule_traces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  prioritization_run_id uuid not null references public.prioritization_runs (id) on delete cascade,
  rule_id varchar(96) not null,
  rule_version varchar(32) not null,
  rule_type varchar(24) not null,
  input_refs text[] not null default '{}',
  result jsonb not null,
  reason_codes text[] not null default '{}',
  evidence_refs text[] not null default '{}',
  deterministic boolean not null,
  executed_at timestamptz not null default now()
);

comment on table public.prioritization_rule_traces is
  'F4/P00: cada regla que altera la ejecución deja una traza reconstruible.';
create index if not exists prioritization_rule_traces_run_idx
  on public.prioritization_rule_traces (prioritization_run_id, executed_at);

alter table public.prioritization_runs enable row level security;
alter table public.prioritization_rule_traces enable row level security;

grant select on public.prioritization_runs, public.prioritization_rule_traces to authenticated;

drop policy if exists prioritization_runs_tenant_select on public.prioritization_runs;
create policy prioritization_runs_tenant_select on public.prioritization_runs
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
drop policy if exists prioritization_rule_traces_tenant_select on public.prioritization_rule_traces;
create policy prioritization_rule_traces_tenant_select on public.prioritization_rule_traces
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
