-- DB-06b: resumen de adquisicion Meta para el dashboard. Agrega gasto y
-- metricas base desde meta_insight_rows_daily (nivel ad, sin breakdowns) y
-- compras/valor de compra desde meta_insight_action_metrics. security invoker:
-- RLS limita filas a organizaciones accesibles.

create or replace function public.meta_spend_summary(
  target_organization_id uuid,
  period_start date,
  period_end date
)
returns table (
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
    select r.id, r.spend, r.impressions, r.clicks, r.metric_date
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
  ),
  purchase_actions as (
    select
      coalesce(sum(m.value) filter (where m.metric_name = 'actions'), 0) as purchases,
      coalesce(sum(m.value) filter (where m.metric_name = 'action_values'), 0) as purchase_value
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    where m.action_type in ('purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase')
  )
  select
    coalesce(sum(b.spend), 0) as spend,
    coalesce(sum(b.impressions), 0)::bigint as impressions,
    coalesce(sum(b.clicks), 0)::bigint as clicks,
    p.purchases,
    p.purchase_value,
    case when coalesce(sum(b.spend), 0) > 0 then round(p.purchase_value / sum(b.spend), 4) else null end as roas,
    case when p.purchases > 0 then round(coalesce(sum(b.spend), 0) / p.purchases, 2) else null end as cac,
    count(distinct b.metric_date)::bigint as days_with_data
  from base_rows b
  cross join purchase_actions p
  group by p.purchases, p.purchase_value;
$$;

grant execute on function public.meta_spend_summary(uuid, date, date) to authenticated;

comment on function public.meta_spend_summary is 'Gasto, compras atribuidas, ROAS y CAC del periodo desde insights diarios nivel ad. Compras suman action_types purchase/omni_purchase/fb_pixel_purchase (posible solape si Meta reporta varios; documentado como limitacion de atribucion). Devuelve fila unica; null en roas/cac cuando no hay gasto o compras.';
