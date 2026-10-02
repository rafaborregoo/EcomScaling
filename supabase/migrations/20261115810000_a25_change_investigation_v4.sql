-- A25: retain operational events, and mark only complete, mature windows comparable.
drop function if exists public.meta_change_impact(uuid, date, date, uuid, integer, numeric);
create function public.meta_change_impact(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  window_days integer default 7,
  min_spend numeric default 50
)
returns table(
  event_time timestamptz,
  event_type text,
  translated_event_type text,
  actor_name text,
  object_name text,
  entity_level text,
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
  comparison_status text,
  impressions_before bigint,
  impressions_after bigint,
  clicks_before bigint,
  clicks_after bigint,
  cpm_before numeric,
  cpm_after numeric,
  campaign_objective text,
  extra_data jsonb,
  concurrent_changes_24h bigint
)
language sql stable
set search_path to 'pg_catalog', 'public'
as $function$
  with changes as (
    select act.event_time, act.event_type, act.translated_event_type,
      act.actor_name, act.object_name, act.object_external_id, act.object_type,
      act.ad_account_id, act.extra_data,
      (act.event_time at time zone coalesce(acc.timezone_name, 'UTC'))::date as event_date
    from public.meta_account_activities act
    join public.meta_ad_accounts acc on acc.id = act.ad_account_id
    where act.organization_id = target_organization_id
      and act.object_external_id <> ''
      and (period_start is null or (act.event_time at time zone coalesce(acc.timezone_name, 'UTC'))::date >= period_start)
      and (period_end is null or (act.event_time at time zone coalesce(acc.timezone_name, 'UTC'))::date <= period_end)
      and (target_store_id is null or acc.store_id = target_store_id)
    order by act.event_time desc
    limit 200
  ),
  resolved_candidates as (
    select c.*, 'campaign'::text as entity_level, e.id as entity_id, e.objective as campaign_objective
    from changes c join public.meta_campaigns e
      on e.ad_account_id = c.ad_account_id and e.external_campaign_id = c.object_external_id
    union all
    select c.*, 'adset'::text, s.id, cp.objective
    from changes c join public.meta_ad_sets s
      on s.external_ad_set_id = c.object_external_id
    join public.meta_campaigns cp on cp.id = s.campaign_id and cp.ad_account_id = c.ad_account_id
    where s.organization_id = target_organization_id
    union all
    select c.*, 'ad'::text, d.id, cp.objective
    from changes c join public.meta_ads d on d.external_ad_id = c.object_external_id
    join public.meta_ad_sets s on s.id = d.ad_set_id
    join public.meta_campaigns cp on cp.id = s.campaign_id and cp.ad_account_id = c.ad_account_id
    where d.organization_id = target_organization_id
  ),
  resolved as (
    select c.*, rc.entity_level, rc.entity_id, rc.campaign_objective
    from changes c left join lateral (
      select x.entity_level, x.entity_id, x.campaign_objective
      from resolved_candidates x
      where x.event_time = c.event_time and x.ad_account_id = c.ad_account_id
        and x.object_external_id = c.object_external_id
        and (c.object_type is null or c.object_type = '' or lower(c.object_type) in
          (lower(x.entity_level), case x.entity_level when 'adset' then 'ad_set' else x.entity_level end))
      order by case x.entity_level when 'campaign' then 1 when 'adset' then 2 else 3 end
      limit 1
    ) rc on true
  ),
  evidence as (
    select r.*,
      coalesce(w.spend_before, 0) spend_before,
      coalesce(w.spend_after, 0) spend_after,
      coalesce(w.purchases_before, 0) purchases_before,
      coalesce(w.purchases_after, 0) purchases_after,
      coalesce(w.value_before, 0) value_before,
      coalesce(w.value_after, 0) value_after,
      coalesce(w.days_before, 0) days_before,
      coalesce(w.days_after, 0) days_after,
      coalesce(w.impressions_before, 0) impressions_before,
      coalesce(w.impressions_after, 0) impressions_after,
      coalesce(w.clicks_before, 0) clicks_before,
      coalesce(w.clicks_after, 0) clicks_after,
      case when w.impressions_before > 0 then round(w.spend_before / w.impressions_before * 1000, 2) end cpm_before,
      case when w.impressions_after > 0 then round(w.spend_after / w.impressions_after * 1000, 2) end cpm_after,
      w.attribution_window,
      (select count(*) from changes other
        where other.ad_account_id = r.ad_account_id
          and other.event_time between r.event_time - interval '24 hours' and r.event_time + interval '24 hours'
      )::bigint as concurrent_changes_24h
    from resolved r
    left join lateral (
      select
        sum(dr.spend) filter (where dr.metric_date < r.event_date) spend_before,
        sum(dr.spend) filter (where dr.metric_date > r.event_date) spend_after,
        sum(coalesce(pm.purchases, 0)) filter (where dr.metric_date < r.event_date) purchases_before,
        sum(coalesce(pm.purchases, 0)) filter (where dr.metric_date > r.event_date) purchases_after,
        sum(coalesce(pm.purchase_value, 0)) filter (where dr.metric_date < r.event_date) value_before,
        sum(coalesce(pm.purchase_value, 0)) filter (where dr.metric_date > r.event_date) value_after,
        count(distinct dr.metric_date) filter (where dr.metric_date < r.event_date) days_before,
        count(distinct dr.metric_date) filter (where dr.metric_date > r.event_date) days_after,
        sum(dr.impressions) filter (where dr.metric_date < r.event_date) impressions_before,
        sum(dr.impressions) filter (where dr.metric_date > r.event_date) impressions_after,
        sum(dr.clicks) filter (where dr.metric_date < r.event_date) clicks_before,
        sum(dr.clicks) filter (where dr.metric_date > r.event_date) clicks_after,
        (array_agg(pm.attribution_window) filter (where pm.attribution_window is not null))[1] attribution_window
      from public.meta_insight_rows_daily dr
      join public.meta_ad_accounts acc on acc.id = dr.ad_account_id
      left join lateral (
        select sum(x.value) filter (where x.metric_name = 'actions') purchases,
          sum(x.value) filter (where x.metric_name = 'action_values') purchase_value,
          (array_agg(x.attribution_window order by public.meta_attribution_window_rank(x.attribution_window)))[1] attribution_window
        from (select distinct on (m.metric_name) m.metric_name, m.value, m.attribution_window
          from public.meta_insight_action_metrics m
          where m.insight_row_id = dr.id and m.action_type = acc.canonical_purchase_action_type
          order by m.metric_name, public.meta_attribution_window_rank(m.attribution_window)) x
      ) pm on true
      where r.entity_id is not null and dr.organization_id = target_organization_id
        and dr.ad_account_id = r.ad_account_id and dr.level = 'ad' and dr.breakdown_hash = 'none'
        and dr.metric_date between r.event_date - greatest(1, least(window_days, 30))
          and r.event_date + greatest(1, least(window_days, 30))
        and dr.metric_date <> r.event_date
        and ((r.entity_level = 'campaign' and dr.campaign_id = r.entity_id)
          or (r.entity_level = 'adset' and dr.ad_set_id = r.entity_id)
          or (r.entity_level = 'ad' and dr.ad_id = r.entity_id))
    ) w on true
  )
  select e.event_time, e.event_type::text, e.translated_event_type::text, e.actor_name::text,
    e.object_name::text, e.entity_level, e.spend_before, e.spend_after,
    e.purchases_before, e.purchases_after, e.value_before, e.value_after,
    case when e.spend_before > 0 then round(e.value_before / e.spend_before, 4) end,
    case when e.spend_after > 0 then round(e.value_after / e.spend_after, 4) end,
    case when e.purchases_before > 0 then round(e.spend_before / e.purchases_before, 2) end,
    case when e.purchases_after > 0 then round(e.spend_after / e.purchases_after, 2) end,
    case when e.spend_before > 0 and e.value_before > 0
      then round(((e.value_after / nullif(e.spend_after, 0)) - (e.value_before / e.spend_before))
        / (e.value_before / e.spend_before) * 100, 1) end,
    e.days_before, e.days_after, e.attribution_window::text,
    case
      when e.entity_id is null then 'unresolved_entity'
      when e.event_date + greatest(1, least(window_days, 30)) > coalesce(period_end, current_date) - 7 then 'attribution_immature'
      when e.days_before <> greatest(1, least(window_days, 30)) then 'partial_before_window'
      when e.days_after <> greatest(1, least(window_days, 30)) then 'partial_after_window'
      when e.spend_before + e.spend_after < coalesce(min_spend, 50) then 'below_minimum_spend'
      else 'comparable_observation_only'
    end,
    e.impressions_before, e.impressions_after, e.clicks_before, e.clicks_after,
    e.cpm_before, e.cpm_after, e.campaign_objective, e.extra_data, e.concurrent_changes_24h
  from evidence e
  order by e.event_time desc;
$function$;

drop function if exists public.meta_audience_overview(uuid, uuid);
create function public.meta_audience_overview(target_organization_id uuid, target_store_id uuid default null)
returns table(
  audience_id uuid, audience_name text, subtype text,
  approximate_count_lower bigint, approximate_count_upper bigint, retention_days integer,
  is_lookalike boolean, lookalike_ratio numeric, lookalike_country text, origin_name text,
  delivery_status_code integer, delivery_status_description text, ad_sets_using bigint,
  external_updated_at timestamptz, ad_sets_including bigint, ad_sets_excluding bigint,
  active_ad_sets bigint, archived_ad_sets bigint
)
language sql stable set search_path to 'pg_catalog', 'public'
as $function$
  with scoped as (
    select a.* from public.meta_custom_audiences a
    join public.meta_ad_accounts acc on acc.id = a.ad_account_id
    where a.organization_id = target_organization_id
      and (target_store_id is null or acc.store_id = target_store_id)
  ), usage as (
    select a.id,
      count(*) filter (where coalesce(jsonb_path_exists(s.targeting_data,
        '$.**.custom_audiences[*].id ? (@ == $aid)', jsonb_build_object('aid', a.external_audience_id)), false))::bigint included,
      count(*) filter (where coalesce(jsonb_path_exists(s.targeting_data,
        '$.**.excluded_custom_audiences[*].id ? (@ == $aid)', jsonb_build_object('aid', a.external_audience_id)), false))::bigint excluded,
      count(*) filter (where upper(coalesce(s.effective_status, s.configured_status, '')) not in ('DELETED','ARCHIVED'))::bigint active,
      count(*) filter (where upper(coalesce(s.effective_status, s.configured_status, '')) in ('DELETED','ARCHIVED'))::bigint archived
    from scoped a
    left join public.meta_ad_accounts acc on acc.id = a.ad_account_id
    left join public.meta_campaigns cp on cp.ad_account_id = acc.id and cp.organization_id = target_organization_id
    left join public.meta_ad_sets s on s.campaign_id = cp.id and s.organization_id = target_organization_id
      and (coalesce(jsonb_path_exists(s.targeting_data, '$.**.custom_audiences[*].id ? (@ == $aid)',
        jsonb_build_object('aid', a.external_audience_id)), false)
        or coalesce(jsonb_path_exists(s.targeting_data, '$.**.excluded_custom_audiences[*].id ? (@ == $aid)',
        jsonb_build_object('aid', a.external_audience_id)), false))
    group by a.id, a.external_audience_id
  )
  select a.id, a.name::text, a.subtype::text, a.approximate_count_lower, a.approximate_count_upper,
    a.retention_days, a.is_lookalike, a.lookalike_ratio, a.lookalike_country::text,
    origin.name::text,
    case when a.delivery_status->>'code' ~ '^[0-9]+$' then (a.delivery_status->>'code')::integer end,
    a.delivery_status->>'description', coalesce(u.included,0) + coalesce(u.excluded,0),
    a.external_updated_at, coalesce(u.included,0), coalesce(u.excluded,0),
    coalesce(u.active,0), coalesce(u.archived,0)
  from scoped a
  left join usage u on u.id = a.id
  left join scoped origin on origin.ad_account_id = a.ad_account_id
    and origin.external_audience_id = a.lookalike_origin_external_id
  order by a.is_lookalike, a.name;
$function$;

grant execute on function public.meta_change_impact(uuid, date, date, uuid, integer, numeric) to authenticated;
grant execute on function public.meta_audience_overview(uuid, uuid) to authenticated;

insert into public.prompt_versions (code, version, content, checksum)
select 'a25_cambios_meta_system', 'v4', p.content || E'\n\n11. INVESTIGACION DE CAMBIOS\nCada evento puede traer `comparison_status`: solo `comparable_observation_only` permite describir una comparacion numerica completa de siete dias por lado; incluso entonces es asociacion temporal, nunca causalidad. `partial_*`, `attribution_immature`, `below_minimum_spend` y `unresolved_entity` son eventos operativos sin veredicto de impacto; no los descartes ni los conviertas en cero. Las ventanas respetan el dia local de la cuenta, excluyen el dia del cambio y requieren siete dias observados en ambos lados y una semana adicional de maduracion. Si el gate A24 no es `usable_with_attribution_limits`, no uses compras/ROAS como evidencia de efecto; impresiones, clics, CPM y gasto siguen siendo descripciones de entrega, con la limitacion de medicion indicada. Usa objetivo, actor, cambios concurrentes y `extra_data` solo como contexto observado. No atribuyas causalidad, no recomiendes revertir automaticamente. En publicos separa conjuntos que incluyen/excluyen y estados activos/archivados; cero referencias no autoriza borrado.',
  encode(sha256((p.content || E'\n\n11. INVESTIGACION DE CAMBIOS\nCada evento puede traer `comparison_status`: solo `comparable_observation_only` permite describir una comparacion numerica completa de siete dias por lado; incluso entonces es asociacion temporal, nunca causalidad. `partial_*`, `attribution_immature`, `below_minimum_spend` y `unresolved_entity` son eventos operativos sin veredicto de impacto; no los descartes ni los conviertas en cero. Las ventanas respetan el dia local de la cuenta, excluyen el dia del cambio y requieren siete dias observados en ambos lados y una semana adicional de maduracion. Si el gate A24 no es `usable_with_attribution_limits`, no uses compras/ROAS como evidencia de efecto; impresiones, clics, CPM y gasto siguen siendo descripciones de entrega, con la limitacion de medicion indicada. Usa objetivo, actor, cambios concurrentes y `extra_data` solo como contexto observado. No atribuyas causalidad, no recomiendes revertir automaticamente. En publicos separa conjuntos que incluyen/excluyen y estados activos/archivados; cero referencias no autoriza borrado.')::bytea), 'hex')
from public.prompt_versions p where p.code = 'a25_cambios_meta_system' and p.version = 'v3'
on conflict (code, version) do update set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av set is_active = false
from public.agent_definitions d where av.definition_id = d.id and av.is_active and d.code = 'a25_cambios_meta';
insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select d.id, 'v4', source.model, 'a25_cambios_meta_system', 'v4', source.allowed_tools, source.approval_mode
from public.agent_definitions d
join public.agent_versions source on source.definition_id = d.id and source.version = 'v3'
where d.code = 'a25_cambios_meta'
on conflict (definition_id, version) do update set prompt_code = excluded.prompt_code,
  prompt_version = excluded.prompt_version, allowed_tools = excluded.allowed_tools,
  approval_mode = excluded.approval_mode, is_active = true;
