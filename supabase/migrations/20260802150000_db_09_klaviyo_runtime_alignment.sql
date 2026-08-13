-- DB-09 runtime alignment: reconcile the applied foundation schema with the
-- Klaviyo sync/reporting contract. This migration is additive and preserves
-- existing rows; it does not create or modify customer data.

alter table public.klaviyo_accounts
  add column if not exists name varchar(255),
  add column if not exists currency_code varchar(3),
  add column if not exists conversion_metric_id varchar(255),
  add column if not exists conversion_metric_name varchar(255),
  add column if not exists conversion_metric_source varchar(80),
  add column if not exists conversion_metric_selected_at timestamptz,
  add column if not exists conversion_metric_selected_by uuid references auth.users (id) on delete set null;

alter table public.klaviyo_report_runs
  add column if not exists idempotency_key varchar(500);

create unique index if not exists klaviyo_report_runs_account_idempotency_key_uidx
  on public.klaviyo_report_runs (account_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.klaviyo_accounts.conversion_metric_id is
  'External Klaviyo metric ID selected as the account conversion metric.';
comment on column public.klaviyo_report_runs.idempotency_key is
  'Stable EcomScaling key for an account/report/timeframe/statistics request.';
