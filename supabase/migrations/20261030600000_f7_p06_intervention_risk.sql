-- F7/P06 — evaluación cualitativa de riesgo, exposición, reversibilidad y coste del error.
-- Mantiene ejes separados; no calcula risk score/probabilidades ni autoriza ejecución.

create table if not exists public.intervention_risk_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  context_id text not null,
  decision_cycle_id text not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null default now(),
  input_fingerprint varchar(80) not null,
  disposition varchar(50) not null,
  candidate_count integer not null default 0,
  primary_priority_candidate_id text,
  input_envelope jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  unresolved_unknowns text[] not null default '{}',
  reason_codes text[] not null default '{}',
  source_refs text[] not null default '{}',
  constraint intervention_risk_runs_disposition_check check (
    disposition in ('RISK_ASSESSMENTS_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_RISK_CANDIDATES')
  )
);

comment on table public.intervention_risk_runs is
  'F7/P06: riesgo cualitativo y trazable de una intervencion; no es un score, una probabilidad ni una autorizacion.';
comment on column public.intervention_risk_runs.result is
  'Traza upside -> downside -> exposicion -> reversibilidad -> evidencia -> inaction risk -> de-risking, con coste del error separado.';

create unique index if not exists intervention_risk_runs_input_uidx
  on public.intervention_risk_runs (organization_id, input_fingerprint);
create index if not exists intervention_risk_runs_org_evaluated_idx
  on public.intervention_risk_runs (organization_id, evaluated_at desc);

alter table public.intervention_risk_runs enable row level security;
grant select on public.intervention_risk_runs to authenticated;

drop policy if exists intervention_risk_runs_tenant_select on public.intervention_risk_runs;
create policy intervention_risk_runs_tenant_select
  on public.intervention_risk_runs
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
