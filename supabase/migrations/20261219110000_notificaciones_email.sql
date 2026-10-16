-- Configuración v3, fase 3: notificaciones por email y avisos que faltaban.
--
-- 1. Categorías finas (alertas críticas aparte, mensajes, revisiones de
--    campaña, integraciones, cambios de clientes) y canal email por categoría:
--    al momento, en el resumen o nunca. El emisor de correo existe (SMTP Brevo,
--    el mismo de invitaciones e informes); el recorte de 20261201000000 ya no
--    aplica.
-- 2. Ajustes por persona: resumen diario/semanal, hora, zona horaria y horario
--    de silencio (solo frena el email; la campana sigue).
-- 3. Una integración que pasa a error avisa a owner/manager y consultores, desde
--    un trigger: todo sync que cambie el estado pasa por aquí.
-- 4. Las preferencias se escriben por la API (service role); RLS solo select.
--
-- Idempotente.

-- 1. Categorías y canal email ---------------------------------------------------

alter table public.notification_preferences
  drop constraint if exists notification_preferences_category_check;
alter table public.notification_preferences
  add constraint notification_preferences_category_check
  check (category in (
    'alert_critical', 'alert', 'task_assigned', 'message',
    'campaign_review', 'integration', 'client', 'other'
  ));

alter table public.notification_preferences
  add column if not exists email text not null default 'digest';
alter table public.notification_preferences
  drop constraint if exists notification_preferences_email_check;
alter table public.notification_preferences
  add constraint notification_preferences_email_check
  check (email in ('instant', 'digest', 'off'));

create or replace function private.notification_category(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type in ('alert', 'alert_critical', 'task_assigned', 'message', 'campaign_review') then p_type
    when p_type = 'integration_error' then 'integration'
    when p_type in ('client_linked', 'client_settings') then 'client'
    else 'other'
  end;
$$;

-- Escrituras por la API (ADR-0006 punto 7).
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
drop policy if exists notification_preferences_update_own on public.notification_preferences;
revoke insert, update on public.notification_preferences from authenticated;

-- 2. Ajustes por persona -------------------------------------------------------

create table if not exists public.notification_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  digest_frequency text not null default 'weekly'
    check (digest_frequency in ('daily', 'weekly', 'never')),
  -- 1 = lunes ... 7 = domingo (ISO).
  digest_weekday smallint not null default 1 check (digest_weekday between 1 and 7),
  digest_hour smallint not null default 8 check (digest_hour between 0 and 23),
  timezone text not null default 'Europe/Madrid',
  quiet_enabled boolean not null default false,
  quiet_from smallint not null default 21 check (quiet_from between 0 and 23),
  quiet_to smallint not null default 8 check (quiet_to between 0 and 23),
  last_digest_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists notification_settings_select_own on public.notification_settings;
create policy notification_settings_select_own on public.notification_settings
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.notification_settings to authenticated;

alter table public.notifications
  add column if not exists email_sent_at timestamptz;

create index if not exists notifications_email_pending_idx
  on public.notifications (created_at)
  where email_sent_at is null;

-- 3. Integración caída -> aviso -----------------------------------------------

create or replace function private.notify_integration_failure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_label text;
begin
  if new.status not in ('error', 'revoked')
     or old.status in ('error', 'revoked') then
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
    left(provider_label || ' ha dejado de sincronizar', 255),
    coalesce(new.provider_account_name || '. ', '')
      || 'Revisa la conexión en Configuración › Integraciones.',
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
  -- Un aviso sin leer por conexión basta: los reintentos no lo repiten.
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

drop trigger if exists integration_connections_notify_failure on public.integration_connections;
create trigger integration_connections_notify_failure
  after update of status on public.integration_connections
  for each row execute function private.notify_integration_failure();
