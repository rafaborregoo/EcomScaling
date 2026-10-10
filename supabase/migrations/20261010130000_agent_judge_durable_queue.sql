-- Durable lease/retry queue for judge work. The user-facing generation stays
-- fail-open; only the service role can read or mutate queued payloads.
create table if not exists public.agent_judge_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  agent_code text not null,
  dedupe_key text not null unique check (dedupe_key ~ '^[a-f0-9]{64}$'),
  payload jsonb,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_judge_jobs_payload_state check (
    (status in ('queued', 'running') and payload is not null)
    or (status in ('completed', 'failed') and payload is null)
  ),
  constraint agent_judge_jobs_lease_state check (
    (status = 'running' and lease_until is not null)
    or (status <> 'running' and lease_until is null)
  ),
  constraint agent_judge_jobs_payload_size check (
    payload is null or octet_length(payload::text) <= 20 * 1024 * 1024
  )
);

create index if not exists agent_judge_jobs_claim_idx
  on public.agent_judge_jobs (status, available_at, lease_until, created_at);
create index if not exists agent_judge_jobs_run_idx
  on public.agent_judge_jobs (organization_id, agent_run_id, created_at desc);

alter table public.agent_judge_jobs enable row level security;
revoke all on public.agent_judge_jobs from anon, authenticated;
grant select, insert, update, delete on public.agent_judge_jobs to service_role;

create or replace function public.claim_agent_judge_jobs(
  p_limit integer default 3,
  p_lease_seconds integer default 120
)
returns setof public.agent_judge_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.agent_judge_jobs
  set status = 'failed', payload = null, lease_until = null,
      last_error = 'lease_expired_attempts_exhausted', updated_at = now()
  where status = 'running' and lease_until <= now() and attempts >= max_attempts;

  return query
  with candidates as (
    select id
    from public.agent_judge_jobs
    where attempts < max_attempts
      and (
        (status = 'queued' and available_at <= now())
        or (status = 'running' and lease_until <= now())
      )
    order by available_at asc, created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 3), 10))
  ), claimed as (
    update public.agent_judge_jobs as jobs
    set status = 'running',
        attempts = jobs.attempts + 1,
        lease_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 600))),
        updated_at = now()
    from candidates
    where jobs.id = candidates.id
    returning jobs.*
  )
  select * from claimed;
end;
$$;

revoke all on function public.claim_agent_judge_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_agent_judge_jobs(integer, integer) to service_role;

comment on table public.agent_judge_jobs is
  'Private durable queue for LLM judge retries; payload is erased on terminal completion/failure.';
