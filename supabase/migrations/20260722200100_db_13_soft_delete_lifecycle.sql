-- R-008: soft-delete de organizaciones y tiendas. Paso 2/2 (ver migracion
-- anterior para el nuevo valor de enum 'pending_deletion').
--
-- Maquina de estados: active/onboarding/suspended/cancelled -> pending_deletion
-- (con scheduled_purge_at = ahora + periodo de retencion, ver
-- RETENTION_PERIOD_DAYS en apps/api/src/consultant.ts) -> permanentemente
-- borrado por el job de purga (apps/worker, cron diario) cuando pasa
-- scheduled_purge_at, o restaurado antes por consultant.restoreOrganization.

alter table public.organizations
  add column deletion_requested_at timestamptz,
  add column deletion_requested_by uuid references public.profiles (id) on delete set null,
  add column scheduled_purge_at timestamptz;

alter table public.integration_connections
  drop constraint integration_connections_status_check,
  add constraint integration_connections_status_check check (
    status in ('pending', 'connected', 'syncing', 'error', 'disconnected', 'revoked', 'pending_deletion')
  ),
  add column deletion_requested_at timestamptz,
  add column deletion_requested_by uuid references public.profiles (id) on delete set null,
  add column scheduled_purge_at timestamptz;

create index organizations_pending_purge_idx
on public.organizations (scheduled_purge_at)
where status = 'pending_deletion';

create index integration_connections_pending_purge_idx
on public.integration_connections (scheduled_purge_at)
where status = 'pending_deletion';
