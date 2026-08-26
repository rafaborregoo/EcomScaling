-- OPS: purge only terminal webhook payloads after the retention window.
-- Received/queued/failed events stay available for processing or replay.

create or replace function private.purge_processed_webhook_events(
  p_before timestamptz,
  p_limit integer default 1000
)
returns integer
language plpgsql
set search_path = pg_catalog, private
as $$
declare
  deleted_count integer;
begin
  if p_before >= clock_timestamp() then
    raise exception 'purge_cutoff_must_be_in_the_past';
  end if;

  if p_limit < 1 or p_limit > 10000 then
    raise exception 'purge_limit_out_of_range';
  end if;

  with candidates as (
    select id
    from private.webhook_events
    where status in ('processed', 'ignored_duplicate')
      and received_at < p_before
    order by received_at asc
    limit p_limit
  )
  delete from private.webhook_events event
  using candidates
  where event.id = candidates.id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.purge_processed_webhook_events(timestamptz, integer) from public;
grant execute on function private.purge_processed_webhook_events(timestamptz, integer) to service_role;

comment on function private.purge_processed_webhook_events(timestamptz, integer) is
  'Deletes only terminal webhook payloads older than the retention cutoff; pending and failed events remain replayable.';
