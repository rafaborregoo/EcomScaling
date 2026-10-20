-- Motor de notificaciones (ADR-0028): los avisos de integración dejan de
-- escribirse en `notifications` desde SQL. El trigger y la función de
-- caducidad dejan un EVENTO en `private.notification_outbox`; la API lo recoge
-- (`/v1/internal/notifications/outbox-tick`, cada minuto) y lo emite con
-- `notify()`: mismos destinatarios, texto del catálogo, agrupación y destino.
--
-- La detección no cambia (20261221100000 y 20261221120000): solo avisa de un
-- permiso caído o a punto de caducar.
--
-- Idempotente.

create table if not exists private.notification_outbox (
  id bigint generated always as identity primary key,
  type text not null,
  organization_id uuid not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  taken_at timestamptz
);

create index if not exists notification_outbox_pending_idx
  on private.notification_outbox (created_at)
  where taken_at is null;

revoke all on private.notification_outbox from public, anon, authenticated;
grant select, insert, update on private.notification_outbox to service_role;

-- 1. Integración que pierde el permiso -> evento ---------------------------------

create or replace function private.notify_integration_failure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reconnect_pattern constant text := 'reauth|reconnect|reconect|invalid[_ :.-]*grant|token.{0,24}(expired|invalid|revoked)|invalid.{0,16}(api.?key|credential)|unauthorized|permission(s)?[_ :.-]*(missing|denied)|scope(s)?[_ :.-]*(missing|insufficient)|oauth[_ :.-]*(denied|error)';
begin
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

  insert into private.notification_outbox (type, organization_id, entity_type, entity_id, payload)
  values (
    'integration_error',
    new.organization_id,
    'integration_connection',
    new.id,
    jsonb_build_object('provider', new.provider, 'account_name', new.provider_account_name)
  );
  return new;
end;
$$;

revoke all on function private.notify_integration_failure() from public, anon, authenticated;

-- 2. Permiso de Meta a punto de caducar -> evento ---------------------------------

create or replace function private.notify_expiring_integrations(p_within interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into private.notification_outbox (type, organization_id, entity_type, entity_id, payload)
  select
    'integration_expiring',
    connection.organization_id,
    'integration_connection',
    connection.id,
    jsonb_build_object(
      'provider', connection.provider,
      'account_name', connection.provider_account_name,
      'expires_at', credential.expires_at
    )
  from private.integration_credentials credential
  join public.integration_connections connection on connection.id = credential.connection_id
  where credential.credential_kind = 'meta_user_access_token'
    and credential.expires_at > now()
    and credential.expires_at <= now() + p_within
    and (
      connection.status in ('connected', 'syncing')
      or (connection.status = 'error' and coalesce(connection.last_error_message, '') not ilike '%reauth%')
    )
    -- Un aviso por caducidad: ni si ya se avisó (antes del motor) ni si ya
    -- hay un evento para esa misma caducidad.
    and not exists (
      select 1
      from public.notifications existing
      where existing.entity_id = connection.id
        and existing.type = 'integration_expiring'
        and existing.created_at > credential.expires_at - interval '30 days'
    )
    and not exists (
      select 1
      from private.notification_outbox queued
      where queued.entity_id = connection.id
        and queued.type = 'integration_expiring'
        and queued.created_at > credential.expires_at - interval '30 days'
    );

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function private.notify_expiring_integrations(interval) from public, anon, authenticated;
grant execute on function private.notify_expiring_integrations(interval) to service_role;

-- 3. La API recoge los eventos pendientes -----------------------------------------
-- Como mucho una vez: se marcan al recogerlos (un aviso perdido es mejor que
-- uno repetido cada minuto si la emisión falla siempre).

create or replace function private.take_notification_outbox(p_limit integer default 200)
returns setof private.notification_outbox
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select id
    from private.notification_outbox
    where taken_at is null
    order by created_at
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  )
  update private.notification_outbox outbox
  set taken_at = now()
  from picked
  where outbox.id = picked.id
  returning outbox.*;
$$;

revoke all on function private.take_notification_outbox(integer) from public, anon, authenticated;
grant execute on function private.take_notification_outbox(integer) to service_role;
