-- A19 v13 y detallador v2: fechas clave obligatorias, mailing y creatividades con
-- fechas, coordinacion con A05/A27 y objetivos mensuales explicados.
do $a19_v13_guard$
begin
  if not exists (select 1 from public.prompt_versions where code = 'a19_arquitecto_camino_system' and version = 'v12') then
    raise exception 'A19_ARCHITECT_PROMPT_V12_REQUIRED_FOR_V13';
  end if;
  if not exists (select 1 from public.prompt_versions where code = 'a19_detallador_tareas_system' and version = 'v1') then
    raise exception 'A19_DETAILER_PROMPT_V1_REQUIRED_FOR_V2';
  end if;
end
$a19_v13_guard$;

with next_prompt as (
  select source.code,
         source.content || E'\n\nFECHAS CLAVE, MARKETING COORDINADO Y OBJETIVOS MENSUALES (sustituye cualquier regla anterior en conflicto)\n- El bloque «FECHAS CLAVE OBLIGATORIAS» es una obligación: cada fecha de esa lista tiene en el Camino su preparación propia, con un hito (o una fase si es grande) cuyo nombre nombra el evento, fechado hacia atrás desde empieza_a_preparar. Black Friday, Navidad y Reyes, las rebajas y la temporada de la categoría llevan cada una: producto y stock de los que más venden, oferta con margen, creatividades (anuncios y email), secuencia de mailing con fechas de envío, audiencias, logística con fecha límite de pedido, atención al cliente y medición. Un Camino sin la preparación de una fecha clave del horizonte es un Camino incompleto.\n- El Camino propone los mailings y los creativos con fechas: en las tareas de email indica qué envío es, a qué segmento y qué día; en las de anuncios, qué creativos y cuándo arrancan. No los programas ni los envíes: son propuestas para revisar.\n- Coordinación con marketing: el bloque de campañas ya planificadas y propuestas aprobadas de A05 (campañas) y A27 (mailing) manda. Si ya hay una campaña o un envío para una fecha, tu tarea es prepararlo a tiempo (creatividad, audiencia, stock antes de esa fecha), no crearlo otra vez. Las campañas que falten las propone A05 desde el calendario de marketing: en el hito de la fecha clave incluye una tarea para revisar y aprobar el plan de campañas de esa fecha en Planificación. Nunca nombres a A05, A27 ni a ningún agente en el texto: escribe «el plan de campañas».\n- Objetivos mensuales: son la ruta económica que el cliente verá mes a mes. En el rationale de cada monthly_targets escribe la cifra de partida (mismo mes del año pasado o ritmo actual), el crecimiento asumido y las 1-2 acciones del Camino que lo explican, con su nombre exacto (por ejemplo «Black Friday preparado»). Así el cliente entiende qué hace cada mes por sus ventas.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v12'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v13', content, encode(sha256(convert_to(content, 'UTF8')), 'hex') from next_prompt
on conflict (code, version) do update set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av set is_active = false
where av.is_active and av.version <> 'v13'
  and av.definition_id = (select id from public.agent_definitions where code = 'a19_arquitecto_camino');

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v13', v.model, v.prompt_code, 'v13', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config, true
from public.agent_versions v join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_arquitecto_camino' and v.version = 'v12'
on conflict (definition_id, version) do update
set model = excluded.model, prompt_code = excluded.prompt_code, prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools, approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version, config = excluded.config, is_active = true;

with next_detailer as (
  select source.code,
         source.content || E'\n\nMAILINGS, CREATIVIDADES Y FECHAS (sustituye cualquier regla anterior en conflicto)\n- Tareas de email (kind email): los pasos incluyen la fecha de envío, el segmento o audiencia, dos propuestas de asunto con preheader, la estructura del email por bloques (cabecera, producto o historia, oferta, prueba social, CTA), el enlace de destino y cómo medirlo. Si el contexto trae un envío ya planificado para esa fecha, la tarea prepara ese envío; si no, propone el envío con su fecha. Se redacta para revisión; no se programa ni se envía.\n- Tareas de anuncios (kind ads): los pasos incluyen los creativos (formato, gancho, mensaje y producto), la audiencia, la fecha de arranque y fin, un rango orientativo de presupuesto razonado con el margen y el criterio para pararlos o escalarlos.\n- Tareas de catálogo y operaciones de una fecha clave: el producto o referencia concreta cuando el contexto la dé, y la fecha límite de pedido por transportista del contexto para comunicar la entrega.\n- Alinea cada fecha con el calendario y las campañas que ya existen del contexto; no dupliques un envío o campaña ya planificados. No nombres agentes ni procesos internos: escribe «el plan de campañas».' as content
  from public.prompt_versions source
  where source.code = 'a19_detallador_tareas_system' and source.version = 'v1'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v2', content, encode(sha256(convert_to(content, 'UTF8')), 'hex') from next_detailer
on conflict (code, version) do update set content = excluded.content, checksum = excluded.checksum;
