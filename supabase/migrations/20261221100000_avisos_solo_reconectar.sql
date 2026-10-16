-- El aviso de integración (20261219110000) saltaba con cualquier paso a
-- `error`: también con un fallo de sincronización que E-NORA reintenta sola
-- (p. ej. `meta_sync_partial_failure`) y con un OAuth que la persona cancela
-- mientras lo está haciendo. Reconectar no arregla ninguno de los dos.
--
-- Ahora solo avisa cuando una conexión que funcionaba pierde el permiso:
-- `revoked`, o `error` con un mensaje de permiso caducado/retirado. El patrón es
-- `RECONNECT_ERROR_PATTERN` de packages/contracts/src/connection-reconnect.ts;
-- su test comprueba que esta copia sigue igual.
--
-- Idempotente.

create or replace function private.notify_integration_failure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reconnect_pattern constant text := 'reauth|reconnect|reconect|invalid[_ :.-]*grant|token.{0,24}(expired|invalid|revoked)|invalid.{0,16}(api.?key|credential)|unauthorized|permission(s)?[_ :.-]*(missing|denied)|scope(s)?[_ :.-]*(missing|insufficient)|oauth[_ :.-]*(denied|error)';
  provider_label text;
begin
  -- Un OAuth a medias o una conexión dada de baja no "se caen": no había nada
  -- funcionando que avisar.
  if old.status in ('pending', 'disconnected', 'pending_deletion') then
    return new;
  end if;
  if not (
    new.status = 'revoked'
    or (new.status = 'error' and coalesce(new.last_error_message, '') ~* reconnect_pattern)
  ) then
    return new;
  end if;
  if old.status = 'revoked'
     or (old.status = 'error' and coalesce(old.last_error_message, '') ~* reconnect_pattern) then
    return new;
  end if;

  provider_label := case new.provider
    when 'shopify' then 'Shopify'
    when 'meta_ads' then 'Meta Ads'
    when 'klaviyo' then 'Klaviyo'
    when 'instagram' then 'Instagram'
    else new.provider
  end;

  insert into public.notifications (
    organization_id, user_id, type, title, message, action_url, entity_type, entity_id
  )
  select
    new.organization_id,
    recipient.user_id,
    'integration_error',
    left('Hay que volver a conectar ' || provider_label, 255),
    coalesce(new.provider_account_name || '. ', '')
      || 'El permiso de E-NORA caducó o se retiró. Reconéctalo en Configuración › Integraciones y los datos vuelven solos.',
    '/integraciones',
    'integration_connection',
    new.id
  from (
    select member.user_id
    from public.organization_members member
    where member.organization_id = new.organization_id
      and member.is_active
      and member.role in ('owner', 'manager')
    union
    select assignment.consultant_user_id
    from public.consultant_assignments assignment
    where assignment.organization_id = new.organization_id
      and assignment.is_active
  ) recipient
  where not exists (
    select 1
    from public.notifications existing
    where existing.user_id = recipient.user_id
      and existing.entity_id = new.id
      and existing.type = 'integration_error'
      and existing.status = 'unread'
  );

  return new;
end;
$$;

revoke all on function private.notify_integration_failure() from public, anon, authenticated;
