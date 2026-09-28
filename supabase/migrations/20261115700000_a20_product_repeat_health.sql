-- A20 may reason about observed product repurchase intervals without ever
-- receiving customer identifiers or making low-sample claims.
do $a20_product_repeat_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a20_retencion_clientes_system' and version = 'v2'
  ) or not exists (
    select 1 from public.agent_versions v
    join public.agent_definitions d on d.id = v.definition_id
    where d.code = 'a20_retencion_clientes' and v.version = 'v2'
  ) then
    raise exception 'A20_V2_REQUIRED_FOR_PRODUCT_REPURCHASE_HEALTH';
  end if;
end
$a20_product_repeat_guard$;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v3',
  p.content || E'\n\nANALISIS DE RECOMPRA POR PRODUCTO\nLa herramienta opcional shopify_product_repurchase_health solo se consulta si hay una tienda seleccionada y una conclusion o tarea realmente depende del comportamiento de recompra de un producto. Sus cohortes requieren 90 dias maduros y al menos 30 clientes por producto; medianas/percentiles de intervalo requieren al menos 10 clientes repetidores. No la llames si una tarea general de retencion ya esta sustentada por shopify_customer_health. Si availability no es available, o la evidencia indica historial sincronizado limitado, no trates la ausencia de filas como ausencia de recompra ni recomiendes el producto por una tasa. El intervalo es conducta observada durante 90 dias, no una cadencia futura, ciclo natural universal, causalidad ni prueba de que un email a un dia concreto vaya a funcionar. Si la sincronizacion o el enlace de producto no es fiable, abstente. Nunca pidas ni expongas identidades; A20 decide oportunidad/segmento y A12/A28 disenan el flow.',
  encode(sha256(convert_to(p.content || E'\n\nANALISIS DE RECOMPRA POR PRODUCTO\nLa herramienta opcional shopify_product_repurchase_health solo se consulta si hay una tienda seleccionada y una conclusion o tarea realmente depende del comportamiento de recompra de un producto. Sus cohortes requieren 90 dias maduros y al menos 30 clientes por producto; medianas/percentiles de intervalo requieren al menos 10 clientes repetidores. No la llames si una tarea general de retencion ya esta sustentada por shopify_customer_health. Si availability no es available, o la evidencia indica historial sincronizado limitado, no trates la ausencia de filas como ausencia de recompra ni recomiendes el producto por una tasa. El intervalo es conducta observada durante 90 dias, no una cadencia futura, ciclo natural universal, causalidad ni prueba de que un email a un dia concreto vaya a funcionar. Si la sincronizacion o el enlace de producto no es fiable, abstente. Nunca pidas ni expongas identidades; A20 decide oportunidad/segmento y A12/A28 disenan el flow.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a20_retencion_clientes_system' and p.version = 'v2'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

insert into public.agent_versions as existing_version (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v3', v.model, 'a20_retencion_clientes_system', 'v3',
  v.allowed_tools || '["shopify_product_repurchase_health"]'::jsonb,
  v.approval_mode, v.output_schema_version, v.config, v.is_active
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a20_retencion_clientes' and v.version = 'v2'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = existing_version.is_active or excluded.is_active;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.version <> 'v3'
  and av.definition_id = (select id from public.agent_definitions where code = 'a20_retencion_clientes');

create index if not exists shopify_order_facts_product_repurchase_scope_idx
  on public.shopify_order_facts (organization_id, store_id, customer_reference_hash, coalesce(processed_at, external_created_at))
  where customer_reference_hash is not null and is_test_order = false and cancelled_at is null;

create or replace function public.shopify_product_repurchase_summary(
  target_organization_id uuid,
  target_store_id uuid,
  as_of timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with store_history as (
    select min(coalesce(o.processed_at, o.external_created_at)) as first_identified_order_at
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and o.store_id = target_store_id
      and o.customer_reference_hash is not null
      and o.is_test_order = false
      and o.cancelled_at is null
      and coalesce(o.processed_at, o.external_created_at) <= as_of
  ),
  product_orders as (
    select distinct
      p.id as product_id,
      p.title as product_title,
      nullif(btrim(p.product_type), '') as product_type,
      o.customer_reference_hash as customer_key,
      o.id as order_id,
      coalesce(o.processed_at, o.external_created_at) as order_at
    from public.shopify_order_facts o
    join public.shopify_order_items oi
      on oi.order_id = o.id
     and oi.organization_id = o.organization_id
    join public.shopify_products p
      on p.id = oi.product_id
     and p.organization_id = o.organization_id
     and p.store_id = o.store_id
    where o.organization_id = target_organization_id
      and o.store_id = target_store_id
      and o.customer_reference_hash is not null
      and o.is_test_order = false
      and o.cancelled_at is null
      and oi.quantity_current > 0
      and coalesce(o.processed_at, o.external_created_at) <= as_of
  ),
  customer_product_first as (
    select
      product_id,
      product_title,
      product_type,
      customer_key,
      min(order_at) as first_purchase_at
    from product_orders
    group by product_id, product_title, product_type, customer_key
  ),
  mature_cohort as (
    select *
    from customer_product_first
    where first_purchase_at >= as_of - interval '365 days'
      and first_purchase_at <= as_of - interval '90 days'
  ),
  observed_repeats as (
    select
      cohort.product_id,
      cohort.product_title,
      cohort.product_type,
      cohort.customer_key,
      extract(epoch from (min(repeat_order.order_at) - cohort.first_purchase_at)) / 86400.0 as days_to_repeat
    from mature_cohort cohort
    left join product_orders repeat_order
      on repeat_order.product_id = cohort.product_id
     and repeat_order.customer_key = cohort.customer_key
     and repeat_order.order_at > cohort.first_purchase_at
     and repeat_order.order_at <= cohort.first_purchase_at + interval '90 days'
    group by cohort.product_id, cohort.product_title, cohort.product_type, cohort.customer_key, cohort.first_purchase_at
  ),
  product_summary as (
    select
      product_id,
      product_title,
      product_type,
      count(*)::integer as eligible_customers,
      count(*) filter (where days_to_repeat is not null)::integer as repeat_customers_90d,
      round(100.0 * count(*) filter (where days_to_repeat is not null) / nullif(count(*), 0), 1) as repeat_rate_90d_pct,
      case when count(*) filter (where days_to_repeat is not null) >= 10
        then round((percentile_cont(0.5) within group (order by days_to_repeat) filter (where days_to_repeat is not null))::numeric, 1)
        else null end as median_days_to_repeat,
      case when count(*) filter (where days_to_repeat is not null) >= 10
        then round((percentile_cont(0.75) within group (order by days_to_repeat) filter (where days_to_repeat is not null))::numeric, 1)
        else null end as p75_days_to_repeat
    from observed_repeats
    group by product_id, product_title, product_type
    having count(*) >= 30
  ),
  top_products as (
    select * from product_summary
    order by repeat_customers_90d desc, eligible_customers desc, product_id
    limit 12
  ),
  stats as (
    select
      (select first_identified_order_at from store_history) as history_start,
      floor(extract(epoch from (as_of - (select first_identified_order_at from store_history))) / 86400.0)::integer as history_days,
      (select count(*) from product_summary)::integer as eligible_product_groups,
      (select count(*) from top_products)::integer as returned_product_groups,
      coalesce((select jsonb_agg(jsonb_build_object(
        'product_title', product_title,
        'product_type', product_type,
        'eligible_customers', eligible_customers,
        'repeat_customers_90d', repeat_customers_90d,
        'repeat_rate_90d_pct', repeat_rate_90d_pct,
        'median_days_to_repeat', median_days_to_repeat,
        'p75_days_to_repeat', p75_days_to_repeat,
        'repeat_interval_sample_sufficient', repeat_customers_90d >= 10
      ) order by repeat_customers_90d desc, eligible_customers desc, product_id) from top_products), '[]'::jsonb) as products
  )
  select jsonb_build_object(
    'availability', case
      when target_store_id is null then 'store_required'
      when history_start is null then 'no_identified_product_history'
      when history_days < 455 then 'insufficient_observed_history'
      when eligible_product_groups = 0 then 'no_product_group_meets_sample'
      else 'available'
    end,
    'as_of', as_of,
    'observed_history_start', history_start,
    'observed_history_days', greatest(coalesce(history_days, 0), 0),
    'cohort_window_days', 365,
    'repeat_followup_days', 90,
    'minimum_eligible_customers', 30,
    'minimum_repeat_customers_for_interval', 10,
    'eligible_product_groups', eligible_product_groups,
    'returned_product_groups', returned_product_groups,
    'truncated', eligible_product_groups > returned_product_groups,
    'products', case when history_days >= 455 then products else '[]'::jsonb end,
    'coverage_note', 'Cuenta primera compra observada en el historial sincronizado, no una primera compra vitalicia garantizada. Solo incluye clientes identificables y lineas de producto enlazadas. La repeticion en 90 dias describe comportamiento observado y no prueba una cadencia futura ni causalidad.'
  )
  from stats;
$function$;

revoke execute on function public.shopify_product_repurchase_summary(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.shopify_product_repurchase_summary(uuid, uuid, timestamptz) to authenticated, service_role;

comment on function public.shopify_product_repurchase_summary(uuid, uuid, timestamptz) is
  'Resumen agregado de recompra por producto para A20. Solo cohortes maduras de 90 dias, n>=30 por producto, intervalos solo con >=10 repeticiones; nunca devuelve customer_reference_hash.';
