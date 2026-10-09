-- A19 ties the requested horizon to monthly checkpoints and lets the team
-- promote evidence-based learnings into store-scoped knowledge explicitly.
do $a19_growth_loop_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_arquitecto_camino_system' and version = 'v7'
  ) then
    raise exception 'A19_ARCHITECT_PROMPT_V7_REQUIRED_FOR_MONTHLY_GROWTH_LOOP';
  end if;
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_revision_camino_system' and version = 'v4'
  ) then
    raise exception 'A19_REVIEW_PROMPT_V4_REQUIRED_FOR_MONTHLY_GROWTH_LOOP';
  end if;
end
$a19_growth_loop_guard$;

with next_prompt as (
  select source.code,
         source.content || E'\n\nPROGRESION MENSUAL, RENTABILIDAD Y DECISIONES BASADAS EN CONOCIMIENTO\nAl definir una meta cuantificable, devuelve en goal.monthly_targets exactamente un punto de revision por cada mes del horizonte solicitado, ordenados del mes 1 al ultimo. Cada elemento incluye month, target_value y rationale. Si el horizonte cambio al aceptar el borrador, el servidor reajustara fechas, pero no inventes una curva de crecimiento.\nSi baseline y target son observados/comparables, disena una progresion gradual y defendible que termine exactamente en goal.target. Explica cada escalon con los datos, dependencias, capacidad declarada, estacionalidad confirmada y estado de las bases. La curva es un objetivo de gestion, no una prevision ni una promesa. Para metricas donde menos es mejor, la progresion debe reducir el valor hacia el target.\nSi la cobertura, moneda, costes, estacionalidad o baseline no permiten defender valores mensuales, usa target_value=null en los meses afectados y explica que debe medirse o resolverse. No extrapoles ventas como beneficio. Si la tienda pide un objetivo economico, separa ventas, margen y beneficio; protege rentabilidad, caja, stock, experiencia de cliente y operaciones antes de acelerar. No impongas una meta economica cuando no sea la prioridad adecuada.\nUsa el contexto permanente, las fechas de la tienda y los aprendizajes aprobados como contexto declarado/revisado; conserva su alcance y confianza, no los presentes como metricas actuales ni como causalidad demostrada. Si una respuesta guardada no resuelve un supuesto que pueda cambiar la progresion, incluye una pregunta o validacion explicita en el diagnostico o en el primer hito. Incluye fases e hitos operativos que construyan las capacidades necesarias para cada escalon mensual; no conviertas el plan entero en cuotas de facturacion.' as content
  from public.prompt_versions source
  where source.code = 'a19_arquitecto_camino_system' and source.version = 'v7'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v8', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
from next_prompt
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

with next_prompt as (
  select source.code,
         source.content || E'\n\nCIERRE MENSUAL Y PROGRESION DEL OBJETIVO\nEn cada revision semanal, contrasta el valor observado con el punto mensual aplicable de goal.monthly_targets y el target final. Indica que escalon se esta revisando y si los datos representan una ventana mensual completa o una equivalencia basada en una ventana mas corta. Al terminar un mes, explica el resultado del escalon, las causas solo cuando haya evidencia, y que ajuste o pregunta ayudaria a decidir el mes siguiente. Si falta cobertura, moneda comparable o costes, marca insufficient_data; no uses ceros como ausencia de actividad ni supongas que se alcanzo el escalon.\nCuando detectes un aprendizaje reutilizable, incluye evidencia, periodo, alcance y confianza en learnings. Se mostrara al equipo como candidato y solo pasara al Conocimiento reutilizable despues de su aprobacion explicita. Si no hay evidencia suficiente, no inventes un aprendizaje y pide el dato que permitira evaluar el siguiente cierre mensual. Equilibra ingresos con margen/beneficio cuando esten sustentados, experiencia, stock y capacidad; no recomiendes crecimiento que dependa de bases aun no verificadas.' as content
  from public.prompt_versions source
  where source.code = 'a19_revision_camino_system' and source.version = 'v4'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v5', content, encode(sha256(convert_to(content, 'UTF8')), 'hex')
from next_prompt
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a19_arquitecto_camino');

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v8', v.model, v.prompt_code, 'v8', v.allowed_tools,
       v.approval_mode, 'v3', v.config, true
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_arquitecto_camino' and v.version = 'v7'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a19_revision_camino');

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config, is_active)
select v.definition_id, 'v5', v.model, v.prompt_code, 'v5', v.allowed_tools,
       v.approval_mode, 'v3', v.config, true
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_revision_camino' and v.version = 'v4'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
