-- Mi Camino: tareas con responsable, tipo, esfuerzo, criterio de hecho y evidencia;
-- hitos y fases con su justificacion; y creacion del camino en UNA transaccion.
--
-- Antes la creacion eran ~150 escrituras sueltas desde Node (fase, hito, tarea,
-- enlace) con un rollback "a mano": si el proceso caia a mitad quedaban tareas
-- sueltas en /tareas. Los metadatos del plan viven en milestone_task_links para
-- no tocar la tabla generica tasks.

alter table public.milestone_task_links
  add column if not exists position integer,
  add column if not exists owner_role text,
  add column if not exists kind text,
  add column if not exists effort_hours numeric(6, 2),
  add column if not exists definition_of_done text,
  add column if not exists rationale text,
  add column if not exists evidence jsonb not null default '[]'::jsonb;

alter table public.milestone_task_links drop constraint if exists milestone_task_links_owner_role_check;
alter table public.milestone_task_links
  add constraint milestone_task_links_owner_role_check
  check (owner_role is null or owner_role in ('client', 'consultant', 'shared'));

alter table public.strategic_plan_milestones
  add column if not exists success_criteria text,
  add column if not exists rationale text;

alter table public.strategic_plan_phases
  add column if not exists rationale text,
  add column if not exists evidence jsonb not null default '[]'::jsonb;

comment on column public.milestone_task_links.position is
  'Orden de la tarea dentro de su hito (1 = la primera que hay que hacer).';
comment on column public.milestone_task_links.owner_role is
  'Quien ejecuta la tarea: client, consultant o shared. El responsable concreto (tasks.assigned_to) se resuelve en el servidor.';

-- Una sola transaccion para todo el arbol. Se llama via .rpc() con el service
-- client tras assertCanManagePlan: no se concede a anon ni authenticated.
-- Forma de p_plan:
--   { name, description, goal, horizon_months, currency_code,
--     phases: [{ name, description, rationale, evidence,
--       milestones: [{ name, description, success_criteria, rationale, target_date,
--         objective: { metric_key, target_value } | null,
--         tasks: [{ title, description, priority, due_at, assigned_to, category,
--                   owner, kind, effort_hours, definition_of_done, rationale, evidence }] }] }] }
create or replace function public.create_strategic_plan_tree(
  p_organization_id uuid,
  p_user_id uuid,
  p_store_id uuid,
  p_output_id uuid,
  p_plan jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_plan uuid;
  v_phase uuid;
  v_milestone uuid;
  v_task uuid;
  v_version integer;
  v_objective jsonb;
  v_evidence jsonb;
  ph record;
  ms record;
  tk record;
begin
  -- Dos creaciones a la vez para el mismo alcance se serializan: la segunda ve
  -- el borrador de la primera y falla en vez de duplicar el camino.
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || coalesce(p_store_id::text, 'org'), 0)
  );

  if exists (
    select 1
    from (
      select sp.status
      from public.strategic_plans sp
      where sp.organization_id = p_organization_id
        and sp.store_id is not distinct from p_store_id
      order by sp.version desc
      limit 1
    ) latest
    where latest.status in ('draft', 'active')
  ) then
    raise exception 'plan_already_open';
  end if;

  select coalesce(max(sp.version), 0) + 1
    into v_version
  from public.strategic_plans sp
  where sp.organization_id = p_organization_id
    and sp.store_id is not distinct from p_store_id;

  insert into public.strategic_plans (
    organization_id, name, description, goal, horizon_months, currency_code,
    store_id, version, created_by
  )
  values (
    p_organization_id,
    left(p_plan->>'name', 255),
    p_plan->>'description',
    case when jsonb_typeof(p_plan->'goal') = 'object' then p_plan->'goal' end,
    nullif(p_plan->>'horizon_months', '')::integer,
    nullif(p_plan->>'currency_code', ''),
    p_store_id,
    v_version,
    p_user_id
  )
  returning id into v_plan;

  for ph in
    select t.j, t.idx::integer as idx
    from jsonb_array_elements(coalesce(p_plan->'phases', '[]'::jsonb)) with ordinality as t(j, idx)
  loop
    v_evidence := case when jsonb_typeof(ph.j->'evidence') = 'array' then ph.j->'evidence' else '[]'::jsonb end;

    insert into public.strategic_plan_phases (
      organization_id, plan_id, name, description, rationale, evidence, position, created_by
    )
    values (
      p_organization_id, v_plan, left(ph.j->>'name', 255), ph.j->>'description',
      ph.j->>'rationale', v_evidence, ph.idx, p_user_id
    )
    returning id into v_phase;

    for ms in
      select t.j, t.idx::integer as idx
      from jsonb_array_elements(coalesce(ph.j->'milestones', '[]'::jsonb)) with ordinality as t(j, idx)
    loop
      insert into public.strategic_plan_milestones (
        organization_id, phase_id, name, description, success_criteria, rationale,
        target_date, position, created_by
      )
      values (
        p_organization_id, v_phase, left(ms.j->>'name', 255), ms.j->>'description',
        ms.j->>'success_criteria', ms.j->>'rationale',
        nullif(ms.j->>'target_date', '')::date, ms.idx, p_user_id
      )
      returning id into v_milestone;

      v_objective := ms.j->'objective';
      if jsonb_typeof(v_objective) = 'object' and coalesce(v_objective->>'metric_key', '') <> '' then
        insert into public.organization_metric_targets (
          organization_id, store_id, milestone_id, metric_key, target_value, period,
          valid_from, created_by
        )
        values (
          p_organization_id, null, v_milestone, v_objective->>'metric_key',
          (v_objective->>'target_value')::numeric, 'monthly', current_date, p_user_id
        );
      end if;

      for tk in
        select t.j, t.idx::integer as idx
        from jsonb_array_elements(coalesce(ms.j->'tasks', '[]'::jsonb)) with ordinality as t(j, idx)
      loop
        insert into public.tasks (
          organization_id, store_id, source, priority, categories, title, description,
          due_at, created_by, assigned_to
        )
        values (
          p_organization_id,
          p_store_id,
          'strategic_plan'::public.task_source,
          coalesce(nullif(tk.j->>'priority', ''), 'medium')::public.task_priority,
          array[coalesce(nullif(tk.j->>'category', ''), 'general')],
          left(tk.j->>'title', 255),
          tk.j->>'description',
          nullif(tk.j->>'due_at', '')::timestamptz,
          p_user_id,
          nullif(tk.j->>'assigned_to', '')::uuid
        )
        returning id into v_task;

        v_evidence := case when jsonb_typeof(tk.j->'evidence') = 'array' then tk.j->'evidence' else '[]'::jsonb end;

        insert into public.milestone_task_links (
          organization_id, milestone_id, task_id, position, owner_role, kind,
          effort_hours, definition_of_done, rationale, evidence
        )
        values (
          p_organization_id, v_milestone, v_task, tk.idx,
          nullif(tk.j->>'owner', ''), nullif(tk.j->>'kind', ''),
          nullif(tk.j->>'effort_hours', '')::numeric,
          tk.j->>'definition_of_done', tk.j->>'rationale', v_evidence
        );
      end loop;
    end loop;
  end loop;

  if p_output_id is not null then
    update public.agent_outputs
    set status = 'published', published_at = now()
    where id = p_output_id and organization_id = p_organization_id;
  end if;

  return v_plan;
end;
$$;

revoke all on function public.create_strategic_plan_tree(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_strategic_plan_tree(uuid, uuid, uuid, uuid, jsonb) to service_role;

comment on function public.create_strategic_plan_tree(uuid, uuid, uuid, uuid, jsonb) is
  'Mi Camino: crea plan, fases, hitos, objetivos, tareas y enlaces en una transaccion y publica la propuesta de IA. Llamar via .rpc() con service client tras assertCanManagePlan.';
