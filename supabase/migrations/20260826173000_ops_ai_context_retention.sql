-- OPS: redact sensitive AI execution context while preserving run metrics,
-- approvals, published outputs and operational traceability.

create or replace function private.purge_expired_ai_context(
  p_before timestamptz,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  steps_count integer;
  tool_calls_count integer;
  snapshots_count integer;
  queries_count integer;
  transcripts_count integer;
begin
  if p_before >= clock_timestamp() then
    raise exception 'purge_cutoff_must_be_in_the_past';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'purge_limit_out_of_range';
  end if;

  with candidates as (
    select id from public.agent_run_steps
    where created_at < p_before and payload is not null
      and run_id in (select id from public.agent_runs where status <> 'running')
    order by created_at asc limit p_limit
  )
  update public.agent_run_steps target
  set payload = null
  from candidates
  where target.id = candidates.id;
  get diagnostics steps_count = row_count;

  with candidates as (
    select id from public.agent_tool_calls
    where created_at < p_before and (input is not null or output is not null)
      and run_id in (select id from public.agent_runs where status <> 'running')
    order by created_at asc limit p_limit
  )
  update public.agent_tool_calls target
  set input = null, output = null
  from candidates
  where target.id = candidates.id;
  get diagnostics tool_calls_count = row_count;

  with candidates as (
    select id from public.agent_context_snapshots
    where created_at < p_before
      and snapshot <> jsonb_build_object('retained', false, 'reason', 'retention')
      and run_id in (select id from public.agent_runs where status <> 'running')
    order by created_at asc limit p_limit
  )
  update public.agent_context_snapshots target
  set snapshot = jsonb_build_object('retained', false, 'reason', 'retention')
  from candidates
  where target.id = candidates.id;
  get diagnostics snapshots_count = row_count;

  with candidates as (
    select id from public.agent_query_runs
    where created_at < p_before
      and sql_text <> '/* sql purged by retention policy */'
      and run_id in (select id from public.agent_runs where status <> 'running')
    order by created_at asc limit p_limit
  )
  update public.agent_query_runs target
  set sql_text = '/* sql purged by retention policy */', tables_used = null
  from candidates
  where target.id = candidates.id;
  get diagnostics queries_count = row_count;

  with candidates as (
    select id from public.call_transcripts
    where created_at < p_before and is_current = false
    order by created_at asc limit p_limit
  )
  delete from public.call_transcripts target
  using candidates
  where target.id = candidates.id;
  get diagnostics transcripts_count = row_count;

  return jsonb_build_object(
    'agent_run_steps', steps_count,
    'agent_tool_calls', tool_calls_count,
    'agent_context_snapshots', snapshots_count,
    'agent_query_runs', queries_count,
    'old_transcripts_deleted', transcripts_count
  );
end;
$$;

revoke all on function private.purge_expired_ai_context(timestamptz, integer) from public;
grant execute on function private.purge_expired_ai_context(timestamptz, integer) to service_role;

comment on function private.purge_expired_ai_context(timestamptz, integer) is
  'Redacts old AI context and deletes only non-current old transcript versions while retaining metrics, approvals and outputs.';
