-- A28 keeps one-store scope, manual execution and review before task delivery.

create or replace function public.reserve_a28_manual_refresh(
  p_run_id uuid, p_organization_id uuid, p_agent_code text, p_daily_limit integer,
  p_request_key text default null, p_store_id uuid default null
) returns text language plpgsql security invoker set search_path = '' as $function$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_reserved integer;
  v_runs integer;
begin
  if p_agent_code <> 'a28_arquitecto_flujos' or p_store_id is null then raise exception 'invalid_a28_scope'; end if;
  if not exists(select 1 from public.shopify_stores s where s.id=p_store_id and s.organization_id=p_organization_id and s.is_active) then
    raise exception 'invalid_store_scope'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':a28:'||p_store_id::text||':'||v_day_start::text,0));
  if p_request_key is not null and exists(select 1 from public.agent_manual_refresh_reservations r
    where r.organization_id=p_organization_id and r.agent_code=p_agent_code and r.reservation_day=v_day_start::date
      and r.request_key=p_request_key and r.store_id=p_store_id) then return 'duplicate'; end if;
  if exists(select 1 from public.agent_manual_refresh_reservations r left join public.agent_runs run on run.id=r.run_id
    where r.organization_id=p_organization_id and r.agent_code=p_agent_code and r.store_id=p_store_id
      and r.reserved_at>now()-interval '30 minutes' and r.request_key is distinct from p_request_key
      and ((run.id is null and r.reserved_at>now()-interval '2 minutes') or run.status in ('queued','running'))) then return 'busy'; end if;
  select count(*) into v_runs from public.agent_runs r
    join public.agent_versions v on v.id=r.agent_version_id join public.agent_definitions d on d.id=v.definition_id
    where r.organization_id=p_organization_id and r.trigger_type='manual' and r.started_at>=v_day_start
      and d.code=p_agent_code and r.store_id=p_store_id
      and not exists(select 1 from public.agent_manual_refresh_reservations q where q.run_id=r.id);
  select count(*) into v_reserved from public.agent_manual_refresh_reservations r
    where r.organization_id=p_organization_id and r.agent_code=p_agent_code and r.reserved_at>=v_day_start and r.store_id=p_store_id;
  if v_runs+v_reserved>=greatest(p_daily_limit,0) then return 'limit'; end if;
  insert into public.agent_manual_refresh_reservations(run_id,organization_id,agent_code,request_key,store_id)
    values(p_run_id,p_organization_id,p_agent_code,p_request_key,p_store_id) on conflict do nothing;
  return case when found then 'reserved' else 'duplicate' end;
end;
$function$;
revoke all on function public.reserve_a28_manual_refresh(uuid,uuid,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_a28_manual_refresh(uuid,uuid,text,integer,text,uuid) to service_role;

create or replace function public.materialize_a28_flow_task(
  p_task jsonb,p_organization_id uuid,p_store_id uuid,p_output_id uuid,p_proposal_index integer,
  p_plan_id uuid,p_plan_version integer,p_plan_revision integer,p_phase text,p_milestone_id uuid,p_source_flow_refs text[] default '{}'
) returns jsonb language plpgsql security invoker set search_path='' as $function$
declare v_task_id uuid; v_created boolean; v_title text:=nullif(btrim(p_task->>'title'),''); v_snapshot_flows jsonb;
  v_output jsonb; v_candidate jsonb; v_candidate_index integer;
begin
  if p_store_id is null or p_output_id is null or p_proposal_index is null or p_proposal_index<0 or v_title is null then
    raise exception 'invalid_a28_task_payload'; end if;
  if not exists(select 1 from public.shopify_stores s where s.id=p_store_id and s.organization_id=p_organization_id and s.is_active) then
    return jsonb_build_object('status','store_scope_changed'); end if;
  if not exists(select 1 from public.agent_outputs o join public.agent_runs r on r.id=o.run_id
    join public.agent_versions av on av.id=r.agent_version_id join public.agent_definitions d on d.id=av.definition_id
    where o.id=p_output_id and o.organization_id=p_organization_id and o.status='pending_approval'
      and r.store_id=p_store_id and r.organization_id=p_organization_id and d.code='a28_arquitecto_flujos') then
    return jsonb_build_object('status','output_not_pending_or_out_of_scope'); end if;
  select o.output into v_output from public.agent_outputs o where o.id=p_output_id and o.organization_id=p_organization_id;
  begin v_candidate_index := (p_task->'metadata'->>'a28_architecture_candidate_index')::integer;
  exception when invalid_text_representation then v_candidate_index := null; end;
  if v_candidate_index is null or v_candidate_index < 0 then
    return jsonb_build_object('status','architecture_candidate_missing'); end if;
  select candidate into v_candidate from jsonb_array_elements(v_output->'flow_architecture'->'candidates') with ordinality as candidates(candidate,ordinality)
    where ordinality=v_candidate_index+1;
  if v_candidate is null or v_candidate->'source_flow_refs' is distinct from to_jsonb(coalesce(p_source_flow_refs,'{}'::text[])) then
    return jsonb_build_object('status','architecture_candidate_changed'); end if;
  if coalesce(cardinality(p_source_flow_refs),0)>0 then
    select block->'data'->'flows' into v_snapshot_flows
      from public.agent_context_snapshots s cross join lateral jsonb_array_elements(s.snapshot->'blocks') block
      where s.run_id=(select o.run_id from public.agent_outputs o where o.id=p_output_id and o.organization_id=p_organization_id)
        and s.organization_id=p_organization_id and block->>'label' like 'Inventario y resumen estructural de Klaviyo%'
      order by s.created_at desc limit 1;
    if coalesce(jsonb_typeof(v_snapshot_flows),'')<>'array' then return jsonb_build_object('status','source_snapshot_unavailable'); end if;
    if cardinality(p_source_flow_refs)<>cardinality(array(select distinct unnest(p_source_flow_refs)))
      or exists(select 1 from unnest(p_source_flow_refs) as requested(source_ref) where requested.source_ref !~ '^flow-[0-9]{3}$')
      or exists(select 1 from unnest(p_source_flow_refs) as requested(source_ref) where not exists(
      select 1 from jsonb_array_elements(v_snapshot_flows) snapshot_flow
      join (
        select 'flow-'||lpad(row_number() over(order by f.last_synced_at desc,f.id asc)::text,3,'0') as source_ref,
          f.id,f.name,f.status,f.trigger_type,f.updated_at_external
        from public.klaviyo_flows f join public.klaviyo_accounts k on k.id=f.account_id and k.organization_id=f.organization_id
        join public.integration_connections c on c.id=k.connection_id and c.organization_id=k.organization_id
        where f.organization_id=p_organization_id and k.store_id=p_store_id and c.provider='klaviyo'
          and c.status in ('connected','syncing') and c.deletion_requested_at is null
          and lower(coalesce(f.status,'')) not in ('archived','deleted','removed')
      ) current_flow on current_flow.source_ref=snapshot_flow->>'source_ref'
      where snapshot_flow->>'source_ref'=requested.source_ref
        and snapshot_flow->>'status' is not distinct from current_flow.status
        and snapshot_flow->>'name' is not distinct from current_flow.name
        and snapshot_flow->>'trigger_type' is not distinct from current_flow.trigger_type
        and (snapshot_flow->>'updated_at_external')::timestamptz is not distinct from current_flow.updated_at_external
    )) then return jsonb_build_object('status','flow_changed_since_analysis'); end if;
  end if;
  if p_plan_id is null and (p_plan_version is not null or p_plan_revision is not null or p_phase is not null or p_milestone_id is not null) then
    return jsonb_build_object('status','incomplete_camino_identity'); end if;
  if p_plan_id is not null and (p_plan_version is null or p_plan_revision is null or not exists(
    select 1 from public.strategic_plans p where p.id=p_plan_id and p.organization_id=p_organization_id
      and p.store_id=p_store_id and p.version=p_plan_version and p.revision=p_plan_revision
      and p.status='active' and p.approved_at is not null for share)) then
    return jsonb_build_object('status','camino_changed_since_analysis'); end if;
  if p_milestone_id is not null and not exists(select 1 from public.strategic_plan_milestones m
    join public.strategic_plan_phases ph on ph.id=m.phase_id join public.strategic_plans p on p.id=ph.plan_id
    where m.id=p_milestone_id and m.organization_id=p_organization_id and m.status in ('active','pending')
      and ph.status in ('active','pending') and (p_phase is null or p_phase=ph.name)
      and p.id=p_plan_id and p.store_id=p_store_id and p.version=p_plan_version and p.revision=p_plan_revision
      and p.status='active' and p.approved_at is not null) then
    return jsonb_build_object('status','milestone_out_of_scope'); end if;
  insert into public.tasks(organization_id,store_id,source,priority,title,description,created_by,assigned_to,metadata,categories,agent_output_id,agent_proposal_index)
    values(p_organization_id,p_store_id,'ai_consultant',case when p_task->>'priority' in ('low','medium','high','urgent') then p_task->>'priority' else 'medium' end,
      v_title,nullif(p_task->>'description',''),nullif(p_task->>'created_by','')::uuid,nullif(p_task->>'assigned_to','')::uuid,
      coalesce(p_task->'metadata','{}'::jsonb),array['klaviyo'],p_output_id,p_proposal_index)
    on conflict(agent_output_id,agent_proposal_index) do nothing returning id into v_task_id;
  v_created:=v_task_id is not null;
  if v_task_id is null then select t.id into v_task_id from public.tasks t where t.agent_output_id=p_output_id and t.agent_proposal_index=p_proposal_index
    and t.organization_id=p_organization_id and t.store_id=p_store_id; end if;
  if v_task_id is null then raise exception 'A28_TASK_RECOVERY_FAILED'; end if;
  if p_milestone_id is not null then insert into public.milestone_task_links(organization_id,milestone_id,task_id)
    values(p_organization_id,p_milestone_id,v_task_id) on conflict(milestone_id,task_id) do nothing; end if;
  return jsonb_build_object('status','materialized','task_id',v_task_id,'created',v_created);
end;
$function$;
revoke all on function public.materialize_a28_flow_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,integer,text,uuid,text[]) from public,anon,authenticated;
grant execute on function public.materialize_a28_flow_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,integer,text,uuid,text[]) to service_role;

insert into public.prompt_versions(code,version,content,checksum)
select p.code,'v3',p.content||E'\n\nEJECUCIÓN, EVIDENCIA Y COORDINACIÓN A28\nTrabajas sobre una única tienda. La tienda seleccionada se resuelve por su ID interno de tienda; las cuentas Klaviyo se asocian por store_id y por conexión Klaviyo activa, nunca usando el connection_id de Shopify como ID de Klaviyo. El análisis es manual y de solo lectura: no se ejecuta al abrir la pantalla y no modifica, activa, pausa ni envía flows. La interfaz presenta un resumen breve y los detalles se abren bajo demanda.\n\nEl inventario puede estar paginado y truncado: respeta account_inventory_status, query_truncation, inventory_truncated, graph_freshness, definition_freshness y los estados de cobertura. Unknown, empty, unavailable y partial no significan cero. El grafo estructural describe pasos y enlaces observados, sin revelar IDs ni contenido. No infieras filtros, consentimiento, exclusiones o elegibilidad de perfiles a partir de conteos.\n\nLas métricas comparan dos meses calendario completos, consecutivos y sin solapamiento. Solo usa revenue si la moneda está verificada para todas las cuentas de la tienda; en otro caso las cifras ya se han omitido. Atribución de Klaviyo no demuestra incrementalidad ni causalidad. No sumes monedas o canales.\n\nPara una propuesta vinculada a Mi Camino copia plan_id, plan_version, plan_revision y milestone_id únicamente del plan activo aprobado de esta tienda. Si falta o no hay plan, deja la alineación vacía y explica la limitación; no inventes IDs ni recurras a un hito actual por defecto. A20 define el objetivo de retención y el segmento; A28 diseña la automatización. Coordina conflictos con A05 y campañas, A11 y A26 para email, A27 para calendario/frecuencia, y A20 para cohortes. Una aprobación solo crea una tarea revisable y su enlace exacto al Camino; no acredita implementación en Klaviyo.\n\nReglas del objeto: design_proposal necesita al menos un candidato; no_change no admite candidatos. Los pasos son únicos y consecutivos desde 1, hasta ocho. verified requiere evidencia observada en el contexto; si no puede demostrarse, usa un estado no verificado. Las propuestas de medición no deben contener comunicaciones. Cada proposed_write debe ser una tarea breve, sin duplicar tareas abiertas y con evidencia; como máximo cuatro. En cada tarea incluye architecture_candidate_index (índice base cero del candidato) y source_flow_refs exactamente iguales a los de ese candidato. Aprobación y materialización revalidan tienda, plan, candidato, flows y revisión exacta.\n',
  encode(sha256(convert_to(p.content||E'\n\nEJECUCIÓN, EVIDENCIA Y COORDINACIÓN A28\nTrabajas sobre una única tienda. La tienda seleccionada se resuelve por su ID interno de tienda; las cuentas Klaviyo se asocian por store_id y por conexión Klaviyo activa, nunca usando el connection_id de Shopify como ID de Klaviyo. El análisis es manual y de solo lectura: no se ejecuta al abrir la pantalla y no modifica, activa, pausa ni envía flows. La interfaz presenta un resumen breve y los detalles se abren bajo demanda.\n\nEl inventario puede estar paginado y truncado: respeta account_inventory_status, query_truncation, inventory_truncated, graph_freshness, definition_freshness y los estados de cobertura. Unknown, empty, unavailable y partial no significan cero. El grafo estructural describe pasos y enlaces observados, sin revelar IDs ni contenido. No infieras filtros, consentimiento, exclusiones o elegibilidad de perfiles a partir de conteos.\n\nLas métricas comparan dos meses calendario completos, consecutivos y sin solapamiento. Solo usa revenue si la moneda está verificada para todas las cuentas de la tienda; en otro caso las cifras ya se han omitido. Atribución de Klaviyo no demuestra incrementalidad ni causalidad. No sumes monedas o canales.\n\nPara una propuesta vinculada a Mi Camino copia plan_id, plan_version, plan_revision y milestone_id únicamente del plan activo aprobado de esta tienda. Si falta o no hay plan, deja la alineación vacía y explica la limitación; no inventes IDs ni recurras a un hito actual por defecto. A20 define el objetivo de retención y el segmento; A28 diseña la automatización. Coordina conflictos con A05 y campañas, A11 y A26 para email, A27 para calendario/frecuencia, y A20 para cohortes. Una aprobación solo crea una tarea revisable y su enlace exacto al Camino; no acredita implementación en Klaviyo.\n\nReglas del objeto: design_proposal necesita al menos un candidato; no_change no admite candidatos. Los pasos son únicos y consecutivos desde 1, hasta ocho. verified requiere evidencia observada en el contexto; si no puede demostrarse, usa un estado no verificado. Las propuestas de medición no deben contener comunicaciones. Cada proposed_write debe ser una tarea breve, sin duplicar tareas abiertas y con evidencia; como máximo cuatro. En cada tarea incluye architecture_candidate_index (índice base cero del candidato) y source_flow_refs exactamente iguales a los de ese candidato. Aprobación y materialización revalidan tienda, plan, candidato, flows y revisión exacta.\n','UTF8')),'hex')
from public.prompt_versions p where p.code='a28_arquitecto_flujos_system' and p.version='v2'
on conflict(code,version) do update set content=excluded.content,checksum=excluded.checksum;

insert into public.agent_versions(definition_id,version,model,prompt_code,prompt_version,allowed_tools,approval_mode,output_schema_version,config,is_active)
select v.definition_id,'v3',v.model,v.prompt_code,'v3',v.allowed_tools,v.approval_mode,'v3',v.config,false from public.agent_versions v
join public.agent_definitions d on d.id=v.definition_id where d.code='a28_arquitecto_flujos' and v.version='v2'
on conflict(definition_id,version) do update set model=excluded.model,prompt_code=excluded.prompt_code,prompt_version=excluded.prompt_version,
  allowed_tools=excluded.allowed_tools,approval_mode=excluded.approval_mode,output_schema_version=excluded.output_schema_version,config=excluded.config;

select public.promote_agent_version(v.id)
from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id
where d.code='a28_arquitecto_flujos' and v.version='v3';

do $a28_contract$
begin
  if not exists(select 1 from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id
    join public.prompt_versions p on p.code=v.prompt_code and p.version=v.prompt_version
    where d.code='a28_arquitecto_flujos' and v.version='v3' and v.is_active and v.output_schema_version='v3'
      and v.allowed_tools='["search_knowledge"]'::jsonb and position('EJECUCIÓN, EVIDENCIA Y COORDINACIÓN A28' in p.content)>0
      and position('plan_revision' in p.content)>0 and position('no modifica, activa, pausa ni envía flows' in p.content)>0) then
    raise exception 'AI_A28_ARCHITECT_VERIFIED_COORDINATION_INCOMPLETE'; end if;
end
$a28_contract$;

notify pgrst,'reload schema';
