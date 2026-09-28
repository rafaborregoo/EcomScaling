-- A17 reuses approved, fresh specialist context instead of relaunching agents.
do $a17_specialist_context_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a17_plan_semanal_system' and version = 'v5'
  ) then
    raise exception 'A17_PROMPT_V5_REQUIRED_FOR_SPECIALIST_CONTEXT';
  end if;
end
$a17_specialist_context_guard$;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v6',
  p.content || E'\n\n14. USO DE DIAGNÓSTICOS DE ESPECIALISTAS\nEl contexto puede incluir resúmenes de diagnósticos exitosos, aprobados/publicados, recientes y de la misma tienda. Úsalos únicamente cuando el área y la pregunta semanal sean pertinentes; son pistas para priorizar, no cifras actuales ni autorización para repetir sus tareas. Contrasta cifras con el contexto Shopify/backlog actual, cita la fecha/fuente del resumen cuando justifique una tarea y señala cualquier limitación o conflicto. No trates una salida ausente, caducada, no aprobada o indisponible como prueba de que no exista un problema; no relances agentes ni supongas que sus propuestas fueron aceptadas. El objetivo e hitos activos leídos directamente de Mi Camino son la autoridad para el objetivo padre; A02 aporta el diagnóstico general vigente. Si un especialista discrepa de esos datos más directos, prioriza la evidencia actual y explica la discrepancia; si no cambia la prioridad de esta semana, no crees una tarea por el mero hecho de que exista un análisis.' ,
  encode(sha256(convert_to(p.content || E'\n\n14. USO DE DIAGNÓSTICOS DE ESPECIALISTAS\nEl contexto puede incluir resúmenes de diagnósticos exitosos, aprobados/publicados, recientes y de la misma tienda. Úsalos únicamente cuando el área y la pregunta semanal sean pertinentes; son pistas para priorizar, no cifras actuales ni autorización para repetir sus tareas. Contrasta cifras con el contexto Shopify/backlog actual, cita la fecha/fuente del resumen cuando justifique una tarea y señala cualquier limitación o conflicto. No trates una salida ausente, caducada, no aprobada o indisponible como prueba de que no exista un problema; no relances agentes ni supongas que sus propuestas fueron aceptadas. El objetivo e hitos activos leídos directamente de Mi Camino son la autoridad para el objetivo padre; A02 aporta el diagnóstico general vigente. Si un especialista discrepa de esos datos más directos, prioriza la evidencia actual y explica la discrepancia; si no cambia la prioridad de esta semana, no crees una tarea por el mero hecho de que exista un análisis.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a17_plan_semanal_system' and p.version = 'v5'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a17_plan_semanal');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v6', v.model, 'a17_plan_semanal_system', 'v6', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a17_plan_semanal' and v.version = 'v5'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
