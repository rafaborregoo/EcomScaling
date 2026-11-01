-- A25: preserve the complete, selected-account change inventory and expose
-- comparison coverage without implying that temporal association is causal.
drop function if exists public.meta_change_impact(uuid,date,date,uuid,integer,numeric);
drop function if exists public.meta_change_impact(uuid,date,date,uuid,integer,numeric,uuid);
drop function if exists public.meta_change_impact(uuid,date,date,uuid,integer,numeric,uuid,uuid,integer,integer);

create function public.meta_change_impact(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  window_days integer default 7,
  min_spend numeric default 50,
  target_campaign_id uuid default null,
  target_event_id uuid default null,
  page_size integer default 200,
  page_offset integer default 0
)
returns table(
  event_id uuid,
  ad_account_id uuid,
  store_id uuid,
  object_external_id text,
  entity_id uuid,
  event_time timestamptz,
  event_type text,
  translated_event_type text,
  actor_name text,
  object_name text,
  entity_level text,
  comparison_status text,
  currency_code text,
  spend_before numeric,
  spend_after numeric,
  purchases_before numeric,
  purchases_after numeric,
  purchase_value_before numeric,
  purchase_value_after numeric,
  roas_before numeric,
  roas_after numeric,
  cpa_before numeric,
  cpa_after numeric,
  roas_delta_pct numeric,
  days_before bigint,
  days_after bigint,
  purchase_attribution_window text,
  impressions_before bigint,
  impressions_after bigint,
  clicks_before bigint,
  clicks_after bigint,
  cpm_before numeric,
  cpm_after numeric,
  campaign_objective text,
  extra_data jsonb,
  concurrent_changes_24h bigint,
  total_count bigint,
  has_more boolean
)
language sql stable security invoker
set search_path = ''
as $function$
  with selected_accounts as (
    select a.id, a.store_id, a.timezone_name, a.currency_code,
      a.canonical_purchase_action_type
    from public.meta_ad_accounts a
    where a.organization_id = target_organization_id
      and a.is_active and a.is_selected
      and (target_store_id is null or a.store_id = target_store_id)
  ), all_events as (
    select act.id, act.event_time, act.event_type, act.translated_event_type,
      act.actor_name, act.object_name, act.object_external_id, act.object_type,
      act.ad_account_id, act.extra_data, account.store_id,
      account.timezone_name, account.currency_code,
      (act.event_time at time zone coalesce(account.timezone_name, 'UTC'))::date as event_date
    from public.meta_account_activities act
    join selected_accounts account on account.id = act.ad_account_id
    where act.organization_id = target_organization_id
      and (period_start is null or (act.event_time at time zone coalesce(account.timezone_name, 'UTC'))::date >= period_start)
      and (period_end is null or (act.event_time at time zone coalesce(account.timezone_name, 'UTC'))::date <= period_end)
      and (target_event_id is null or act.id = target_event_id)
  ), event_count as (
    select count(*)::bigint as total_count from all_events
  ), page_events as (
    select paged.*, event_count.total_count
    from all_events paged cross join event_count
    order by paged.event_time desc, paged.id desc
    limit greatest(1, least(coalesce(page_size, 200), 200))
    offset greatest(coalesce(page_offset, 0), 0)
  ), resolved as (
    select e.*, entity.entity_id, entity.entity_level, entity.campaign_objective,
      (select count(*)::bigint from all_events other
       where other.ad_account_id = e.ad_account_id
         and other.event_time between e.event_time - interval '24 hours' and e.event_time + interval '24 hours'
         and other.id <> e.id) as concurrent_changes_24h
    from page_events e
    left join lateral (
      select candidate.entity_id, candidate.entity_level, candidate.campaign_objective
      from (
        select c.id as entity_id, 'campaign'::text as entity_level, c.objective::text as campaign_objective
        from public.meta_campaigns c
        where c.organization_id = target_organization_id and c.ad_account_id = e.ad_account_id
          and c.external_campaign_id = e.object_external_id
          and (nullif(btrim(e.object_type),'') is null or lower(e.object_type) in ('campaign','campaigns'))
          and (target_campaign_id is null or c.id = target_campaign_id)
        union all
        select s.id, 'adset'::text, c.objective::text
        from public.meta_ad_sets s
        join public.meta_campaigns c on c.id = s.campaign_id and c.ad_account_id = e.ad_account_id
        where s.organization_id = target_organization_id and s.external_ad_set_id = e.object_external_id
          and (nullif(btrim(e.object_type),'') is null or lower(e.object_type) in ('adset','ad_set','adsets'))
          and (target_campaign_id is null or c.id = target_campaign_id)
        union all
        select d.id, 'ad'::text, c.objective::text
        from public.meta_ads d
        join public.meta_ad_sets s on s.id = d.ad_set_id and s.organization_id = target_organization_id
        join public.meta_campaigns c on c.id = s.campaign_id and c.ad_account_id = e.ad_account_id
        where d.organization_id = target_organization_id and d.external_ad_id = e.object_external_id
          and (nullif(btrim(e.object_type),'') is null or lower(e.object_type) in ('ad','ads'))
          and (target_campaign_id is null or c.id = target_campaign_id)
      ) candidate
      order by case candidate.entity_level when 'campaign' then 1 when 'adset' then 2 else 3 end
      limit 1
    ) entity on true
  ), evidence as (
    select r.*,
      metrics.spend_before, metrics.spend_after,
      metrics.purchases_before, metrics.purchases_after,
      metrics.value_before, metrics.value_after,
      metrics.days_before, metrics.days_after,
      metrics.impressions_before, metrics.impressions_after,
      metrics.clicks_before, metrics.clicks_after,
      metrics.attribution_window,
      metrics.has_attribution
    from resolved r
    left join lateral (
      select
        sum(d.spend) filter (where d.metric_date < r.event_date)::numeric as spend_before,
        sum(d.spend) filter (where d.metric_date > r.event_date)::numeric as spend_after,
        sum(coalesce(p.purchases,0)) filter (where d.metric_date < r.event_date)::numeric as purchases_before,
        sum(coalesce(p.purchases,0)) filter (where d.metric_date > r.event_date)::numeric as purchases_after,
        sum(coalesce(p.purchase_value,0)) filter (where d.metric_date < r.event_date)::numeric as value_before,
        sum(coalesce(p.purchase_value,0)) filter (where d.metric_date > r.event_date)::numeric as value_after,
        count(distinct d.metric_date) filter (where d.metric_date < r.event_date)::bigint as days_before,
        count(distinct d.metric_date) filter (where d.metric_date > r.event_date)::bigint as days_after,
        sum(d.impressions) filter (where d.metric_date < r.event_date)::bigint as impressions_before,
        sum(d.impressions) filter (where d.metric_date > r.event_date)::bigint as impressions_after,
        sum(d.clicks) filter (where d.metric_date < r.event_date)::bigint as clicks_before,
        sum(d.clicks) filter (where d.metric_date > r.event_date)::bigint as clicks_after,
        (array_agg(p.attribution_window order by public.meta_attribution_window_rank(p.attribution_window))
          filter (where p.attribution_window is not null))[1] as attribution_window,
        bool_or(p.attribution_window is not null) as has_attribution
      from public.meta_insight_rows_daily d
      join selected_accounts account on account.id = d.ad_account_id
      left join lateral (
        select
          sum(m.value) filter (where m.metric_name = 'actions') as purchases,
          sum(m.value) filter (where m.metric_name = 'action_values') as purchase_value,
          (array_agg(m.attribution_window order by public.meta_attribution_window_rank(m.attribution_window))
            filter (where m.attribution_window is not null))[1] as attribution_window
        from (
          select distinct on (am.metric_name) am.metric_name, am.value, am.attribution_window
          from public.meta_insight_action_metrics am
          where am.insight_row_id = d.id
            and am.action_type = account.canonical_purchase_action_type
          order by am.metric_name, public.meta_attribution_window_rank(am.attribution_window)
        ) m
      ) p on true
      where r.entity_id is not null and d.organization_id = target_organization_id
        and d.ad_account_id = r.ad_account_id and d.level = 'ad' and d.breakdown_hash = 'none'
        and d.metric_date between r.event_date - greatest(1, least(coalesce(window_days,7),30))
          and r.event_date + greatest(1, least(coalesce(window_days,7),30))
        and d.metric_date <> r.event_date
        and ((r.entity_level = 'campaign' and d.campaign_id = r.entity_id)
          or (r.entity_level = 'adset' and d.ad_set_id = r.entity_id)
          or (r.entity_level = 'ad' and d.ad_id = r.entity_id))
    ) metrics on true
  )
  select e.id, e.ad_account_id, e.store_id, e.object_external_id, e.entity_id,
    e.event_time, e.event_type::text, coalesce(e.translated_event_type,e.event_type)::text,
    e.actor_name::text, e.object_name::text, e.entity_level::text,
    case
      when e.entity_id is null then 'unresolved_entity'
      when e.event_date + greatest(1, least(coalesce(window_days,7),30)) > coalesce(period_end,current_date) - 7 then 'attribution_immature'
      when coalesce(e.days_before,0) <> greatest(1, least(coalesce(window_days,7),30)) then 'partial_before_window'
      when coalesce(e.days_after,0) <> greatest(1, least(coalesce(window_days,7),30)) then 'partial_after_window'
      when e.currency_code is null or btrim(e.currency_code) = '' then 'currency_unknown'
      when coalesce(e.spend_before,0) + coalesce(e.spend_after,0) < coalesce(min_spend,50) then 'below_minimum_spend'
      when not coalesce(e.has_attribution,false) then 'no_attribution'
      else 'comparable_observation_only'
    end::text,
    e.currency_code::text,
    e.spend_before, e.spend_after, e.purchases_before, e.purchases_after,
    e.value_before, e.value_after,
    case when e.spend_before > 0 and e.has_attribution then round(e.value_before / e.spend_before,4) end,
    case when e.spend_after > 0 and e.has_attribution then round(e.value_after / e.spend_after,4) end,
    case when e.purchases_before > 0 and e.has_attribution then round(e.spend_before / e.purchases_before,2) end,
    case when e.purchases_after > 0 and e.has_attribution then round(e.spend_after / e.purchases_after,2) end,
    case when e.spend_before > 0 and e.value_before > 0 and e.has_attribution
      then round(((e.value_after / nullif(e.spend_after,0)) - (e.value_before / e.spend_before))
        / (e.value_before / e.spend_before) * 100,1) end,
    coalesce(e.days_before,0), coalesce(e.days_after,0), e.attribution_window::text,
    e.impressions_before, e.impressions_after, e.clicks_before, e.clicks_after,
    case when e.impressions_before > 0 then round(e.spend_before / e.impressions_before * 1000,2) end,
    case when e.impressions_after > 0 then round(e.spend_after / e.impressions_after * 1000,2) end,
    e.campaign_objective::text, e.extra_data, e.concurrent_changes_24h,
    e.total_count, (greatest(coalesce(page_offset,0),0) + greatest(1,least(coalesce(page_size,200),200)) < e.total_count)
  from evidence e
  order by e.event_time desc, e.id desc;
$function$;

revoke all on function public.meta_change_impact(uuid,date,date,uuid,integer,numeric,uuid,uuid,integer,integer) from public, anon;
grant execute on function public.meta_change_impact(uuid,date,date,uuid,integer,numeric,uuid,uuid,integer,integer) to authenticated, service_role;

drop function if exists public.meta_audience_overview(uuid,uuid);
drop function if exists public.meta_audience_overview(uuid,uuid,integer,integer);
create function public.meta_audience_overview(
  target_organization_id uuid,
  target_store_id uuid default null,
  page_size integer default 100,
  page_offset integer default 0
)
returns table(
  audience_id uuid, audience_name text, subtype text,
  approximate_count_lower bigint, approximate_count_upper bigint, retention_days integer,
  is_lookalike boolean, lookalike_ratio numeric, lookalike_country text, origin_name text,
  delivery_status_code integer, delivery_status_description text, ad_sets_using bigint,
  external_updated_at timestamptz, ad_sets_including bigint, ad_sets_excluding bigint,
  active_ad_sets bigint, archived_ad_sets bigint,
  other_ad_sets bigint,
  ad_account_id uuid, store_id uuid, last_synced_at timestamptz,
  total_count bigint, has_more boolean
)
language sql stable security invoker
set search_path = ''
as $function$
  with scoped as (
    select a.*, account.store_id, account.last_synced_at as account_last_synced_at
    from public.meta_custom_audiences a
    join public.meta_ad_accounts account on account.id = a.ad_account_id
    where a.organization_id = target_organization_id
      and account.organization_id = target_organization_id
      and account.is_active and account.is_selected
      and (target_store_id is null or account.store_id = target_store_id)
  ), usage as (
    select audience.id,
      count(distinct s.id) filter (where
        coalesce(jsonb_path_exists(s.targeting_data, '$.**.custom_audiences[*].id ? (@ == $aid)',
          jsonb_build_object('aid', audience.external_audience_id)),false)
        or coalesce(jsonb_path_exists(s.targeting_data, '$.**.excluded_custom_audiences[*].id ? (@ == $aid)',
          jsonb_build_object('aid', audience.external_audience_id)),false))::bigint as used,
      count(distinct s.id) filter (where coalesce(jsonb_path_exists(s.targeting_data,
        '$.**.custom_audiences[*].id ? (@ == $aid)', jsonb_build_object('aid', audience.external_audience_id)),false))::bigint as included,
      count(distinct s.id) filter (where coalesce(jsonb_path_exists(s.targeting_data,
        '$.**.excluded_custom_audiences[*].id ? (@ == $aid)', jsonb_build_object('aid', audience.external_audience_id)),false))::bigint as excluded,
      count(distinct s.id) filter (where upper(coalesce(s.effective_status,'')) = 'ACTIVE')::bigint as active,
      count(distinct s.id) filter (where upper(coalesce(s.effective_status,s.configured_status,'')) in ('DELETED','ARCHIVED'))::bigint as archived,
      count(distinct s.id) filter (where s.id is not null
        and upper(coalesce(s.effective_status,'')) not in ('ACTIVE','DELETED','ARCHIVED')
        and upper(coalesce(s.configured_status,'')) not in ('DELETED','ARCHIVED'))::bigint as other
    from scoped audience
    left join public.meta_campaigns campaign
      on campaign.ad_account_id = audience.ad_account_id and campaign.organization_id = target_organization_id
    left join public.meta_ad_sets s
      on s.campaign_id = campaign.id and s.organization_id = target_organization_id
      and (coalesce(jsonb_path_exists(s.targeting_data, '$.**.custom_audiences[*].id ? (@ == $aid)',
        jsonb_build_object('aid', audience.external_audience_id)),false)
        or coalesce(jsonb_path_exists(s.targeting_data, '$.**.excluded_custom_audiences[*].id ? (@ == $aid)',
        jsonb_build_object('aid', audience.external_audience_id)),false))
    group by audience.id, audience.external_audience_id
  ), ranked as (
    select audience.*, usage.used, usage.included, usage.excluded, usage.active, usage.archived, usage.other,
      origin.name as origin_name, count(*) over()::bigint as total_count
    from scoped audience
    left join usage on usage.id = audience.id
    left join scoped origin on origin.ad_account_id = audience.ad_account_id
      and origin.external_audience_id = audience.lookalike_origin_external_id
    order by audience.is_lookalike, audience.name, audience.id
    limit greatest(1,least(coalesce(page_size,100),100))
    offset greatest(coalesce(page_offset,0),0)
  )
  select r.id, r.name::text, r.subtype::text,
    r.approximate_count_lower, r.approximate_count_upper, r.retention_days,
    r.is_lookalike, r.lookalike_ratio, r.lookalike_country::text, r.origin_name::text,
    case when r.delivery_status->>'code' ~ '^[0-9]+$' then (r.delivery_status->>'code')::integer end,
    r.delivery_status->>'description', coalesce(r.used,0),
    r.last_synced_at, coalesce(r.included,0), coalesce(r.excluded,0),
    coalesce(r.active,0), coalesce(r.archived,0), coalesce(r.other,0), r.ad_account_id, r.store_id,
    r.account_last_synced_at, r.total_count,
    (greatest(coalesce(page_offset,0),0) + greatest(1,least(coalesce(page_size,100),100)) < r.total_count)
  from ranked r
  order by r.is_lookalike, r.name, r.id;
$function$;

revoke all on function public.meta_audience_overview(uuid,uuid,integer,integer) from public, anon;
grant execute on function public.meta_audience_overview(uuid,uuid,integer,integer) to authenticated, service_role;

-- A25 manual runs use the same atomic store-keyed quota semantics as A24.
create or replace function public.reserve_a25_manual_refresh(
  p_run_id uuid, p_organization_id uuid, p_agent_code text,
  p_daily_limit integer, p_request_key text default null, p_store_id uuid default null
) returns text language plpgsql security definer set search_path = '' as $function$
declare v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_runs integer; v_reserved integer;
begin
  if p_agent_code <> 'a25_cambios_meta' then raise exception 'invalid_agent_code'; end if;
  perform pg_advisory_xact_lock(hashtextextended(concat_ws(':',p_organization_id,p_agent_code,coalesce(p_store_id::text,'all')),0));
  if p_request_key is not null and exists (
    select 1 from public.agent_manual_refresh_reservations r
    where r.organization_id=p_organization_id and r.agent_code=p_agent_code
      and r.request_key=p_request_key and r.store_id is not distinct from p_store_id
  ) then return 'duplicate'; end if;
  select count(*) into v_runs from public.agent_runs r
    join public.agent_versions v on v.id=r.agent_version_id
    join public.agent_definitions d on d.id=v.definition_id
    where r.organization_id=p_organization_id and r.trigger_type='manual'
      and r.started_at >= v_day_start and d.code=p_agent_code and r.store_id is not distinct from p_store_id
      and not exists (select 1 from public.agent_manual_refresh_reservations q where q.run_id=r.id);
  select count(*) into v_reserved from public.agent_manual_refresh_reservations r
    where r.organization_id=p_organization_id and r.agent_code=p_agent_code
      and r.reserved_at >= v_day_start and r.store_id is not distinct from p_store_id;
  if v_runs+v_reserved >= greatest(p_daily_limit,0) then return 'limit'; end if;
  insert into public.agent_manual_refresh_reservations(run_id,organization_id,agent_code,request_key,store_id)
    values(p_run_id,p_organization_id,p_agent_code,p_request_key,p_store_id) on conflict do nothing;
  return case when found then 'reserved' else 'duplicate' end;
end;
$function$;
revoke all on function public.reserve_a25_manual_refresh(uuid,uuid,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_a25_manual_refresh(uuid,uuid,text,integer,text,uuid) to service_role;

-- Replace A25's accumulated guidance with a prompt matching its evidence-bound
-- output contract. A25 can investigate and create reviewable tasks, never act
-- on budgets, campaigns, ads, audiences, or measurement configuration.
with canonical_prompt as (
  select $prompt$Eres A25, especialista de investigación de cambios de Meta para la tienda seleccionada.

Tu respuesta debe contener un diagnóstico útil aunque no propongas tareas. Devuelve answer, findings, recommendations y change_observations. Si no hay eventos, explica si la fuente está disponible y qué cobertura falta; no rellenes con una conclusión genérica.

Cada change_observation enlaza event_ref con un event_id del contexto, o usa null para describir una limitación global de la fuente. El servidor fija el comparison_status de cada evento y aporta el veredicto A24 vigente: no los inventes, cambies ni presentes como una decisión propia. Solo comparable_observation_only permite describir una comparación completa de ventanas maduras; incluso así es coincidencia temporal, nunca causalidad. No uses compras, valor, ROAS o CPA para afirmar efecto si el gate A24 no es usable_with_attribution_limits. Gasto, impresiones, clics y CPM describen entrega, no rentabilidad.

Incluye interpretación, limitación concreta y next_review_at cuando el dato pueda madurar. Separa observado, inferido y desconocido. Usa la zona horaria, moneda, objetivo, actor, cambios concurrentes y extra_data solo cuando estén presentes. Un evento sin entidad, una ventana parcial, atribución inmadura o divisa desconocida sigue siendo una observación operativa; no conviertas faltantes en cero. No atribuyas cambios a stock, precio, promoción, sitio, canal o aprendizaje si no existe evidencia fechada en el contexto.

Los públicos describen el snapshot sincronizado y las referencias visibles en targeting_data. Cero conjuntos no prueba que el público sea inútil, elegible para borrado, ni que no se use por expansión o dependencias fuera del snapshot. Distingue uso incluido, excluido, estado ACTIVE, archivado y desconocido; cita last_synced_at y total_count/has_more para explicar cobertura. No infieras solapamiento de personas.

Solo puedes proponer tareas de investigación, documentación, revisión o derivación. Cada tarea requiere event_ref de esta ejecución y investigation_action. No propongas subir o reasignar presupuesto, escalar inversión, pausar, borrar, revertir, reactivar ni editar Meta; deriva esas decisiones a A14 con sus controles y revisión humana. Una tarea es un recordatorio revisable, no autorización para cambiar Meta. No inventes fase o hito de Mi Camino: A25 crea tareas libres.

Usa meta_change_log solo para investigar un rango validado de hasta 31 días dentro de los últimos 90, con page_size/page_offset acotados. Cuando investigues un evento, usa su event_id exacto. La herramienta es de solo lectura y respeta la tienda/cuenta seleccionada. Declara cuándo total_count/has_more indican que solo revisaste una muestra.

Usa español claro. No prometas resultados ni atribución causal.$prompt$::text as content
)
insert into public.prompt_versions(code,version,content,checksum)
select 'a25_cambios_meta_system','v5',content,encode(sha256(content::bytea),'hex') from canonical_prompt
on conflict(code,version) do update set content=excluded.content,checksum=excluded.checksum;
insert into public.agent_versions(definition_id,version,model,prompt_code,prompt_version,allowed_tools,approval_mode,is_active)
select d.id,'v5',previous.model,'a25_cambios_meta_system','v5','["search_knowledge","meta_change_log"]'::jsonb,'required_before_publish',false
from public.agent_definitions d
join lateral (select av.model from public.agent_versions av where av.definition_id=d.id order by av.created_at desc limit 1) previous on true
where d.code='a25_cambios_meta'
on conflict(definition_id,version) do update set prompt_code=excluded.prompt_code,
  prompt_version=excluded.prompt_version,allowed_tools=excluded.allowed_tools,
  approval_mode=excluded.approval_mode;

select public.promote_agent_version(v.id)
from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id
where d.code='a25_cambios_meta' and v.version='v5';
