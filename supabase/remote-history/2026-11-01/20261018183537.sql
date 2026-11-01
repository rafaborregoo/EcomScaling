-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
create table if not exists public.agent_escalations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.agent_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null check (length(trim(reason)) between 1 and 4000),
  risk text not null check (risk in ('low', 'medium', 'high', 'critical')),
  blocking_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(blocking_questions) = 'array'),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  owner_user_id uuid references auth.users(id) on delete set null,
  resolution text check (resolution is null or length(resolution) <= 4000),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists agent_escalations_org_status_created_idx
  on public.agent_escalations (organization_id, status, created_at desc);
create index if not exists agent_escalations_owner_status_idx
  on public.agent_escalations (owner_user_id, status, created_at desc)
  where owner_user_id is not null;
alter table public.agent_escalations enable row level security;
drop policy if exists agent_escalations_select_authorized on public.agent_escalations;
create policy agent_escalations_select_authorized on public.agent_escalations
  for select to authenticated
  using (organization_id in (select private.accessible_org_ids()));
revoke all on public.agent_escalations from anon, authenticated;
grant select on public.agent_escalations to authenticated;
grant select, insert, update, delete on public.agent_escalations to service_role;
comment on table public.agent_escalations is
  'Escalados de agentes con responsable y ciclo de estado persistente; una fila por run evita duplicar un mismo escalado en reintentos.';
