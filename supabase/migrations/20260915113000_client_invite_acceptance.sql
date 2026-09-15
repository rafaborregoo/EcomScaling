-- Una invitacion pendiente no concede acceso hasta que el cliente la acepta.
-- El canje se realiza en una sola transaccion para que invitacion y membresia
-- nunca queden en estados contradictorios.

update public.organization_members as member
set is_active = false
from public.client_invites as invite
where invite.organization_id = member.organization_id
  and invite.invited_user_id = member.user_id
  and invite.status = 'pending'
  and member.joined_at is null;

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
begin
  update public.client_invites
  set status = 'redeemed', redeemed_at = now()
  where id = p_invite_id
    and organization_id = p_organization_id
    and invited_user_id = p_user_id
    and status = 'pending';

  if not found then
    return false;
  end if;

  update public.organization_members
  set is_active = true, joined_at = coalesce(joined_at, now())
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

comment on function public.accept_client_invite(uuid, uuid, uuid) is
  'Acepta de forma atomica una invitacion y activa la membresia del cliente. Solo service_role.';
