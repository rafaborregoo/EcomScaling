-- Active delivery exceptions are deduplicated per fulfillment + reason.
-- Only normalized evidence is stored; Shopify messages, addresses and tracking
-- numbers are deliberately excluded.
create table if not exists public.shopify_delivery_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  fulfillment_id uuid not null references public.shopify_fulfillments(id) on delete cascade,
  exception_type varchar(40) not null check (exception_type in (
    'eta_overdue','customs_hold','address_issue','delivery_attempt','carrier_delay','carrier_failure'
  )),
  status varchar(16) not null default 'open' check (status in ('open','resolved')),
  episode_started_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  latest_event_id varchar(255),
  latest_event_at timestamptz,
  latest_event_status varchar(40),
  reason_confidence numeric(4,3) not null default 0 check (reason_confidence between 0 and 1),
  likely_area varchar(32) not null check (likely_area in ('carrier_or_customs','merchant_fulfillment','unknown')),
  next_action_code varchar(48) not null check (next_action_code in (
    'investigate_overdue_shipment','verify_customs_documentation','verify_address_with_customer',
    'confirm_delivery_attempt','review_carrier_eta','escalate_carrier'
  )),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shopify_delivery_exceptions_open_once_idx
  on public.shopify_delivery_exceptions (store_id, fulfillment_id, exception_type)
  where status = 'open';
create index if not exists shopify_delivery_exceptions_scope_status_idx
  on public.shopify_delivery_exceptions (organization_id, store_id, status, last_observed_at desc);

alter table public.shopify_delivery_exceptions enable row level security;
drop policy if exists shopify_delivery_exceptions_select_authorized on public.shopify_delivery_exceptions;
create policy shopify_delivery_exceptions_select_authorized on public.shopify_delivery_exceptions
  for select to authenticated using (private.can_access_org(organization_id));
grant select on public.shopify_delivery_exceptions to authenticated;
grant all on public.shopify_delivery_exceptions to service_role;

create or replace function public.refresh_shopify_delivery_exception(
  p_organization_id uuid,
  p_store_id uuid,
  p_fulfillment_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_delivered_at timestamptz;
  v_estimated_delivery_at timestamptz;
  v_event_sync_status text;
  v_latest_event_id text;
  v_latest_event_at timestamptz;
  v_latest_event_status text;
  v_latest_reason text;
  v_latest_confidence numeric;
  v_has_latest_event boolean := false;
begin
  select f.delivered_at, f.estimated_delivery_at
    into v_delivered_at, v_estimated_delivery_at
  from public.shopify_fulfillments f
  where f.id = p_fulfillment_id
    and f.organization_id = p_organization_id
    and f.store_id = p_store_id;
  if not found then
    raise exception 'fulfillment_scope_not_found';
  end if;

  select s.status::text into v_event_sync_status
  from public.shopify_fulfillment_event_sync_state s
  where s.fulfillment_id = p_fulfillment_id
    and s.organization_id = p_organization_id
    and s.store_id = p_store_id;

  -- ETA overdue is a deterministic signal and closes immediately once the
  -- shipment is delivered or the ETA is no longer in the past.
  if v_delivered_at is null and v_estimated_delivery_at < now() then
    insert into public.shopify_delivery_exceptions (
      organization_id, store_id, fulfillment_id, exception_type, reason_confidence,
      likely_area, next_action_code, last_observed_at, resolved_at
    ) values (
      p_organization_id, p_store_id, p_fulfillment_id, 'eta_overdue', 1,
      'unknown', 'investigate_overdue_shipment', now(), null
    )
    on conflict (store_id, fulfillment_id, exception_type) where status = 'open'
    do update set last_observed_at = excluded.last_observed_at,
      reason_confidence = excluded.reason_confidence,
      next_action_code = excluded.next_action_code,
      updated_at = now();
  else
    update public.shopify_delivery_exceptions e
    set status = 'resolved', resolved_at = now(), last_observed_at = now(), updated_at = now()
    where e.organization_id = p_organization_id and e.store_id = p_store_id
      and e.fulfillment_id = p_fulfillment_id and e.exception_type = 'eta_overdue'
      and e.status = 'open';
  end if;

  -- The fulfillment itself is authoritative evidence of delivery even when
  -- the optional events scope is missing or a tracking read failed.
  if v_delivered_at is not null then
    update public.shopify_delivery_exceptions e
    set status = 'resolved', resolved_at = now(), last_observed_at = now(), updated_at = now()
    where e.organization_id = p_organization_id and e.store_id = p_store_id
      and e.fulfillment_id = p_fulfillment_id and e.status = 'open';
  end if;

  -- Event-derived exceptions are only reconciled after a complete event read;
  -- a failed or partial Shopify page must not erase a previously observed issue.
  -- Since Shopify has no universal "issue resolved" event, only delivery is
  -- treated as a reliable resolution; a later generic transit event is not.
  if v_event_sync_status = 'complete' then
    select ev.external_event_id, ev.happened_at, ev.status, ev.reason_code, ev.reason_confidence
      into v_latest_event_id, v_latest_event_at, v_latest_event_status, v_latest_reason, v_latest_confidence
    from public.shopify_fulfillment_events ev
    where ev.organization_id = p_organization_id and ev.store_id = p_store_id
      and ev.fulfillment_id = p_fulfillment_id
    order by ev.happened_at desc, ev.external_event_id desc
    limit 1;
    v_has_latest_event := found;

    if v_delivered_at is not null then
      update public.shopify_delivery_exceptions e
      set status = 'resolved', resolved_at = now(), last_observed_at = now(), updated_at = now()
      where e.organization_id = p_organization_id and e.store_id = p_store_id
        and e.fulfillment_id = p_fulfillment_id and e.exception_type <> 'eta_overdue'
        and e.status = 'open';
    elsif v_has_latest_event and v_latest_reason in (
      'customs_hold','address_issue','delivery_attempt','carrier_delay','carrier_failure'
    ) then
      insert into public.shopify_delivery_exceptions (
        organization_id, store_id, fulfillment_id, exception_type, latest_event_id,
        latest_event_at, latest_event_status, reason_confidence, likely_area,
        next_action_code, last_observed_at, resolved_at
      )
      select p_organization_id, p_store_id, p_fulfillment_id, v_latest_reason,
        v_latest_event_id, v_latest_event_at, v_latest_event_status,
        v_latest_confidence, 'carrier_or_customs',
        case v_latest_reason
          when 'customs_hold' then 'verify_customs_documentation'
          when 'address_issue' then 'verify_address_with_customer'
          when 'delivery_attempt' then 'confirm_delivery_attempt'
          when 'carrier_delay' then 'review_carrier_eta'
          else 'escalate_carrier'
        end,
        now(), null
      where v_latest_reason in (
        'customs_hold','address_issue','delivery_attempt','carrier_delay','carrier_failure'
      )
      on conflict (store_id, fulfillment_id, exception_type) where status = 'open'
      do update set latest_event_id = excluded.latest_event_id,
        latest_event_at = excluded.latest_event_at,
        latest_event_status = excluded.latest_event_status,
        reason_confidence = excluded.reason_confidence,
        next_action_code = excluded.next_action_code,
        last_observed_at = excluded.last_observed_at,
        updated_at = now();
    end if;
  end if;
end;
$function$;

revoke all on function public.refresh_shopify_delivery_exception(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.refresh_shopify_delivery_exception(uuid, uuid, uuid) to service_role;

drop function if exists public.shopify_open_delivery_exceptions(uuid, uuid, integer);

create or replace function public.shopify_open_delivery_exceptions(
  target_organization_id uuid,
  target_store_id uuid,
  result_limit integer default 50
)
returns table (
  shipment_ref text,
  tracking_company text,
  exception_type text,
  reason_confidence numeric,
  likely_area text,
  next_action_code text,
  opened_at timestamptz,
  age_hours numeric,
  latest_event_at timestamptz,
  latest_event_status text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    left(md5(e.fulfillment_id::text || e.store_id::text), 10) as shipment_ref,
    coalesce(nullif(btrim(f.tracking_company), ''), 'unknown')::text as tracking_company,
    e.exception_type::text,
    e.reason_confidence,
    e.likely_area::text,
    e.next_action_code::text,
    e.episode_started_at,
    round((extract(epoch from (now() - e.episode_started_at)) / 3600)::numeric, 1) as age_hours,
    e.latest_event_at,
    e.latest_event_status::text
  from public.shopify_delivery_exceptions e
  join public.shopify_fulfillments f on f.id = e.fulfillment_id
    and f.organization_id = target_organization_id
    and (target_store_id is null or f.store_id = target_store_id)
  where e.organization_id = target_organization_id
    and (target_store_id is null or e.store_id = target_store_id)
    and e.status = 'open'
  order by e.episode_started_at asc, e.id
  limit greatest(1, least(coalesce(result_limit, 50), 50));
$function$;

revoke all on function public.shopify_open_delivery_exceptions(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.shopify_open_delivery_exceptions(uuid, uuid, integer) to service_role;

insert into public.prompt_versions (code, version, content, checksum)
select p.code, 'v5', p.content || E'\n\n10. DELIVERY EXCEPTION QUEUE\n- Consulta `shopify_open_delivery_exceptions` para envíos que requieren seguimiento inmediato; la lista es limitada a 50, por tienda y sin datos personales.\n- Prioriza por antigüedad, tipo de incidencia y acción operativa; referencia de envío seudónima solo para deduplicar/coordinar, nunca la presentes como número de pedido.\n- Distingue ETA vencida (riesgo/pendiente observado) de una entrega tardía confirmada. Un evento explícito respalda el motivo comunicado, no la culpa contractual del carrier ni una causalidad sobre devoluciones.\n- `likely_area` solo sugiere dónde investigar. Si falta un motivo, cobertura o seguimiento, decláralo desconocido. No pidas al agente ni a la tool que reconstruya PII.\n- Las incidencias abiertas se deduplican por fulfillment y tipo; la entrega confirmada cierra los episodios. No cierres uno por un evento genérico de tránsito ni propongas contactar, reembolsar o cambiar transportista automáticamente.',
  encode(sha256((p.content || E'\n\n10. DELIVERY EXCEPTION QUEUE\n- Consulta `shopify_open_delivery_exceptions` para envíos que requieren seguimiento inmediato; la lista es limitada a 50, por tienda y sin datos personales.\n- Prioriza por antigüedad, tipo de incidencia y acción operativa; referencia de envío seudónima solo para deduplicar/coordinar, nunca la presentes como número de pedido.\n- Distingue ETA vencida (riesgo/pendiente observado) de una entrega tardía confirmada. Un evento explícito respalda el motivo comunicado, no la culpa contractual del carrier ni una causalidad sobre devoluciones.\n- `likely_area` solo sugiere dónde investigar. Si falta un motivo, cobertura o seguimiento, decláralo desconocido. No pidas al agente ni a la tool que reconstruya PII.\n- Las incidencias abiertas se deduplican por fulfillment y tipo; la entrega confirmada cierra los episodios. No cierres uno por un evento genérico de tránsito ni propongas contactar, reembolsar o cambiar transportista automáticamente.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a22_postventa_shopify_system' and p.version = 'v4'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

insert into public.agent_versions as existing_version
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v5', v.model, 'a22_postventa_shopify_system', 'v5',
  (
    select coalesce(jsonb_agg(x.tool_name order by x.tool_name), '[]'::jsonb)
    from (
      select distinct tool_name
      from jsonb_array_elements_text(
        coalesce(v.allowed_tools, '[]'::jsonb) || jsonb_build_array('shopify_open_delivery_exceptions')
      ) as allowed(tool_name)
    ) x
  ),
  v.approval_mode, v.output_schema_version, v.config, v.is_active
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a22_postventa_shopify' and v.version = 'v4'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    config = excluded.config,
    is_active = existing_version.is_active or excluded.is_active;

update public.agent_versions av
set is_active = false
where av.is_active and av.version <> 'v5'
  and av.definition_id = (select id from public.agent_definitions where code = 'a22_postventa_shopify');
