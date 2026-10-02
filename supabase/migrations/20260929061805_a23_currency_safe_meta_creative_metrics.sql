-- A23: every spend amount carries its originating Meta ad-account currency.
-- Rankings are normalized only within a currency; unknown currencies are not
-- added together and never receive a spend share.

drop function if exists public.meta_creative_performance(uuid, date, date, uuid, bigint);
create or replace function public.meta_creative_performance(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  min_impressions bigint default 1000
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
      r.ad_account_id
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
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

drop function if exists public.meta_creative_ranking_distribution(uuid, date, date, uuid);
create or replace function public.meta_creative_ranking_distribution(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  dimension text,
  ranking_value text,
  ads bigint,
  spend numeric,
  spend_share numeric,
  currency_code text
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select
      r.ad_id, r.ad_account_id, r.spend, r.metric_date,
      r.quality_ranking, r.engagement_rate_ranking, r.conversion_rate_ranking
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  spend_by_ad as (
    select ad_id, ad_account_id, sum(spend) as spend
    from base_rows
    group by ad_id, ad_account_id
  ),
  latest_verdict as (
    select distinct on (ad_id, ad_account_id)
      ad_id, ad_account_id, quality_ranking,
      engagement_rate_ranking, conversion_rate_ranking
    from base_rows
    where quality_ranking is not null
       or engagement_rate_ranking is not null
       or conversion_rate_ranking is not null
    order by ad_id, ad_account_id, metric_date desc
  ),
  spread as (
    select
      d.dimension,
      coalesce(d.value, 'SIN_VEREDICTO') as ranking_value,
      s.spend,
      account.currency_code::text as currency_code
    from spend_by_ad s
    join public.meta_ad_accounts account
      on account.id = s.ad_account_id
     and account.organization_id = target_organization_id
    left join latest_verdict v
      on v.ad_id = s.ad_id and v.ad_account_id = s.ad_account_id
    cross join lateral (values
      ('calidad', v.quality_ranking),
      ('interaccion', v.engagement_rate_ranking),
      ('conversion', v.conversion_rate_ranking)
    ) as d(dimension, value)
  ),
  grouped as (
    select
      dimension,
      ranking_value,
      currency_code,
      count(*)::bigint as ads,
      case when currency_code is not null then sum(spend) end as spend
    from spread
    group by dimension, ranking_value, currency_code
  )
  select
    dimension,
    ranking_value,
    ads,
    spend,
    case
      when currency_code is not null
       and sum(spend) over (partition by dimension, currency_code) > 0
      then round(spend / sum(spend) over (partition by dimension, currency_code), 4)
    end as spend_share,
    currency_code
  from grouped
  order by dimension, currency_code nulls last, spend desc nulls last;
$function$;

revoke all on function public.meta_creative_performance(uuid, date, date, uuid, bigint) from public, anon;
revoke all on function public.meta_creative_ranking_distribution(uuid, date, date, uuid) from public, anon;
grant execute on function public.meta_creative_performance(uuid, date, date, uuid, bigint) to authenticated, service_role;
grant execute on function public.meta_creative_ranking_distribution(uuid, date, date, uuid) to authenticated, service_role;
