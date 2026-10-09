-- Acciones rapidas de Campañas: campañas que el consultor repite y quiere crear de un clic.
--
-- visibility:
--   me      solo su dueño, en todos sus clientes (organization_id null).
--   client  el equipo del consultor, solo en esa organizacion.
--   shared  igual que client, y ademas el cliente la ve como atajo para pedir algo.
-- kind: plan (crea la campaña en el calendario) | ia (abre Crear con el brief puesto).
--
-- Solo escribe la API (service role): RLS activa y sin politicas para authenticated.
-- Idempotente: si el esquema se tocó por fuera, db:push la reaplica.

create table if not exists public.campaign_quick_actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  visibility text not null default 'me',
  name text not null,
  icon text not null default 'mail',
  kind text not null default 'plan',
  channel text not null default 'email',
  audience text not null default 'Suscriptores activos',
  when_kind text not null default 'off',
  dow smallint not null default 4,
  offset_days smallint not null default 7,
  brief text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_quick_actions_visibility_valid check (visibility in ('me', 'client', 'shared')),
  constraint campaign_quick_actions_scope_valid check (
    (visibility = 'me' and organization_id is null) or (visibility <> 'me' and organization_id is not null)
  ),
  constraint campaign_quick_actions_kind_valid check (kind in ('plan', 'ia')),
  constraint campaign_quick_actions_channel_valid check (channel in ('email', 'meta')),
  constraint campaign_quick_actions_when_valid check (when_kind in ('dow', 'off')),
  constraint campaign_quick_actions_dow_valid check (dow between 0 and 6),
  constraint campaign_quick_actions_offset_valid check (offset_days between 0 and 120),
  constraint campaign_quick_actions_name_length check (char_length(name) between 1 and 32),
  constraint campaign_quick_actions_brief_length check (char_length(brief) <= 2000)
);

create index if not exists campaign_quick_actions_owner_idx
  on public.campaign_quick_actions (owner_id, position);
create index if not exists campaign_quick_actions_org_idx
  on public.campaign_quick_actions (organization_id, position)
  where organization_id is not null;

alter table public.campaign_quick_actions enable row level security;
