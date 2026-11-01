create or replace function public.reserve_a26_manual_refresh(
  p_run_id uuid, p_organization_id uuid, p_agent_code text, p_daily_limit integer,
  p_request_key text default null, p_store_id uuid default null
) returns text
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_reserved integer;
  v_runs integer;
begin
  if p_agent_code <> 'a26_medicion_meta' or p_store_id is null then raise exception 'invalid_a26_scope'; end if;
  if not exists (select 1 from public.shopify_stores s where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active) then
    raise exception 'invalid_store_scope';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':a26_medicion_meta:' || p_store_id::text || ':' || v_day_start::text, 0));
  if p_request_key is not null and exists (
    select 1 from public.agent_manual_refresh_reservations r
    where r.organization_id = p_organization_id and r.agent_code = p_agent_code
      and r.reservation_day = v_day_start::date and r.request_key = p_request_key and r.store_id = p_store_id
  ) then return 'duplicate'; end if;
  select count(*) into v_runs from public.agent_runs r
    join public.agent_versions v on v.id = r.agent_version_id
    join public.agent_definitions d on d.id = v.definition_id
    where r.organization_id = p_organization_id and r.trigger_type = 'manual'
      and r.started_at >= v_day_start and d.code = p_agent_code and r.store_id = p_store_id
      and not exists (select 1 from public.agent_manual_refresh_reservations q where q.run_id = r.id);
  select count(*) into v_reserved from public.agent_manual_refresh_reservations r
    where r.organization_id = p_organization_id and r.agent_code = p_agent_code
      and r.reserved_at >= v_day_start and r.store_id = p_store_id;
  if v_runs + v_reserved >= greatest(p_daily_limit, 0) then return 'limit'; end if;
  insert into public.agent_manual_refresh_reservations(run_id, organization_id, agent_code, request_key, store_id)
  values (p_run_id, p_organization_id, p_agent_code, p_request_key, p_store_id) on conflict do nothing;
  return case when found then 'reserved' else 'duplicate' end;
end;
$function$;
revoke all on function public.reserve_a26_manual_refresh(uuid,uuid,text,integer,text,uuid) from public, anon, authenticated;
grant execute on function public.reserve_a26_manual_refresh(uuid,uuid,text,integer,text,uuid) to service_role;

create table if not exists public.a26_content_run_claims (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid primary key references public.shopify_stores(id) on delete cascade,
  token uuid not null,source_fingerprint text not null,lease_until timestamptz not null,
  run_id uuid references public.agent_runs(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.a26_content_run_claims enable row level security;
revoke all on public.a26_content_run_claims from public,anon,authenticated;
grant select,insert,update,delete on public.a26_content_run_claims to service_role;

create table if not exists public.a26_render_receipts (
  render_id uuid primary key,organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  receipt jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists a26_render_receipts_scope_idx on public.a26_render_receipts(organization_id,store_id,created_at desc);
alter table public.a26_render_receipts enable row level security;
revoke all on public.a26_render_receipts from public,anon,authenticated;
grant select,insert,update,delete on public.a26_render_receipts to service_role;

create or replace function public.a26_content_activity_digest(p_organization_id uuid,p_store_id uuid)
returns text language sql stable security invoker set search_path='' as $function$
  with accounts as (
    select k.id,k.connection_id from public.klaviyo_accounts k
    join public.integration_connections c on c.id=k.connection_id and c.organization_id=k.organization_id
    where k.organization_id=p_organization_id and k.store_id=p_store_id and c.status in ('connected','syncing') and c.deletion_requested_at is null
  ), facts as (
    select 'c:'||c.id::text as key,md5((to_jsonb(c)-'updated_at'-'last_synced_at')::text) as digest
      from public.klaviyo_campaigns c join accounts k on k.id=c.account_id
    union all select 'm:'||m.id::text,md5((to_jsonb(m)-'updated_at'-'last_synced_at')::text)
      from public.klaviyo_campaign_messages m join public.klaviyo_campaigns c on c.id=m.campaign_id join accounts k on k.id=c.account_id
    union all select 'f:'||f.id::text,md5((to_jsonb(f)-'updated_at'-'last_synced_at'-'definition_graph_synced_at')::text)
      from public.klaviyo_flows f join accounts k on k.id=f.account_id
    union all select 'fm:'||m.id::text,md5((to_jsonb(m)-'updated_at'-'last_synced_at')::text)
      from public.klaviyo_flow_messages m join public.klaviyo_flows f on f.id=m.flow_id join accounts k on k.id=f.account_id
    union all select 't:'||t.id::text,md5(coalesce(t.html_content,'')||coalesce(t.text_content,''))
      from public.klaviyo_templates t join accounts k on k.id=t.account_id
    union all select 'brand:'||b.id::text,md5(to_jsonb(b)::text) from public.marketing_brand_profiles b
      where b.organization_id=p_organization_id and (b.store_id=p_store_id or b.store_id is null)
    union all select 'plan:'||p.id::text,md5(to_jsonb(p)::text) from public.strategic_plans p
      where p.organization_id=p_organization_id and p.store_id=p_store_id and p.status='active'
    union all select 'version:'||v.id::text,md5(v.version::text||v.prompt_version::text) from public.agent_versions v
      join public.agent_definitions d on d.id=v.definition_id where d.code='a26_contenido_email' and v.is_active
  ) select md5(coalesce(string_agg(key||digest,',' order by key),'empty')) from facts;
$function$;
revoke all on function public.a26_content_activity_digest(uuid,uuid) from public,anon,authenticated;
grant execute on function public.a26_content_activity_digest(uuid,uuid) to service_role;

create or replace function public.a26_claim_content_run(p_organization_id uuid,p_store_id uuid,p_token uuid,p_fingerprint text)
returns text language plpgsql security invoker set search_path='' as $function$
begin
  if not exists(select 1 from public.shopify_stores s where s.id=p_store_id and s.organization_id=p_organization_id and s.is_active)
    then raise exception 'A26_STORE_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||':a26-run',0));
  if exists(select 1 from public.a26_content_run_claims c where c.store_id=p_store_id and c.lease_until>now()) then return 'busy'; end if;
  insert into public.a26_content_run_claims(organization_id,store_id,token,source_fingerprint,lease_until)
    values(p_organization_id,p_store_id,p_token,p_fingerprint,now()+interval '15 minutes')
    on conflict(store_id) do update set token=excluded.token,source_fingerprint=excluded.source_fingerprint,
      lease_until=excluded.lease_until,updated_at=now();
  return 'claimed';
end;
$function$;
revoke all on function public.a26_claim_content_run(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.a26_claim_content_run(uuid,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';

