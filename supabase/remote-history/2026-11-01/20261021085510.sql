-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A22: store-scoped evidence, coordination with the shared A20/A21 ledger,
-- and an explicit operating contract for cases versus recurring patterns.

create index if not exists shopify_delivery_exceptions_store_queue_idx
  on public.shopify_delivery_exceptions (organization_id, store_id, status, episode_started_at)
  where status = 'open';

create index if not exists shopify_fulfillment_events_store_time_idx
  on public.shopify_fulfillment_events (organization_id, store_id, happened_at desc);

alter table public.shopify_return_line_items
  add column if not exists processed_quantity integer not null default 0
  check (processed_quantity >= 0);

-- Report processed units from closed return workflows. Requested, open,
-- declined and canceled return quantities are not counted as returned units.
-- A closed process still does not prove a physical parcel was received.
create or replace function public.shopify_return_rate_by_product(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid,
  result_limit integer default 20
)
returns table (
  product_id uuid, title text, units_sold bigint, units_returned bigint,
  return_rate numeric, revenue numeric, refunded_amount numeric,
  top_return_reason text, lines_with_exact_metrics bigint,
  lines_with_estimated_metrics bigint, lines_without_metrics bigint
)
language sql stable set search_path = 'pg_catalog', 'public' as $$
  with sold as (
    select i.id item_id, i.product_id, i.title, i.quantity_original,
      i.net_revenue, i.net_metrics_source, i.refunded_amount
    from public.shopify_order_items i
    join public.shopify_order_facts o on o.id = i.order_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ), returned as (
    select r.order_item_id, sum(r.processed_quantity)::bigint units,
      mode() within group (order by r.return_reason) reason
    from public.shopify_return_line_items r
    join public.shopify_returns ret on ret.id = r.return_id
    join sold on sold.item_id = r.order_item_id
    where r.organization_id = target_organization_id
      and (target_store_id is null or ret.store_id = target_store_id)
      and ret.status = 'CLOSED'
      and r.processed_quantity > 0
    group by r.order_item_id
  )
  select sold.product_id, min(sold.title)::text,
    coalesce(sum(sold.quantity_original), 0)::bigint,
    coalesce(sum(returned.units), 0)::bigint,
    round(coalesce(sum(returned.units), 0)::numeric / nullif(sum(sold.quantity_original), 0), 4),
    coalesce(sum(sold.net_revenue), 0), coalesce(sum(sold.refunded_amount), 0),
    mode() within group (order by returned.reason),
    count(*) filter (where sold.net_metrics_source = 'shopify_graphql_exact')::bigint,
    count(*) filter (where sold.net_metrics_source = 'shopify_rest_estimate')::bigint,
    count(*) filter (where sold.net_metrics_source is null)::bigint
  from sold left join returned on returned.order_item_id = sold.item_id
  where sold.product_id is not null
  group by sold.product_id
  order by 4 desc, 6 desc limit greatest(1, least(coalesce(result_limit, 20), 100));
$$;

grant execute on function public.shopify_return_rate_by_product(uuid, timestamptz, timestamptz, uuid, integer)
  to authenticated, service_role;
revoke execute on function public.shopify_return_rate_by_product(uuid, timestamptz, timestamptz, uuid, integer)
  from public, anon;

-- RLS currently grants organization-wide visibility. Add restrictive exact-store
-- guards while retaining each table's existing membership policy.
do $a22_store_rls$
begin
  if to_regclass('public.shopify_fulfillments') is not null then
    drop policy if exists a22_store_scope_guard on public.shopify_fulfillments;
    create policy a22_store_scope_guard on public.shopify_fulfillments
      as restrictive for select to authenticated
      using (private.can_access_agent_store_scope(organization_id, store_id));
  end if;
  if to_regclass('public.shopify_fulfillment_events') is not null then
    drop policy if exists a22_store_scope_guard on public.shopify_fulfillment_events;
    create policy a22_store_scope_guard on public.shopify_fulfillment_events
      as restrictive for select to authenticated
      using (private.can_access_agent_store_scope(organization_id, store_id));
  end if;
  if to_regclass('public.shopify_fulfillment_event_sync_state') is not null then
    drop policy if exists a22_store_scope_guard on public.shopify_fulfillment_event_sync_state;
    create policy a22_store_scope_guard on public.shopify_fulfillment_event_sync_state
      as restrictive for select to authenticated
      using (private.can_access_agent_store_scope(organization_id, store_id));
  end if;
  if to_regclass('public.shopify_delivery_exceptions') is not null then
    drop policy if exists a22_store_scope_guard on public.shopify_delivery_exceptions;
    create policy a22_store_scope_guard on public.shopify_delivery_exceptions
      as restrictive for select to authenticated
      using (private.can_access_agent_store_scope(organization_id, store_id));
  end if;
  if to_regclass('public.shopify_returns') is not null then
    drop policy if exists a22_store_scope_guard on public.shopify_returns;
    create policy a22_store_scope_guard on public.shopify_returns
      as restrictive for select to authenticated
      using (private.can_access_agent_store_scope(organization_id, store_id));
  end if;
  if to_regclass('public.shopify_return_line_items') is not null then
    drop policy if exists a22_store_scope_guard on public.shopify_return_line_items;
    create policy a22_store_scope_guard on public.shopify_return_line_items
      as restrictive for select to authenticated
      using (exists (
        select 1 from public.shopify_returns r
        where r.id = return_id and r.organization_id = shopify_return_line_items.organization_id
          and private.can_access_agent_store_scope(r.organization_id, r.store_id)
      ));
  end if;
end
$a22_store_rls$;

-- Make the A20/A21 request and receipt ledger visible to A22 on the same store.
create or replace function public.retention_coordination_context(
  p_organization_id uuid, p_store_id uuid, p_agent_code text
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'requests', coalesce(jsonb_agg(x order by x.created_at), '[]'::jsonb),
    'scope', 'selected_store'
  )
  from (
    select o.id opportunity_id, o.source_agent_code, o.status, o.task_id, o.brief,
      o.review_due_at, o.outcome, o.created_at, h.id handoff_id,
      h.status handoff_status, h.position,
      (select jsonb_agg(jsonb_build_object(
        'agent', prev.agent_code, 'status', prev.status, 'output_id', prev.delivered_output_id
      ) order by prev.position) from public.retention_handoffs prev
       where prev.opportunity_id = o.id) dependencies
    from public.retention_opportunities o
    left join public.retention_handoffs h
      on h.opportunity_id = o.id and h.agent_code = p_agent_code
    where o.organization_id = p_organization_id and o.store_id = p_store_id
      and o.status in ('proposed', 'accepted', 'in_progress', 'measuring', 'evaluated')
      and (h.id is not null or p_agent_code in (
        'a19_arquitecto_camino', 'a19_revision_camino', 'a20_retencion_clientes',
        'a21_adquisicion_shopify', 'a22_postventa_shopify', 'a04_generador_tareas',
        'a17_plan_semanal', 'a18_plan_mensual'
      ))
    order by o.updated_at desc limit 80
  ) x;
$$;

revoke all on function public.retention_coordination_context(uuid, uuid, text) from public, anon;
grant execute on function public.retention_coordination_context(uuid, uuid, text) to authenticated, service_role;

do $a22_prompt$
declare
  previous_content text;
  appended text := E'\n\n13. FUNCIÃ“N OPERATIVA Y COORDINACIÃ“N\n- A22 cubre dos trabajos distintos: revisar casos identificables que necesitan una decisiÃ³n operativa ahora y detectar patrones repetidos por transportista, origen, destino o etapa. Presenta primero los casos urgentes; separa despuÃ©s los patrones. No confundas una alerta individual con una tendencia.\n- El snapshot, la cobertura de sincronizaciÃ³n, la fecha de corte, las ventanas comparables y el denominador especÃ­fico son evidencia principal. Error, falta de filas, ausencia de ETA o evento no equivalen a cero ni a ausencia de problema. No infieras causalidad. Requiere una muestra pertinente suficiente para cada mÃ©trica, no el total de envÃ­os de un grupo como sustituto.\n- Distingue creaciÃ³n del fulfillment, recogida fÃ­sica confirmada por evento, trÃ¡nsito, entrega y devoluciÃ³n solicitada/procesada/cerrada. Un estado de devoluciÃ³n no demuestra reembolso ni recepciÃ³n fÃ­sica. Informa seguimiento incompleto, paginaciÃ³n o truncamiento.\n- Los porcentajes del clasificador son coincidencias de reglas, no probabilidades calibradas ni confianza de que el transportista sea responsable. Si un mensaje niega o da por resuelta la incidencia, no lo clasifiques como abierta. No solicites ni repitas mensajes brutos, tracking, direcciÃ³n o datos del comprador.\n- Usa solo el Mi Camino, revisiÃ³n y hito activos recibidos para la misma tienda. Cuando el caso afecte a email, ads, calendario o retenciÃ³n, comparte una solicitud concreta con el ledger comÃºn y dirige el entregable al agente adecuado; conserva su ID, dependencia y recibo. Si no hay iniciativa aprobada relacionada, recomienda revisiÃ³n humana y no inventes alineaciÃ³n.\n- PropÃ³n tareas con caso o grupo, periodo, evidencia, cobertura, responsable, siguiente paso y seÃ±al para cerrar/revisar. MantÃ©n una identidad estable y no dupliques oportunidades aceptadas o en curso. La propuesta requiere aprobaciÃ³n humana. No contactes compradores, transportistas ni publiques, envÃ­es, reembolses o cambies transportista automÃ¡ticamente.\n- Al revisar una intervenciÃ³n, mide el antes y despuÃ©s con cohortes y madurez comparables. Informa asociaciÃ³n observada, limitaciones y guardrails; no atribuyas el cambio a A22 ni a una campaÃ±a sin diseÃ±o que permita causalidad.';
begin
  select content into previous_content from public.prompt_versions
  where code = 'a22_postventa_shopify_system' and version = 'v7';
  if previous_content is null then raise exception 'A22 v7 canonical prompt is missing'; end if;
  insert into public.prompt_versions(code, version, content, checksum)
  values ('a22_postventa_shopify_system', 'v8', previous_content || appended,
    encode(sha256((previous_content || appended)::bytea), 'hex'))
  on conflict (code, version) do update
    set content = excluded.content, checksum = excluded.checksum;

  insert into public.agent_versions as existing_version
    (definition_id, version, model, prompt_code, prompt_version, allowed_tools,
     approval_mode, output_schema_version, config, is_active)
  select v.definition_id, 'v8', v.model, 'a22_postventa_shopify_system', 'v8',
    v.allowed_tools, v.approval_mode, v.output_schema_version, v.config, true
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where d.code = 'a22_postventa_shopify' and v.version = 'v7'
  on conflict (definition_id, version) do update
    set prompt_code = excluded.prompt_code, prompt_version = excluded.prompt_version,
        allowed_tools = excluded.allowed_tools, config = excluded.config, is_active = true;

  update public.agent_versions av set is_active = false
  where av.is_active and av.version <> 'v8'
    and av.definition_id = (select id from public.agent_definitions where code = 'a22_postventa_shopify');
end
$a22_prompt$;


