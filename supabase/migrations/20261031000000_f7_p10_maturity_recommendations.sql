-- F7/P10 — recomendaciones adaptadas a madurez, capability y readiness.
-- No persiste scores, thresholds ni clasificaciones derivadas de revenue.

create table if not exists public.maturity_recommendation_runs (
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
  constraint maturity_recommendation_runs_disposition_check check (
    disposition in ('MATURITY_RECOMMENDATIONS_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_MATURITY_CANDIDATES')
  )
);

comment on table public.maturity_recommendation_runs is 'F7/P10: adapta una intervención a madurez funcional, readiness, capabilities y complejidad absorbible; no puntúa ni autoriza ejecución.';
comment on column public.maturity_recommendation_runs.result is 'Incluye now/later, not-yet, capability previa, complejidad suficiente y maturity unlock.';

create unique index if not exists maturity_recommendation_runs_input_uidx
  on public.maturity_recommendation_runs (organization_id, input_fingerprint);
create index if not exists maturity_recommendation_runs_org_evaluated_idx
  on public.maturity_recommendation_runs (organization_id, evaluated_at desc);

alter table public.maturity_recommendation_runs enable row level security;
grant select on public.maturity_recommendation_runs to authenticated;
drop policy if exists maturity_recommendation_runs_tenant_select on public.maturity_recommendation_runs;
create policy maturity_recommendation_runs_tenant_select
  on public.maturity_recommendation_runs
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
