create or replace function public.finish_a11_marketing_generation(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_status text,
  p_draft_id uuid default null,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed', 'failed') then return false; end if;
  update public.a11_marketing_generation_requests r
     set status = p_status,
         progress_stage = p_status,
         draft_id = case when p_status = 'completed' then p_draft_id else null end,
         last_error_code = case when p_status = 'failed' then left(coalesce(p_error_code, 'generation_failed'), 120) else null end,
         updated_at = now()
   where r.organization_id = p_organization_id
     and r.actor_user_id = p_actor_user_id
     and r.idempotency_key = left(coalesce(p_idempotency_key, ''), 64);
  return found;
end;
$$;

revoke all on function public.finish_a11_marketing_generation(uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.finish_a11_marketing_generation(uuid,uuid,text,text,uuid,text) to service_role;
