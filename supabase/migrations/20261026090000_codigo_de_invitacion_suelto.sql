-- §16 del plan de organizacion consultora: se invierte quien crea que.
--
-- Hasta ahora el consultor creaba la organizacion del cliente ANTES de que el
-- cliente hiciera nada (usuario de Auth sin contraseña vía generateLink,
-- organizacion, suscripcion trial, asignacion... todo de golpe). El cliente
-- solo confirmaba en /acceso.
--
-- Desde aqui el consultor solo genera un codigo SUELTO -- sin organizacion,
-- a veces sin email siquiera. El cliente se registra por su cuenta en
-- /registro, con su propia contraseña, y es AL CREAR SU ORGANIZACION (en
-- /planes) cuando el codigo la vincula a la consultora. El codigo deja de ser
-- una llave para entrar a un sitio que otro construyo, y pasa a ser lo que
-- decide a que cartera se apunta lo que el cliente construye el mismo.
--
-- Por eso `organization_id` y `email` dejan de ser obligatorios: al generar el
-- codigo todavia no existe ninguna de las dos cosas.

alter table public.client_invites alter column organization_id drop not null;
alter table public.client_invites alter column email drop not null;

-- Reclama un codigo suelto para la organizacion que el propio cliente acaba
-- de crear, y dentro de la MISMA transaccion crea la asignacion a la
-- consultora. Las dos cosas van juntas a proposito: una organizacion
-- vinculada sin fila en `consultant_assignments` no la ve su consultor, y una
-- fila de asignacion sin el codigo consumido dejaria un cliente vinculado dos
-- veces si el alta se reintenta.
create or replace function public.link_client_invite(
  p_invite_id uuid,
  p_organization_id uuid,
  p_user_id uuid,
  p_consultant_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.client_invites
  set organization_id = p_organization_id,
      invited_user_id = p_user_id,
      status = 'redeemed',
      redeemed_at = now()
  where id = p_invite_id
    and status = 'pending'
    and organization_id is null;

  if not found then
    return false;
  end if;

  insert into public.consultant_assignments (
    organization_id, consultant_user_id, is_primary, is_active, assigned_by
  ) values (
    p_organization_id, p_consultant_user_id, true, true, p_consultant_user_id
  );

  return true;
end;
$$;

revoke all on function public.link_client_invite(uuid, uuid, uuid, uuid) from public;
revoke all on function public.link_client_invite(uuid, uuid, uuid, uuid) from anon;
revoke all on function public.link_client_invite(uuid, uuid, uuid, uuid) from authenticated;
grant execute on function public.link_client_invite(uuid, uuid, uuid, uuid) to service_role;

comment on function public.link_client_invite(uuid, uuid, uuid, uuid) is
  'Vincula atomicamente una organizacion recien creada por su cliente al codigo suelto que la trajo. Solo service_role.';
