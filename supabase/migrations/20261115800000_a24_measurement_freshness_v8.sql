-- A24 gate v2: successful queries are not enough when their backing Meta
-- sources are stale or a bounded issue/event sample may have been truncated.
do $migration$
declare
  previous_content text;
  appended text := E'\n\n15. FRESCURA Y MUESTRAS INCOMPLETAS DEL VEREDICTO (REGLA VIGENTE)\n- El veredicto de c\u00f3digo `a24-measurement-v2` exige algo m\u00e1s que RPCs que respondan correctamente: sincronizaci\u00f3n reciente (m\u00e1ximo 48 h) de la cuenta y del pixel vinculado, adem\u00e1s del estado fresh del log de actividad. Si falta la fecha o est\u00e1 vencida/futura, el veredicto es unknown.\n- La RPC de conjuntos limita el mapeo a 100; si `ad_set_rows_truncated` es true, el alcance es incompleto y el veredicto no puede ser usable.\n- La lista de incidencias se limita a 30 filas sin bandera adicional de truncamiento. Si devuelve 30, no concluyas que el resto de la cuenta est\u00e1 libre de incidencias: trata el gate como unknown y explica que la muestra est\u00e1 completa hasta su l\u00edmite.\n- Cualquier incidencia con freshness stale/unknown invalida un estado verde. No transformes un error, una fecha de sincronizaci\u00f3n ausente o una p\u00e1gina llena en ausencia de problemas. Un estado unknown permite describir gasto/alcance/clics como tales, pero no autoriza conclusiones fiables de compras/ROAS.';
begin
  select content into previous_content
  from public.prompt_versions
  where code = 'a24_medicion_meta_system' and version = 'v7';

  if previous_content is null then
    raise exception 'A24 v7 canonical prompt is missing';
  end if;

  insert into public.prompt_versions (code, version, content, checksum)
  values ('a24_medicion_meta_system', 'v8', previous_content || appended,
    encode(sha256((previous_content || appended)::bytea), 'hex'))
  on conflict (code, version) do update
  set content = excluded.content, checksum = excluded.checksum;

  insert into public.agent_versions as existing_version
    (definition_id, version, model, prompt_code, prompt_version, allowed_tools,
     approval_mode, output_schema_version, config, is_active)
  select v.definition_id, 'v8', v.model, 'a24_medicion_meta_system', 'v8',
    coalesce(v.allowed_tools, '[]'::jsonb),
    v.approval_mode, v.output_schema_version, v.config, true
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where d.code = 'a24_medicion_meta' and v.version = 'v7'
  on conflict (definition_id, version) do update
  set prompt_code = excluded.prompt_code,
      prompt_version = excluded.prompt_version,
      allowed_tools = excluded.allowed_tools,
      approval_mode = excluded.approval_mode,
      output_schema_version = excluded.output_schema_version,
      config = excluded.config,
      is_active = true;

  update public.agent_versions av
  set is_active = false
  where av.is_active and av.version <> 'v8'
    and av.definition_id = (select id from public.agent_definitions where code = 'a24_medicion_meta');
end
$migration$;
