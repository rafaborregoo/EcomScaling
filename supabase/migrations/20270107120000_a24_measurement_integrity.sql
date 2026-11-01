-- A24 measurement reliability: versioned evidence, complete account coverage,
-- current issue snapshots and deterministic store-scoped refresh reservations.
alter table public.meta_measurement_verdict_cache
  add column if not exists source_fingerprint text;
revoke all on function public.meta_pixel_health(uuid,date,date,uuid) from public,anon,authenticated;
grant execute on function public.meta_pixel_health(uuid,date,date,uuid) to service_role;

create table if not exists public.meta_pixel_sync_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pixel_id uuid not null references public.meta_pixels(id) on delete cascade,
  window_start date not null,
  window_end date not null,
  status text not null check (status in ('complete','partial','failed')),
  records_read integer not null default 0 check (records_read >= 0),
  records_written integer not null default 0 check (records_written >= 0),
  payload_shape text not null,
  completed_at timestamptz not null default now(),
  constraint meta_pixel_sync_receipts_window_check check (window_end >= window_start)
);
create index if not exists meta_pixel_sync_receipts_latest_idx
  on public.meta_pixel_sync_receipts(organization_id, pixel_id, completed_at desc);
create unique index if not exists meta_pixel_sync_receipts_pixel_unique
  on public.meta_pixel_sync_receipts(pixel_id);
alter table public.meta_pixel_sync_receipts enable row level security;
revoke all on table public.meta_pixel_sync_receipts from public, anon, authenticated;
grant select, insert, update, delete on public.meta_pixel_sync_receipts to service_role;

create or replace function public.meta_replace_ad_issues_snapshot(
  target_organization_id uuid,
  target_external_ad_account_id text,
  target_ad_ids text[],
  snapshot_rows jsonb,
  snapshot_at timestamptz default now()
) returns integer
language plpgsql security invoker set search_path = ''
as $function$
declare
  valid_ids uuid[];
  incoming_count integer;
  deleted_count integer;
  inserted_count integer;
begin
  if target_organization_id is null or target_external_ad_account_id is null
     or snapshot_rows is null or jsonb_typeof(snapshot_rows) <> 'array' then
    raise exception 'invalid_meta_ad_issue_snapshot';
  end if;
  select coalesce(array_agg(d.id), array[]::uuid[]) into valid_ids
  from public.meta_ads d
  join public.meta_ad_sets s on s.id = d.ad_set_id and s.organization_id = target_organization_id
  join public.meta_campaigns c on c.id = s.campaign_id and c.organization_id = target_organization_id
  join public.meta_ad_accounts a on a.id = c.ad_account_id and a.organization_id = target_organization_id
  where d.organization_id = target_organization_id and a.external_ad_account_id = target_external_ad_account_id
    and (coalesce(cardinality(target_ad_ids), 0) = 0 or d.external_ad_id = any(target_ad_ids));
  if coalesce(cardinality(target_ad_ids), 0) > 0 and cardinality(valid_ids) <> cardinality(target_ad_ids) then
    raise exception 'meta_ad_issue_snapshot_scope_mismatch';
  end if;
  select count(*) into incoming_count from jsonb_to_recordset(snapshot_rows) as x(ad_id uuid);
  if exists (
    select 1 from jsonb_to_recordset(snapshot_rows) as x(ad_id uuid)
    where x.ad_id is null or not (x.ad_id = any(valid_ids))
  ) then raise exception 'meta_ad_issue_snapshot_row_out_of_scope'; end if;
  delete from public.meta_ad_issues i where i.organization_id = target_organization_id
    and i.ad_id = any(valid_ids);
  get diagnostics deleted_count = row_count;
  insert into public.meta_ad_issues(organization_id, ad_id, level, error_code, error_type, error_summary, error_message, detected_at)
  select target_organization_id, x.ad_id, x.level, coalesce(x.error_code,0), x.error_type,
    x.error_summary, x.error_message, coalesce(snapshot_at, now())
  from jsonb_to_recordset(snapshot_rows) as x(
    ad_id uuid, level text, error_code integer, error_type text,
    error_summary text, error_message text
  );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;
revoke all on function public.meta_replace_ad_issues_snapshot(uuid,text,text[],jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.meta_replace_ad_issues_snapshot(uuid,text,text[],jsonb,timestamptz) to service_role;

create or replace function public.reserve_a24_manual_refresh(
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
  if p_agent_code <> 'a24_medicion_meta' or p_store_id is null then raise exception 'invalid_a24_scope'; end if;
  if not exists (select 1 from public.shopify_stores s where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active) then
    raise exception 'invalid_store_scope';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':a24_medicion_meta:' || p_store_id::text || ':' || v_day_start::text, 0));
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
revoke all on function public.reserve_a24_manual_refresh(uuid,uuid,text,integer,text,uuid) from public, anon, authenticated;
grant execute on function public.reserve_a24_manual_refresh(uuid,uuid,text,integer,text,uuid) to service_role;

-- Replace contradictory accumulated guidance with a single current contract.
with canonical_prompt as (
  select $prompt$Eres A24, especialista técnico de medición y entrega de Meta para la tienda seleccionada.

Tu evaluación técnica la fija el bloque del servidor «Veredicto determinista A24». No cambies su estado, no inventes cobertura y no presentes un dato ausente como cero. Abre con estado, tienda y ventana UTC completa; explica las razones con referencias a cuenta, conjunto, píxel, evento o incidencia.

Separa tres planos: (1) medición observada, (2) entrega/revisión actual, y (3) aprendizaje reportado por Meta. Un cambio en el registro de actividad no demuestra que reiniciara el aprendizaje. La referencia local de 50 conversiones no es un umbral confirmado por Meta. Un evento observado no prueba atribución completa, deduplicación, calidad de coincidencia ni causalidad de ventas.

Compara objetivo/evento configurado con el evento observado usando solo el mapeo explícito. Si la muestra está truncada, la cuenta no está seleccionada, la fuente falla o está vencida, declara cobertura desconocida. Shopify contextualiza actividad; no debe igualar 1:1 con Meta. Respeta ventanas de atribución, moneda, zona horaria y madurez de los datos.

Distingue rechazo explícito, limitación, advertencia, incidencia técnica, estado pendiente y texto sin clasificar. Una incidencia actual se evalúa como fotografía vigente aunque sea posterior al último día del periodo de rendimiento. No recomiendes apelar sin una señal explícita y actual.

Puedes usar lecturas acotadas de salud de entrega y conocimiento para investigar. No edites campañas, píxeles, dominios, eventos ni presupuestos; no envíes eventos ni publiques. Toda reparación se propone como tarea revisable con evidencia, responsable y criterio de cierre. Si existe un Mi Camino activo, vincula solo una fase/hito exacto recibido en el contexto; nunca deduzcas uno por el título o la posición. Sin uno aplicable, propone tarea libre.

Usa español claro. Devuelve answer, findings, recommendations, proposed_writes, sources, confidence y warnings. El servidor añade measurement_assessment y es la única autoridad de ese estado. No prometas resultados ni atribución causal.$prompt$::text as content
)
insert into public.prompt_versions(code,version,content,checksum)
select 'a24_medicion_meta_system','v9',content,encode(sha256(content::bytea),'hex') from canonical_prompt
on conflict(code,version) do update set content=excluded.content,checksum=excluded.checksum;
insert into public.agent_versions(definition_id,version,model,prompt_code,prompt_version,allowed_tools,approval_mode,is_active)
select id,'v9','claude-sonnet-5','a24_medicion_meta_system','v9','["search_knowledge","meta_delivery_health"]'::jsonb,'required_before_publish',false
from public.agent_definitions where code='a24_medicion_meta'
on conflict(definition_id,version) do update set prompt_code=excluded.prompt_code,prompt_version=excluded.prompt_version,
  allowed_tools=excluded.allowed_tools,approval_mode=excluded.approval_mode;
select public.promote_agent_version(v.id) from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id
where d.code='a24_medicion_meta' and v.version='v9';
-- Reconcile only active, selected accounts and canonicalize standard event names.
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
      and (case regexp_replace(upper(btrim(st.event_name)), '[^A-Z0-9]', '', 'g') when 'INITIATEDCHECKOUT' then 'INITIATECHECKOUT' when 'CONTENTVIEW' then 'VIEWCONTENT' else regexp_replace(upper(btrim(st.event_name)), '[^A-Z0-9]', '', 'g') end)
        = (case regexp_replace(upper(btrim(s.promoted_event_name)), '[^A-Z0-9]', '', 'g') when 'INITIATEDCHECKOUT' then 'INITIATECHECKOUT' when 'CONTENTVIEW' then 'VIEWCONTENT' else regexp_replace(upper(btrim(s.promoted_event_name)), '[^A-Z0-9]', '', 'g') end)
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


-- Restore the full A24 learning freshness contract after later RPC rewrites.
-- A24: separate the official Meta learning snapshot from the account-change
-- log. The latter is contextual evidence, not confirmation that learning reset.
drop function if exists public.meta_learning_phase_status(uuid, date, date, uuid);
drop function if exists public.meta_learning_phase_status(uuid, date, date, uuid, uuid);

create function public.meta_learning_phase_status(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  target_campaign_id uuid default null
)
returns table(
  ad_set_id uuid,
  ad_set_name text,
  campaign_name text,
  effective_status text,
  optimization_goal text,
  learning_stage_status text,
  learning_conversions integer,
  learning_conversions_needed integer,
  learning_threshold_source text,
  conversions_missing integer,
  daily_budget numeric,
  spend_in_period numeric,
  spend_source_days bigint,
  spend_source_rows bigint,
  last_account_activity_at timestamptz,
  last_account_activity_type text,
  last_account_activity_description text,
  days_since_account_activity numeric,
  activity_sync_state text,
  activity_sync_finished_at timestamptz,
  activity_sync_records_read integer,
  activity_reset_confirmation text,
  account_last_synced_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with scoped_sets as (
    select
      s.id,
      s.organization_id,
      s.external_ad_set_id,
      s.name,
      s.effective_status,
      s.optimization_goal,
      s.learning_stage_status,
      s.learning_conversions,
      s.learning_conversions_needed,
      s.daily_budget,
      c.name as campaign_name,
      c.ad_account_id,
      a.connection_id,
      a.external_ad_account_id,
      a.last_synced_at as account_last_synced_at
    from public.meta_ad_sets s
    join public.meta_campaigns c
      on c.id = s.campaign_id
     and c.organization_id = target_organization_id
    join public.meta_ad_accounts a
      on a.id = c.ad_account_id
     and a.organization_id = target_organization_id
    where s.organization_id = target_organization_id
      and a.is_active and a.is_selected
      and (target_store_id is null or a.store_id = target_store_id)
      and (target_campaign_id is null or c.id = target_campaign_id)
  ),
  spend_by_set as (
    select
      r.ad_set_id,
      sum(r.spend)::numeric as spend,
      count(distinct r.metric_date)::bigint as source_days,
      count(*)::bigint as source_rows
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_set_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id
          and sa.organization_id = target_organization_id
          and sa.store_id = target_store_id
      ))
    group by r.ad_set_id
  )
  select
    s.id,
    s.name::text,
    s.campaign_name::text,
    s.effective_status::text,
    s.optimization_goal::text,
    s.learning_stage_status::text,
    s.learning_conversions,
    s.learning_conversions_needed,
    case when s.learning_conversions_needed is not null
      then 'local_50_conversion_reference'::text end,
    case when s.learning_conversions_needed is not null
      then greatest(s.learning_conversions_needed - coalesce(s.learning_conversions, 0), 0)
    end,
    s.daily_budget,
    coalesce(sp.spend, 0)::numeric,
    sp.source_days,
    sp.source_rows,
    activity.event_time,
    activity.event_type::text,
    coalesce(activity.translated_event_type, activity.event_type)::text,
    case when activity.event_time is not null
      then round(extract(epoch from (now() - activity.event_time))::numeric / 86400, 1)
    end,
    case
      when activity_sync.status in ('queued', 'running', 'retrying') then 'sync_in_progress'
      when activity_sync.finished_at is null then 'sync_unknown'
      when activity_sync.status <> 'succeeded' then 'sync_failed'
      when activity_sync.finished_at < now() - interval '48 hours' then 'stale'
      else 'fresh'
    end::text,
    activity_sync.finished_at,
    activity_sync.records_read,
    'not_confirmed_by_activity_log'::text,
    s.account_last_synced_at
  from scoped_sets s
  left join spend_by_set sp on sp.ad_set_id = s.id
  left join lateral (
    select a.event_time, a.event_type, a.translated_event_type
    from public.meta_account_activities a
    where a.organization_id = target_organization_id
      and a.ad_account_id = s.ad_account_id
      and a.object_external_id = s.external_ad_set_id
    order by a.event_time desc
    limit 1
  ) activity on true
  left join lateral (
    select r.status, r.finished_at, r.records_read
    from public.integration_sync_runs r
    where r.connection_id = s.connection_id
      and r.organization_id = target_organization_id
      and r.provider = 'meta_ads'
      and r.sync_scope = 'activities:' || s.external_ad_account_id
    order by r.created_at desc
    limit 1
  ) activity_sync on true
  where s.learning_stage_status is not null
     or coalesce(sp.spend, 0) > 0
  order by coalesce(sp.spend, 0) desc, s.name;
$function$;


comment on function public.meta_learning_phase_status(uuid,date,date,uuid,uuid) is 'A24 selected-account learning and activity-freshness contract; activity history is contextual evidence, not proof of learning reset.';
revoke all on function public.meta_learning_phase_status(uuid,date,date,uuid,uuid) from public,anon,authenticated;
grant execute on function public.meta_learning_phase_status(uuid,date,date,uuid,uuid) to service_role;

alter table public.meta_ad_issues
  add column if not exists first_detected_at timestamptz not null default now(),
  add column if not exists last_detected_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz;

create or replace function public.meta_replace_pixel_stats_snapshot(
  target_organization_id uuid, target_pixel_id uuid, window_start date, window_end date, snapshot_rows jsonb
) returns integer
language plpgsql security invoker set search_path = ''
as $function$
declare affected_count integer;
begin
  if target_organization_id is null or target_pixel_id is null or window_start is null or window_end < window_start
     or window_end - window_start > 90 or snapshot_rows is null or jsonb_typeof(snapshot_rows) <> 'array' then
    raise exception 'invalid_meta_pixel_stats_snapshot';
  end if;
  if not exists (select 1 from public.meta_pixels p where p.id=target_pixel_id and p.organization_id=target_organization_id) then
    raise exception 'meta_pixel_stats_scope_mismatch';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(snapshot_rows) as x(metric_date date,event_name text,event_count bigint)
    where x.metric_date is null or x.metric_date < window_start or x.metric_date > window_end
       or x.event_name is null or x.event_count is null or x.event_count < 0
  ) then raise exception 'invalid_meta_pixel_stats_row'; end if;
  delete from public.meta_pixel_daily_stats s where s.organization_id=target_organization_id
    and s.pixel_id=target_pixel_id and s.metric_date between window_start and window_end;
  insert into public.meta_pixel_daily_stats(organization_id,pixel_id,metric_date,event_name,event_count)
  select target_organization_id,target_pixel_id,x.metric_date,x.event_name,x.event_count
  from jsonb_to_recordset(snapshot_rows) as x(metric_date date,event_name text,event_count bigint);
  get diagnostics affected_count = row_count;
  return affected_count;
end;
$function$;
revoke all on function public.meta_replace_pixel_stats_snapshot(uuid,uuid,date,date,jsonb) from public,anon,authenticated;
grant execute on function public.meta_replace_pixel_stats_snapshot(uuid,uuid,date,date,jsonb) to service_role;

create or replace function public.meta_save_measurement_verdict(p_verdict jsonb) returns boolean
language plpgsql security invoker set search_path = ''
as $function$
declare status_value text;
begin
  if p_verdict is null or jsonb_typeof(p_verdict) <> 'object'
     or (p_verdict->>'organization_id') is null or (p_verdict->>'store_id') is null
     or (p_verdict->>'period_start') is null or (p_verdict->>'period_end') is null
     or (p_verdict->>'evaluated_at') is null or (p_verdict->>'expires_at') is null
     or (p_verdict->>'source_fingerprint') is null then raise exception 'invalid_a24_verdict'; end if;
  status_value := p_verdict->>'verdict_status';
  if status_value not in ('usable_with_attribution_limits','restricted','not_assessable','unknown') then
    raise exception 'invalid_a24_verdict_status'; end if;
  insert into public.meta_measurement_verdict_cache(
    organization_id,store_id,period_start,period_end,verdict_version,verdict_status,verdict,
    evaluated_at,expires_at,source_fingerprint
  ) values(
    (p_verdict->>'organization_id')::uuid,(p_verdict->>'store_id')::uuid,
    (p_verdict->>'period_start')::date,(p_verdict->>'period_end')::date,
    p_verdict->>'verdict_version',status_value,p_verdict->'verdict',
    (p_verdict->>'evaluated_at')::timestamptz,(p_verdict->>'expires_at')::timestamptz,p_verdict->>'source_fingerprint'
  ) on conflict(organization_id,store_id,period_start,period_end,verdict_version) do update set
    verdict_status=excluded.verdict_status,verdict=excluded.verdict,evaluated_at=excluded.evaluated_at,
    expires_at=excluded.expires_at,source_fingerprint=excluded.source_fingerprint,updated_at=now()
  where public.meta_measurement_verdict_cache.evaluated_at <= excluded.evaluated_at;
  return found;
end;
$function$;
revoke all on function public.meta_save_measurement_verdict(jsonb) from public,anon,authenticated;
grant execute on function public.meta_save_measurement_verdict(jsonb) to service_role;

create or replace function public.meta_replace_ad_issues_snapshot(
  target_organization_id uuid,target_external_ad_account_id text,target_ad_ids text[],snapshot_rows jsonb,snapshot_at timestamptz default now()
) returns integer language plpgsql security invoker set search_path = '' as $function$
declare valid_ids uuid[]; inserted_count integer;
begin
  if target_organization_id is null or target_external_ad_account_id is null or snapshot_rows is null or jsonb_typeof(snapshot_rows)<>'array' then raise exception 'invalid_meta_ad_issue_snapshot'; end if;
  select coalesce(array_agg(d.id),array[]::uuid[]) into valid_ids
  from public.meta_ads d join public.meta_ad_sets s on s.id=d.ad_set_id and s.organization_id=target_organization_id
  join public.meta_campaigns c on c.id=s.campaign_id and c.organization_id=target_organization_id
  join public.meta_ad_accounts a on a.id=c.ad_account_id and a.organization_id=target_organization_id
  where d.organization_id=target_organization_id and a.external_ad_account_id=target_external_ad_account_id
    and (coalesce(cardinality(target_ad_ids),0)=0 or d.external_ad_id=any(target_ad_ids));
  if coalesce(cardinality(target_ad_ids),0)>0 and cardinality(valid_ids)<>cardinality(target_ad_ids) then raise exception 'meta_ad_issue_snapshot_scope_mismatch'; end if;
  if exists(select 1 from jsonb_to_recordset(snapshot_rows) as x(ad_id uuid) where x.ad_id is null or not(x.ad_id=any(valid_ids))) then raise exception 'meta_ad_issue_snapshot_row_out_of_scope'; end if;
  update public.meta_ad_issues i set resolved_at=coalesce(snapshot_at,now())
  where i.organization_id=target_organization_id and i.resolved_at is null
    and (i.ad_id=any(valid_ids) or (cardinality(valid_ids)=0 and exists (
      select 1 from public.meta_ads d join public.meta_ad_sets s on s.id=d.ad_set_id
      join public.meta_campaigns c on c.id=s.campaign_id join public.meta_ad_accounts a on a.id=c.ad_account_id
      where d.id=i.ad_id and d.organization_id=target_organization_id and a.organization_id=target_organization_id
        and a.external_ad_account_id=target_external_ad_account_id
    )))
    and not exists(select 1 from jsonb_to_recordset(snapshot_rows) as x(ad_id uuid,error_code integer)
      where x.ad_id=i.ad_id and coalesce(x.error_code,0)=i.error_code);
  insert into public.meta_ad_issues(organization_id,ad_id,level,error_code,error_type,error_summary,error_message,detected_at,first_detected_at,last_detected_at,resolved_at)
  select target_organization_id,x.ad_id,x.level,coalesce(x.error_code,0),x.error_type,x.error_summary,x.error_message,
    coalesce(snapshot_at,now()),coalesce(snapshot_at,now()),coalesce(snapshot_at,now()),null
  from jsonb_to_recordset(snapshot_rows) as x(ad_id uuid,level text,error_code integer,error_type text,error_summary text,error_message text)
  on conflict(ad_id,error_code) do update set level=excluded.level,error_type=excluded.error_type,error_summary=excluded.error_summary,
    error_message=excluded.error_message,detected_at=excluded.detected_at,last_detected_at=excluded.last_detected_at,resolved_at=null;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;
revoke all on function public.meta_replace_ad_issues_snapshot(uuid,text,text[],jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.meta_replace_ad_issues_snapshot(uuid,text,text[],jsonb,timestamptz) to service_role;
-- The issue RPC reads the latest account snapshot, independent of the completed-day performance window.
-- A24 issue inventory scoped to the selected store, with the owning Meta
-- account/ad identity and sync freshness. Text remains a bounded observation,
-- never a categorical rejection unless its source explicitly says so.
drop function if exists public.meta_scoped_review_issues(uuid, date, date, uuid);

create or replace function public.meta_scoped_review_issues(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
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
  if target_organization_id is null
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
    and (target_store_id is null or a.store_id = target_store_id)
  order by i.detected_at desc, i.id
  limit 500;
end;
$$;



-- Per-selected-account receipt prevents an empty issue list from being read as
-- a clean state when one account did not finish its issue sync.
drop function if exists public.meta_review_issue_coverage(uuid,uuid);
create or replace function public.meta_review_issue_coverage(target_organization_id uuid,target_store_id uuid)
returns table(selected_account_count bigint,complete_account_count bigint,latest_sync_at timestamptz,complete boolean,accounts jsonb)
language sql stable security invoker set search_path = '' as $function$
  with selected_accounts as (
    select a.id,a.external_ad_account_id,a.connection_id
    from public.meta_ad_accounts a
    where a.organization_id=target_organization_id and a.store_id=target_store_id
      and a.is_active and a.is_selected
  ), receipts as (
    select a.id,a.external_ad_account_id,r.status,r.finished_at,r.records_read
    from selected_accounts a
    left join lateral (
      select x.status,x.finished_at,x.records_read
      from public.integration_sync_runs x
      where x.organization_id=target_organization_id and x.connection_id=a.connection_id
        and x.provider='meta_ads' and x.sync_scope='issues:'||a.external_ad_account_id
      order by x.created_at desc limit 1
    ) r on true
  ), states as (
    select *, (status='succeeded' and finished_at is not null and finished_at<=now()
      and finished_at>=now()-interval '24 hours' and records_read is not null) as fresh_complete
    from receipts
  )
  select count(*)::bigint,count(*) filter(where fresh_complete)::bigint,max(finished_at),
    (count(*)>0 and count(*) filter(where fresh_complete)=count(*)),
    coalesce(jsonb_agg(jsonb_build_object('ad_account_id',id,'external_ad_account_id',external_ad_account_id,'status',status,
      'finished_at',finished_at,'records_read',records_read,'complete',fresh_complete) order by id),'[]'::jsonb)
  from states;
$function$;
revoke all on function public.meta_review_issue_coverage(uuid,uuid) from public,anon,authenticated;
grant execute on function public.meta_review_issue_coverage(uuid,uuid) to service_role;


create or replace function public.materialize_a24_measurement_task(
  p_task jsonb,p_organization_id uuid,p_store_id uuid,p_output_id uuid,p_proposal_index integer,
  p_plan_id uuid,p_plan_version integer,p_milestone_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_task_id uuid; v_created boolean := false;
begin
  if p_task is null or p_organization_id is null or p_store_id is null or p_output_id is null or p_proposal_index is null or p_proposal_index<0 then
    raise exception 'A24_TASK_SCOPE_REQUIRED'; end if;
  if not exists(select 1 from public.shopify_stores s where s.id=p_store_id and s.organization_id=p_organization_id and s.is_active) then
    return jsonb_build_object('status','store_out_of_scope'); end if;
  if not exists(
    select 1 from public.agent_outputs o join public.agent_runs r on r.id=o.run_id
      join public.agent_versions av on av.id=r.agent_version_id join public.agent_definitions d on d.id=av.definition_id
    where o.id=p_output_id and o.organization_id=p_organization_id and o.status='pending_approval'
      and r.organization_id=p_organization_id and r.store_id=p_store_id and d.code='a24_medicion_meta'
  ) then return jsonb_build_object('status','output_not_pending_or_out_of_scope'); end if;
  if exists(select 1 from public.meta_measurement_incidents i where i.organization_id=p_organization_id
    and i.store_id=p_store_id and i.status='open' and i.task_id is not null) then
    return jsonb_build_object('status','incident_task_already_linked'); end if;
  if p_plan_id is not null and not exists(select 1 from public.strategic_plans p where p.id=p_plan_id
    and p.organization_id=p_organization_id and p.store_id=p_store_id and p.status='active'
    and p.approved_at is not null and p.version=p_plan_version) then
    return jsonb_build_object('status','camino_changed_since_analysis'); end if;
  if p_plan_id is null and (p_plan_version is not null or p_milestone_id is not null) then
    return jsonb_build_object('status','invalid_camino_snapshot'); end if;
  if p_milestone_id is not null and not exists(
    select 1 from public.strategic_plan_milestones m join public.strategic_plan_phases ph on ph.id=m.phase_id
      join public.strategic_plans p on p.id=ph.plan_id
    where m.id=p_milestone_id and m.organization_id=p_organization_id and m.status in ('active','pending')
      and ph.status in ('active','pending') and p.id=p_plan_id and p.organization_id=p_organization_id
      and p.store_id=p_store_id and p.version=p_plan_version and p.status='active' and p.approved_at is not null
  ) then return jsonb_build_object('status','milestone_out_of_scope'); end if;
  insert into public.tasks(agent_output_id,agent_proposal_index,organization_id,store_id,source,priority,title,description,created_by,assigned_to,metadata,categories)
  values(p_output_id,p_proposal_index,p_organization_id,p_store_id,'ai_consultant',coalesce(p_task->>'priority','medium'),
    coalesce(p_task->>'title','Revisión de medición Meta'),coalesce(p_task->>'description',''),
    nullif(p_task->>'created_by','')::uuid,nullif(p_task->>'assigned_to','')::uuid,
    coalesce(p_task->'metadata','{}'::jsonb),array(select jsonb_array_elements_text(coalesce(p_task->'categories','[]'::jsonb))))
  on conflict(agent_output_id,agent_proposal_index) do nothing returning id into v_task_id;
  v_created:=v_task_id is not null;
  if v_task_id is null then select t.id into v_task_id from public.tasks t where t.agent_output_id=p_output_id
    and t.agent_proposal_index=p_proposal_index and t.organization_id=p_organization_id and t.store_id=p_store_id; end if;
  if v_task_id is null then raise exception 'A24_TASK_RECOVERY_FAILED'; end if;
  if p_milestone_id is not null then
    insert into public.milestone_task_links(organization_id,milestone_id,task_id) values(p_organization_id,p_milestone_id,v_task_id)
    on conflict(milestone_id,task_id) do nothing;
  end if;
  update public.meta_measurement_incidents i set task_id=v_task_id,output_id=p_output_id,updated_at=now()
    where i.organization_id=p_organization_id and i.store_id=p_store_id and i.status='open' and i.task_id is null;
  return jsonb_build_object('status','materialized','task_id',v_task_id,'created',v_created);
end;
$function$;
revoke all on function public.materialize_a24_measurement_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.materialize_a24_measurement_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid) to service_role;

create table if not exists public.meta_measurement_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  incident_key text not null,
  status text not null check(status in ('open','resolved')),
  reason_codes jsonb not null default '[]'::jsonb,
  assessment jsonb not null,
  source_fingerprint text,
  task_id uuid references public.tasks(id) on delete set null,
  output_id uuid references public.agent_outputs(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_measurement_incidents_unique unique(organization_id,store_id,incident_key)
);
create index if not exists meta_measurement_incidents_open_idx
  on public.meta_measurement_incidents(organization_id,store_id,last_seen_at desc) where status='open';
alter table public.meta_measurement_incidents enable row level security;
revoke all on table public.meta_measurement_incidents from public,anon,authenticated;
grant select,insert,update,delete on public.meta_measurement_incidents to service_role;

create or replace function public.meta_record_measurement_assessment(target_organization_id uuid,target_store_id uuid,assessment jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare status_value text; codes jsonb; key_value text; inserted_id uuid;
begin
  if target_organization_id is null or target_store_id is null or assessment is null or jsonb_typeof(assessment)<>'object'
     or not exists(select 1 from public.shopify_stores s where s.id=target_store_id and s.organization_id=target_organization_id) then
    raise exception 'invalid_meta_measurement_incident_scope'; end if;
  status_value:=assessment->>'status';
  if status_value not in ('usable_with_attribution_limits','restricted','not_assessable','unknown') then raise exception 'invalid_meta_measurement_status'; end if;
  if status_value='usable_with_attribution_limits' then
    update public.meta_measurement_incidents i set status='resolved',resolved_at=now(),last_seen_at=now(),assessment=meta_record_measurement_assessment.assessment,
      source_fingerprint=assessment->>'source_fingerprint',updated_at=now()
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
