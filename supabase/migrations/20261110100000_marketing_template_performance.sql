-- Rendimiento por plantilla, no por borrador. Un mismo template de Klaviyo
-- puede aparecer en campañas y flows; se agrega una sola vez por entidad y
-- mes para no duplicar snapshots de reportes.
drop function if exists public.marketing_template_performance(uuid);

create or replace function public.marketing_template_performance(
  target_organization_id uuid
)
returns table(
  external_template_id text,
  sends bigint,
  delivered numeric,
  opens_unique numeric,
  clicks_unique numeric,
  conversions numeric,
  revenue numeric,
  unsubscribes numeric,
  last_sent_at timestamptz
)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
  with template_entities as (
    select distinct m.external_template_id, c.external_campaign_id as external_entity_id,
      'campaign'::text as entity_type, c.send_time
    from public.klaviyo_campaign_messages m
    join public.klaviyo_campaigns c on c.id = m.campaign_id
    where m.organization_id = target_organization_id
      and m.external_template_id is not null
      and (m.channel is null or m.channel = 'email')
    union
    select distinct m.external_template_id, f.external_flow_id,
      'flow'::text, null::timestamptz
    from public.klaviyo_flow_messages m
    join public.klaviyo_flows f on f.id = m.flow_id
    where m.organization_id = target_organization_id
      and m.external_template_id is not null
  ), latest_values as (
    select distinct on (te.external_template_id, rv.entity_type, rv.external_entity_id,
      date_trunc('month', rv.period_start))
      te.external_template_id, te.send_time,
      coalesce(rv.raw_data->'statistics'->>'delivered', '0')::numeric as delivered,
      coalesce(rv.raw_data->'statistics'->>'opens_unique', '0')::numeric as opens_unique,
      coalesce(rv.raw_data->'statistics'->>'clicks_unique', '0')::numeric as clicks_unique,
      coalesce(rv.conversions, 0) as conversions,
      coalesce(rv.revenue, 0) as revenue,
      coalesce(rv.raw_data->'statistics'->>'unsubscribes', '0')::numeric as unsubscribes
    from template_entities te
    join public.klaviyo_report_values rv
      on rv.organization_id = target_organization_id
     and rv.entity_type = te.entity_type
     and rv.external_entity_id = te.external_entity_id
    order by te.external_template_id, rv.entity_type, rv.external_entity_id,
      date_trunc('month', rv.period_start), rv.created_at desc
  )
  select external_template_id, count(*)::bigint, sum(delivered), sum(opens_unique),
    sum(clicks_unique), sum(conversions), sum(revenue), sum(unsubscribes), max(send_time)
  from latest_values
  group by external_template_id;
$function$;

grant execute on function public.marketing_template_performance(uuid) to authenticated;
;
