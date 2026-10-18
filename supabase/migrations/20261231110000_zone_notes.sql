-- Notas del consultor ancladas a una tarjeta (cifra o bloque) del panel del
-- cliente. La clave de anclaje (`anchor`) es la misma en la vista del cliente y
-- en la del consultor, asi que las dos leen la misma nota.
--
-- Ciclo de vida: el consultor la escribe con una duracion opcional
-- (`expires_at`); el cliente la marca como vista (`seen_at`) y deja de
-- resaltarse; el consultor puede archivarla (`archived_at`). Escrituras solo
-- via API con service role (ADR-0006 regla 7); RLS solo permite leer.
-- Idempotente (CLAUDE.md).

create table if not exists public.zone_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  anchor text not null check (char_length(anchor) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  author_user_id uuid not null,
  expires_at timestamptz,
  seen_at timestamptz,
  seen_by uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists zone_notes_org_active_idx
  on public.zone_notes (organization_id, anchor, created_at desc)
  where archived_at is null;

alter table public.zone_notes enable row level security;

drop policy if exists zone_notes_select_workspace on public.zone_notes;
create policy zone_notes_select_workspace on public.zone_notes
  for select to authenticated using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
    or private.current_member_role(organization_id) in ('owner', 'manager')
  );

grant select on public.zone_notes to authenticated;
