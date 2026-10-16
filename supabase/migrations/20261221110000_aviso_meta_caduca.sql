-- Meta no renueva el permiso de un usuario: el token largo dura ~60 días y
-- después hay que volver a autorizar. Hasta poder usar un usuario de sistema
-- (Facebook Login for Business, sin caducidad), avisamos una semana antes en
-- vez de enterarnos cuando ya se han parado los datos.
--
-- La llama a diario `reconcileAllMetaConnections` (apps/api/src/meta-sync.ts).
-- Un aviso por caducidad: reconectar da una fecha nueva y, con ella, su propio
-- aviso cuando toque.
--
-- Idempotente.

create or replace function private.notification_category(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type in ('alert', 'alert_critical', 'task_assigned', 'message', 'campaign_review') then p_type
    when p_type in ('integration_error', 'integration_expiring') then 'integration'
    when p_type in ('client_linked', 'client_settings') then 'client'
    else 'other'
  end;
$$;

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
      and connection.status in ('connected', 'syncing')
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
