-- INT-02: action_type canonico de compra por cuenta publicitaria.
--
-- Problema real que corrige: meta_spend_summary sumaba 'purchase',
-- 'omni_purchase' y 'offsite_conversion.fb_pixel_purchase' a la vez. Meta
-- reporta la misma conversion bajo varios action_type simultaneamente, asi que
-- una cuenta con pixel + API de conversiones veia compras y ROAS inflados 2-3x.
-- El propio comentario de la funcion admitia el solape como "limitacion".
--
-- La guia de Meta (7.2) y el contrato de preparacion de conectores exigen que
-- actions/action_values no se colapsen a una unica "compra" sin una decision
-- documentada por cuenta. Esto la hace explicita y auditable.

alter table public.meta_ad_accounts
  add column if not exists canonical_purchase_action_type varchar(255) not null default 'omni_purchase',
  add column if not exists canonical_purchase_action_selected_at timestamptz,
  add column if not exists canonical_purchase_action_selected_by uuid references auth.users (id) on delete set null;

comment on column public.meta_ad_accounts.canonical_purchase_action_type is
  'action_type unico que cuenta como compra para esta cuenta. Default omni_purchase: es la columna "Compras" que el anunciante ve en Ads Manager para ecommerce (web + app + offline). Cambiar solo tras comparar contra el panel real de la cuenta.';
comment on column public.meta_ad_accounts.canonical_purchase_action_selected_by is
  'NULL = sigue el default del sistema, nadie lo ha decidido todavia para esta cuenta.';

-- meta_spend_summary: mismo contrato de salida mas la procedencia. Sigue
-- security invoker + stable; RLS limita las filas a organizaciones accesibles.
-- Anadir una columna al RETURNS TABLE cambia el tipo de retorno, asi que
-- `create or replace` no basta: hay que soltar la funcion y volver a otorgar
-- el execute.
drop function if exists public.meta_spend_summary(uuid, date, date);

create function public.meta_spend_summary(
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
  days_with_data bigint,
  purchase_action_types text[]
)
language sql
stable
as $$
  with base_rows as (
    select r.id, r.ad_account_id, r.spend, r.impressions, r.clicks, r.metric_date
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
$$;

grant execute on function public.meta_spend_summary(uuid, date, date) to authenticated;

comment on function public.meta_spend_summary is 'Gasto, compras atribuidas, ROAS y CAC del periodo desde insights diarios nivel ad. Las compras suman un unico action_type por cuenta (meta_ad_accounts.canonical_purchase_action_type), no varios solapados. purchase_action_types devuelve los action_type realmente usados para que la UI pueda mostrar la procedencia. Devuelve fila unica; null en roas/cac cuando no hay gasto o compras.';
