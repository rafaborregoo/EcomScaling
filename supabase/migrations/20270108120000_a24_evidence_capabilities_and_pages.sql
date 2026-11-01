-- A24 completion: independently paged evidence; legacy A25/A14 RPC contracts stay intact.
-- One canonical insight representation is shared with A23. Coverage is distinct from quality.
drop function if exists public.meta_measurement_event_page(uuid,date,date,uuid,uuid,integer);
create or replace function public.meta_measurement_event_page(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid,
  after_ad_set_id uuid default null,
  page_size integer default 100
)
returns table(
  ad_set_id uuid,
  ad_set_name text,
  campaign_name text,
  effective_status text,
  optimization_goal text,
  billing_event text,
  destination_type text,
  promoted_pixel_external_id text,
  promoted_event_name text,
  custom_conversion_id text,
  mapping_status text,
  pixel_id uuid,
  pixel_name text,
  pixel_unavailable boolean,
  pixel_last_fired_at timestamptz,
  pixel_last_synced_at timestamptz,
  matched_event_total bigint,
  matched_event_last_date date,
  spend_in_period numeric,
  eligible_ad_set_count bigint,
  ad_set_rows_truncated boolean,
  store_sessions_total bigint,
  store_active_session_days bigint,
  store_session_source_rows bigint,
  store_latest_session_date date,
  sessions_sync_state text,
  sessions_sync_finished_at timestamptz,
  sessions_sync_records_read integer,
  store_orders_total bigint,
  store_order_days bigint,
  store_order_fact_rows bigint,
  store_latest_order_date date,
  orders_sync_state text,
  orders_sync_finished_at timestamptz,
  orders_sync_records_read integer,
  store_activity_evidence text
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if target_organization_id is null or target_store_id is null
     or period_start is null
     or period_end is null
     or period_end < period_start
     or period_end - period_start > 90
     or period_end > current_date then
    raise exception 'invalid_meta_optimization_event_health_input';
  end if;

  return query
  with spend_by_set as (
    select r.ad_set_id, sum(r.spend)::numeric as spend
    from private.a23_meta_insight_rows_canonical r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_set_id is not null
      and r.metric_date between period_start and period_end
    group by r.ad_set_id
  ),
  scoped_sets as (
    select
      s.id,
      s.name,
      s.effective_status,
      s.optimization_goal,
      s.billing_event,
      s.destination_type,
      s.promoted_object ->> 'pixel_id' as promoted_pixel_external_id,
      coalesce(s.promoted_object ->> 'custom_event_str', s.promoted_object ->> 'custom_event_type') as promoted_event_name,
      s.promoted_object ->> 'custom_conversion_id' as custom_conversion_id,
      s.last_synced_at,
      c.name as campaign_name,
      c.ad_account_id,
      coalesce(sp.spend, 0)::numeric as spend
    from public.meta_ad_sets s
    join public.meta_campaigns c
      on c.id = s.campaign_id and c.organization_id = target_organization_id
    left join spend_by_set sp on sp.ad_set_id = s.id
    where s.organization_id = target_organization_id
      and exists (select 1 from public.meta_ad_accounts selected where selected.id = c.ad_account_id and selected.organization_id = target_organization_id and selected.is_active and selected.is_selected)
      and (target_store_id is null or exists (
        select 1
        from public.meta_ad_accounts a
        where a.id = c.ad_account_id
          and a.organization_id = target_organization_id
          and a.store_id = target_store_id
      ))
  ),
  counted_sets as (
    select scoped_sets.*, (count(*) over ())::bigint as scoped_set_count from scoped_sets
  ),
  bounded_sets as (
    select * from counted_sets
    where after_ad_set_id is null or counted_sets.id > after_ad_set_id
    order by id
    limit greatest(1, least(coalesce(page_size, 100), 200))
  ),
  store_scope as (
    select st.id as store_id, ic.id as connection_id, ic.scopes
    from public.shopify_stores st
    left join public.integration_connections ic
      on ic.id = st.connection_id
     and ic.organization_id = target_organization_id
     and ic.provider = 'shopify'
    where target_store_id is not null
      and st.id = target_store_id
      and st.organization_id = target_organization_id
  ),
  store_sessions as (
    select
      count(*)::bigint as source_rows,
      coalesce(sum(d.sessions), 0)::bigint as sessions_total,
      count(*) filter (where d.sessions > 0)::bigint as active_session_days,
      max(d.bucket_date) as latest_session_date
    from public.shopify_sessions_daily d
    where d.organization_id = target_organization_id
      and d.store_id = target_store_id
      and d.bucket_date between period_start and period_end
  ),
  store_orders as (
    select
      count(*)::bigint as source_rows,
      count(*)::bigint as orders_total,
      count(distinct coalesce(f.processed_at, f.external_created_at)::date)::bigint as order_days,
      max(coalesce(f.processed_at, f.external_created_at)::date) as latest_order_date
    from public.shopify_order_facts f
    where f.organization_id = target_organization_id
      and f.store_id = target_store_id
      and f.is_test_order = false
      and f.cancelled_at is null
      and coalesce(f.processed_at, f.external_created_at)::date between period_start and period_end
  ),
  store_activity as (
    select
      ss.sessions_total,
      ss.active_session_days,
      ss.source_rows as session_source_rows,
      ss.latest_session_date,
      case
        when scope.connection_id is null then 'connection_missing'
        when not ('read_reports' = any(coalesce(scope.scopes, array[]::text[]))) then 'reports_scope_missing'
        when session_run.finished_at is null then 'sync_unknown'
        when session_run.status <> 'succeeded' then 'sync_failed'
        when session_run.finished_at < now() - interval '48 hours' then 'stale'
        else 'fresh'
      end::text as sessions_sync_state,
      session_run.finished_at as sessions_sync_finished_at,
      session_run.records_read as sessions_sync_records_read,
      so.orders_total,
      so.order_days,
      so.source_rows as order_fact_rows,
      so.latest_order_date,
      case
        when scope.connection_id is null then 'connection_missing'
        when order_run.finished_at is null then 'sync_unknown'
        when order_run.status <> 'succeeded' then 'sync_failed'
        when order_run.finished_at < now() - interval '48 hours' then 'stale'
        else 'fresh'
      end::text as orders_sync_state,
      order_run.finished_at as orders_sync_finished_at,
      order_run.records_read as orders_sync_records_read,
      case
        when session_run.status = 'succeeded'
         and session_run.finished_at >= now() - interval '48 hours'
         and 'read_reports' = any(coalesce(scope.scopes, array[]::text[]))
         and session_run.records_read > 0
         and coalesce(ss.sessions_total, 0) = 0
         and order_run.status = 'succeeded'
         and order_run.finished_at >= now() - interval '48 hours'
         and order_run.records_read > 0
         and coalesce(so.orders_total, 0) = 0
          then 'no_activity_observed_in_fresh_sources'
        when (session_run.status = 'succeeded'
          and session_run.finished_at >= now() - interval '48 hours'
          and session_run.records_read > 0
          and 'read_reports' = any(coalesce(scope.scopes, array[]::text[]))
          and coalesce(ss.sessions_total, 0) > 0)
          or (order_run.status = 'succeeded'
          and order_run.finished_at >= now() - interval '48 hours'
          and order_run.records_read > 0
          and coalesce(so.orders_total, 0) > 0)
          then 'activity_observed'
        else 'unknown_or_incomplete'
      end::text as activity_evidence
    from store_scope scope
    cross join store_sessions ss
    cross join store_orders so
    left join lateral (
      select r.status, r.finished_at, r.records_read
      from public.integration_sync_runs r
      where r.connection_id = scope.connection_id
        and r.organization_id = target_organization_id
        and r.provider = 'shopify'
        and r.sync_scope = 'sessions'
      order by r.created_at desc
      limit 1
    ) session_run on true
    left join lateral (
      select r.status, r.finished_at, r.records_read
      from public.integration_sync_runs r
      where r.connection_id = scope.connection_id
        and r.organization_id = target_organization_id
        and r.provider = 'shopify'
        and r.sync_scope = 'orders'
      order by r.created_at desc
      limit 1
    ) order_run on true
  )
  select
    s.id,
    s.name::text,
    s.campaign_name::text,
    s.effective_status::text,
    s.optimization_goal::text,
    s.billing_event::text,
    s.destination_type::text,
    s.promoted_pixel_external_id::text,
    s.promoted_event_name::text,
    s.custom_conversion_id::text,
    case
      when nullif(s.promoted_pixel_external_id, '') is null and s.destination_type in ('APP','MESSENGER','WHATSAPP','INSTAGRAM_DIRECT') then 'pixel_not_applicable_for_destination'
      when nullif(s.promoted_pixel_external_id, '') is null then 'pixel_mapping_missing'
      when p.id is null then 'mapped_pixel_not_synced'
      when nullif(s.promoted_event_name, '') is null
        then case when nullif(s.custom_conversion_id, '') is not null
          then 'custom_conversion_event_unresolved'
          else 'event_mapping_not_explicit' end
      when p.is_unavailable is true then 'pixel_reported_unavailable'
      when coalesce(ev.events_total, 0) > 0 then 'mapped_event_observed'
      else 'mapped_event_not_observed_in_synced_window'
    end::text,
    p.id,
    p.name::text,
    p.is_unavailable,
    p.last_fired_at,
    p.last_synced_at,
    ev.events_total,
    ev.last_event_date,
    s.spend,
    s.scoped_set_count,
    s.scoped_set_count > greatest(1, least(coalesce(page_size, 100), 200)),
    activity.sessions_total,
    activity.active_session_days,
    activity.session_source_rows,
    activity.latest_session_date,
    activity.sessions_sync_state,
    activity.sessions_sync_finished_at,
    activity.sessions_sync_records_read,
    activity.orders_total,
    activity.order_days,
    activity.order_fact_rows,
    activity.latest_order_date,
    activity.orders_sync_state,
    activity.orders_sync_finished_at,
    activity.orders_sync_records_read,
    activity.activity_evidence
  from bounded_sets s
  left join public.meta_pixels p
    on p.organization_id = target_organization_id
   and p.ad_account_id = s.ad_account_id
   and p.external_pixel_id = s.promoted_pixel_external_id
  left join lateral (
    select sum(st.event_count)::bigint as events_total,
           max(st.metric_date) as last_event_date
    from public.meta_pixel_daily_stats st
    where st.organization_id = target_organization_id
      and st.pixel_id = p.id
      and (case regexp_replace(upper(btrim(st.event_name)), '[^A-Z0-9]', '', 'g') when 'INITIATEDCHECKOUT' then 'INITIATECHECKOUT' when 'CONTENTVIEW' then 'VIEWCONTENT' else regexp_replace(upper(btrim(st.event_name)), '[^A-Z0-9]', '', 'g') end)
        = (case regexp_replace(upper(btrim(s.promoted_event_name)), '[^A-Z0-9]', '', 'g') when 'INITIATEDCHECKOUT' then 'INITIATECHECKOUT' when 'CONTENTVIEW' then 'VIEWCONTENT' else regexp_replace(upper(btrim(s.promoted_event_name)), '[^A-Z0-9]', '', 'g') end)
      and st.metric_date between period_start and period_end
  ) ev on true
  left join store_activity activity on true
  order by s.id;
end;
$function$;
revoke all on function public.meta_measurement_event_page(uuid,date,date,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.meta_measurement_event_page(uuid,date,date,uuid,uuid,integer) to service_role;

drop function if exists public.meta_measurement_issue_page(uuid,date,date,uuid,uuid,integer);
create or replace function public.meta_measurement_issue_page(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid,
  after_issue_id uuid default null,
  page_size integer default 100
)
returns table (
  issue_id uuid,
  ad_id uuid,
  ad_name text,
  ad_effective_status text,
  ad_set_id uuid,
  ad_set_name text,
  campaign_id uuid,
  campaign_name text,
  ad_account_id uuid,
  account_name text,
  store_id uuid,
  issue_level text,
  error_code integer,
  error_type text,
  error_summary text,
  review_category text,
  detected_at timestamptz,
  account_last_synced_at timestamptz,
  freshness text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if target_organization_id is null or target_store_id is null
     or period_start is null or period_end is null
     or period_end < period_start
     or period_end - period_start > 90
     or period_end > current_date then
    raise exception 'invalid_meta_scoped_review_issues_input';
  end if;

  return query
  select
    i.id,
    d.id,
    d.name::text,
    d.effective_status::text,
    s.id,
    s.name::text,
    c.id,
    c.name::text,
    a.id,
    a.account_name::text,
    a.store_id,
    i.level::text,
    i.error_code,
    i.error_type::text,
    left(i.error_summary, 400),
    case
      when lower(coalesce(d.effective_status,'')) in ('rejected','disapproved') or lower(coalesce(d.review_feedback::text,'')) ~ '(rejected|disapproved|not approved)' then 'rejected'
      when lower(concat_ws(' ', i.level, i.error_type)) ~ '(^|[^a-z])(reject(ed|ion)?|disapprov(ed|al)?)([^a-z]|$)' then 'rejected'
      when lower(concat_ws(' ', i.level, i.error_type)) ~ '(^|[^a-z])(limit(ed|ation)?|delivery)([^a-z]|$)' then 'limited_or_delivery'
      when lower(concat_ws(' ', i.level, i.error_type)) ~ '(^|[^a-z])(warning|warn)([^a-z]|$)' then 'warning'
      when lower(concat_ws(' ', i.level, i.error_type)) ~ '(^|[^a-z])(error|technical|invalid)([^a-z]|$)' then 'technical_issue'
      else 'unclassified_issue'
    end,
    i.detected_at,
    a.last_synced_at,
    case
      when a.last_synced_at is null then 'unknown_sync'
      when a.last_synced_at < now() - interval '24 hours' then 'stale'
      else 'fresh'
    end
  from public.meta_ad_issues i
  join public.meta_ads d
    on d.id = i.ad_id and d.organization_id = target_organization_id
  join public.meta_ad_sets s
    on s.id = d.ad_set_id and s.organization_id = target_organization_id
  join public.meta_campaigns c
    on c.id = s.campaign_id and c.organization_id = target_organization_id
  join public.meta_ad_accounts a
    on a.id = c.ad_account_id and a.organization_id = target_organization_id
  where i.organization_id = target_organization_id
    and i.resolved_at is null
    and a.is_selected and a.is_active
    and (after_issue_id is null or i.id > after_issue_id)
    and (target_store_id is null or a.store_id = target_store_id)
  order by i.id
  limit greatest(1, least(coalesce(page_size, 100), 200));
end;
$$;
revoke all on function public.meta_measurement_issue_page(uuid,date,date,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.meta_measurement_issue_page(uuid,date,date,uuid,uuid,integer) to service_role;

create index if not exists meta_measurement_set_day_idx on public.meta_insight_rows_daily(organization_id,ad_set_id,metric_date)
  where level='ad' and breakdown_hash='none';
create index if not exists meta_measurement_open_issue_page_idx on public.meta_ad_issues(organization_id,id)
  where resolved_at is null;

-- A sync completed after collection started invalidates the pending writer too.
create or replace function public.meta_save_measurement_verdict(p_verdict jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $function$
declare evaluated timestamptz; org uuid; store uuid; status_value text;
begin
  if p_verdict is null or jsonb_typeof(p_verdict)<>'object' then raise exception 'invalid_a24_verdict'; end if;
  org:=(p_verdict->>'organization_id')::uuid; store:=(p_verdict->>'store_id')::uuid;
  evaluated:=(p_verdict->>'evaluated_at')::timestamptz; status_value:=p_verdict->>'verdict_status';
  if org is null or store is null or evaluated is null or evaluated>now()
    or p_verdict->>'source_fingerprint' is null or p_verdict->>'period_start' is null or p_verdict->>'period_end' is null
    or (p_verdict->>'expires_at')::timestamptz <= now()
    or (p_verdict->>'expires_at')::timestamptz > evaluated+interval '1 hour'
    or status_value is null or status_value not in ('usable_with_attribution_limits','restricted','not_assessable','unknown')
    or (p_verdict->'verdict'->>'status') is distinct from status_value then raise exception 'invalid_a24_verdict'; end if;
  if not exists(select 1 from public.shopify_stores s where s.id=store and s.organization_id=org and s.is_active) then return false; end if;
  if exists(select 1 from public.meta_ad_accounts a where a.organization_id=org and a.store_id=store and a.is_active and a.is_selected
    and (a.last_synced_at>evaluated or exists(select 1 from public.integration_sync_runs r
      where r.organization_id=org and r.connection_id=a.connection_id and r.finished_at>evaluated))) then return false; end if;
  if exists(select 1 from public.meta_pixel_sync_receipts r join public.meta_pixels p on p.id=r.pixel_id
    join public.meta_ad_accounts a on a.id=p.ad_account_id where r.organization_id=org and a.organization_id=org
      and a.store_id=store and a.is_selected and a.is_active and r.completed_at>evaluated) then return false; end if;
  insert into public.meta_measurement_verdict_cache(organization_id,store_id,period_start,period_end,verdict_version,verdict_status,verdict,evaluated_at,expires_at,source_fingerprint)
  values(org,store,(p_verdict->>'period_start')::date,(p_verdict->>'period_end')::date,p_verdict->>'verdict_version',status_value,
    p_verdict->'verdict',evaluated,(p_verdict->>'expires_at')::timestamptz,p_verdict->>'source_fingerprint')
  on conflict(organization_id,store_id,period_start,period_end,verdict_version) do update set
    verdict_status=excluded.verdict_status,verdict=excluded.verdict,evaluated_at=excluded.evaluated_at,
    expires_at=excluded.expires_at,source_fingerprint=excluded.source_fingerprint,updated_at=now()
  where public.meta_measurement_verdict_cache.evaluated_at <= excluded.evaluated_at;
  return found;
end;
$function$;
revoke all on function public.meta_save_measurement_verdict(jsonb) from public,anon,authenticated;
grant execute on function public.meta_save_measurement_verdict(jsonb) to service_role;

create or replace function public.meta_record_measurement_assessment(target_organization_id uuid,target_store_id uuid,assessment jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare status_value text; codes jsonb; key_value text; inserted_id uuid;
begin
  if target_organization_id is null or target_store_id is null or assessment is null or jsonb_typeof(assessment)<>'object'
     or not exists(select 1 from public.shopify_stores s where s.id=target_store_id and s.organization_id=target_organization_id) then
    raise exception 'invalid_meta_measurement_incident_scope'; end if;
  if not exists (
    select 1 from public.meta_measurement_verdict_cache c
    where c.organization_id=target_organization_id and c.store_id=target_store_id
      and c.expires_at > now() and c.evaluated_at <= now()
      and c.source_fingerprint=meta_record_measurement_assessment.assessment->>'source_fingerprint'
      and c.evaluated_at=(meta_record_measurement_assessment.assessment->>'evaluated_at')::timestamptz
      and c.verdict_status=meta_record_measurement_assessment.assessment->>'status'
  ) then return jsonb_build_object('status','assessment_not_current'); end if;
  status_value:=assessment->>'status';
  if status_value is null or status_value not in ('usable_with_attribution_limits','restricted','not_assessable','unknown') then raise exception 'invalid_meta_measurement_status'; end if;
  if status_value='usable_with_attribution_limits' then
    update public.meta_measurement_incidents i set status='resolved',resolved_at=now(),last_seen_at=now(),assessment=meta_record_measurement_assessment.assessment,
      source_fingerprint=meta_record_measurement_assessment.assessment->>'source_fingerprint',updated_at=now()
    where i.organization_id=target_organization_id and i.store_id=target_store_id and i.status='open';
    return jsonb_build_object('status','resolved_open_incidents');
  end if;
  if status_value<>'restricted' then return jsonb_build_object('status','no_incident_transition'); end if;
  codes:=coalesce(assessment->'reason_codes','[]'::jsonb);
  select md5(coalesce(string_agg(value,'|' order by value),'')) into key_value from jsonb_array_elements_text(codes) x(value);
  if key_value is null or key_value=md5('') then return jsonb_build_object('status','no_incident_reason'); end if;
  insert into public.meta_measurement_incidents(organization_id,store_id,incident_key,status,reason_codes,assessment,source_fingerprint)
  values(target_organization_id,target_store_id,key_value,'open',codes,assessment,assessment->>'source_fingerprint')
  on conflict(organization_id,store_id,incident_key) do update set status='open',reason_codes=excluded.reason_codes,
    assessment=excluded.assessment,source_fingerprint=excluded.source_fingerprint,last_seen_at=now(),resolved_at=null,updated_at=now()
  returning id into inserted_id;
  return jsonb_build_object('status','open','incident_id',inserted_id,'incident_key',key_value);
end;
$function$;
revoke all on function public.meta_record_measurement_assessment(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.meta_record_measurement_assessment(uuid,uuid,jsonb) to service_role;

insert into public.prompt_versions(code,version,content,checksum)
select code,'v10', content || E'\n\nCOBERTURA: interpreta capability_matrix y measurement_engine del servidor. Una capacidad requires_external_verification exige comprobación autorizada en Events Manager, no demuestra CAPI, deduplicación ni calidad. La actividad Shopify es contexto de cobertura, nunca equivalencia causal 1:1. meta_delivery_health permite paginar con after_ad_set_id/after_issue_id y page_size; conserva los IDs del cursor y la tienda del contexto. La presentación inicial resume entidades; investiga la siguiente página cuando lo necesites.',
  encode(sha256((content || E'\n\nCOBERTURA: interpreta capability_matrix y measurement_engine del servidor. Una capacidad requires_external_verification exige comprobación autorizada en Events Manager, no demuestra CAPI, deduplicación ni calidad. La actividad Shopify es contexto de cobertura, nunca equivalencia causal 1:1. meta_delivery_health permite paginar con after_ad_set_id/after_issue_id y page_size; conserva los IDs del cursor y la tienda del contexto. La presentación inicial resume entidades; investiga la siguiente página cuando lo necesites.')::bytea),'hex')
from public.prompt_versions where code='a24_medicion_meta_system' and version='v9'
on conflict(code,version) do update set content=excluded.content,checksum=excluded.checksum;
insert into public.agent_versions(definition_id,version,model,prompt_code,prompt_version,allowed_tools,approval_mode,is_active)
select definition_id,'v10',model,prompt_code,'v10',allowed_tools,approval_mode,false from public.agent_versions
where definition_id=(select id from public.agent_definitions where code='a24_medicion_meta') and version='v9'
on conflict(definition_id,version) do update set prompt_version=excluded.prompt_version,allowed_tools=excluded.allowed_tools;
select public.promote_agent_version(v.id) from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id
where d.code='a24_medicion_meta' and v.version='v10';
notify pgrst,'reload schema';
