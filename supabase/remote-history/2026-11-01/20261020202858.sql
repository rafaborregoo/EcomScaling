-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Approval actor belongs to agent_approvals, never agent_outputs.
create or replace function public.retention_output_lifecycle() returns trigger language plpgsql security invoker set search_path='' as $$
declare r record;o public.retention_opportunities%rowtype;v_after jsonb;v_actor uuid;
begin
 if TG_OP='INSERT' then
  select ar.organization_id,ar.store_id,d.code into r from public.agent_runs ar join public.agent_versions v on v.id=ar.agent_version_id join public.agent_definitions d on d.id=v.definition_id where ar.id=new.run_id;
  if r.store_id is not null then perform public.record_retention_analysis_receipt(r.organization_id,r.store_id,r.code,new.id); end if;
 end if;
 if TG_OP='UPDATE' then
  select decided_by into v_actor from public.agent_approvals where output_id=new.id;
  for o in select * from public.retention_opportunities where source_output_id=new.id and status='proposed' and (
   new.status='rejected' or exists(select 1 from jsonb_array_elements(coalesce(new.output->'proposal_edits','[]')) e where (e->>'index')::integer=proposal_index and e->>'skip'='true')
  ) for update loop
   update public.retention_opportunities set status='rejected',version=version+1,updated_at=now() where id=o.id returning to_jsonb(retention_opportunities.*) into v_after;
   if v_actor is not null then insert into public.retention_opportunity_events(opportunity_id,request_id,action,actor_user_id,before_state,after_state,reason) values(o.id,gen_random_uuid(),'reject',v_actor,to_jsonb(o),v_after,'Decisi?n registrada desde la revisi?n de propuestas'); end if;
  end loop;
 end if;
 return new;
end $$;


