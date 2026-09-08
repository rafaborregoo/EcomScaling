-- Dashboard del consultor, estado "vista general": totales de negocio
-- agregados sobre toda su cartera (las organizaciones que se le pasan).
--
-- ADR-0006 pto. 6: agregacion en una funcion SQL `stable` (SECURITY INVOKER,
-- la RLS de las tablas base sigue aplicando cuando la llama un usuario; el
-- backend la invoca con service role sobre las org asignadas). Reusa el mismo
-- criterio que shopify_sales_summary / meta_spend_summary pero para N org.
-- Los indices de fecha ya existen: shopify_order_facts_org_processed_idx y los
-- de meta_insight_rows_daily.

drop function if exists public.consultant_business_rollup(uuid[], timestamptz, timestamptz);
create or replace function public.consultant_business_rollup(
  org_ids uuid[],
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  net_sales numeric,
  orders_count bigint,
  meta_spend numeric,
  meta_purchase_value numeric,
  roas numeric
)
language sql
stable
as $$
  with shopify as (
    select
      coalesce(sum(net_sales), 0) as net_sales,
      count(*)::bigint as orders_count
    from public.shopify_order_facts
    where organization_id = any(org_ids)
      and is_test_order = false
      and cancelled_at is null
      and coalesce(processed_at, external_created_at) between period_start and period_end
  ),
  meta_rows as (
    select r.id, r.ad_account_id, r.spend
    from public.meta_insight_rows_daily r
    where r.organization_id = any(org_ids)
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.metric_date >= period_start::date
      and r.metric_date <= period_end::date
  ),
  meta_spend_total as (
    select coalesce(sum(spend), 0) as meta_spend from meta_rows
  ),
  meta_value as (
    select coalesce(
      sum(am.value) filter (where am.metric_name = 'action_values'),
      0
    ) as purchase_value
    from public.meta_insight_action_metrics am
    join meta_rows b on b.id = am.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where am.action_type = a.canonical_purchase_action_type
  )
  select
    shopify.net_sales,
    shopify.orders_count,
    meta_spend_total.meta_spend,
    meta_value.purchase_value as meta_purchase_value,
    case
      when meta_spend_total.meta_spend > 0
      then round(meta_value.purchase_value / meta_spend_total.meta_spend, 4)
      else null
    end as roas
  from shopify
  cross join meta_spend_total
  cross join meta_value;
$$;

grant execute on function public.consultant_business_rollup(uuid[], timestamptz, timestamptz)
  to authenticated;

comment on function public.consultant_business_rollup is
  'Totales de negocio (facturacion neta, pedidos, gasto Meta, valor de compra Meta, ROAS) agregados sobre varias organizaciones para el estado "vista general" del Dashboard del consultor. Fila unica. Mismo criterio de ventas reales que shopify_sales_summary y de compras que meta_spend_summary.';
