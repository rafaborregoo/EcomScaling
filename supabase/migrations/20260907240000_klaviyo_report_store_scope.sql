-- Klaviyo filtrado por tienda, la otra mitad del panel de rendimiento de
-- /marketing (la de Meta va en meta_metrics_store_scope).
--
-- klaviyo_report_values no lleva cuenta, pero si report_run_id, y la ejecucion
-- del informe si sabe de que cuenta salio. La cadena completa es:
--   klaviyo_report_values.report_run_id
--     -> klaviyo_report_runs.account_id
--       -> klaviyo_accounts.store_id
-- Por eso no hace falta tocar el esquema ni el sync para separar por tienda.
--
-- target_store_id NULL = agregado de la organizacion, comportamiento anterior.
--
-- DROP y no solo REPLACE: un parametro nuevo con DEFAULT crea una sobrecarga y
-- la llamada de tres argumentos quedaria ambigua.

drop function if exists public.klaviyo_email_report(uuid, date, date);

create or replace function public.klaviyo_email_report(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  bucket_month date, entity_type text, entity_id uuid, entity_name text,
  subject text, send_time timestamp with time zone, trigger_type text,
  revenue numeric, conversions numeric, recipients numeric, delivered numeric,
  opens_unique numeric, clicks_unique numeric, unsubscribes numeric,
  bounced numeric, spam_complaints numeric
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select distinct on (
      date_trunc('month', rv.period_start),
      rv.entity_type,
      coalesce(c.id::text, f.id::text, rv.external_entity_id)
    )
    date_trunc('month', rv.period_start)::date as bucket_month,
    rv.entity_type::text,
    coalesce(c.id, f.id) as entity_id,
    coalesce(c.name, f.name, rv.entity_name) as entity_name,
    cm.subject,
    c.send_time,
    f.trigger_type,
    coalesce(rv.revenue, nullif(rv.raw_data->'statistics'->>'conversion_value', '')::numeric, 0) as revenue,
    coalesce(rv.conversions, nullif(rv.raw_data->'statistics'->>'conversion_uniques', '')::numeric, 0) as conversions,
    coalesce(nullif(rv.raw_data->'statistics'->>'recipients', '')::numeric, 0) as recipients,
    coalesce(nullif(rv.raw_data->'statistics'->>'delivered', '')::numeric, 0) as delivered,
    coalesce(nullif(rv.raw_data->'statistics'->>'opens_unique', '')::numeric, 0) as opens_unique,
    coalesce(nullif(rv.raw_data->'statistics'->>'clicks_unique', '')::numeric, 0) as clicks_unique,
    coalesce(nullif(rv.raw_data->'statistics'->>'unsubscribes', '')::numeric, 0) as unsubscribes,
    coalesce(nullif(rv.raw_data->'statistics'->>'bounced', '')::numeric, 0) as bounced,
    coalesce(nullif(rv.raw_data->'statistics'->>'spam_complaints', '')::numeric, 0) as spam_complaints
  from public.klaviyo_report_values rv
  left join public.klaviyo_campaigns c
    on rv.entity_type = 'campaign'
   and c.organization_id = rv.organization_id
   and c.external_campaign_id = rv.external_entity_id
  left join public.klaviyo_flows f
    on rv.entity_type = 'flow'
   and f.organization_id = rv.organization_id
   and f.external_flow_id = rv.external_entity_id
  left join lateral (
    select coalesce(
             m.raw_data->'definition'->'content'->>'subject',
             m.raw_data->'content'->>'subject'
           ) as subject
    from public.klaviyo_campaign_messages m
    where m.campaign_id = c.id
    order by (m.channel = 'email') desc nulls last
    limit 1
  ) cm on true
  where rv.organization_id = target_organization_id
    and rv.entity_type in ('campaign', 'flow')
    and rv.period_start >= period_start
    and rv.period_start < (period_end + 1)
    and (target_store_id is null or exists (
      select 1
      from public.klaviyo_report_runs rr
      join public.klaviyo_accounts ka on ka.id = rr.account_id
      where rr.id = rv.report_run_id
        and ka.store_id = target_store_id
    ))
  order by
    date_trunc('month', rv.period_start),
    rv.entity_type,
    coalesce(c.id::text, f.id::text, rv.external_entity_id),
    (rv.period_end - rv.period_start) desc,
    rv.created_at desc;
$function$;

create index if not exists klaviyo_report_runs_account_idx
  on public.klaviyo_report_runs (account_id);
