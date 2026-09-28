-- Tasks can be organization-wide (store_id NULL) or explicitly scoped to a
-- Shopify store. This lets A04/A17/A18 avoid importing another store's backlog.
alter table public.tasks
  add column if not exists store_id uuid references public.shopify_stores(id) on delete set null;

create index if not exists tasks_org_store_status_priority_idx
  on public.tasks (organization_id, store_id, status, priority desc);

-- Safely recover scope only where a task is linked to plans from exactly one
-- store. Ambiguous or unlinked legacy tasks remain organization-wide (NULL).
with unique_task_store as (
  select
    mtl.task_id,
    (array_agg(distinct sp.store_id))[1] as store_id
  from public.milestone_task_links mtl
  join public.strategic_plan_milestones m on m.id = mtl.milestone_id
  join public.strategic_plan_phases p on p.id = m.phase_id
  join public.strategic_plans sp on sp.id = p.plan_id
  where sp.store_id is not null
  group by mtl.task_id
  having count(distinct sp.store_id) = 1
)
update public.tasks t
set store_id = unique_task_store.store_id
from unique_task_store
where t.id = unique_task_store.task_id
  and t.store_id is null;

create or replace function private.enforce_task_store_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  store_org_id uuid;
begin
  if new.store_id is null then
    return new;
  end if;

  select s.organization_id into store_org_id
  from public.shopify_stores s
  where s.id = new.store_id;

  if store_org_id is null or store_org_id <> new.organization_id then
    raise exception 'task_store_organization_mismatch';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_task_store_same_org() from public, anon, authenticated;

drop trigger if exists enforce_task_store_same_org on public.tasks;
create trigger enforce_task_store_same_org
before insert or update of organization_id, store_id on public.tasks
for each row execute function private.enforce_task_store_same_org();

create or replace function private.enforce_task_milestone_store_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_store_id uuid;
  plan_store_id uuid;
begin
  select t.store_id into task_store_id
  from public.tasks t
  where t.id = new.task_id and t.organization_id = new.organization_id;

  select sp.store_id into plan_store_id
  from public.strategic_plan_milestones m
  join public.strategic_plan_phases p on p.id = m.phase_id
  join public.strategic_plans sp on sp.id = p.plan_id
  where m.id = new.milestone_id and m.organization_id = new.organization_id;

  if not found then
    raise exception 'milestone must belong to the same organization';
  end if;

  if task_store_id is not null and plan_store_id is not null and task_store_id <> plan_store_id then
    raise exception 'task_milestone_store_mismatch';
  end if;

  if task_store_id is null and plan_store_id is not null then
    update public.tasks
    set store_id = plan_store_id
    where id = new.task_id and organization_id = new.organization_id and store_id is null;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_task_milestone_store_scope() from public, anon, authenticated;

drop trigger if exists enforce_task_milestone_store_scope on public.milestone_task_links;
create trigger enforce_task_milestone_store_scope
before insert or update of organization_id, milestone_id, task_id on public.milestone_task_links
for each row execute function private.enforce_task_milestone_store_scope();
