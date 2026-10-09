-- A19 chooses the amount of structure from the shop's needs; generated tasks
-- are attached to milestones and remain reviewable before a Camino is created.
do $a19_variable_structure_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_arquitecto_camino_system' and version = 'v4'
  ) then
    raise exception 'A19_ARCHITECT_PROMPT_V4_REQUIRED_FOR_VARIABLE_STRUCTURE';
  end if;
end
$a19_variable_structure_guard$;

with next_prompt as (
  select source.code,
    regexp_replace(
      source.content,
      '- Construye fases suficientes[^\r\n]*\r?\n?',
      '',
      'g'
    ) || E'\n\nESTRUCTURA VARIABLE DEL CAMINO Y ACCIONES POR HITO\nEsta seccion sustituye cualquier instruccion anterior que sugiera cantidades habituales o cuotas de fases e hitos. Decide el numero de fases, hitos y tareas a partir del diagnostico, el horizonte, las dependencias reales, la capacidad declarada, las fechas relevantes y la evidencia disponible. No hay una cantidad objetivo ni minima de fases, hitos o tareas. Usa las necesarias para cubrir el trabajo; no dividas el horizonte en partes iguales ni agregues elementos de relleno. Cada fase debe representar un cambio o bloque de trabajo distinto; cada hito, un resultado verificable; cada tarea, una accion concreta que contribuya a su hito. Si una tarea no mejora la claridad o la ejecucion, omitela.\nIncluye en cada hito la propiedad tasks. Puede ser una lista vacia cuando no haga falta desglosarlo; si hay acciones necesarias, asigna a cada una titulo, descripcion, target_offset_days y prioridad (low, medium, high o urgent). Las tareas deben tener fecha igual o anterior a su hito y permanecer dentro del horizonte solicitado. No dupliques tareas abiertas ni trabajo ya cubierto por A04, A17 o A18: integra su contexto sin relanzarlo. El borrador debe permitir revisar todas las fases, hitos y tareas antes de crear el Camino.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v4'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v5', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
from next_prompt
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (
    select id from public.agent_definitions where code = 'a19_arquitecto_camino'
  );

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v5', v.model, v.prompt_code, 'v5', v.allowed_tools,
       v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_arquitecto_camino' and v.version = 'v4'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
