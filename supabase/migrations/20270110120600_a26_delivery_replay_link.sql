create or replace function public.materialize_a26_content_task(
  p_task jsonb,p_organization_id uuid,p_store_id uuid,p_output_id uuid,p_proposal_index integer,
  p_plan_id uuid,p_plan_version integer,p_milestone_id uuid,p_review_ref text,p_plan_revision integer
) returns jsonb language plpgsql security invoker set search_path='' as $function$
declare v_review public.a26_content_reviews; v_task_id uuid; v_created boolean; v_cursor uuid; v_page jsonb; v_current jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||p_store_id::text||'a26',0));
  if not exists(select 1 from public.agent_outputs o join public.agent_runs r on r.id=o.run_id
    join public.agent_versions av on av.id=r.agent_version_id join public.agent_definitions d on d.id=av.definition_id
    where o.id=p_output_id and o.organization_id=p_organization_id and o.status='pending_approval'
      and r.store_id=p_store_id and r.organization_id=p_organization_id and d.code='a26_contenido_email') then
    return jsonb_build_object('status','output_not_pending_or_out_of_scope'); end if;
  select * into v_review from public.a26_content_reviews where output_id=p_output_id and review_ref=p_review_ref
    and organization_id=p_organization_id and store_id=p_store_id for update;
  if v_review.id is null then return jsonb_build_object('status','review_missing'); end if;
  perform 1 from public.klaviyo_campaign_messages where id=v_review.message_id and organization_id=p_organization_id for share;
  perform 1 from public.klaviyo_flow_messages where id=v_review.message_id and organization_id=p_organization_id for share;
  perform 1 from public.klaviyo_templates where account_id=v_review.account_id and external_template_id=v_review.evidence->>'template_id' for share;
  -- Revalidate the source revision at approval, including templates and message state.
  for i in 1..50 loop
    v_page:=public.a26_email_inventory_page(p_organization_id,p_store_id,v_cursor,100);
    select x into v_current from jsonb_array_elements(v_page->'rows') x where x->>'message_id'=v_review.message_id::text;
    exit when v_current is not null or v_page->>'next_cursor' is null;
    v_cursor:=(v_page->>'next_cursor')::uuid;
  end loop;
  if v_current is null or v_current->>'source_revision' is distinct from v_review.source_revision then
    update public.a26_content_reviews set status='superseded',updated_at=now() where id=v_review.id;
    return jsonb_build_object('status','content_changed_since_analysis'); end if;
  if p_plan_id is not null then
    perform 1 from public.strategic_plans p where p.id=p_plan_id and p.organization_id=p_organization_id
      and p.store_id=p_store_id and p.version=p_plan_version and p.revision=p_plan_revision and p.status='active' and p.approved_at is not null for share;
    if not found then return jsonb_build_object('status','camino_changed_since_analysis'); end if;
  elsif p_plan_version is not null or p_plan_revision is not null or p_milestone_id is not null then
    return jsonb_build_object('status','invalid_camino_snapshot'); end if;
  if p_milestone_id is not null and not exists(select 1 from public.strategic_plan_milestones m
    join public.strategic_plan_phases ph on ph.id=m.phase_id join public.strategic_plans p on p.id=ph.plan_id
    where m.id=p_milestone_id and m.organization_id=p_organization_id and m.status in ('in_progress','pending')
      and ph.status in ('active','pending') and p.id=p_plan_id and p.store_id=p_store_id and p.version=p_plan_version) then
    return jsonb_build_object('status','milestone_out_of_scope'); end if;
  select task_id into v_task_id from public.a26_content_reviews
    where organization_id=p_organization_id and store_id=p_store_id and message_id=v_review.message_id
      and content_hash=v_review.content_hash and review->>'dimension'=v_review.review->>'dimension'
      and task_id is not null order by created_at desc limit 1;
  if v_task_id is not null then
    update public.a26_content_reviews set task_id=v_task_id,delivery_status='materialized',updated_at=now() where id=v_review.id;
    return jsonb_build_object('status','materialized','task_id',v_task_id,'created',false);
  end if;
  insert into public.tasks(agent_output_id,agent_proposal_index,organization_id,store_id,source,priority,title,description,created_by,assigned_to,metadata,categories)
  values(p_output_id,p_proposal_index,p_organization_id,p_store_id,'ai_consultant',coalesce(p_task->>'priority','medium')::public.task_priority,
    p_task->>'title',concat(p_task->>'description',E'\n\nCambio permitido: ',v_review.review->>'permitted_change',E'\nCierre: ',v_review.review->>'acceptance_criterion'),
    nullif(p_task->>'created_by','')::uuid,nullif(p_task->>'assigned_to','')::uuid,
    coalesce(p_task->'metadata','{}'::jsonb)||jsonb_build_object('a26_review_id',v_review.id,'content_hash',v_review.content_hash,'message_id',v_review.message_id),
    array['klaviyo']) on conflict(agent_output_id,agent_proposal_index) do nothing returning id into v_task_id;
  v_created:=v_task_id is not null;
  if v_task_id is null then select id into v_task_id from public.tasks where agent_output_id=p_output_id and agent_proposal_index=p_proposal_index
    and organization_id=p_organization_id and store_id=p_store_id; end if;
  if v_task_id is null then raise exception 'A26_TASK_RECOVERY_FAILED'; end if;
  if p_milestone_id is not null then insert into public.milestone_task_links(organization_id,milestone_id,task_id)
    values(p_organization_id,p_milestone_id,v_task_id) on conflict(milestone_id,task_id) do nothing; end if;
  update public.a26_content_reviews set task_id=v_task_id,delivery_status='materialized',updated_at=now() where id=v_review.id;
  return jsonb_build_object('status','materialized','task_id',v_task_id,'created',v_created);
end;
$function$;
revoke all on function public.materialize_a26_content_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.materialize_a26_content_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid,text,integer) to service_role;



notify pgrst,'reload schema';
