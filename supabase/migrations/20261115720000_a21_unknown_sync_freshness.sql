-- Los RPCs de AI se consultan ahora, pero la mayoría no expone cuándo fue su
-- última sincronización. No presentar esa hora de lectura como frescura de dato.
insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v4',
  p.content || E'\n\nFRESCURA DE FUENTE\n`provenance.as_of` indica cuándo se ejecutó la consulta. Si `provenance.freshness_seconds` es null, no se conoce la última sincronización real de la fuente; no llames frescos los datos ni uses esa hora como fecha de actualización. Usa la cobertura explícita del periodo para el embudo y declara desconocida la frescura de los demás bloques. Si la decisión depende de sincronización reciente, solicita comprobarla antes de concluir.',
  encode(sha256(convert_to(p.content || E'\n\nFRESCURA DE FUENTE\n`provenance.as_of` indica cuándo se ejecutó la consulta. Si `provenance.freshness_seconds` es null, no se conoce la última sincronización real de la fuente; no llames frescos los datos ni uses esa hora como fecha de actualización. Usa la cobertura explícita del periodo para el embudo y declara desconocida la frescura de los demás bloques. Si la decisión depende de sincronización reciente, solicita comprobarla antes de concluir.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a21_adquisicion_shopify_system' and p.version = 'v3'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

insert into public.agent_versions as existing_version
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v5', v.model, 'a21_adquisicion_shopify_system', 'v4',
  v.allowed_tools, v.approval_mode, v.output_schema_version, v.config, v.is_active
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a21_adquisicion_shopify' and v.version = 'v4'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = existing_version.is_active or excluded.is_active;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.version <> 'v5'
  and av.definition_id = (select id from public.agent_definitions where code = 'a21_adquisicion_shopify');
