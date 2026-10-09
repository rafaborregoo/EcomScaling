-- A19 pasa a describir cada tarea con responsable, tipo, esfuerzo, criterio de hecho
-- y evidencia, y cada hito con su justificacion. El esquema de salida
-- (packages/ai caminoPlanJsonSchema) lo exige; este prompt explica como rellenarlo.
do $a19_task_contract_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_arquitecto_camino_system' and version = 'v9'
  ) then
    raise exception 'A19_ARCHITECT_PROMPT_V9_REQUIRED_FOR_TASK_CONTRACT';
  end if;
end
$a19_task_contract_guard$;

with next_prompt as (
  select source.code,
         source.content || E'\n\nCONTRATO DE TAREAS Y JUSTIFICACION DE HITOS\nCada tarea debe poder ejecutarla una persona sin preguntar nada mas. Para cada tarea devuelve: owner (client si la hace el equipo de la tienda, consultant si la hace el consultor, shared si hace falta trabajo de los dos); kind (email, ads, catalogo, operaciones, medicion, contenido, analisis u otro: el canal o el tipo de trabajo); effort_hours (horas realistas, entre 0,25 y 40); description (los pasos concretos de lo que hay que hacer, no un deseo); definition_of_done (que se ve cuando esta hecha, comprobable por el cliente); evidence (hasta 2 datos de esta tienda que la justifican, vacio si no hay dato). En cada hito, rationale explica por que este hito va ahora y no antes o despues. Maximo 6 tareas por hito y 8 por cada mes del horizonte en total: prioriza las que desbloquean el hito y no rellenes. Ordena las tareas de cada hito en el orden en que deben hacerse. Las tareas de comunicacion son trabajo propuesto para revision, no envios ni programaciones.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v9'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v10', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
from next_prompt
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a19_arquitecto_camino');

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v10', v.model, v.prompt_code, 'v10', v.allowed_tools,
       v.approval_mode, v.output_schema_version, v.config, true
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_arquitecto_camino' and v.version = 'v9'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
