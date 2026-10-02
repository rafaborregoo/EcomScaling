-- klaviyo_email_report tenía tres fallos:
--
-- 1. `rv.period_start >= period_start` comparaba la columna consigo misma: en
--    una función SQL, si una columna se llama igual que un parámetro gana la
--    columna. El filtro de inicio no filtraba y cada consulta traía todo el
--    histórico anterior. Los parámetros van ahora calificados con el nombre de
--    la función.
-- 2. `distinct on (mes, entidad)` se quedaba con UN mensaje por campaña/flow y
--    mes; un flow con cinco emails contaba solo uno. Ahora se elige una fila
--    por mes, entidad y MENSAJE (periodo más largo, luego la más reciente, como
--    klaviyo_message_stats) y se suman los mensajes de cada entidad.
-- 3. 20261106090000 rehízo la función desde una versión anterior a A26 y perdió
--    `variation_id = ''`: las filas de variantes A/B podían salir como si fueran
--    la campaña entera. Vuelve el filtro.
--
-- Misma firma y mismas columnas: los que la llaman no cambian. El drop es la
-- norma del repo para funciones que devuelven tabla; los permisos se restauran
-- al final tal como los dejó A26.

drop function if exists public.klaviyo_email_report(uuid, date, date, uuid);

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
  with picked as (
    select distinct on (
        date_trunc('month', rv.period_start),
        rv.entity_type,
        rv.external_entity_id,
        rv.external_message_id
      )
      date_trunc('month', rv.period_start)::date as bucket_month,
      rv.organization_id,
      rv.entity_type::text as entity_type,
      rv.external_entity_id,
      rv.entity_name,
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
    where rv.organization_id = klaviyo_email_report.target_organization_id
      and rv.entity_type in ('campaign', 'flow')
      and rv.variation_id = ''
      and rv.period_start >= klaviyo_email_report.period_start
      and rv.period_start < (klaviyo_email_report.period_end + 1)
      and (klaviyo_email_report.target_store_id is null or exists (
        select 1
        from public.klaviyo_report_runs rr
        join public.klaviyo_accounts ka on ka.id = rr.account_id
        where rr.id = rv.report_run_id
          and ka.store_id = klaviyo_email_report.target_store_id
      ))
    order by
      date_trunc('month', rv.period_start),
      rv.entity_type,
      rv.external_entity_id,
      rv.external_message_id,
      (rv.period_end - rv.period_start) desc,
      rv.created_at desc
  ),
  entities as (
    select
      p.bucket_month,
      p.organization_id,
      p.entity_type,
      p.external_entity_id,
      max(p.entity_name) as entity_name,
      sum(p.revenue) as revenue,
      sum(p.conversions) as conversions,
      sum(p.recipients) as recipients,
      sum(p.delivered) as delivered,
      sum(p.opens_unique) as opens_unique,
      sum(p.clicks_unique) as clicks_unique,
      sum(p.unsubscribes) as unsubscribes,
      sum(p.bounced) as bounced,
      sum(p.spam_complaints) as spam_complaints
    from picked p
    group by p.bucket_month, p.organization_id, p.entity_type, p.external_entity_id
  )
  select
    e.bucket_month,
    e.entity_type,
    coalesce(c.id, f.id),
    coalesce(c.name, f.name, e.entity_name),
    cm.subject,
    c.send_time,
    f.trigger_type,
    e.revenue, e.conversions, e.recipients, e.delivered,
    e.opens_unique, e.clicks_unique, e.unsubscribes,
    e.bounced, e.spam_complaints
  from entities e
  -- Únicas por cuenta, no por organización: una reconexión puede dejar dos
  -- filas con el mismo id externo. Una por entidad, la más reciente.
  left join lateral (
    select c.id, c.name, c.send_time
    from public.klaviyo_campaigns c
    where e.entity_type = 'campaign'
      and c.organization_id = e.organization_id
      and c.external_campaign_id = e.external_entity_id
    order by c.updated_at desc nulls last
    limit 1
  ) c on true
  left join lateral (
    select f.id, f.name, f.trigger_type
    from public.klaviyo_flows f
    where e.entity_type = 'flow'
      and f.organization_id = e.organization_id
      and f.external_flow_id = e.external_entity_id
    order by f.updated_at desc nulls last
    limit 1
  ) f on true
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
  order by e.bucket_month, e.entity_type, e.external_entity_id;
$function$;

revoke all on function public.klaviyo_email_report(uuid, date, date, uuid) from public, anon;
grant execute on function public.klaviyo_email_report(uuid, date, date, uuid) to authenticated;
grant execute on function public.klaviyo_email_report(uuid, date, date, uuid) to service_role;
