create table if not exists public.agent_judge_calibration_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_version text not null,
  rubric_version text not null,
  model text not null,
  status text not null check (status in ('passed','blocked','incomplete','error')),
  case_count integer not null check (case_count >= 0 and case_count <= 500),
  estimated_cost_usd numeric(12,6) not null check (estimated_cost_usd >= 0 and estimated_cost_usd <= 10),
  report jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists agent_judge_calibration_runs_latest_idx
  on public.agent_judge_calibration_runs (dataset_version, created_at desc);
alter table public.agent_judge_calibration_runs enable row level security;
revoke all on public.agent_judge_calibration_runs from public, anon, authenticated;
grant select, insert on public.agent_judge_calibration_runs to service_role;

drop trigger if exists agent_judge_calibration_runs_append_only on public.agent_judge_calibration_runs;
create trigger agent_judge_calibration_runs_append_only before update or delete on public.agent_judge_calibration_runs
for each row execute function public.reject_agent_judge_eval_mutation();

comment on table public.agent_judge_calibration_runs is 'Immutable, cost-bounded results from executing a candidate judge on the adjudicated blind holdout.';
