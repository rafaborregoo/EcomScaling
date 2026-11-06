-- Replanificar el Camino: la nueva versión se aplica entera o no se aplica.
-- Conserva tareas abiertas (misma fila, misma historia), retira las que salen
-- como descartadas con motivo y deja lo hecho en su versión.

alter table public.strategic_plans
  add column if not exists replaces_plan_id uuid references public.strategic_plans (id) on delete set null,
  add column if not exists replan_summary jsonb;

create index if not exists strategic_plans_replaces_plan_id_idx
  on public.strategic_plans (replaces_plan_id)
  where replaces_plan_id is not null;

comment on column public.strategic_plans.replaces_plan_id is
  'Versión de la que parte esta, si nació de una replanificación.';
comment on column public.strategic_plans.replan_summary is
  'Qué cambió respecto a la versión anterior y qué decidió el usuario.';

-- Huella del estado que importa a una propuesta: si cambia mientras se revisa,
-- la propuesta ya no parte de este Camino.
create or replace function public.camino_plan_fingerprint(p_plan_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'status', sp.status,
    'goal', sp.goal,
    'currency', sp.currency_code,
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'phase', m.phase_id, 'name', m.name, 'status', m.status,
        'target', m.target_date, 'deadline', m.deadline_date, 'measurement', m.measurement_date,
        'tasks', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', t.id, 'title', t.title, 'status', t.status, 'due', t.due_at,
            'priority', t.priority, 'owner', t.assigned_to
          ) order by t.id)
          from public.milestone_task_links l
          join public.tasks t on t.id = l.task_id
          where l.milestone_id = m.id
        ), '[]'::jsonb)
      ) order by m.id)
      from public.strategic_plan_milestones m
      join public.strategic_plan_phases f on f.id = m.phase_id
      where f.plan_id = sp.id
    ), '[]'::jsonb)
  )::text)
  from public.strategic_plans sp
  where sp.id = p_plan_id
$$;

revoke all on function public.camino_plan_fingerprint(uuid) from public, anon, authenticated;
grant execute on function public.camino_plan_fingerprint(uuid) to service_role;

-- Misma firma: ahora un hito o una tarea pueden continuar uno existente.
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
  v_source_milestone uuid;
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
        target_date, deadline_date, measurement_date, position, created_by
      )
      values (
        p_organization_id, v_phase, left(ms.j->>'name', 255), ms.j->>'description',
        ms.j->>'success_criteria', ms.j->>'rationale',
        nullif(ms.j->>'target_date', '')::date,
        nullif(ms.j->>'deadline_date', '')::date,
        nullif(ms.j->>'measurement_date', '')::date,
        ms.idx, p_user_id
      )
      returning id into v_milestone;

      -- Lo que cuelga del hito continúa con él en la versión nueva.
      v_source_milestone := nullif(ms.j->>'source_milestone_id', '')::uuid;
      if v_source_milestone is not null then
        update public.organization_metric_targets set milestone_id = v_milestone
          where milestone_id = v_source_milestone and organization_id = p_organization_id;
        update public.campaign_calendar_items set milestone_id = v_milestone
          where milestone_id = v_source_milestone and organization_id = p_organization_id;
        update public.meetings set milestone_id = v_milestone
          where milestone_id = v_source_milestone and organization_id = p_organization_id;
        update public.milestone_internal_notes set milestone_id = v_milestone
          where milestone_id = v_source_milestone and organization_id = p_organization_id;
      end if;

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
        v_task := nullif(tk.j->>'source_task_id', '')::uuid;
        if v_task is not null then
          update public.tasks
          set title = left(tk.j->>'title', 255),
              description = tk.j->>'description',
              priority = coalesce(nullif(tk.j->>'priority', ''), 'medium')::public.task_priority,
              due_at = nullif(tk.j->>'due_at', '')::timestamptz,
              assigned_to = case when tk.j ? 'assigned_to' then nullif(tk.j->>'assigned_to', '')::uuid else assigned_to end
          where id = v_task
            and organization_id = p_organization_id
            and status::text not in ('completed', 'ignored', 'cancelled');
          if not found then
            raise exception 'replan_task_unavailable';
          end if;
          delete from public.milestone_task_links where task_id = v_task;
        else
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
        end if;

        v_evidence := case when jsonb_typeof(tk.j->'evidence') = 'array' then tk.j->'evidence' else '[]'::jsonb end;

        insert into public.milestone_task_links (
          organization_id, milestone_id, task_id, position, owner_role, kind,
          track, cadence, effort_hours, definition_of_done, rationale, evidence
        )
        values (
          p_organization_id, v_milestone, v_task, tk.idx,
          nullif(tk.j->>'owner', ''), nullif(tk.j->>'kind', ''),
          nullif(tk.j->>'track', ''), nullif(tk.j->>'cadence', ''),
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

-- Comprueba, archiva, crea, reconcilia y activa en una sola transacción: si algo
-- falla, el Camino vigente sigue exactamente igual.
create or replace function public.camino_apply_replan(
  p_organization_id uuid,
  p_user_id uuid,
  p_source_plan_id uuid,
  p_expected_fingerprint text,
  p_output_id uuid,
  p_plan jsonb,
  p_retire jsonb,
  p_summary jsonb,
  p_starts_on date
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_source public.strategic_plans%rowtype;
  v_output_status text;
  v_new uuid;
  v_version integer;
  v_active boolean;
  v_now timestamptz := now();
  v_first_phase uuid;
  v_moved integer;
  v_created integer;
  v_retired integer := 0;
  v_item jsonb;
begin
  select * into v_source
  from public.strategic_plans
  where id = p_source_plan_id and organization_id = p_organization_id
  for update;
  if not found or v_source.status::text not in ('active', 'draft') then
    raise exception 'camino_replan_plan_closed';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || coalesce(v_source.store_id::text, 'org'), 0)
  );

  if public.camino_plan_fingerprint(p_source_plan_id) is distinct from p_expected_fingerprint then
    raise exception 'camino_replan_stale';
  end if;

  select status::text into v_output_status
  from public.agent_outputs
  where id = p_output_id and organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'plan_proposal_not_found';
  end if;
  if v_output_status = 'published' then
    raise exception 'plan_proposal_already_applied';
  end if;

  -- Los triggers de tareas atribuyen el cambio a este usuario.
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);

  update public.strategic_plans set status = 'archived' where id = p_source_plan_id;
  v_new := public.create_strategic_plan_tree(p_organization_id, p_user_id, v_source.store_id, p_output_id, p_plan);

  for v_item in select * from jsonb_array_elements(coalesce(p_retire, '[]'::jsonb))
  loop
    update public.tasks
    set status = 'ignored', ignored_at = v_now, ignored_reason = left(v_item->>'reason', 500)
    where id = (v_item->>'task_id')::uuid
      and organization_id = p_organization_id
      and status::text not in ('completed', 'ignored', 'cancelled');
    if found then
      v_retired := v_retired + 1;
    end if;
  end loop;

  -- Ninguna tarea abierta se queda colgando de una versión archivada.
  if exists (
    select 1
    from public.milestone_task_links l
    join public.tasks t on t.id = l.task_id
    join public.strategic_plan_milestones m on m.id = l.milestone_id
    join public.strategic_plan_phases f on f.id = m.phase_id
    where f.plan_id = p_source_plan_id
      and t.status::text not in ('completed', 'ignored', 'cancelled')
  ) then
    raise exception 'replan_open_tasks_unreconciled';
  end if;

  -- Un objetivo no puede depender de un hito abierto que ya no existe en el plan vivo.
  update public.organization_metric_targets o
  set milestone_id = null
  from public.strategic_plan_milestones m
  join public.strategic_plan_phases f on f.id = m.phase_id
  where o.milestone_id = m.id
    and f.plan_id = p_source_plan_id
    and m.status::text not in ('completed', 'skipped');

  v_active := v_source.status::text = 'active';
  update public.strategic_plans
  set replaces_plan_id = p_source_plan_id,
      replan_summary = p_summary,
      display_fx = v_source.display_fx,
      status = v_source.status,
      starts_on = case when v_active then p_starts_on end,
      approved_by = case when v_active then p_user_id end,
      approved_at = case when v_active then v_now end
  where id = v_new
  returning version into v_version;

  if v_active then
    select id into v_first_phase
    from public.strategic_plan_phases
    where plan_id = v_new
    order by position
    limit 1;

    update public.strategic_plan_phases
    set status = (case when id = v_first_phase then 'active' else 'pending' end)::public.plan_phase_status,
        activated_at = case when id = v_first_phase then v_now end,
        activated_by = case when id = v_first_phase then p_user_id end
    where plan_id = v_new;

    update public.strategic_plan_milestones m
    set status = (case when m.phase_id = v_first_phase then 'pending' else 'locked' end)::public.milestone_status
    from public.strategic_plan_phases f
    where f.id = m.phase_id and f.plan_id = v_new;
  end if;

  select
    count(*) filter (where nullif(t->>'source_task_id', '') is not null),
    count(*) filter (where nullif(t->>'source_task_id', '') is null)
  into v_moved, v_created
  from jsonb_array_elements(coalesce(p_plan->'phases', '[]'::jsonb)) ph,
       jsonb_array_elements(coalesce(ph->'milestones', '[]'::jsonb)) ms,
       jsonb_array_elements(coalesce(ms->'tasks', '[]'::jsonb)) t;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, new_data)
  values (
    p_organization_id, p_user_id, 'strategic_plan.replan', 'strategic_plan', v_new,
    jsonb_build_object(
      'output_id', p_output_id, 'previous_plan_id', p_source_plan_id, 'version', v_version,
      'moved', v_moved, 'created', v_created, 'retired', v_retired
    )
  );

  return jsonb_build_object(
    'plan_id', v_new,
    'previous_plan_id', p_source_plan_id,
    'version', v_version,
    'status', v_source.status,
    'activated_at', case when v_active then v_now end,
    'moved', v_moved,
    'created', v_created,
    'retired', v_retired
  );
end;
$$;

revoke all on function public.camino_apply_replan(uuid, uuid, uuid, text, uuid, jsonb, jsonb, jsonb, date) from public, anon, authenticated;
grant execute on function public.camino_apply_replan(uuid, uuid, uuid, text, uuid, jsonb, jsonb, jsonb, date) to service_role;

comment on function public.camino_apply_replan(uuid, uuid, uuid, text, uuid, jsonb, jsonb, jsonb, date) is
  'Mi Camino: aplica una replanificación validada en una transacción. Llamar via .rpc() con service client tras assertCanManagePlan.';
