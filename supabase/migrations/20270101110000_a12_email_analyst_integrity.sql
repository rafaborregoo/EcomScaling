-- A12: el tracking de comportamiento debe aislar la tienda y el informe solo
-- puede comparar intervalos contenidos en la ventana pedida. También conserva
-- la identidad de cuenta/métrica/canal/mensaje al elegir filas de reporte.

drop function if exists public.klaviyo_tracking_summary(uuid, timestamptz, timestamptz);
create function public.klaviyo_tracking_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid default null
)
returns table (
  event_name text,
  event_count bigint,
  revenue numeric,
  profiles bigint,
  first_event_at timestamptz,
  last_event_at timestamptz
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select
    e.event_name::text,
    count(*)::bigint,
    case when count(distinct e.currency_code) filter (where e.value is not null) = 1
      and count(*) filter (where e.value is not null and e.currency_code is null) = 0
      then sum(e.value) else null end,
    count(distinct e.profile_id)::bigint,
    min(e.occurred_at),
    max(e.occurred_at)
  from public.klaviyo_tracking_events e
  where e.organization_id = target_organization_id
    and e.occurred_at >= period_start
    and e.occurred_at <= period_end
    and (target_store_id is null or exists (
      select 1 from public.klaviyo_accounts ka
      where ka.id = e.account_id
        and ka.organization_id = target_organization_id
        and ka.store_id = target_store_id
    ))
  group by e.event_name
  order by count(*) desc, e.event_name;
$function$;

revoke all on function public.klaviyo_tracking_summary(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.klaviyo_tracking_summary(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;

drop function if exists public.klaviyo_email_report(uuid, date, date, uuid);
create function public.klaviyo_email_report(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  bucket_month date, entity_type text, entity_id uuid, entity_name text,
  subject text, send_time timestamptz, trigger_type text,
  revenue numeric, conversions numeric, recipients numeric, delivered numeric,
  opens_unique numeric, clicks_unique numeric, unsubscribes numeric,
  bounced numeric, spam_complaints numeric
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with picked as (
    select distinct on (
      date_trunc('month', rv.period_start), rv.entity_type,
      rv.external_entity_id, rv.external_message_id, rv.metric_id,
      rr.account_id
    )
      date_trunc('month', rv.period_start)::date as bucket_month,
      rv.organization_id,
      rr.account_id,
      rv.entity_type::text as entity_type,
      rv.external_entity_id,
      rv.external_message_id,
      rv.metric_id,
      rv.currency_code,
      rv.entity_name,
      coalesce(rv.revenue, nullif(rv.raw_data->'statistics'->>'conversion_value', '')::numeric) as revenue,
      coalesce(rv.conversions, nullif(rv.raw_data->'statistics'->>'conversion_uniques', '')::numeric) as conversions,
      nullif(rv.raw_data->'statistics'->>'recipients', '')::numeric as recipients,
      nullif(rv.raw_data->'statistics'->>'delivered', '')::numeric as delivered,
      nullif(rv.raw_data->'statistics'->>'opens_unique', '')::numeric as opens_unique,
      nullif(rv.raw_data->'statistics'->>'clicks_unique', '')::numeric as clicks_unique,
      nullif(rv.raw_data->'statistics'->>'unsubscribes', '')::numeric as unsubscribes,
      nullif(rv.raw_data->'statistics'->>'bounced', '')::numeric as bounced,
      nullif(rv.raw_data->'statistics'->>'spam_complaints', '')::numeric as spam_complaints
    from public.klaviyo_report_values rv
    join public.klaviyo_report_runs rr on rr.id = rv.report_run_id
    where rv.organization_id = klaviyo_email_report.target_organization_id
      and rr.organization_id = klaviyo_email_report.target_organization_id
      and rv.entity_type in ('campaign', 'flow')
      and rv.variation_id = ''
      -- Report intervals are indivisible aggregates. Only consume intervals
      -- wholly contained by the requested inclusive date range; partial month
      -- rows are omitted rather than represented as exact 30-day performance.
      and rv.period_start >= klaviyo_email_report.period_start
      and rv.period_end <= klaviyo_email_report.period_end
      and (klaviyo_email_report.target_store_id is null or exists (
        select 1 from public.klaviyo_accounts ka
        where ka.id = rr.account_id
          and ka.organization_id = klaviyo_email_report.target_organization_id
          and ka.store_id = klaviyo_email_report.target_store_id
      ))
    order by date_trunc('month', rv.period_start), rv.entity_type,
      rv.external_entity_id, rv.external_message_id, rv.metric_id,
      rr.account_id,
      (rv.period_end - rv.period_start) desc, rv.created_at desc
  ), entities as (
    select p.bucket_month, p.organization_id, p.account_id, p.entity_type,
      p.external_entity_id, max(p.entity_name) as entity_name,
      case when count(distinct p.currency_code) filter (where p.revenue is not null) = 1
        and count(*) filter (where p.revenue is not null and p.currency_code is null) = 0
        then sum(p.revenue) else null end as revenue,
      sum(p.conversions) as conversions,
      sum(p.recipients) as recipients, sum(p.delivered) as delivered,
      sum(p.opens_unique) as opens_unique, sum(p.clicks_unique) as clicks_unique,
      sum(p.unsubscribes) as unsubscribes, sum(p.bounced) as bounced,
      sum(p.spam_complaints) as spam_complaints
    from picked p
    group by p.bucket_month, p.organization_id, p.account_id, p.entity_type, p.external_entity_id
  )
  select e.bucket_month, e.entity_type, coalesce(c.id, f.id),
    coalesce(c.name, f.name, e.entity_name), cm.subject, c.send_time,
    f.trigger_type, e.revenue, e.conversions, e.recipients, e.delivered,
    e.opens_unique, e.clicks_unique, e.unsubscribes, e.bounced, e.spam_complaints
  from entities e
  left join lateral (
    select c.id, c.name, c.send_time from public.klaviyo_campaigns c
    where e.entity_type = 'campaign' and c.organization_id = e.organization_id
      and c.account_id = e.account_id and c.external_campaign_id = e.external_entity_id
    order by c.updated_at desc nulls last limit 1
  ) c on true
  left join lateral (
    select f.id, f.name, f.trigger_type from public.klaviyo_flows f
    where e.entity_type = 'flow' and f.organization_id = e.organization_id
      and f.account_id = e.account_id and f.external_flow_id = e.external_entity_id
    order by f.updated_at desc nulls last limit 1
  ) f on true
  left join lateral (
    select coalesce(m.raw_data->'definition'->'content'->>'subject', m.raw_data->'content'->>'subject') as subject
    from public.klaviyo_campaign_messages m
    where m.campaign_id = c.id
    order by (m.channel = 'email') desc nulls last limit 1
  ) cm on true
  order by e.bucket_month, e.entity_type, e.external_entity_id;
$function$;

revoke all on function public.klaviyo_email_report(uuid, date, date, uuid) from public, anon;
grant execute on function public.klaviyo_email_report(uuid, date, date, uuid) to authenticated, service_role;
