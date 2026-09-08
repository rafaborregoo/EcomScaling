-- Un consultor (sin platform_admin) da de alta a sus propios clientes. Cada
-- alta genera un código único y temporal por cliente que el consultor comparte
-- como quiera (email, WhatsApp...). El cliente lo canjea en /acceso, recibe una
-- sesión y hace su onboarding de cliente. La organización queda ligada al
-- consultor vía consultant_assignment (is_primary).

create table if not exists public.client_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invited_user_id uuid references auth.users (id) on delete set null,
  consultant_user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'redeemed', 'revoked')),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists client_invites_organization_id_idx on public.client_invites (organization_id);
create index if not exists client_invites_consultant_user_id_idx on public.client_invites (consultant_user_id);

-- ADR-0006 p.7: escrituras y lecturas van por SUPABASE_SERVICE_ROLE_KEY desde
-- la API con chequeo manual de rol. RLS activo sin políticas => `authenticated`
-- no ve nada directamente.
alter table public.client_invites enable row level security;

comment on table public.client_invites is 'Códigos de invitación de cliente creados por un consultor. Canje en /acceso.';
