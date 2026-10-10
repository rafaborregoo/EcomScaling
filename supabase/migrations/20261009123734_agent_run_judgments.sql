-- Durable, append-only quality judgments for generated agent artifacts.
-- The server is the only writer; users read through organization-scoped API routes.
create table if not exists public.agent_run_judgments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  agent_output_id uuid references public.agent_outputs(id) on delete cascade,
  agent_code text not null,
  artifact_kind text not null,
  artifact_sha256 text,
  idempotency_key text not null unique,
  rubric_version text not null,
  status text not null check (status in ('passed', 'review', 'no_evaluable', 'blocked', 'error')),
  overall_score numeric(4,2) check (overall_score is null or overall_score between 0 and 4),
  result jsonb,
  error_code text,
  provider text not null,
  model text not null,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  latency_ms integer,
  input_fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint agent_run_judgments_result_state check (
    (status in ('passed', 'review', 'no_evaluable', 'blocked') and result is not null and error_code is null)
    or (status = 'error' and result is null and error_code is not null)
  ),
  constraint agent_run_judgments_hash_format check (
    artifact_sha256 is null or artifact_sha256 ~ '^[a-f0-9]{64}$'
  )
);

create index if not exists agent_run_judgments_org_created_idx
  on public.agent_run_judgments (organization_id, created_at desc);
create index if not exists agent_run_judgments_run_created_idx
  on public.agent_run_judgments (agent_run_id, created_at desc);
create index if not exists agent_run_judgments_output_created_idx
  on public.agent_run_judgments (agent_output_id, created_at desc)
  where agent_output_id is not null;

alter table public.agent_run_judgments enable row level security;
revoke all on public.agent_run_judgments from anon, authenticated;
grant select, insert, update on public.agent_run_judgments to service_role;
