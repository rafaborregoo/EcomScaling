-- klaviyo_email_report desempataba el `distinct on` con `rv.captured_at`, una
-- columna que klaviyo_report_values no tiene: la marca de tiempo de la fila se
-- llama `created_at`. La funcion entera fallaba con 42703, asi que
-- /v1/organizations/:id/klaviyo/email-report devolvia 500 siempre y el panel de
-- rendimiento de email no ha llegado a pintar nunca.
--
-- Se mantiene la intencion original: ante varias filas del mismo mes y entidad,
-- gana primero la de periodo mas corto y luego la capturada mas tarde.
--
-- `create or replace` con la misma firma de 4 argumentos: no crea sobrecarga y
-- conserva los permisos existentes.

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
