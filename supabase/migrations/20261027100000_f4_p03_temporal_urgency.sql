-- F4/P03: assessment temporal separado de D13 y del ranking P00.
create table if not exists public.temporal_urgency_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  candidate_ref uuid,
  temporal_diagnosis_id uuid references public.temporal_diagnoses (id) on delete set null,
  as_of timestamptz not null,
  assessed_at timestamptz not null default now(),
  input_fingerprint varchar(80) not null,
  temporal_assessment varchar(24) not null,
  temporal_confidence varchar(40) not null,
  total_response_time_days numeric,
  input_envelope jsonb not null,
  result jsonb not null,
  unresolved_unknowns jsonb not null default '[]'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  constraint temporal_urgency_assessment_values check (temporal_assessment in ('TIME_CRITICAL', 'TIME_SENSITIVE', 'NOT_TIME_SENSITIVE', 'UNKNOWN')),
  constraint temporal_urgency_confidence_values check (temporal_confidence in ('SUFFICIENT_TO_ASSESS', 'SUFFICIENT_WITH_LIMITATIONS', 'VALIDATION_REQUIRED', 'INSUFFICIENT', 'UNKNOWN')),
  constraint temporal_urgency_arrays check (jsonb_typeof(unresolved_unknowns) = 'array' and jsonb_typeof(reason_codes) = 'array' and jsonb_typeof(source_refs) = 'array'),
  constraint temporal_urgency_unique_fingerprint unique (organization_id, input_fingerprint)
);
create index if not exists temporal_urgency_org_idx on public.temporal_urgency_assessments (organization_id, assessed_at desc);
alter table public.temporal_urgency_assessments enable row level security;
drop policy if exists "temporal_urgency_select_consultant" on public.temporal_urgency_assessments;
create policy "temporal_urgency_select_consultant" on public.temporal_urgency_assessments for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
grant select on public.temporal_urgency_assessments to authenticated;
