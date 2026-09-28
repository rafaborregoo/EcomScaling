-- No presentamos snapshots mensuales como numero de envios ni atribuimos
-- metricas de una campana A/B a una plantilla que no podemos identificar.
drop function if exists public.marketing_template_performance(uuid);
drop function if exists public.marketing_template_performance(uuid, text[]);

create function public.marketing_template_performance(
  target_organization_id uuid,
  target_template_ids text[]
)
returns table(
  external_template_id text,
  measured_entities bigint,
  delivered numeric,
  opens_unique numeric,
  clicks_unique numeric,
  conversions numeric,
  revenue numeric,
  currency_code text,
  unsubscribes numeric,
  last_sent_at timestamptz
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
  with message_entities as (
    select
      m.organization_id,
      m.external_template_id,
      c.external_campaign_id as external_entity_id,
      'campaign'::text as entity_type,
      c.send_time,
      count(*) over (
        partition by m.organization_id, c.external_campaign_id
      ) as message_count
    from public.klaviyo_campaign_messages m
    join public.klaviyo_campaigns c on c.id = m.campaign_id
    where m.organization_id = target_organization_id
      and m.external_template_id is not null
      and (m.channel is null or m.channel = 'email')
    union all
    select
      m.organization_id,
      m.external_template_id,
      f.external_flow_id,
      'flow'::text,
      null::timestamptz,
      count(*) over (
        partition by m.organization_id, f.external_flow_id
      )
    from public.klaviyo_flow_messages m
    join public.klaviyo_flows f on f.id = m.flow_id
    where m.organization_id = target_organization_id
      and m.external_template_id is not null
      and (m.channel is null or m.channel = 'email')
  ), unambiguous_entities as (
    -- Los informes se guardan por id de campana/flujo. Excluir entidades con
    -- mas de un mensaje evita asignar el ultimo mensaje sincronizado a todos.
    select distinct external_template_id, external_entity_id, entity_type, send_time
    from message_entities
    where message_count = 1
      and external_template_id = any(target_template_ids)
      and external_entity_id is not null
      and (entity_type <> 'campaign' or send_time is not null)
  ), latest_values as (
    select distinct on (
      ue.external_template_id,
      rv.entity_type,
      rv.external_entity_id,
      date_trunc('month', rv.period_start)
    )
      ue.external_template_id,
      ue.external_entity_id,
      ue.entity_type,
      ue.send_time,
      coalesce(rv.raw_data->'statistics'->>'delivered', '0')::numeric as delivered,
      coalesce(rv.raw_data->'statistics'->>'opens_unique', '0')::numeric as opens_unique,
      coalesce(rv.raw_data->'statistics'->>'clicks_unique', '0')::numeric as clicks_unique,
      coalesce(rv.conversions, 0) as conversions,
      coalesce(rv.revenue, 0) as revenue,
      rv.currency_code,
      coalesce(rv.raw_data->'statistics'->>'unsubscribes', '0')::numeric as unsubscribes
    from unambiguous_entities ue
    join public.klaviyo_report_values rv
      on rv.organization_id = target_organization_id
     and rv.entity_type = ue.entity_type
     and rv.external_entity_id = ue.external_entity_id
    order by
      ue.external_template_id,
      rv.entity_type,
      rv.external_entity_id,
      date_trunc('month', rv.period_start),
      rv.created_at desc
  )
  select
    external_template_id,
    count(distinct (entity_type, external_entity_id))::bigint as measured_entities,
    sum(delivered),
    sum(opens_unique),
    sum(clicks_unique),
    sum(conversions),
    case when count(distinct currency_code) = 1 then sum(revenue) else null end,
    case when count(distinct currency_code) = 1 then min(currency_code)::text else null end,
    sum(unsubscribes),
    max(send_time)
  from latest_values
  group by external_template_id;
$function$;

grant execute on function public.marketing_template_performance(uuid, text[]) to authenticated;

-- Acelera el join usado por la biblioteca para los reportes atribuidos.
create index if not exists klaviyo_report_values_org_entity_period_idx
  on public.klaviyo_report_values
    (organization_id, entity_type, external_entity_id, period_start desc);
;
