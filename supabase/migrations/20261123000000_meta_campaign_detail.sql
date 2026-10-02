-- Ficha de una campaña de Meta Ads (/meta/campanas/[id]): estructura
-- (estado, presupuesto, conjuntos, anuncios con incidencia) y una serie diaria
-- por campaña, que hoy no existe (las funciones de gasto diario son de toda la
-- cuenta). Las tres funciones de detalle (conjuntos, anuncios, cambios) ya
-- existen a nivel de cuenta/tienda: se les añade un filtro opcional de
-- campaña en vez de duplicarlas.
--
-- `drop function` de cada firma vieja antes de recrear (ver CLAUDE.md): un
-- parametro nuevo con default crea una sobrecarga si no se hace así.

-- ---------------------------------------------------------------------------
-- 1. Estructura de cada campaña: lo que no es una metrica de periodo.
-- ---------------------------------------------------------------------------
drop function if exists public.meta_campaign_structure(uuid, uuid);

create function public.meta_campaign_structure(
  target_organization_id uuid,
  target_store_id uuid default null
)
returns table (
  campaign_id uuid,
  name text,
  objective text,
  effective_status text,
  configured_status text,
  daily_budget numeric,
  lifetime_budget numeric,
  budget_remaining numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  ad_set_count bigint,
  active_ad_set_count bigint,
  ad_count bigint,
  rejected_ad_count bigint,
  learning_ad_set_count bigint,
  learning_limited_ad_set_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.name::text,
    c.objective::text,
    c.effective_status::text,
    c.configured_status::text,
    c.daily_budget,
    c.lifetime_budget,
    c.budget_remaining,
    c.starts_at,
    c.ends_at,
    count(distinct s.id) as ad_set_count,
    count(distinct s.id) filter (where s.effective_status = 'ACTIVE') as active_ad_set_count,
    count(distinct a.id) as ad_count,
    count(distinct a.id) filter (where exists (
      select 1 from public.meta_ad_issues i where i.ad_id = a.id
    )) as rejected_ad_count,
    count(distinct s.id) filter (where s.learning_stage_status = 'LEARNING') as learning_ad_set_count,
    count(distinct s.id) filter (where s.learning_stage_status = 'LEARNING_LIMITED') as learning_limited_ad_set_count
  from public.meta_campaigns c
  join public.meta_ad_accounts acc on acc.id = c.ad_account_id
  left join public.meta_ad_sets s on s.campaign_id = c.id
  left join public.meta_ads a on a.ad_set_id = s.id
  where c.organization_id = target_organization_id
    and (target_store_id is null or acc.store_id = target_store_id)
  group by c.id;
$$;

grant execute on function public.meta_campaign_structure(uuid, uuid) to authenticated, service_role;
comment on function public.meta_campaign_structure(uuid, uuid) is
  'Una fila por campaña: estado, presupuesto y recuento de conjuntos/anuncios/incidencias. No depende de periodo.';

-- ---------------------------------------------------------------------------
-- 2. Serie diaria por campaña (gasto + compras atribuidas por Meta).
-- ---------------------------------------------------------------------------
drop function if exists public.meta_campaign_daily(uuid, date, date, uuid, uuid);

create function public.meta_campaign_daily(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  target_campaign_id uuid default null
)
returns table (
  campaign_id uuid,
  bucket_date date,
  spend numeric,
  purchases numeric,
  purchase_value numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with base_rows as (
    select r.id, r.campaign_id, r.spend, r.metric_date, r.ad_account_id
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.campaign_id is not null
      and r.metric_date >= period_start
      and r.metric_date <= period_end
      and (target_campaign_id is null or r.campaign_id = target_campaign_id)
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  purchases_by_row as (
    select
      b.id,
      coalesce(sum(m.value) filter (where m.metric_name = 'actions'), 0) as purchases,
      coalesce(sum(m.value) filter (where m.metric_name = 'action_values'), 0) as purchase_value
    from base_rows b
    join public.meta_insight_action_metrics m on m.insight_row_id = b.id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    group by b.id
  )
  select
    b.campaign_id,
    b.metric_date,
    sum(b.spend) as spend,
    coalesce(sum(p.purchases), 0) as purchases,
    coalesce(sum(p.purchase_value), 0) as purchase_value
  from base_rows b
  left join purchases_by_row p on p.id = b.id
  group by b.campaign_id, b.metric_date
  order by b.campaign_id, b.metric_date;
$$;

grant execute on function public.meta_campaign_daily(uuid, date, date, uuid, uuid) to authenticated, service_role;
comment on function public.meta_campaign_daily(uuid, date, date, uuid, uuid) is
  'Gasto y compras atribuidas por día y campaña. Sin target_campaign_id, trae todas (para los sparklines del listado) en una sola llamada.';

-- ---------------------------------------------------------------------------
-- 3. Conjuntos de anuncios: añade filtro de campaña y cifras de periodo que
--    meta_learning_phase_status no traía (solo spend, sin compras ni ROAS).
-- ---------------------------------------------------------------------------
drop function if exists public.meta_learning_phase_status(uuid, date, date, uuid);

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
  conversions_missing integer,
  daily_budget numeric,
  spend_in_period numeric,
  purchases_in_period numeric,
  purchase_value_in_period numeric,
  roas_in_period numeric,
  last_significant_change timestamptz,
  days_since_change numeric
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with scoped_sets as (
    select s.*, c.name as campaign_name, c.ad_account_id
    from public.meta_ad_sets s
    join public.meta_campaigns c on c.id = s.campaign_id
    where s.organization_id = target_organization_id
      and (target_campaign_id is null or s.campaign_id = target_campaign_id)
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = c.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  rows_by_set as (
    select r.id, r.ad_set_id, r.spend, r.ad_account_id
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_set_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
  ),
  purchases_by_set as (
    select
      rb.ad_set_id,
      coalesce(sum(m.value) filter (where m.metric_name = 'actions'), 0) as purchases,
      coalesce(sum(m.value) filter (where m.metric_name = 'action_values'), 0) as purchase_value
    from rows_by_set rb
    join public.meta_insight_action_metrics m on m.insight_row_id = rb.id
    join public.meta_ad_accounts a on a.id = rb.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    group by rb.ad_set_id
  ),
  spend_by_set as (
    select ad_set_id, sum(spend) as spend
    from rows_by_set
    group by ad_set_id
  )
  select
    s.id as ad_set_id,
    s.name::text as ad_set_name,
    s.campaign_name::text,
    s.effective_status::text,
    s.optimization_goal::text,
    s.learning_stage_status::text,
    s.learning_conversions,
    s.learning_conversions_needed,
    case
      when s.learning_conversions_needed is not null
      then greatest(
        s.learning_conversions_needed - coalesce(s.learning_conversions, 0),
        0
      )
    end as conversions_missing,
    s.daily_budget,
    coalesce(sp.spend, 0) as spend_in_period,
    coalesce(p.purchases, 0) as purchases_in_period,
    coalesce(p.purchase_value, 0) as purchase_value_in_period,
    case when coalesce(sp.spend, 0) > 0 then round(coalesce(p.purchase_value, 0) / sp.spend, 4) end as roas_in_period,
    ch.event_time as last_significant_change,
    case
      when ch.event_time is not null
      then round(extract(epoch from (now() - ch.event_time))::numeric / 86400, 1)
    end as days_since_change
  from scoped_sets s
  left join spend_by_set sp on sp.ad_set_id = s.id
  left join purchases_by_set p on p.ad_set_id = s.id
  left join lateral (
    select a.event_time
    from public.meta_account_activities a
    where a.organization_id = target_organization_id
      and a.ad_account_id = s.ad_account_id
      and a.object_external_id = s.external_ad_set_id
    order by a.event_time desc
    limit 1
  ) ch on true
  where target_campaign_id is not null
     or s.learning_stage_status is not null
     or coalesce(sp.spend, 0) > 0
  order by coalesce(sp.spend, 0) desc;
$function$;

grant execute on function public.meta_learning_phase_status(uuid, date, date, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Anuncios: añade filtro de campaña a meta_creative_performance.
-- ---------------------------------------------------------------------------
drop function if exists public.meta_creative_performance(uuid, date, date, uuid, bigint);

create function public.meta_creative_performance(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  min_impressions bigint default 1000,
  target_campaign_id uuid default null
)
returns table(
  ad_id uuid,
  ad_name text,
  ad_set_name text,
  campaign_name text,
  effective_status text,
  spend numeric,
  impressions bigint,
  outbound_clicks bigint,
  outbound_ctr numeric,
  video_plays bigint,
  hook_rate numeric,
  hold_rate numeric,
  thruplay_rate numeric,
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  purchases numeric,
  purchase_value numeric,
  roas numeric,
  cost_per_purchase numeric,
  purchase_attribution_window text,
  has_video boolean,
  enough_volume boolean,
  days_with_data bigint,
  spend_currency text
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select
      r.id, r.ad_id, r.spend, r.impressions, r.metric_date,
      r.outbound_clicks, r.video_plays, r.video_p100_watched, r.video_thruplays,
      r.quality_ranking, r.engagement_rate_ranking, r.conversion_rate_ranking,
      r.ad_account_id, r.campaign_id
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_campaign_id is null or r.campaign_id = target_campaign_id)
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  row_purchases as (
    select distinct on (m.insight_row_id, m.metric_name)
      m.insight_row_id, m.metric_name, m.value, m.attribution_window, b.ad_id
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    order by
      m.insight_row_id,
      m.metric_name,
      public.meta_attribution_window_rank(m.attribution_window)
  ),
  purchases_by_ad as (
    select
      ad_id,
      coalesce(sum(value) filter (where metric_name = 'actions'), 0) as purchases,
      coalesce(sum(value) filter (where metric_name = 'action_values'), 0) as purchase_value,
      (array_agg(attribution_window order by
        public.meta_attribution_window_rank(attribution_window)))[1] as attribution_window
    from row_purchases
    group by ad_id
  ),
  latest_verdict as (
    select distinct on (b.ad_id)
      b.ad_id,
      b.quality_ranking,
      b.engagement_rate_ranking,
      b.conversion_rate_ranking
    from base_rows b
    where b.quality_ranking is not null
       or b.engagement_rate_ranking is not null
       or b.conversion_rate_ranking is not null
    order by b.ad_id, b.metric_date desc
  ),
  totals as (
    select
      b.ad_id,
      sum(b.spend) as spend,
      sum(b.impressions)::bigint as impressions,
      sum(b.outbound_clicks)::bigint as outbound_clicks,
      sum(b.video_plays)::bigint as video_plays,
      sum(b.video_p100_watched)::bigint as video_p100_watched,
      sum(b.video_thruplays)::bigint as video_thruplays,
      count(distinct b.metric_date)::bigint as days_with_data
    from base_rows b
    group by b.ad_id
  )
  select
    t.ad_id,
    d.name::text as ad_name,
    s.name::text as ad_set_name,
    c.name::text as campaign_name,
    d.effective_status::text,
    coalesce(t.spend, 0) as spend,
    coalesce(t.impressions, 0) as impressions,
    t.outbound_clicks,
    case
      when t.impressions >= min_impressions and t.outbound_clicks is not null
      then round(t.outbound_clicks::numeric / t.impressions, 6)
    end as outbound_ctr,
    t.video_plays,
    case
      when t.impressions >= min_impressions and t.video_plays is not null
      then round(t.video_plays::numeric / t.impressions, 6)
    end as hook_rate,
    case
      when t.impressions >= min_impressions and t.video_p100_watched is not null
      then round(t.video_p100_watched::numeric / nullif(t.video_plays, 0), 6)
    end as hold_rate,
    case
      when t.impressions >= min_impressions and t.video_thruplays is not null
      then round(t.video_thruplays::numeric / t.impressions, 6)
    end as thruplay_rate,
    v.quality_ranking::text,
    v.engagement_rate_ranking::text,
    v.conversion_rate_ranking::text,
    coalesce(p.purchases, 0) as purchases,
    coalesce(p.purchase_value, 0) as purchase_value,
    case
      when coalesce(t.spend, 0) > 0
      then round(coalesce(p.purchase_value, 0) / t.spend, 4)
    end as roas,
    case
      when coalesce(p.purchases, 0) > 0
      then round(coalesce(t.spend, 0) / p.purchases, 2)
    end as cost_per_purchase,
    p.attribution_window::text as purchase_attribution_window,
    t.video_plays is not null as has_video,
    coalesce(t.impressions, 0) >= min_impressions as enough_volume,
    t.days_with_data,
    account.currency_code::text as spend_currency
  from totals t
  join public.meta_ads d on d.id = t.ad_id
  join public.meta_ad_sets s on s.id = d.ad_set_id
  join public.meta_campaigns c on c.id = s.campaign_id
  join public.meta_ad_accounts account
    on account.id = c.ad_account_id
   and account.organization_id = target_organization_id
  left join latest_verdict v on v.ad_id = t.ad_id
  left join purchases_by_ad p on p.ad_id = t.ad_id
  order by coalesce(t.spend, 0) desc;
$function$;

revoke all on function public.meta_creative_performance(uuid, date, date, uuid, bigint, uuid) from public, anon;
grant execute on function public.meta_creative_performance(uuid, date, date, uuid, bigint, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Cambios: añade filtro de campaña a meta_change_impact.
-- ---------------------------------------------------------------------------
drop function if exists public.meta_change_impact(uuid, date, date, uuid, integer, numeric);

create function public.meta_change_impact(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  window_days integer default 7,
  min_spend numeric default 50,
  target_campaign_id uuid default null
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
  purchase_attribution_window text
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with day_rows as (
    select
      r.metric_date,
      r.campaign_id,
      r.ad_set_id,
      r.ad_id,
      r.spend,
      coalesce(pm.purchases, 0) as purchases,
      coalesce(pm.purchase_value, 0) as purchase_value,
      pm.attribution_window
    from public.meta_insight_rows_daily r
    join public.meta_ad_accounts a on a.id = r.ad_account_id
    left join lateral (
      select
        sum(x.value) filter (where x.metric_name = 'actions') as purchases,
        sum(x.value) filter (where x.metric_name = 'action_values') as purchase_value,
        (array_agg(x.attribution_window order by
          public.meta_attribution_window_rank(x.attribution_window)))[1] as attribution_window
      from (
        select distinct on (m.metric_name)
          m.metric_name, m.value, m.attribution_window
        from public.meta_insight_action_metrics m
        where m.insight_row_id = r.id
          and m.action_type = a.canonical_purchase_action_type
        order by m.metric_name, public.meta_attribution_window_rank(m.attribution_window)
      ) x
    ) pm on true
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and (period_start is null or r.metric_date >= period_start - window_days)
      and r.metric_date <= period_end + window_days
      and (target_store_id is null or a.store_id = target_store_id)
      and (target_campaign_id is null or r.campaign_id = target_campaign_id)
  ),
  changes as (
    select
      act.event_time,
      act.event_type,
      act.translated_event_type,
      act.actor_name,
      act.object_name,
      act.object_external_id,
      act.ad_account_id,
      (act.event_time at time zone coalesce(acc.timezone_name, 'UTC'))::date as event_date
    from public.meta_account_activities act
    join public.meta_ad_accounts acc on acc.id = act.ad_account_id
    where act.organization_id = target_organization_id
      and act.object_external_id <> ''
      and (period_start is null
        or (act.event_time at time zone coalesce(acc.timezone_name, 'UTC'))::date >= period_start)
      and (act.event_time at time zone coalesce(acc.timezone_name, 'UTC'))::date <= period_end
      and (target_store_id is null or acc.store_id = target_store_id)
  ),
  resolved as (
    select c.*, 'campaign'::text as entity_level, e.id as entity_id
    from changes c
    join public.meta_campaigns e
      on e.ad_account_id = c.ad_account_id
     and e.external_campaign_id = c.object_external_id
    where target_campaign_id is null or e.id = target_campaign_id
    union all
    select c.*, 'adset'::text, s.id
    from changes c
    join public.meta_ad_sets s
      on s.organization_id = target_organization_id
     and s.external_ad_set_id = c.object_external_id
    where target_campaign_id is null or s.campaign_id = target_campaign_id
    union all
    select c.*, 'ad'::text, d.id
    from changes c
    join public.meta_ads d
      on d.organization_id = target_organization_id
     and d.external_ad_id = c.object_external_id
    join public.meta_ad_sets ds on ds.id = d.ad_set_id
    where target_campaign_id is null or ds.campaign_id = target_campaign_id
  )
  select
    r.event_time,
    r.event_type::text,
    r.translated_event_type::text,
    r.actor_name::text,
    r.object_name::text,
    r.entity_level,
    w.spend_before,
    w.spend_after,
    w.purchases_before,
    w.purchases_after,
    w.value_before as purchase_value_before,
    w.value_after as purchase_value_after,
    k.roas_before,
    k.roas_after,
    k.cpa_before,
    k.cpa_after,
    case
      when k.roas_before > 0
      then round((k.roas_after - k.roas_before) / k.roas_before * 100, 1)
    end as roas_delta_pct,
    w.days_before,
    w.days_after,
    w.attribution_window::text as purchase_attribution_window
  from resolved r
  cross join lateral (
    select
      coalesce(sum(dr.spend) filter (where dr.metric_date < r.event_date), 0) as spend_before,
      coalesce(sum(dr.spend) filter (where dr.metric_date > r.event_date), 0) as spend_after,
      coalesce(sum(dr.purchases) filter (where dr.metric_date < r.event_date), 0) as purchases_before,
      coalesce(sum(dr.purchases) filter (where dr.metric_date > r.event_date), 0) as purchases_after,
      coalesce(sum(dr.purchase_value) filter (where dr.metric_date < r.event_date), 0) as value_before,
      coalesce(sum(dr.purchase_value) filter (where dr.metric_date > r.event_date), 0) as value_after,
      count(distinct dr.metric_date) filter (where dr.metric_date < r.event_date) as days_before,
      count(distinct dr.metric_date) filter (where dr.metric_date > r.event_date) as days_after,
      (array_agg(dr.attribution_window) filter (where dr.attribution_window is not null))[1] as attribution_window
    from day_rows dr
    where dr.metric_date >= r.event_date - window_days
      and dr.metric_date <= r.event_date + window_days
      and dr.metric_date <> r.event_date
      and (
        (r.entity_level = 'campaign' and dr.campaign_id = r.entity_id)
        or (r.entity_level = 'adset' and dr.ad_set_id = r.entity_id)
        or (r.entity_level = 'ad' and dr.ad_id = r.entity_id)
      )
  ) w
  cross join lateral (
    select
      case when w.spend_before > 0 then round(w.value_before / w.spend_before, 4) end as roas_before,
      case when w.spend_after > 0 then round(w.value_after / w.spend_after, 4) end as roas_after,
      case when w.purchases_before > 0 then round(w.spend_before / w.purchases_before, 2) end as cpa_before,
      case when w.purchases_after > 0 then round(w.spend_after / w.purchases_after, 2) end as cpa_after
  ) k
  where w.days_before > 0
    and w.days_after > 0
    and w.spend_before + w.spend_after >= min_spend
  order by r.event_time desc;
$function$;

grant execute on function public.meta_change_impact(uuid, date, date, uuid, integer, numeric, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Incidencias de un anuncio (motivo de rechazo), para la ficha de campaña.
-- ---------------------------------------------------------------------------
drop function if exists public.meta_campaign_ad_issues(uuid, uuid);

create function public.meta_campaign_ad_issues(
  target_organization_id uuid,
  target_campaign_id uuid
)
returns table (
  ad_id uuid,
  ad_name text,
  level text,
  error_type text,
  error_summary text,
  detected_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.ad_id, a.name::text, i.level::text, i.error_type::text, i.error_summary, i.detected_at
  from public.meta_ad_issues i
  join public.meta_ads a on a.id = i.ad_id
  join public.meta_ad_sets s on s.id = a.ad_set_id
  where i.organization_id = target_organization_id
    and s.campaign_id = target_campaign_id
  order by i.detected_at desc;
$$;

grant execute on function public.meta_campaign_ad_issues(uuid, uuid) to authenticated, service_role;
