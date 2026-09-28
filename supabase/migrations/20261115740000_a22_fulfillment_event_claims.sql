-- Select only event-sync work that is due. Doing this in SQL prevents a fixed
-- page of already-complete fulfillments from starving all rows after it.
drop function if exists public.shopify_fulfillment_event_candidates(uuid, uuid, timestamptz);

create or replace function public.shopify_fulfillment_event_candidates(
  p_organization_id uuid,
  p_store_id uuid,
  p_created_after timestamptz
)
returns table (
  id uuid,
  external_fulfillment_id text,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  delivered_at timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_external_updated_at timestamptz,
  next_cursor text,
  event_count integer,
  sync_status text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    f.id,
    f.external_fulfillment_id::text,
    f.external_created_at,
    f.external_updated_at,
    f.delivered_at,
    s.last_attempt_at,
    s.last_success_at,
    s.last_external_updated_at,
    s.next_cursor,
    s.event_count,
    s.status::text as sync_status
  from public.shopify_fulfillments f
  left join public.shopify_fulfillment_event_sync_state s
    on s.fulfillment_id = f.id
    and s.organization_id = p_organization_id
    and s.store_id = p_store_id
  where f.organization_id = p_organization_id
    and f.store_id = p_store_id
    and (f.external_created_at >= p_created_after or f.delivered_at is null)
    and (
      s.fulfillment_id is null
      or s.last_external_updated_at is distinct from f.external_updated_at
      or s.status = 'partial'
      or (s.status = 'failed' and s.last_attempt_at <= now() - interval '30 minutes')
      or (
        f.delivered_at is null
        and (s.last_success_at is null or s.last_success_at <= now() - interval '24 hours')
      )
    )
  order by s.last_attempt_at asc nulls first, f.external_updated_at asc nulls first, f.id
  limit 20;
$function$;

revoke all on function public.shopify_fulfillment_event_candidates(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.shopify_fulfillment_event_candidates(uuid, uuid, timestamptz) to service_role;
