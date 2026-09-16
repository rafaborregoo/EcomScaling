create table if not exists public.playbook_templates (
  id uuid primary key default gen_random_uuid(),
  template_id text not null,
  template_version text not null,
  lifecycle varchar(16) not null,
  template jsonb not null,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint playbook_templates_lifecycle_check check (lifecycle in ('DRAFT','ACTIVE','DEPRECATED','RETIRED')),
  constraint playbook_templates_source_refs_array check (jsonb_typeof(source_refs) = 'array'),
  constraint playbook_templates_identity_unique unique (template_id, template_version)
);

create table if not exists public.playbook_framework_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  context_id text not null,
  decision_cycle_id text not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null default now(),
  input_fingerprint varchar(80) not null,
  disposition varchar(32) not null,
  selected_instance_id text,
  candidate_count integer not null default 0,
  input_envelope jsonb not null,
  result jsonb not null,
  unresolved_unknowns jsonb not null default '[]'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  constraint playbook_framework_disposition_check check (
    disposition in (
      'READY_FOR_RECOMMENDATION',
      'VALIDATION_REQUIRED',
      'BLOCKED',
      'NO_APPLICABLE_PLAYBOOK',
      'REASSESS_DIAGNOSIS',
      'REPRIORITIZE'
    )
  ),
  constraint playbook_framework_arrays_check check (
    jsonb_typeof(unresolved_unknowns) = 'array'
    and jsonb_typeof(reason_codes) = 'array'
    and jsonb_typeof(source_refs) = 'array'
  ),
  constraint playbook_framework_unique_input unique (organization_id, input_fingerprint)
);

create index if not exists playbook_templates_active_idx
  on public.playbook_templates (lifecycle, template_id, template_version);
create index if not exists playbook_framework_org_idx
  on public.playbook_framework_runs (organization_id, evaluated_at desc);

alter table public.playbook_templates enable row level security;
alter table public.playbook_framework_runs enable row level security;

drop policy if exists "playbook_templates_select_consultant" on public.playbook_templates;
create policy "playbook_templates_select_consultant"
  on public.playbook_templates for select to authenticated
  using (private.is_platform_admin() or true);

drop policy if exists "playbook_framework_select_consultant" on public.playbook_framework_runs;
create policy "playbook_framework_select_consultant"
  on public.playbook_framework_runs for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.playbook_templates to authenticated;
grant select on public.playbook_framework_runs to authenticated;
