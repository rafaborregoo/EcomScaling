-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
create or replace function public.transition_retention_opportunity(p_organization_id uuid,p_opportunity_id uuid,p_actor_user_id uuid,p_request_id uuid,p_expected_version integer,p_action text,p_reason text,p_handoff_id uuid default null,p_output_id uuid default null,p_result jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.retention_opportunities%rowtype;h public.retention_handoffs%rowtype;v_new jsonb;v_event jsonb;
begin
 select * into o from public.retention_opportunities where id=p_opportunity_id and organization_id=p_organization_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
 select after_state into v_event from public.retention_opportunity_events where opportunity_id=o.id and request_id=p_request_id;
 if found then return jsonb_build_object('ok',true,'state',v_event,'idempotent',true); end if;
 if o.version<>p_expected_version or length(trim(coalesce(p_reason,'')))<5 then return jsonb_build_object('ok',false,'reason','stale_or_reason_required'); end if;
 if p_action='reject' and o.status='proposed' then
  update public.retention_opportunities set status='rejected' where id=o.id;
 elsif p_action='deliver' and o.status in ('accepted','in_progress') then
  select * into h from public.retention_handoffs where id=p_handoff_id and opportunity_id=o.id and status='ready' for update;
  if not found or not exists(select 1 from public.retention_analysis_receipts rc join public.agent_outputs ao on ao.id=rc.output_id where rc.handoff_id=h.id and rc.output_id=p_output_id and ao.status in ('approved','published')) then return jsonb_build_object('ok',false,'reason','approved_scoped_receipt_required'); end if;
  update public.retention_handoffs set status='delivered',delivered_output_id=p_output_id,delivered_by=p_actor_user_id,delivered_at=now() where id=h.id;
  update public.retention_handoffs set status='ready' where opportunity_id=o.id and position=h.position+1 and status='blocked';
  update public.retention_opportunities set status=case when exists(select 1 from public.retention_handoffs where opportunity_id=o.id and status<>'delivered') then 'in_progress' else 'accepted' end where id=o.id;
 elsif p_action='measure' and o.status in ('accepted','in_progress') and not exists(select 1 from public.retention_handoffs where opportunity_id=o.id and status<>'delivered') then
  update public.retention_opportunities set status='measuring',review_due_at=now()+make_interval(days => greatest(30,least(180,(brief->>'evaluation_days')::integer))),outcome=jsonb_build_object('status','pending_maturity','started_at',now(),'execution_reference',p_reason,'causal_claim',false) where id=o.id;
 elsif p_action='evaluate' and o.status='measuring' and o.review_due_at<=now() then
  if p_result is null or coalesce(p_result->>'status','') not in ('improved','unchanged','worse','not_measurable') or coalesce(jsonb_typeof(p_result->'evidence'),'null')<>'array' or jsonb_array_length(p_result->'evidence')=0 then return jsonb_build_object('ok',false,'reason','measurement_evidence_required'); end if;
  update public.retention_opportunities set status='evaluated',outcome=p_result||jsonb_build_object('verification','human_declared','causal_claim',false,'measured_at',now()) where id=o.id;
 else return jsonb_build_object('ok',false,'reason','invalid_transition'); end if;
 update public.retention_opportunities set version=version+1,updated_at=now(),decided_by=p_actor_user_id where id=o.id returning to_jsonb(retention_opportunities.*) into v_new;
 insert into public.retention_opportunity_events(opportunity_id,request_id,action,actor_user_id,before_state,after_state,reason) values(o.id,p_request_id,p_action,p_actor_user_id,to_jsonb(o),v_new,p_reason);
 return jsonb_build_object('ok',true,'state',v_new);
end $$;




