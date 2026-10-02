-- Ficha de un email de Klaviyo (campaña o flujo): clics por enlace de ESA
-- entidad (klaviyo_link_clicks ya existe pero es de toda la cuenta), para que
-- /klaviyo/emails/[id] pueda enseñar donde hace clic la gente sin traerse el
-- click-through de las demás campañas y flujos.
--
-- security invoker (ADR-0006 punto 7): RLS de klaviyo_email_click_events sigue
-- decidiendo que ve cada cual.

create index if not exists klaviyo_flow_messages_flow_id_idx
  on public.klaviyo_flow_messages (flow_id);

drop function if exists public.klaviyo_entity_link_clicks(uuid, text, uuid, timestamptz, timestamptz);

create function public.klaviyo_entity_link_clicks(
  target_organization_id uuid,
  target_entity_type text,
  target_entity_id uuid,
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  url text,
  clicks bigint,
  personas bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with message_ids as (
    select external_message_id::text as id
    from public.klaviyo_campaign_messages
    where organization_id = target_organization_id
      and target_entity_type = 'campaign'
      and campaign_id = target_entity_id
    union all
    select external_message_id::text
    from public.klaviyo_flow_messages
    where organization_id = target_organization_id
      and target_entity_type = 'flow'
      and flow_id = target_entity_id
  )
  select
    e.url::text,
    count(*)::bigint as clicks,
    count(distinct e.external_profile_id)::bigint as personas
  from public.klaviyo_email_click_events e
  join message_ids m on m.id = e.external_message_id
  where e.organization_id = target_organization_id
    and e.occurred_at >= period_start
    and e.occurred_at <= period_end
    and e.url is not null
  group by e.url
  order by count(*) desc, e.url
  limit 15;
$$;

grant execute on function public.klaviyo_entity_link_clicks(uuid, text, uuid, timestamptz, timestamptz) to authenticated, service_role;
comment on function public.klaviyo_entity_link_clicks(uuid, text, uuid, timestamptz, timestamptz) is
  'Clics por enlace de UNA campaña o flujo (no de toda la cuenta como klaviyo_link_clicks).';
