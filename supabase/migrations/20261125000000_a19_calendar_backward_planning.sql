-- A19 plans toward confirmed store events using justified lead times.
do $a19_calendar_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_arquitecto_camino_system' and version = 'v5'
  ) then
    raise exception 'A19_ARCHITECT_PROMPT_V5_REQUIRED_FOR_CALENDAR_PLANNING';
  end if;
end
$a19_calendar_guard$;

with next_prompt as (
  select source.code,
    source.content || E'\n\nPLANIFICACION HACIA ATRAS DESDE EVENTOS Y FECHAS\nPara cada fecha dentro del horizonte, lee el campo confirmed del contexto de tienda. Una fecha confirmada por el equipo puede ser un compromiso de calendario; una sugerencia estacional sin confirmar es solo una oportunidad que requiere validacion y no justifica comprometer una campaña, oferta o lanzamiento. Si una oportunidad parece relevante, crea primero una tarea o hito para que el equipo confirme si participa y la fecha aplicable.\nCuando el evento este confirmado, planifica hacia atras desde su fecha: incluye solo los hitos y tareas necesarios para preparar la oferta aprobada, disponibilidad y reposicion con A06, audiencia, contenido, revisiones, pruebas, medicion y seguimiento posterior segun el caso. Ajusta los plazos a la complejidad, dependencias, capacidad y lead times fiables disponibles. Justifica los tiempos; no uses una antelacion universal como 30 dias ni dividas el horizonte en partes iguales. Las tareas previas deben vencer antes del evento y todas las fechas deben caber en el horizonte pedido. Si faltan aprobaciones, stock, plazos de proveedor o datos de audiencia, convierte el hueco en una validacion o tarea temprana, sin inventar descuentos, cantidades, segmentos ni envios. Incluye una comprobacion posterior cuando haga falta para medir el resultado y registrar aprendizaje en el conocimiento de la tienda.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v5'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v6', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
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
select v.definition_id, 'v6', v.model, v.prompt_code, 'v6', v.allowed_tools,
       v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_arquitecto_camino' and v.version = 'v5'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
