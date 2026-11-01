-- A test/admin operation can reserve only its store, without leasing another pilot.
drop function if exists public.claim_a06_stock_events(integer);
create or replace function public.claim_a06_stock_events(batch_size integer default 5, target_store_id uuid default null)
returns setof public.a06_stock_event_queue
language sql security invoker set search_path = '' as $$
  with due as (
    select q.store_id from public.a06_stock_event_queue q
    join public.a06_stock_event_settings cfg on cfg.store_id = q.store_id and cfg.mode <> 'off'
    where q.revision > q.processed_revision and q.due_at <= now()
      and (target_store_id is null or q.store_id = target_store_id)
      and (q.lease_until is null or q.lease_until < now())
    order by q.due_at, q.store_id limit greatest(1, least(batch_size, 20))
    for update of q skip locked
  )
  update public.a06_stock_event_queue q set lease_token = gen_random_uuid(),
    lease_until = now() + interval '30 minutes', updated_at = now()
  from due where q.store_id = due.store_id returning q.*;
$$;
revoke all on function public.claim_a06_stock_events(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_a06_stock_events(integer, uuid) to service_role;
