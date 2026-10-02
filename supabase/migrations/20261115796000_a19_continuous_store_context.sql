-- A19 must ground both the full Camino and its weekly review in current,
-- store-scoped data and the daily/weekly/monthly operating agents.
do $a19_context_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_arquitecto_camino_system' and version = 'v3'
  ) then
    raise exception 'A19_ARCHITECT_PROMPT_V3_REQUIRED_FOR_STORE_CONTEXT';
  end if;
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_revision_camino_system' and version = 'v3'
  ) then
    raise exception 'A19_REVIEW_PROMPT_V3_REQUIRED_FOR_STORE_CONTEXT';
  end if;
end
$a19_context_guard$;

with next_prompt as (
  select source.code,
    source.content || E'\n\nCONTEXTO CONTINUO DE LA TIENDA Y FRESCURA\nEn cada ejecucion usa el contexto operativo incluido para el alcance exacto seleccionado: datos actuales de la tienda, estado de integraciones, tareas y alertas, y las salidas aprobadas/publicadas mas recientes de A04 (ritmo diario), A17 (ritmo semanal) y A18 (ritmo mensual). El servidor adjunta la fecha de cada salida y su ventana de frescura: 36 horas para A04, 8 dias para A17 y 35 dias para A18. Una salida marcada stale, ausente o con error no describe el estado actual; explica la limitacion y usa los datos directos disponibles. Contrasta las recomendaciones operativas con ventas, finanzas, inventario, alertas y tareas actuales de la tienda. No mezcles datos de otras tiendas ni atribuyas registros sin tienda a la tienda seleccionada. En el alcance agregado, usa solo datos agregados. Si una integracion esta desconectada, incompleta o desactualizada, decláralo y no interpretes ausencia como cero. No relances A04/A17/A18 ni dupliques tareas aprobadas: integra sus señales en fases e hitos del Camino y conserva sus cadencias operativas.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v3'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v4', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
from next_prompt
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

with next_prompt as (
  select source.code,
    source.content || E'\n\nCONTEXTO CONTINUO DE LA TIENDA Y FRESCURA\nRevisa los datos actuales del alcance exacto seleccionado junto con las salidas aprobadas/publicadas de A04 (diaria), A17 (semanal) y A18 (mensual). El contexto indica la fecha y la frescura maxima de cada salida: 36 horas para A04, 8 dias para A17 y 35 dias para A18. Una salida stale, ausente o con error no demuestra el estado actual; explica la limitacion y basa cualquier conclusion en datos directos vigentes. Contrasta tareas, alertas y metricas de Shopify, finanzas, inventario e integraciones disponibles. No mezcles tiendas ni atribuyas datos organizativos sin tienda a una tienda concreta. Si una fuente esta desconectada, incompleta o desactualizada, decláralo y no conviertas la falta de datos en cero o bloqueo. No relances los agentes operativos ni dupliques sus tareas.' as content
  from public.prompt_versions source
  where source.code = 'a19_revision_camino_system' and source.version = 'v3'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v4', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
from next_prompt
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id in (
    select id from public.agent_definitions
    where code in ('a19_arquitecto_camino', 'a19_revision_camino')
  );

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v4', v.model, v.prompt_code, 'v4', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where (d.code, v.version) in (('a19_arquitecto_camino', 'v3'), ('a19_revision_camino', 'v3'))
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
