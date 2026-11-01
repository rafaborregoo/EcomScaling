-- A24 uses the actual Mi Camino milestone enum; phases keep their own enum.
create or replace function public.materialize_a24_measurement_task(
  p_task jsonb,p_organization_id uuid,p_store_id uuid,p_output_id uuid,p_proposal_index integer,
  p_plan_id uuid,p_plan_version integer,p_milestone_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_task_id uuid; v_created boolean := false;
begin
  if p_task is null or p_organization_id is null or p_store_id is null or p_output_id is null or p_proposal_index is null or p_proposal_index<0 then
    raise exception 'A24_TASK_SCOPE_REQUIRED'; end if;
  if not exists(select 1 from public.shopify_stores s where s.id=p_store_id and s.organization_id=p_organization_id and s.is_active) then
    return jsonb_build_object('status','store_out_of_scope'); end if;
  if not exists(
    select 1 from public.agent_outputs o join public.agent_runs r on r.id=o.run_id
      join public.agent_versions av on av.id=r.agent_version_id join public.agent_definitions d on d.id=av.definition_id
    where o.id=p_output_id and o.organization_id=p_organization_id and o.status='pending_approval'
      and r.organization_id=p_organization_id and r.store_id=p_store_id and d.code='a24_medicion_meta'
  ) then return jsonb_build_object('status','output_not_pending_or_out_of_scope'); end if;
  if exists(select 1 from public.meta_measurement_incidents i where i.organization_id=p_organization_id
    and i.store_id=p_store_id and i.status='open' and i.task_id is not null) then
    return jsonb_build_object('status','incident_task_already_linked'); end if;
  if p_plan_id is not null and not exists(select 1 from public.strategic_plans p where p.id=p_plan_id
    and p.organization_id=p_organization_id and p.store_id=p_store_id and p.status='active'
    and p.approved_at is not null and p.version=p_plan_version) then
    return jsonb_build_object('status','camino_changed_since_analysis'); end if;
  if p_plan_id is null and (p_plan_version is not null or p_milestone_id is not null) then
    return jsonb_build_object('status','invalid_camino_snapshot'); end if;
  if p_milestone_id is not null and not exists(
    select 1 from public.strategic_plan_milestones m join public.strategic_plan_phases ph on ph.id=m.phase_id
      join public.strategic_plans p on p.id=ph.plan_id
    where m.id=p_milestone_id and m.organization_id=p_organization_id and m.status in ('in_progress','pending')
      and ph.status in ('active','pending') and p.id=p_plan_id and p.organization_id=p_organization_id
      and p.store_id=p_store_id and p.version=p_plan_version and p.status='active' and p.approved_at is not null
  ) then return jsonb_build_object('status','milestone_out_of_scope'); end if;
  insert into public.tasks(agent_output_id,agent_proposal_index,organization_id,store_id,source,priority,title,description,created_by,assigned_to,metadata,categories)
  values(p_output_id,p_proposal_index,p_organization_id,p_store_id,'ai_consultant',coalesce(p_task->>'priority','medium')::public.task_priority,
    coalesce(p_task->>'title','Revisión de medición Meta'),coalesce(p_task->>'description',''),
    nullif(p_task->>'created_by','')::uuid,nullif(p_task->>'assigned_to','')::uuid,
    coalesce(p_task->'metadata','{}'::jsonb),array(select jsonb_array_elements_text(coalesce(p_task->'categories','[]'::jsonb))))
  on conflict(agent_output_id,agent_proposal_index) do nothing returning id into v_task_id;
  v_created:=v_task_id is not null;
  if v_task_id is null then select t.id into v_task_id from public.tasks t where t.agent_output_id=p_output_id
    and t.agent_proposal_index=p_proposal_index and t.organization_id=p_organization_id and t.store_id=p_store_id; end if;
  if v_task_id is null then raise exception 'A24_TASK_RECOVERY_FAILED'; end if;
  if p_milestone_id is not null then
    insert into public.milestone_task_links(organization_id,milestone_id,task_id) values(p_organization_id,p_milestone_id,v_task_id)
    on conflict(milestone_id,task_id) do nothing;
  end if;
  update public.meta_measurement_incidents i set task_id=v_task_id,output_id=p_output_id,updated_at=now()
    where i.organization_id=p_organization_id and i.store_id=p_store_id and i.status='open' and i.task_id is null;
  return jsonb_build_object('status','materialized','task_id',v_task_id,'created',v_created);
end;
$function$;
revoke all on function public.materialize_a24_measurement_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.materialize_a24_measurement_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid) to service_role;
notify pgrst,'reload schema';
