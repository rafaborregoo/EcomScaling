-- Camino: three dates per milestone, shown currency with its rate, exception closing.
-- target_date is when the result is wanted, deadline_date when it must be closed,
-- measurement_date when it is checked. Empty means the same as target_date.
alter table public.strategic_plan_milestones add column if not exists deadline_date date;
alter table public.strategic_plan_milestones add column if not exists measurement_date date;

-- Stored amounts stay in currency_code, which is what panels and agents read.
-- display_fx only says how Mi Camino shows them: {from, to, rate, rate_date, source}.
alter table public.strategic_plans add column if not exists display_fx jsonb;

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
    kind := p_verification->>'kind';
    if kind is null or kind not in ('human','metric','exception') then raise exception 'milestone_verification_required'; end if;
    -- A declared exception closes with its reason even with open tasks; the tasks stay open.
    if kind <> 'exception' and exists(select 1 from public.milestone_task_links l left join public.tasks t on t.id=l.task_id
      where l.milestone_id=m.id and (t.id is null or t.status in ('pending','in_progress','proposed'))) then raise exception 'milestone_tasks_open'; end if;
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
