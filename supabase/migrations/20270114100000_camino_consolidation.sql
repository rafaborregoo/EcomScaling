alter table public.strategic_plan_weekly_reviews add column if not exists goal_snapshot jsonb;
-- Camino: explicit windows, verifiable milestones, atomic decisions and closure history.
alter table public.organization_metric_targets add column if not exists measurement_basis text not null default 'rolling_30_days';
alter table public.organization_metric_targets drop constraint if exists metric_target_measurement_basis;
alter table public.organization_metric_targets add constraint metric_target_measurement_basis check (measurement_basis in ('calendar','rolling_30_days'));
alter table public.strategic_plan_milestones add column if not exists completion_kind text;
alter table public.strategic_plan_milestones add column if not exists verification_snapshot jsonb;
alter table public.strategic_plan_milestones drop constraint if exists camino_completion_kind;
alter table public.strategic_plan_milestones add constraint camino_completion_kind check (completion_kind in ('human','metric','exception'));

create table if not exists public.camino_milestone_verifications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  milestone_id uuid not null references public.strategic_plan_milestones(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id), action text not null,
  evidence text, snapshot jsonb, created_at timestamptz not null default now()
);
create index if not exists camino_verifications_milestone on public.camino_milestone_verifications(milestone_id, created_at desc);
alter table public.camino_milestone_verifications enable row level security;
drop policy if exists camino_verifications_read on public.camino_milestone_verifications;
create policy camino_verifications_read on public.camino_milestone_verifications for select to authenticated using (private.can_access_org(organization_id));
grant select on public.camino_milestone_verifications to authenticated;

create table if not exists public.camino_closures (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.strategic_plans(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id), snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists camino_closures_plan on public.camino_closures(plan_id, created_at desc);
alter table public.camino_closures enable row level security;
drop policy if exists camino_closures_read on public.camino_closures;
create policy camino_closures_read on public.camino_closures for select to authenticated using (private.can_access_org(organization_id));
grant select on public.camino_closures to authenticated;

create table if not exists public.camino_learning_decisions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_id uuid not null references public.strategic_plan_weekly_reviews(id) on delete cascade,
  learning_index integer not null check(learning_index>=0),
  decision text not null check(decision in ('approved','discarded')),
  content jsonb not null, actor_user_id uuid not null references public.profiles(id), updated_at timestamptz not null default now(),
  primary key(review_id,learning_index)
);
alter table public.camino_learning_decisions enable row level security;
drop policy if exists camino_learning_decisions_read on public.camino_learning_decisions;
create policy camino_learning_decisions_read on public.camino_learning_decisions for select to authenticated using(private.can_access_org(organization_id));
grant select on public.camino_learning_decisions to authenticated;

create or replace function public.camino_transition_milestone(
  p_organization_id uuid, p_milestone_id uuid, p_actor_id uuid, p_status text, p_evidence text, p_verification jsonb
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare m public.strategic_plan_milestones; ph public.strategic_plan_phases; pl public.strategic_plans;
  next_phase uuid; kind text; check_row jsonb; obj public.organization_metric_targets; latest_review jsonb;
begin
  -- All transitions for a plan serialize on its root, including two different milestones.
  select p.* into pl from public.strategic_plans p join public.strategic_plan_phases f on f.plan_id=p.id
    join public.strategic_plan_milestones h on h.phase_id=f.id
    where h.id=p_milestone_id and h.organization_id=p_organization_id and p.organization_id=p_organization_id for update of p;
  if not found or pl.status not in ('active','completed') then raise exception 'camino_not_active'; end if;
  select * into m from public.strategic_plan_milestones where id=p_milestone_id and organization_id=p_organization_id for update;
  select * into ph from public.strategic_plan_phases where id=m.phase_id and organization_id=p_organization_id for update;
  if m.status='locked' or p_status not in ('completed','skipped','in_progress') then raise exception 'milestone_not_found_or_locked'; end if;
  if m.status::text=p_status then return jsonb_build_object('id',m.id,'status',m.status,'replayed',true); end if;
  if p_status in ('completed','skipped') and length(trim(coalesce(p_evidence,''))) not between 20 and 2000 then raise exception 'milestone_evidence_required'; end if;
  if p_status='completed' then
    if exists(select 1 from public.milestone_task_links l left join public.tasks t on t.id=l.task_id
      where l.milestone_id=m.id and (t.id is null or t.status in ('pending','in_progress','proposed'))) then raise exception 'milestone_tasks_open'; end if;
    kind := p_verification->>'kind';
    if kind is null or kind not in ('human','metric','exception') then raise exception 'milestone_verification_required'; end if;
    if kind <> 'exception' then
      -- Targets are locked and compared with the exact criteria used for the server measurement.
      for obj in select * from public.organization_metric_targets where milestone_id=m.id and organization_id=p_organization_id
        and valid_from<=current_date and (valid_until is null or valid_until>=current_date) for update loop
        select x into check_row from jsonb_array_elements(coalesce(p_verification->'checks','[]')) x where x->>'id'=obj.id::text;
        if check_row is null or coalesce(jsonb_typeof(check_row->'actual'),'null')<>'number' or (check_row->>'target')::numeric is distinct from obj.target_value
          or check_row->>'metric_key' is distinct from obj.metric_key or check_row->>'period' is distinct from obj.period::text
          or check_row->>'basis' is distinct from obj.measurement_basis
          or coalesce((check_row->>'reached')::boolean,false)=false then raise exception 'milestone_metric_not_met'; end if;
      end loop;
    end if;
  end if;
  update public.strategic_plan_milestones set status=p_status::public.milestone_status,
    completed_at=case when p_status='completed' then now() else null end,
    completed_by=case when p_status='completed' then p_actor_id else null end,
    completion_evidence=case when p_status in ('completed','skipped') then trim(p_evidence) else null end,
    completion_kind=case when p_status='completed' then kind else null end,
    verification_snapshot=case when p_status='completed' then p_verification else null end where id=m.id;
  insert into public.camino_milestone_verifications(organization_id,milestone_id,actor_user_id,action,evidence,snapshot)
    values(p_organization_id,m.id,p_actor_id,p_status,p_evidence,p_verification);
  if p_status='in_progress' then
    update public.strategic_plan_milestones h set status='locked' from public.strategic_plan_phases f
      where h.phase_id=f.id and f.plan_id=pl.id and f.position>ph.position and h.status not in ('completed','skipped');
    update public.strategic_plan_phases set status='pending' where plan_id=pl.id and position>ph.position and status='active';
    update public.strategic_plan_phases set status='active',completed_at=null where id=ph.id;
    update public.strategic_plans set status='active',completed_on=null where id=pl.id;
  elsif not exists(select 1 from public.strategic_plan_milestones where phase_id=ph.id and status not in ('completed','skipped')) then
    update public.strategic_plan_phases set status='completed',completed_at=now() where id=ph.id;
    select id into next_phase from public.strategic_plan_phases where plan_id=pl.id and status in ('pending','locked') order by position limit 1;
    if next_phase is not null then
      update public.strategic_plan_phases set status='active',activated_at=now(),activated_by=p_actor_id where id=next_phase;
      update public.strategic_plan_milestones set status='pending' where phase_id=next_phase and status='locked';
    else
      update public.strategic_plans set status='completed',completed_on=current_date where id=pl.id;
      select jsonb_build_object('period_end',r.period_end,'output',o.output) into latest_review
        from public.strategic_plan_weekly_reviews r join public.agent_outputs o on o.id=r.output_id
        where r.plan_id=pl.id and r.status='succeeded' and r.goal_snapshot=pl.goal and r.period_end>=now()-interval '8 days'
        order by r.created_at desc limit 1;
      insert into public.camino_closures(organization_id,plan_id,actor_user_id,snapshot) values(p_organization_id,pl.id,p_actor_id,
        jsonb_build_object('plan',to_jsonb(pl),'review',latest_review,'milestones',
          (select coalesce(jsonb_agg(to_jsonb(h)),'[]') from public.strategic_plan_milestones h join public.strategic_plan_phases f on f.id=h.phase_id where f.plan_id=pl.id),
          'tasks',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'status',t.status)),'[]')
            from public.tasks t where exists(select 1 from public.milestone_task_links l join public.strategic_plan_milestones h on h.id=l.milestone_id
            join public.strategic_plan_phases f on f.id=h.phase_id where l.task_id=t.id and f.plan_id=pl.id))));
    end if;
  end if;
  return jsonb_build_object('id',m.id,'status',p_status);
end $$;
revoke all on function public.camino_transition_milestone(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.camino_transition_milestone(uuid,uuid,uuid,text,text,jsonb) to service_role;

-- Stored proposals contain a server-captured before value; free text is never executed.
create or replace function public.camino_proposal_decision(
  p_organization_id uuid,p_plan_id uuid,p_proposal_id uuid,p_actor_id uuid,p_actor_role text,
  p_action text,p_reason text,p_expected_event uuid,p_edited jsonb
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare pl public.strategic_plans; pr public.strategic_plan_change_proposals; ev public.strategic_plan_change_proposal_events;
  change jsonb; field text; desired jsonb; before_value jsonb; current_value jsonb; element uuid; event_id uuid; i int;
begin
  select * into pl from public.strategic_plans where id=p_plan_id and organization_id=p_organization_id for update;
  if not found or pl.status<>'active' then raise exception 'camino_not_active'; end if;
  select * into pr from public.strategic_plan_change_proposals where id=p_proposal_id and plan_id=pl.id and organization_id=p_organization_id for update;
  if not found then raise exception 'camino_change_proposal_not_found'; end if;
  select * into ev from public.strategic_plan_change_proposal_events where proposal_id=pr.id order by created_at desc,id desc limit 1;
  if ev.id is distinct from p_expected_event then raise exception 'camino_proposal_decision_stale'; end if;
  if ev.action in ('completed','rejected') then raise exception 'camino_proposal_invalid_transition'; end if;
  if p_action not in ('accepted','rejected','edited','completed','apply') then raise exception 'invalid_camino_proposal_action'; end if;
  if p_action in ('accepted','rejected') and ev.id is not null then raise exception 'camino_proposal_invalid_transition'; end if;
  if p_action='completed' and coalesce(ev.action,'pending') not in ('accepted','edited') then raise exception 'camino_proposal_requires_acceptance'; end if;
  if p_action in ('rejected','completed') and length(trim(coalesce(p_reason,'')))<3 then raise exception 'camino_proposal_reason_required'; end if;
  if p_action='edited' and (p_edited is null or length(trim(p_edited->>'description'))=0) then raise exception 'camino_edited_proposal_fields_required'; end if;
  if p_action='apply' then
    if ev.action='edited' then raise exception 'camino_proposal_manual_edit'; end if;
    change:=pr.proposal->'structured_change'; field:=change->>'field'; desired:=change->'value'; before_value:=change->'before';
    if pr.proposal->>'change'<>'edit' or field is null or desired is null or before_value is null then raise exception 'camino_proposal_not_executable'; end if;
    if pr.proposal->>'target_type'='goal' and field='target' then
      if jsonb_typeof(desired)<>'number' then raise exception 'invalid_goal_target'; end if;
      current_value:=coalesce(pl.goal->'target','null');
      if current_value is distinct from before_value then raise exception 'camino_proposal_target_changed'; end if;
      if pl.goal->'monthly_targets' is not null then
        select (ordinality-1)::int into i from jsonb_array_elements(pl.goal->'monthly_targets') with ordinality where value->'target_value'=current_value limit 1;
        i:=coalesce(i,jsonb_array_length(pl.goal->'monthly_targets')-1);
        if i>=0 then pl.goal:=jsonb_set(pl.goal,array['monthly_targets',i::text,'target_value'],desired); end if;
      end if;
      update public.strategic_plans set goal=jsonb_set(pl.goal,'{target}',desired) where id=pl.id;
    elsif pr.proposal->>'target_type'='milestone' and field in ('name','description','target_date') then
      element:=(pr.proposal->>'target_id')::uuid;
      select to_jsonb(h)->field into current_value from public.strategic_plan_milestones h join public.strategic_plan_phases f on f.id=h.phase_id
        where h.id=element and f.plan_id=pl.id and h.organization_id=p_organization_id and h.status not in ('completed','skipped') for update of h;
      if not found or current_value is distinct from before_value then raise exception 'camino_proposal_target_changed'; end if;
      if jsonb_typeof(desired)<>'string' or length(desired#>>'{}')>2000 then raise exception 'camino_proposal_invalid_value'; end if;
      if field='name' and length(trim(desired#>>'{}')) not between 1 and 255 then raise exception 'camino_proposal_invalid_value'; end if;
      if field='target_date' then
        if (desired#>>'{}')!~'^\d{4}-\d{2}-\d{2}$' or (desired#>>'{}')::date<current_date
          or ((pl.goal->>'horizon_end_date') is not null and (desired#>>'{}')::date>(pl.goal->>'horizon_end_date')::date)
          or exists(select 1 from public.milestone_task_links l join public.tasks t on t.id=l.task_id where l.milestone_id=element and t.status in ('pending','in_progress') and t.due_at::date>(desired#>>'{}')::date)
          then raise exception 'camino_proposal_invalid_date'; end if;
        if exists(select 1 from public.strategic_plan_milestones h join public.strategic_plan_phases f on f.id=h.phase_id
          join public.strategic_plan_milestones edited on edited.id=element join public.strategic_plan_phases edited_phase on edited_phase.id=edited.phase_id
          where f.plan_id=pl.id and h.id<>element and h.target_date is not null
          and (((f.position,h.position)<(edited_phase.position,edited.position) and h.target_date>(desired#>>'{}')::date)
            or ((f.position,h.position)>(edited_phase.position,edited.position) and h.target_date<(desired#>>'{}')::date)))
          then raise exception 'camino_proposal_invalid_date'; end if;
      end if;
      update public.strategic_plan_milestones set name=case when field='name' then desired#>>'{}' else name end,
        description=case when field='description' then desired#>>'{}' else description end,
        target_date=case when field='target_date' then (desired#>>'{}')::date else target_date end where id=element;
    else raise exception 'camino_proposal_not_executable'; end if;
    p_action:='completed';
    p_reason:=coalesce(nullif(trim(p_reason),''),'Cambio revisado y aplicado desde la propuesta.');
  end if;
  insert into public.strategic_plan_change_proposal_events(proposal_id,organization_id,action,actor_user_id,actor_role,reason,edited_proposal)
    values(pr.id,p_organization_id,p_action,p_actor_id,p_actor_role,p_reason,p_edited) returning id into event_id;
  return jsonb_build_object('id',event_id,'action',p_action,'created_at',now());
end $$;
revoke all on function public.camino_proposal_decision(uuid,uuid,uuid,uuid,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.camino_proposal_decision(uuid,uuid,uuid,uuid,text,text,text,uuid,jsonb) to service_role;
