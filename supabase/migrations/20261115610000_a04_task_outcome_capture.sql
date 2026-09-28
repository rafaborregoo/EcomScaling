-- Store one optional, measured post-task outcome. Completion remains separate
-- from impact: users may finish work without having a trustworthy metric yet.
alter table public.tasks
  add column if not exists outcome_metric_name text,
  add column if not exists outcome_before_value numeric,
  add column if not exists outcome_after_value numeric,
  add column if not exists outcome_unit text,
  add column if not exists outcome_summary text,
  add column if not exists outcome_measured_at date,
  add column if not exists outcome_recorded_at timestamptz;

alter table public.tasks
  add constraint tasks_outcome_metric_name_length_check
    check (outcome_metric_name is null or char_length(outcome_metric_name) between 1 and 120),
  add constraint tasks_outcome_unit_length_check
    check (outcome_unit is null or char_length(outcome_unit) <= 40),
  add constraint tasks_outcome_summary_length_check
    check (outcome_summary is null or char_length(outcome_summary) <= 1000),
  add constraint tasks_outcome_before_finite_check
    check (outcome_before_value is null or (outcome_before_value > '-Infinity'::numeric and outcome_before_value < 'Infinity'::numeric and outcome_before_value <> 'NaN'::numeric)),
  add constraint tasks_outcome_after_finite_check
    check (outcome_after_value is null or (outcome_after_value > '-Infinity'::numeric and outcome_after_value < 'Infinity'::numeric and outcome_after_value <> 'NaN'::numeric)),
  add constraint tasks_outcome_has_metric_check
    check (outcome_metric_name is null or (outcome_measured_at is not null and outcome_recorded_at is not null and (outcome_after_value is not null or outcome_summary is not null)));

comment on column public.tasks.outcome_metric_name is
  'Optional user-reported KPI observed after task execution; not causal proof of task impact.';
