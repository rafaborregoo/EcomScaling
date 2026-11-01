-- F8: link measured task outcomes to the canonical KPI catalog and preserve
-- the measurement window, currency and evidence source used for comparison.
alter table public.tasks
  add column if not exists outcome_metric_id text,
  add column if not exists outcome_period_start date,
  add column if not exists outcome_period_end date,
  add column if not exists outcome_currency_code varchar(3),
  add column if not exists outcome_source_system text;

alter table public.tasks
  add constraint tasks_outcome_metric_id_check
    check (outcome_metric_id is null or outcome_metric_id in ('mer', 'cac_new', 'conversion', 'meta_roas', 'email_open_rate')),
  add constraint tasks_outcome_period_pair_check
    check ((outcome_period_start is null) = (outcome_period_end is null)),
  add constraint tasks_outcome_period_order_check
    check (outcome_period_start is null or outcome_period_start <= outcome_period_end),
  add constraint tasks_outcome_currency_code_check
    check (outcome_currency_code is null or outcome_currency_code ~ '^[A-Z]{3}$'),
  add constraint tasks_outcome_source_system_check
    check (outcome_source_system is null or outcome_source_system in ('manual', 'shopify', 'meta', 'klaviyo', 'other'));

comment on column public.tasks.outcome_metric_id is
  'Optional stable ID from packages/contracts MetricId; null preserves user-defined legacy metrics.';
comment on column public.tasks.outcome_period_start is
  'Inclusive start date for the period represented by a task outcome.';
comment on column public.tasks.outcome_period_end is
  'Inclusive end date for the period represented by a task outcome.';
comment on column public.tasks.outcome_currency_code is
  'ISO 4217 currency for monetary task outcomes; null for non-monetary values or legacy records.';
comment on column public.tasks.outcome_source_system is
  'Evidence source reported when recording an outcome; manual does not claim API verification.';
