-- Widget "Meta Ads · cartera" del Dashboard del consultor: metricas de
-- adquisicion Meta desglosadas por cliente (organizacion) para un periodo,
-- para una lista rankeada por salud de la cuenta.
--
-- ADR-0006 pto. 6: funcion SQL `stable`, SECURITY INVOKER, sin `security
-- definer`; el backend la invoca con service role sobre las org asignadas.
-- Misma logica que meta_spend_summary (nivel ad, sin breakdowns, mismos
-- action_types de compra) pero agrupada por organizacion. Los indices de fecha
-- de meta_insight_rows_daily ya existen (ver consultant_business_rollup).

drop function if exists public.consultant_meta_by_org(uuid[], date, date);
create or replace function public.consultant_meta_by_org(
  org_ids uuid[],
  period_start date,
  period_end date
)
returns table (
  organization_id uuid,
  spend numeric,
  impressions bigint,
  clicks bigint,
  purchases numeric,
  purchase_value numeric,
  roas numeric,
  cac numeric,
  days_with_data bigint
)
language sql
stable
as $$
  with base_rows as (
    select r.id, r.organization_id, r.spend, r.impressions, r.clicks, r.metric_date
    from public.meta_insight_rows_daily r
    where r.organization_id = any(org_ids)
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
  ),
  purchase_actions as (
    select
      b.organization_id,
      coalesce(sum(m.value) filter (where m.metric_name = 'actions'), 0) as purchases,
      coalesce(sum(m.value) filter (where m.metric_name = 'action_values'), 0) as purchase_value
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    where m.action_type in ('purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase')
    group by b.organization_id
  ),
  spend_agg as (
    select
      b.organization_id,
      coalesce(sum(b.spend), 0) as spend,
      coalesce(sum(b.impressions), 0)::bigint as impressions,
      coalesce(sum(b.clicks), 0)::bigint as clicks,
      count(distinct b.metric_date)::bigint as days_with_data
    from base_rows b
    group by b.organization_id
  )
  select
    s.organization_id,
    s.spend,
    s.impressions,
    s.clicks,
    coalesce(p.purchases, 0) as purchases,
    coalesce(p.purchase_value, 0) as purchase_value,
    case when s.spend > 0
      then round(coalesce(p.purchase_value, 0) / s.spend, 4)
      else null end as roas,
    case when coalesce(p.purchases, 0) > 0
      then round(s.spend / p.purchases, 2)
      else null end as cac,
    s.days_with_data
  from spend_agg s
  left join purchase_actions p on p.organization_id = s.organization_id;
$$;

grant execute on function public.consultant_meta_by_org(uuid[], date, date)
  to authenticated;

comment on function public.consultant_meta_by_org is
  'Gasto, compras atribuidas, ROAS y CAC de Meta por organizacion para el widget "Meta Ads · cartera" del Dashboard del consultor. Misma logica de meta_spend_summary agrupada por org.';
