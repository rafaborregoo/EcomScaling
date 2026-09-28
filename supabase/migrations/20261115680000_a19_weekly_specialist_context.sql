-- A19 reviews may use recent approved specialist evidence, but never another
-- store's private findings or raw, unrestricted agent outputs.
do $a19_context_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_revision_camino_system' and version = 'v1'
  ) then
    raise exception 'A19_REVIEW_PROMPT_V1_REQUIRED_FOR_SPECIALIST_CONTEXT';
  end if;
end
$a19_context_guard$;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  p.content || E'\n\nCONTEXTO DE ESPECIALISTAS\nPuedes recibir resúmenes breves de A02 y especialistas (incluido A06) únicamente cuando la ejecución fue correcta, la salida está aprobada/publicada, sigue dentro de su vigencia y pertenece exactamente a la tienda del Camino (o al ámbito agregado sin tienda seleccionada). Son señales secundarias: contrástalas con métricas y sincronización actuales antes de concluir. No conviertas una salida ausente, pendiente, caducada o con error en un hallazgo negativo. No vuelvas a lanzar especialistas ni dupliques acciones de A18/A17/A04 o tareas abiertas enlazadas al Camino. Si hay conflicto, describe la evidencia y conserva el Camino activo como autoridad hasta que una persona apruebe un cambio.',
  encode(sha256(convert_to(p.content || E'\n\nCONTEXTO DE ESPECIALISTAS\nPuedes recibir resúmenes breves de A02 y especialistas (incluido A06) únicamente cuando la ejecución fue correcta, la salida está aprobada/publicada, sigue dentro de su vigencia y pertenece exactamente a la tienda del Camino (o al ámbito agregado sin tienda seleccionada). Son señales secundarias: contrástalas con métricas y sincronización actuales antes de concluir. No conviertas una salida ausente, pendiente, caducada o con error en un hallazgo negativo. No vuelvas a lanzar especialistas ni dupliques acciones de A18/A17/A04 o tareas abiertas enlazadas al Camino. Si hay conflicto, describe la evidencia y conserva el Camino activo como autoridad hasta que una persona apruebe un cambio.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a19_revision_camino_system' and p.version = 'v1'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a19_revision_camino');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v2', v.model, 'a19_revision_camino_system', 'v2', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_revision_camino' and v.version = 'v1'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
