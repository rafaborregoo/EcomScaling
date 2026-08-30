-- Fase 5: el sync ya trae los mensajes de campana (klaviyo-sync.ts,
-- klaviyo_campaign_messages), asi que klaviyo_email_report puede devolver el
-- ASUNTO real de cada campana en vez de NULL. El rendimiento sigue siendo a
-- nivel de campana; se toma el asunto del mensaje de email de la campana.
--
-- El asunto vive dentro de raw_data del mensaje. La forma exacta depende de la
-- revision de la API de Klaviyo: en las recientes es
-- attributes.definition.content.subject, en anteriores attributes.content.subject.
-- Se prueban ambas y si ninguna casa queda NULL (la UI cae al nombre de la
-- campana). ponytail: dos rutas jsonb fijas; si Klaviyo cambia el esquema otra
-- vez, ampliar el coalesce aqui.
--
-- Resto de la funcion identico a 20260829120000_klaviyo_email_report.

create or replace function public.klaviyo_email_report(
  target_organization_id uuid,
  period_start date,
  period_end date
)
returns table (
  bucket_month date,
  entity_type text,
  entity_id uuid,
  entity_name text,
  subject text,
  send_time timestamptz,
  trigger_type text,
  revenue numeric,
  conversions numeric,
  recipients numeric,
  delivered numeric,
  opens_unique numeric,
  clicks_unique numeric,
  unsubscribes numeric,
  bounced numeric,
  spam_complaints numeric
)
language sql
stable
as $$
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
  order by
    date_trunc('month', rv.period_start),
    rv.entity_type,
    coalesce(c.id::text, f.id::text, rv.external_entity_id),
    (rv.period_end - rv.period_start) desc,
    rv.created_at desc;
$$;

comment on function public.klaviyo_email_report is 'Rendimiento de email Klaviyo por mes y entidad (campanas y flows) con el asunto real de la campana (de klaviyo_campaign_messages.raw_data). Fuente klaviyo_report_values enlazada por id externo. La API deriva rates, ranking de asuntos y deltas.';
