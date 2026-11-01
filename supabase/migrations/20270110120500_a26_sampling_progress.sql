create table if not exists public.a26_content_message_samples (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  message_id uuid not null,source_revision text not null,fingerprint text not null,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  sampled_at timestamptz not null default now(),primary key(store_id,message_id)
);
create index if not exists a26_content_message_samples_progress_idx on public.a26_content_message_samples(organization_id,store_id,fingerprint);
alter table public.a26_content_message_samples enable row level security;
revoke all on public.a26_content_message_samples from public,anon,authenticated;
grant select,insert,update,delete on public.a26_content_message_samples to service_role;

create or replace function public.a26_content_sampling_status(p_organization_id uuid,p_store_id uuid,p_fingerprint text)
returns jsonb language sql stable security invoker set search_path='' as $function$
  with accounts as (
    select k.id from public.klaviyo_accounts k join public.integration_connections c on c.id=k.connection_id
      and c.organization_id=k.organization_id where k.organization_id=p_organization_id and k.store_id=p_store_id
      and c.status in ('connected','syncing') and c.deletion_requested_at is null
  ), eligible as (
    select m.id from public.klaviyo_campaign_messages m join public.klaviyo_campaigns c on c.id=m.campaign_id
    join accounts k on k.id=c.account_id where lower(c.status) in ('sent','scheduled','sending') and lower(m.channel)='email'
      and lower(coalesce(m.status,'')) not in ('draft','archived','cancelled','canceled','deleted','disabled')
    union all
    select m.id from public.klaviyo_flow_messages m join public.klaviyo_flows f on f.id=m.flow_id
    join accounts k on k.id=f.account_id left join public.klaviyo_flow_actions a on a.id=m.action_id
    where lower(f.status) in ('live','active','manual') and lower(m.channel)='email'
      and lower(coalesce(m.status,'')) not in ('draft','archived','cancelled','canceled','deleted','disabled')
      and lower(coalesce(a.status,'')) not in ('draft','archived','cancelled','canceled','deleted','disabled')
  ), progress as (
    select count(*) as total,count(s.message_id) as sampled from eligible e
    left join public.a26_content_message_samples s on s.store_id=p_store_id and s.organization_id=p_organization_id
      and s.message_id=e.id and s.fingerprint=p_fingerprint
  ) select jsonb_build_object('eligible_count',total,'sample_count',sampled,'pending',sampled<total,
    'cursor',(select inventory_cursor from public.a26_content_run_claims where store_id=p_store_id and organization_id=p_organization_id)) from progress;
$function$;
revoke all on function public.a26_content_sampling_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.a26_content_sampling_status(uuid,uuid,text) to service_role;

create or replace function public.a26_sample_fingerprints(p_organization_id uuid,p_store_id uuid,p_messages jsonb)
returns jsonb language sql stable security invoker set search_path='' as $function$
  select coalesce(jsonb_object_agg(s.message_id::text,s.fingerprint),'{}'::jsonb) from public.a26_content_message_samples s
  where s.organization_id=p_organization_id and s.store_id=p_store_id
    and s.message_id in (select value::uuid from jsonb_array_elements_text(p_messages) limit 5000);
$function$;
revoke all on function public.a26_sample_fingerprints(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.a26_sample_fingerprints(uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
