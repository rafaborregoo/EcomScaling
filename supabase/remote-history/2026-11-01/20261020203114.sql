-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
create or replace function public.materialize_retention_opportunity(p_organization_id uuid,p_opportunity_id uuid,p_output_id uuid,p_proposal_index integer,p_actor_user_id uuid,p_task jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.retention_opportunities%rowtype;v_task uuid;v_agent text;v_position integer:=0;v_revision integer;
begin
 select * into o from public.retention_opportunities where id=p_opportunity_id and organization_id=p_organization_id for update;
 if not found then return jsonb_build_object('status','not_found'); end if;
 if o.task_id is not null and o.status<>'rejected' then return jsonb_build_object('status','materialized','task_id',o.task_id,'created',false); end if;
 if o.status<>'proposed' or o.source_output_id<>p_output_id or o.proposal_index<>p_proposal_index then return jsonb_build_object('status','stale_opportunity'); end if;
 if not exists(select 1 from public.agent_outputs ao join public.agent_runs r on r.id=ao.run_id where ao.id=p_output_id and ao.status='pending_approval' and r.store_id=o.store_id and r.organization_id=o.organization_id) then return jsonb_build_object('status','output_not_pending'); end if;
 if (o.snapshot->>'as_of')::timestamptz<now()-interval '48 hours' then return jsonb_build_object('status','evidence_expired'); end if;
 if o.plan_id is distinct from (select p.id from public.strategic_plans p where p.organization_id=o.organization_id and p.store_id=o.store_id and p.status='active' and p.approved_at is not null order by p.version desc limit 1) then return jsonb_build_object('status','plan_changed'); end if;
 if o.plan_id is not null then
  select revision into v_revision from public.strategic_plans where id=o.plan_id and organization_id=o.organization_id and store_id=o.store_id and status='active' and approved_at is not null for update;
  if v_revision is distinct from o.plan_revision then return jsonb_build_object('status','plan_changed'); end if;
 end if;
 if o.milestone_id is not null and not exists(select 1 from public.strategic_plan_milestones m join public.strategic_plan_phases ph on ph.id=m.phase_id where m.id=o.milestone_id and ph.plan_id=o.plan_id and m.status in ('pending','in_progress')) then return jsonb_build_object('status','milestone_changed'); end if;
 insert into public.tasks(organization_id,store_id,source,priority,title,description,created_by,assigned_to,metadata,categories,agent_output_id,agent_proposal_index)
 values(o.organization_id,o.store_id,'ai_consultant',coalesce(p_task->>'priority','medium')::public.task_priority,p_task->>'title',p_task->>'description',p_actor_user_id,nullif(p_task->>'assigned_to','')::uuid,
  coalesce(p_task->'metadata','{}'::jsonb)||jsonb_build_object('retention_opportunity_id',o.id,'retention_measurement',o.brief->'measurement','retention_brief',o.brief),array['shopify'],p_output_id,p_proposal_index)
 on conflict(agent_output_id,agent_proposal_index) do nothing returning id into v_task;
 if v_task is null then select id into v_task from public.tasks where organization_id=o.organization_id and store_id=o.store_id and agent_output_id=p_output_id and agent_proposal_index=p_proposal_index; end if;
 if v_task is null then raise exception 'retention_task_materialization_failed'; end if;
 if o.milestone_id is not null then insert into public.milestone_task_links(organization_id,milestone_id,task_id) values(o.organization_id,o.milestone_id,v_task) on conflict(milestone_id,task_id) do nothing; end if;
 for v_agent in select jsonb_array_elements_text(o.brief->'route') loop
  insert into public.retention_handoffs(opportunity_id,agent_code,position,status) values(o.id,v_agent,v_position,case when v_position=0 then 'ready' else 'blocked' end) on conflict do nothing;
  v_position:=v_position+1;
 end loop;
 update public.retention_opportunities set status='accepted',task_id=v_task,decided_by=p_actor_user_id,version=version+1,updated_at=now() where id=o.id;
 insert into public.retention_opportunity_events(opportunity_id,request_id,action,actor_user_id,before_state,after_state,reason) values(o.id,gen_random_uuid(),'accepted',p_actor_user_id,to_jsonb(o),jsonb_build_object('task_id',v_task),'Aprobación de la oportunidad y sus entregables; no autoriza envíos ni gasto.');
 return jsonb_build_object('status','materialized','task_id',v_task,'created',true);
end $$;

create or replace function public.persist_retention_agent_output(p_job_id uuid,p_token uuid,p_run_id uuid,p_output jsonb,p_approval_required boolean,p_schema_version text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.retention_generation_jobs%rowtype;r public.agent_runs%rowtype;v_output public.agent_outputs%rowtype;
begin
 select * into j from public.retention_generation_jobs where id=p_job_id for update;
 if not found or j.token<>p_token or j.status<>'running' or j.lease_expires_at<=now() then raise exception 'retention_generation_lease_lost'; end if;
 select * into r from public.agent_runs where id=p_run_id;
 if not found or r.organization_id<>j.organization_id or r.store_id is distinct from j.store_id or p_output->'retention_snapshot'->>'digest' is distinct from j.digest then raise exception 'retention_generation_scope_invalid';end if;
 insert into public.agent_outputs(run_id,organization_id,schema_version,output,approval_required,status) values(r.id,r.organization_id,p_schema_version,p_output,p_approval_required,case when p_approval_required then 'pending_approval' else 'approved' end) returning * into v_output;
 perform public.persist_retention_opportunities(v_output.id,p_output->'retention_snapshot',coalesce(p_output->'opportunities','[]'));
 perform public.finish_retention_generation(j.id,p_token,v_output.id,null);
 return jsonb_build_object('id',v_output.id,'status',v_output.status,'created_at',v_output.created_at);
end $$;
revoke all on function public.persist_retention_agent_output(uuid,uuid,uuid,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.persist_retention_agent_output(uuid,uuid,uuid,jsonb,boolean,text) to service_role;


