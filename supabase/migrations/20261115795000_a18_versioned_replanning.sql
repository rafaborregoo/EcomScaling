-- Versioned monthly initiative changes are applied atomically only after the
-- existing human approval flow publishes the A18 output.
create or replace function public.approve_a18_monthly_initiative_change(
  p_organization_id uuid,
  p_store_id uuid,
  p_previous_task_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_replacement jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous public.tasks%rowtype;
  v_new_id uuid;
  v_previous_version integer;
  v_previous_meta jsonb;
  v_new_meta jsonb;
begin
  if p_action is null or p_action not in ('replace', 'retire') then
    raise exception 'invalid_a18_initiative_action' using errcode = '22023';
  end if;
  if p_actor_user_id is null then
    raise exception 'a18_actor_required' using errcode = '22023';
  end if;

  select * into v_previous
  from public.tasks
  where id = p_previous_task_id
    and organization_id = p_organization_id
  for update;

  if not found
     or v_previous.source <> 'ai_consultant'
     or v_previous.status not in ('pending', 'in_progress')
     or v_previous.store_id is distinct from p_store_id
     or coalesce(v_previous.metadata->'ai_monthly_initiative', 'null'::jsonb) = 'null'::jsonb then
    raise exception 'a18_previous_initiative_unavailable' using errcode = 'P0002';
  end if;

  v_previous_meta := coalesce(v_previous.metadata->'ai_monthly_initiative', '{}'::jsonb);
  if v_previous_meta->>'lifecycle_status' in ('superseded', 'retired') then
    raise exception 'a18_previous_initiative_already_closed' using errcode = 'P0002';
  end if;
  v_previous_version := greatest(1, coalesce(nullif(v_previous_meta->>'version', '')::integer, 1));

  if p_action = 'replace' then
    if jsonb_typeof(p_replacement) <> 'object'
      or coalesce(nullif(btrim(p_replacement->>'title'), ''), '') = ''
      or coalesce(nullif(btrim(p_replacement->>'description'), ''), '') = ''
      or coalesce(p_replacement->>'priority', '') not in ('low', 'medium', 'high', 'urgent')
      or coalesce(jsonb_typeof(p_replacement->'metadata'), '') <> 'object'
      or coalesce(jsonb_typeof(p_replacement->'metadata'->'ai_monthly_initiative'), '') <> 'object' then
      raise exception 'a18_replacement_invalid' using errcode = '22023';
    end if;

    v_new_id := gen_random_uuid();
    v_new_meta := coalesce(p_replacement->'metadata', '{}'::jsonb)
      || jsonb_build_object(
        'ai_monthly_initiative',
        coalesce(p_replacement->'metadata'->'ai_monthly_initiative', '{}'::jsonb)
          || jsonb_build_object(
            'version', v_previous_version + 1,
            'lifecycle_status', 'active',
            'supersedes_task_id', p_previous_task_id
          )
      );

    insert into public.tasks (
      id, organization_id, store_id, source, status, priority, title,
      description, assigned_to, created_by, metadata, categories
    ) values (
      v_new_id,
      p_organization_id,
      p_store_id,
      'ai_consultant',
      'pending',
      (p_replacement->>'priority')::public.task_priority,
      left(btrim(p_replacement->>'title'), 255),
      p_replacement->>'description',
      nullif(p_replacement->>'assigned_to', '')::uuid,
      p_actor_user_id,
      v_new_meta,
      case
        when jsonb_typeof(p_replacement->'categories') = 'array'
          then array(select jsonb_array_elements_text(p_replacement->'categories'))
        else array[]::text[]
      end
    );
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  update public.tasks
  set status = 'cancelled',
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{ai_monthly_initiative}',
        v_previous_meta || jsonb_build_object(
          'lifecycle_status', case when p_action = 'retire' then 'retired' else 'superseded' end,
          'closed_by_user_id', p_actor_user_id,
          'closed_at', now()
        ) || case when p_action = 'replace'
          then jsonb_build_object('superseded_by_task_id', v_new_id)
          else '{}'::jsonb
        end,
        true
      ),
      updated_at = now()
  where id = p_previous_task_id
    and organization_id = p_organization_id
    and status in ('pending', 'in_progress');

  if not found then
    raise exception 'a18_previous_initiative_concurrent_update' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'action', p_action,
    'previous_task_id', p_previous_task_id,
    'new_task_id', v_new_id,
    'version', case when p_action = 'replace' then v_previous_version + 1 else v_previous_version end
  );
end;
$$;

revoke all on function public.approve_a18_monthly_initiative_change(uuid, uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.approve_a18_monthly_initiative_change(uuid, uuid, uuid, text, uuid, jsonb) to service_role;

insert into public.prompt_versions (code, version, content, checksum)
select
  'a18_plan_mensual_system',
  'v7',
  p.content || E'\n\n18. REPLANIFICACIÓN VERSIONADA Y APROBABLE\nRecibirás la lista server-owned de iniciativas A18 abiertas aprobadas/publicadas en el scope exacto, con sus task_id y título. Si una iniciativa ya no encaja por evidencia nueva, backlog, cambio del Camino o bloqueo, puedes proponer initiative_change con action="replace" o "retire", copiando literalmente previous_task_id y previous_task_title de esa lista. La sustitución debe incluir una nueva iniciativa completa; la retirada explica por qué ya no debe seguir activa. No uses initiative_change para una iniciativa de A04/A17, un borrador, una propuesta pendiente, una tarea sin ai_monthly_initiative activa, una tarea de otra tienda o un ID/título que no aparezcan en la lista. La revisión aprobada queda versionada: tras aprobación, la iniciativa anterior se marca cancelada/sustituida o retirada y la nueva enlaza `supersedes_task_id`; se conserva el historial de estados y metadatos. Sin evidencia nueva, deja la iniciativa anterior intacta y no la dupliques. No cierres nada al generar; toda sustitución/retirada requiere aprobación humana. Para iniciativas nuevas sin objetivo que sustituir, omite initiative_change.',
  encode(sha256(convert_to(p.content || E'\n\n18. REPLANIFICACIÓN VERSIONADA Y APROBABLE\nRecibirás la lista server-owned de iniciativas A18 abiertas aprobadas/publicadas en el scope exacto, con sus task_id y título. Si una iniciativa ya no encaja por evidencia nueva, backlog, cambio del Camino o bloqueo, puedes proponer initiative_change con action="replace" o "retire", copiando literalmente previous_task_id y previous_task_title de esa lista. La sustitución debe incluir una nueva iniciativa completa; la retirada explica por qué ya no debe seguir activa. No uses initiative_change para una iniciativa de A04/A17, un borrador, una propuesta pendiente, una tarea sin ai_monthly_initiative activa, una tarea de otra tienda o un ID/título que no aparezcan en la lista. La revisión aprobada queda versionada: tras aprobación, la iniciativa anterior se marca cancelada/sustituida o retirada y la nueva enlaza `supersedes_task_id`; se conserva el historial de estados y metadatos. Sin evidencia nueva, deja la iniciativa anterior intacta y no la dupliques. No cierres nada al generar; toda sustitución/retirada requiere aprobación humana. Para iniciativas nuevas sin objetivo que sustituir, omite initiative_change.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a18_plan_mensual_system' and p.version = 'v6'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a18_plan_mensual');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v7', v.model, 'a18_plan_mensual_system', 'v7', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a18_plan_mensual' and v.version = 'v6'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
