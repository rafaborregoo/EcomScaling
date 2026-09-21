-- F8.05: frontera explícita de alcance y autoridad; no autoriza ejecución.
create table if not exists public.action_envelope_runs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  context_id text not null, business_id text not null, envelope_version integer not null, as_of timestamptz not null, evaluated_at timestamptz not null, input_fingerprint text not null,
  envelope_zone text not null, input_envelope jsonb not null, result jsonb not null, violations jsonb not null default '[]'::jsonb, warnings jsonb not null default '[]'::jsonb, unresolved_unknowns jsonb not null default '[]'::jsonb, source_refs jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(),
  constraint action_envelope_runs_unique_input unique (organization_id, input_fingerprint),
  constraint action_envelope_runs_zone check (envelope_zone in ('INSIDE','INSIDE_WITH_CONDITIONS','OUTSIDE','FORBIDDEN')),
  constraint action_envelope_runs_no_execution check ((result ->> 'execution_authorized') = 'false')
);
create index if not exists action_envelope_runs_org_idx on public.action_envelope_runs (organization_id, evaluated_at desc);
create index if not exists action_envelope_runs_zone_idx on public.action_envelope_runs (organization_id, envelope_zone);
alter table public.action_envelope_runs enable row level security;
drop policy if exists "action_envelope_runs_select_consultants" on public.action_envelope_runs;
create policy "action_envelope_runs_select_consultants" on public.action_envelope_runs for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
grant select on public.action_envelope_runs to authenticated;
comment on table public.action_envelope_runs is 'F8.05: scope y límites de acción validados; tool capability no es autoridad y execution_authorized siempre es false.';
