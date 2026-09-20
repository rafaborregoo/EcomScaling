-- F7/P09 — intensidad cualitativa multidimensional.
-- No fija porcentajes, caps, ramps, asignacion de presupuesto ni ejecucion.

create table if not exists public.intervention_intensity_runs (
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
  constraint intervention_intensity_runs_disposition_check check (disposition in ('INTENSITY_PROFILES_AVAILABLE', 'VALIDATION_REQUIRED', 'NO_INTENSITY_CANDIDATES'))
);

comment on table public.intervention_intensity_runs is 'F7/P09: magnitude, scope, velocity, duration, limiter y ramp cualitativos; no es un bet-sizing automatico ni autorizacion.';
comment on column public.intervention_intensity_runs.result is 'Perfil multidimensional y condiciones de increase/maintain/decrease/stop, sin porcentajes universales ni ejecucion.';
create unique index if not exists intervention_intensity_runs_input_uidx on public.intervention_intensity_runs (organization_id, input_fingerprint);
create index if not exists intervention_intensity_runs_org_evaluated_idx on public.intervention_intensity_runs (organization_id, evaluated_at desc);
alter table public.intervention_intensity_runs enable row level security;
grant select on public.intervention_intensity_runs to authenticated;
drop policy if exists intervention_intensity_runs_tenant_select on public.intervention_intensity_runs;
create policy intervention_intensity_runs_tenant_select on public.intervention_intensity_runs for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
