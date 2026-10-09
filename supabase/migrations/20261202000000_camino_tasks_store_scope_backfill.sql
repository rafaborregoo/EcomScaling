-- Las tareas creadas desde un camino de tienda (createStrategicPlan y
-- createMilestoneTask) nacian sin store_id aunque la columna existe desde
-- 20261115380000_ai_a04_task_store_scope. El backfill de aquella migracion solo
-- cubrio las tareas que ya existian entonces. Misma regla: solo se asigna tienda
-- si la tarea cuelga de planes de exactamente una tienda. Idempotente: solo
-- toca filas con store_id nulo.
with unique_task_store as (
  select
    l.task_id,
    (array_agg(distinct sp.store_id))[1] as store_id
  from public.milestone_task_links l
  join public.strategic_plan_milestones m on m.id = l.milestone_id
  join public.strategic_plan_phases p on p.id = m.phase_id
  join public.strategic_plans sp on sp.id = p.plan_id
  where sp.store_id is not null
  group by l.task_id
  having count(distinct sp.store_id) = 1
)
update public.tasks t
set store_id = u.store_id
from unique_task_store u
where t.id = u.task_id
  and t.store_id is null;
