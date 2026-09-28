drop function if exists public.meta_performance_daily(uuid, date, date, uuid);

create or replace function public.meta_performance_daily(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  bucket_date date,
  spend numeric,
  purchases numeric,
  purchase_value numeric,
  roas numeric
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with days as (
    select generate_series(period_start, period_end, interval '1 day')::date as bucket_date
  ),
  base_rows as (
    select r.id, r.ad_account_id, r.metric_date, r.spend
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.metric_date >= period_start
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  row_purchases as (
    select distinct on (m.insight_row_id, m.metric_name)
      m.insight_row_id, m.metric_name, m.value
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    order by
      m.insight_row_id,
      m.metric_name,
      public.meta_attribution_window_rank(m.attribution_window)
  ),
  daily_spend as (
    select r.metric_date as bucket_date, coalesce(sum(r.spend), 0) as spend
    from base_rows r
    group by r.metric_date
  ),
  daily_purchases as (
    select
      b.metric_date as bucket_date,
      coalesce(sum(p.value) filter (where p.metric_name = 'actions'), 0) as purchases,
      coalesce(sum(p.value) filter (where p.metric_name = 'action_values'), 0) as purchase_value
    from base_rows b
    left join row_purchases p on p.insight_row_id = b.id
    group by b.metric_date
  )
  select
    d.bucket_date,
    coalesce(s.spend, 0) as spend,
    coalesce(p.purchases, 0) as purchases,
    coalesce(p.purchase_value, 0) as purchase_value,
    case
      when coalesce(s.spend, 0) > 0
        then round(coalesce(p.purchase_value, 0) / s.spend, 4)
      else null
    end as roas
  from days d
  left join daily_spend s on s.bucket_date = d.bucket_date
  left join daily_purchases p on p.bucket_date = d.bucket_date
  order by d.bucket_date;
$function$;
