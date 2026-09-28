-- Feed de actividad compartido entre agentes (AI-05/AI-12, orquestacion por
-- contexto). Cada agente se activa en su pagina, pero todos leen el mismo
-- registro de lo que ya paso en cualquier modulo: tareas completadas o
-- descartadas, emails enviados o programados, borradores decididos,
-- propuestas IA aprobadas/rechazadas y cambios de contexto declarados.
--
-- Diseno:
--   * UNA tabla para todos los modulos, no una por modulo: el lector (el
--     evidence-pack de cada agente) necesita la vista cruzada en una consulta,
--     y un modulo nuevo solo anade un trigger, no toca el lector.
--   * Se escribe con triggers sobre las tablas de origen, no desde Node: hay
--     varios caminos que cambian una tarea (UI, API, materializacion de
--     agentes, worker) y ninguno puede olvidarse de emitir.
--   * Idempotente por (source_table, source_id, event_type): re-sincronizar o
--     re-aplicar la migracion no duplica; una transicion repetida (tarea
--     reabierta y completada otra vez) actualiza la fila.
--   * Es historial, no estado: append/upsert por evento, leido por ventana de
--     fecha. No aplica la regla de ADR-0006 contra `DISTINCT ON`.
-- ponytail: sin particionado ni purga; particionar por mes / purgar > 180 dias
-- cuando la tabla pase de decenas de millones de filas.

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  module varchar(24) not null,
  event_type varchar(64) not null,
  summary text not null,
  occurred_at timestamptz not null,
  source_table varchar(64) not null,
  source_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_events_module check (module in ('tasks', 'email', 'ai', 'context')),
  constraint activity_events_type_del_modulo check (event_type like module || '.%'),
  constraint activity_events_summary_corto check (length(summary) between 1 and 600),
  constraint activity_events_origen_unico unique (source_table, source_id, event_type)
);

comment on table public.activity_events is
  'Feed de actividad compartido entre agentes: lo que ya paso en cualquier modulo, para que '
  'ningun agente re-proponga lo hecho, descartado o rechazado. Escrito solo por triggers.';

create index if not exists activity_events_org_time_idx
  on public.activity_events (organization_id, occurred_at desc);

alter table public.activity_events enable row level security;

drop policy if exists "activity_events_select_staff" on public.activity_events;
create policy "activity_events_select_staff" on public.activity_events
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.activity_events to authenticated;

-- ---------------------------------------------------------------------------
-- Emisor comun
-- ---------------------------------------------------------------------------

create or replace function private.emit_activity_event(
  p_organization_id uuid,
  p_store_id uuid,
  p_module text,
  p_event_type text,
  p_summary text,
  p_occurred_at timestamptz,
  p_source_table text,
  p_source_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_events (
    organization_id, store_id, module, event_type, summary, occurred_at,
    source_table, source_id, payload
  ) values (
    p_organization_id, p_store_id, p_module, p_event_type, left(p_summary, 600),
    coalesce(p_occurred_at, now()), p_source_table, p_source_id, coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (source_table, source_id, event_type) do update set
    store_id = excluded.store_id,
    summary = excluded.summary,
    occurred_at = excluded.occurred_at,
    payload = excluded.payload;
$$;

revoke all on function private.emit_activity_event(uuid, uuid, text, text, text, timestamptz, text, uuid, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Tareas: completadas, descartadas, canceladas
-- ---------------------------------------------------------------------------

create or replace function private.activity_from_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status::text in ('completed', 'ignored', 'cancelled')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.emit_activity_event(
      new.organization_id,
      null,
      'tasks',
      'tasks.' || new.status::text,
      case new.status::text
        when 'completed' then 'Tarea completada: '
        when 'ignored' then 'Tarea descartada: '
        else 'Tarea cancelada: '
      end || new.title || coalesce(' (motivo: ' || nullif(btrim(new.ignored_reason), '') || ')', ''),
      case new.status::text
        when 'completed' then new.completed_at
        when 'ignored' then new.ignored_at
      end,
      'tasks',
      new.id,
      jsonb_build_object('source', new.source, 'priority', new.priority)
    );
  end if;
  return null;
end;
$$;

drop trigger if exists activity_from_tasks on public.tasks;
create trigger activity_from_tasks
after insert or update of status on public.tasks
for each row execute function private.activity_from_tasks();

-- ---------------------------------------------------------------------------
-- Campanas Klaviyo: enviadas, programadas, canceladas (estado crudo del API)
-- ---------------------------------------------------------------------------

create or replace function private.activity_from_klaviyo_campaigns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := lower(coalesce(new.status, ''));
  v_old_status text := case when tg_op = 'UPDATE' then lower(coalesce(old.status, '')) end;
begin
  -- Enviada o cancelada: la programacion deja de ser cierta.
  if v_status in ('sent', 'cancelled', 'canceled') then
    delete from public.activity_events
    where source_table = 'klaviyo_campaigns' and source_id = new.id
      and event_type = 'email.campaign_scheduled';
  end if;

  -- En Klaviyo `send_time` es la hora de envio real o la programada.
  if v_status = 'sent' and v_old_status is distinct from 'sent' then
    perform private.emit_activity_event(
      new.organization_id, null, 'email', 'email.campaign_sent',
      'Campana de email enviada: ' || new.name,
      new.send_time,
      'klaviyo_campaigns', new.id
    );
  elsif v_status = 'scheduled'
     and (v_old_status is distinct from 'scheduled'
          or old.send_time is distinct from new.send_time) then
    perform private.emit_activity_event(
      new.organization_id, null, 'email', 'email.campaign_scheduled',
      'Campana de email programada: ' || new.name,
      new.send_time,
      'klaviyo_campaigns', new.id
    );
  elsif v_status in ('cancelled', 'canceled') and v_old_status is distinct from v_status then
    perform private.emit_activity_event(
      new.organization_id, null, 'email', 'email.campaign_cancelled',
      'Campana de email cancelada: ' || new.name,
      now(),
      'klaviyo_campaigns', new.id
    );
  end if;
  return null;
end;
$$;

drop trigger if exists activity_from_klaviyo_campaigns on public.klaviyo_campaigns;
create trigger activity_from_klaviyo_campaigns
after insert or update of status, send_time on public.klaviyo_campaigns
for each row execute function private.activity_from_klaviyo_campaigns();

-- ---------------------------------------------------------------------------
-- Borradores de marketing (A11): aprobados / rechazados
-- ---------------------------------------------------------------------------

create or replace function private.activity_from_marketing_drafts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('approved', 'rejected')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.emit_activity_event(
      new.organization_id, null, 'email', 'email.draft_' || new.status,
      case new.status when 'approved' then 'Borrador de email aprobado: ' else 'Borrador de email rechazado: ' end
        || new.subject
        || coalesce(' (motivo: ' || nullif(btrim(new.decision_reason), '') || ')', ''),
      new.decided_at,
      'marketing_content_drafts', new.id,
      jsonb_build_object('content_type', new.content_type)
    );
  end if;
  return null;
end;
$$;

drop trigger if exists activity_from_marketing_drafts on public.marketing_content_drafts;
create trigger activity_from_marketing_drafts
after insert or update of status on public.marketing_content_drafts
for each row execute function private.activity_from_marketing_drafts();

-- ---------------------------------------------------------------------------
-- Propuestas de agentes: aprobadas / rechazadas por el consultor
-- ---------------------------------------------------------------------------

create or replace function private.activity_from_agent_outputs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent text;
  v_store uuid;
  v_titles text;
begin
  if new.status in ('approved', 'rejected')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select d.name, r.store_id into v_agent, v_store
    from public.agent_runs r
    join public.agent_versions v on v.id = r.agent_version_id
    join public.agent_definitions d on d.id = v.definition_id
    where r.id = new.run_id;

    select string_agg(item ->> 'title', '; ') into v_titles
    from jsonb_array_elements(
      case when jsonb_typeof(new.output -> 'proposed_writes') = 'array'
        then new.output -> 'proposed_writes' else '[]'::jsonb end
    ) as item
    where coalesce(item ->> 'title', '') <> '';

    perform private.emit_activity_event(
      new.organization_id, v_store, 'ai', 'ai.proposal_' || new.status,
      coalesce(v_agent, 'Agente') || ': propuesta '
        || case new.status when 'approved' then 'aprobada' else 'rechazada' end
        || ' - ' || coalesce(v_titles, left(new.output ->> 'answer', 300), 'sin detalle'),
      new.updated_at,
      'agent_outputs', new.id,
      '{}'::jsonb
    );
  end if;
  return null;
end;
$$;

drop trigger if exists activity_from_agent_outputs on public.agent_outputs;
create trigger activity_from_agent_outputs
after insert or update of status on public.agent_outputs
for each row execute function private.activity_from_agent_outputs();

-- ---------------------------------------------------------------------------
-- Cambios de contexto declarados/detectados (promociones, precios, stock...)
-- ---------------------------------------------------------------------------

create or replace function private.activity_from_context_change_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- El tipo forma parte de la clave: si se corrige o se borra el evento, la
  -- version vieja no puede quedarse en el feed.
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.activity_events
    where source_table = 'context_change_events' and source_id = old.id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.emit_activity_event(
      new.organization_id, new.store_id, 'context', 'context.' || new.event_type,
      new.description,
      new.occurred_at,
      'context_change_events', new.id,
      jsonb_build_object('area', new.area, 'scope', new.scope, 'source', new.source, 'ended_at', new.ended_at)
    );
  end if;
  return null;
end;
$$;

drop trigger if exists activity_from_context_change_events on public.context_change_events;
create trigger activity_from_context_change_events
after insert or update or delete on public.context_change_events
for each row execute function private.activity_from_context_change_events();

-- ---------------------------------------------------------------------------
-- Lectura: lo que reciben los agentes
-- ---------------------------------------------------------------------------

-- Tope por modulo para que un modulo ruidoso (p.ej. muchas campanas) no
-- expulse del contexto a los demas.
drop function if exists public.recent_activity_feed(uuid, uuid, timestamptz, integer);

create or replace function public.recent_activity_feed(
  target_organization_id uuid,
  target_store_id uuid default null,
  since timestamptz default now() - interval '30 days',
  per_module_limit integer default 15
)
returns table (
  occurred_at timestamptz,
  module varchar,
  event_type varchar,
  summary text
)
language sql
stable
set search_path = ''
as $$
  select x.occurred_at, x.module, x.event_type, x.summary
  from (
    select e.occurred_at, e.module, e.event_type, e.summary,
      row_number() over (partition by e.module order by e.occurred_at desc) as rn
    from public.activity_events e
    where e.organization_id = target_organization_id
      and e.occurred_at >= since
      and (target_store_id is null or e.store_id is null or e.store_id = target_store_id)
  ) x
  where x.rn <= least(greatest(per_module_limit, 1), 50)
  order by x.occurred_at desc;
$$;

comment on function public.recent_activity_feed is
  'Feed de actividad reciente para el evidence-pack de los agentes: todos los modulos, tope por '
  'modulo, tienda activa + eventos de toda la organizacion.';

grant execute on function public.recent_activity_feed(uuid, uuid, timestamptz, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- El digest que decide si regenerar un diagnostico (cache de pagina y tick
-- del orquestador) incluye ahora el feed: aprobar/rechazar una propuesta,
-- decidir un borrador o declarar un cambio de contexto invalida la cache de
-- TODOS los agentes, no solo la del que lo origino. Al desplegar, el hash
-- cambia una vez para todas las organizaciones (una regeneracion puntual).
-- ---------------------------------------------------------------------------

create or replace function public.organization_activity_digest(
  target_organization_id uuid
)
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select md5(
    coalesce((
      select count(*)::text || ':' || coalesce(max(finished_at)::text, '') || ':' || coalesce(sum(records_written), 0)::text
      from public.integration_sync_runs
      where organization_id = target_organization_id
        and records_written > 0
    ), '') || '|' ||
    coalesce((
      select count(*)::text || ':' || coalesce(max(updated_at)::text, '')
      from public.tasks
      where organization_id = target_organization_id
    ), '') || '|' ||
    coalesce((
      select count(*)::text || ':' || coalesce(max(updated_at)::text, '')
      from public.alerts
      where organization_id = target_organization_id
    ), '') || '|' ||
    coalesce((
      select count(*)::text || ':' || coalesce(max(occurred_at)::text, '')
      from public.activity_events
      where organization_id = target_organization_id
    ), '')
  );
$$;

-- ---------------------------------------------------------------------------
-- Backfill (90 dias, idempotente)
-- ---------------------------------------------------------------------------

select private.emit_activity_event(
  t.organization_id, null, 'tasks', 'tasks.' || t.status::text,
  case t.status::text
    when 'completed' then 'Tarea completada: '
    when 'ignored' then 'Tarea descartada: '
    else 'Tarea cancelada: '
  end || t.title || coalesce(' (motivo: ' || nullif(btrim(t.ignored_reason), '') || ')', ''),
  coalesce(case t.status::text when 'completed' then t.completed_at when 'ignored' then t.ignored_at end, t.updated_at),
  'tasks', t.id,
  jsonb_build_object('source', t.source, 'priority', t.priority)
)
from public.tasks t
where t.status::text in ('completed', 'ignored', 'cancelled')
  and t.updated_at >= now() - interval '90 days';

select private.emit_activity_event(
  c.organization_id, null, 'email',
  case lower(c.status) when 'sent' then 'email.campaign_sent' else 'email.campaign_scheduled' end,
  case lower(c.status) when 'sent' then 'Campana de email enviada: ' else 'Campana de email programada: ' end || c.name,
  coalesce(c.send_time, c.updated_at),
  'klaviyo_campaigns', c.id
)
from public.klaviyo_campaigns c
where lower(coalesce(c.status, '')) in ('sent', 'scheduled')
  and coalesce(c.send_time, c.updated_at) >= now() - interval '90 days';

select private.emit_activity_event(
  d.organization_id, null, 'email', 'email.draft_' || d.status,
  case d.status when 'approved' then 'Borrador de email aprobado: ' else 'Borrador de email rechazado: ' end
    || d.subject || coalesce(' (motivo: ' || nullif(btrim(d.decision_reason), '') || ')', ''),
  coalesce(d.decided_at, d.updated_at),
  'marketing_content_drafts', d.id,
  jsonb_build_object('content_type', d.content_type)
)
from public.marketing_content_drafts d
where d.status in ('approved', 'rejected')
  and d.updated_at >= now() - interval '90 days';

select private.emit_activity_event(
  o.organization_id, r.store_id, 'ai', 'ai.proposal_' || o.status,
  coalesce(d.name, 'Agente') || ': propuesta '
    || case o.status when 'approved' then 'aprobada' else 'rechazada' end
    || ' - ' || coalesce(
      (select string_agg(item ->> 'title', '; ')
       from jsonb_array_elements(
         case when jsonb_typeof(o.output -> 'proposed_writes') = 'array'
           then o.output -> 'proposed_writes' else '[]'::jsonb end
       ) as item
       where coalesce(item ->> 'title', '') <> ''),
      left(o.output ->> 'answer', 300),
      'sin detalle'),
  o.updated_at,
  'agent_outputs', o.id,
  '{}'::jsonb
)
from public.agent_outputs o
join public.agent_runs r on r.id = o.run_id
join public.agent_versions v on v.id = r.agent_version_id
join public.agent_definitions d on d.id = v.definition_id
where o.status in ('approved', 'rejected')
  and o.updated_at >= now() - interval '90 days';

select private.emit_activity_event(
  e.organization_id, e.store_id, 'context', 'context.' || e.event_type,
  e.description, e.occurred_at,
  'context_change_events', e.id,
  jsonb_build_object('area', e.area, 'scope', e.scope, 'source', e.source, 'ended_at', e.ended_at)
)
from public.context_change_events e
where e.occurred_at >= now() - interval '90 days';
;
