-- Daily ad-level series for A23. Keep reach/frequency as daily observations;
-- never sum either metric across dates. The canonical no-breakdown row is
-- selected once per day to avoid duplicate spend/impressions from attribution
-- report variants.
create or replace function public.meta_creative_daily_trend(
  target_organization_id uuid,
  target_ad_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  ad_scope record;
  trend_rows jsonb;
  days_with_data integer := 0;
begin
  if target_organization_id is null or target_ad_id is null
     or period_start is null or period_end is null
     or period_end < period_start
     or period_end - period_start > 90
     or period_end > current_date then
    raise exception 'invalid_meta_creative_daily_trend_input';
  end if;

  select a.id as ad_account_id, a.canonical_purchase_action_type
  into ad_scope
  from public.meta_ads d
  join public.meta_ad_sets s on s.id = d.ad_set_id
  join public.meta_campaigns c on c.id = s.campaign_id
  join public.meta_ad_accounts a on a.id = c.ad_account_id
  where d.id = target_ad_id
    and d.organization_id = target_organization_id
    and (target_store_id is null or a.store_id = target_store_id);

  if not found then
    return jsonb_build_object('status', 'not_found_or_out_of_scope');
  end if;

  with ranked_rows as (
    select
      r.id,
      r.metric_date,
      r.spend,
      r.impressions,
      r.reach,
      r.frequency,
      r.outbound_clicks,
      r.cpm,
      r.action_report_time,
      r.attribution_hash,
      row_number() over (
        partition by r.metric_date
        order by (r.action_report_time = 'default') desc,
                 r.synced_at desc,
                 r.attribution_hash asc,
                 r.id asc
      ) as row_rank
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.ad_account_id = ad_scope.ad_account_id
      and r.ad_id = target_ad_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.metric_date between period_start and period_end
  ), chosen_rows as (
    select * from ranked_rows where row_rank = 1
  ), chosen_purchase_metrics as (
    select distinct on (m.insight_row_id, m.metric_name)
      m.insight_row_id,
      m.metric_name,
      m.value,
      m.attribution_window
    from public.meta_insight_action_metrics m
    join chosen_rows r on r.id = m.insight_row_id
    where m.organization_id = target_organization_id
      and m.action_type = ad_scope.canonical_purchase_action_type
      and m.metric_name in ('actions', 'action_values')
    order by m.insight_row_id, m.metric_name,
             public.meta_attribution_window_rank(m.attribution_window)
  ), purchase_by_row as (
    select
      insight_row_id,
      coalesce(sum(value) filter (where metric_name = 'actions'), 0) as purchases,
      coalesce(sum(value) filter (where metric_name = 'action_values'), 0) as purchase_value,
      min(attribution_window) as attribution_window
    from chosen_purchase_metrics
    group by insight_row_id
  ), daily as (
    select
      r.metric_date,
      r.spend,
      r.impressions,
      r.reach,
      r.frequency,
      r.outbound_clicks,
      coalesce(r.cpm, case when r.impressions > 0 then r.spend * 1000 / r.impressions end) as cpm,
      coalesce(p.purchases, 0) as purchases,
      coalesce(p.purchase_value, 0) as purchase_value,
      p.attribution_window
    from chosen_rows r
    left join purchase_by_row p on p.insight_row_id = r.id
  )
  select count(*)::integer,
         coalesce(jsonb_agg(jsonb_build_object(
           'date', d.metric_date,
           'spend', d.spend,
           'impressions', d.impressions,
           'reach', d.reach,
           'frequency', d.frequency,
           'outbound_clicks', d.outbound_clicks,
           'outbound_ctr', case when d.impressions > 0 then round(d.outbound_clicks::numeric / d.impressions, 6) end,
           'cpm', d.cpm,
           'purchases', d.purchases,
           'purchase_value', d.purchase_value,
           'cost_per_purchase', case when d.purchases > 0 then round(d.spend / d.purchases, 2) end,
           'purchase_attribution_window', d.attribution_window
         ) order by d.metric_date), '[]'::jsonb)
  into days_with_data, trend_rows
  from daily d;

  return jsonb_build_object(
    'status', 'available',
    'ad_id', target_ad_id,
    'period', jsonb_build_object('start', period_start, 'end', period_end),
    'grain', 'one canonical ad-level row per day',
    'days_with_data', days_with_data,
    'daily_metrics', trend_rows,
    'caveats', jsonb_build_array(
      'reach_and_frequency_are_daily_observations_and_must_not_be_summed_across_dates',
      'one_no_breakdown_row_per_date_is_selected_to_avoid_duplicate_attribution_report_rows',
      'purchase_metrics_follow_the_selected_row_attribution_window_and_may_not_match_other_reporting_windows',
      'daily_trend_is_descriptive_and_does_not_prove_creative_fatigue_or_causality'
    )
  );
end;
$$;

comment on function public.meta_creative_daily_trend(uuid, uuid, date, date, uuid) is
  'Read-only scoped A23 time series: one canonical ad-level row per date; reach/frequency are daily only and never summed across the selected period.';

revoke all on function public.meta_creative_daily_trend(uuid, uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function public.meta_creative_daily_trend(uuid, uuid, date, date, uuid) to service_role;
