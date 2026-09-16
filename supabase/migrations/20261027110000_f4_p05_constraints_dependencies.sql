-- F4/P05: constraint map y dependency graph, separados de prioridad y secuencia.
create table if not exists public.decision_constraints_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  as_of timestamptz not null,
  assessed_at timestamptz not null default now(),
  input_fingerprint varchar(80) not null,
  current_primary_ref uuid,
  input_envelope jsonb not null,
  result jsonb not null,
  unresolved_unknowns jsonb not null default '[]'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  constraint decision_constraints_arrays check (jsonb_typeof(unresolved_unknowns) = 'array' and jsonb_typeof(reason_codes) = 'array' and jsonb_typeof(source_refs) = 'array'),
  constraint decision_constraints_unique_fingerprint unique (organization_id, input_fingerprint)
);
create index if not exists decision_constraints_org_idx on public.decision_constraints_assessments (organization_id, assessed_at desc);
alter table public.decision_constraints_assessments enable row level security;
drop policy if exists "decision_constraints_select_consultant" on public.decision_constraints_assessments;
create policy "decision_constraints_select_consultant" on public.decision_constraints_assessments for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
grant select on public.decision_constraints_assessments to authenticated;
