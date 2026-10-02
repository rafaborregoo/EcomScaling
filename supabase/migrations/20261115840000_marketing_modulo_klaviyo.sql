-- Marketing -> Hoy / Campañas / Flows / Plantillas / Audiencias / Rendimiento.
--
-- Lo que traen los bloques nuevos del sync (apps/api/src/klaviyo-sync-marketing.ts)
-- y las dos funciones que leen las pantallas. Idempotente: se puede reaplicar
-- con db:push aunque el esquema se haya tocado por fuera.

-- Grafo del flow para el diagrama (pasos, enlaces, ramas). Distinto del
-- resumen de A28, que va sin ids a un prompt.
alter table public.klaviyo_flows
  add column if not exists definition_graph jsonb,
  add column if not exists definition_graph_synced_at timestamptz;

-- Tamaño de la audiencia: la revisión 2026-07-15 solo lo da pidiendo cada una.
alter table public.klaviyo_lists
  add column if not exists profile_count_synced_at timestamptz;
alter table public.klaviyo_segments
  add column if not exists profile_count_synced_at timestamptz;

-- Vistas, altas y conversión de cada formulario en 30 días (form-values-report).
alter table public.klaviyo_forms
  add column if not exists stats_30d jsonb,
  add column if not exists stats_synced_at timestamptz;

-- Serie diaria de flows: una fila por cuenta, día y métrica. La tabla no tenía
-- escritor hasta ahora, así que no puede haber duplicados que rompan el índice.
create unique index if not exists klaviyo_daily_account_metrics_account_day_metric_uidx
  on public.klaviyo_daily_account_metrics (account_id, metric_date, metric_id);
create index if not exists klaviyo_daily_account_metrics_org_day_idx
  on public.klaviyo_daily_account_metrics (organization_id, metric_date);

-- Campañas por fecha de envío (semana de Hoy, lista de Campañas, gráfica).
create index if not exists klaviyo_campaigns_org_send_time_idx
  on public.klaviyo_campaigns (organization_id, send_time);

create index if not exists klaviyo_report_values_org_period_idx
  on public.klaviyo_report_values (organization_id, period_start);

-- Rendimiento por MENSAJE (cada email de un flow, cada mensaje de campaña).
-- klaviyo_email_report agrupa por entidad; los diagramas necesitan el email.
-- Mismo criterio de desempate: por mes y mensaje gana el periodo más largo y
-- luego la fila más reciente; las variantes A/B van aparte (variation_id <> '').
-- Los parámetros van calificados con el nombre de la función: en una función
-- SQL, si una columna se llama igual que un parámetro gana la columna, y
-- `rv.period_start >= period_start` se compararía consigo misma.
drop function if exists public.klaviyo_message_stats(uuid, date, date, uuid);
create or replace function public.klaviyo_message_stats(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  entity_type text,
  external_entity_id text,
  external_message_id text,
  revenue numeric,
  conversions numeric,
  recipients numeric,
  delivered numeric,
  opens_unique numeric,
  clicks_unique numeric,
  unsubscribes numeric
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
        coalesce(rv.external_message_id, '')
      )
      rv.entity_type::text as entity_type,
      rv.external_entity_id::text as external_entity_id,
      rv.external_message_id::text as external_message_id,
      coalesce(rv.revenue, nullif(rv.raw_data->'statistics'->>'conversion_value', '')::numeric, 0) as revenue,
      coalesce(rv.conversions, nullif(rv.raw_data->'statistics'->>'conversion_uniques', '')::numeric, 0) as conversions,
      coalesce(nullif(rv.raw_data->'statistics'->>'recipients', '')::numeric, 0) as recipients,
      coalesce(nullif(rv.raw_data->'statistics'->>'delivered', '')::numeric, 0) as delivered,
      coalesce(nullif(rv.raw_data->'statistics'->>'opens_unique', '')::numeric, 0) as opens_unique,
      coalesce(nullif(rv.raw_data->'statistics'->>'clicks_unique', '')::numeric, 0) as clicks_unique,
      coalesce(nullif(rv.raw_data->'statistics'->>'unsubscribes', '')::numeric, 0) as unsubscribes
    from public.klaviyo_report_values rv
    where rv.organization_id = target_organization_id
      and rv.entity_type in ('campaign', 'flow')
      and rv.variation_id = ''
      and rv.period_start >= klaviyo_message_stats.period_start
      and rv.period_start < (klaviyo_message_stats.period_end + 1)
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
      rv.external_entity_id,
      coalesce(rv.external_message_id, ''),
      (rv.period_end - rv.period_start) desc,
      rv.created_at desc
  )
  select
    entity_type,
    external_entity_id,
    external_message_id,
    sum(revenue), sum(conversions), sum(recipients), sum(delivered),
    sum(opens_unique), sum(clicks_unique), sum(unsubscribes)
  from picked
  group by entity_type, external_entity_id, external_message_id;
$function$;

-- EUR atribuidos por Klaviyo, por día. Flows: serie diaria del sync. Campañas:
-- la API no da serie, así que su total (todos los meses informados) se pone en
-- el día de envío. Un día sin datos sale a 0 (generate_series).
drop function if exists public.klaviyo_daily_revenue(uuid, date, date, uuid);
create or replace function public.klaviyo_daily_revenue(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(day date, flow_revenue numeric, campaign_revenue numeric)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with days as (
    select generate_series(period_start, period_end, interval '1 day')::date as day
  ),
  accounts as (
    select ka.id
    from public.klaviyo_accounts ka
    where ka.organization_id = target_organization_id
      and (target_store_id is null or ka.store_id = target_store_id)
  ),
  flows as (
    select m.metric_date as day, sum(m.value) as revenue
    from public.klaviyo_daily_account_metrics m
    where m.organization_id = target_organization_id
      and m.account_id in (select id from accounts)
      and m.metric_id = 'nora:flow_revenue'
      and m.metric_date between period_start and period_end
    group by m.metric_date
  ),
  campaign_totals as (
    select s.external_entity_id, sum(s.revenue) as revenue
    from public.klaviyo_message_stats(
      target_organization_id, period_start - 90, period_end, target_store_id
    ) s
    where s.entity_type = 'campaign'
    group by s.external_entity_id
  ),
  campaigns as (
    select (c.send_time at time zone 'UTC')::date as day, sum(t.revenue) as revenue
    from public.klaviyo_campaigns c
    join campaign_totals t on t.external_entity_id = c.external_campaign_id
    where c.organization_id = target_organization_id
      and c.account_id in (select id from accounts)
      and c.send_time >= period_start
      and c.send_time < (period_end + 1)
    group by 1
  )
  select d.day, coalesce(f.revenue, 0), coalesce(c.revenue, 0)
  from days d
  left join flows f on f.day = d.day
  left join campaigns c on c.day = d.day
  order by d.day;
$function$;

-- Dónde hicieron clic en UNA campaña (panel de detalle). klaviyo_link_clicks
-- agrega por periodo; esto filtra por los mensajes de la campaña.
create index if not exists klaviyo_email_click_events_org_message_idx
  on public.klaviyo_email_click_events (organization_id, external_message_id);

drop function if exists public.klaviyo_campaign_link_clicks(uuid, text);
create or replace function public.klaviyo_campaign_link_clicks(
  target_organization_id uuid,
  target_external_campaign_id text
)
returns table(url text, clicks bigint, people bigint)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select e.url::text, count(*), count(distinct e.external_profile_id)
  from public.klaviyo_email_click_events e
  join public.klaviyo_campaign_messages m
    on m.organization_id = e.organization_id
   and m.external_message_id = e.external_message_id
  join public.klaviyo_campaigns c on c.id = m.campaign_id
  where e.organization_id = target_organization_id
    and c.external_campaign_id = target_external_campaign_id
    and e.url is not null
  group by e.url
  order by count(*) desc
  limit 10;
$function$;

-- Totales por campaña/flow, por tipo y generales en una sola llamada
-- (grouping sets): la API no suma nada en Node (ADR-0006 punto 6).
--   level entity -> una campaña o un flow
--   level type   -> subtotal de campañas o de flows
--   level total  -> total del email
drop function if exists public.klaviyo_entity_stats(uuid, date, date, uuid);
create or replace function public.klaviyo_entity_stats(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  level text,
  entity_type text,
  external_entity_id text,
  revenue numeric,
  conversions numeric,
  recipients numeric,
  delivered numeric,
  opens_unique numeric,
  clicks_unique numeric,
  unsubscribes numeric
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select
    case
      when grouping(s.entity_type) = 1 then 'total'
      when grouping(s.external_entity_id) = 1 then 'type'
      else 'entity'
    end,
    s.entity_type,
    s.external_entity_id,
    sum(s.revenue), sum(s.conversions), sum(s.recipients), sum(s.delivered),
    sum(s.opens_unique), sum(s.clicks_unique), sum(s.unsubscribes)
  from public.klaviyo_message_stats(
    target_organization_id, period_start, period_end, target_store_id
  ) s
  group by grouping sets ((s.entity_type, s.external_entity_id), (s.entity_type), ());
$function$;
