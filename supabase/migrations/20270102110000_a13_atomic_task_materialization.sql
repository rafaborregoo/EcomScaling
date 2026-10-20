-- A13 approval creates the durable task and its Camino link in one database
-- transaction. The plan identity is rechecked at approval time.
create or replace function public.materialize_a13_operational_task(
  p_task jsonb,
  p_organization_id uuid,
  p_store_id uuid,
  p_output_id uuid,
  p_proposal_index integer,
  p_plan_id uuid default null,
  p_plan_version integer default null,
  p_phase text default null,
  p_milestone_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_title text := nullif(btrim(p_task->>'title'), '');
  v_task_id uuid;
  v_created boolean := false;
  v_categories text[];
  v_existing_store_id uuid;
begin
  if p_organization_id is null or p_output_id is null or p_proposal_index is null
     or p_proposal_index < 0 or v_title is null or jsonb_typeof(p_task) <> 'object' then
    raise exception 'invalid_a13_task_payload';
  end if;
  if p_store_id is not null and not exists (
    select 1 from public.shopify_stores s
    where s.id = p_store_id and s.organization_id = p_organization_id and s.is_active
  ) then
    return jsonb_build_object('status', 'store_scope_changed');
  end if;

  if p_plan_id is null and (p_plan_version is not null or p_milestone_id is not null) then
    return jsonb_build_object('status', 'incomplete_camino_identity');
  end if;
  if p_plan_id is not null and not exists (
    select 1 from public.strategic_plans p
    where p.id = p_plan_id and p.organization_id = p_organization_id
      and p.store_id is not distinct from p_store_id
      and p.version = p_plan_version and p.status = 'active' and p.approved_at is not null
  ) then
    return jsonb_build_object('status', 'stale_plan');
  end if;
  if p_milestone_id is not null and not exists (
    select 1
    from public.strategic_plan_milestones m
    join public.strategic_plan_phases ph on ph.id = m.phase_id
    join public.strategic_plans p on p.id = ph.plan_id
    where m.id = p_milestone_id and m.organization_id = p_organization_id
      and m.status in ('active', 'pending')
      and ph.status in ('active', 'pending')
      and ph.name = p_phase
      and p.id = p_plan_id and p.version = p_plan_version
      and p.status = 'active' and p.approved_at is not null
      and p.store_id is not distinct from p_store_id
  ) then
    return jsonb_build_object('status', 'stale_milestone');
  end if;

  select coalesce(array_agg(value), array['shopify']::text[]) into v_categories
  from jsonb_array_elements_text(coalesce(p_task->'categories', '[]'::jsonb)) as category(value);

  insert into public.tasks (
    organization_id, store_id, source, priority, title, description, created_by,
    assigned_to, metadata, categories, agent_output_id, agent_proposal_index
  ) values (
    p_organization_id,
    p_store_id,
    'ai_consultant',
    case when p_task->>'priority' in ('low', 'medium', 'high', 'urgent') then p_task->>'priority' else 'medium' end,
    v_title,
    nullif(p_task->>'description', ''),
    nullif(p_task->>'created_by', '')::uuid,
    nullif(p_task->>'assigned_to', '')::uuid,
    coalesce(p_task->'metadata', '{}'::jsonb),
    v_categories,
    p_output_id,
    p_proposal_index
  ) on conflict (agent_output_id, agent_proposal_index) do nothing
  returning id into v_task_id;

  if v_task_id is not null then
    v_created := true;
  else
    select t.id, t.store_id into v_task_id, v_existing_store_id
    from public.tasks t
    where t.agent_output_id = p_output_id and t.agent_proposal_index = p_proposal_index
      and t.organization_id = p_organization_id;
    if v_task_id is null then return jsonb_build_object('status', 'task_recovery_failed'); end if;
    if v_existing_store_id is distinct from p_store_id then
      return jsonb_build_object('status', 'existing_task_scope_conflict');
    end if;
  end if;

  if p_milestone_id is not null then
    insert into public.milestone_task_links (organization_id, milestone_id, task_id)
    values (p_organization_id, p_milestone_id, v_task_id)
    on conflict (milestone_id, task_id) do nothing;
  end if;

  return jsonb_build_object('status', 'materialized', 'task_id', v_task_id, 'created', v_created);
end;
$$;

revoke all on function public.materialize_a13_operational_task(jsonb, uuid, uuid, uuid, integer, uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.materialize_a13_operational_task(jsonb, uuid, uuid, uuid, integer, uuid, integer, text, uuid) to service_role;
