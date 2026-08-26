-- INT-04: claim y resultado persistente para consumir webhooks Fathom una vez.
alter table private.webhook_events
  add column if not exists claimed_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists processing_result jsonb not null default '{}'::jsonb;

alter table private.webhook_events
  drop constraint if exists webhook_events_status_check;

alter table private.webhook_events
  add constraint webhook_events_status_check check (
    status in ('received', 'processing', 'ignored_duplicate', 'queued', 'processed', 'failed')
  );

alter table public.consulting_calls
  add column if not exists external_recording_id varchar(255);

create unique index if not exists consulting_calls_external_recording_unique
on public.consulting_calls (organization_id, external_recording_id)
where external_recording_id is not null;

create index if not exists webhook_events_fathom_queue_idx
on private.webhook_events (provider, status, next_retry_at, received_at)
where provider = 'fathom';
