-- A19 proposes a reviewable audience and communication runway for relevant events.
do $a19_campaign_runway_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_arquitecto_camino_system' and version = 'v6'
  ) then
    raise exception 'A19_PROMPT_V6_REQUIRED_FOR_CAMPAIGN_RUNWAY';
  end if;
end
$a19_campaign_runway_guard$;

with next_prompt as (
  select source.code,
    source.content || E'\n\nSECUENCIA DE AUDIENCIA Y COMUNICACIONES PARA EVENTOS CONFIRMADOS\nSi un evento relevante esta confirmado y participa en el objetivo de la tienda, valora una secuencia de preparacion hacia atras y despues del evento. Incluye solo los hitos y tareas que resuelvan dependencias reales; no apliques una plantilla fija ni conviertas todo evento en una campana de email. Mantén las fechas dentro del horizonte y cada tarea en o antes de la fecha objetivo de su hito. En los titulos o descripciones indica a que evento y fecha confirmada pertenece cada tarea para que el equipo pueda reconocer la secuencia.\nConsidera, cuando aporte valor: (1) validar audiencia, elegibilidad, capacidad de captacion y condiciones de acceso; (2) preparar una lista de espera o segmento de acceso anticipado solo si la oferta, el producto, la capacidad y el canal lo justifican; (3) redactar y revisar comunicaciones de registro, confirmacion, acceso anticipado, apertura publica y seguimiento; (4) comprobar enlaces, segmentacion, contenido, permisos y medicion antes de la fecha; (5) revisar resultados y registrar aprendizajes despues. Ajusta la antelacion a la complejidad, dependencias y capacidad real. No uses plazos universales ni fechas por defecto como 30 dias.\nSi el evento es solo una sugerencia o el equipo no ha confirmado participacion, limita la propuesta a una validacion temprana de mercado, fecha e interes. No diseñes una secuencia completa como si la campaña estuviera aprobada. La lista de espera, el acceso anticipado, el descuento, los precios, las condiciones, la audiencia y cada mensaje requieren datos fiables o confirmacion humana. No inventes incentivos, escasez ni resultados.\nLas tareas de comunicacion son trabajo propuesto para revision; no son envios ni programaciones. Cuando una tarea requiera una pieza, describe el objetivo y el momento de esa pieza para que el equipo pueda generar un borrador desde la tarea en Marketing. No actives listas, segmentos, automatizaciones, descuentos ni campañas. No dupliques materiales ni trabajo ya cubierto por otros agentes. Para comprobaciones y previsiones de existencias, enlaza o coordina con A06 en lugar de inventar cantidades o sustituir su analisis.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v6'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v7', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
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
select v.definition_id, 'v7', v.model, v.prompt_code, 'v7', v.allowed_tools,
       v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_arquitecto_camino' and v.version = 'v6'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
