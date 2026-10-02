-- A22-5: comparación exploratoria de señales de devolución entre
-- fulfillments entregados tarde frente a tiempo. No estima causalidad ni el
-- momento de devolución: Order.returnStatus es el estado agregado actual.

drop function if exists public.shopify_return_delay_comparison(uuid, timestamptz, timestamptz, uuid, integer);
create function public.shopify_return_delay_comparison(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid,
  minimum_sample integer default 30
)
returns table (
  tracking_company text,
  location_id uuid,
  location_name text,
  mature_late_orders bigint,
  mature_ontime_orders bigint,
  excluded_multi_fulfillment_orders bigint,
  late_known_return_status_orders bigint,
  ontime_known_return_status_orders bigint,
  late_return_signal_orders bigint,
  ontime_return_signal_orders bigint,
  late_return_status_coverage_pct numeric,
  ontime_return_status_coverage_pct numeric,
  late_return_signal_rate_pct numeric,
  ontime_return_signal_rate_pct numeric,
  difference_percentage_points numeric,
  sample_reliable boolean,
  comparison_status text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with scoped_fulfillments as (
    select
      f.id,
      f.order_id,
      f.store_id,
      lower(nullif(btrim(f.tracking_company), '')) as normalized_company,
      f.location_id,
      l.name as location_name,
      f.external_created_at,
      f.estimated_delivery_at,
      f.delivered_at,
      o.return_status
    from public.shopify_fulfillments f
    join public.shopify_order_facts o
      on o.id = f.order_id
     and o.organization_id = f.organization_id
     and o.store_id = f.store_id
    left join public.shopify_locations l
      on l.id = f.location_id
     and l.organization_id = f.organization_id
     and l.store_id = f.store_id
    where f.organization_id = target_organization_id
      and o.organization_id = target_organization_id
      and (target_store_id is null or f.store_id = target_store_id)
      and (period_start is null or f.external_created_at >= period_start)
      and f.external_created_at <= period_end
      and f.delivered_at is not null
      and f.estimated_delivery_at is not null
      and f.delivered_at >= f.external_created_at
      and f.external_created_at <= least(period_end, now()) - interval '30 days'
      and coalesce(o.is_test_order, false) = false
  ),
  fulfillment_counts as (
    select f.order_id, f.store_id, count(*)::bigint as fulfillment_count
    from public.shopify_fulfillments f
    join (select distinct order_id, store_id from scoped_fulfillments) candidate
      on candidate.order_id = f.order_id and candidate.store_id = f.store_id
    where f.organization_id = target_organization_id
    group by f.order_id, f.store_id
  ),
  classified as (
    select
      coalesce(s.normalized_company, 'unknown')::text as tracking_company,
      s.location_id,
      s.location_name::text as location_name,
      s.order_id,
      coalesce(fc.fulfillment_count, 0) > 1 as is_ambiguous,
      s.delivered_at > s.estimated_delivery_at as is_late,
      s.return_status,
      (s.return_status is not null) as return_status_known,
      (s.return_status is not null and s.return_status <> 'NO_RETURN') as has_return_signal
    from scoped_fulfillments s
    left join fulfillment_counts fc
      on fc.order_id = s.order_id and fc.store_id = s.store_id
  ),
  grouped as (
    select
      c.tracking_company,
      c.location_id,
      c.location_name,
      count(*) filter (where c.is_late and not c.is_ambiguous)::bigint as mature_late_orders,
      count(*) filter (where not c.is_late and not c.is_ambiguous)::bigint as mature_ontime_orders,
      count(distinct c.order_id) filter (where c.is_ambiguous)::bigint as excluded_multi_fulfillment_orders,
      count(*) filter (where c.is_late and not c.is_ambiguous and c.return_status_known)::bigint as late_known,
      count(*) filter (where not c.is_late and not c.is_ambiguous and c.return_status_known)::bigint as ontime_known,
      count(*) filter (where c.is_late and not c.is_ambiguous and c.has_return_signal)::bigint as late_signals,
      count(*) filter (where not c.is_late and not c.is_ambiguous and c.has_return_signal)::bigint as ontime_signals
    from classified c
    group by c.tracking_company, c.location_id, c.location_name
  ),
  measured as (
    select
      g.*,
      case when g.mature_late_orders > 0 then round(100.0 * g.late_known / nullif(g.mature_late_orders, 0), 1) end as late_coverage,
      case when g.mature_ontime_orders > 0 then round(100.0 * g.ontime_known / nullif(g.mature_ontime_orders, 0), 1) end as ontime_coverage,
      (g.mature_late_orders >= greatest(coalesce(minimum_sample, 30), 30)
       and g.mature_ontime_orders >= greatest(coalesce(minimum_sample, 30), 30)
       and g.mature_late_orders > 0 and g.mature_ontime_orders > 0
       and 100.0 * g.late_known / nullif(g.mature_late_orders, 0) >= 95
       and 100.0 * g.ontime_known / nullif(g.mature_ontime_orders, 0) >= 95) as reliable
    from grouped g
  )
  select
    m.tracking_company,
    m.location_id,
    m.location_name,
    m.mature_late_orders,
    m.mature_ontime_orders,
    m.excluded_multi_fulfillment_orders,
    m.late_known,
    m.ontime_known,
    m.late_signals,
    m.ontime_signals,
    m.late_coverage,
    m.ontime_coverage,
    case when m.reliable then round(100.0 * m.late_signals / nullif(m.late_known, 0), 1) end,
    case when m.reliable then round(100.0 * m.ontime_signals / nullif(m.ontime_known, 0), 1) end,
    case when m.reliable then round(
      100.0 * m.late_signals / nullif(m.late_known, 0)
      - 100.0 * m.ontime_signals / nullif(m.ontime_known, 0), 1
    ) end,
    m.reliable,
    case
      when m.mature_late_orders < greatest(coalesce(minimum_sample, 30), 30)
        or m.mature_ontime_orders < greatest(coalesce(minimum_sample, 30), 30) then 'insufficient_sample'
      when coalesce(m.late_coverage, 0) < 95 or coalesce(m.ontime_coverage, 0) < 95 then 'insufficient_return_status_coverage'
      else 'available'
    end::text
  from measured m
  order by m.mature_late_orders + m.mature_ontime_orders desc, m.tracking_company, m.location_id;
$function$;

revoke all on function public.shopify_return_delay_comparison(uuid, timestamptz, timestamptz, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.shopify_return_delay_comparison(uuid, timestamptz, timestamptz, uuid, integer)
  to service_role;

comment on function public.shopify_return_delay_comparison(uuid, timestamptz, timestamptz, uuid, integer) is
  'A22 exploratory aggregate comparing current Shopify Order.returnStatus signal for mature single-fulfillment orders delivered after vs by ETA. Suppresses rates unless both groups have n>=30 and >=95% returnStatus coverage. This is not event-time 30-day return incidence and does not establish causation.';

do $migration$
declare
  previous_content text;
  appended text := E'\n\n11. RETURN / DELAY COMPARISON\n- Usa `shopify_return_delay_comparison` solo como comparación exploratoria entre pedidos maduros entregados después de la ETA y a tiempo, por tienda, transportista y ubicación; no mezcles rutas o tiendas.\n- La madurez significa que han pasado al menos 30 días desde la creación del fulfillment incluido; `Order.returnStatus` es el estado agregado ACTUAL del pedido, no el historial ni la fecha de devolución. No lo describas como tasa de devolución ocurrida dentro de esos mismos 30 días.\n- Solo compara pedidos con un fulfillment, ETA y entrega confirmada; los multi-fulfillment se excluyen por ambigüedad. Se exige n >= 30 y cobertura de returnStatus >= 95% en ambos grupos. Si cualquiera no cumple, las tasas y diferencia son null: informa muestra/cobertura y no infieras.\n- `NO_RETURN` significa que Shopify no reporta devolución actualmente; otro estado conocido es una señal de proceso de devolución, no necesariamente devolución física completada.\n- Una diferencia es asociación observada, nunca prueba de que el retraso causó la devolución. Considera antigüedad, mezcla de pedidos, carrier, ubicación y lagunas de sincronización; no recomiendes causalidad ni atribuyas culpa.\n- Usa `shopify_fulfillment_health` para motivos enumerados de las líneas devueltas, pero no asumas cobertura completa ni enlaces todas las devoluciones a un envío.\n- Ejecuta sin API key real mediante fixture/provider simulado para verificar selección de tools, parámetros, salida y abstención; una respuesta de modelo real y la calidad del juicio requieren credencial del proveedor.';
begin
  select content into previous_content
  from public.prompt_versions
  where code = 'a22_postventa_shopify_system' and version = 'v5';

  if previous_content is null then
    raise exception 'A22 v5 canonical prompt is missing';
  end if;

  insert into public.prompt_versions (code, version, content, checksum)
  values ('a22_postventa_shopify_system', 'v6', previous_content || appended,
    encode(sha256((previous_content || appended)::bytea), 'hex'))
  on conflict (code, version) do update
  set content = excluded.content, checksum = excluded.checksum;

  insert into public.agent_versions as existing_version
    (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
  select v.definition_id, 'v6', v.model, 'a22_postventa_shopify_system', 'v6',
    (select coalesce(jsonb_agg(x.tool_name order by x.tool_name), '[]'::jsonb)
     from (select distinct tool_name
       from jsonb_array_elements_text(coalesce(v.allowed_tools, '[]'::jsonb) ||
         jsonb_build_array('shopify_return_delay_comparison', 'shopify_fulfillment_health')) as allowed(tool_name)) x),
    v.approval_mode, v.output_schema_version, v.config, true
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where d.code = 'a22_postventa_shopify' and v.version = 'v5'
  on conflict (definition_id, version) do update
  set prompt_code = excluded.prompt_code,
      prompt_version = excluded.prompt_version,
      allowed_tools = excluded.allowed_tools,
      config = excluded.config,
      is_active = true;

  update public.agent_versions av
  set is_active = false
  where av.is_active and av.version <> 'v6'
    and av.definition_id = (select id from public.agent_definitions where code = 'a22_postventa_shopify');
end
$migration$;
