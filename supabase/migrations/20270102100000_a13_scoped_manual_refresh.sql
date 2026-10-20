-- A13 manual refresh reservations are atomic per organization, Shopify store,
-- agent, and UTC day. The request key makes retries recover the same run.
alter table public.agent_manual_refresh_reservations
  add column if not exists store_id uuid references public.shopify_stores(id) on delete set null;

create index if not exists agent_manual_refresh_a13_scope_count_idx
  on public.agent_manual_refresh_reservations (organization_id, agent_code, store_id, reserved_at desc);

create or replace function public.reserve_a13_manual_refresh(
  p_run_id uuid,
  p_organization_id uuid,
  p_agent_code text,
  p_daily_limit integer,
  p_request_key text default null,
  p_store_id uuid default null
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_reserved integer;
  v_runs integer;
begin
  if p_agent_code <> 'a13_operativa_shopify' then
    raise exception 'invalid_agent_code';
  end if;
  if p_store_id is not null and not exists (
    select 1 from public.shopify_stores s
    where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active
  ) then
    raise exception 'invalid_store_scope';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':' || p_agent_code || ':' || coalesce(p_store_id::text, 'all') || ':' || v_day_start::text, 0
  ));
  if p_request_key is not null and exists (
    select 1 from public.agent_manual_refresh_reservations r
    where r.organization_id = p_organization_id and r.agent_code = p_agent_code
      and r.reservation_day = v_day_start::date and r.request_key = p_request_key
      and r.store_id is not distinct from p_store_id
  ) then
    return 'duplicate';
  end if;

  select count(*) into v_runs
    from public.agent_runs r
    join public.agent_versions v on v.id = r.agent_version_id
    join public.agent_definitions d on d.id = v.definition_id
    where r.organization_id = p_organization_id and r.trigger_type = 'manual'
      and r.started_at >= v_day_start and d.code = p_agent_code
      and r.store_id is not distinct from p_store_id
      and not exists (select 1 from public.agent_manual_refresh_reservations q where q.run_id = r.id);
  select count(*) into v_reserved
    from public.agent_manual_refresh_reservations r
    where r.organization_id = p_organization_id and r.agent_code = p_agent_code
      and r.reserved_at >= v_day_start and r.store_id is not distinct from p_store_id;
  if v_runs + v_reserved >= greatest(p_daily_limit, 0) then
    return 'limit';
  end if;

  insert into public.agent_manual_refresh_reservations(run_id, organization_id, agent_code, request_key, store_id)
  values (p_run_id, p_organization_id, p_agent_code, p_request_key, p_store_id)
  on conflict do nothing;
  return case when found then 'reserved' else 'duplicate' end;
end;
$$;

revoke all on function public.reserve_a13_manual_refresh(uuid, uuid, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_a13_manual_refresh(uuid, uuid, text, integer, text, uuid) to service_role;
