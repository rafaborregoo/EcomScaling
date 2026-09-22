-- F8.10: estado autoritativo del ciclo de vida de cada intervencion y registro
-- de transiciones. El estado actual va con upsert in-place (ADR-0006 punto 1);
-- las transiciones son un log append-only porque son historia, no estado.

create table if not exists public.execution_lifecycle_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  intervention_id text not null,
  context_id text not null,
  state text not null,
  why text not null default '',
  plan_version integer not null default 0,
  -- Ultimo evento aplicado: con esto se descartan los que llegan fuera de orden.
  last_event_at timestamptz,
  allowed_commands text[] not null default '{}'::text[],
  prohibited_commands text[] not null default '{}'::text[],
  blocking_conditions text[] not null default '{}'::text[],
  next_states text[] not null default '{}'::text[],
  material_write_allowed boolean not null default false,
  inconsistencies text[] not null default '{}'::text[],
  input_envelope jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  source_refs text[] not null default '{}'::text[],
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.execution_lifecycle_states add column if not exists inconsistencies text[] not null default '{}'::text[];
alter table public.execution_lifecycle_states add column if not exists material_write_allowed boolean not null default false;

create unique index if not exists execution_lifecycle_states_org_intervention_idx
  on public.execution_lifecycle_states(organization_id, intervention_id);
create index if not exists execution_lifecycle_states_org_state_idx
  on public.execution_lifecycle_states(organization_id, state, evaluated_at desc);

create table if not exists public.execution_lifecycle_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  intervention_id text not null,
  command text not null,
  decision text not null check (decision in ('ACCEPTED', 'REJECTED', 'NO_OP', 'STALE')),
  from_state text not null,
  to_state text not null,
  actor_id text not null,
  plan_version integer not null default 0,
  material_write_allowed boolean not null default false,
  blocking_condition text,
  reasons text[] not null default '{}'::text[],
  -- Razon y evidencia de la transicion (spec 8.10 seccion 2, paso 8).
  evidence jsonb not null default '{}'::jsonb,
  event_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Un mismo comando, para la misma intervencion y el mismo instante de evento,
-- no se registra dos veces: los reenvios son idempotentes (spec seccion 41).
create unique index if not exists execution_lifecycle_transitions_idempotent_idx
  on public.execution_lifecycle_transitions(organization_id, intervention_id, command, event_at);
create index if not exists execution_lifecycle_transitions_org_event_idx
  on public.execution_lifecycle_transitions(organization_id, intervention_id, event_at desc);

alter table public.execution_lifecycle_states enable row level security;
drop policy if exists execution_lifecycle_states_consultant_read on public.execution_lifecycle_states;
create policy execution_lifecycle_states_consultant_read on public.execution_lifecycle_states
  for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

alter table public.execution_lifecycle_transitions enable row level security;
drop policy if exists execution_lifecycle_transitions_consultant_read on public.execution_lifecycle_transitions;
create policy execution_lifecycle_transitions_consultant_read on public.execution_lifecycle_transitions
  for select to authenticated using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

comment on table public.execution_lifecycle_states is 'F8.10: estado autoritativo del lifecycle por intervencion; upsert in-place.';
comment on table public.execution_lifecycle_transitions is 'F8.10: log de transiciones con razon y evidencia; append-only.';
