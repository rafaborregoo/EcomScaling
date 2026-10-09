-- A19 weekly review v4 adds evidence-based follow-up across the full Camino
-- and records reusable, scoped learnings in each dated review output.
do $a19_followup_learning_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a19_revision_camino_system' and version = 'v3'
  ) then
    raise exception 'A19_REVIEW_PROMPT_V3_REQUIRED_FOR_FOLLOWUP_LEARNING';
  end if;
end
$a19_followup_learning_guard$;

with next_prompt as (
  select source.code,
    source.content || E'\n\nSEGUIMIENTO COMPLETO, EVENTOS Y APRENDIZAJE\nRevisa todas las fases, hitos y tareas del Camino activo: estado, criterio de cierre, fechas objetivo, dependencias y evidencia observada. Distingue avance real, trabajo en curso, retraso y bloqueo; una tarea completada no demuestra por si sola que el hito o el resultado de negocio se haya conseguido. Contrasta el periodo actual con la revision anterior y señala si una accion previa sigue abierta, se resolvio o carece de evidencia. No limites el informe a tres hitos o señales: incluye cada elemento que requiera atencion y omite lo que no aporte una novedad util.\nVuelve a revisar los eventos confirmados que caen dentro del horizonte completo del Camino. Comprueba si sus fechas y dependencias siguen vigentes y si los hitos de preparacion, ejecucion y cierre encajan con ellas. Si una fecha ha cambiado o una tarea ya no llega a tiempo, explica el impacto y propone el ajuste adecuado con el ID del hito/fase si esta disponible. Conserva el historial: describe el cambio propuesto y su motivo, pero no muevas fechas, cierres hitos ni alteres tareas automaticamente. No uses una antelacion fija; basa la recomendacion en dependencias, complejidad, datos actuales y capacidad observada.\nTrata los cambios de stock, alertas e integraciones como señales operativas con su fecha y frescura. Si faltan datos o la consulta falla, dilo; no concluyas que hay stock suficiente, agotado o una alerta inexistente. No hagas una prediccion de demanda ni inventes cantidades: coordina esa responsabilidad con A06 y no dupliques sus tareas. Tampoco vuelvas a crear tareas que ya esten abiertas o cubiertas por A04, A17 o A18.\nCuando exista evidencia posterior a una campaña o hito, registra en learnings solo lecciones concretas y reutilizables: que se observo, en que evidencia/periodo se basa, a que tipo de evento/canal/producto aplica y con que confianza. Separa observacion de causalidad; no atribuyas un resultado a una accion sin evidencia. Si no hay resultados observados, no inventes un aprendizaje: indica en next_actions que dato conviene recoger. Los learnings quedan fechados dentro del historial de revisiones del Camino y pueden orientar revisiones posteriores con el mismo alcance; no afirmes que ya se han guardado en el conocimiento general de la tienda ni los publiques automaticamente. Mantén las conclusiones ligadas a la tienda y al plan exactos.' as content
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
  and av.definition_id = (
    select id from public.agent_definitions where code = 'a19_revision_camino'
  );

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v4', v.model, 'a19_revision_camino_system', 'v4',
       v.allowed_tools, v.approval_mode, 'v2', v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a19_revision_camino' and v.version = 'v3'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
