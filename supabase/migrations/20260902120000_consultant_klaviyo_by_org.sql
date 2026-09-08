-- Widget "Email · campañas por cliente" del Dashboard del consultor: por cada
-- organizacion, cuantas campanas Klaviyo se enviaron en la ventana (1 sem / 1
-- mes / 3 meses / indefinido) mas su rendimiento atribuido. Ranking en Node =
-- mas campanas primero.
--
-- ADR-0006 pto. 6: funcion `stable`, SECURITY INVOKER, sin `security definer`;
-- el backend la invoca con service role sobre las org asignadas.
-- Envios: klaviyo_campaigns.send_time. Rendimiento: klaviyo_report_values
-- (entity_type='campaign') enlazado por id externo, misma fuente que
-- klaviyo_email_report. report_values esta bucketizado por mes -> se toman las
-- filas cuyo mes solapa la ventana.
-- ponytail: aproximacion mensual en revenue/recipients/opens/clicks -- para una
-- ventana corta dentro del mes en curso incluye envios de ese mes fuera de la
-- ventana; exacto por campana cuando el sync traiga metricas por campaña.

create index if not exists klaviyo_campaigns_org_send_idx
  on public.klaviyo_campaigns (organization_id, send_time);

drop function if exists public.consultant_klaviyo_by_org(uuid[], timestamptz, timestamptz);
create or replace function public.consultant_klaviyo_by_org(
  org_ids uuid[],
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  organization_id uuid,
  campaigns_sent bigint,
  last_send_at timestamptz,
  revenue numeric,
  recipients numeric,
  opens_unique numeric,
  clicks_unique numeric
)
language sql
stable
as $$
  with sent as (
    select c.organization_id, c.external_campaign_id, c.send_time
    from public.klaviyo_campaigns c
    where c.organization_id = any(org_ids)
      and c.send_time is not null
      and c.send_time >= period_start
      and c.send_time <= period_end
  ),
  perf as (
    select
      s.organization_id,
      coalesce(sum(coalesce(rv.revenue, nullif(rv.raw_data->'statistics'->>'conversion_value', '')::numeric, 0)), 0) as revenue,
      coalesce(sum(nullif(rv.raw_data->'statistics'->>'recipients', '')::numeric), 0) as recipients,
      coalesce(sum(nullif(rv.raw_data->'statistics'->>'opens_unique', '')::numeric), 0) as opens_unique,
      coalesce(sum(nullif(rv.raw_data->'statistics'->>'clicks_unique', '')::numeric), 0) as clicks_unique
    from sent s
    join public.klaviyo_report_values rv
      on rv.organization_id = s.organization_id
     and rv.entity_type = 'campaign'
     and rv.external_entity_id = s.external_campaign_id
     and rv.period_start >= date_trunc('month', period_start)
     and rv.period_start <= period_end
    group by s.organization_id
  )
  select
    s.organization_id,
    count(*)::bigint as campaigns_sent,
    max(s.send_time) as last_send_at,
    coalesce(p.revenue, 0) as revenue,
    coalesce(p.recipients, 0) as recipients,
    coalesce(p.opens_unique, 0) as opens_unique,
    coalesce(p.clicks_unique, 0) as clicks_unique
  from sent s
  left join perf p on p.organization_id = s.organization_id
  group by s.organization_id, p.revenue, p.recipients, p.opens_unique, p.clicks_unique;
$$;

grant execute on function public.consultant_klaviyo_by_org(uuid[], timestamptz, timestamptz)
  to authenticated;

comment on function public.consultant_klaviyo_by_org is
  'Campanas Klaviyo enviadas por organizacion en una ventana + rendimiento atribuido (revenue, destinatarios, aperturas/clics unicos). Para el widget "Email · campañas por cliente" del Dashboard del consultor.';
