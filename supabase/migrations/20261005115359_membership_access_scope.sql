-- Permite emitir invitaciones limitadas a una tienda y conservar el alcance
-- al aceptar el enlace. Las membresías existentes siguen siendo de toda la
-- organización por defecto.
alter table public.organization_members
  add column if not exists access_scope text not null default 'organization'
    check (access_scope in ('organization', 'store')),
  add column if not exists store_id uuid references public.shopify_stores (id) on delete cascade;

alter table public.organization_members
  drop constraint if exists organization_members_store_scope_check;
alter table public.organization_members
  add constraint organization_members_store_scope_check
  check (
    (access_scope = 'organization' and store_id is null)
    or (access_scope = 'store' and store_id is not null)
  );

alter table public.client_invites
  add column if not exists access_scope text not null default 'organization'
    check (access_scope in ('organization', 'store')),
  add column if not exists store_id uuid references public.shopify_stores (id) on delete cascade;

alter table public.client_invites
  drop constraint if exists client_invites_store_scope_check;
alter table public.client_invites
  add constraint client_invites_store_scope_check
  check (
    (access_scope = 'organization' and store_id is null)
    or (access_scope = 'store' and store_id is not null)
  );

create index if not exists organization_members_store_scope_idx
  on public.organization_members (organization_id, store_id)
  where is_active and access_scope = 'store';

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
  accepted_store_id uuid;
begin
  update public.client_invites
  set status = 'redeemed', redeemed_at = now()
  where id = p_invite_id
    and organization_id = p_organization_id
    and invited_user_id = p_user_id
    and status = 'pending'
    and expires_at > now()
  returning access_scope, store_id into accepted_scope, accepted_store_id;

  if not found then
    return false;
  end if;

  update public.organization_members
  set is_active = true,
      joined_at = coalesce(joined_at, now()),
      access_scope = coalesce(accepted_scope, 'organization'),
      store_id = accepted_store_id
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
