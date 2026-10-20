-- Huella específica de A12: solo cambia cuando cambia la cuenta/tienda de
-- Klaviyo, su sync, los reportes de los dos meses evaluados o sus métricas.
create or replace function public.klaviyo_email_activity_digest(
  target_organization_id uuid,
  target_store_id uuid,
  current_start date,
  current_end date,
  previous_start date,
  previous_end date
)
returns text
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with scoped_accounts as (
    select a.id, a.connection_id, a.store_id, a.currency_code,
      a.conversion_metric_id, a.conversion_metric_name, a.updated_at
    from public.klaviyo_accounts a
    where a.organization_id = klaviyo_email_activity_digest.target_organization_id
      and (klaviyo_email_activity_digest.target_store_id is null or a.store_id = klaviyo_email_activity_digest.target_store_id)
  ), latest_sync as (
    select distinct on (r.connection_id)
      r.connection_id, r.status, r.finished_at, r.records_failed, r.error_message
    from public.integration_sync_runs r
    where r.organization_id = klaviyo_email_activity_digest.target_organization_id
      and r.provider = 'klaviyo'
      and r.connection_id in (select a.connection_id from scoped_accounts a)
    order by r.connection_id, r.started_at desc
  ), reports as (
    select rr.id, rr.account_id, rr.status, rr.period_start, rr.period_end,
      rr.currency_code, rr.finished_at,
      count(rv.id) as value_rows,
      max(rv.created_at) as latest_value_at,
      sum(rv.revenue) as revenue_sum,
      sum(rv.conversions) as conversions_sum,
      sum(nullif(rv.raw_data->'statistics'->>'recipients', '')::numeric) as recipients_sum,
      sum(nullif(rv.raw_data->'statistics'->>'delivered', '')::numeric) as delivered_sum
    from public.klaviyo_report_runs rr
    left join public.klaviyo_report_values rv on rv.report_run_id = rr.id
    where rr.organization_id = klaviyo_email_activity_digest.target_organization_id
      and rr.account_id in (select a.id from scoped_accounts a)
      and rr.period_start <= klaviyo_email_activity_digest.current_end
      and rr.period_end >= klaviyo_email_activity_digest.previous_start
    group by rr.id
  )
  select md5(jsonb_build_object(
    'organization_id', klaviyo_email_activity_digest.target_organization_id,
    'store_id', klaviyo_email_activity_digest.target_store_id,
    'current_window', jsonb_build_array(klaviyo_email_activity_digest.current_start, klaviyo_email_activity_digest.current_end),
    'previous_window', jsonb_build_array(klaviyo_email_activity_digest.previous_start, klaviyo_email_activity_digest.previous_end),
    'accounts', coalesce((select jsonb_agg(jsonb_build_array(id, connection_id, store_id, currency_code, conversion_metric_id, conversion_metric_name, updated_at) order by id) from scoped_accounts), '[]'::jsonb),
    'syncs', coalesce((select jsonb_agg(jsonb_build_array(connection_id, status, finished_at, records_failed, error_message) order by connection_id) from latest_sync), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_array(id, account_id, status, period_start, period_end, currency_code, finished_at, value_rows, latest_value_at, revenue_sum, conversions_sum, recipients_sum, delivered_sum) order by id) from reports), '[]'::jsonb)
  )::text);
$function$;

revoke all on function public.klaviyo_email_activity_digest(uuid, uuid, date, date, date, date) from public, anon, authenticated;
grant execute on function public.klaviyo_email_activity_digest(uuid, uuid, date, date, date, date) to service_role;
