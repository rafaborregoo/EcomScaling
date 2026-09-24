-- Drenaje de reintentos de webhooks (conocimiento/TAREAS_PENDIENTES.md: "no
-- existe drenaje de reintentos"). drainFailedShopifyWebhooks reprocesa los
-- eventos `failed` o atascados en `received` con el payload guardado; el
-- contador impide reintentar para siempre un evento envenenado.
--
-- Idempotente (CLAUDE.md).

alter table private.webhook_events
  add column if not exists retry_count integer not null default 0;

alter table private.webhook_events
  drop constraint if exists webhook_events_retry_count_nonnegative;

alter table private.webhook_events
  add constraint webhook_events_retry_count_nonnegative check (retry_count >= 0);

create index if not exists webhook_events_pendientes_de_reintento_idx
  on private.webhook_events (provider, received_at)
  where status in ('failed', 'received');
