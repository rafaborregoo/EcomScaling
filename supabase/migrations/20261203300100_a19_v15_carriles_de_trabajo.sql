-- A19 v15 y detallador v3: el Camino tiene tres carriles de trabajo.
--
-- Escalar una tienda no es una lista lineal de tareas sueltas: hay lo que se hace
-- una vez para dejarla lista, lo que se prepara para cada fecha clave y un ciclo
-- de crecimiento que se repite mientras la tienda crece. Cada tarea declara su
-- carril (track) y su cadencia (cadence); el servidor expande las rutinas con
-- cadencia en una tarea por vuelta hasta la fecha de su hito.
do $a19_v15_guard$
begin
  if not exists (select 1 from public.prompt_versions where code = 'a19_arquitecto_camino_system' and version = 'v14') then
    raise exception 'A19_ARCHITECT_PROMPT_V14_REQUIRED_FOR_V15';
  end if;
  if not exists (select 1 from public.prompt_versions where code = 'a19_detallador_tareas_system' and version = 'v2') then
    raise exception 'A19_DETAILER_PROMPT_V2_REQUIRED_FOR_V3';
  end if;
end
$a19_v15_guard$;

with next_prompt as (
  select source.code,
         source.content || E'\n\nCARRILES DE TRABAJO: PUESTA A PUNTO, FECHAS CLAVE Y CICLO DE CRECIMIENTO (sustituye cualquier regla anterior en conflicto)\nCada tarea declara su carril (track) y su cadencia (cadence):\n- puesta_a_punto: se hace UNA vez para dejar la tienda lista para escalar (medición, costes reales, catálogo, flujos base). Solo en las primeras 2-3 semanas y solo lo que los datos digan que falta; si ya está resuelto, no lo repitas. cadence una_vez.\n- temporada: preparación de una fecha clave de la lista «FECHAS CLAVE OBLIGATORIAS» (creativos, mailings, stock, ofertas, envíos). Va en el hito de ese evento. cadence una_vez.\n- crecimiento: el ciclo que hace crecer la tienda y se repite hasta el final del Camino. Cada hito (y cada mes del Camino) incluye de 2 a 4 tareas de crecimiento con su cadencia y con las cifras de la tienda: (a) revisión de rentabilidad, semanal: ROAS y MER frente al ROAS de equilibrio, y la decisión de escalar un 20 % como máximo, mantener o recortar; (b) creativos y pruebas, quincenal: anuncios o variantes nuevas con una hipótesis y un criterio de éxito; (c) email y retención, semanal o quincenal: la campaña o el flujo que toca con su audiencia; (d) conversión y ticket medio, mensual: una mejora con meta y fecha.\n- Escribe cada rutina UNA sola vez por hito, con su cadencia (semanal, quincenal o mensual): el sistema la repite en el calendario hasta la fecha del hito. No dupliques la tarea ni pongas números de semana en el título; el título nombra la rutina y definition_of_done dice qué se anota en cada vuelta (la cifra y la decisión).\n- El crecimiento no se detiene antes de una fecha clave ni después: los hitos de preparación de un evento llevan sus tareas de temporada Y las rutinas de crecimiento del periodo.\n- Equilibrio orientativo: la puesta a punto no pasa del 25 % de las tareas del Camino; el resto es temporada y crecimiento. Un Camino sin tareas de crecimiento con cadencia es un Camino mal hecho.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v14'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v15', content, encode(sha256(convert_to(content, 'UTF8')), 'hex') from next_prompt
on conflict (code, version) do update set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av set is_active = false
where av.is_active and av.version <> 'v15'
  and av.definition_id = (select id from public.agent_definitions where code = 'a19_arquitecto_camino');

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v15', v.model, v.prompt_code, 'v15', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config, true
from public.agent_versions v join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_arquitecto_camino' and v.version = 'v14'
on conflict (definition_id, version) do update
set model = excluded.model, prompt_code = excluded.prompt_code, prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools, approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version, config = excluded.config, is_active = true;

with next_detailer as (
  select source.code,
         source.content || E'\n\nCARRIL Y CADENCIA (sustituye cualquier regla anterior en conflicto)\n- Cada tarea del borrador trae su carril (track: puesta_a_punto, temporada o crecimiento) y su cadencia (una_vez, semanal, quincenal o mensual). Conserva ambos en cada tarea que devuelvas; no cambies el carril ni la cadencia de una tarea que ya los trae. Si una tarea nueva no los trae, ponlos: una_vez para puesta_a_punto y temporada; semanal, quincenal o mensual para las rutinas de crecimiento.\n- Una tarea de crecimiento con cadencia es UNA vuelta de la rutina, redactada para repetirse: qué cifra mirar y dónde, con qué umbral de esta tienda (ROAS de equilibrio, MER, techo de coste por pedido), qué decisión se toma según el resultado (escalar un 20 % como máximo, mantener, recortar) y qué se anota. No pongas números de semana en el título: el sistema la repite en el calendario hasta la fecha del hito.\n- Mantén la proporción: la puesta a punto es lo menos del hito; si el hito es de una fecha clave, tareas de temporada y también las rutinas de crecimiento del periodo.' as content
  from public.prompt_versions source
  where source.code = 'a19_detallador_tareas_system' and source.version = 'v2'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v3', content, encode(sha256(convert_to(content, 'UTF8')), 'hex') from next_detailer
on conflict (code, version) do update set content = excluded.content, checksum = excluded.checksum;
