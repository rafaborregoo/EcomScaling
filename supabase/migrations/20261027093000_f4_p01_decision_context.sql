-- F4/P01: snapshots auditables del contexto decisional.
-- Las declaraciones las escribe la API tras autorización; el tenant solo
-- puede leer sus snapshots a través de RLS. Cada snapshot conserva el input,
-- el resultado y su lineage para poder explicar qué cambió entre t1 y t2.

create table if not exists public.decision_context_declarations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  declared_at timestamptz not null default now(),
  input_fingerprint varchar(80) not null,
  input_envelope jsonb not null,
  source_lineage_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint decision_context_declarations_lineage_array check (jsonb_typeof(source_lineage_refs) = 'array'),
  constraint decision_context_declarations_unique_fingerprint unique (organization_id, input_fingerprint)
);

create index if not exists decision_context_declarations_org_idx
  on public.decision_context_declarations (organization_id, declared_at desc);

create table if not exists public.decision_contexts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  decision_context_id varchar(160) not null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null default now(),
  schema_version varchar(40) not null,
  context_policy_version varchar(80) not null,
  input_fingerprint varchar(80) not null,
  context_status varchar(20) not null,
  context_confidence varchar(40) not null,
  primary_objective_kind varchar(20),
  primary_objective_statement text,
  input_envelope jsonb not null,
  result jsonb not null,
  unresolved_unknowns jsonb not null default '[]'::jsonb,
  reason_codes jsonb not null default '[]'::jsonb,
  source_lineage_refs jsonb not null default '[]'::jsonb,
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz not null default now(),
  constraint decision_contexts_status_values check (context_status in ('COMPLETE', 'INCOMPLETE', 'CONFLICTING', 'STALE', 'FAILED')),
  constraint decision_contexts_confidence_values check (context_confidence in ('SUFFICIENT_TO_DECIDE', 'SUFFICIENT_WITH_LIMITATIONS', 'VALIDATION_REQUIRED', 'INSUFFICIENT', 'UNKNOWN')),
  constraint decision_contexts_json_arrays check (
    jsonb_typeof(unresolved_unknowns) = 'array'
    and jsonb_typeof(reason_codes) = 'array'
    and jsonb_typeof(source_lineage_refs) = 'array'
  ),
  constraint decision_contexts_unique_fingerprint unique (organization_id, input_fingerprint)
);

create index if not exists decision_contexts_org_idx
  on public.decision_contexts (organization_id, evaluated_at desc);
create index if not exists decision_contexts_current_idx
  on public.decision_contexts (organization_id, invalidated_at, evaluated_at desc);

alter table public.decision_context_declarations enable row level security;
alter table public.decision_contexts enable row level security;

drop policy if exists "decision_context_declarations_select_consultant" on public.decision_context_declarations;
create policy "decision_context_declarations_select_consultant"
  on public.decision_context_declarations for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

drop policy if exists "decision_contexts_select_consultant" on public.decision_contexts;
create policy "decision_contexts_select_consultant"
  on public.decision_contexts for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.decision_context_declarations, public.decision_contexts to authenticated;

comment on table public.decision_context_declarations is
  'Declaraciones de contexto introducidas por un consultor; no contienen ranking ni weights.';
comment on table public.decision_contexts is
  'Snapshots evaluados de P1; una fila por fingerprint semántico para preservar historia y evitar objective drift silencioso.';
