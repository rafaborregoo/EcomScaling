-- Fase 10 (cross-channel attribution): consultant_meta_by_org sumaba TODAS las
-- filas de meta_insight_action_metrics de cada anuncio: las tres ventanas que
-- pide el sync (1d_click, 7d_click, 1d_view, ver meta-sync.ts) y tres
-- action_types que se solapan (purchase, omni_purchase,
-- offsite_conversion.fb_pixel_purchase). La misma compra contaba varias veces
-- e inflaba purchase_value, ROAS, CAC y el dependency_pct del widget
-- "Meta Ads · cartera".
--
-- Mismo criterio que meta_spend_summary: la compra canonica de la cuenta y una
-- sola ventana por fila (meta_attribution_window_rank). Devuelve ademas la
-- ventana usada, porque una cifra atribuida viaja con su ventana
-- (conocimiento/fase-10, INV-XCA-004); null si las filas mezclan ventanas.
--
-- Cambia la lista de columnas devueltas: `create or replace` no basta, se
-- borra la firma antes (CLAUDE.md). Idempotente.

drop function if exists public.consultant_meta_by_org(uuid[], date, date);
create function public.consultant_meta_by_org(
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
  days_with_data bigint,
  purchase_attribution_window text
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  with base_rows as (
    select r.id, r.organization_id, r.ad_account_id, r.spend, r.impressions, r.clicks, r.metric_date
    from public.meta_insight_rows_daily r
    where r.organization_id = any(org_ids)
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
  ),
  -- Una fila por (insight, metrica): la ventana preferida gana, el resto se
  -- descarta. Sumarlas contaria la misma compra hasta tres veces.
  row_purchases as (
    select distinct on (m.insight_row_id, m.metric_name)
      b.organization_id, m.metric_name, m.value, m.attribution_window
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    order by
      m.insight_row_id,
      m.metric_name,
      public.meta_attribution_window_rank(m.attribution_window)
  ),
  purchase_actions as (
    select
      organization_id,
      coalesce(sum(value) filter (where metric_name = 'actions'), 0) as purchases,
      coalesce(sum(value) filter (where metric_name = 'action_values'), 0) as purchase_value,
      case
        when count(distinct attribution_window) filter (where metric_name = 'action_values') = 1
        then min(attribution_window) filter (where metric_name = 'action_values')
      end as purchase_attribution_window
    from row_purchases
    group by organization_id
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
    s.days_with_data,
    p.purchase_attribution_window::text
  from spend_agg s
  left join purchase_actions p on p.organization_id = s.organization_id;
$$;

grant execute on function public.consultant_meta_by_org(uuid[], date, date)
  to authenticated;

comment on function public.consultant_meta_by_org is
  'Gasto, compras atribuidas por Meta (compra canonica, una ventana por fila), ROAS y CAC por organizacion para el widget "Meta Ads · cartera". purchase_attribution_window = ventana usada; null si se mezclan.';
