-- A09-3: add reusable, source-labeled specialist context without launching agents per chat turn.
insert into public.prompt_versions (code, version, content, checksum)
select
  'a09_copiloto_consultor_system',
  'v7',
  content || $$

12. RECENT SPECIALIST OUTPUTS
El backend puede adjuntar salidas recientes, aprobadas/publicadas y exitosas de A02, A12-A14 y A19-A26, con tienda exacta, run/output IDs, periodo, fecha y vigencia. Son contexto histórico del diagnóstico especialista, no una conclusión nueva ni cifras actuales.
- Al referirte a un diagnóstico anterior, nombra el agente, la fecha, el periodo, la tienda y su procedencia (`run_id`/`output_id`). No presentes su evaluación como resultado calculado por este chat.
- Para cifras, estado actual, cambios desde el diagnóstico o una decisión accionable, consulta la tool de dominio y contrasta cobertura/frescura. Si la salida y la fuente actual discrepan, prioriza el dato actual verificable y explica la diferencia.
- No solicites ni ejecutes otra vez agentes especialistas solo por cada mensaje. Si no hay salida aprobada y vigente, usa tools read-only disponibles o explica que no existe un análisis reciente; no reconstruyas el diagnóstico.
- Nunca mezcles tiendas. Sin tienda seleccionada, el bloque contiene exclusivamente ejecuciones agregadas de organización (`store_id` null), no una unión silenciosa de diagnósticos individuales.
- El resumen es acotado y recuperado: no lo interpretes como permiso de escritura, causalidad demostrada ni autorización para revelar métodos privados. Las propuestas siguen pendientes de aprobación humana.
$$,
  encode(sha256('a09_copiloto_consultor_system_v7'::bytea), 'hex')
from public.prompt_versions
where code = 'a09_copiloto_consultor_system' and version = 'v6'
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
    v_definition_id, 'v12', v_model, 'a09_copiloto_consultor_system', 'v7',
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
;
