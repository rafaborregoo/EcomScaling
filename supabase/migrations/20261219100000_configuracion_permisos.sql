-- Configuración v3, fase 2: permisos que hacen lo que dicen.
--
-- 1. Una persona limitada a tiendas puede tener varias, no solo una
--    (`store_ids`). `store_id` se queda como histórico: ya no se escribe.
-- 2. El cliente decide qué puede tocar su consultor
--    (`organization_consultant_permissions`). Sin fila = valores por defecto.
-- 3. El propietario puede exigir la verificación en dos pasos al equipo.
-- 4. Traspaso de propiedad atómico: nunca hay un instante sin propietario.
-- 5. Índice para leer la actividad de una organización por fecha.
--
-- Idempotente: se puede reaplicar con db:push sin daño.

-- 1. Varias tiendas por persona ------------------------------------------------

alter table public.organization_members
  add column if not exists store_ids uuid[];
alter table public.client_invites
  add column if not exists store_ids uuid[];

update public.organization_members
set store_ids = array[store_id]
where access_scope = 'store' and store_id is not null and store_ids is null;

update public.client_invites
set store_ids = array[store_id]
where access_scope = 'store' and store_id is not null and store_ids is null;

alter table public.organization_members
  drop constraint if exists organization_members_store_scope_check;
alter table public.organization_members
  add constraint organization_members_store_scope_check
  check (
    (access_scope = 'organization' and store_ids is null)
    -- cardinality(null) es null y un check con null pasa: de ahí el coalesce.
    or (access_scope = 'store' and coalesce(cardinality(store_ids), 0) >= 1)
  );

alter table public.client_invites
  drop constraint if exists client_invites_store_scope_check;
alter table public.client_invites
  add constraint client_invites_store_scope_check
  check (
    (access_scope = 'organization' and store_ids is null)
    -- cardinality(null) es null y un check con null pasa: de ahí el coalesce.
    or (access_scope = 'store' and coalesce(cardinality(store_ids), 0) >= 1)
  );

-- Misma firma que 20261005115359: solo cambia que copia la lista de tiendas.
create or replace function public.accept_client_invite(
  p_invite_id uuid,
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_scope text;
  accepted_store_ids uuid[];
begin
  update public.client_invites
  set status = 'redeemed', redeemed_at = now()
  where id = p_invite_id
    and organization_id = p_organization_id
    and invited_user_id = p_user_id
    and status = 'pending'
    and expires_at > now()
  returning access_scope, store_ids into accepted_scope, accepted_store_ids;

  if not found then
    return false;
  end if;

  update public.organization_members
  set is_active = true,
      joined_at = coalesce(joined_at, now()),
      access_scope = coalesce(accepted_scope, 'organization'),
      store_id = null,
      store_ids = case
        when coalesce(accepted_scope, 'organization') = 'store' then accepted_store_ids
        else null
      end
  where organization_id = p_organization_id
    and user_id = p_user_id;

  if not found then
    raise exception 'invite_member_not_found';
  end if;

  return true;
end;
$$;

revoke all on function public.accept_client_invite(uuid, uuid, uuid) from public;
revoke all on function public.accept_client_invite(uuid, uuid, uuid) from anon;
revoke all on function public.accept_client_invite(uuid, uuid, uuid) from authenticated;
grant execute on function public.accept_client_invite(uuid, uuid, uuid) to service_role;

-- 2. Qué puede hacer el consultor en este cliente ----------------------------
-- Publicar campañas sin aprobación del cliente arranca apagado: proponer es
-- del consultor, decidir es del cliente.

create table if not exists public.organization_consultant_permissions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  edit_config boolean not null default true,
  manage_tasks boolean not null default true,
  marketing_drafts boolean not null default true,
  marketing_publish boolean not null default false,
  invite_members boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.organization_consultant_permissions enable row level security;

-- Escrituras solo por la API con service role (ADR-0006 punto 7).
drop policy if exists organization_consultant_permissions_select on public.organization_consultant_permissions;
create policy organization_consultant_permissions_select
  on public.organization_consultant_permissions
  for select to authenticated
  using (private.can_access_org(organization_id));

grant select on public.organization_consultant_permissions to authenticated;

-- 3. 2FA obligatoria para el equipo -----------------------------------------

alter table public.organizations
  add column if not exists require_mfa boolean not null default false;

-- 4. Traspaso de propiedad ---------------------------------------------------

create or replace function public.transfer_organization_ownership(
  p_organization_id uuid,
  p_from_user uuid,
  p_to_user uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_from_user = p_to_user then
    return false;
  end if;

  perform 1
  from public.organization_members
  where organization_id = p_organization_id
    and user_id = p_from_user
    and role = 'owner'
    and is_active
  for update;
  if not found then
    return false;
  end if;

  update public.organization_members
  set role = 'owner',
      access_scope = 'organization',
      store_id = null,
      store_ids = null
  where organization_id = p_organization_id
    and user_id = p_to_user
    and is_active;
  if not found then
    return false;
  end if;

  update public.organization_members
  set role = 'manager'
  where organization_id = p_organization_id
    and user_id = p_from_user;

  return true;
end;
$$;

revoke all on function public.transfer_organization_ownership(uuid, uuid, uuid) from public;
revoke all on function public.transfer_organization_ownership(uuid, uuid, uuid) from anon;
revoke all on function public.transfer_organization_ownership(uuid, uuid, uuid) from authenticated;
grant execute on function public.transfer_organization_ownership(uuid, uuid, uuid) to service_role;

-- 5. Actividad por organización ----------------------------------------------

create index if not exists audit_logs_organization_created_at_idx
  on public.audit_logs (organization_id, created_at desc);
