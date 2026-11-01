-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A18: isolate monthly execution per store and make every approved initiative
-- recoverable and transactionally linked to its current Camino snapshot.
create table if not exists public.a18_orchestrator_scope_leases (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  tick_id uuid not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, store_id)
);
alter table public.a18_orchestrator_scope_leases enable row level security;
revoke all on public.a18_orchestrator_scope_leases from public, anon, authenticated;
grant all on public.a18_orchestrator_scope_leases to service_role;

create or replace function public.claim_a18_orchestrator_scope(
  p_organization_id uuid, p_store_id uuid, p_tick_id uuid, p_lease_seconds integer default 1800
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_organization_id is null or p_store_id is null or p_tick_id is null or not exists (
    select 1 from public.shopify_stores s
    where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active
  ) then return false; end if;
  insert into public.a18_orchestrator_scope_leases(organization_id, store_id, tick_id, expires_at, updated_at)
  values (p_organization_id, p_store_id, p_tick_id,
    now() + make_interval(secs => greatest(60, least(coalesce(p_lease_seconds, 1800), 7200))), now())
  on conflict (organization_id, store_id) do update set
    tick_id = excluded.tick_id, expires_at = excluded.expires_at, updated_at = now()
  where public.a18_orchestrator_scope_leases.expires_at <= now()
     or public.a18_orchestrator_scope_leases.tick_id = excluded.tick_id;
  return found;
end; $$;

create or replace function public.release_a18_orchestrator_scope(p_organization_id uuid, p_store_id uuid, p_tick_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from public.a18_orchestrator_scope_leases
  where organization_id = p_organization_id and store_id = p_store_id and tick_id = p_tick_id;
  return found;
end; $$;
revoke all on function public.claim_a18_orchestrator_scope(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_a18_orchestrator_scope(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_a18_orchestrator_scope(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.release_a18_orchestrator_scope(uuid, uuid, uuid) to service_role;

create table if not exists public.a18_initiative_change_receipts (
  output_id uuid not null references public.agent_outputs(id) on delete cascade,
  proposal_index integer not null check (proposal_index >= 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  action text not null check (action in ('replace','retire')),
  previous_task_id uuid not null references public.tasks(id),
  new_task_id uuid references public.tasks(id),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (output_id, proposal_index)
);
alter table public.a18_initiative_change_receipts enable row level security;
revoke all on public.a18_initiative_change_receipts from public, anon, authenticated;
grant all on public.a18_initiative_change_receipts to service_role;

create or replace function public.materialize_a18_monthly_initiative(
  p_task jsonb, p_organization_id uuid, p_store_id uuid, p_output_id uuid,
  p_proposal_index integer, p_plan_id uuid, p_plan_version integer, p_milestone_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_task_id uuid;
  v_created boolean := false;
  v_categories text[];
begin
  if p_organization_id is null or p_store_id is null or p_output_id is null
     or p_proposal_index is null or p_proposal_index < 0
     or jsonb_typeof(p_task) <> 'object'
     or nullif(btrim(p_task->>'title'), '') is null
     or jsonb_typeof(p_task->'metadata'->'ai_monthly_initiative') <> 'object' then
    raise exception 'invalid_a18_monthly_task_payload' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.agent_outputs o
    join public.agent_runs r on r.id=o.run_id
    join public.agent_versions v on v.id=r.agent_version_id
    join public.agent_definitions d on d.id=v.definition_id
    where o.id=p_output_id and o.organization_id=p_organization_id
      and r.store_id=p_store_id and d.code='a18_plan_mensual'
  ) then return jsonb_build_object('status','output_scope_changed'); end if;
  if not exists (select 1 from public.shopify_stores s where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active) then
    return jsonb_build_object('status','store_scope_changed');
  end if;
  if p_plan_id is null then
    if p_plan_version is not null or p_milestone_id is not null then
      return jsonb_build_object('status','incomplete_camino_identity');
    end if;
  else
    perform 1 from public.strategic_plans p
    where p.id = p_plan_id and p.organization_id = p_organization_id
      and p.store_id = p_store_id and p.version = p_plan_version
      and p.status = 'active' and p.approved_at is not null
    for update;
    if not found then return jsonb_build_object('status','camino_changed'); end if;
  end if;
  if p_milestone_id is not null then
    perform 1 from public.strategic_plan_milestones m
    join public.strategic_plan_phases ph on ph.id = m.phase_id
    join public.strategic_plans p on p.id = ph.plan_id
    where m.id = p_milestone_id and m.organization_id = p_organization_id
      and m.status in ('active','pending') and ph.status in ('active','pending')
      and p.id = p_plan_id and p.version = p_plan_version
      and p.status = 'active' and p.approved_at is not null and p.store_id = p_store_id
    for update of m, ph, p;
    if not found then return jsonb_build_object('status','camino_changed'); end if;
  end if;

  select t.id into v_task_id from public.tasks t
  where t.organization_id = p_organization_id and t.agent_output_id = p_output_id
    and t.agent_proposal_index = p_proposal_index;
  if v_task_id is not null then
    if not exists (select 1 from public.tasks t where t.id = v_task_id and t.store_id = p_store_id) then
      return jsonb_build_object('status','task_scope_conflict');
    end if;
    return jsonb_build_object('status','materialized','task_id',v_task_id,'created',false);
  end if;

  select coalesce(array_agg(value), array['general']::text[]) into v_categories
  from jsonb_array_elements_text(coalesce(p_task->'categories', '[]'::jsonb)) as category(value);
  insert into public.tasks (
    organization_id, store_id, source, priority, title, description, created_by,
    assigned_to, metadata, categories, agent_output_id, agent_proposal_index
  ) values (
    p_organization_id, p_store_id, 'ai_consultant',
    (case when p_task->>'priority' in ('low','medium','high','urgent') then p_task->>'priority' else 'medium' end)::public.task_priority,
    left(btrim(p_task->>'title'),255), nullif(p_task->>'description',''),
    nullif(p_task->>'created_by','')::uuid, nullif(p_task->>'assigned_to','')::uuid,
    coalesce(p_task->'metadata','{}'::jsonb), v_categories, p_output_id, p_proposal_index
  ) on conflict do nothing returning id into v_task_id;
  if v_task_id is null then
    select t.id into v_task_id from public.tasks t
    where t.organization_id = p_organization_id and t.agent_output_id = p_output_id and t.agent_proposal_index = p_proposal_index;
    if v_task_id is null or not exists (select 1 from public.tasks t where t.id = v_task_id and t.store_id = p_store_id) then
      return jsonb_build_object('status','task_recovery_failed');
    end if;
  else
    v_created := true;
  end if;
  if p_milestone_id is not null then
    insert into public.milestone_task_links(organization_id, milestone_id, task_id)
    values (p_organization_id, p_milestone_id, v_task_id)
    on conflict (milestone_id, task_id) do nothing;
  end if;
  return jsonb_build_object('status','materialized','task_id',v_task_id,'created',v_created);
end; $$;
revoke all on function public.materialize_a18_monthly_initiative(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid) from public, anon, authenticated;
grant execute on function public.materialize_a18_monthly_initiative(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid) to service_role;

create or replace function public.apply_a18_monthly_initiative_change(
  p_organization_id uuid, p_store_id uuid, p_previous_task_id uuid,
  p_action text, p_actor_user_id uuid, p_replacement jsonb,
  p_output_id uuid, p_proposal_index integer, p_expected_version integer,
  p_plan_id uuid, p_plan_version integer, p_milestone_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_previous public.tasks%rowtype;
  v_old_meta jsonb;
  v_new_meta jsonb;
  v_new_id uuid;
  v_version integer;
  v_categories text[];
  v_result jsonb;
begin
  if p_action not in ('replace','retire') or p_actor_user_id is null or p_output_id is null
     or p_proposal_index is null or p_proposal_index < 0 then
    raise exception 'invalid_a18_change_request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.agent_outputs o
    join public.agent_runs r on r.id=o.run_id
    join public.agent_versions v on v.id=r.agent_version_id
    join public.agent_definitions d on d.id=v.definition_id
    where o.id=p_output_id and o.organization_id=p_organization_id
      and r.store_id=p_store_id and d.code='a18_plan_mensual'
      and o.status='pending_approval'
  ) then raise exception 'a18_output_scope_changed' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_output_id::text || ':' || p_proposal_index::text, 0));
  select result into v_result from public.a18_initiative_change_receipts
  where output_id = p_output_id and proposal_index = p_proposal_index;
  if found then return jsonb_set(v_result, '{recovered}', 'true'::jsonb, true); end if;

  select * into v_previous from public.tasks
  where id = p_previous_task_id and organization_id = p_organization_id and store_id = p_store_id
  for update;
  if not found or v_previous.source <> 'ai_consultant' or v_previous.status not in ('pending','in_progress')
     or jsonb_typeof(v_previous.metadata->'ai_monthly_initiative') <> 'object' then
    raise exception 'a18_previous_initiative_unavailable' using errcode = 'P0002';
  end if;
  v_old_meta := v_previous.metadata->'ai_monthly_initiative';
  v_version := greatest(1, coalesce(nullif(v_old_meta->>'version','')::integer,1));
  if v_version <> greatest(1, coalesce(p_expected_version,1)) then
    raise exception 'a18_initiative_version_changed' using errcode = '40001';
  end if;
  if v_old_meta->>'lifecycle_status' in ('superseded','retired') then
    raise exception 'a18_previous_initiative_already_closed' using errcode = 'P0002';
  end if;

  if p_action = 'replace' then
    if jsonb_typeof(p_replacement) <> 'object' or nullif(btrim(p_replacement->>'title'),'') is null
       or nullif(btrim(p_replacement->>'description'),'') is null then
      raise exception 'a18_replacement_invalid' using errcode = '22023';
    end if;
    if p_plan_id is not null then
      perform 1 from public.strategic_plans p where p.id = p_plan_id and p.organization_id = p_organization_id
        and p.store_id = p_store_id and p.version = p_plan_version and p.status = 'active' and p.approved_at is not null
      for update;
      if not found then raise exception 'a18_camino_changed' using errcode = '40001'; end if;
    elsif p_plan_version is not null or p_milestone_id is not null then
      raise exception 'a18_incomplete_camino_identity' using errcode = '22023';
    end if;
    if p_milestone_id is not null then
      perform 1 from public.strategic_plan_milestones m
      join public.strategic_plan_phases ph on ph.id = m.phase_id
      join public.strategic_plans p on p.id = ph.plan_id
      where m.id = p_milestone_id and m.organization_id = p_organization_id
        and m.status in ('active','pending') and ph.status in ('active','pending')
        and p.id = p_plan_id and p.version = p_plan_version and p.status = 'active'
        and p.approved_at is not null and p.store_id = p_store_id
      for update of m, ph, p;
      if not found then raise exception 'a18_camino_changed' using errcode = '40001'; end if;
    end if;
    select coalesce(array_agg(value), array['general']::text[]) into v_categories
    from jsonb_array_elements_text(coalesce(p_replacement->'categories','[]'::jsonb)) as category(value);
    v_new_id := gen_random_uuid();
    v_new_meta := coalesce(p_replacement->'metadata','{}'::jsonb)
      || jsonb_build_object('ai_monthly_initiative',
        coalesce(p_replacement->'metadata'->'ai_monthly_initiative','{}'::jsonb)
        || jsonb_build_object('version',v_version + 1,'lifecycle_status','active','supersedes_task_id',p_previous_task_id));
    insert into public.tasks(id,organization_id,store_id,source,status,priority,title,description,assigned_to,created_by,metadata,categories,agent_output_id,agent_proposal_index)
    values (v_new_id,p_organization_id,p_store_id,'ai_consultant','pending',
      (case when p_replacement->>'priority' in ('low','medium','high','urgent') then p_replacement->>'priority' else 'medium' end)::public.task_priority,
      left(btrim(p_replacement->>'title'),255),p_replacement->>'description',nullif(p_replacement->>'assigned_to','')::uuid,
      p_actor_user_id,v_new_meta,v_categories,p_output_id,p_proposal_index);
    if p_milestone_id is not null then
      insert into public.milestone_task_links(organization_id,milestone_id,task_id)
      values (p_organization_id,p_milestone_id,v_new_id) on conflict (milestone_id,task_id) do nothing;
    end if;
  end if;

  perform set_config('request.jwt.claim.sub',p_actor_user_id::text,true);
  update public.tasks set status='cancelled', updated_at=now(), metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),
    '{ai_monthly_initiative}', v_old_meta || jsonb_build_object(
      'lifecycle_status',case when p_action='retire' then 'retired' else 'superseded' end,
      'closed_by_user_id',p_actor_user_id,'closed_at',now(),
      'superseded_by_task_id',case when p_action='replace' then to_jsonb(v_new_id) else 'null'::jsonb end),true)
  where id=p_previous_task_id and organization_id=p_organization_id and store_id=p_store_id and status in ('pending','in_progress');
  if not found then raise exception 'a18_previous_initiative_concurrent_update' using errcode = '40001'; end if;

  v_result := jsonb_build_object('action',p_action,'previous_task_id',p_previous_task_id,'new_task_id',v_new_id,
    'version',case when p_action='replace' then v_version + 1 else v_version end,'recovered',false);
  insert into public.a18_initiative_change_receipts(output_id,proposal_index,organization_id,store_id,action,previous_task_id,new_task_id,result)
  values (p_output_id,p_proposal_index,p_organization_id,p_store_id,p_action,p_previous_task_id,v_new_id,v_result)
  on conflict (output_id,proposal_index) do nothing;
  select result into v_result from public.a18_initiative_change_receipts where output_id=p_output_id and proposal_index=p_proposal_index;
  return v_result;
end; $$;
revoke all on function public.apply_a18_monthly_initiative_change(uuid,uuid,uuid,text,uuid,jsonb,uuid,integer,integer,uuid,integer,uuid) from public, anon, authenticated;
grant execute on function public.apply_a18_monthly_initiative_change(uuid,uuid,uuid,text,uuid,jsonb,uuid,integer,integer,uuid,integer,uuid) to service_role;

-- Coherent A18 prompt contract: bounded initiatives, explicit abstention,
-- monthly Camino context, durable ownership and no silent milestone reopening.
insert into public.prompt_versions(code,version,content,checksum)
select 'a18_plan_mensual_system','v8',p.content || E'\n\n19. CONTRATO MENSUAL A18 v8\nDevuelve como máximo tres iniciativas estructurales; también puedes devolver cero y explicar en answer si no existe trabajo útil, falta evidencia, no hay Camino aprobado o existe un bloqueo. No conviertas ausencia de datos en cero. Para cada iniciativa nueva o sustitución incluye owner_role, completion_criteria e initiative_measurement con métrica, unidad, baseline, target y ventana; baseline/target pueden ser null solo cuando las fuentes no permiten medirlos y debes explicarlo. Mantén el plan_id y plan_version del Camino exactamente como aparecen; enlaza milestone_id solo con un hito vigente y pertinente. Los checkpoints mensuales están dentro de la meta estructurada. El periodo analizado y la ventana de ejecución del mes siguiente son distintos. Usa fuentes por tienda y señala cobertura, actualización y errores. Para desglosar una iniciativa existente en A17/A04 incluye su monthly_initiative_id exacto; no repitas el compromiso padre. Toda retirada o sustitución requiere aprobación humana; una iniciativa completada no se reabre y los cambios de Camino solo producen una propuesta para revisión de Camino.\nTOOLS: hay search_knowledge y sql_select; el SQL es de solo lectura y sirve para evidencia concreta dentro del alcance autorizado.\n',encode(sha256(convert_to(p.content || E'\n\n19. CONTRATO MENSUAL A18 v8\nDevuelve como máximo tres iniciativas estructurales; también puedes devolver cero y explicar en answer si no existe trabajo útil, falta evidencia, no hay Camino aprobado o existe un bloqueo. No conviertas ausencia de datos en cero. Para cada iniciativa nueva o sustitución incluye owner_role, completion_criteria e initiative_measurement con métrica, unidad, baseline, target y ventana; baseline/target pueden ser null solo cuando las fuentes no permiten medirlos y debes explicarlo. Mantén el plan_id y plan_version del Camino exactamente como aparecen; enlaza milestone_id solo con un hito vigente y pertinente. Los checkpoints mensuales están dentro de la meta estructurada. El periodo analizado y la ventana de ejecución del mes siguiente son distintos. Usa fuentes por tienda y señala cobertura, actualización y errores. Para desglosar una iniciativa existente en A17/A04 incluye su monthly_initiative_id exacto; no repitas el compromiso padre. Toda retirada o sustitución requiere aprobación humana; una iniciativa completada no se reabre y los cambios de Camino solo producen una propuesta para revisión de Camino.\nTOOLS: hay search_knowledge y sql_select; el SQL es de solo lectura y sirve para evidencia concreta dentro del alcance autorizado.\n','UTF8')),'hex')
from public.prompt_versions p where p.code='a18_plan_mensual_system' and p.version='v7'
on conflict(code,version) do update set content=excluded.content,checksum=excluded.checksum;
update public.agent_versions set is_active=false where is_active and definition_id=(select id from public.agent_definitions where code='a18_plan_mensual');
insert into public.agent_versions(definition_id,version,model,prompt_code,prompt_version,allowed_tools,approval_mode,output_schema_version,config)
select v.definition_id,'v8',v.model,'a18_plan_mensual_system','v8',v.allowed_tools,v.approval_mode,v.output_schema_version,v.config
from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id
where d.code='a18_plan_mensual' and v.version='v7'
on conflict(definition_id,version) do update set prompt_code=excluded.prompt_code,prompt_version=excluded.prompt_version,
  allowed_tools=excluded.allowed_tools,approval_mode=excluded.approval_mode,output_schema_version=excluded.output_schema_version,config=excluded.config,is_active=true;

-- A17 preserves the parent identity when it turns a monthly commitment into
-- weekly delivery; the API verifies the referenced task and exact store.
insert into public.prompt_versions(code,version,content,checksum)
select 'a17_plan_semanal_system','v9',p.content || E'\n\n11. TRAZABILIDAD A18 → A17/A04\nCuando un entregable semanal desglosa una iniciativa mensual aprobada, devuelve monthly_initiative_id copiando exactamente el task_id de la iniciativa abierta que recibes. Si el trabajo es independiente, déjalo null. No enlaces una tarea de otra tienda, retirada, sustituida o completada. Mantén este campo separado de milestone_id: la iniciativa padre no sustituye al hito de Mi Camino.\n',
  encode(sha256(convert_to(p.content || E'\n\n11. TRAZABILIDAD A18 → A17/A04\nCuando un entregable semanal desglosa una iniciativa mensual aprobada, devuelve monthly_initiative_id copiando exactamente el task_id de la iniciativa abierta que recibes. Si el trabajo es independiente, déjalo null. No enlaces una tarea de otra tienda, retirada, sustituida o completada. Mantén este campo separado de milestone_id: la iniciativa padre no sustituye al hito de Mi Camino.\n','UTF8')),'hex')
from public.prompt_versions p where p.code='a17_plan_semanal_system' and p.version='v8'
on conflict(code,version) do update set content=excluded.content,checksum=excluded.checksum;
update public.agent_versions set is_active=false where is_active and definition_id=(select id from public.agent_definitions where code='a17_plan_semanal');
insert into public.agent_versions(definition_id,version,model,prompt_code,prompt_version,allowed_tools,approval_mode,output_schema_version,config)
select v.definition_id,'v9',v.model,'a17_plan_semanal_system','v9',v.allowed_tools,v.approval_mode,v.output_schema_version,v.config
from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id
where d.code='a17_plan_semanal' and v.version='v8'
on conflict(definition_id,version) do update set prompt_code=excluded.prompt_code,prompt_version=excluded.prompt_version,
  allowed_tools=excluded.allowed_tools,approval_mode=excluded.approval_mode,output_schema_version=excluded.output_schema_version,config=excluded.config,is_active=true;


