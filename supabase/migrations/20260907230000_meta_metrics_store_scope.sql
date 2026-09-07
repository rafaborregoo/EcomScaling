-- Meta filtrado por tienda. Con dos tiendas en un mismo cliente estas tres
-- funciones devolvian la suma de las dos y la UI la presentaba como si fuera
-- de la tienda seleccionada: un numero que no existe en ninguna parte.
--
-- El filtro entra por meta_insight_rows_daily.ad_account_id -> meta_ad_accounts
-- .store_id (columna anadida en store_scope_meta_klaviyo). En las tres, todo
-- deriva de un unico CTE base, asi que una sola clausula filtra la funcion
-- entera: totales, series y desglose por campana salen coherentes entre si.
--
-- target_store_id NULL = agregado de la organizacion, el comportamiento
-- anterior. Se mantiene porque la vista de cartera del consultor y los agentes
-- siguen preguntando por cliente, no por tienda.
--
-- Hay que DROP y no solo CREATE OR REPLACE: anadir un parametro con DEFAULT
-- crea una sobrecarga, y entonces una llamada con tres argumentos encaja en las
-- dos firmas y Postgres la rechaza por ambigua.

drop function if exists public.meta_spend_summary(uuid, date, date);

create or replace function public.meta_spend_summary(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  spend numeric, impressions bigint, clicks bigint, purchases numeric,
  purchase_value numeric, roas numeric, cac numeric, days_with_data bigint,
  purchase_action_types text[]
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select r.id, r.ad_account_id, r.spend, r.impressions, r.clicks, r.metric_date
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  purchase_actions as (
    select
      coalesce(sum(m.value) filter (where m.metric_name = 'actions'), 0) as purchases,
      coalesce(sum(m.value) filter (where m.metric_name = 'action_values'), 0) as purchase_value
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
  ),
  action_types as (
    select coalesce(array_agg(distinct a.canonical_purchase_action_type), '{}') as types
    from base_rows b
    join public.meta_ad_accounts a on a.id = b.ad_account_id
  )
  select
    coalesce(sum(b.spend), 0) as spend,
    coalesce(sum(b.impressions), 0)::bigint as impressions,
    coalesce(sum(b.clicks), 0)::bigint as clicks,
    p.purchases,
    p.purchase_value,
    case when coalesce(sum(b.spend), 0) > 0 then round(p.purchase_value / sum(b.spend), 4) else null end as roas,
    case when p.purchases > 0 then round(coalesce(sum(b.spend), 0) / p.purchases, 2) else null end as cac,
    count(distinct b.metric_date)::bigint as days_with_data,
    t.types as purchase_action_types
  from base_rows b
  cross join purchase_actions p
  cross join action_types t
  group by p.purchases, p.purchase_value, t.types;
$function$;

drop function if exists public.meta_spend_daily(uuid, date, date);

create or replace function public.meta_spend_daily(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(bucket_date date, spend numeric)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with days as (
    select generate_series(period_start, period_end, interval '1 day')::date as bucket_date
  ),
  daily as (
    select
      r.metric_date as bucket_date,
      coalesce(sum(r.spend), 0) as spend
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.metric_date >= period_start
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
    group by r.metric_date
  )
  select
    d.bucket_date,
    coalesce(daily.spend, 0) as spend
  from days d
  left join daily on daily.bucket_date = d.bucket_date
  order by d.bucket_date;
$function$;

drop function if exists public.meta_spend_by_campaign(uuid, date, date);

create or replace function public.meta_spend_by_campaign(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  campaign_id uuid, campaign_name text, spend numeric, impressions bigint,
  clicks bigint, purchases numeric, purchase_value numeric, roas numeric,
  days_with_data bigint, purchase_action_type text
)
language sql
stable
as $function$
  with base_rows as (
    select
      r.id,
      r.ad_account_id,
      r.campaign_id,
      r.spend,
      r.impressions,
      r.clicks,
      r.metric_date
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.campaign_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  purchases_by_campaign as (
    select
      b.campaign_id,
      coalesce(sum(m.value) filter (where m.metric_name = 'actions'), 0) as purchases,
      coalesce(sum(m.value) filter (where m.metric_name = 'action_values'), 0) as purchase_value
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    group by b.campaign_id
  )
  select
    b.campaign_id,
    max(c.name)::text as campaign_name,
    coalesce(sum(b.spend), 0) as spend,
    coalesce(sum(b.impressions), 0)::bigint as impressions,
    coalesce(sum(b.clicks), 0)::bigint as clicks,
    coalesce(p.purchases, 0) as purchases,
    coalesce(p.purchase_value, 0) as purchase_value,
    case
      when coalesce(sum(b.spend), 0) > 0
      then round(coalesce(p.purchase_value, 0) / sum(b.spend), 4)
      else null
    end as roas,
    count(distinct b.metric_date)::bigint as days_with_data,
    max(a.canonical_purchase_action_type)::text as purchase_action_type
  from base_rows b
  join public.meta_campaigns c on c.id = b.campaign_id
  join public.meta_ad_accounts a on a.id = b.ad_account_id
  left join purchases_by_campaign p on p.campaign_id = b.campaign_id
  group by b.campaign_id, p.purchases, p.purchase_value
  order by coalesce(sum(b.spend), 0) desc;
$function$;

-- Enlaza la fila de insight con la tienda sin pasar por la tabla de cuentas en
-- cada evaluacion del predicado.
create index if not exists meta_insight_rows_daily_ad_account_idx
  on public.meta_insight_rows_daily (organization_id, ad_account_id, metric_date);
