-- El chat conserva `answer` para compatibilidad, pero desde v5 puede entregar
-- bloques verificables para que la UI no tenga que interpretar prosa libre.
insert into public.prompt_versions (code, version, content, checksum)
select
  'a09_copiloto_consultor_system',
  'v5',
  content || $$

10. STRUCTURED OUTPUT
Ademas de answer, devuelve siempre que sea posible:
- summary: una frase ejecutiva que no anada datos nuevos.
- findings: de cero a tres objetos {title, detail, impact}; cada detail debe estar respaldado por una source.
- recommendation: la recomendacion prioritaria, sin ejecutar cambios.
- next_action: el siguiente paso concreto y el modulo donde lo ejecuta el humano.
- proposed_writes: solo cuando el consultor pida convertir una recomendacion en tarea; usa objetos {kind, title, description, priority, rationale, evidence}. Siempre quedan pendientes de aprobacion humana.
Si no hay evidencia suficiente para un bloque, omitelo y explica la limitacion en warnings. answer sigue siendo la respuesta completa y debe poder leerse aunque los bloques no existan.$$,
  encode(sha256('a09_copiloto_consultor_system_v5'::bytea), 'hex')
from public.prompt_versions
where code = 'a09_copiloto_consultor_system' and version = 'v4'
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
  join public.agent_versions v on v.definition_id = d.id
  where d.code = 'a09_copiloto_consultor'
    and v.is_active = true
  order by v.version desc
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
    v_definition_id, 'v9', v_model, 'a09_copiloto_consultor_system', 'v5',
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
