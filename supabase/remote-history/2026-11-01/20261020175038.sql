-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A19: durable Camino runs, scoped reads, CAS decisions and atomic transitions.

alter table public.strategic_plans add column if not exists revision integer not null default 1;
create or replace function public.bump_strategic_plan_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'revision' - 'updated_at') is distinct from (to_jsonb(old) - 'revision' - 'updated_at') then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;
drop trigger if exists strategic_plans_bump_revision on public.strategic_plans;
create trigger strategic_plans_bump_revision before update on public.strategic_plans
for each row execute function public.bump_strategic_plan_revision();

alter table public.strategic_plan_weekly_reviews
  add column if not exists attempt_token uuid,
  add column if not exists plan_revision integer,
  add column if not exists plan_snapshot_hash text,
  add column if not exists output_hash text;
alter table public.strategic_plan_change_proposals
  add column if not exists source_output_id uuid references public.agent_outputs(id) on delete set null;
alter table public.strategic_plan_change_proposal_events
  add column if not exists request_id uuid,
  add column if not exists applied_entity_id uuid,
  add column if not exists before_state jsonb,
  add column if not exists after_state jsonb;
create unique index if not exists strategic_plan_proposal_events_request_uidx
  on public.strategic_plan_change_proposal_events(proposal_id, request_id) where request_id is not null;
create index if not exists camino_objective_changes_plan_created_idx
  on public.camino_objective_changes(plan_id, created_at desc);

create table if not exists public.camino_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.shopify_stores(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  stage text not null default 'architect',
  progress jsonb not null default '{}'::jsonb,
  plan_output_id uuid references public.agent_outputs(id) on delete set null,
  error_code text,
  error_detail text,
  attempt integer not null default 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, store_id, idempotency_key)
);
create index if not exists camino_generation_jobs_claim_idx
  on public.camino_generation_jobs(status, lease_expires_at, created_at);
alter table public.camino_generation_jobs enable row level security;
revoke all on public.camino_generation_jobs from anon, authenticated;
grant select on public.camino_generation_jobs to authenticated;
drop policy if exists camino_generation_jobs_read_scope on public.camino_generation_jobs;
create policy camino_generation_jobs_read_scope on public.camino_generation_jobs for select to authenticated
using (private.can_access_agent_store_scope(organization_id, store_id));

-- Store-scoped members get only the plan tree and history for their assigned stores.
drop policy if exists strategic_plans_store_scope_select on public.strategic_plans;
create policy strategic_plans_store_scope_select on public.strategic_plans for select to authenticated
using (private.can_access_agent_store_scope(organization_id, store_id));
drop policy if exists strategic_plan_phases_store_scope_select on public.strategic_plan_phases;
create policy strategic_plan_phases_store_scope_select on public.strategic_plan_phases for select to authenticated
using (exists (select 1 from public.strategic_plans p where p.id=plan_id and private.can_access_agent_store_scope(p.organization_id,p.store_id)));
drop policy if exists strategic_plan_milestones_store_scope_select on public.strategic_plan_milestones;
create policy strategic_plan_milestones_store_scope_select on public.strategic_plan_milestones for select to authenticated
using (exists (select 1 from public.strategic_plan_phases ph join public.strategic_plans p on p.id=ph.plan_id where ph.id=phase_id and private.can_access_agent_store_scope(p.organization_id,p.store_id)));
drop policy if exists strategic_plan_weekly_reviews_store_scope_select on public.strategic_plan_weekly_reviews;
create policy strategic_plan_weekly_reviews_store_scope_select on public.strategic_plan_weekly_reviews for select to authenticated
using (exists (select 1 from public.strategic_plans p where p.id=plan_id and private.can_access_agent_store_scope(p.organization_id,p.store_id)));
drop policy if exists strategic_plan_change_proposals_store_scope_select on public.strategic_plan_change_proposals;
create policy strategic_plan_change_proposals_store_scope_select on public.strategic_plan_change_proposals for select to authenticated
using (exists (select 1 from public.strategic_plans p where p.id=plan_id and private.can_access_agent_store_scope(p.organization_id,p.store_id)));
drop policy if exists strategic_plan_change_proposal_events_store_scope_select on public.strategic_plan_change_proposal_events;
create policy strategic_plan_change_proposal_events_store_scope_select on public.strategic_plan_change_proposal_events for select to authenticated
using (exists (select 1 from public.strategic_plan_change_proposals cp join public.strategic_plans p on p.id=cp.plan_id where cp.id=proposal_id and private.can_access_agent_store_scope(p.organization_id,p.store_id)));
drop policy if exists camino_objective_changes_store_scope_select on public.camino_objective_changes;
create policy camino_objective_changes_store_scope_select on public.camino_objective_changes for select to authenticated
using (private.can_access_agent_store_scope(organization_id,store_id));
drop policy if exists strategic_plans_store_scope_guard on public.strategic_plans;
create policy strategic_plans_store_scope_guard on public.strategic_plans as restrictive for select to authenticated
using (private.can_access_agent_store_scope(organization_id, store_id));
drop policy if exists strategic_plan_phases_store_scope_guard on public.strategic_plan_phases;
create policy strategic_plan_phases_store_scope_guard on public.strategic_plan_phases as restrictive for select to authenticated
using (exists (select 1 from public.strategic_plans p where p.id = plan_id and private.can_access_agent_store_scope(p.organization_id,p.store_id)));
drop policy if exists strategic_plan_milestones_store_scope_guard on public.strategic_plan_milestones;
create policy strategic_plan_milestones_store_scope_guard on public.strategic_plan_milestones as restrictive for select to authenticated
using (exists (select 1 from public.strategic_plan_phases ph join public.strategic_plans p on p.id=ph.plan_id where ph.id=phase_id and private.can_access_agent_store_scope(p.organization_id,p.store_id)));
drop policy if exists strategic_plan_weekly_reviews_store_scope_guard on public.strategic_plan_weekly_reviews;
create policy strategic_plan_weekly_reviews_store_scope_guard on public.strategic_plan_weekly_reviews as restrictive for select to authenticated
using (exists (select 1 from public.strategic_plans p where p.id=plan_id and private.can_access_agent_store_scope(p.organization_id,p.store_id)));
drop policy if exists strategic_plan_change_proposals_store_scope_guard on public.strategic_plan_change_proposals;
create policy strategic_plan_change_proposals_store_scope_guard on public.strategic_plan_change_proposals as restrictive for select to authenticated
using (exists (select 1 from public.strategic_plans p where p.id=plan_id and private.can_access_agent_store_scope(p.organization_id,p.store_id)));
drop policy if exists strategic_plan_change_proposal_events_store_scope_guard on public.strategic_plan_change_proposal_events;
create policy strategic_plan_change_proposal_events_store_scope_guard on public.strategic_plan_change_proposal_events as restrictive for select to authenticated
using (exists (select 1 from public.strategic_plan_change_proposals cp join public.strategic_plans p on p.id=cp.plan_id where cp.id=proposal_id and private.can_access_agent_store_scope(p.organization_id,p.store_id)));
drop policy if exists camino_objective_changes_store_scope_guard on public.camino_objective_changes;
create policy camino_objective_changes_store_scope_guard on public.camino_objective_changes as restrictive for select to authenticated
using (private.can_access_agent_store_scope(organization_id,store_id));

create or replace function public.activate_strategic_plan_atomic(
  p_organization_id uuid, p_plan_id uuid, p_user_id uuid, p_activated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_plan public.strategic_plans%rowtype; v_count integer;
begin
  select * into v_plan from public.strategic_plans where id=p_plan_id and organization_id=p_organization_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if v_plan.status='active' then return jsonb_build_object('ok',true,'already_active',true,'id',p_plan_id); end if;
  if v_plan.status <> 'draft' then return jsonb_build_object('ok',false,'reason','invalid_state'); end if;
  update public.strategic_plans set status='active', starts_on=coalesce(starts_on,(p_activated_at at time zone 'UTC')::date), approved_by=p_user_id, approved_at=p_activated_at where id=p_plan_id;
  with ordered as (select id,row_number() over(order by position,id) as n from public.strategic_plan_phases where plan_id=p_plan_id)
  update public.strategic_plan_phases ph set status=case when o.n=1 then 'active' else 'pending' end,
    activated_at=case when o.n=1 then p_activated_at else null end,
    activated_by=case when o.n=1 then p_user_id else null end
  from ordered o where ph.id=o.id;
  with ordered as (select m.id,row_number() over(partition by ph.id order by m.position,m.id) as n, ph.position as phase_position
      from public.strategic_plan_milestones m join public.strategic_plan_phases ph on ph.id=m.phase_id where ph.plan_id=p_plan_id)
  update public.strategic_plan_milestones m set status=case when o.phase_position=1 and o.n=1 then 'pending' when o.phase_position=1 then 'pending' else 'locked' end
  from ordered o where m.id=o.id;
  select count(*) into v_count from public.strategic_plan_phases where plan_id=p_plan_id;
  if v_count=0 then raise exception 'plan_has_no_phases'; end if;
  return jsonb_build_object('ok',true,'id',p_plan_id,'status','active','revision',(select revision from public.strategic_plans where id=p_plan_id));
end;
$$;
revoke all on function public.activate_strategic_plan_atomic(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.activate_strategic_plan_atomic(uuid,uuid,uuid,timestamptz) to service_role;

create or replace function public.record_camino_proposal_decision(
 p_organization_id uuid,p_plan_id uuid,p_proposal_id uuid,p_user_id uuid,p_actor_role text,
 p_action text,p_reason text,p_edited_proposal jsonb,p_expected_event_id uuid,p_request_id uuid,p_applied_entity_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_event public.strategic_plan_change_proposal_events%rowtype; v_last uuid; v_previous text; v_new uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_proposal_id::text,0));
 if p_request_id is not null then
   select id into v_new from public.strategic_plan_change_proposal_events where proposal_id=p_proposal_id and request_id=p_request_id;
   if v_new is not null then return jsonb_build_object('ok',true,'id',v_new,'idempotent',true); end if;
 end if;
 select id into v_last from public.strategic_plan_change_proposal_events where proposal_id=p_proposal_id order by created_at desc,id desc limit 1;
 if v_last is distinct from p_expected_event_id then return jsonb_build_object('ok',false,'reason','stale'); end if;
 select action into v_previous from public.strategic_plan_change_proposal_events where id=v_last;
 if p_action not in ('accepted','rejected','edited','completed') then return jsonb_build_object('ok',false,'reason','invalid_action'); end if;
 if (p_action='completed' and v_previous not in ('accepted','edited')) or (p_action in ('accepted','rejected') and coalesce(v_previous,'pending') not in ('pending','edited')) or (p_action='edited' and coalesce(v_previous,'pending') not in ('pending','accepted','edited')) then
   return jsonb_build_object('ok',false,'reason','invalid_transition');
 end if;
 if p_action='completed' and p_applied_entity_id is null then return jsonb_build_object('ok',false,'reason','application_reference_required'); end if;
 insert into public.strategic_plan_change_proposal_events(proposal_id,organization_id,action,actor_user_id,actor_role,reason,edited_proposal,request_id,applied_entity_id)
 select p_proposal_id,p_organization_id,p_action,p_user_id,p_actor_role,nullif(p_reason,''),p_edited_proposal,p_request_id,p_applied_entity_id
 where exists(select 1 from public.strategic_plan_change_proposals cp join public.strategic_plans p on p.id=cp.plan_id where cp.id=p_proposal_id and cp.plan_id=p_plan_id and cp.organization_id=p_organization_id and p.status='active')
 on conflict (proposal_id,request_id) where request_id is not null do nothing
 returning id into v_new;
 if v_new is null then
   select id into v_new from public.strategic_plan_change_proposal_events where proposal_id=p_proposal_id and request_id=p_request_id;
   if v_new is not null then return jsonb_build_object('ok',true,'id',v_new,'idempotent',true); end if;
   return jsonb_build_object('ok',false,'reason','not_found_or_not_active');
 end if;
 return jsonb_build_object('ok',true,'id',v_new);
end;
$$;
revoke all on function public.record_camino_proposal_decision(uuid,uuid,uuid,uuid,text,text,text,jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_camino_proposal_decision(uuid,uuid,uuid,uuid,text,text,text,jsonb,uuid,uuid,uuid) to service_role;

create or replace function public.claim_camino_generation_job(
 p_organization_id uuid,p_store_id uuid,p_actor_user_id uuid,p_idempotency_key text,p_lease_token uuid
) returns public.camino_generation_jobs language plpgsql security definer set search_path = '' as $$
declare v_job public.camino_generation_jobs%rowtype;
begin
 insert into public.camino_generation_jobs(organization_id,store_id,actor_user_id,idempotency_key,status,lease_token,lease_expires_at,started_at,attempt)
 values(p_organization_id,p_store_id,p_actor_user_id,p_idempotency_key,'running',p_lease_token,now()+interval '35 minutes',now(),1)
 on conflict(organization_id,store_id,idempotency_key) do nothing;
 select * into v_job from public.camino_generation_jobs where organization_id=p_organization_id and store_id is not distinct from p_store_id and idempotency_key=p_idempotency_key for update;
 if v_job.status='failed' or (v_job.status='running' and v_job.lease_expires_at < now()) or v_job.status='queued' then
   update public.camino_generation_jobs set status='running',attempt=attempt+1,lease_token=p_lease_token,lease_expires_at=now()+interval '35 minutes',started_at=coalesce(started_at,now()),error_code=null,error_detail=null,updated_at=now() where id=v_job.id returning * into v_job;
 end if;
 return v_job;
end;
$$;
revoke all on function public.claim_camino_generation_job(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_camino_generation_job(uuid,uuid,uuid,text,uuid) to service_role;

create or replace function public.finish_camino_generation_job(
 p_job_id uuid,p_lease_token uuid,p_status text,p_stage text,p_progress jsonb,p_output_id uuid,p_error_code text,p_error_detail text
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
 update public.camino_generation_jobs set status=p_status,stage=p_stage,progress=coalesce(p_progress,'{}'::jsonb),plan_output_id=coalesce(p_output_id,plan_output_id),error_code=p_error_code,error_detail=p_error_detail,finished_at=case when p_status in ('succeeded','failed') then now() else null end,lease_expires_at=case when p_status in ('succeeded','failed') then null else now()+interval '35 minutes' end,updated_at=now()
 where id=p_job_id and lease_token=p_lease_token and status='running';
 return found;
end;
$$;
revoke all on function public.finish_camino_generation_job(uuid,uuid,text,text,jsonb,uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_camino_generation_job(uuid,uuid,text,text,jsonb,uuid,text,text) to service_role;

create or replace view public.camino_pending_change_inbox with (security_invoker=true) as
select cp.id proposal_id,cp.plan_id,cp.weekly_review_id,cp.organization_id,cp.source_output_id,cp.proposal_index,cp.proposal,cp.created_at,
  latest.action decision_status,latest.id latest_event_id,latest.created_at decision_at,latest.edited_proposal current_proposal
from public.strategic_plan_change_proposals cp
left join lateral (select e.id,e.action,e.created_at,e.edited_proposal from public.strategic_plan_change_proposal_events e where e.proposal_id=cp.id order by e.created_at desc,e.id desc limit 1) latest on true
where latest.action is null or latest.action in ('accepted','edited');
grant select on public.camino_pending_change_inbox to authenticated,service_role;

comment on table public.camino_generation_jobs is 'A19 durable architect/detailer job with lease fencing and caller-provided idempotency key.';
comment on column public.strategic_plan_weekly_reviews.plan_revision is 'Plan revision measured by this review; null for historical rows.';

create or replace function public.finalize_camino_review(
 p_review_id uuid,p_attempt_token uuid,p_plan_id uuid,p_expected_plan_revision integer,p_output_id uuid,p_output jsonb,p_output_hash text,p_proposals jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_plan_revision integer; v_org uuid; v_expected uuid; v_item jsonb; v_index integer:=0;
begin
 select organization_id,revision into v_org,v_plan_revision from public.strategic_plans where id=p_plan_id and status='active' for update;
 if v_org is null or v_plan_revision is distinct from p_expected_plan_revision then return jsonb_build_object('ok',false,'reason','plan_changed'); end if;
 select attempt_token into v_expected from public.strategic_plan_weekly_reviews where id=p_review_id and plan_id=p_plan_id and status='running' for update;
 if v_expected is distinct from p_attempt_token then return jsonb_build_object('ok',false,'reason','lease_lost'); end if;
 update public.agent_outputs set output=p_output where id=p_output_id and organization_id=v_org;
 if not found then return jsonb_build_object('ok',false,'reason','output_missing'); end if;
 delete from public.strategic_plan_change_proposals where weekly_review_id=p_review_id;
 for v_item in select value from jsonb_array_elements(coalesce(p_proposals,'[]'::jsonb)) loop
   insert into public.strategic_plan_change_proposals(organization_id,plan_id,weekly_review_id,source_output_id,proposal_index,proposal)
   values(v_org,p_plan_id,p_review_id,p_output_id,v_index,v_item);
   v_index:=v_index+1;
 end loop;
 update public.strategic_plan_weekly_reviews set status='succeeded',output_id=p_output_id,output_hash=p_output_hash,plan_revision=v_plan_revision,error=null,updated_at=now()
 where id=p_review_id and attempt_token=p_attempt_token and status='running';
 if not found then raise exception 'camino_review_lease_lost'; end if;
 return jsonb_build_object('ok',true,'proposal_count',v_index);
end;
$$;
revoke all on function public.finalize_camino_review(uuid,uuid,uuid,integer,uuid,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_camino_review(uuid,uuid,uuid,integer,uuid,jsonb,text,jsonb) to service_role;

create or replace function public.replace_strategic_plan_tree_atomic(
 p_organization_id uuid,p_user_id uuid,p_store_id uuid,p_old_plan_id uuid,p_output_id uuid,p_plan jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_old public.strategic_plans%rowtype; v_new uuid; v_new_task record; v_old_task uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || coalesce(p_store_id::text,'org'),0));
 select * into v_old from public.strategic_plans where id=p_old_plan_id and organization_id=p_organization_id and store_id is not distinct from p_store_id for update;
 if not found or v_old.status not in ('draft','active') then raise exception 'plan_replace_stale'; end if;
 if p_output_id is null or not exists(select 1 from public.agent_outputs o where o.id=p_output_id and o.organization_id=p_organization_id and o.status='pending_approval') then raise exception 'camino_output_not_pending'; end if;
 update public.strategic_plans set status='archived' where id=p_old_plan_id and status in ('draft','active');
 v_new := public.create_strategic_plan_tree(p_organization_id,p_user_id,p_store_id,p_output_id,p_plan);
 -- Keep the same task identity across a replan when a pending commitment has
 -- the same normalized title in this store. Closed/done work is never reopened.
 for v_new_task in
   select l.id link_id,t.id task_id,t.title
   from public.strategic_plan_phases ph join public.strategic_plan_milestones m on m.phase_id=ph.id
   join public.milestone_task_links l on l.milestone_id=m.id join public.tasks t on t.id=l.task_id
   where ph.plan_id=v_new
 loop
   select old_t.id into v_old_task
   from public.strategic_plan_phases old_ph join public.strategic_plan_milestones old_m on old_m.phase_id=old_ph.id
   join public.milestone_task_links old_l on old_l.milestone_id=old_m.id join public.tasks old_t on old_t.id=old_l.task_id
   where old_ph.plan_id=p_old_plan_id and old_t.organization_id=p_organization_id
     and old_t.store_id is not distinct from p_store_id and old_t.status in ('pending','in_progress')
     and lower(regexp_replace(trim(old_t.title),'[^[:alnum:]]+',' ','g'))=lower(regexp_replace(trim(v_new_task.title),'[^[:alnum:]]+',' ','g'))
   order by old_t.updated_at desc limit 1;
   if v_old_task is not null then
     update public.milestone_task_links set task_id=v_old_task where id=v_new_task.link_id;
     delete from public.tasks where id=v_new_task.task_id and not exists(select 1 from public.milestone_task_links x where x.task_id=v_new_task.task_id);
     v_old_task:=null;
   end if;
 end loop;
 return v_new;
end;
$$;
revoke all on function public.replace_strategic_plan_tree_atomic(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.replace_strategic_plan_tree_atomic(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.create_camino_proposal_plan_atomic(
 p_organization_id uuid,p_user_id uuid,p_store_id uuid,p_replace_plan_id uuid,p_output_id uuid,p_plan jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_new uuid;
begin
 if p_output_id is null or not exists(
   select 1 from public.agent_outputs o join public.agent_runs r on r.id=o.run_id
   join public.agent_versions av on av.id=r.agent_version_id join public.agent_definitions ad on ad.id=av.definition_id
   where o.id=p_output_id and o.organization_id=p_organization_id and o.status='pending_approval' and ad.code='a19_arquitecto_camino'
 ) then raise exception 'camino_output_not_pending'; end if;
 if p_replace_plan_id is not null then
   return public.replace_strategic_plan_tree_atomic(p_organization_id,p_user_id,p_store_id,p_replace_plan_id,p_output_id,p_plan);
 end if;
 return public.create_strategic_plan_tree(p_organization_id,p_user_id,p_store_id,p_output_id,p_plan);
end;
$$;
revoke all on function public.create_camino_proposal_plan_atomic(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_camino_proposal_plan_atomic(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.bump_camino_revision_from_child()
returns trigger language plpgsql set search_path = '' as $$
declare v_plan_id uuid;
begin
 if tg_table_name='strategic_plan_phases' then
   v_plan_id:=case when tg_op='DELETE' then old.plan_id else new.plan_id end;
 else
   select plan_id into v_plan_id from public.strategic_plan_phases where id=case when tg_op='DELETE' then old.phase_id else new.phase_id end;
 end if;
 if v_plan_id is not null then update public.strategic_plans set revision=revision+1,updated_at=now() where id=v_plan_id; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists strategic_plan_phases_bump_parent_revision on public.strategic_plan_phases;
create trigger strategic_plan_phases_bump_parent_revision after insert or update or delete on public.strategic_plan_phases for each row execute function public.bump_camino_revision_from_child();
drop trigger if exists strategic_plan_milestones_bump_parent_revision on public.strategic_plan_milestones;
create trigger strategic_plan_milestones_bump_parent_revision after insert or update or delete on public.strategic_plan_milestones for each row execute function public.bump_camino_revision_from_child();


