-- F7/P11 — recomendaciones factibles bajo restricciones reales.
-- No persiste scores, thresholds, optimizer state ni asignaciones automáticas.

create table if not exists public.constraint_recommendation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  context_id text not null,
  decision_cycle_id text not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null default now(),
  input_fingerprint varchar(80) not null,
  disposition varchar(60) not null,
  candidate_count integer not null default 0,
  primary_priority_candidate_id text,
  input_envelope jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  unresolved_unknowns text[] not null default '{}',
  reason_codes text[] not null default '{}',
  source_refs text[] not null default '{}',
  constraint constraint_recommendation_runs_disposition_check check (
    disposition in ('CONSTRAINT_RECOMMENDATIONS_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_CONSTRAINT_CANDIDATES')
  )
);

comment on table public.constraint_recommendation_runs is 'F7/P11: adapta la recomendacion teorica a restricciones, capacidad de exito y alternativas declaradas; no asigna recursos ni ejecuta cambios.';
comment on column public.constraint_recommendation_runs.result is 'Incluye binding constraint, respuesta remove/reduce/replace/reallocate/resequence/delay, accion factible, deferred action y next constraint.';

create unique index if not exists constraint_recommendation_runs_input_uidx on public.constraint_recommendation_runs (organization_id, input_fingerprint);
create index if not exists constraint_recommendation_runs_org_evaluated_idx on public.constraint_recommendation_runs (organization_id, evaluated_at desc);

alter table public.constraint_recommendation_runs enable row level security;
grant select on public.constraint_recommendation_runs to authenticated;
drop policy if exists constraint_recommendation_runs_tenant_select on public.constraint_recommendation_runs;
create policy constraint_recommendation_runs_tenant_select on public.constraint_recommendation_runs for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
