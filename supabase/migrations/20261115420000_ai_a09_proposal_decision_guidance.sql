-- A09-4: make proposals reviewable and route decisions without trusting model identity claims.
insert into public.prompt_versions (code, version, content, checksum)
select
  'a09_copiloto_consultor_system',
  'v8',
  content || $$

13. PROPUESTAS ACCIONABLES Y TRANSPARENTES
Cuando propongas una tarea, incluye evidencia concreta disponible (dato, periodo y fuente); explica en una frase por qué importa ahora y describe el siguiente paso de forma comprensible para el cliente. Estima esfuerzo como low/medium/high solo si puedes justificarlo; usa unknown si no hay base suficiente. `financial_cost_estimate` debe ser null salvo que una fuente consultada sustente una cantidad y moneda; nunca inventes precios, ahorro, ROI ni coste. Si incluyes coste, completa `basis` con la fuente o supuesto explícito y no lo presentes como cotización.
No decidas ni afirmes quién es el revisor: el backend determina la asignación de consultor y la interfaz muestra la ruta de decisión. Nunca incluyas metodologías privadas, herramientas internas, permisos de plataforma ni nombres de fichas internas en la explicación al cliente. Toda propuesta queda pendiente de decisión humana y se revisa en Tareas; no se ejecuta por redactarla.
$$,
  encode(sha256('a09_copiloto_consultor_system_v8'::bytea), 'hex')
from public.prompt_versions
where code = 'a09_copiloto_consultor_system' and version = 'v7'
on conflict (code, version) do update set
  content = excluded.content,
  checksum = excluded.checksum;

do $$
declare
  v_definition_id uuid;
  v_model text;
  v_allowed_tools jsonb;
  v_approval_mode text;
begin
  select d.id, v.model, v.allowed_tools, v.approval_mode
    into v_definition_id, v_model, v_allowed_tools, v_approval_mode
  from public.agent_definitions d
  join public.agent_versions v on v.definition_id = d.id and v.is_active = true
  where d.code = 'a09_copiloto_consultor'
  order by v.created_at desc
  limit 1;

  if v_definition_id is null then
    raise exception 'No active a09_copiloto_consultor version found';
  end if;

  update public.agent_versions
  set is_active = false
  where definition_id = v_definition_id and is_active = true;

  insert into public.agent_versions (
    definition_id, version, model, prompt_code, prompt_version,
    allowed_tools, approval_mode, is_active
  ) values (
    v_definition_id, 'v13', v_model, 'a09_copiloto_consultor_system', 'v8',
    coalesce(v_allowed_tools, '[]'::jsonb), coalesce(v_approval_mode, 'none'), true
  )
  on conflict (definition_id, version) do update set
    model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
end $$;
