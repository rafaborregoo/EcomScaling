-- A17's weekly delivery contract is structured in the shared output schema;
-- preserve it in the durable task record while keeping this prompt versioned.
do $a17_contract_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a17_plan_semanal_system' and version = 'v4'
  ) then
    raise exception 'A17_PROMPT_V4_REQUIRED_FOR_WEEKLY_DELIVERY_CONTRACT';
  end if;
end
$a17_contract_guard$;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v5',
  p.content || E'\n\n13. CONTRATO ESTRUCTURADO DE ENTREGA SEMANAL\nCada proposed_write de kind "task" debe completar los campos estructurados owner_role, completion_criteria, expected_metric y due_hint. Si no puedes completar honestamente los cuatro con el contexto disponible, no propongas esa tarea. Propón entre cero y cuatro tareas; nunca fuerces un mínimo para llenar la semana.\nowner_role indica el rol que debe ejecutar el trabajo (cliente o consultor), no la persona a quien la plataforma asignará o notificará la tarea. completion_criteria debe ser un resultado observable que permita marcar la entrega terminada, sin confundirlo con que haya mejorado el negocio. expected_metric nombra el indicador relevante y una ventana/fecha relativa de revisión; si no hay métrica atribuible, explica qué proxy se observará y su limitación, sin inventar objetivos ni resultados. due_hint debe ser un plazo orientativo y relativo dentro de los próximos siete días, coherente con capacidad y dependencias; nunca inventes una fecha de calendario.\nMantén rationale, evidence, description y milestone_id alineados: explica por qué se hace esta semana, incluye fuente y periodo de la evidencia, vincula solo al hito exacto de la misma tienda y separa hipótesis de hechos. A17 transforma una iniciativa mensual vigente de A18/Mi Camino en entregables semanales; no duplica tareas diarias A04, tareas abiertas, campañas planificadas o propuestas aprobadas/pendientes/rechazadas. Usa feedback de tareas como declaración, no como causalidad probada. Las propuestas requieren aprobación humana y no autorizan cambios automáticos.' ,
  encode(sha256(convert_to(p.content || E'\n\n13. CONTRATO ESTRUCTURADO DE ENTREGA SEMANAL\nCada proposed_write de kind "task" debe completar los campos estructurados owner_role, completion_criteria, expected_metric y due_hint. Si no puedes completar honestamente los cuatro con el contexto disponible, no propongas esa tarea. Propón entre cero y cuatro tareas; nunca fuerces un mínimo para llenar la semana.\nowner_role indica el rol que debe ejecutar el trabajo (cliente o consultor), no la persona a quien la plataforma asignará o notificará la tarea. completion_criteria debe ser un resultado observable que permita marcar la entrega terminada, sin confundirlo con que haya mejorado el negocio. expected_metric nombra el indicador relevante y una ventana/fecha relativa de revisión; si no hay métrica atribuible, explica qué proxy se observará y su limitación, sin inventar objetivos ni resultados. due_hint debe ser un plazo orientativo y relativo dentro de los próximos siete días, coherente con capacidad y dependencias; nunca inventes una fecha de calendario.\nMantén rationale, evidence, description y milestone_id alineados: explica por qué se hace esta semana, incluye fuente y periodo de la evidencia, vincula solo al hito exacto de la misma tienda y separa hipótesis de hechos. A17 transforma una iniciativa mensual vigente de A18/Mi Camino en entregables semanales; no duplica tareas diarias A04, tareas abiertas, campañas planificadas o propuestas aprobadas/pendientes/rechazadas. Usa feedback de tareas como declaración, no como causalidad probada. Las propuestas requieren aprobación humana y no autorizan cambios automáticos.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a17_plan_semanal_system' and p.version = 'v4'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a17_plan_semanal');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v5', 'claude-sonnet-5', 'a17_plan_semanal_system', 'v5', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a17_plan_semanal'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
