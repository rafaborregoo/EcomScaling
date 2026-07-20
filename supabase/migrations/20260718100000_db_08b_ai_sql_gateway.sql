-- DB-08b / AI-03: SQL Gateway de solo lectura para agentes IA.
--
-- Diseno de aislamiento en dos capas:
--   1. Node (apps/api/src/sql-gateway.ts): validacion AST (solo SELECT/WITH,
--      allowlist de vistas, sin esquemas cualificados, denylist de funciones).
--   2. Base de datos (este archivo): el agente solo ve el esquema `ai`, cuyas
--      vistas filtran SIEMPRE por la organizacion fijada por el backend via
--      set_config('app.gateway_org_id', ...). Aunque la validacion Node
--      fallara, una consulta jamas puede devolver filas de otro tenant:
--      el filtro vive dentro de la vista, no en el SQL del modelo.
--
-- La funcion agent_sql_gateway solo es ejecutable por service_role (el API la
-- llama tras el chequeo de membership); authenticated/anon no pueden usarla.
-- Cada ejecucion queda auditada por el API en agent_query_runs.

create schema if not exists ai;

-- Organizacion activa de la consulta en curso. La fija agent_sql_gateway con
-- set_config(..., is_local => true): solo vive dentro de la transaccion.
create or replace function private.gateway_org_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.gateway_org_id', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Vistas allowlist: columnas explicitas (sin tokens, sin PII, sin raw_data) y
-- filtro de tenant embebido. Si la GUC no esta fijada, devuelven 0 filas.
-- ---------------------------------------------------------------------------

create view ai.shopify_stores as
select id, shop_name, myshopify_domain, currency_code, timezone, is_active
from public.shopify_stores
where organization_id = private.gateway_org_id();

create view ai.shopify_products as
select id, store_id, external_product_id, title, handle, vendor, product_type,
  status, published_at, external_created_at
from public.shopify_products
where organization_id = private.gateway_org_id();

create view ai.shopify_variants as
select id, product_id, title, current_price, compare_at_price, position, is_active
from public.shopify_variants
where organization_id = private.gateway_org_id();

create view ai.shopify_inventory_items as
select id, variant_id, sku, tracked, current_unit_cost, cost_currency_code
from public.shopify_inventory_items
where organization_id = private.gateway_org_id();

create view ai.shopify_inventory_current_state as
select id, inventory_item_id, location_id, available_quantity, on_hand_quantity,
  committed_quantity, incoming_quantity, is_active, updated_at
from public.shopify_inventory_current_state
where organization_id = private.gateway_org_id();

create view ai.shopify_order_facts as
select id, store_id, order_name, financial_status, fulfillment_status,
  source_name, currency_code, gross_sales, discounts, refunds, net_sales,
  current_shipping_price, current_total_tax, current_total_price, total_items,
  is_first_customer_order, is_test_order, processed_at, external_created_at,
  cancelled_at
from public.shopify_order_facts
where organization_id = private.gateway_org_id();

create view ai.shopify_order_items as
select id, order_id, product_id, variant_id, title, sku_snapshot,
  vendor_snapshot, quantity_original, quantity_current, unit_price,
  original_line_total, discount_total, current_line_total, refunded_quantity,
  refunded_amount
from public.shopify_order_items
where organization_id = private.gateway_org_id();

create view ai.shopify_refunds as
select id, order_id, total_refunded, currency_code, external_created_at
from public.shopify_refunds
where organization_id = private.gateway_org_id();

-- shopify_customers ya no guarda PII (solo hash + metricas de comportamiento).
create view ai.shopify_customers as
select id, store_id, customer_reference_hash, number_of_orders, amount_spent,
  currency_code, state, tags, external_created_at
from public.shopify_customers
where organization_id = private.gateway_org_id();

create view ai.product_costs as
select id, inventory_item_id, unit_cost, currency_code, source, valid_from, valid_until
from public.product_costs
where organization_id = private.gateway_org_id();

create view ai.organization_financial_settings as
select currency_code, payment_fee_pct, payment_fee_fixed, default_shipping_cost, vat_pct
from public.organization_financial_settings
where organization_id = private.gateway_org_id();

create view ai.fixed_expenses as
select id, name, category, amount, currency_code, billing_period, valid_from,
  valid_until, is_active
from public.fixed_expenses
where organization_id = private.gateway_org_id();

create view ai.organization_metric_targets as
select id, metric_key, target_value, period, valid_from, valid_until
from public.organization_metric_targets
where organization_id = private.gateway_org_id();

create view ai.alerts as
select id, status, severity, title, message, metric_code, metric_value,
  threshold_value, first_detected_at, last_detected_at, resolved_at
from public.alerts
where organization_id = private.gateway_org_id();

create view ai.tasks as
select id, alert_id, source, status, priority, title, description, due_at,
  completed_at, created_at
from public.tasks
where organization_id = private.gateway_org_id();

create view ai.meta_campaigns as
select id, external_campaign_id, name, objective, effective_status,
  daily_budget, lifetime_budget, starts_at, ends_at
from public.meta_campaigns
where organization_id = private.gateway_org_id();

create view ai.meta_ads as
select id, ad_set_id, external_ad_id, name, effective_status, parsed_angle,
  parsed_format, parsed_hook
from public.meta_ads
where organization_id = private.gateway_org_id();

create view ai.meta_insight_rows_daily as
select id, campaign_id, ad_set_id, ad_id, level, metric_date, breakdown_hash,
  spend, impressions, reach, frequency, clicks, inline_link_clicks, cpm, cpc, ctr
from public.meta_insight_rows_daily
where organization_id = private.gateway_org_id();

-- ---------------------------------------------------------------------------
-- Ejecutor: fija tenant + search_path + timeout, envuelve con LIMIT y agrega
-- a jsonb. Los errores de SQL vuelven como {"error": ...} para que el agente
-- pueda corregir su consulta sin tumbar el run.
-- ---------------------------------------------------------------------------

create or replace function public.agent_sql_gateway(
  target_organization_id uuid,
  query_sql text,
  max_rows integer default 200
)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
  effective_rows integer := least(greatest(coalesce(max_rows, 200), 1), 500);
begin
  perform set_config('app.gateway_org_id', target_organization_id::text, true);
  perform set_config('search_path', 'ai', true);
  perform set_config('statement_timeout', '8000', true);

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(gateway_row)), ''[]''::jsonb)
     from (select * from (%s) gateway_inner limit %s) gateway_row',
    query_sql,
    effective_rows
  )
  into result;

  return jsonb_build_object('rows', result, 'row_limit', effective_rows);
exception
  when others then
    return jsonb_build_object('error', sqlerrm);
end;
$$;

revoke all on function public.agent_sql_gateway(uuid, text, integer) from public;
revoke all on function public.agent_sql_gateway(uuid, text, integer) from anon;
revoke all on function public.agent_sql_gateway(uuid, text, integer) from authenticated;
grant execute on function public.agent_sql_gateway(uuid, text, integer) to service_role;

grant usage on schema ai to service_role;
grant select on all tables in schema ai to service_role;

-- El agente A02 puede usar el gateway (y search_knowledge cuando el runtime
-- tenga embeddings configurados; sin VOYAGE_API_KEY la tool no se habilita).
update public.agent_versions
set allowed_tools = '["sql_select", "search_knowledge"]'::jsonb
where prompt_code = 'a02_monitor_negocio_system';

comment on schema ai is 'Vistas de solo lectura para el SQL Gateway de agentes IA (AI-03): columnas explicitas y filtro de tenant embebido via app.gateway_org_id.';
comment on function public.agent_sql_gateway is 'Ejecuta un SELECT ya validado por el API contra el esquema ai, con tenant forzado, timeout y limite de filas. Solo service_role.';
