-- Cerrar el hilo campaña -> pieza -> resultado.
--
-- `meta_spend_summary` responde "cuanto gasto la tienda en Meta"; el hilo
-- necesita "cuanto costo y cuanto atribuye ESTA campaña", que es la unica
-- forma de mirar una campaña del calendario y saber si funciono.
--
-- Misma disciplina que INT-02: las compras suman UN solo action_type por
-- cuenta (`meta_ad_accounts.canonical_purchase_action_type`). Sumar 'purchase'
-- + 'omni_purchase' + 'offsite_conversion.fb_pixel_purchase' a la vez inflaba
-- compras y ROAS 2-3x en cuentas con pixel + API de conversiones, y por
-- campaña el error seria el mismo pero mas dificil de detectar: nadie compara
-- una campaña suelta contra Ads Manager.
--
-- security invoker + stable, como el resto de metricas (ADR-0006 regla 6):
-- RLS limita las filas a organizaciones accesibles.

-- El predicado es (organization_id, level, metric_date) y agrupa por campaign_id.
-- Los indices de columna suelta que ya existen no cubren esa combinacion.
create index if not exists meta_insight_rows_daily_org_level_date_idx
  on public.meta_insight_rows_daily (organization_id, level, metric_date)
  include (campaign_id);

create or replace function public.meta_spend_by_campaign(
  target_organization_id uuid,
  period_start date,
  period_end date
)
returns table (
  campaign_id uuid,
  campaign_name text,
  spend numeric,
  impressions bigint,
  clicks bigint,
  purchases numeric,
  purchase_value numeric,
  roas numeric,
  days_with_data bigint,
  purchase_action_type text
)
language sql
stable
as $$
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
$$;

grant execute on function public.meta_spend_by_campaign(uuid, date, date) to authenticated;

comment on function public.meta_spend_by_campaign is
  'Gasto, compras atribuidas y ROAS por campaña Meta en el periodo, desde insights diarios nivel ad. Las compras suman un unico action_type por cuenta (meta_ad_accounts.canonical_purchase_action_type), igual que meta_spend_summary; purchase_action_type devuelve cual se uso. Los EUR que devuelve son ATRIBUIDOS POR META en su ventana: no son venta Shopify y no se suman con los atribuidos por Klaviyo (ADR-0021).';
