-- Auditoría de notificaciones (docs/AUDITORIA_NOTIFICACIONES.md): los tipos
-- nuevos y los que caían en «Otros» (sin email por defecto) pasan a su
-- categoría. Misma tabla que `notificationCategory` en notification-settings.ts.
--
-- Idempotente: create or replace.
create or replace function private.notification_category(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type in ('alert', 'alert_critical', 'task_assigned', 'message', 'campaign_review') then p_type
    when p_type in ('integration_error', 'integration_expiring') then 'integration'
    when p_type in ('client_linked', 'client_settings', 'client_decided_ai_output') then 'client'
    when p_type in ('task_comment', 'task_completed', 'daily_today', 'ai_pending', 'camino_objective') then 'task_assigned'
    else 'other'
  end;
$$;

-- El «Para hoy» y el aviso de propuestas pendientes se buscan por tipo +
-- organización + persona + día para no repetirlos.
create index if not exists notifications_daily_lookup_idx
  on public.notifications (type, organization_id, user_id, created_at)
  where type in ('daily_today', 'ai_pending');
