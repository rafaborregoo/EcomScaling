-- Panel de email marketing (Klaviyo) del dashboard + agente a12_analista_email.
--
-- Fuente: klaviyo_report_values, la unica tabla de rendimiento que el sync
-- (runKlaviyoReport, cron 6h + backfill 12 meses) llena. Su forma real en
-- remoto (ver packages/db) es plana: (report_run, entity_type, external_entity_id,
-- metric_id, period_start/end) -> conversions, revenue, y raw_data = {groupings,
-- statistics}. NO tiene FKs campaign_id/flow_id: se enlaza a klaviyo_campaigns /
-- klaviyo_flows por el id externo.
--
-- Los "asuntos" de campana viven en klaviyo_campaign_messages, que el sync
-- todavia no rellena -> subject se devuelve NULL de momento; la UI cae al nombre
-- de la campana. Cuando el sync traiga campaign-messages se anade el join aqui.
--
-- ADR-0006: funcion `stable`, sin `security definer` (RLS de klaviyo_report_values
-- ya limita por private.can_access_org), `grant` a `authenticated`, llamada via
-- .rpc(). La API agrega/rankea/deltas en Node a partir de estas filas ya
-- pre-sumadas por (mes, entidad).
--
-- Una fila por (mes, entidad). Puede haber varios report_runs para el mismo
-- mes/entidad (backfill mensual + ventana rodante, o un cambio en la lista de
-- estadisticas): se queda con el de ventana mas ancha y, a igualdad, el mas
-- reciente.
-- ponytail: asume una cuenta Klaviyo por organizacion; con varias, los importes
-- de cada mes/entidad se suman entre cuentas -- deseable para un total de org.

create index if not exists klaviyo_report_values_org_period_idx
  on public.klaviyo_report_values (organization_id, period_start);

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
    null::text as subject,
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

grant execute on function public.klaviyo_email_report(uuid, date, date) to authenticated;

comment on function public.klaviyo_email_report is 'Rendimiento de email Klaviyo por mes y entidad (campanas y flows): ingresos atribuidos, conversiones, destinatarios, aperturas/clics unicos, bajas, rebotes, spam. Fuente klaviyo_report_values enlazada a klaviyo_campaigns/klaviyo_flows por id externo. subject queda NULL hasta que el sync traiga campaign-messages. La API deriva rates, ranking y deltas.';
