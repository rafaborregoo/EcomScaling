-- SQL Gateway por tienda.
--
-- Las vistas ai.* filtraban solo por organización. Una organización puede
-- tener varias tiendas, así que un agente que trabaja para la tienda A habría
-- leído también los pedidos de la B; para no mezclarlas, el API no declaraba
-- sql_select en ninguna ejecución con tienda, y la mayoría de agentes se
-- quedaban sin poder calcular nada por su cuenta.
--
-- Ahora la pasarela fija también la tienda (app.gateway_store_id) y cada vista
-- la aplica, directamente o a través de su tabla padre. Sin tienda fijada
-- (null) todo sigue como antes: la organización entera. El filtro de
-- organización no cambia y sigue siendo la primera barrera.
--
-- Criterios por tipo de dato:
--  - Shopify: la tienda exacta (columna store_id o la de su padre).
--  - Meta: la cuenta publicitaria asignada a la tienda (meta_ad_accounts.store_id),
--    igual que el runtime (`.eq("store_id", storeId)`).
--  - Tareas, alertas y objetivos: los de la tienda y los de toda la organización
--    (store_id null), igual que el resto del runtime.
--  - Configuración financiera y gastos fijos: de la organización; no se tocan.

create or replace function private.gateway_store_id()
returns uuid
language sql
stable
set search_path = pg_catalog
as $$
  select nullif(current_setting('app.gateway_store_id', true), '')::uuid
$$;

create or replace view ai.shopify_stores as
select id, shop_name, myshopify_domain, currency_code, timezone, is_active
from public.shopify_stores
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or id = private.gateway_store_id());

create or replace view ai.shopify_products as
select id, store_id, external_product_id, title, handle, vendor, product_type,
  status, published_at, external_created_at
from public.shopify_products
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or store_id = private.gateway_store_id());

create or replace view ai.shopify_variants as
select id, product_id, title, current_price, compare_at_price, position, is_active
from public.shopify_variants
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or store_id = private.gateway_store_id());

create or replace view ai.shopify_inventory_items as
select id, variant_id, sku, tracked, current_unit_cost, cost_currency_code
from public.shopify_inventory_items
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or store_id = private.gateway_store_id());

create or replace view ai.shopify_inventory_current_state as
select id, inventory_item_id, location_id, available_quantity, on_hand_quantity,
  committed_quantity, incoming_quantity, is_active, updated_at
from public.shopify_inventory_current_state
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or inventory_item_id in (
    select ii.id from public.shopify_inventory_items ii
    where ii.organization_id = private.gateway_org_id()
      and ii.store_id = private.gateway_store_id()
  ));

create or replace view ai.shopify_order_facts as
select id, store_id, order_name, financial_status, fulfillment_status,
  source_name, currency_code, gross_sales, discounts, refunds, net_sales,
  current_shipping_price, current_total_tax, current_total_price, total_items,
  is_first_customer_order, is_test_order, processed_at, external_created_at,
  cancelled_at
from public.shopify_order_facts
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or store_id = private.gateway_store_id());

create or replace view ai.shopify_order_items as
select id, order_id, product_id, variant_id, title, sku_snapshot,
  vendor_snapshot, quantity_original, quantity_current, unit_price,
  original_line_total, discount_total, current_line_total, refunded_quantity,
  refunded_amount
from public.shopify_order_items
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or order_id in (
    select o.id from public.shopify_order_facts o
    where o.organization_id = private.gateway_org_id()
      and o.store_id = private.gateway_store_id()
  ));

create or replace view ai.shopify_refunds as
select id, order_id, total_refunded, currency_code, external_created_at
from public.shopify_refunds
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or order_id in (
    select o.id from public.shopify_order_facts o
    where o.organization_id = private.gateway_org_id()
      and o.store_id = private.gateway_store_id()
  ));

create or replace view ai.shopify_customers as
select id, store_id, customer_reference_hash, number_of_orders, amount_spent,
  currency_code, state, tags, external_created_at
from public.shopify_customers
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or store_id = private.gateway_store_id());

create or replace view ai.product_costs as
select id, inventory_item_id, unit_cost, currency_code, source, valid_from, valid_until
from public.product_costs
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or inventory_item_id in (
    select ii.id from public.shopify_inventory_items ii
    where ii.organization_id = private.gateway_org_id()
      and ii.store_id = private.gateway_store_id()
  ));

create or replace view ai.organization_metric_targets as
select id, metric_key, target_value, period, valid_from, valid_until
from public.organization_metric_targets
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or store_id is null or store_id = private.gateway_store_id());

create or replace view ai.alerts as
select id, status, severity, title, message, metric_code, metric_value,
  threshold_value, first_detected_at, last_detected_at, resolved_at
from public.alerts
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or store_id is null or store_id = private.gateway_store_id());

create or replace view ai.tasks as
select id, alert_id, source, status, priority, title, description, due_at,
  completed_at, created_at, categories
from public.tasks
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or store_id is null or store_id = private.gateway_store_id());

create or replace view ai.meta_campaigns as
select id, external_campaign_id, name, objective, effective_status,
  daily_budget, lifetime_budget, starts_at, ends_at
from public.meta_campaigns
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or ad_account_id in (
    select a.id from public.meta_ad_accounts a
    where a.organization_id = private.gateway_org_id()
      and a.store_id = private.gateway_store_id()
  ));

create or replace view ai.meta_ads as
select id, ad_set_id, external_ad_id, name, effective_status, parsed_angle,
  parsed_format, parsed_hook
from public.meta_ads
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or ad_set_id in (
    select s.id
    from public.meta_ad_sets s
    join public.meta_campaigns c on c.id = s.campaign_id
    join public.meta_ad_accounts a on a.id = c.ad_account_id
    where s.organization_id = private.gateway_org_id()
      and a.store_id = private.gateway_store_id()
  ));

create or replace view ai.meta_insight_rows_daily as
select id, campaign_id, ad_set_id, ad_id, level, metric_date, breakdown_hash,
  spend, impressions, reach, frequency, clicks, inline_link_clicks, cpm, cpc, ctr
from public.meta_insight_rows_daily
where organization_id = private.gateway_org_id()
  and (private.gateway_store_id() is null or ad_account_id in (
    select a.id from public.meta_ad_accounts a
    where a.organization_id = private.gateway_org_id()
      and a.store_id = private.gateway_store_id()
  ));

-- Nueva firma con la tienda. Se borra la de tres argumentos en la misma
-- migración: con las dos, una llamada sin tienda encajaría en ambas y Postgres
-- la rechazaría por ambigua. El cuerpo es el de 20260831082831 más la tienda.
drop function if exists public.agent_sql_gateway(uuid, text, integer);
drop function if exists public.agent_sql_gateway(uuid, text, integer, uuid);

create function public.agent_sql_gateway(
  target_organization_id uuid,
  query_sql text,
  max_rows integer default 200,
  target_store_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, ai
as $$
declare
  result jsonb;
  plan jsonb;
  estimated_total_cost numeric;
  effective_rows integer := least(greatest(coalesce(max_rows, 200), 1), 500);
  max_estimated_cost constant numeric := 100000;
begin
  perform set_config('app.gateway_org_id', target_organization_id::text, true);
  -- Siempre se fija, también vacío: nunca hereda una tienda de otra llamada.
  perform set_config('app.gateway_store_id', coalesce(target_store_id::text, ''), true);
  perform set_config('search_path', 'ai, pg_catalog', true);
  perform set_config('statement_timeout', '8000', true);
  perform set_config('lock_timeout', '3000', true);
  execute 'set local role ai_gateway';

  execute format(
    'explain (format json, costs true) select * from (%s) gateway_inner',
    query_sql
  ) into plan;

  estimated_total_cost := nullif(
    plan->0->'Plan'->>'Total Cost',
    ''
  )::numeric;

  if coalesce(estimated_total_cost, 0) > max_estimated_cost then
    return jsonb_build_object(
      'error', 'query_cost_exceeded',
      'estimated_cost', estimated_total_cost,
      'max_estimated_cost', max_estimated_cost
    );
  end if;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(gateway_row)), ''[]''::jsonb)
     from (select * from (%s) gateway_inner limit %s) gateway_row',
    query_sql,
    effective_rows
  ) into result;

  return jsonb_build_object(
    'rows', result,
    'row_limit', effective_rows,
    'estimated_cost', estimated_total_cost
  );
exception when others then
  return jsonb_build_object('error', sqlerrm);
end;
$$;

revoke all on function public.agent_sql_gateway(uuid, text, integer, uuid) from public;
revoke all on function public.agent_sql_gateway(uuid, text, integer, uuid) from anon;
revoke all on function public.agent_sql_gateway(uuid, text, integer, uuid) from authenticated;
grant execute on function public.agent_sql_gateway(uuid, text, integer, uuid) to service_role;

comment on function public.agent_sql_gateway(uuid, text, integer, uuid) is
  'Read-only AI SQL gateway. Tenant y, si se pasa, tienda forzados en las vistas ai.*; validación del API, rol ai_gateway, timeout, filas y coste.';
