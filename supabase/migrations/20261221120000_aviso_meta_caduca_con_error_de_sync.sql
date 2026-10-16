-- 20261221110000 solo avisaba de conexiones `connected`/`syncing`, pero una
-- conexión de Meta en `error` por un fallo de sincronización
-- (`meta_sync_partial_failure`) tiene el token igual de vivo y caduca igual:
-- en PROD las dos que hay están así. Solo se excluye el error que ya es de
-- permiso (los de Meta llevan `reauth` en el mensaje): esa ya pide reconectar.
--
-- Idempotente.

create or replace function private.notify_expiring_integrations(p_within interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  with expiring as (
    select connection.id, connection.organization_id, connection.provider,
           connection.provider_account_name, credential.expires_at
    from private.integration_credentials credential
    join public.integration_connections connection on connection.id = credential.connection_id
    where credential.credential_kind = 'meta_user_access_token'
      and credential.expires_at > now()
      and credential.expires_at <= now() + p_within
      and (
        connection.status in ('connected', 'syncing')
        or (connection.status = 'error' and coalesce(connection.last_error_message, '') not ilike '%reauth%')
      )
      and not exists (
        select 1
        from public.notifications existing
        where existing.entity_id = connection.id
          and existing.type = 'integration_expiring'
          and existing.created_at > credential.expires_at - interval '30 days'
      )
  ), recipients as (
    select expiring.*, member.user_id
    from expiring
    join public.organization_members member
      on member.organization_id = expiring.organization_id
     and member.is_active
     and member.role in ('owner', 'manager')
    union
    select expiring.*, assignment.consultant_user_id
    from expiring
    join public.consultant_assignments assignment
      on assignment.organization_id = expiring.organization_id
     and assignment.is_active
  )
  insert into public.notifications (
    organization_id, user_id, type, title, message, action_url, entity_type, entity_id
  )
  select
    organization_id,
    user_id,
    'integration_expiring',
    'El permiso de Meta Ads caduca el ' || to_char(expires_at at time zone 'Europe/Madrid', 'DD/MM'),
    coalesce(provider_account_name || '. ', '')
      || 'Meta no lo renueva solo: reconéctalo antes de esa fecha en Configuración › Integraciones para que no se paren los datos.',
    '/integraciones',
    'integration_connection',
    id
  from recipients;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function private.notify_expiring_integrations(interval) from public, anon, authenticated;
grant execute on function private.notify_expiring_integrations(interval) to service_role;
