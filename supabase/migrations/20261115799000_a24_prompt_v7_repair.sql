-- Repair the canonical A24 v7 prompt when migration history says the
-- learning/activity migration ran but its derived prompt row is absent.
-- The next migration (A24 v8) appends its freshness rules to this version.
do $migration$
declare
  previous_content text;
  v7_content text;
begin
  select content into previous_content
  from public.prompt_versions
  where code = 'a24_medicion_meta_system' and version = 'v6';

  if previous_content is null then
    raise exception 'A24 v6 canonical prompt is missing';
  end if;

  v7_content := previous_content || E'\n\n14. FRESCURA DEL HISTORIAL DE ACTIVIDAD\nInterpreta `activity_sync_state` para saber si el log de cambios está actualizado: `fresh` significa sync completado hace <=48 h; `stale`, `sync_failed`, `sync_unknown` o `sync_in_progress` hacen que la cobertura del historial sea desconocida. `last_account_activity_*` solo describe el evento más reciente que llegó; `days_since_account_activity` no mide días desde un cambio que reinició aprendizaje. La ausencia de un evento solo permite decir “no aparece en el historial sincronizado”, nunca “no hubo cambios”. Usa `activity_sync_records_read` junto a `activity_sync_finished_at` para contextualizar cobertura; no los conviertas en un conteo de cambios de aprendizaje.';

  insert into public.prompt_versions (code, version, content, checksum)
  values (
    'a24_medicion_meta_system',
    'v7',
    v7_content,
    encode(sha256(v7_content::bytea), 'hex')
  )
  on conflict (code, version) do nothing;

  insert into public.agent_versions as existing_version
    (definition_id, version, model, prompt_code, prompt_version,
     allowed_tools, approval_mode, output_schema_version, config, is_active)
  select v.definition_id, 'v7', v.model, 'a24_medicion_meta_system', 'v7',
    coalesce(v.allowed_tools, '[]'::jsonb), v.approval_mode,
    v.output_schema_version, v.config, false
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where d.code = 'a24_medicion_meta' and v.version = 'v6'
  on conflict (definition_id, version) do update
  set prompt_code = excluded.prompt_code,
      prompt_version = excluded.prompt_version,
      allowed_tools = excluded.allowed_tools,
      approval_mode = excluded.approval_mode,
      output_schema_version = excluded.output_schema_version,
      config = excluded.config,
      is_active = false;

  if not exists (
    select 1 from public.prompt_versions
    where code = 'a24_medicion_meta_system' and version = 'v7'
  ) or not exists (
    select 1
    from public.agent_versions av
    join public.agent_definitions d on d.id = av.definition_id
    where d.code = 'a24_medicion_meta'
      and av.version = 'v7'
      and av.prompt_version = 'v7'
      and not av.is_active
  ) then
    raise exception 'A24 v7 canonical prompt repair failed';
  end if;
end
$migration$;
