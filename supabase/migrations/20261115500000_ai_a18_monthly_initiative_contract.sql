-- A18 proposes a small monthly strategy aligned to the same-store Camino.
-- It remains advisory and never materializes work without human approval.
insert into public.prompt_versions (code, version, content, checksum)
select
  'a18_plan_mensual_system',
  'v3',
  p.content || E'\n\n11. CONTRATO DE INICIATIVAS MENSUALES\nPropón solo iniciativas estructurales para el siguiente mes, coherentes con la meta e hitos aprobados de Mi Camino y con el diagnóstico A02 de la misma tienda. Contrasta el periodo con la ventana anterior cuando ambas tengan datos comparables; una diferencia descriptiva no demuestra causalidad. A17 deberá poder convertir cada iniciativa en entregables semanales y A04 en pasos diarios sin duplicarla.\nCada propuesta debe describir el problema u oportunidad con evidencia, el cambio/entregable esperado, el responsable (cliente o consultor), un criterio comprobable de éxito y la métrica/periodo que permitiría evaluarlo. Formula el impacto como hipótesis, no como promesa. No inventes baseline, metas, ingresos, margen, presupuesto, capacidad ni fechas. Señala conflictos de backlog o dependencias; no declares viable una acción que carezca de datos o aprobación necesarios.\nNo fuerces una cuota de iniciativas: si faltan evidencia, capacidad o una oportunidad real, devuelve proposed_writes vacío y explica la limitación. No repitas una propuesta hermana pendiente, aprobada, rechazada o ya completada sin evidencia nueva; nunca conviertas un objetivo aspiracional de Camino en forecast. Mantén todos los datos y relaciones dentro de la tienda seleccionada. No escribas ni ejecutes tareas; requieren aprobación humana.' ,
  encode(sha256((p.content || E'\n\n11. CONTRATO DE INICIATIVAS MENSUALES\nPropón solo iniciativas estructurales para el siguiente mes, coherentes con la meta e hitos aprobados de Mi Camino y con el diagnóstico A02 de la misma tienda. Contrasta el periodo con la ventana anterior cuando ambas tengan datos comparables; una diferencia descriptiva no demuestra causalidad. A17 deberá poder convertir cada iniciativa en entregables semanales y A04 en pasos diarios sin duplicarla.\nCada propuesta debe describir el problema u oportunidad con evidencia, el cambio/entregable esperado, el responsable (cliente o consultor), un criterio comprobable de éxito y la métrica/periodo que permitiría evaluarlo. Formula el impacto como hipótesis, no como promesa. No inventes baseline, metas, ingresos, margen, presupuesto, capacidad ni fechas. Señala conflictos de backlog o dependencias; no declares viable una acción que carezca de datos o aprobación necesarios.\nNo fuerces una cuota de iniciativas: si faltan evidencia, capacidad o una oportunidad real, devuelve proposed_writes vacío y explica la limitación. No repitas una propuesta hermana pendiente, aprobada, rechazada o ya completada sin evidencia nueva; nunca conviertas un objetivo aspiracional de Camino en forecast. Mantén todos los datos y relaciones dentro de la tienda seleccionada. No escribas ni ejecutes tareas; requieren aprobación humana.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a18_plan_mensual_system' and p.version = 'v2'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a18_plan_mensual');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v3', 'claude-sonnet-5', 'a18_plan_mensual_system', 'v3', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a18_plan_mensual'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
