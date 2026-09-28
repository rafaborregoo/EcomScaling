-- A24: relate the explicit conversion event configured on each ad set to
-- the pixel and event statistics we actually synced. Missing mapping or rows
-- are reported as unknown/coverage gaps, never as proof that tracking is broken.
drop function if exists public.meta_optimization_event_health(uuid, date, date, uuid);

create or replace function public.meta_optimization_event_health(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
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
  if target_organization_id is null
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
    from public.meta_insight_rows_daily r
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
      s.promoted_object ->> 'custom_event_type' as promoted_event_name,
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
      and (target_store_id is null or exists (
        select 1
        from public.meta_ad_accounts a
        where a.id = c.ad_account_id
          and a.organization_id = target_organization_id
          and a.store_id = target_store_id
      ))
  ),
  bounded_sets as (
    select scoped_sets.*, (count(*) over ())::bigint as scoped_set_count
    from scoped_sets
    order by spend desc, name, id
    limit 100
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
    s.scoped_set_count > 100,
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
      and lower(btrim(st.event_name)) = lower(btrim(s.promoted_event_name))
      and st.metric_date between period_start and period_end
  ) ev on true
  left join store_activity activity on true
  order by s.spend desc, s.name, s.id;
end;
$function$;

comment on function public.meta_optimization_event_health(uuid, date, date, uuid) is
  'A24 read-only bounded linkage between Meta ad-set promoted_object pixel/event and synced event coverage; missing mapping or rows are not classified as tracking failure.';

revoke all on function public.meta_optimization_event_health(uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function public.meta_optimization_event_health(uuid, date, date, uuid) to service_role;

with prompt_content as (
  select p.content || E'\n\n11. OBJETIVO Y EVENTO PROMOCIONADO (REGLA VIGENTE)\nUsa el bloque `meta_optimization_event_health` para alinear cada conjunto con el pixel/evento que Meta devuelve en `promoted_object`. No infieras Purchase a partir de `optimization_goal`, ni traduzcas automáticamente un objetivo genérico a un evento. Solo `mapped_event_observed` prueba que ese evento concreto apareció en las estadísticas sincronizadas durante la ventana. `mapped_event_not_observed_in_synced_window` es ausencia de observaciones, no prueba de que el pixel esté roto; `pixel_mapping_missing`, `event_mapping_not_explicit`, `custom_conversion_event_unresolved` o `mapped_pixel_not_synced` significan que no se puede verificar el vínculo. `pixel_reported_unavailable` sí es un estado explícito informado por Meta, pero separa ese hecho de cualquier afirmación causal sobre ventas/ROAS. Declara siempre objetivo, evento, ventana, frescura y limitaciones.' as content
  from public.prompt_versions p
  where p.code = 'a24_medicion_meta_system' and p.version = 'v3'
)
insert into public.prompt_versions (code, version, content, checksum)
select 'a24_medicion_meta_system', 'v4', content, encode(sha256(content::bytea), 'hex')
from prompt_content
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a24_medicion_meta');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v4', 'claude-sonnet-5', 'a24_medicion_meta_system', 'v4', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a24_medicion_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;

with prompt_content as (
  select p.content || E'\n\n12. ACTIVIDAD DE LA TIENDA Y FRESCURA DE FUENTES (REGLA VIGENTE)\n`store_activity_evidence=activity_observed` significa que se observaron sesiones Shopify y/o pedidos Shopify en fuentes con sync reciente; no demuestra que Meta Pixel/CAPI mida correctamente ni que la diferencia de atribución sea causal. `no_activity_observed_in_fresh_sources` solo describe ausencia de sesiones/pedidos en las fuentes leídas en esta ventana: no afirmes que el negocio carece de actividad fuera de esos datos. `unknown_or_incomplete` obliga a abstenerse de un veredicto de salud. Si `sessions_sync_state` es `reports_scope_missing`, `stale`, `sync_failed`, `connection_missing` o `sync_unknown`, no uses sus ceros como evidencia de inactividad; aplica lo mismo al sync de pedidos. `source_rows` y `records_read` describen cobertura, no actividad. El corte `fresh` es hasta 48 h. La conciliación Meta–Shopify sirve para señalar diferencias y pedir revisión; no exijas equivalencia 1:1 por ventanas, zona horaria, consentimiento, atribución y retraso de reporting.' as content
  from public.prompt_versions p
  where p.code = 'a24_medicion_meta_system' and p.version = 'v4'
)
insert into public.prompt_versions (code, version, content, checksum)
select 'a24_medicion_meta_system', 'v5', content, encode(sha256(content::bytea), 'hex')
from prompt_content
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a24_medicion_meta');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v5', 'claude-sonnet-5', 'a24_medicion_meta_system', 'v5', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a24_medicion_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
