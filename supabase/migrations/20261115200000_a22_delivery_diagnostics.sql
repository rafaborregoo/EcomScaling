-- A22: delivery diagnostics with stage names that match the timestamps we
-- actually have. Shopify fulfillment creation is not proof of carrier pickup.
create index if not exists shopify_fulfillments_store_created_idx
  on public.shopify_fulfillments (organization_id, store_id, external_created_at desc);

drop function if exists public.shopify_delivery_diagnostics(uuid, timestamptz, timestamptz, uuid);

create or replace function public.shopify_delivery_diagnostics(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  tracking_company text,
  location_id uuid,
  location_name text,
  fulfillments bigint,
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
  pickup_event_coverage text
)
language sql
stable
set search_path = pg_catalog, public
as $function$
  with scoped as (
    select
      f.id,
      lower(nullif(btrim(f.tracking_company), '')) as normalized_company,
      f.location_id,
      l.name as location_name,
      f.external_created_at as fulfillment_created_at,
      f.delivered_at,
      f.estimated_delivery_at,
      f.display_status,
      f.tracking_numbers,
      coalesce(o.processed_at, o.external_created_at) as ordered_at
    from public.shopify_fulfillments f
    join public.shopify_order_facts o on o.id = f.order_id
    left join public.shopify_locations l on l.id = f.location_id
      and l.organization_id = target_organization_id
      and l.store_id = f.store_id
    where f.organization_id = target_organization_id
      and (target_store_id is null or f.store_id = target_store_id)
      and (period_start is null or f.external_created_at >= period_start)
      and f.external_created_at <= period_end
  )
  select
    coalesce(s.normalized_company, 'unknown')::text as tracking_company,
    s.location_id,
    s.location_name::text,
    count(*)::bigint as fulfillments,
    count(*) filter (where s.delivered_at is not null)::bigint as delivered,
    count(*) filter (where s.delivered_at is null)::bigint as pending,
    count(*) filter (where s.estimated_delivery_at is not null)::bigint as with_estimate,
    count(*) filter (where s.delivered_at is not null and s.estimated_delivery_at is not null)::bigint as delivered_with_estimate,
    count(*) filter (where s.delivered_at > s.estimated_delivery_at and s.estimated_delivery_at is not null)::bigint as late_deliveries,
    case when count(*) filter (where s.delivered_at is not null and s.estimated_delivery_at is not null) > 0
      then round(100.0 * count(*) filter (where s.delivered_at > s.estimated_delivery_at and s.estimated_delivery_at is not null)
        / count(*) filter (where s.delivered_at is not null and s.estimated_delivery_at is not null), 1)
      else null end as late_rate_pct,
    count(*) filter (where s.delivered_at is null and s.estimated_delivery_at < now())::bigint as overdue_pending,
    count(*) filter (where cardinality(s.tracking_numbers) > 0)::bigint as with_tracking,
    count(*) filter (
      where (s.ordered_at is not null and s.fulfillment_created_at < s.ordered_at)
        or (s.delivered_at is not null and s.delivered_at < s.fulfillment_created_at)
    )::bigint as invalid_timestamp_order,
    round((percentile_cont(0.5) within group (order by extract(epoch from (s.fulfillment_created_at - s.ordered_at)) / 3600)
      filter (where s.fulfillment_created_at is not null and s.ordered_at is not null and s.fulfillment_created_at >= s.ordered_at))::numeric, 1) as median_hours_to_fulfillment_created,
    round((percentile_cont(0.9) within group (order by extract(epoch from (s.fulfillment_created_at - s.ordered_at)) / 3600)
      filter (where s.fulfillment_created_at is not null and s.ordered_at is not null and s.fulfillment_created_at >= s.ordered_at))::numeric, 1) as p90_hours_to_fulfillment_created,
    round((percentile_cont(0.5) within group (order by extract(epoch from (s.delivered_at - s.fulfillment_created_at)) / 86400)
      filter (where s.delivered_at is not null and s.fulfillment_created_at is not null and s.delivered_at >= s.fulfillment_created_at))::numeric, 1) as median_days_from_fulfillment_created_to_delivery,
    round((percentile_cont(0.9) within group (order by extract(epoch from (s.delivered_at - s.fulfillment_created_at)) / 86400)
      filter (where s.delivered_at is not null and s.fulfillment_created_at is not null and s.delivered_at >= s.fulfillment_created_at))::numeric, 1) as p90_days_from_fulfillment_created_to_delivery,
    'unavailable: Shopify fulfillment events are not synchronized'::text as pickup_event_coverage
  from scoped s
  group by coalesce(s.normalized_company, 'unknown'), s.location_id, s.location_name
  order by count(*) filter (where s.delivered_at is null and s.estimated_delivery_at < now()) desc, count(*) desc
  limit 50;
$function$;

grant execute on function public.shopify_delivery_diagnostics(uuid, timestamptz, timestamptz, uuid) to authenticated;
comment on function public.shopify_delivery_diagnostics(uuid, timestamptz, timestamptz, uuid) is
  'A22 read-only aggregate by store, normalized tracking company and fulfillment location. Times use fulfillment creation and delivered_at only; carrier pickup is explicitly unavailable until Fulfillment.events are synchronized. Late rate denominator is delivered fulfillments with ETA.';

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a22_postventa_shopify_system',
  'v3',
  $$1. ROLE
Eres el agente de entrega y devoluciones de E-NORA. Diagnosticas una tienda y el periodo indicado; no ejecutas cambios externos.

2. GOAL
Localizar si el tiempo se pierde antes de crear el fulfillment o después, comparar transportistas solo con volúmenes y denominadores visibles, y proponer trabajo comprobable.

3. CONTEXT
La tienda/periodo solicitado y su alcance son autoritativos. El contexto incluye devoluciones agregadas y tareas/hitos existentes, pero no contiene horas de recogida del transportista.

4. INPUT
Consulta una vez `shopify_delivery_diagnostics` para el desglose por transportista/ubicación. Lee `search_knowledge` solo para acuerdos y metodología relevantes.

5. RULES / CONSTRAINTS
- `median_hours_to_fulfillment_created` = pedido a creación del fulfillment; es una señal del proceso de preparación, no la hora de salida física.
- `median_days_from_fulfillment_created_to_delivery` = creación del fulfillment a entrega; no equivale con certeza al tránsito del transportista.
- Excluye de percentiles las cronologías imposibles y señala `invalid_timestamp_order`; no ocultes esta limitación de calidad.
- La recogida real por el transportista no está sincronizada: si `pickup_event_coverage` indica unavailable, declara que no puedes separar tiempo de almacén y transporte.
- Una entrega solo es confirmadamente tarde si tiene ETA y timestamp de entrega posterior. La tasa usa únicamente entregas con ETA; si no hay denominador, di que es desconocida. Un envío abierto con ETA vencida es una excepción pendiente, no una entrega tarde confirmada.
- No infieras aduanas, dirección errónea ni culpa del transportista sin un evento explícito. La tabla no incluye datos personales ni números de seguimiento.
- `unknown` como transportista o ubicación null significa dato no identificado, no una compañía/ruta real. No compares ni recomiendes cambiar carrier por medias sin tamaño de muestra y mezcla de rutas comparables.

Cada propuesta explica el impacto de negocio buscado (`rationale`), entrega/pasos concretos (`description`) y cifras, fuente y periodo (`evidence`). Comprueba las tareas abiertas y no dupliques. Diferencia trabajo de preparación, investigación de una excepción y revisión de promesa. No cambies transportista, reembolses, promesas ni contactes compradores automáticamente; toda tarea requiere aprobación.

6. TOOLS
- `shopify_delivery_diagnostics`: fuente cuantitativa agregada, una llamada, read-only y scoped por tienda/periodo.
- `search_knowledge`: acuerdos logísticos y metodología de la tienda, si existen.

7. OUTPUT
Devuelve el contrato estándar `answer`, `findings`, `recommendations`, `proposed_writes`, `sources`, `confidence` y `warnings`. Máximo cuatro tareas. Cada cifra debe incluir alcance/periodo/fuente.

8. FAILURE BEHAVIOUR
Si una tool falla, no hay envíos, ETA, tracking, cobertura suficiente o la sincronización es vieja/desconocida, dilo de forma explícita; null/error nunca es cero y no inventes una causa.

9. EXAMPLES
Bueno: «La preparación tarda 18 h hasta crear el fulfillment; no tenemos el evento de recogida, así que no puedo separar almacén y transporte».
Malo: «El carrier tardó 18 h en recoger el paquete» cuando solo se conoce la hora de creación del fulfillment.$$,
  encode(sha256('a22_postventa_shopify_system_v3'::bytea), 'hex')
)
on conflict (code, version) do nothing;

update public.agent_versions av set is_active = false
from public.agent_definitions d
where av.definition_id = d.id and d.code = 'a22_postventa_shopify' and av.is_active;

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, is_active)
select d.id, 'v3', 'claude-sonnet-5', 'a22_postventa_shopify_system', 'v3',
  '["search_knowledge","shopify_delivery_diagnostics"]'::jsonb,
  'required_before_publish', 'v1', true
from public.agent_definitions d where d.code = 'a22_postventa_shopify'
on conflict (definition_id, version) do update set
  prompt_version = excluded.prompt_version,
  allowed_tools = excluded.allowed_tools,
  is_active = true;
;
