-- A22 can locate a delivery exception only from explicit Shopify tracking
-- events. Keep normalized event evidence only; never store addresses/messages.
alter table public.shopify_order_facts
  add column if not exists shipping_country_code varchar(2),
  add column if not exists shipping_region_code varchar(12);

create table if not exists public.shopify_fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  fulfillment_id uuid not null references public.shopify_fulfillments(id) on delete cascade,
  external_event_id varchar(255) not null,
  status varchar(40) not null check (status in (
    'ATTEMPTED_DELIVERY','CARRIER_PICKED_UP','CONFIRMED','DELAYED','DELIVERED',
    'FAILURE','IN_TRANSIT','LABEL_PRINTED','LABEL_PURCHASED','OUT_FOR_DELIVERY',
    'READY_FOR_PICKUP','OTHER'
  )),
  happened_at timestamptz not null,
  estimated_delivery_at timestamptz,
  reason_code varchar(40) not null default 'unknown' check (reason_code in (
    'customs_hold','address_issue','delivery_attempt','carrier_delay',
    'carrier_failure','unknown'
  )),
  reason_confidence numeric(4,3) not null default 0 check (reason_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_fulfillment_events_unique_external unique (store_id, external_event_id)
);

create index if not exists shopify_fulfillment_events_scope_time_idx
  on public.shopify_fulfillment_events (organization_id, store_id, fulfillment_id, happened_at desc);

create table if not exists public.shopify_fulfillment_event_sync_state (
  fulfillment_id uuid primary key references public.shopify_fulfillments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  last_attempt_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_external_updated_at timestamptz,
  next_cursor text,
  event_count integer not null default 0,
  status varchar(20) not null check (status in ('complete','partial','failed')),
  error_code varchar(100),
  updated_at timestamptz not null default now()
);

create index if not exists shopify_fulfillment_event_sync_scope_idx
  on public.shopify_fulfillment_event_sync_state (organization_id, store_id, status, last_attempt_at);

alter table public.shopify_fulfillment_events enable row level security;
alter table public.shopify_fulfillment_event_sync_state enable row level security;

drop policy if exists shopify_fulfillment_events_select_authorized on public.shopify_fulfillment_events;
create policy shopify_fulfillment_events_select_authorized on public.shopify_fulfillment_events
  for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists shopify_fulfillment_event_sync_select_authorized on public.shopify_fulfillment_event_sync_state;
create policy shopify_fulfillment_event_sync_select_authorized on public.shopify_fulfillment_event_sync_state
  for select to authenticated using (private.can_access_org(organization_id));
grant select on public.shopify_fulfillment_events, public.shopify_fulfillment_event_sync_state to authenticated;
grant all on public.shopify_fulfillment_events, public.shopify_fulfillment_event_sync_state to service_role;

drop function if exists public.shopify_delivery_diagnostics(uuid, timestamptz, timestamptz, uuid);
create function public.shopify_delivery_diagnostics(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  tracking_company text,
  location_id uuid,
  location_name text,
  destination_country_code text,
  destination_region_code text,
  fulfillments bigint,
  sample_reliable boolean,
  delivered bigint,
  pending bigint,
  with_estimate bigint,
  delivered_with_estimate bigint,
  late_deliveries bigint,
  late_rate_pct numeric,
  overdue_pending bigint,
  with_tracking bigint,
  invalid_timestamp_order bigint,
  median_hours_to_fulfillment_created numeric,
  p90_hours_to_fulfillment_created numeric,
  median_days_from_fulfillment_created_to_delivery numeric,
  p90_days_from_fulfillment_created_to_delivery numeric,
  events_synced bigint,
  event_sync_partial bigint,
  event_sync_failed bigint,
  fulfillments_with_events bigint,
  event_coverage_pct numeric,
  customs_hold_fulfillments bigint,
  delivery_attempt_fulfillments bigint,
  delayed_fulfillments bigint,
  failed_fulfillments bigint,
  unknown_reason_fulfillments bigint,
  pickup_event_coverage text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with scoped as (
    select
      f.id,
      lower(nullif(btrim(f.tracking_company), '')) as normalized_company,
      f.location_id,
      l.name as location_name,
      nullif(upper(btrim(o.shipping_country_code)), '') as destination_country_code,
      nullif(upper(btrim(o.shipping_region_code)), '') as destination_region_code,
      f.external_created_at as fulfillment_created_at,
      f.delivered_at,
      f.estimated_delivery_at,
      f.display_status,
      f.tracking_numbers,
      coalesce(o.processed_at, o.external_created_at) as ordered_at
    from public.shopify_fulfillments f
    join public.shopify_order_facts o on o.id = f.order_id
      and o.organization_id = f.organization_id and o.store_id = f.store_id
    left join public.shopify_locations l on l.id = f.location_id
      and l.organization_id = target_organization_id and l.store_id = f.store_id
    where f.organization_id = target_organization_id
      and (target_store_id is null or f.store_id = target_store_id)
      and (period_start is null or f.external_created_at >= period_start)
      and f.external_created_at <= period_end
  ),
  per_fulfillment_events as (
    select
      ev.fulfillment_id,
      count(*)::bigint as event_count,
      count(*) filter (where ev.reason_code = 'customs_hold')::bigint as customs_events,
      count(*) filter (where ev.reason_code = 'delivery_attempt')::bigint as attempted_events,
      count(*) filter (where ev.reason_code = 'carrier_delay')::bigint as delay_events,
      count(*) filter (where ev.reason_code = 'carrier_failure')::bigint as failure_events,
      count(*) filter (where ev.reason_code = 'unknown')::bigint as unknown_events
    from public.shopify_fulfillment_events ev
    where ev.organization_id = target_organization_id
      and (target_store_id is null or ev.store_id = target_store_id)
    group by ev.fulfillment_id
  ),
  enriched as (
    select
      s.*,
      st.status as event_sync_status,
      coalesce(pe.event_count, 0)::bigint as event_count,
      coalesce(pe.customs_events, 0)::bigint as customs_events,
      coalesce(pe.attempted_events, 0)::bigint as attempted_events,
      coalesce(pe.delay_events, 0)::bigint as delay_events,
      coalesce(pe.failure_events, 0)::bigint as failure_events,
      coalesce(pe.unknown_events, 0)::bigint as unknown_events
    from scoped s
    left join public.shopify_fulfillment_event_sync_state st
      on st.fulfillment_id = s.id and st.organization_id = target_organization_id
    left join per_fulfillment_events pe on pe.fulfillment_id = s.id
  )
  select
    coalesce(e.normalized_company, 'unknown')::text as tracking_company,
    e.location_id,
    e.location_name::text,
    e.destination_country_code::text,
    e.destination_region_code::text,
    count(*)::bigint as fulfillments,
    count(*) >= 30 as sample_reliable,
    count(*) filter (where e.delivered_at is not null)::bigint as delivered,
    count(*) filter (where e.delivered_at is null)::bigint as pending,
    count(*) filter (where e.estimated_delivery_at is not null)::bigint as with_estimate,
    count(*) filter (where e.delivered_at is not null and e.estimated_delivery_at is not null)::bigint as delivered_with_estimate,
    count(*) filter (where e.delivered_at > e.estimated_delivery_at and e.estimated_delivery_at is not null)::bigint as late_deliveries,
    case when count(*) filter (where e.delivered_at is not null and e.estimated_delivery_at is not null) > 0
      then round(100.0 * count(*) filter (where e.delivered_at > e.estimated_delivery_at and e.estimated_delivery_at is not null)
        / count(*) filter (where e.delivered_at is not null and e.estimated_delivery_at is not null), 1)
      else null end as late_rate_pct,
    count(*) filter (where e.delivered_at is null and e.estimated_delivery_at < now())::bigint as overdue_pending,
    count(*) filter (where cardinality(e.tracking_numbers) > 0)::bigint as with_tracking,
    count(*) filter (
      where (e.ordered_at is not null and e.fulfillment_created_at < e.ordered_at)
        or (e.delivered_at is not null and e.delivered_at < e.fulfillment_created_at)
    )::bigint as invalid_timestamp_order,
    round((percentile_cont(0.5) within group (order by extract(epoch from (e.fulfillment_created_at - e.ordered_at)) / 3600)
      filter (where e.fulfillment_created_at is not null and e.ordered_at is not null and e.fulfillment_created_at >= e.ordered_at))::numeric, 1) as median_hours_to_fulfillment_created,
    round((percentile_cont(0.9) within group (order by extract(epoch from (e.fulfillment_created_at - e.ordered_at)) / 3600)
      filter (where e.fulfillment_created_at is not null and e.ordered_at is not null and e.fulfillment_created_at >= e.ordered_at))::numeric, 1) as p90_hours_to_fulfillment_created,
    round((percentile_cont(0.5) within group (order by extract(epoch from (e.delivered_at - e.fulfillment_created_at)) / 86400)
      filter (where e.delivered_at is not null and e.fulfillment_created_at is not null and e.delivered_at >= e.fulfillment_created_at))::numeric, 1) as median_days_from_fulfillment_created_to_delivery,
    round((percentile_cont(0.9) within group (order by extract(epoch from (e.delivered_at - e.fulfillment_created_at)) / 86400)
      filter (where e.delivered_at is not null and e.fulfillment_created_at is not null and e.delivered_at >= e.fulfillment_created_at))::numeric, 1) as p90_days_from_fulfillment_created_to_delivery,
    count(*) filter (where e.event_sync_status = 'complete')::bigint as events_synced,
    count(*) filter (where e.event_sync_status = 'partial')::bigint as event_sync_partial,
    count(*) filter (where e.event_sync_status = 'failed')::bigint as event_sync_failed,
    count(*) filter (where e.event_count > 0)::bigint as fulfillments_with_events,
    case when count(*) > 0 then round(100.0 * count(*) filter (where e.event_sync_status = 'complete') / count(*), 1) else null end as event_coverage_pct,
    count(*) filter (where e.customs_events > 0)::bigint as customs_hold_fulfillments,
    count(*) filter (where e.attempted_events > 0)::bigint as delivery_attempt_fulfillments,
    count(*) filter (where e.delay_events > 0)::bigint as delayed_fulfillments,
    count(*) filter (where e.failure_events > 0)::bigint as failed_fulfillments,
    count(*) filter (where e.unknown_events > 0)::bigint as unknown_reason_fulfillments,
    case when count(*) filter (where e.event_sync_status = 'complete') > 0
      then 'available'::text else 'unavailable_or_not_yet_synced'::text end as pickup_event_coverage
  from enriched e
  group by coalesce(e.normalized_company, 'unknown'), e.location_id, e.location_name,
    e.destination_country_code, e.destination_region_code
  order by count(*) filter (where e.delivered_at is null and e.estimated_delivery_at < now()) desc, count(*) desc
  limit 50;
$function$;

revoke execute on function public.shopify_delivery_diagnostics(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.shopify_delivery_diagnostics(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;
comment on function public.shopify_delivery_diagnostics(uuid, timestamptz, timestamptz, uuid) is
  'A22 store-scoped shipping diagnostics by carrier, fulfillment origin and coarse destination. The return is read-only and suppresses no groups, but comparisons/recommendations are permitted only for groups with at least 30 fulfillments and visible ETA/event coverage. Explicit normalized tracking events support exception labels; raw event text, addresses and tracking numbers are never returned.';

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a22_postventa_shopify_system',
  'v4',
  $$1. ROLE
Eres el agente de entrega y devoluciones de E-NORA. Diagnosticas una tienda y el periodo indicado; no ejecutas cambios externos.

2. GOAL
Localizar con evidencia si el tiempo se pierde en preparación, transporte o una excepción explícita, y proponer el siguiente trabajo comprobable.

3. CONTEXT
La tienda/periodo son autoritativos. Hay tiempos de pedidos/fulfillments, ETA, transportista, ubicación de preparación y, cuando se sincronizan, eventos normalizados de seguimiento. Nunca recibes dirección, tracking ni texto original del carrier.

4. INPUT
Consulta una vez `shopify_delivery_diagnostics`. Usa el periodo y el ámbito de tienda provistos. `search_knowledge` solo aporta acuerdos y metodología.

5. RULES / CONSTRAINTS
- Pedido→creación del fulfillment estima preparación; creación→entrega NO demuestra cuándo recogió el paquete el transportista.
- `sample_reliable` requiere 30 fulfillments por combinación transportista/origen/destino. Bajo ese umbral solo describe conteos, nunca clasifiques al carrier como peor ni propongas cambiarlo. Comparar destinos y ETA/cobertura; no atribuir diferencias a causa si las rutas no son equivalentes.
- Una tardanza confirmada exige ETA y entrega posterior. Un envío abierto con ETA vencida es pendiente vencido, no entrega tarde confirmada. Sin ETA, declara la promesa desconocida.
- `event_coverage_pct` es el porcentaje de fulfillments del grupo con lectura completa de sus eventos; `event_sync_partial`/`event_sync_failed` no equivalen a ausencia de incidencias. Si la cobertura no es 100%, un evento ausente no demuestra que no hubo problema.
- Solo denomina aduanas/dirección fallida/intento de entrega si el evento ofrece un código explícito (`customs_hold`, `address_issue`, `delivery_attempt`). `carrier_delay`/`carrier_failure` indica lo comunicado por tracking; no prueba culpa legal del operador. `unknown_reason_fulfillments` se mantiene como motivo desconocido.
- Datos normalizados descartan dirección, tracking y texto del evento. No intentes reconstruirlos ni pedir PII. Si un código no alcanza, reporta excepción sin causa confirmada.
- Varias filas pueden corresponder a varios fulfillments del mismo pedido. Distingue siempre bultos/envíos de pedidos y compradores.
- La tasa de tardanzas usa entregas con ETA como denominador; el percentil de preparación/tránsito usa solo cronologías válidas. Si el denominador es cero, el resultado es desconocido, no cero.
- Tareas con `rationale`, pasos y criterio de éxito; revisa trabajo abierto, coordina con A20/A21 y A19. Nunca cambies carrier, reembolses, promesas ni contactes compradores automáticamente.

6. TOOLS
- `shopify_delivery_diagnostics`: resumen cuantitativo read-only por transportista/origen/destino, cobertura, volumen y excepciones explícitas.
- `search_knowledge`: acuerdos y metodología logística, si existen.

7. OUTPUT
Devuelve `answer`, `findings`, `recommendations`, `proposed_writes`, `sources`, `confidence`, `warnings`. Máximo cuatro tareas; cada hallazgo incluye periodo, tienda, denominador, cobertura y fuente. Si no hay acción defendible, no propongas una tarea.

8. FAILURE BEHAVIOUR
Fallo RPC, conexión ausente, sync/cobertura desconocida, muestra pequeña y evento sin clasificar deben expresarse como desconocido/no concluyente según el caso. Nunca conviertas error/null/ausencia en cero.

9. EXAMPLES
Bueno: «23 de 30 envíos tienen eventos completos; 2 reportan retraso, pero la cobertura parcial impide inferir que solo ocurrieron dos incidencias. La primera acción es completar la sincronización».
Malo: «Este transportista retiene paquetes en aduanas» deducido por país, duración larga o falta de eventos.$$,
  encode(sha256('a22_postventa_shopify_system_v4'::bytea), 'hex')
)
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

insert into public.agent_versions as existing_version
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v4', v.model, 'a22_postventa_shopify_system', 'v4',
  v.allowed_tools, v.approval_mode, v.output_schema_version, v.config, v.is_active
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a22_postventa_shopify' and v.version = 'v3'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    config = excluded.config,
    is_active = existing_version.is_active or excluded.is_active;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.version <> 'v4'
  and av.definition_id = (select id from public.agent_definitions where code = 'a22_postventa_shopify');
