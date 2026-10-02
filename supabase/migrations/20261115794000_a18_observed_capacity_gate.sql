-- A18 gets a server-computed workload snapshot, but no effort/capacity inputs
-- exist today. Keep the prompt explicit that observed counts are not hours.
insert into public.prompt_versions (code, version, content, checksum)
select
  'a18_plan_mensual_system',
  'v6',
  p.content || E'\n\n17. CARGA OBSERVADA Y CAPACIDAD\nRecibirás un bloque de carga mensual calculado por servidor: tareas abiertas observadas, en curso, pendientes, vencidas y con vencimiento en los próximos 30 días, limitado a la tienda seleccionada más tareas organizativas sin tienda. Si existen, las bandas de esfuerzo low/medium/high son estimaciones cualitativas guardadas con la tarea, no horas. La cobertura incompleta debe permanecer visible. No hay capacidad mensual configurada ni equivalencia validada de esas bandas a horas: available_capacity_hours=null y capacity_status=not_quantifiable significan que no puedes afirmar que haya horas libres ni que el equipo esté saturado. No conviertas conteos o bandas en horas, FTE ni porcentaje de utilización. Usa vencimientos, tareas en curso, prioridades y dependencias para detectar conflictos concretos; si la capacidad real condiciona la decisión, dilo explícitamente y solicita esa estimación antes de declarar viable una iniciativa. Si falla la consulta del backlog, la carga no está disponible; no la interpretes como cero. Mantén el scope de tienda y no atribuyas tareas organizativas a una tienda como evidencia de su carga exclusiva.',
  encode(sha256(convert_to(p.content || E'\n\n17. CARGA OBSERVADA Y CAPACIDAD\nRecibirás un bloque de carga mensual calculado por servidor: tareas abiertas observadas, en curso, pendientes, vencidas y con vencimiento en los próximos 30 días, limitado a la tienda seleccionada más tareas organizativas sin tienda. Si existen, las bandas de esfuerzo low/medium/high son estimaciones cualitativas guardadas con la tarea, no horas. La cobertura incompleta debe permanecer visible. No hay capacidad mensual configurada ni equivalencia validada de esas bandas a horas: available_capacity_hours=null y capacity_status=not_quantifiable significan que no puedes afirmar que haya horas libres ni que el equipo esté saturado. No conviertas conteos o bandas en horas, FTE ni porcentaje de utilización. Usa vencimientos, tareas en curso, prioridades y dependencias para detectar conflictos concretos; si la capacidad real condiciona la decisión, dilo explícitamente y solicita esa estimación antes de declarar viable una iniciativa. Si falla la consulta del backlog, la carga no está disponible; no la interpretes como cero. Mantén el scope de tienda y no atribuyas tareas organizativas a una tienda como evidencia de su carga exclusiva.', 'UTF8')), 'hex')
from public.prompt_versions p
where p.code = 'a18_plan_mensual_system' and p.version = 'v5'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a18_plan_mensual');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, config)
select v.definition_id, 'v6', v.model, 'a18_plan_mensual_system', 'v6', v.allowed_tools, v.approval_mode, v.output_schema_version, v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a18_plan_mensual' and v.version = 'v5'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;
