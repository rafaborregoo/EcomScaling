-- DB-09 compatibility alignment.
-- The initial foundation migration was intentionally normalized, while the first
-- service slice was already using a flatter reporting contract. Keep this change
-- additive and retain the normalized columns for future readers.

alter table public.klaviyo_accounts
  add column if not exists name varchar(255),
  add column if not exists currency_code varchar(3),
  add column if not exists conversion_metric_id varchar(255),
  add column if not exists conversion_metric_name varchar(255),
  add column if not exists conversion_metric_source varchar(40),
  add column if not exists conversion_metric_selected_at timestamptz,
  add column if not exists conversion_metric_selected_by uuid references auth.users (id) on delete set null;

alter table public.klaviyo_report_runs
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists timezone varchar(100),
  add column if not exists currency_code varchar(3),
  add column if not exists finished_at timestamptz;

alter table public.klaviyo_report_values
  add column if not exists entity_name varchar(255),
  add column if not exists metric_id varchar(255),
  add column if not exists conversions numeric(20,6),
  add column if not exists revenue numeric(20,6),
  add column if not exists currency_code varchar(3);

alter table public.klaviyo_report_values
  alter column external_entity_id drop not null;

alter table public.klaviyo_report_values
  alter column statistic_name set default 'conversion';

alter table public.klaviyo_report_values
  drop constraint if exists klaviyo_report_values_entity_target_check;

create unique index if not exists klaviyo_report_values_code_contract_uidx
  on public.klaviyo_report_values (
    report_run_id,
    entity_type,
    external_entity_id,
    metric_id,
    period_start,
    period_end
  );

comment on table public.klaviyo_accounts is
  'Normalized Klaviyo account metadata plus compatibility fields used by the current reporting slice.';
