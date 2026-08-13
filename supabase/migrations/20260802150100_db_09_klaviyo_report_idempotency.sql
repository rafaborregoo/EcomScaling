-- DB-09: make Reporting API runs safely idempotent.
-- Additive only: no existing production rows are deleted or rewritten.

alter table public.klaviyo_report_runs
  add column if not exists idempotency_key text;

create unique index if not exists klaviyo_report_runs_account_idempotency_key_uidx
  on public.klaviyo_report_runs (account_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.klaviyo_report_runs.idempotency_key is
  'Deterministic account-scoped key for a Reporting API request; permits safe retries.';
