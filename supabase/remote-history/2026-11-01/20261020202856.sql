-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A20: generation evidence dedupe, null-safe measurement and durable output receipts.
create or replace function public.claim_retention_generation(p_organization_id uuid,p_store_id uuid,p_request_key text,p_digest text,p_token uuid,p_limit integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.retention_generation_jobs%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('a20:'||p_organization_id::text||':'||p_store_id::text,0));
 select * into j from public.retention_generation_jobs where organization_id=p_organization_id and store_id=p_store_id and digest=p_digest and status='succeeded' and created_at>=now()-interval '20 hours' order by created_at desc limit 1;
 if found then return to_jsonb(j)||jsonb_build_object('claimed',false); end if;
 select * into j from public.retention_generation_jobs where organization_id=p_organization_id and store_id=p_store_id and request_key=p_request_key for update;
 if found and (j.status='succeeded' or (j.status='running' and j.lease_expires_at>now())) then return to_jsonb(j)||jsonb_build_object('claimed',false); end if;
 if exists(select 1 from public.retention_generation_jobs where organization_id=p_organization_id and store_id=p_store_id and status='running' and lease_expires_at>now()) then return jsonb_build_object('claimed',false,'status','running'); end if;
 if (select count(*) from public.retention_generation_jobs where organization_id=p_organization_id and store_id=p_store_id and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=p_limit then return jsonb_build_object('claimed',false,'status','quota_exceeded'); end if;
 insert into public.retention_generation_jobs(organization_id,store_id,request_key,digest,token,status,lease_expires_at) values(p_organization_id,p_store_id,p_request_key,p_digest,p_token,'running',now()+interval '15 minutes')
 on conflict(organization_id,store_id,request_key) do update set token=excluded.token,status='running',lease_expires_at=excluded.lease_expires_at,digest=excluded.digest,updated_at=now() returning * into j;
 return to_jsonb(j)||jsonb_build_object('claimed',true);
end $$;
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
  update public.retention_opportunities set status='measuring',review_due_at=now()+make_interval(days=greatest(30,least(180,(brief->>'evaluation_days')::integer))),outcome=jsonb_build_object('status','pending_maturity','started_at',now(),'execution_reference',p_reason,'causal_claim',false) where id=o.id;
 elsif p_action='evaluate' and o.status='measuring' and o.review_due_at<=now() then
  if p_result is null or coalesce(p_result->>'status','') not in ('improved','unchanged','worse','not_measurable') or coalesce(jsonb_typeof(p_result->'evidence'),'null')<>'array' or jsonb_array_length(p_result->'evidence')=0 then return jsonb_build_object('ok',false,'reason','measurement_evidence_required'); end if;
  update public.retention_opportunities set status='evaluated',outcome=p_result||jsonb_build_object('verification','human_declared','causal_claim',false,'measured_at',now()) where id=o.id;
 else return jsonb_build_object('ok',false,'reason','invalid_transition'); end if;
 update public.retention_opportunities set version=version+1,updated_at=now(),decided_by=p_actor_user_id where id=o.id returning to_jsonb(retention_opportunities.*) into v_new;
 insert into public.retention_opportunity_events(opportunity_id,request_id,action,actor_user_id,before_state,after_state,reason) values(o.id,p_request_id,p_action,p_actor_user_id,to_jsonb(o),v_new,p_reason);
 return jsonb_build_object('ok',true,'state',v_new);
end $$;


create or replace function public.retention_output_lifecycle() returns trigger language plpgsql security invoker set search_path='' as $$
declare r record;o public.retention_opportunities%rowtype;v_after jsonb;
begin
 if TG_OP='INSERT' then
  select ar.organization_id,ar.store_id,d.code into r from public.agent_runs ar join public.agent_versions v on v.id=ar.agent_version_id join public.agent_definitions d on d.id=v.definition_id where ar.id=new.run_id;
  if r.store_id is not null then perform public.record_retention_analysis_receipt(r.organization_id,r.store_id,r.code,new.id); end if;
 end if;
 if TG_OP='UPDATE' then
  for o in select * from public.retention_opportunities where source_output_id=new.id and status='proposed' and (
   new.status='rejected' or exists(select 1 from jsonb_array_elements(coalesce(new.output->'proposal_edits','[]')) e where (e->>'index')::integer=proposal_index and e->>'skip'='true')
  ) for update loop
   update public.retention_opportunities set status='rejected',version=version+1,updated_at=now() where id=o.id returning to_jsonb(retention_opportunities.*) into v_after;
   if new.decided_by is not null then insert into public.retention_opportunity_events(opportunity_id,request_id,action,actor_user_id,before_state,after_state,reason) values(o.id,gen_random_uuid(),'reject',new.decided_by,to_jsonb(o),v_after,'Decisi?n registrada desde la revisi?n de propuestas'); end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function public.retention_output_lifecycle() from public,anon,authenticated;
grant execute on function public.retention_output_lifecycle() to service_role;
create trigger retention_output_lifecycle after insert or update of status,output on public.agent_outputs for each row execute function public.retention_output_lifecycle();


