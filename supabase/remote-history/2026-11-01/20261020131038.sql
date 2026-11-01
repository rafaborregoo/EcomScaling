-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A17 weekly-plan execution leases keep a timed-out/retried worker from
-- charging for the same organization/store scope twice.
create table if not exists public.a17_orchestrator_scope_leases (
  scope_key text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid null references public.shopify_stores(id) on delete cascade,
  tick_id uuid not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.a17_orchestrator_scope_leases enable row level security;
revoke all on public.a17_orchestrator_scope_leases from anon, authenticated;
grant all on public.a17_orchestrator_scope_leases to service_role;

create or replace function public.claim_a17_orchestrator_scope(
  p_organization_id uuid,
  p_store_id uuid,
  p_tick_id uuid,
  p_lease_seconds integer default 1800
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope_key text := p_organization_id::text || ':' || coalesce(p_store_id::text, 'all');
  v_claimed boolean := false;
begin
  if p_organization_id is null or p_tick_id is null then
    return false;
  end if;
  insert into public.a17_orchestrator_scope_leases(scope_key, organization_id, store_id, tick_id, expires_at, updated_at)
  values (v_scope_key, p_organization_id, p_store_id, p_tick_id,
    now() + make_interval(secs => greatest(60, least(coalesce(p_lease_seconds, 1800), 7200))), now())
  on conflict (scope_key) do update set
    organization_id = excluded.organization_id,
    store_id = excluded.store_id,
    tick_id = excluded.tick_id,
    expires_at = excluded.expires_at,
    updated_at = now()
  where public.a17_orchestrator_scope_leases.expires_at <= now()
     or public.a17_orchestrator_scope_leases.tick_id = excluded.tick_id
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

create or replace function public.release_a17_orchestrator_scope(
  p_organization_id uuid,
  p_store_id uuid,
  p_tick_id uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.a17_orchestrator_scope_leases
  where scope_key = p_organization_id::text || ':' || coalesce(p_store_id::text, 'all')
    and tick_id = p_tick_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.claim_a17_orchestrator_scope(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_a17_orchestrator_scope(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_a17_orchestrator_scope(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.release_a17_orchestrator_scope(uuid, uuid, uuid) to service_role;

-- A17 retry keys are scoped to the weekly planner, organization and store.
create or replace function public.reserve_a17_manual_refresh(
  p_run_id uuid,
  p_organization_id uuid,
  p_agent_code text,
  p_daily_limit integer,
  p_request_key text default null,
  p_store_id uuid default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_reserved integer;
  v_runs integer;
begin
  if p_run_id is null or p_organization_id is null or p_agent_code <> 'a17_plan_semanal' then return 'invalid'; end if;
  if p_store_id is null or not exists (
    select 1 from public.shopify_stores s
    where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active
  ) then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':a17_plan_semanal:' || coalesce(p_store_id::text, 'all'), 0));
  if nullif(btrim(p_request_key), '') is not null and exists (
    select 1 from public.agent_manual_refresh_reservations r
    where r.organization_id = p_organization_id and r.agent_code = 'a17_plan_semanal'
      and r.reservation_day = v_day and r.request_key = p_request_key
      and r.store_id is not distinct from p_store_id
  ) then return 'duplicate'; end if;
  select count(*) into v_runs
  from public.agent_runs r
  join public.agent_versions v on v.id = r.agent_version_id
  join public.agent_definitions d on d.id = v.definition_id
  where r.organization_id = p_organization_id and d.code = 'a17_plan_semanal'
    and r.trigger_type = 'manual' and r.started_at >= (v_day::timestamp at time zone 'utc')
    and r.store_id = p_store_id
    and not exists (select 1 from public.agent_manual_refresh_reservations q where q.run_id = r.id);
  select count(*) into v_reserved
  from public.agent_manual_refresh_reservations r
  where r.organization_id = p_organization_id and r.agent_code = 'a17_plan_semanal'
    and r.reservation_day = v_day and r.store_id = p_store_id;
  if v_runs + v_reserved >= greatest(1, coalesce(p_daily_limit, 1)) then return 'limit'; end if;
  insert into public.agent_manual_refresh_reservations(run_id, organization_id, agent_code, request_key, store_id)
  values (p_run_id, p_organization_id, 'a17_plan_semanal', nullif(btrim(p_request_key), ''), p_store_id)
  on conflict do nothing;
  if not found then return 'duplicate'; end if;
  return 'reserved';
end;
$$;

revoke all on function public.reserve_a17_manual_refresh(uuid, uuid, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_a17_manual_refresh(uuid, uuid, text, integer, text, uuid) to service_role;

-- Stable semantic identity prevents two different A17 outputs from creating
-- the same open store-level work item during concurrent approvals.
create unique index if not exists tasks_a17_open_work_identity_idx
  on public.tasks (organization_id, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), (metadata->>'ai_work_identity'))
  where source = 'ai_consultant'
    and status in ('pending', 'in_progress')
    and metadata ? 'ai_work_identity';

create or replace function public.materialize_a17_weekly_task(
  p_task jsonb, p_organization_id uuid, p_store_id uuid, p_output_id uuid,
  p_proposal_index integer, p_plan_id uuid, p_plan_version integer,
  p_phase text, p_milestone_id uuid
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_title text := nullif(btrim(p_task->>'title'), '');
  v_identity text := nullif(p_task->'metadata'->>'ai_work_identity', '');
  v_task_id uuid;
  v_created boolean := false;
  v_existing_store_id uuid;
  v_categories text[];
begin
  if p_organization_id is null or p_store_id is null or p_output_id is null or p_proposal_index is null
     or p_proposal_index < 0 or v_title is null or v_identity is null or jsonb_typeof(p_task) <> 'object' then
    raise exception 'invalid_a17_task_payload';
  end if;
  if not exists (select 1 from public.shopify_stores s where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active) then
    return jsonb_build_object('status', 'store_scope_changed');
  end if;
  if p_milestone_id is null then
    if p_plan_id is not null or p_plan_version is not null or p_phase is not null then
      return jsonb_build_object('status', 'incomplete_camino_identity');
    end if;
  else
    perform 1 from public.strategic_plan_milestones m
    join public.strategic_plan_phases ph on ph.id = m.phase_id
    join public.strategic_plans p on p.id = ph.plan_id
    where m.id = p_milestone_id and m.organization_id = p_organization_id
      and m.status in ('active','pending') and ph.status in ('active','pending') and ph.name = p_phase
      and p.id = p_plan_id and p.version = p_plan_version and p.status = 'active'
      and p.approved_at is not null and p.store_id = p_store_id
    for update of m, ph, p;
    if not found then return jsonb_build_object('status', 'camino_changed'); end if;
  end if;

  select t.id into v_task_id from public.tasks t
  where t.organization_id = p_organization_id and t.store_id = p_store_id
    and t.source = 'ai_consultant' and t.status in ('pending','in_progress')
    and t.metadata->>'ai_work_identity' = v_identity
    and not (t.agent_output_id = p_output_id and t.agent_proposal_index = p_proposal_index)
  limit 1;
  if v_task_id is not null then return jsonb_build_object('status','equivalent_open_work_exists','task_id',v_task_id); end if;

  select coalesce(array_agg(value), array['general']::text[]) into v_categories
  from jsonb_array_elements_text(coalesce(p_task->'categories', '[]'::jsonb)) as category(value);
  insert into public.tasks (
    organization_id, store_id, source, priority, title, description, created_by,
    assigned_to, metadata, categories, agent_output_id, agent_proposal_index
  ) values (
    p_organization_id, p_store_id, 'ai_consultant',
    case when p_task->>'priority' in ('low','medium','high','urgent') then p_task->>'priority' else 'medium' end,
    v_title, nullif(p_task->>'description',''), nullif(p_task->>'created_by','')::uuid,
    nullif(p_task->>'assigned_to','')::uuid, coalesce(p_task->'metadata','{}'::jsonb), v_categories,
    p_output_id, p_proposal_index
  ) on conflict do nothing returning id into v_task_id;
  if v_task_id is not null then
    v_created := true;
  else
    select t.id, t.store_id into v_task_id, v_existing_store_id from public.tasks t
    where t.agent_output_id = p_output_id and t.agent_proposal_index = p_proposal_index
      and t.organization_id = p_organization_id;
    if v_task_id is null then
      select t.id into v_task_id from public.tasks t
      where t.organization_id = p_organization_id and t.store_id = p_store_id
        and t.source = 'ai_consultant' and t.status in ('pending','in_progress')
        and t.metadata->>'ai_work_identity' = v_identity limit 1;
      if v_task_id is not null then return jsonb_build_object('status','equivalent_open_work_exists','task_id',v_task_id); end if;
      return jsonb_build_object('status','task_recovery_failed');
    end if;
    if v_existing_store_id is distinct from p_store_id then return jsonb_build_object('status','existing_task_scope_conflict'); end if;
  end if;
  if p_milestone_id is not null then
    insert into public.milestone_task_links(organization_id,milestone_id,task_id)
    values(p_organization_id,p_milestone_id,v_task_id) on conflict(milestone_id,task_id) do nothing;
  end if;
  return jsonb_build_object('status','materialized','task_id',v_task_id,'created',v_created);
end;
$$;
revoke all on function public.materialize_a17_weekly_task(jsonb, uuid, uuid, uuid, integer, uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.materialize_a17_weekly_task(jsonb, uuid, uuid, uuid, integer, uuid, integer, text, uuid) to service_role;

create or replace function private.can_access_agent_store_scope(p_organization_id uuid, p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or private.is_assigned_consultant(p_organization_id)
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = p_organization_id and m.user_id = (select auth.uid()) and m.is_active
        and (
          coalesce(m.access_scope, 'organization') = 'organization'
          or (coalesce(m.access_scope, 'organization') = 'store' and p_store_id is not null and p_store_id = any(coalesce(m.store_ids, '{}'::uuid[])))
        )
    );
$$;
revoke all on function private.can_access_agent_store_scope(uuid, uuid) from public, anon;
grant execute on function private.can_access_agent_store_scope(uuid, uuid) to authenticated, service_role;

-- Existing broad organization policies remain as the business visibility gate;
-- these restrictive policies additionally enforce store-scoped memberships.
drop policy if exists agent_runs_store_scope_guard on public.agent_runs;
create policy agent_runs_store_scope_guard on public.agent_runs as restrictive for select to authenticated
using (private.can_access_agent_store_scope(organization_id, store_id));

drop policy if exists agent_outputs_store_scope_guard on public.agent_outputs;
create policy agent_outputs_store_scope_guard on public.agent_outputs as restrictive for select to authenticated
using (exists (
  select 1 from public.agent_runs r
  where r.id = agent_outputs.run_id
    and private.can_access_agent_store_scope(agent_outputs.organization_id, r.store_id)
));

drop policy if exists tasks_store_scope_guard on public.tasks;
create policy tasks_store_scope_guard on public.tasks as restrictive for select to authenticated
using (private.can_access_agent_store_scope(organization_id, store_id));

drop policy if exists milestone_task_links_store_scope_guard on public.milestone_task_links;
create policy milestone_task_links_store_scope_guard on public.milestone_task_links as restrictive for select to authenticated
using (exists (
  select 1 from public.tasks t
  where t.id = milestone_task_links.task_id
    and private.can_access_agent_store_scope(milestone_task_links.organization_id, t.store_id)
));

-- A17 v8 pins a single coherent prompt and schema after the accumulated v7
-- edits. The previous active version remains immutable in history.
with source_prompt as (
  select pv.code, pv.content || E'\n\n10. CONTRATO SEMANAL A17 v8\nTOOLS: tienes search_knowledge y sql_select. Usa solo datos ya filtrados a la tienda seleccionada; sql_select sirve para agregados puntuales cuando falta una cifra y no sustituye al control de evidencia.\nTrabaja con una ventana semanal UTC explícita, compara ventas de la semana en curso con la misma duración de la semana anterior y usa 30 días solo como contexto de tendencia. Declara si cada fuente está incompleta, desactualizada o sin datos; nunca conviertas un error en cero. Considera hasta cuatro entregables, o ninguno si no existe trabajo útil. Cada tarea debe tener título y descripción concretos, owner_role, completion_criteria, expected_metric con ventana de comprobación y due_hint relativo dentro de la semana; no inventes horas ni fechas de calendario. Para vincular un hito devuelve juntos el plan_id, plan_version, phase y milestone_id exactos del bloque Mi Camino; si no encaja con un hito vigente, deja todos esos campos null y explica la independencia en alignment_rationale. Un hito null no se asigna automáticamente. Separa las iniciativas mensuales A18 ya aprobadas, los borradores pendientes, las propuestas rechazadas y el trabajo caducado; el estado pendiente sirve como indicio, nunca como compromiso. Divide una iniciativa mensual aprobada en entregables y no la vuelvas a crear. Contrasta calendario comercial y campañas futuras confirmadas de A05/A27; prepara su ejecución sin volver a diseñarlas. No reabras ni alteres un plan o hito; la aprobación solo enlaza tareas con identidades aún activas. Un resumen sin tareas debe explicar si faltan datos, si no hay trabajo accionable o si la tienda está al día. Usa solo la tienda seleccionada y aprendizaje metodológico compartido; no uses resultados o memoria de otra tienda.' as content
  from public.prompt_versions pv
  join public.agent_versions av on av.prompt_code = pv.code and av.prompt_version = pv.version and av.is_active
  join public.agent_definitions ad on ad.id = av.definition_id
  where ad.code = 'a17_plan_semanal'
), inserted_prompt as (
  insert into public.prompt_versions(code, version, content, checksum)
  select code, 'v8', content, encode(sha256(convert_to(content, 'UTF8')), 'hex') from source_prompt
  on conflict (code, version) do nothing
)
update public.agent_versions av
set is_active = false
from public.agent_definitions ad
where ad.id = av.definition_id and ad.code = 'a17_plan_semanal' and av.is_active;

insert into public.agent_versions(definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, is_active)
select ad.id, 'v8', 'gpt-6-luna', av.prompt_code, 'v8', av.allowed_tools, av.approval_mode, true
from public.agent_definitions ad
join public.agent_versions av on av.definition_id = ad.id and av.version <> 'v8'
where ad.code = 'a17_plan_semanal'
order by av.created_at desc
limit 1
on conflict (definition_id, version) do update set is_active = true;


